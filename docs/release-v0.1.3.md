## Companion opens automatically with the game

After installation, launching Big Walk starts the companion in the background and opens its map in your default browser. No separate command window needs to stay open. Mod-manager profiles are supported.

- The installer registers the companion folder with the plugin. If that folder is moved, rerun Install.cmd to update the registration.
- Concurrent launch requests reuse one matching server and suppress duplicate browser opens. A server using another notes folder or profile is not silently reused.
- Startup runs off the game thread; failures are logged without stopping the game. Diagnostics now include launcher/server logs.
- **Start Companion.cmd** opens the app manually; **Stop Companion.cmd** stops the background server. The server remains available after quitting the game for reviewing runs.
- Set `AutoStart = false` under `[Companion]` in `BepInEx/config/com.jonpot.bigwalk.companion.cfg` to disable automatic startup.
- Includes the calibrated map and retains the removal of the crashing Unity PNG exporter from v0.1.2.

### Update

Close Big Walk, extract **BigWalk-Companion-v0.1.3-win-x64.zip**, preserve your existing `data` folder/notes, and run **Install.cmd**. Select your normal game installation or active mod-manager profile. Keep the extracted companion folder in place.

### Validation

App tests cover concurrent startup, server reuse, conflicting profiles/services, browser-open deduplication, browser error recovery, and shutdown. The compiled plugin launcher is tested with spaced/bracketed paths and missing/moved-package errors. Plugin compilation, installer fixtures, embedded-map tests, and package checks pass. Actual in-game launch is still a separate runtime check.
