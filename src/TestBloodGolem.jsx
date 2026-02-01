import React, { useMemo } from "react";
import BattlePhase from "./BattlePhase";
import { HEROES } from "./heroes.js";
import { makeEmptyMain, makeReserve } from "../shared/gameLogic.js";

export default function TestBloodGolem() {
  // Build boards for testing Blood Golem mechanics:
  // P1: Blood Golem + Cleric (to create dead ally corpse)
  // P2: Fire Mage (to damage heroes and test Soul Link)
  
  const { p1Main, p1Reserve, p2Main, p2Reserve } = useMemo(() => {
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const p1Main = makeEmptyMain('p1');
    const p2Main = makeEmptyMain('p2');
    const p1Reserve = makeReserve('p1');
    const p2Reserve = makeReserve('p2');

    const bloodGolem = HEROES.find(h => h.id === 'bloodGolemID');
    const cleric = HEROES.find(h => h.id === 'clericID');
    const fireMage = HEROES.find(h => h.id === 'fireMageID');

    // P1 Blood Golem at position 4 (middle center)
    if (bloodGolem) {
      const bg = clone(bloodGolem);
      bg.currentHealth = bloodGolem.health;
      bg.currentEnergy = 10; // Give extra energy to test spells
      bg.currentSpeed = bloodGolem.speed;
      bg.currentArmor = bloodGolem.armor;
      bg.currentSpellPower = bloodGolem.spellPower || 0;
      
      p1Main[4] = { hero: bg, boardName: 'p1Board', index: 4 };
    }

    // P1 Cleric at position 1 (middle left) - will be damaged to low health for Blood Drain test
    if (cleric) {
      const cl = clone(cleric);
      cl.currentHealth = 3; // Low health to test Blood Drain conditional
      cl.currentEnergy = cleric.energy;
      cl.currentSpeed = cleric.speed;
      cl.currentArmor = cleric.armor;
      cl.currentSpellPower = cleric.spellPower || 0;
      
      p1Main[1] = { hero: cl, boardName: 'p1Board', index: 1 };
    }

    // P1 Another Cleric at position 7 (middle right) - adjacent to Blood Golem for Soul Link test
    if (cleric) {
      const cl2 = clone(cleric);
      cl2.currentHealth = cleric.health;
      cl2.currentEnergy = cleric.energy;
      cl2.currentSpeed = cleric.speed;
      cl2.currentArmor = cleric.armor;
      cl2.currentSpellPower = cleric.spellPower || 0;
      
      p1Main[7] = { hero: cl2, boardName: 'p1Board', index: 7 };
    }

    // P2 Fire Mage at position 4 (high health enemy for Blood Drain test)
    if (fireMage) {
      const fm = clone(fireMage);
      fm.currentHealth = fireMage.health;
      fm.currentEnergy = 10;
      fm.currentSpeed = fireMage.speed;
      fm.currentArmor = fireMage.armor;
      fm.currentSpellPower = fireMage.spellPower || 0;
      
      p2Main[4] = { hero: fm, boardName: 'p2Board', index: 4 };
    }

    return { p1Main, p1Reserve, p2Main, p2Reserve };
  }, []);

  const [gameState, setGameState] = useState({
    p1Main,
    p2Main,
    p1Reserve,
    p2Reserve,
    phase: 'battle',
    priorityPlayer: 'player1',
  });

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px', background: '#1a1a1a', color: '#fff' }}>
        <h2>Blood Golem Test Battle</h2>
        <p>Testing Blood Golem mechanics:</p>
        <ul>
          <li><strong>Blood Drain:</strong> Conditional damage/heal based on caster vs target health</li>
          <li><strong>Soul Link:</strong> Blood Golem absorbs half damage from adjacent allies</li>
          <li><strong>Consume Corpse:</strong> Removes dead allies and heals Blood Golem</li>
        </ul>
        <p>Instructions:</p>
        <ol>
          <li>Click "Start Round" to begin</li>
          <li>Blood Golem will cast spells based on energy and position</li>
          <li>Use Soul Link (middle spell) to protect adjacent ally</li>
          <li>Use Blood Drain (front spell) to test conditional damage</li>
          <li>Create a corpse, then use Consume Corpse (back spell) to remove it</li>
        </ol>
      </div>
      <BattlePhase
        gameState={gameState}
        setGameState={setGameState}
        socket={null}
        playerNames={{ p1: 'Player 1 (Blood Golem)', p2: 'Player 2 (Test Dummy)' }}
        localSide="p1"
        aiDifficulty={null}
        allowLocalControl={true}
      />
    </div>
  );
}
