extern alias UnityCore;
using Il2CppInterop.Runtime.Attributes;
using Resources = UnityCore::UnityEngine.Resources;
using Time = UnityCore::UnityEngine.Time;
using Transform = UnityCore::UnityEngine.Transform;
using Renderer = UnityCore::UnityEngine.Renderer;

namespace BigWalk.Companion;

public sealed partial class PositionReader
{
    private NetworkedTrain[] trainObjects = Array.Empty<NetworkedTrain>();
    private readonly Dictionary<int, TrainIdentity> trainIdentities = new();
    private float nextTrainDiscovery;
    private float nextTrainError;
    private int lastTrainCount = -1;
    private readonly HashSet<int> capturedRailGeometry = new();

    [HideFromIl2Cpp]
    private List<TrainSample> ReadTrains()
    {
        var samples = new List<TrainSample>();
        try
        {
            if (Time.unscaledTime >= nextTrainDiscovery)
            {
                nextTrainDiscovery = Time.unscaledTime + 5;
                // Include inactive cars, but exclude prefab assets and unspawned objects.
                var found = new List<NetworkedTrain>();
                foreach (var train in Resources.FindObjectsOfTypeAll<NetworkedTrain>())
                    if (train != null && train.gameObject.scene.isLoaded && train.netId != 0)
                        found.Add(train);
                trainObjects = found.ToArray();
                var alive = new HashSet<int>(trainObjects.Select(t => t.GetInstanceID()));
                foreach (var key in trainIdentities.Keys.Where(k => !alive.Contains(k)).ToArray())
                    trainIdentities.Remove(key);
            }
            foreach (var train in trainObjects)
            {
                if (train == null || train.netId == 0 || !train.gameObject.scene.isLoaded) continue;
                try
                {
                    var key = train.GetInstanceID();
                    if (!trainIdentities.TryGetValue(key, out var identity))
                    {
                        var materials = new HashSet<string>();
                        if (train.cars != null)
                            foreach (var car in train.cars)
                            {
                                if (car == null) continue;
                                foreach (var renderer in car.GetComponentsInChildren<Renderer>(true))
                                    foreach (var material in renderer.sharedMaterials)
                                        if (material != null) materials.Add(material.name);
                            }
                        identity = new TrainIdentity(HierarchyPath(train.transform), materials.OrderBy(n => n).ToArray());
                        trainIdentities[key] = identity;
                        Log.LogInfo($"Discovered train {train.netId}: {identity.path}; cable={train.hasCable}; materials={string.Join(", ", identity.materials)}");
                    }
                    CaptureRailGeometry(train);
                    var cars = new List<TrainCarSample>();
                    if (train.cars != null)
                        for (var index = 0; index < train.cars.Length; index++)
                        {
                            var car = train.cars[index];
                            if (car == null) continue;
                            var body = car.mainBody;
                            var proxy = car.proxy;
                            cars.Add(new TrainCarSample(index, car.name, car.gameObject.activeInHierarchy,
                                car.cullState, car.useProxy, Coordinates.From(car.transform.position),
                                body != null ? Coordinates.From(body.position) : null,
                                proxy != null ? Coordinates.From(proxy.position) : null));
                        }
                    // Keep all position candidates until the moving engine and
                    // distant/culling behavior have been verified in a recording.
                    samples.Add(new TrainSample($"train:{train.netId}", train.name, identity,
                        train.gameObject.activeInHierarchy, train.hasCable, train.cullMode.ToString(),
                        train.CurrentSpeed, train.syncSpeed, train.syncSplineIndex, train.syncDistance,
                        train.lastPlacedSplineIndex, train.lastPlacedDistance,
                        Coordinates.From(train.transform.position), cars));
                }
                catch (Exception ex) { ReportTrainError(ex); }
            }
            if (samples.Count != lastTrainCount)
            {
                Log.LogInfo($"Tracking {samples.Count} networked train candidate(s).");
                lastTrainCount = samples.Count;
            }
        }
        catch (Exception ex) { ReportTrainError(ex); }
        return samples;
    }

    [HideFromIl2Cpp]
    private void ReportTrainError(Exception ex)
    {
        if (Time.unscaledTime < nextTrainError) return;
        nextTrainError = Time.unscaledTime + 10;
        Log.LogWarning($"Train inspection failed: {ex.Message}");
    }

    [HideFromIl2Cpp]
    private static string HierarchyPath(Transform transform)
    {
        var parts = new List<string>();
        for (var depth = 0; transform != null && depth < 24; depth++, transform = transform.parent)
            parts.Add(transform.name);
        parts.Reverse();
        return string.Join("/", parts);
    }

    private sealed record TrainIdentity(string path, string[] materials);

    [HideFromIl2Cpp]
    private static List<TrainMarker> BuildTrainMarkers(List<TrainSample> trains)
    {
        var markers = new List<TrainMarker>();
        foreach (var train in trains)
        {
            // Verified against the 2026-09-15 recording. Fail closed if the
            // game's layout changes; preserve raw telemetry for reinspection.
            if (train.hasCable || train.identity.path != "TrainSystem/TrainNew/TrainNetworking"
                || train.cars.Count != 15) continue;
            for (var group = 0; group < 3; group++)
            {
                var first = group * 5;
                var cars = train.cars.Skip(first).Take(5).ToArray();
                var prefix = group == 0 ? "TrainCarNew" : $"TrainCarNew {(char)('A' + group)}(";
                if (cars.Where((car, i) => car.index != first + i ||
                        !car.name.StartsWith(prefix, StringComparison.Ordinal)).Any()) continue;
                var position = cars[0].bodyPosition;
                if (position == null) continue;
                var letter = ((char)('A' + group)).ToString();
                markers.Add(new TrainMarker($"{train.id}:{letter}", letter,
                    new[] { "Red train", "Green train", "Yellow train" }[group],
                    new[] { "red", "green", "yellow" }[group], false, "first-car.mainBody",
                    position.x, position.y, position.z, cars.Select(c => c.index).ToArray()));
            }
        }
        return markers;
    }

    private sealed record TrainMarker(string id, string group, string name, string color, bool provisional,
        string positionSource, float x, float y, float z, int[] carIndices);
    private sealed record TrainCarSample(int index, string name, bool active, bool cullState,
        bool useProxy, Coordinates? transformPosition, Coordinates? bodyPosition, Coordinates? proxyPosition);
    private sealed record TrainSample(string id, string name, TrainIdentity identity,
        bool active, bool hasCable, string cullMode, float currentSpeed, float syncSpeed,
        int syncSplineIndex, float syncDistance, int lastPlacedSplineIndex, double lastPlacedDistance,
        Coordinates? rootPosition, List<TrainCarSample> cars);
}
