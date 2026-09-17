# Companion map

`map.png` is the 4096 by 4096 `PaperMapSaved` texture from Big Walk. The game artwork is by House House. It is the unchanged image used to derive `companion/default-route.json` calibration.

The plugin embeds this PNG as `BigWalk.Companion.Map.png` and copies it to its output directory when no map exists. The Windows package also includes the PNG beside the web server so the map works before launching the game or progressing through the starting area.

Do not crop, rotate, or resize this image without reviewing its coordinate calibration. No player paths, annotations, or save data are baked into it.
