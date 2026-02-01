import React, { useState } from 'react';
import { useMovement } from './movement';

export default function BattlePhase() {
  const [logs, setLogs] = useState([]);
  const movement = useMovement({
    onSwap: (a, b) => setLogs(l => [...l, `Swapped ${a} <-> ${b}`]),
  });

  return (
    <div>
      <h2>Battle Phase (fixed)</h2>
      <div>{movement.UI}</div>
      <div>
        <button onClick={() => setLogs([])}>Clear Logs</button>
      </div>
      <div>
        {logs.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
