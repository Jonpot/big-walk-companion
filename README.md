# Big Walk Companion

A second-monitor map for speedrun routing: editable POIs and routes, ordered objectives, live players and trains, recorded paths, and puzzle notes that open when you enter an area.

## Install on Windows

Download the ZIP from [Releases](https://github.com/Jonpot/big-walk-companion/releases/latest), extract it, close Big Walk, and double-click **Install.cmd**. Choose the normal game-folder installation or a mod-manager profile. A normal install sets up BepInEx and opens the game; a profile install adds the companion to that profile and asks you to launch modded through your manager. Node.js and the loader are included; no SDK is needed. Launchers prefer PowerShell 7 and fall back to Windows PowerShell.

Join a world and allow several minutes for the first modded launch. The calibrated map is included in the mod and companion package. It works before finishing the starting area or opening the in-game map. The crashing Unity texture-to-PNG export path has been removed. Existing custom map files are preserved.

For later sessions, **just launch the game**: the mod starts the companion in the background and opens its browser page. **Start Companion.cmd** opens it manually, and **Stop Companion.cmd** stops it. The server remains available after the game exits for reviewing runs. Keep the extracted companion folder in place; rerun Install if you move it. Set `[Companion] AutoStart = false` in the plugin configuration to opt out. Existing BepInEx settings are preserved and replaced companion DLLs are backed up. See [START HERE](scripts/distribution/START%20HERE.txt) for troubleshooting and removal.

## Plan, share, and run (v0.2.0)

The **Route planner** panel is on the right. Use **+ POI** then click the map, give the pin a name/category/color and notes, choose its Lucide icon from the searchable grid, and choose **Save plan**. Click a saved pin or its list entry to edit it; **Move pin on map** places it somewhere else.

Choose **Draw route**, click each point of your path, then **Finish path**. Name it, choose a color, and add ordered steps with optional POI links and instructions. **Adjust path on map** lets you drag vertices, click a segment to insert, click empty map to extend, or right-click a vertex to remove it. Undo/redo applies to draft edits; save commits them. Unsaved drafts have browser-local recovery on reload.

Search names and notes, filter POI categories, and toggle POI/route layers. The locate button centers any result. Routes show a white start point, a colored end point, and approximate horizontal length when calibrated; they do not imply that terrain is traversable.

**Export pack** downloads the saved POIs, paths, steps, area notes, images, and calibration as JSON. Send that file to a teammate. **Import pack** previews its contents; **Add to my pack** imports independent copies and keeps your alignment, while **Replace my pack** replaces the plan and alignment. New pack version 2 supports old version 1 imports; older app versions cannot open new packs. A successful save keeps the previous on-disk state in `data/route-pack.previous.json`.

Choose **Run** beside a route (or switch Plan to Run). Follow the next-objective card, locate linked POIs, and tick off steps. The manual real-time timer supports start/pause/resume/reset; it and the checklist persist in this browser, separately from shared plans. It is not an autosplitter or an official game-time timer.

This release includes the existing v0.1.3 game plugin unchanged; the new features run in the companion. Starting the updated package replaces an older matching companion server automatically. Refresh an already-open companion page to load the new tools.

## Existing map and notes tools

- Select a player to follow their area notes; use Rename to label players.
- Draw rectangular areas, then move or resize them with the bounds editor.
- Write Markdown notes with preview, formatting, pasted/uploaded images, image alignment and sizing, and draggable blocks.
- Area notes open full-window on entry, can be minimized, and dismiss on exit.
- Settings contains alignment, trail visibility, and a fading history slider (10–300 seconds).
- Select recorded sessions to replay paths. Red, green, and yellow trains are tracked independently.
- Sharing uses exported files. Online share links and live team editing are not implemented.

Plans and notes live in `data/route-pack.json` in the configured notes directory. Reinstalling retains that directory from the previous registration. Keep it when updating, or export a backup before replacing a release. Recordings live in the game's `BepInEx/companion` folder and are not automatically deleted.

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
pwsh -File ./scripts/test-bundled-map.ps1
pwsh -File ./scripts/test-mod-launcher.ps1
node companion/server.mjs
```

Set `BIGWALK_PATH` to use another game directory and `COMPANION_DATA_DIR` to use another notes directory. `COMPANION_TELEMETRY_DIR` overrides the default game's `BepInEx/companion` directory for managed profiles. `PORT` defaults to 4317. Browser dependencies are bundled; the running server needs no npm install.

To package a release, place the original build 788 loader ZIP from [BepInEx builds](https://builds.bepinex.dev/projects/bepinex_be) in `.local/downloads/`, then run `./scripts/package-release.ps1`. The script verifies its checksum and packages the compiled reader, Node runtime, loader, map, clean calibration, and third-party notices. Verify the output with `node scripts/test-package.mjs releases/BigWalk-Companion-v0.2.0-win-x64`.

Game updates may require rebuilding the reader against regenerated interop assemblies. This is an unofficial companion, not affiliated with Big Walk's developers.


Full-screen area notes keep a zoomed-in minimap in the bottom-left corner. It follows the selected player and shows nearby authored routes, POIs, other players, and trains. During replay it follows the recorded position; if telemetry is stale it labels the last known position.

The icon picker includes all 1,848 canonical icons from Lucide 1.47.0, bundled locally. Search icon names or use **Show more icons** to browse the full grid. Icon choices survive save, reload, and pack sharing. Run `npm run build` to regenerate the catalog when updating the pinned Lucide dependency.
