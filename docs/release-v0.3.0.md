# Big Walk Companion v0.3.0 — Hands-free routes

Choose Run beside a saved route, select your player, then press Start timer.

- Arrive within the configurable POI radius (12 world units by default) for half a second to register arrival. Instructions stay active until you leave a wider radius (18 units by default), preventing boundary jitter and premature instruction changes.
- Completed steps disappear and the next checkpoint advances automatically. The real-time timer stops after departing the final checkpoint.
- The map follows your player. A direction arrow points toward the current target, and the relevant section of the drawn route pulses on the map and notes minimap.
- Current route instructions and timer remain above full-screen area notes. Long step instructions page automatically every 15 seconds.
- Stale telemetry and replay cannot complete checkpoints. Changing game sessions pauses the attempt. Progress is stored separately from saved routes and notes.

This tracks proximity, not puzzle completion or official game time. Routes need steps linked to POIs for automatic progression.

Download and extract the full Windows ZIP. Close the game and run Install.cmd, keeping your existing notes directory. Refresh an already-open companion page after saving any edits. The game plugin remains v0.1.3; bundled map and automatic companion startup are unchanged.

Validation includes automatic progression and UI integration tests, both existing saved routes exercised against simulated positions without changing their data, browser checks with full-screen notes, and Windows package integrity/runtime checks.
