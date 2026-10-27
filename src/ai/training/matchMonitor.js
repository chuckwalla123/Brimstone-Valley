import { indexToColumn, indexToRow, indexToTileNumber } from '../../targeting.js';
import { applyMovementAction, getMovementSequence } from './environment.js';
import { getOpponentColumnAttackDamage } from './easyAIPlusTeacher.js';

const CELL_WIDTH = 19;
const ROW_NAMES = ['front', 'middle', 'back'];
const MAIN_LIMIT = 5;
const MAX_BATTLE_LOG_LINES = 120;

const isAlive = (tile) => !!tile?.hero && !tile._dead && Number(tile.currentHealth ?? tile.hero.health ?? 0) > 0;
const isCountedMain = (tile) => isAlive(tile) && !tile.hero?.isMinion && !tile._revivedExtra;
const heroName = (tile) => tile?.hero?.name || tile?.hero?.id || '?';
const pad = (text, width) => String(text).slice(0, width).padEnd(width, ' ');
const prettify = (id) => String(id || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/ID$/, '');

const effectLabel = (effect) => {
  const name = effect?.name || effect?.id || effect?.kind || '?';
  const stacks = Number(effect?.stacks ?? effect?.count ?? 1);
  return stacks > 1 ? `${name}x${stacks}` : String(name);
};

const activeSpellLabel = (tile, index, side) => {
  const rowKey = ['front', 'middle', 'back'][indexToRow(index, side)];
  const data = tile.hero?.spells?.[rowKey];
  const id = data?.spell || data?.id;
  return id ? prettify(id) : '-';
};

const renderCellLines = (tile, index, side, marked) => {
  if (!isAlive(tile)) {
    return [pad(tile?._dead ? '  (corpse)' : '   .', CELL_WIDTH), ' '.repeat(CELL_WIDTH), ' '.repeat(CELL_WIDTH), ' '.repeat(CELL_WIDTH)];
  }
  const effects = (tile.effects || []).map(effectLabel).join(',');
  return [
    pad(`${marked ? '*' : ''}${heroName(tile)}`, CELL_WIDTH),
    pad(`HP${tile.currentHealth} AR${tile.currentArmor} SP${tile.currentSpeed} EN${tile.currentEnergy}`, CELL_WIDTH),
    pad(`>${activeSpellLabel(tile, index, side)}`, CELL_WIDTH),
    pad(effects ? `[${effects}]` : '', CELL_WIDTH),
  ];
};

// Lane layout: each text line group is one column "lane". P1 lanes run col 0..2, P2 lanes are shown
// col 2..0 because enemy column attacks mirror the column (P1 col c is hit via P2 col 2-c).
// Within a lane, P1 depth runs back -> front and P2 depth runs front -> back, so fronts meet in the middle.
const renderMainBoards = (state, markedKeys = new Set()) => {
  const lines = [];
  const header = `${pad('P1 (left)  back <- front', CELL_WIDTH * 3 + 2)}  |  ${pad('P2 (right) front -> back', CELL_WIDTH * 3 + 2)}`;
  lines.push(header);
  const byPosition = (board, side) => {
    const grid = {};
    (board || []).forEach((tile, index) => {
      grid[`${indexToColumn(index, side)}:${indexToRow(index, side)}`] = { tile, index };
    });
    return grid;
  };
  const p1Grid = byPosition(state.p1Main, 'p1');
  const p2Grid = byPosition(state.p2Main, 'p2');

  for (let lane = 0; lane < 3; lane += 1) {
    const p1Col = lane;
    const p2Col = 2 - lane;
    const p1Cells = [2, 1, 0].map((row) => {
      const entry = p1Grid[`${p1Col}:${row}`];
      return renderCellLines(entry?.tile, entry?.index, 'p1', markedKeys.has(`p1:${entry?.index}`));
    });
    const p2Cells = [0, 1, 2].map((row) => {
      const entry = p2Grid[`${p2Col}:${row}`];
      return renderCellLines(entry?.tile, entry?.index, 'p2', markedKeys.has(`p2:${entry?.index}`));
    });
    for (let line = 0; line < 4; line += 1) {
      lines.push(`${p1Cells.map((cell) => cell[line]).join(' ')}  |  ${p2Cells.map((cell) => cell[line]).join(' ')}`);
    }
    lines.push(`${'-'.repeat(CELL_WIDTH * 3 + 2)}  |  ${'-'.repeat(CELL_WIDTH * 3 + 2)}`);
  }
  return lines;
};

const renderReserveLine = (reserve) => {
  const parts = (reserve || []).map((tile, index) => (isAlive(tile)
    ? `[${index}] ${heroName(tile)} HP${tile.currentHealth} AR${tile.currentArmor} SP${tile.currentSpeed} EN${tile.currentEnergy}`
    : `[${index}] empty`));
  return parts.join('   ');
};

export const renderBoardSnapshot = (state, { markedKeys = new Set() } = {}) => [
  ...renderMainBoards(state, markedKeys),
  `P1 reserve: ${renderReserveLine(state.p1Reserve)}`,
  `P2 reserve: ${renderReserveLine(state.p2Reserve)}`,
].join('\n');

export const describeToken = (state, token) => {
  const raw = String(token || '');
  const [boardName, indexText] = raw.split(':');
  const index = Number(indexText);
  const side = boardName.startsWith('p1') ? 'p1' : 'p2';
  const isReserve = boardName.includes('Reserve');
  const tile = (isReserve ? state[`${side}Reserve`] : state[`${side}Main`])?.[index];
  const who = isAlive(tile) ? heroName(tile) : 'empty';
  if (isReserve) return `${side} reserve[${index}] (${who})`;
  return `${side} ${ROW_NAMES[indexToRow(index, side)]}/col${indexToColumn(index, side)} tile${indexToTileNumber(index, side)} (${who})`;
};

const describeAction = (state, action) => {
  if (!action || action.type === 'skip') return 'SKIP (no legal move)';
  if (action.type === 'noop') return 'NO-OP (stay put)';
  return `${describeToken(state, action.sourceId)}  ->  ${describeToken(state, action.destinationId)}`;
};

const tileSignature = (tile) => (isAlive(tile)
  ? `${tile.hero.id || tile.hero.name}|${tile.currentHealth}|${tile.currentArmor}|${(tile.effects || []).map(effectLabel).join(',')}`
  : (tile?._dead ? 'corpse' : 'empty'));

const sideSignature = (state, side) => JSON.stringify([
  (state[`${side}Main`] || []).map(tileSignature),
  (state[`${side}Reserve`] || []).map(tileSignature),
]);

const heroIds = (state, side) => [...(state[`${side}Main`] || []), ...(state[`${side}Reserve`] || [])]
  .filter(isAlive).map((tile) => tile.hero.id || tile.hero.name).sort().join(',');

const totalHealth = (state, side) => [...(state[`${side}Main`] || []), ...(state[`${side}Reserve`] || [])]
  .filter(isAlive).reduce((sum, tile) => sum + Number(tile.currentHealth || 0), 0);

const aliveCount = (state, side) => [...(state[`${side}Main`] || []), ...(state[`${side}Reserve`] || [])].filter(isAlive).length;

const mirrorBoard = (board) => Array.from({ length: 9 }, (_, index) => board?.[8 - index] || null);

// Mirroring check: the EasyAI controllers reason as p2, so p1 boards are index-flipped (i <-> 8-i).
// That is only valid if the flip preserves the tile number (row and column) between the two sides.
export const verifyMirrorMapping = () => {
  const problems = [];
  for (let index = 0; index < 9; index += 1) {
    const p1Tile = indexToTileNumber(index, 'p1');
    const p2Tile = indexToTileNumber(8 - index, 'p2');
    if (p1Tile !== p2Tile) problems.push(`p1 idx ${index} (tile ${p1Tile}) mirrors to p2 idx ${8 - index} (tile ${p2Tile})`);
  }
  return problems;
};

const columnExposure = (state, defenderSide) => {
  const attackerSide = defenderSide === 'p1' ? 'p2' : 'p1';
  const attackerBoard = attackerSide === 'p1' ? state.p1Main : mirrorBoard(state.p2Main);
  const damage = getOpponentColumnAttackDamage(attackerBoard);
  if (!(damage > 0)) return null;
  const board = state[`${defenderSide}Main`] || [];
  const fullColumns = [];
  for (let col = 0; col < 3; col += 1) {
    const members = board.map((tile, index) => ({ tile, index }))
      .filter(({ tile, index }) => isAlive(tile) && indexToColumn(index, defenderSide) === col);
    if (members.length >= 3) fullColumns.push(col);
  }
  return fullColumns.length ? { damage, fullColumns } : null;
};

const NOISY_LOG_PATTERNS = [
  /Auto-cast check/,
  /has casts remaining, skipping basic attack/,
  /Skipping auto-enqueue/,
  /Found \d+ pending cast/,
  /Applied deferred energy change/,
];
const isNoisyLogLine = (line) => NOISY_LOG_PATTERNS.some((pattern) => pattern.test(line));

export class MatchMonitor {
  constructor({ label = 'match', p1Label = 'P1', p2Label = 'P2' } = {}) {
    this.label = label;
    this.p1Label = p1Label;
    this.p2Label = p2Label;
    this.rounds = [];
    this.current = null;
    this.issues = [];
    this.stats = {
      moves: 0,
      noops: 0,
      skips: 0,
      fallbacks: 0,
      zeroDamageRounds: 0,
      columnStackExposures: 0,
      columnStackExposuresWhenOpponentLast: 0,
    };
    this.startState = null;
    this.mirrorProblems = verifyMirrorMapping();
    this.mirrorProblems.forEach((problem) => this.flag('MIRRORING', problem));
  }

  flag(kind, message) {
    const roundNumber = this.current?.roundNumber;
    this.issues.push({ kind, round: roundNumber ?? null, message });
    if (this.current) this.current.issues.push(`${kind}: ${message}`);
  }

  observer() {
    return { onStep: (step) => this.onStep(step) };
  }

  onStep({ stateBefore, stateAfter, mover, controller, selection, transition, battleLog }) {
    if (!this.startState) this.startState = stateBefore;
    const sequence = getMovementSequence(stateBefore.priorityPlayer);
    if (!this.current || stateBefore.movementIndex === 0) {
      this.current = {
        roundNumber: stateBefore.roundNumber,
        sequence,
        stateStart: stateBefore,
        steps: [],
        issues: [],
      };
      this.rounds.push(this.current);
    }

    const applied = applyMovementAction(stateBefore, selection.action);
    const postMove = applied.accepted ? applied.state : stateBefore;
    const opponent = mover === 'p1' ? 'p2' : 'p1';
    const isLastMover = stateBefore.movementIndex === sequence.length - 1;

    const markedKeys = new Set();
    if (selection.action?.type === 'move') {
      [selection.action.sourceId, selection.action.destinationId].forEach((token) => {
        const [boardName, indexText] = String(token).split(':');
        if (!boardName.includes('Reserve')) markedKeys.add(`${boardName}:${indexText}`);
      });
    }

    this.stats.moves += 1;
    if (selection.action?.type === 'noop') this.stats.noops += 1;
    if (selection.forcedSkip) this.stats.skips += 1;
    if (selection.fallback) {
      this.stats.fallbacks += 1;
      this.flag('FALLBACK', `${mover} (${controller.type}) chose an illegal/missing action (${selection.fallback}); first legal move was used instead.`);
    }

    // Invariants on the movement itself.
    if (!applied.accepted) this.flag('REJECTED', `${mover} action was rejected by the environment.`);
    if (sideSignature(stateBefore, opponent) !== sideSignature(postMove, opponent)) {
      this.flag('INVARIANT', `${mover}'s move changed ${opponent}'s board.`);
    }
    if (heroIds(stateBefore, mover) !== heroIds(postMove, mover)) {
      this.flag('INVARIANT', `${mover}'s move changed which heroes it owns.`);
    }
    const mainCount = (postMove[`${mover}Main`] || []).filter(isCountedMain).length;
    if (mainCount > MAIN_LIMIT) this.flag('INVARIANT', `${mover} has ${mainCount} heroes on the main board (limit ${MAIN_LIMIT}).`);

    // Column-stack exposure after the final move.
    let exposureNote = null;
    if (isLastMover) {
      ['p1', 'p2'].forEach((side) => {
        const exposure = columnExposure(postMove, side);
        if (!exposure) return;
        this.stats.columnStackExposures += 1;
        const sideIsLastMover = sequence[sequence.length - 1] === side;
        if (!sideIsLastMover) this.stats.columnStackExposuresWhenOpponentLast += 1;
        exposureNote = `${side} enters battle with full column(s) ${exposure.fullColumns.join(',')} versus a ~${exposure.damage.toFixed(1)}-damage enemy column attack.`;
      });
    }

    const step = {
      mover,
      controllerType: controller.type,
      moveNumber: stateBefore.movementIndex + 1,
      description: describeAction(stateBefore, selection.action),
      rationale: selection.rationale || null,
      fallback: selection.fallback || null,
      stateAfterMove: postMove,
      markedKeys,
      exposureNote,
    };
    this.current.steps.push(step);

    if (transition.resolvedRound) {
      const hpBefore = { p1: totalHealth(postMove, 'p1'), p2: totalHealth(postMove, 'p2') };
      const hpAfter = { p1: totalHealth(stateAfter, 'p1'), p2: totalHealth(stateAfter, 'p2') };
      const aliveBefore = { p1: aliveCount(postMove, 'p1'), p2: aliveCount(postMove, 'p2') };
      const aliveAfter = { p1: aliveCount(stateAfter, 'p1'), p2: aliveCount(stateAfter, 'p2') };
      if (hpBefore.p1 === hpAfter.p1 && hpBefore.p2 === hpAfter.p2 && aliveBefore.p1 === aliveAfter.p1 && aliveBefore.p2 === aliveAfter.p2) {
        this.stats.zeroDamageRounds += 1;
        this.flag('STALL', 'Round resolved with no change in total health or hero count.');
      }
      this.current.battle = {
        stateBeforeBattle: postMove,
        stateAfter,
        battleLog,
        hpBefore,
        hpAfter,
        aliveBefore,
        aliveAfter,
      };
      this.current = null;
    }
  }

  finish(result) {
    this.result = result;
  }

  renderReport() {
    const out = [];
    const rule = '='.repeat(100);
    out.push(rule);
    out.push(`MATCH: ${this.label}`);
    out.push(`P1 = ${this.p1Label}    P2 = ${this.p2Label}`);
    if (this.result) {
      out.push(`Result: ${this.result.outcome} after ${this.result.resolvedRounds} resolved round(s)`
        + `${this.result.completed ? '' : ' (UNFINISHED - hit round cap)'}`);
    }
    out.push(`Moves: ${this.stats.moves}  No-ops: ${this.stats.noops}  Fallbacks: ${this.stats.fallbacks}  `
      + `Stall rounds: ${this.stats.zeroDamageRounds}  Full-column exposures: ${this.stats.columnStackExposures}`
      + ` (${this.stats.columnStackExposuresWhenOpponentLast} with opponent having last move)`);
    out.push(`Mirror mapping check: ${this.mirrorProblems.length ? 'FAILED' : 'ok (p1 idx i <-> p2 idx 8-i preserves tile number)'}`);
    out.push(`Issues flagged: ${this.issues.length}`);
    this.issues.slice(0, 25).forEach((issue) => out.push(`  - [round ${issue.round ?? '-'}] ${issue.kind}: ${issue.message}`));
    out.push('');
    out.push('LEGEND: HP=health AR=armor SP=speed EN=energy, ">Spell" = spell for the hero\'s current row, [..] = effects,');
    out.push('        "*" = tile touched by the move. Each text line group is one column lane; P1 col c is attacked by');
    out.push('        enemy column attacks through P2 col 2-c. (Layout is an approximation of the in-game UI.)');
    out.push(rule);

    this.rounds.forEach((round) => {
      out.push('');
      out.push(`#### ROUND ${round.roundNumber}   move order: ${round.sequence.join(' -> ')}   (last mover: ${round.sequence[round.sequence.length - 1]})`);
      out.push('');
      out.push('--- Board at start of round (before movement) ---');
      out.push(renderBoardSnapshot(round.stateStart));
      round.steps.forEach((step) => {
        out.push('');
        out.push(`--- Move ${step.moveNumber}/${round.sequence.length}: ${step.mover} [${step.controllerType}] ${step.description}${step.fallback ? `   !! FALLBACK ${step.fallback}` : ''}`);
        if (step.rationale?.length) {
          step.rationale.forEach((entry, rank) => {
            out.push(`      candidate #${rank + 1}: ${entry.sourceId} -> ${entry.destinationId}   ${entry.detail}`);
          });
        }
        out.push(renderBoardSnapshot(step.stateAfterMove, { markedKeys: step.markedKeys }));
        if (step.exposureNote) out.push(`   !! COLUMN EXPOSURE: ${step.exposureNote}`);
      });
      if (round.battle) {
        const { battle } = round;
        out.push('');
        out.push('--- Battle log (engine debug noise filtered; p1Board[i]/p2Board[i] use raw array indices) ---');
        const filtered = battle.battleLog.filter((line) => !isNoisyLogLine(line));
        const lines = filtered.length ? filtered : ['(no log lines captured)'];
        lines.slice(0, MAX_BATTLE_LOG_LINES).forEach((line) => out.push(`   ${line}`));
        if (lines.length > MAX_BATTLE_LOG_LINES) out.push(`   ... ${lines.length - MAX_BATTLE_LOG_LINES} more line(s) omitted`);
        out.push('');
        out.push('--- Board after round ---');
        out.push(renderBoardSnapshot(battle.stateAfter));
        out.push(`   Total HP  p1: ${battle.hpBefore.p1} -> ${battle.hpAfter.p1}   p2: ${battle.hpBefore.p2} -> ${battle.hpAfter.p2}`
          + `   |  Heroes alive  p1: ${battle.aliveBefore.p1} -> ${battle.aliveAfter.p1}   p2: ${battle.aliveBefore.p2} -> ${battle.aliveAfter.p2}`);
      }
      round.issues.forEach((issue) => out.push(`   !! ${issue}`));
      out.push('-'.repeat(100));
    });
    return out.join('\n');
  }

  summary() {
    return {
      label: this.label,
      outcome: this.result?.outcome || 'unknown',
      completed: !!this.result?.completed,
      resolvedRounds: this.result?.resolvedRounds ?? this.rounds.length,
      ...this.stats,
      issueCount: this.issues.length,
      issues: this.issues,
    };
  }
}
