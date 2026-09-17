# Harry's position logger

Reviewed the source from `from_harry/u743st6m9dlg7s7y.zip`, which contains a nested `BigWalkMod0.zip`. Selected source and notes were extracted to `.local/harry-source`; supplied binaries were not installed or executed.

## What the code establishes

- `Plugin.Load()` installs a Harmony postfix on `PlayerMover.Update`.
- The postfix reads `PlayerMover.cachedKernalPos` and logs X/Y/Z.
- Logging occurs every 60 calls to the patched method, using one static counter shared by all instances. This is not a fixed time interval or a guaranteed per-player interval.
- The source does not label player identity or filter local versus remote players. The screenshot alone does not establish multiplayer coverage.
- Its actual project targets `net6.0`, consistent with our installed loader. The tentative `netstandard2.1` instructions in the notes do not match the supplied project.

## Integration decision

Keep our time-based sampler and structured, identified player snapshots. Build 0.1.1 adds `kernalPosition` and `moverPosition` alongside the existing root X/Y/Z, without changing the current coordinate source. The latter reads the exact property used by Harry. Compare the three readings during movement before choosing the production coordinate source, especially for distant remote players.

Do not assume `PlayerCharacter.transform.position` is the movement position: Harry's evidence points to the need to verify this. Likewise, do not assume a cached movement position stays fresh for remote characters.

Our installed 0.1.0 plugin was observed loading successfully and writing empty snapshots while no player characters were present. A runtime player sample is still needed.
