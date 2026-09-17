# Map alignment status

## Current trial — 2026-09-15

The user requested replacing the old calibration despite unresolved walking-path accuracy. Revision 4 now uses the unfiltered affine fit to **all 765 engine observations** (255 frames × three train groups) in `session-8681c41f5e86460d9b6ff68648c5f0ae.jsonl`. There is no train snapping or per-train positional correction.

```
pixelX = 1.9093504671573256 * X + 1.8110238758914516 * Z + 2604.8216929397195
pixelY = 1.9278391167721083 * X - 2.092247134578898  * Z + 490.22652347771657
```

Divide by 4096 for normalized image coordinates. This is a general 2D affine transform, not a single rotation angle. It remains broadly diagonal relative to world X/Z. The default is still labeled estimated.

Distance from each projected engine observation to the closest blue-mask pixel on the original 4096 × 4096 image:

- Previous fit: worst 117.98 pixels; green worst 41.63 pixels.
- Current trial: mean 4.86 pixels, 95th percentile 24.14 pixels, worst 33.66 pixels.

These are in-sample distances to a color mask, not independent accuracy measurements. The mask includes other blue marks, and the transform **does not yet satisfy the user's requirement that every train observation lie on the blue track**. Player alignment has not been independently verified. A lower train error does not prove correct walking paths or camera orientation.

Backup: `data/alignment/route-pack-before-all-engine-fit-1789523686.json` contains the full prior server state. Apply its `pack` through `/api/state` with the server's current revision to restore it. Do not write the state file while the server is running.

Reproduction: `scripts/fit-all-engines.py`; the `affine` result in `data/alignment/all-engine-fits.json` is the applied transform. Other scripts and results from this session are exploratory and were **not** applied. In particular, some unconstrained fixed-angle trials collapse their scale toward zero; these are invalid solutions and do not support an orientation claim. Height-dependent trials improved some rail errors but introduced implausible player displacement; none were applied.

## Next diagnostic

Plugin 0.1.5 is built and installed. On discovering a non-cable networked train, it attempts to sample each complete rail spline into `BepInEx/companion/rail-geometry-<netId>.json`. This avoids needing a complete train-lap recording to obtain the whole track shape. Sampling is once per train instance; it reads geometry without modifying trains. Runtime capture still needs verification on the next game session.

World-space evaluation is documented by Unity: https://docs.unity.cn/Packages/com.unity.splines%402.5/api/UnityEngine.Splines.SplineContainer.EvaluatePosition.html

## Prior fit and corrected interpretation

The initial user screenshot was registered to the source texture with 493 SIFT/RANSAC inliers. Its rough hand-drawn path selected the approximate location and orientation, but supplied no exact surveyed landmark.

The prior refinement retained only 78.5% of sampled car observations. Its reported 0.455-pixel median and 9.392-pixel 95th percentile applied only to that selected subset. Those figures should not be used as overall accuracy. The earlier explanation attributing rejected samples to tunnels or drawing gaps was an unverified hypothesis. All subsequent comparison metrics must include the complete selected train recordings, with any gaps or exclusions reported explicitly.

## Superseding calibration: full railway capture (revision 5)

Plugin 0.1.5 successfully captured TrainSpline, 1,025 world-space samples. Historical recorded engines lie within 1.20 world units of the nearest sampled point (median 0.595); this includes finite sampling spacing, not a measurement of continuous-curve error.

Applied the 2D result from `full-rail-fit.json`:

```
pixelX = 1.9254434489146857*X + 1.9238289521767336*Z + 2671.5615591155215
pixelY = 1.9188808608625665*X - 1.9254914360435191*Z + 611.713227052658
```

Principal scales are 2.72259 and 2.71764 (ratio 1.00182); world X maps at 44.902 degrees. This supports approximately 45-degree rotation with effectively uniform scaling, not substantial stretching. Elevation fitting provided no improvement at the 95th percentile and was not applied.

Unlike the earlier forward fit that forced all engine points onto visible blue pixels, this registration matches visible blue-image sections to the complete captured railway. A full railway need not be painted continuously on the PNG. Candidate blue components were selected by size and proximity to the seed curve; robust weights reduce influence of unrelated nearby marks. Thus this is not a measurement of all blue pixels or independent geographic accuracy.

Validation: refit excluding the entire western blue bend (connected component 9). Its 1,014 held-out image pixels have median distance 2.064, p95 4.654, max 5.601 original-image pixels to the projected railway. This is a held-out section, not merely alternating samples of the same fitted section. The geometry and image agree well enough to disfavor a grossly outdated railway drawing, but do not establish the age/correctness of other map details. Player landmarks remain unverified.

Reproduce with `inspect-full-rail.py`, `fit-full-rail.py`, and `validate-full-rail.py`. Preview: `data/alignment/full-rail-closeup.png` (cyan full railway, green recorded engine path). The recorded path continues past a painted endpoint; do not describe all off-blue positions as calibration errors, or assert that these gaps are tunnels without additional evidence.
