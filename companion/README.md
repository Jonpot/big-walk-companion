# Companion web app

See the [project README](../README.md) for installation and features.

Run `npm ci`, `npm run build`, and `npm test` here to rebuild and verify the browser dependencies. Start with `node server.mjs`; the server uses localhost port 4317. `BIGWALK_PATH`, `COMPANION_DATA_DIR`, and `PORT` override local defaults.

The plugin exports `BepInEx/companion/map.png` from the installed game's `PaperMapSaved` texture. The server also accepts a manually extracted `data/map-candidates/PaperMapSaved-270.png`. Calibration is included in `default-route.json` without artwork or user notes.

Markdown supports embedded PNG/JPEG/WebP/GIF images up to 5 MB and 30 megapixels per image, with a 28 MB encoded-image budget per route pack. HTML is sanitized and remote image loading is disabled. Ctrl+B/Ctrl+I format selected text; Ctrl+S saves. Area bounds are two-dimensional and do not distinguish floors.

Notes persist in `data/route-pack.json`. Concurrent writes from different tabs are rejected to avoid silent loss. Trail history preferences and player aliases persist per browser; aliases apply to a recorded session. Recordings are read from the game directory, with a 100 MB per-recording replay limit.
