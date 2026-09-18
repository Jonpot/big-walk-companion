# Big Walk Companion v0.2.0 — Route planning

POI pins and route drawing are now implemented in the companion. Open the **Route planner** panel on the right:

- **+ POI**: click the map; add a name, category, color, notes, and a Lucide icon from a searchable grid of all 1,848 bundled icons. Edit, reposition, locate, or delete saved pins.
- **Draw route**: click out a path and choose **Finish path**. Name/color it, add instructions, and create ordered steps linked to POIs.
- **Adjust path on map**: drag vertices, click a segment to insert a point, click empty map to extend, or right-click a vertex to remove. Draft edits support undo/redo, cancel, and browser-local recovery.
- Search names/notes, filter POI categories, toggle POI/route layers, and locate results.
- **Export pack / Import pack**: share pins, paths, linked steps, area notes, images, and calibration. Import previews counts and offers add-as-copies (keeps local alignment) or replace. Each save retains the previous on-disk pack.
- **Run**: next-objective card, linked POI location, ordered checklist, and manual real-time timer with pause/resume/reset. Attempt state persists locally in the browser.
- Connection status distinguishes waiting, connected, paused telemetry, disconnected server, and replay.

Existing notes and area-only packs migrate to the new format. New packs require v0.2.0 or newer. This is file-based sharing; online collaboration, autosplitting, and ghosts are not included.

Download and extract the complete Windows ZIP. Close the game and run **Install.cmd** to register the new package, then launch normally. Starting this package replaces an older matching companion background server; refresh any already-open companion page to load the new interface. Keep your existing notes directory.

The game plugin remains v0.1.3 unchanged: bundled map, crash fix, and automatic companion startup are retained. No new Unity texture calls or game hooks were added.

Validation: automated schema/migration/merge, geometry, planner interaction, persistence/backup, launcher upgrade, and existing app tests; browser checks for POI creation, route drawing, linked steps, and Run mode; complete package hash, bundled runtime, map, and saved-planning-data checks.

Full-screen area notes keep a zoomed-in minimap in the bottom-left corner. It follows the selected player and shows nearby authored routes, POIs, other players, and trains. During replay it follows the recorded position; if telemetry is stale it labels the last known position.

The Lucide catalog is bundled offline (version 1.47.0); no CDN connection is required. Icons appear on the main map, in the POI list, and on the notes minimap, and are preserved by exports/imports.
