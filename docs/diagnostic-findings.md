# Movement and train validation — 2026-09-15

Source: local recording `session-8681c41f5e86460d9b6ff68648c5f0ae.jsonl`, plugin 0.1.2. User reported the green train passed directly overhead during this session.

- 255 player-active snapshots spanning 53.236 seconds.
- Player root and `kernal` positions match exactly throughout this sample.
- Harry's `cachedKernalPos` differs by at most 0.1793 world units, consistent with timing differences, though the cause has not been independently proven.
- One non-cable `NetworkedTrain` contains 15 cars: A (indices 0–4), B (5–9), C (10–14). A separate networked object contains the chairlift cars.
- The train container and car container transforms remain at zero. Moving train markers must use the cars' `mainBody.position`, not those containers.
- All 15 main-body positions changed in every one of the 255 active snapshots. Each car traveled approximately 115.8 world units. This verifies updates for the observed session, including distant trains; other client/host configurations remain untested.
- B's first car came within 0.812 world units horizontally and 16.376 above the local player at 39.650 seconds after the first active sample. A remained at least 408.86 units away horizontally, and C at least 714.52. Together with the user's observation, this identifies B as green.
- A and C are the remaining red/yellow candidates; do not guess which is which.
- No map-camera candidate file was generated. The runtime inspection did not find a usable `PaperMapCamera`; world-to-image calibration remains unresolved.

Plugin 0.1.3 adds three normalized `trainMarkers` for the verified train hierarchy and 15-car layout. Green is labeled; A and C are explicitly unverified. Each marker uses the first car's physical body position. Raw diagnostics remain available. Unexpected hierarchy/layout produces no normalized markers rather than misleading labels.

Analysis can be repeated with `node scripts/analyze-recording.mjs`. Units above are Unity world units, not independently calibrated meters.
