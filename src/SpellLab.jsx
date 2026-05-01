import React, { useEffect, useMemo, useState } from 'react';
import Slash from './animations/Slash';
import { SPELLS } from './spells.js';
import { SPELL_CONFIG } from './spellConfigs';
import sfxManager from './SfxManager';
import getAssetPath from './utils/assetPath';
import resolveSpellSoundProfile from './utils/spellAudio';

const STAGE_WIDTH = 420;
const STAGE_HEIGHT = 180;
const TRAVEL_FROM = { x: 88, y: 92 };
const TRAVEL_TO = { x: 332, y: 92 };
const INPLACE_POINT = { x: 210, y: 92 };

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value, digits = 2) {
  return Number(toNumber(value, 0)).toFixed(digits);
}

function buildAnimationPreview(animationKey) {
  if (!animationKey) return null;
  const cfg = SPELL_CONFIG[animationKey] || null;
  return {
    animationKey,
    sprite: cfg && cfg.file ? cfg.file : `/images/spells/${animationKey}.png`,
    frames: cfg && typeof cfg.frames === 'number' ? cfg.frames : 1,
    cols: cfg && typeof cfg.cols === 'number' ? cfg.cols : 1,
    rows: cfg && typeof cfg.rows === 'number' ? cfg.rows : 1,
    size: cfg && typeof cfg.maxDisplaySize === 'number' ? Math.max(48, Number(cfg.maxDisplaySize)) : 120
  };
}

export default function SpellLab() {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const spellOptions = useMemo(
    () => Object.values(SPELLS).filter(Boolean).slice().sort((left, right) => String(left.name || left.id).localeCompare(String(right.name || right.id))),
    []
  );
  const initialSpellId = searchParams.get('spell') || (spellOptions[0] ? spellOptions[0].id : 'basicAttack');

  const [selectedSpellId, setSelectedSpellId] = useState(initialSpellId);
  const [previewState, setPreviewState] = useState(null);
  const [soundVolume, setSoundVolume] = useState('1');
  const [soundDelayMs, setSoundDelayMs] = useState('0');
  const [soundStartTime, setSoundStartTime] = useState('0');
  const [soundEndTime, setSoundEndTime] = useState('1.2');
  const [secondarySoundVolume, setSecondarySoundVolume] = useState('1');
  const [secondarySoundDelayMs, setSecondarySoundDelayMs] = useState('0');
  const [secondarySoundStartTime, setSecondarySoundStartTime] = useState('0');
  const [secondarySoundEndTime, setSecondarySoundEndTime] = useState('1.2');
  const [animationDurationMs, setAnimationDurationMs] = useState('1200');
  const [searchText, setSearchText] = useState('');

  const selectedSpell = useMemo(
    () => spellOptions.find(spell => spell.id === selectedSpellId) || spellOptions[0] || null,
    [selectedSpellId, spellOptions]
  );

  useEffect(() => {
    if (!selectedSpell) return;
    const soundProfile = resolveSpellSoundProfile(selectedSpell, null, 'primary');
    const secondaryProfile = resolveSpellSoundProfile(selectedSpell, null, 'secondary');
    setSoundVolume(String(soundProfile.soundVolume ?? 1));
    setSoundDelayMs(String(soundProfile.soundDelayMs ?? 0));
    setSoundStartTime(String(soundProfile.soundStartTime ?? 0));
    setSoundEndTime(String(soundProfile.soundEndTime ?? 1.2));
    setSecondarySoundVolume(String(secondaryProfile.soundVolume ?? 1));
    setSecondarySoundDelayMs(String(secondaryProfile.soundDelayMs ?? 0));
    setSecondarySoundStartTime(String(secondaryProfile.soundStartTime ?? 0));
    setSecondarySoundEndTime(String(secondaryProfile.soundEndTime ?? 1.2));
    setAnimationDurationMs(String(selectedSpell?.spec?.animationMs ?? 1200));
  }, [selectedSpell]);

  const filteredSpellOptions = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    if (!normalizedSearch) return spellOptions;
    return spellOptions.filter(spell => {
      const haystack = `${spell.name || ''} ${spell.id || ''}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [searchText, spellOptions]);

  const resolvedSoundProfile = useMemo(() => resolveSpellSoundProfile(selectedSpell, null, 'primary'), [selectedSpell]);
  const resolvedSecondarySoundProfile = useMemo(() => resolveSpellSoundProfile(selectedSpell, null, 'secondary'), [selectedSpell]);
  const resolvedSoundFile = resolvedSoundProfile.soundFile;
  const resolvedSecondarySoundFile = resolvedSecondarySoundProfile.soundFile;
  const primaryPreview = useMemo(() => buildAnimationPreview(selectedSpell && selectedSpell.animation), [selectedSpell]);
  const secondaryPreview = useMemo(() => buildAnimationPreview(selectedSpell && selectedSpell.animationSecondary), [selectedSpell]);

  const playConfiguredSound = ({ soundFile, volume, delayMs, startTime, endTime }) => {
    if (!soundFile) return;
    sfxManager.playSound({
      src: getAssetPath(soundFile),
      baseVolume: toNumber(volume, 1),
      delayMs: toNumber(delayMs, 0),
      startTime: toNumber(startTime, 0),
      endTime: toNumber(endTime, null)
    });
  };

  const triggerAnimationPreview = (animationPreview, soundConfig = null) => {
    if (!animationPreview) return;
    const placement = selectedSpell && selectedSpell.animationPlacement ? selectedSpell.animationPlacement : 'travel';
    const isTravel = placement === 'travel';
    setPreviewState({
      key: Date.now(),
      animationPreview,
      from: isTravel ? TRAVEL_FROM : INPLACE_POINT,
      to: isTravel ? TRAVEL_TO : INPLACE_POINT,
      duration: toNumber(animationDurationMs, selectedSpell?.spec?.animationMs ?? 1200)
    });
    if (soundConfig && soundConfig.soundFile) {
      playConfiguredSound(soundConfig);
    }
  };

  const hasSecondaryAudioControls = !!(selectedSpell?.animationSecondary || resolvedSecondarySoundFile);

  const currentSnippet = useMemo(() => {
    if (!selectedSpell) return '';
    const lines = [
      `soundVolume: ${formatNumber(soundVolume, 2)},`,
      `soundDelayMs: ${Math.round(toNumber(soundDelayMs, 0))},`,
      `soundStartTime: ${formatNumber(soundStartTime, 2)},`,
      `soundEndTime: ${formatNumber(soundEndTime, 2)}`
    ];
    if (hasSecondaryAudioControls) {
      lines.push(
        `secondarySoundVolume: ${formatNumber(secondarySoundVolume, 2)},`,
        `secondarySoundDelayMs: ${Math.round(toNumber(secondarySoundDelayMs, 0))},`,
        `secondarySoundStartTime: ${formatNumber(secondarySoundStartTime, 2)},`,
        `secondarySoundEndTime: ${formatNumber(secondarySoundEndTime, 2)}`
      );
    }
    return lines.join('\n');
  }, [
    selectedSpell,
    soundDelayMs,
    soundEndTime,
    soundStartTime,
    soundVolume,
    hasSecondaryAudioControls,
    secondarySoundVolume,
    secondarySoundDelayMs,
    secondarySoundStartTime,
    secondarySoundEndTime
  ]);

  return (
    <div style={{ minHeight: '100vh', padding: 20, background: 'linear-gradient(180deg, #11161b 0%, #1a222a 100%)', color: '#f3efe4' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gap: 18 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Spell Lab</div>
          <div style={{ color: '#c4c0b2', maxWidth: 760 }}>
            Preview one spell at a time, tune sound delay and clip windows, and play the sound exactly the way battle playback will use it.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18, alignItems: 'start' }}>
          <div style={{ background: 'rgba(8, 12, 18, 0.82)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1, color: '#9aa6b2' }}>Search</span>
              <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Filter by spell name" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3945', background: '#10161d', color: '#f3efe4' }} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1, color: '#9aa6b2' }}>Spell</span>
              <select value={selectedSpellId} onChange={e => setSelectedSpellId(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3945', background: '#10161d', color: '#f3efe4' }}>
                {filteredSpellOptions.map(spell => (
                  <option key={spell.id} value={spell.id}>{spell.name} ({spell.id})</option>
                ))}
              </select>
            </label>

            <div style={{ display: 'grid', gap: 8, color: '#d8d2c4' }}>
              <div><strong>Name:</strong> {selectedSpell?.name || 'Unknown'}</div>
              <div><strong>Primary animation:</strong> {selectedSpell?.animation || 'None'}</div>
              <div><strong>Secondary animation:</strong> {selectedSpell?.animationSecondary || 'None'}</div>
              <div><strong>Placement:</strong> {selectedSpell?.animationPlacement || 'travel'}</div>
              <div><strong>Primary sound:</strong> {resolvedSoundFile || 'None'}</div>
              <div><strong>Secondary sound:</strong> {resolvedSecondarySoundFile || 'None'}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ background: 'rgba(8, 12, 18, 0.82)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, display: 'grid', gap: 16 }}>
              <div style={{ fontWeight: 700 }}>Primary Sound</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1, color: '#9aa6b2' }}>Volume</span>
                  <input type="number" step="0.05" value={soundVolume} onChange={e => setSoundVolume(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3945', background: '#10161d', color: '#f3efe4' }} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1, color: '#9aa6b2' }}>Delay ms</span>
                  <input type="number" step="10" value={soundDelayMs} onChange={e => setSoundDelayMs(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3945', background: '#10161d', color: '#f3efe4' }} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1, color: '#9aa6b2' }}>Start s</span>
                  <input type="number" step="0.01" value={soundStartTime} onChange={e => setSoundStartTime(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3945', background: '#10161d', color: '#f3efe4' }} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1, color: '#9aa6b2' }}>End s</span>
                  <input type="number" step="0.01" value={soundEndTime} onChange={e => setSoundEndTime(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3945', background: '#10161d', color: '#f3efe4' }} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1, color: '#9aa6b2' }}>Anim ms</span>
                  <input type="number" step="50" value={animationDurationMs} onChange={e => setAnimationDurationMs(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3945', background: '#10161d', color: '#f3efe4' }} />
                </label>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button onClick={() => playConfiguredSound({ soundFile: resolvedSoundFile, volume: soundVolume, delayMs: soundDelayMs, startTime: soundStartTime, endTime: soundEndTime })} disabled={!resolvedSoundFile} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #3b4756', background: '#15202b', color: '#f3efe4', cursor: 'pointer' }}>Play Primary Sound</button>
                <button onClick={() => triggerAnimationPreview(primaryPreview)} disabled={!primaryPreview} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #3b4756', background: '#15202b', color: '#f3efe4', cursor: 'pointer' }}>Play Primary Animation</button>
                <button onClick={() => triggerAnimationPreview(primaryPreview, { soundFile: resolvedSoundFile, volume: soundVolume, delayMs: soundDelayMs, startTime: soundStartTime, endTime: soundEndTime })} disabled={!primaryPreview} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #3b4756', background: '#233247', color: '#f3efe4', cursor: 'pointer' }}>Play Primary + Sound</button>
              </div>
            </div>

            {hasSecondaryAudioControls ? (
              <div style={{ background: 'rgba(8, 12, 18, 0.82)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, display: 'grid', gap: 16 }}>
                <div style={{ fontWeight: 700 }}>Secondary Sound</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1, color: '#9aa6b2' }}>Volume</span>
                    <input type="number" step="0.05" value={secondarySoundVolume} onChange={e => setSecondarySoundVolume(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3945', background: '#10161d', color: '#f3efe4' }} />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1, color: '#9aa6b2' }}>Delay ms</span>
                    <input type="number" step="10" value={secondarySoundDelayMs} onChange={e => setSecondarySoundDelayMs(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3945', background: '#10161d', color: '#f3efe4' }} />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1, color: '#9aa6b2' }}>Start s</span>
                    <input type="number" step="0.01" value={secondarySoundStartTime} onChange={e => setSecondarySoundStartTime(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3945', background: '#10161d', color: '#f3efe4' }} />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1, color: '#9aa6b2' }}>End s</span>
                    <input type="number" step="0.01" value={secondarySoundEndTime} onChange={e => setSecondarySoundEndTime(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3945', background: '#10161d', color: '#f3efe4' }} />
                  </label>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <button onClick={() => playConfiguredSound({ soundFile: resolvedSecondarySoundFile, volume: secondarySoundVolume, delayMs: secondarySoundDelayMs, startTime: secondarySoundStartTime, endTime: secondarySoundEndTime })} disabled={!resolvedSecondarySoundFile} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #3b4756', background: '#15202b', color: '#f3efe4', cursor: 'pointer' }}>Play Secondary Sound</button>
                  <button onClick={() => triggerAnimationPreview(secondaryPreview)} disabled={!secondaryPreview} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #3b4756', background: '#15202b', color: '#f3efe4', cursor: 'pointer' }}>Play Secondary Animation</button>
                  <button onClick={() => triggerAnimationPreview(secondaryPreview, { soundFile: resolvedSecondarySoundFile, volume: secondarySoundVolume, delayMs: secondarySoundDelayMs, startTime: secondarySoundStartTime, endTime: secondarySoundEndTime })} disabled={!secondaryPreview} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #3b4756', background: '#233247', color: '#f3efe4', cursor: 'pointer' }}>Play Secondary + Sound</button>
                </div>
              </div>
            ) : null}

            <div style={{ background: 'rgba(8, 12, 18, 0.82)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, display: 'grid', gap: 14 }}>
              <div style={{ fontWeight: 700 }}>Preview Stage</div>
              <div style={{ position: 'relative', width: STAGE_WIDTH, height: STAGE_HEIGHT, borderRadius: 14, border: '1px solid #334150', background: 'radial-gradient(circle at 50% 45%, rgba(52, 68, 88, 0.35), rgba(12, 17, 24, 0.92) 65%)', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: TRAVEL_FROM.x - 14, top: TRAVEL_FROM.y - 14, width: 28, height: 28, borderRadius: 999, border: '2px solid #87c5ff', background: 'rgba(135,197,255,0.12)' }} />
                <div style={{ position: 'absolute', left: TRAVEL_TO.x - 14, top: TRAVEL_TO.y - 14, width: 28, height: 28, borderRadius: 999, border: '2px solid #ffb48a', background: 'rgba(255,180,138,0.12)' }} />
                <div style={{ position: 'absolute', left: TRAVEL_FROM.x, top: TRAVEL_FROM.y + 24, transform: 'translateX(-50%)', color: '#87c5ff', fontSize: 12 }}>Caster</div>
                <div style={{ position: 'absolute', left: TRAVEL_TO.x, top: TRAVEL_TO.y + 24, transform: 'translateX(-50%)', color: '#ffb48a', fontSize: 12 }}>Target</div>
                {previewState ? (
                  <Slash
                    key={previewState.key}
                    from={previewState.from}
                    to={previewState.to}
                    duration={previewState.duration}
                    size={previewState.animationPreview.size}
                    sprite={previewState.animationPreview.sprite}
                    frames={previewState.animationPreview.frames}
                    cols={previewState.animationPreview.cols}
                    rows={previewState.animationPreview.rows}
                  />
                ) : null}
              </div>
              <div style={{ color: '#aeb7c2', fontSize: 13 }}>
                `travel` animations move from caster to target. `inplace` animations preview on the target point. Primary and secondary sound previews use their own delay, trim, and volume values.
              </div>
            </div>

            <div style={{ background: 'rgba(8, 12, 18, 0.82)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, display: 'grid', gap: 10 }}>
              <div style={{ fontWeight: 700 }}>Current Snippet</div>
              <textarea readOnly value={currentSnippet} style={{ minHeight: 110, resize: 'vertical', padding: 12, borderRadius: 10, border: '1px solid #2d3945', background: '#10161d', color: '#f3efe4', fontFamily: 'Consolas, Monaco, monospace', fontSize: 13 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}