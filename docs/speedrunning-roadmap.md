# Big Walk Companion: 25 improvements

Reviewed September 16, 2026. This is a proposed product roadmap, not a record of implemented features. Based on the current browser app, route validation, local server, telemetry plugin, and calibration documentation; no live gameplay usability session was performed.

The product goal: a route planner can capture and explain a strategy, share it with a teammate, and let that teammate execute and improve it without repeatedly leaving the game.

## Delivery status — September 17, v0.2.0

Implemented: POI placement/editing with categories, color and notes; click-to-place routes with draggable/insertable/removable vertices; ordered POI-linked steps; POI/route search and layers; complete merge-or-replace pack sharing; Plan/Run modes; next-objective card and checklist; manual persistent timer; draft undo/redo/recovery; connection status. See README for actual controls and scope.

Still future work: freehand paths, elevation, branches, route version libraries, online sharing/live collaboration, automatic splits, ghosts, replay redesign and segment analysis. The numbered items below describe the original broader targets; they are not a claim that every acceptance criterion has shipped.

## Original baseline before v0.2.0

The app already provides live players and trains, fading trails, recording playback, rectangular areas, rich Markdown notes with images, editable bounds, player aliases, and JSON import/export. Build on these rather than replace them.

The original route format contained areas, notes, images, and calibration, but no POIs, route paths, or ordered objectives. Import replaces the active pack. The server listens only on localhost; export/import is file sharing, not live team synchronization. Full-window notes are the default on area entry. Replay reads an entire recording into memory, rejects files above 100 MB, and rebuilds trail history from the beginning on seek. Player-landmark map accuracy remains unverified in the calibration documentation.

## Plan and share

1. **Place useful POI pins.** Click the map or use the selected player's current position to create a named pin. Add an icon, tags, notes, and optional elevation: puzzle, item, transport, meeting point, hazard, or setup. Drag pins to refine placement. Acceptance: a pin survives save, reload, and export/import with all of its content intact.

2. **Draw and edit routes directly on the map.** Provide click-to-place paths and freehand drawing, with draggable vertices, insert/delete controls, direction arrows, and editable names/colors. Optional snapping should target authored POIs or trusted geometry; a drawn line does not establish that terrain is traversable. Acceptance: a planner can create, revise, duplicate, and share a multi-leg route without editing JSON.

3. **Turn paths into ordered route steps.** Connect POIs and areas to a draggable itinerary with instructions, target segment times, and prerequisites. Selecting a step highlights the corresponding map segment and notes. Acceptance: reordering a step updates the itinerary and explicit route connections coherently.

4. **Support alternate strategies and recovery routes.** Branch at a decision point into a safer strategy, a faster strategy, or a missed-train recovery. Label prerequisites, expected time, and risk using planner input or measured attempts. Acceptance: runners can select a branch without losing the main route or mixing its timing comparison with another strategy.

5. **Add searchable map layers.** Search POIs, areas, route steps, and note text; filter by player, tag, or strategy. Toggle routes, notes, hazards, and transport separately. Use icons and line patterns as well as color. Acceptance: selecting a search result centers and highlights it, with an explanation if its layer is hidden.

6. **Make route sharing complete and safe to merge.** Extend route packs to carry pins, paths, ordered steps, branches, and images. Preview an import, choose merge or replace, show ID conflicts, and back up before applying it. Offer a separate choice for adopting calibration. Acceptance: sharing a route preserves its referenced content and can leave the recipient's local calibration unchanged.

7. **Add a route library and revision history.** Name and duplicate packs; store author, category, player count, game build, route version, and changelog. Let runners pin an exact version for an attempt and restore earlier revisions. Acceptance: editing a route cannot silently rewrite the route version associated with a past run.

8. **Provide share links and an explicit team workspace.** Start with immutable, read-only published pack versions; then add optional authenticated team editing, comments, roles, and revision conflict handling. Keep local operation available. Acceptance: a teammate can view an approved version, fork it, and later synchronize edits without silent overwrite. This needs a separate sharing service; opening the current local telemetry server to the internet is not an implementation plan. Do not bundle game artwork for redistribution by default.

## Execute a run

9. **Separate Plan, Run, and Review modes.** Plan exposes map editing. Run emphasizes the next objective, current segment, and team status. Review emphasizes replay and comparisons. Acceptance: switching modes preserves work and does not reset an active attempt.

10. **Show a compact next-objective card.** Present a short action, landmark, assigned runner, and optionally a proximity cue; expand into the existing rich notes on demand. Offer docked and full-window preferences. Acceptance: entering an area in Run mode can reveal essential instructions without covering the map.

11. **Track checklist and prerequisite progress per attempt.** Support done, skipped, and blocked states with dependencies and a clear reset. Start with manual confirmation; infer completion only when the game reader exposes a validated signal. Acceptance: merely walking near a puzzle never marks it solved.

12. **Add a run timer and editable splits.** Start, split, undo, finish, and reset; compare with a selected personal best and best segments for the same category and route version. Record the timing method and distinguish a session recording from an attempt. Acceptance: split correction works and a page reload recovers the active attempt.

13. **Offer opt-in checkpoint splits and timer integration.** Trigger from configured area crossings with direction, elevation, hysteresis, and cooldown where applicable. Retain manual controls and investigate a supported external timer adapter separately. Acceptance: hovering near a boundary does not repeatedly split, and stale telemetry cannot trigger a split. Current approximately 5 Hz samples cannot establish frame-exact timing or puzzle completion.

14. **Make co-op roles explicit.** Assign steps and map segments to players, show their current objectives, and mark rendezvous or synchronization gates. Acceptance: a runner can distinguish personal work from team work and tell when a teammate's status is stale. Cross-machine shared progress depends on the team workspace and validated remote telemetry coverage.

15. **Add practical train assistance.** Show observed travel direction and planned boarding points; estimate arrival windows from validated track progress and observed motion. Pair a missed connection with its recovery route. Acceptance: estimates display freshness and uncertainty, and disappear when data is stale or the model is unreliable.

16. **Offer restrained route guidance.** Follow the selected player, highlight the next leg, and optionally notify on a sustained deviation. Add configurable hotkeys and opt-in audio cues. Acceptance: dragging the map suspends follow, and a small calibration error does not create repeated alerts. System-wide shortcuts require support beyond ordinary browser key handling.

## Practice and review

17. **Compare against a ghost run.** Overlay a selected best attempt or practice run, aligned by attempt start or a shared checkpoint. Acceptance: comparisons explicitly identify their reference and align at the same step rather than unrelated recording timestamps.

18. **Turn replay into a review workspace.** Add playback speed, frame stepping, bookmarks, segment jumps, and two-attempt comparison. Index or chunk recordings so long sessions can be explored without loading everything or rebuilding all history on every seek. Acceptance: a representative recording above the present 100 MB limit can be opened and scrubbed within an agreed performance budget.

19. **Promote recorded movement into an editable route.** Select a player and time range, simplify their trace, and save it as a draft path with linked POIs. Preserve the original trace for comparison and split at gaps or teleports. Acceptance: simplification retains meaningful turns and never bridges a missing-data gap as if it were a valid path.

20. **Provide segment practice and consistency statistics.** Define practice start/end checkpoints, record repeated attempts, and show best, median, spread, and success rate with sample size. Reset practice state independently of the game. Acceptance: interrupted or failed attempts remain visible rather than making results look artificially better.

21. **Summarize where time was lost.** Compare segment deltas, show spatial differences, and link large losses to replay bookmarks. Let runners annotate causes such as a missed connection or puzzle mistake. Acceptance: measured time loss is distinguished from a user label or an inferred cause.

## Make it dependable and pleasant

22. **Make alignment and elevation trustworthy.** Add a guided check using independent player landmarks, a visible alignment confidence/status indicator, and optional height ranges or floor labels for areas and POIs. Associate authored geometry with a map/calibration revision. Acceptance: a player below an overhead objective does not trigger it when a height constraint is configured, and changing calibration prompts review of affected content.

23. **Explain connection health and first-run setup.** Show game connection, telemetry age, plugin compatibility, map availability, and alignment status with actionable next steps. Reconnect automatically and distinguish live mode from replay. Acceptance: disconnecting produces a clear stale-state explanation instead of silently disappearing markers.

24. **Protect planning work with undo and recovery.** Provide undo/redo for pins, paths, bounds, deletion, and reorder; autosave drafts, maintain recoverable pack backups, and offer conflict resolution across tabs. Acceptance: a crash or rejected concurrent save leaves a recoverable draft and does not require discarding work to reload.

25. **Polish the second-screen experience.** Add resizable panels, readable density settings, keyboard navigation, strong focus states, reduced motion, and high-contrast shapes for players/trains. Supply a clean spectator/stream layout with intentional name visibility. Acceptance: the core planning workflow works without a mouse, and Run mode remains legible on a smaller display.

## Recommended delivery order

| Release | Included improvements | Useful outcome |
| --- | --- | --- |
| Foundation and authoring | 1, 2, 3, 5, 6, 7, 24; basic 22 and 23 | A planner can create, recover, version, and share a complete route. |
| Run companion | 9, 10, 11, 12, 16, 25; finish 22 and 23 | A runner can execute that route with useful instructions and dependable state. |
| Practice and optimization | 4, 17, 18, 19, 20, 21 | Recorded attempts become evidence for better strategies. |
| Connected and advanced | 8, 13, 14, 15 | Teams can coordinate and use validated timing and transport assistance. |

Begin with one complete workflow: place three POIs, draw a route through them, attach step instructions, export it, import it into another local profile, and run its checklist. This is the first meaningful product milestone.

## Implementation notes

- Introduce a versioned pack migration. `validatePack` currently returns a fixed version-1 shape and would drop new fields unless updated. Use stable IDs and validate references, coordinates, counts, and payload sizes. Migrate existing notes and assets without loss.
- Store reusable route definitions separately from per-attempt completion, timings, and local preferences. Keep immutable references to the route revision used for an attempt.
- Distinguish image-space drawings from captured world-space geometry. Retain coordinate provenance and calibration identity; do not silently shift authored pins when a calibration is changed or imported.
- Reuse the SVG map for pin/path editing and the existing sanitized notes pipeline. Introduce focused modules for route editing, attempts, and replay rather than extending the current all-purpose app module indefinitely.
- The initial release can remain local and support complete file-based sharing. Cloud publication and collaborative edits are separate work with explicit account, access, storage, and conflict semantics.
- Verify pack migration/round trips, reference integrity after merge/delete, route editor gestures, recovery after save failures, timing across reconnects, and stale-data suppression. Test co-op coverage from both host and client before promising remote team status.

## Source anchors

- `README.md` and `companion/README.md`: supported features and installation limitations.
- `companion/dist/index.html` and `companion/dist/app.mjs`: current map tools, full-window notes, replay, import/export, polling, and UI behavior.
- `companion/dist/core.mjs`: pack schema, alignment, area triggers, and trail handling.
- `companion/server.mjs`: local-only access, revision checks, persistence, and recording limits.
- `mod/BigWalk.Companion/Plugin.cs`: position sampling and exported telemetry.
- `docs/map-alignment.md`: latest calibration evidence and unresolved player-landmark validation.
