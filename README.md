# Big Walk Companion

A second-monitor map for speedrun routing: live players and trains, recorded paths, and puzzle notes that open when you enter an area.

## Install on Windows

Download the ZIP from [Releases](https://github.com/Jonpot/big-walk-companion/releases/latest), extract it, close Big Walk, and double-click **Install.cmd**. Choose the normal game-folder installation or a mod-manager profile. A normal install sets up BepInEx and opens the game; a profile install adds the companion to that profile and asks you to launch modded through your manager. Node.js and the loader are included; no SDK is needed. Launchers prefer PowerShell 7 and fall back to Windows PowerShell.

Keep the companion's command window open. Join a world and allow several minutes for the first modded launch. **Automatic map export is disabled in v0.1.1** after a fatal stack overflow was reported in Unity PNG encoding. Existing exported maps still work; preserve `BepInEx/companion/map.png` when updating. Fresh installs without a map image can track positions but will have no background map. Game artwork is not included in this repository or download.

For later sessions, launch the game normally and use **Start Companion.cmd**. Existing BepInEx settings are preserved and replaced companion DLLs are backed up. Conflicting loaders are left untouched. See [START HERE](scripts/distribution/START%20HERE.txt) for troubleshooting and removal.

## Use

- Select a player to follow their area notes; use Rename to label players.
- Draw rectangular areas, then move or resize them with the bounds editor.
- Write Markdown notes with preview, formatting, pasted/uploaded images, image alignment and sizing, and draggable blocks.
- Area notes open full-window on entry, can be minimized, and dismiss on exit.
- Settings contains alignment, trail visibility, and a fading history slider (10–300 seconds).
- Select recorded sessions to replay paths. Red, green, and yellow trains are tracked independently.
- Export/Import shares areas, calibration, notes, and embedded images. Live note synchronization is not included.

Notes live in the extracted folder's `data/route-pack.json`. Keep that folder when updating, or export a backup before replacing a release. Recordings live in the game's `BepInEx/companion` folder and are not automatically deleted.

The server listens on localhost only. Each player needs the plugin for their own companion. The plugin reads game state without adding custom multiplayer messages. A nearby unmodded player has been observed from the host; distant players and running as a client need further testing.

After a crash, run **Collect Diagnostics.cmd** before relaunching. It bundles existing Unity/BepInEx logs, plugin inventory, and the latest telemetry snapshot locally under `diagnostics/`; nothing is uploaded. The selected mod-manager profile is supported. Crash dumps are optional (`-IncludeCrashDumps`), and missing files are reported. See [START HERE](scripts/distribution/START%20HERE.txt) for manual log locations and sharing details.

## Development

Requires Node.js 22 and a .NET 6 SDK, plus your own Big Walk installation with BepInEx 6 IL2CPP x64. The tested loader is `6.0.0-be.788+5b766a3`; launch it once to generate interop assemblies.

```powershell
cd companion
npm ci
npm test
npm run build
cd ..
./scripts/build-mod.ps1 -GamePath 'C:\Program Files (x86)\Steam\steamapps\common\Big Walk'
./scripts/test-distribution.ps1
node companion/server.mjs
```

Set `BIGWALK_PATH` to use another game directory and `COMPANION_DATA_DIR` to use another notes directory. `COMPANION_TELEMETRY_DIR` overrides the default game's `BepInEx/companion` directory for managed profiles. `PORT` defaults to 4317. Browser dependencies are bundled; the running server needs no npm install.

To package a release, place the original build 788 loader ZIP from [BepInEx builds](https://builds.bepinex.dev/projects/bepinex_be) in `.local/downloads/`, then run `./scripts/package-release.ps1`. The script verifies its checksum and packages the compiled reader, Node runtime, loader, clean calibration, and third-party notices. Verify the output with `node scripts/test-package.mjs releases/BigWalk-Companion-v0.1.1-win-x64`.

Game updates may require rebuilding the reader against regenerated interop assemblies. This is an unofficial companion, not affiliated with Big Walk's developers.

