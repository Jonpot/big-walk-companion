## Map included; no starting-area progress required

The calibrated map image is now embedded in the mod and included in the companion package. Fresh installs can display the map immediately, even before launching Big Walk. Finishing the starting area, opening the in-game map, and having a progressed save are not required.

The Unity texture-to-PNG exporter that triggered the reported stack overflow has been removed, including its experimental toggle and image-conversion dependency. The plugin now copies an already encoded embedded PNG using ordinary file operations. Existing map files are preserved.

### Install or update

Download **BigWalk-Companion-v0.1.2-win-x64.zip**, extract the full package, close Big Walk, and run **Install.cmd**. Mod-manager users should select their active profile and launch modded through the manager.

Keep the previous companion's `data` folder or export notes before updating. This version includes the PowerShell 7 support, profile-aware installer, and diagnostics collector from v0.1.1. Map artwork is by House House.

### Validation

- Plugin builds without warnings or errors.
- The actual compiled plugin writes the exact calibrated 4096 by 4096 PNG in a test without loading Unity or any save. Existing maps remain untouched, and write failures preserve existing data.
- Package checks verify the full map is served with a nonexistent game directory, empty notes, and no telemetry or recordings.
- App, installer, launcher, and package checksum checks pass.

The new package has not yet been tested in-game on Harry's machine.
