# Multiplayer Scaling Plan

## Selected Model

Each online match has exactly one authoritative owner: the server process that creates it. That process owns its `activeMatches`, `matchStates`, execution queues, and timers until the match ends.

This matches the current server design. Matchmaking only groups sockets already connected to the same process, so every player in a newly created match is connected to the owner. Redis is used for Socket.IO coordination, not as a live mutable battle-state store.

## Why This Is Safe

- A match never has two processes applying moves or advancing timers.
- Round execution stays ordered by the existing acknowledgement queue.
- A process restart or a player reconnect remains a disconnect outcome, which is the current game rule.
- Redis adapter broadcasts work across Machines without granting another Machine authority over a match.

## Current Redis Setup

`REDIS_URL` enables the Socket.IO Redis adapter at startup. The health endpoint reports the connection state:

```text
GET /health
```

The response includes `redisAdapterReady` and `matchOwnership: "single-process-owner"`. A deployment with `REDIS_URL` configured fails at startup when Redis cannot be reached.

## Scaling Rules

1. Keep `min_machines_running = 1` until the deployed health endpoint reports `redisAdapterReady: true`.
2. Socket.IO is WebSocket-only. This avoids load-balancer affinity requirements for the polling transport.
3. Increase Fly to two Machines first. Match queues are intentionally local to each Machine, so each match remains process-owned.
4. Watch queue wait time, memory, CPU, disconnect rate, and match completion logs before adding more Machines.
5. Do not move `matchStates`, `matchExecutionState`, league timers, or live betting simulations into Redis as independent fields. That would create multi-writer races.

## Current Limitation

The betting-mode public-lobby directory is process-local. Do not scale that mode across Machines until its lobby browser, lobby membership, and timers are placed behind a separate owner-routing layer. Standard classic, FFA3, and League4 matches are safe under the selected per-Machine ownership model because all players in each created match are local to its owner.

## Later Improvement

If queue fragmentation becomes noticeable, add a Redis-backed matchmaker that selects one owner Machine and asks it to admit the selected players. Keep that owner as the only writer; do not distribute one match across multiple server processes.