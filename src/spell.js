// src/spell.js
// src/spell.js
// Utilities to build runtime payloads from hero spell `spec` objects

import { resolveTargets, indexToRow } from './targeting.js';
import { EFFECTS, getEffectByName } from './effects.js';
import { getSpellById } from './spells.js';
import { recomputeModifiers } from '../shared/gameLogic.js';

export function buildPayloadFromSpec(spec = {}, casterRef = {}, boards = {}, ownerRef = null) {
  if (!spec) return null;
  const payload = {};

  const resolvedSpec = (typeof spec === 'string') ? getSpellById(spec)?.spec : spec;
  const useSpec = resolvedSpec || spec;


  // targets left as descriptors for resolution step
  payload.rawTargets = useSpec.targets || [];

  // allow passing animation duration on the spec (many spell specs may include this)
  payload.animationMs = (typeof useSpec.animationMs === 'number') ? useSpec.animationMs : (typeof useSpec.animationms === 'number' ? useSpec.animationms : (typeof useSpec.animation_ms === 'number' ? useSpec.animation_ms : undefined));

  // include any post hooks for engine to interpret
  payload.post = useSpec.post || null;

  // effects: allow referencing by effect object or by effect name (default applied to all targets)
  payload.effects = (useSpec.effects || []).map(e => (typeof e === 'string' ? getEffectByName(e) : e));

  // Precompute caster spellPower for formula adjustments
  const casterSpellPower = (casterRef && casterRef.tile && typeof casterRef.tile.currentSpellPower === 'number') ? Number(casterRef.tile.currentSpellPower) : 0;

  // Build canonical attack/heal payload fragments to be used per-target
  const buildAttackFragment = () => {
    if (!useSpec.formula) return null;
    if (useSpec.formula.type === 'attackPower') {
      let baseVal = useSpec.formula.value || 0;
      let val = (useSpec.formula && useSpec.formula.ignoreSpellPower) ? baseVal : (baseVal + casterSpellPower);
      // Special formula modifier: add half of caster's missing health rounded down
      if (useSpec.formula && useSpec.formula.addCasterMissingHealthHalf && casterRef && casterRef.tile) {
        try {
          const casterTile = casterRef.tile;
          const maxHp = casterTile.hero && typeof casterTile.hero.health === 'number' ? Number(casterTile.hero.health) : 0;
          const curHp = typeof casterTile.currentHealth === 'number' ? Number(casterTile.currentHealth) : maxHp;
          const missing = Math.max(0, maxHp - curHp);
          const add = Math.floor(missing / 2);
          val = Number(val) + Number(add);
        } catch (err) { /* ignore and keep base val */ }
      }
      const frag = { action: 'damage', value: val };
      frag.armorMultiplier = typeof useSpec.formula.armorMultiplier === 'number' ? useSpec.formula.armorMultiplier : 1;
      if (useSpec.formula.ignoreArmor) frag.ignoreArmor = true;
      // Mark if we need to add target's missing health per-target (for Execute spell)
      if (useSpec.formula.addTargetMissingHealth) frag.addTargetMissingHealth = true;
      return frag;
    }
    if (useSpec.formula.type === 'damage') {
      // 'damage' type represents flat damage (like pulse effects) - ignores armor and spell power by default
      const baseVal = useSpec.formula.value || 0;
      const frag = { action: 'damage', value: baseVal, ignoreArmor: true };
      return frag;
    }
    if (useSpec.formula.type === 'roll') {
      const die = Number(useSpec.formula.die || 6);
      const base = Number(useSpec.formula.base || 0);
      const roll = Math.floor(Math.random() * die) + 1;
      const val = (useSpec.formula && useSpec.formula.ignoreSpellPower) ? (base + roll) : (base + roll + casterSpellPower);
      // Include roll details for dice animation
      return { action: 'damage', value: val, rollInfo: { die, base, roll, total: val } };
    }
    // healPower: healing that scales with spell power (used by most healing spells)
    if (useSpec.formula.type === 'healPower') {
      const baseHeal = useSpec.formula.value || 0;
      const val = baseHeal + casterSpellPower;
      return { action: 'heal', value: val };
    }
    // heal: flat healing that ignores spell power (used by effects, passives, dragonling self-heals)
    if (useSpec.formula.type === 'heal') {
      const baseHeal = useSpec.formula.value || 0;
      return { action: 'heal', value: baseHeal };
    }
    return null;
  };

  const attackFrag = buildAttackFragment();

  // resolve concrete target tokens now (returns [{board:'p1', index}])
  // Pass ownerRef if provided so adjacentToSelf can use owner's position
  // Pass bypassTriggers option if spell has post.bypassTriggers (e.g., basicAttack)
  const resolveOptions = { bypassTriggers: !!(useSpec.post && useSpec.post.bypassTriggers) };
  // Resolve all descriptors together (so 'adjacent' can find the anchor from previous descriptors),
  // but track which targets came from which descriptor for proper perTargetExtras mapping.
  payload.targets = [];
  const descriptorIndexForTarget = []; // Track which descriptor index each target came from
  try {
    const descs = Array.isArray(payload.rawTargets) ? payload.rawTargets : (payload.rawTargets ? [payload.rawTargets] : []);
    
    // Resolve each descriptor individually to track which targets came from which descriptor
    // We need to accumulate the 'out' array so that adjacent targeting can anchor to previous targets
    let accumulatedTargets = [];
    for (let descIdx = 0; descIdx < descs.length; descIdx++) {
      const d = descs[descIdx];
      try {
        // For 'adjacent' type, we need to temporarily inject the previously resolved targets
        // into the targeting resolution context. We'll do this by resolving all descriptors
        // up to this point together, then taking only the new ones.
        const descsUpToNow = descs.slice(0, descIdx + 1);
        const allTargetsUpToNow = resolveTargets(descsUpToNow, casterRef, boards, ownerRef, resolveOptions) || [];
        
        // New targets are those beyond what we had before
        const newTargets = allTargetsUpToNow.slice(accumulatedTargets.length);
        
        if (newTargets.length > 0) {
          payload.targets.push(...newTargets);
          for (let j = 0; j < newTargets.length; j++) {
            descriptorIndexForTarget.push(descIdx);
          }
        } else {
          // No targets from this descriptor, push null placeholder
          payload.targets.push(null);
          descriptorIndexForTarget.push(descIdx);
        }
        
        accumulatedTargets = allTargetsUpToNow;
      } catch (e) {
        payload.targets.push(null);
        descriptorIndexForTarget.push(descIdx);
      }
    }
  } catch (e) {
    // Fallback: resolve whole array if anything goes wrong
    payload.targets = resolveTargets(payload.rawTargets, casterRef, boards, ownerRef, resolveOptions);
    // Can't track descriptor indices in fallback, so just use sequential indices
    for (let i = 0; i < payload.targets.length; i++) {
      descriptorIndexForTarget.push(i);
    }
  }

  // Build per-target payloads: if a target is an ally and a post.secondaryHeal exists,
  // create a heal fragment for that target; otherwise use the attack fragment.
  payload.perTargetPayloads = [];
  // allow per-target extras (e.g., perTargetExtras[0] = { post: { removeTopPositiveEffect: true } })
  const perTargetExtras = Array.isArray(useSpec.perTargetExtras) ? useSpec.perTargetExtras : (Array.isArray(useSpec.perTargetPayloadExtras) ? useSpec.perTargetPayloadExtras : []);
  const secondary = (useSpec.post && useSpec.post.secondaryHeal) ? useSpec.post.secondaryHeal : null;
  const casterBoard = casterRef && casterRef.boardName && casterRef.boardName.startsWith('p1') ? 'p1' : 'p2';
  
  // Blood Drain conditional: compare caster health to target health
  const conditionalHealthCheck = useSpec.post && useSpec.post.conditionalOnCasterVsTargetHealth;
  const casterHealth = casterRef && casterRef.tile ? (casterRef.tile.currentHealth != null ? casterRef.tile.currentHealth : (casterRef.tile.hero && casterRef.tile.hero.health) || 0) : 0;
  for (let i = 0; i < (payload.targets || []).length; i++) {
    const t = payload.targets[i];
    const targetBoard = t && t.board ? t.board : null;
    const isAlly = targetBoard === casterBoard;
    
    // Blood Drain: conditional damage/heal based on caster vs target health
    if (conditionalHealthCheck && t && !isAlly) {
      try {
        const boardArr = t.board === 'p1' ? (boards.p1Board || []) : (boards.p2Board || []);
        const targetTile = (boardArr || [])[t.index];
        const targetHealth = targetTile ? (targetTile.currentHealth != null ? targetTile.currentHealth : (targetTile.hero && targetTile.hero.health) || 0) : 0;
        
        if (casterHealth < targetHealth) {
          // Caster has less health: deal lessThan damage and queue heal for caster
          const dmg = (conditionalHealthCheck.lessThan.damage || 3) + casterSpellPower;
          const healAmt = (conditionalHealthCheck.lessThan.healCaster || 5) + casterSpellPower;
          const frag = { action: 'damage', value: dmg, armorMultiplier: 1 };
          frag.post = { healCasterAmount: healAmt }; // signal to engine to heal caster
          payload.perTargetPayloads.push(frag);
        } else {
          // Caster has equal or more health: deal greaterOrEqual damage
          const dmg = (conditionalHealthCheck.greaterOrEqual.damage || 5) + casterSpellPower;
          const frag = { action: 'damage', value: dmg, armorMultiplier: 1 };
          payload.perTargetPayloads.push(frag);
        }
        continue;
      } catch (e) {
        // Fallback to default attack fragment on error
        payload.perTargetPayloads.push({ ...attackFrag });
        continue;
      }
    }
    
    if (isAlly && secondary) {
      // build heal fragment from secondary specification
      // Secondary heals use spell power by default (like healPower formula type)
      // Set ignoreSpellPower: true to make a flat heal (e.g., Dragonling self-heals)
      const secAmt = Number(secondary.amount || 0);
      const addSpellPower = (secondary.ignoreSpellPower === true) ? 0 : casterSpellPower;
      const frag = { action: 'heal', value: secAmt + addSpellPower };
      payload.perTargetPayloads.push(frag);
    } else if (attackFrag) {
      // If the formula requests adding the target's missing health, compute it per-target
      if (attackFrag.addTargetMissingHealth) {
        try {
          const tgt = payload.targets[i];
          const boardArr = (tgt && tgt.board === 'p1') ? (boards.p1Board || []) : (boards.p2Board || []);
          const tile = (boardArr || [])[tgt && typeof tgt.index === 'number' ? tgt.index : -1];
          if (tile && tile.hero) {
            const maxHp = tile.hero.health || 0;
            const curHp = (tile.currentHealth != null) ? tile.currentHealth : maxHp;
            const missingHp = Math.max(0, maxHp - curHp);
            const fragCopy = { ...attackFrag };
            fragCopy.value = Number(fragCopy.value || 0) + missingHp;
            delete fragCopy.addTargetMissingHealth; // Remove the marker
            payload.perTargetPayloads.push(fragCopy);
          } else {
            // No valid target, use base damage
            const fragCopy = { ...attackFrag };
            delete fragCopy.addTargetMissingHealth;
            payload.perTargetPayloads.push(fragCopy);
          }
        } catch (err) {
          // Fallback to base damage on error
          const fragCopy = { ...attackFrag };
          delete fragCopy.addTargetMissingHealth;
          payload.perTargetPayloads.push(fragCopy);
        }
      } else if (useSpec.formula && useSpec.formula.addTargetArmor) {
        try {
          const tgt = payload.targets[i];
          const boardArr = (tgt && tgt.board === 'p1') ? (boards.p1Board || []) : (boards.p2Board || []);
          const tile = (boardArr || [])[tgt && typeof tgt.index === 'number' ? tgt.index : -1];
          const targetArmor = (tile && typeof tile.currentArmor === 'number') ? Number(tile.currentArmor) : 0;
          const fragCopy = { ...attackFrag };
          fragCopy.value = Number(fragCopy.value || 0) + targetArmor;
          payload.perTargetPayloads.push(fragCopy);
        } catch (e) {
          payload.perTargetPayloads.push({ ...attackFrag });
        }
      } else if (useSpec.formula && useSpec.formula.addTargetEffectNameCount) {
        try {
          const tgt = payload.targets[i];
          const boardArr = (tgt && tgt.board === 'p1') ? (boards.p1Board || []) : (boards.p2Board || []);
          const tile = (boardArr || [])[tgt && typeof tgt.index === 'number' ? tgt.index : -1];
          const effectName = useSpec.formula.addTargetEffectNameCount;
          const mult = (typeof useSpec.formula.addTargetEffectCountMultiplier === 'number') ? Number(useSpec.formula.addTargetEffectCountMultiplier) : 1;
          const count = (tile && tile.effects) ? tile.effects.filter(e => e && e.name === effectName).length : 0;
          const fragCopy = { ...attackFrag };
          fragCopy.value = Number(fragCopy.value || 0) + (count * mult);
          payload.perTargetPayloads.push(fragCopy);
        } catch (e) {
          payload.perTargetPayloads.push({ ...attackFrag });
        }
      } else if (useSpec.formula && typeof useSpec.formula.addTargetEffectsMultiplier === 'number') {
        try {
          const tgt = payload.targets[i];
          const boardArr = (tgt && tgt.board === 'p1') ? (boards.p1Board || []) : (boards.p2Board || []);
          const tile = (boardArr || [])[tgt && typeof tgt.index === 'number' ? tgt.index : -1];
          const buffCount = (tile && tile.effects) ? (tile.effects.filter(e => e && e.kind === 'buff').length) : 0;
          const fragCopy = { ...attackFrag };
          fragCopy.value = Number(fragCopy.value || 0) + (buffCount * Number(useSpec.formula.addTargetEffectsMultiplier || 0));
          payload.perTargetPayloads.push(fragCopy);
        } catch (e) {
          payload.perTargetPayloads.push({ ...attackFrag });
        }
      } else {
        payload.perTargetPayloads.push({ ...attackFrag });
      }
    } else {
      payload.perTargetPayloads.push({ action: null });
    }

    // Merge any per-target extras into the perTargetPayload entry
    // Use the descriptor index (not target index) to look up the correct perTargetExtras entry
    try {
      const descIdx = descriptorIndexForTarget[i];
      const extra = perTargetExtras && typeof descIdx === 'number' && perTargetExtras[descIdx] ? perTargetExtras[descIdx] : null;
      if (extra && typeof extra === 'object') {
        payload.perTargetPayloads[i] = { ...(payload.perTargetPayloads[i] || {}), ...extra };
      }
    } catch (e) {}
  }

  return payload;
}

export function applyEffectsToTile(tile, effects = [], addLog, ownerRef = null) {
  if (!tile) return;
  tile.effects = tile.effects || [];
  for (const e of effects) {
    // normalize explicit permanent markers to a non-numeric sentinel (null)
    const copy = { ...e };
    if (copy.duration === 'permanent' || copy.duration === 'forever' || copy.duration === Infinity || copy.duration === -1) {
      copy.duration = null;
    }
    // annotate who applied this effect when available (used by triggered spellSpecs)
    if (ownerRef) copy.appliedBy = ownerRef;
    // push the new effect (newest at end). If this would exceed 4 effects,
    // remove the oldest (shift) so the visual top slot shows the oldest.
    tile.effects.push(copy);
    if (tile.effects.length > 4) {
      const removed = tile.effects.shift();
      addLog && addLog(`  > Effect ${removed && removed.name} was bumped off due to effect limit`);
    }
    addLog && addLog(`  > Applied effect ${e.name} to tile`);
  }
  // after applying effects, recompute runtime modifiers so visible stats update
  try { recomputeModifiers(tile); } catch (e) {}
}

// Recompute runtime modifiers (armor, speed, spellPower) for a tile based on
// its hero base stats and current active effects. Call this after applying
// or removing effects so the visible stats reflect modifiers.
// Moved to shared/gameLogic.js

// Helper: return true if this tile's hero is allowed to have zero or negative speed
export function canHaveZeroSpeed(tile) {
  return !!(tile && tile.hero && tile.hero.allowZeroSpeed === true);
}

// Helper: enforce the global speed floor (1) unless an exception is present
export function capSpeedForTile(tile, speed) {
  const s = Number(typeof speed === 'number' ? speed : (speed == null ? 0 : Number(speed)));
  return canHaveZeroSpeed(tile) ? s : Math.max(1, s);
}

export default { buildPayloadFromSpec, applyEffectsToTile };

