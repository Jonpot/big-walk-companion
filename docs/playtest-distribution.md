# Private Windows playtest package

Run `scripts/package-playtest.ps1` from the project. It builds the mod without
installing it, stages a self-contained folder under `releases/`, and produces
a zip, SHA-256 checksum, and per-file manifest. The staged app is copied at
packaging time, so run after completing companion changes.

Inputs: installed game's interop assemblies for compilation; the original
verified `.local/downloads/BepInEx-Unity.IL2CPP-win-x64-6.0.0-be.788.zip`; Node.js
on PATH (override with `-NodePath`); bundled `assets/map.png` and current route calibration.
Runtime license notices are downloaded from the official source repositories
if not cached. No SDK is required on the recipient's machine.

Only calibration is included from `data/`; the map comes from `assets/map.png`. Areas, notes, images,
recordings, player identifiers, paths to Jon's game, diagnostics, and Harry's
source archive are excluded. Areas start empty. As of v0.1.2, the calibrated
map is included in both the public release and private playtest packages.

The installer discovers Steam library paths, falls back to a folder prompt,
and stores the chosen path beside the launcher. It checks that the game is
closed. It refuses to replace a conflicting loader and preserves an existing
BepInEx IL2CPP loader/configuration. Companion DLL replacements are backed up
outside the plugins directory so BepInEx cannot load the backup accidentally.

Run `scripts/test-distribution.ps1` for isolated installer fixtures. It tests
fresh installation, loader/config preservation, plugin backup and conflict
rejection, without touching the installed game. After packaging, smoke-test
the staged app with `node scripts/test-package.mjs releases/<staging-folder>`.
This verifies every manifest hash, starts the bundled Node runtime on port 4320,
checks app assets and the empty calibrated starter pack, verifies image persistence
using a temporary data folder, and stops the server.

The current reader does not send custom network messages or change game state.
An unmodded friend is expected to be able to join for initial validation;
mixed-client compatibility, remote-player freshness at distance, and telemetry
on a non-host client still need a two-player runtime test. Each person needs
the reader for their own local companion. There is no internet lobby or live
note synchronization; use route-pack export/import.
