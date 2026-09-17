## Crash mitigation and installer improvements

This release disables automatic map export by default after a reported fatal stack overflow in Unity's PNG encoding path, called by the companion's map exporter. It avoids that call; the underlying encoding failure is not yet resolved, and the affected user's in-game retest is still needed.

**Map limitation:** existing exported `BepInEx/companion/map.png` files continue to work. A fresh installation without a map image will have no background map. Game artwork is not bundled. Keep experimental map export disabled.

### Changes

- Launchers prefer PowerShell 7 (`pwsh.exe`) and fall back to Windows PowerShell, including when the executable is missing from PATH.
- The installer supports normal game-folder installs and explicitly selected mod-manager profiles. It remembers the selected profile for map, live tracking, and recordings, and directs managed users to launch modded through their manager.
- Partial installations matching the bundled loader can be completed without replacing existing files. Conflicting loaders remain untouched, with clearer folder and recovery information.
- **Collect Diagnostics.cmd** creates a local ZIP of available Unity/BepInEx/error logs, recent game logs, plugin inventory, and the latest position snapshot. Crash dumps are opt-in; nothing is uploaded automatically.
- Plugin version is reported as 0.1.1 in telemetry and loader logs.
- Source includes the 25-item speedrunning roadmap and calibration/diagnostic tools and notes. The roadmap describes proposed features, not newly implemented route-planning capabilities.

### Install or update

Download **BigWalk-Companion-v0.1.1-win-x64.zip**, extract it, close Big Walk, and run **Install.cmd**. Choose the game-folder installation or your active mod-manager profile. Managed users must launch the game through their manager.

Preserve the previous companion's `data` folder or export your notes before updating. Keep any existing exported map image. The installer backs up replaced companion DLLs and preserves recognized existing loader configuration.

### Validation

- 16 app tests pass, including managed-profile telemetry and recording access.
- Plugin compilation succeeds without warnings or errors.
- Isolated installation/diagnostics checks pass under PowerShell 7 and Windows PowerShell 5.1.
- Launcher checks verify PowerShell preference, fallback, quoted paths, and exit codes.
- The actual bundled loader extracts successfully into an isolated test folder.
- Package checks verify the manifest hashes, bundled runtime startup, clean starter data, UI assets, and note-image persistence.

No successful in-game retest on the affected machine is claimed.
