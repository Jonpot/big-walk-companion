using Il2CppInterop.Runtime.Attributes;
using System.Text.Json;

namespace BigWalk.Companion;

public sealed partial class PositionReader
{
    [HideFromIl2Cpp]
    private void CaptureRailGeometry(NetworkedTrain train)
    {
        if (train.hasCable || train.splines == null || train.splines.Length == 0 ||
            !capturedRailGeometry.Add(train.GetInstanceID())) return;
        try
        {
            var paths = new List<object>();
            for (var containerIndex = 0; containerIndex < train.splines.Length; containerIndex++)
            {
                var container = train.splines[containerIndex];
                if (container == null || container.m_Splines == null) continue;
                for (var splineIndex = 0; splineIndex < container.m_Splines.Length; splineIndex++)
                {
                    var points = new List<Coordinates>();
                    for (var i = 0; i <= 1024; i++)
                    {
                        // Unity's container evaluator returns world-space positions.
                        var p = container.EvaluatePosition(splineIndex, i / 1024f);
                        if (float.IsFinite(p.x) && float.IsFinite(p.y) && float.IsFinite(p.z))
                            points.Add(new Coordinates(p.x, p.y, p.z));
                    }
                    paths.Add(new { containerIndex, splineIndex, name = container.name,
                        path = HierarchyPath(container.transform), points });
                }
            }
            if (paths.Count == 0) return;
            var json = JsonSerializer.Serialize(new { runId, trainId = train.netId,
                source = "SplineContainer.EvaluatePosition", space = "world", paths });
            var target = Path.Combine(OutputDirectory, $"rail-geometry-{train.netId}.json");
            // Detached work contains only managed values; Unity reads stay on the main thread.
            _ = Task.Run(() =>
            {
                try { File.WriteAllText(target + ".tmp", json); File.Move(target + ".tmp", target, true); }
                catch (Exception ex) { Log.LogWarning($"Rail geometry write failed: {ex.Message}"); }
            });
            Log.LogInfo($"Captured {paths.Count} full railway spline(s) for map alignment.");
        }
        catch (Exception ex)
        {
            Log.LogWarning($"Rail geometry capture failed: {ex.Message}");
        }
    }
}

