extern alias UnityCore;
using BepInEx;
using BepInEx.Logging;
using BepInEx.Unity.IL2CPP;
using Il2CppInterop.Runtime.Attributes;
using System.Text.Json;
using System.Threading.Channels;
using MonoBehaviour = UnityCore::UnityEngine.MonoBehaviour;
using Time = UnityCore::UnityEngine.Time;
using Resources = UnityCore::UnityEngine.Resources;
using Vector3 = UnityCore::UnityEngine.Vector3;

namespace BigWalk.Companion;

[BepInPlugin("com.jonpot.bigwalk.companion", "Big Walk Companion", Plugin.Version)]
public sealed class Plugin : BasePlugin
{
    internal const string Version = "0.1.3";
    public override void Load()
    {
        PositionReader.Log = Log;
        PositionReader.OutputDirectory = Config.Bind("Output", "Directory",
            Path.Combine(Paths.BepInExRootPath, "companion"),
            "Local position snapshots for the second-monitor companion.").Value;
        Directory.CreateDirectory(PositionReader.OutputDirectory);
        PositionReader.IncludeRawTrainData = Config.Bind("Diagnostics", "IncludeRawTrainData", false,
            "Include verbose per-car diagnostics. Off keeps normal recordings small.").Value;
        var autoStart = Config.Bind("Companion", "AutoStart", true,
            "Start the companion in the background and open its map when the game loads. Run Install.cmd again if the companion folder moves.").Value;
        _ = Task.Run(() =>
        {
            try
            {
                if (BundledMap.WriteIfMissing(PositionReader.OutputDirectory))
                    Log.LogInfo("Installed the bundled companion map. No game progress or texture export is required.");
            }
            catch (Exception ex) { Log.LogWarning($"Could not write the bundled map: {ex.Message}"); }
            if (autoStart)
            {
                try
                {
                    var registration = Path.Combine(Path.GetDirectoryName(typeof(Plugin).Assembly.Location)!, "companion-launch.json");
                    CompanionLauncher.Start(registration, PositionReader.OutputDirectory);
                    Log.LogInfo("Started the companion launcher. Startup details are in the companion data/launcher.log.");
                }
                catch (Exception ex) { Log.LogWarning($"Companion automatic startup failed: {ex.Message}"); }
            }
        });
        AddComponent<PositionReader>();
        Log.LogInfo($"Position reader loaded. Output: {PositionReader.OutputDirectory}");
    }
}

public sealed partial class PositionReader : MonoBehaviour
{
    internal static ManualLogSource Log = null!;
    internal static string OutputDirectory = "";
    internal static bool IncludeRawTrainData;
    private readonly string runId = Guid.NewGuid().ToString("N");
    private readonly Channel<string> snapshots = Channel.CreateBounded<string>(new BoundedChannelOptions(1)
        { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true, SingleWriter = true });
    private float nextSample;
    private float nextError;
    private int lastCount = -1;
    private long sequence;
    private float nextMapCheck;
    private bool mapCameraCaptured;

    public PositionReader(IntPtr pointer) : base(pointer) { }

    public void Start() => _ = Task.Run(WriteSnapshots);

    public void Update()
    {
        if (Time.unscaledTime < nextSample) return;
        nextSample = Time.unscaledTime + 0.2f;
        try
        {
            if (Time.unscaledTime >= nextMapCheck)
            {
                nextMapCheck = Time.unscaledTime + 10;
                if (!mapCameraCaptured) CaptureMapCamera();
            }
            var players = new List<PlayerSample>();
            var characters = PlayerCharacter.allPlayerCharacters;
            if (characters != null)
            {
                for (var i = 0; i < characters.Count; i++)
                {
                    var character = characters[i];
                    if (character == null || !character.gameObject.activeInHierarchy) continue;
                    var networking = character.playerNetworking;
                    var position = character.transform.position;
                    // Harry's tested logger uses mover.cachedKernalPos. Keep the
                    // original root reading until a live recording establishes
                    // which transform stays correct for local and remote players.
                    var kernal = character.kernal;
                    var mover = character.mover;
                    Coordinates? kernalPosition = kernal != null ? Coordinates.From(kernal.position) : null;
                    Coordinates? moverPosition = mover != null ? Coordinates.From(mover.cachedKernalPos) : null;
                    if (!float.IsFinite(position.x) || !float.IsFinite(position.y) || !float.IsFinite(position.z)) continue;
                    var name = networking != null ? networking.username : "";
                    players.Add(new PlayerSample(character.netId.ToString(),
                        string.IsNullOrWhiteSpace(name) ? $"Player {character.netId}" : name,
                        character.isLocalPlayer, position.x, position.y, position.z,
                        character.transform.eulerAngles.y, kernalPosition, moverPosition));
                }
            }
            if (players.Count != lastCount)
            {
                Log.LogInfo($"Tracking {players.Count} player(s); local: {players.Count(p => p.local)}");
                lastCount = players.Count;
            }
            var trains = ReadTrains();
            snapshots.Writer.TryWrite(JsonSerializer.Serialize(new
            {
                schemaVersion = 1, pluginVersion = Plugin.Version, positionSource = "character.transform",
                runId, sequence = ++sequence,
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                players,
                trains = IncludeRawTrainData ? trains : null,
                trainMarkers = BuildTrainMarkers(trains)
            }));
        }
        catch (Exception ex)
        {
            if (Time.unscaledTime >= nextError)
            {
                Log.LogWarning($"Position read failed: {ex.Message}");
                nextError = Time.unscaledTime + 10;
            }
        }
    }

    [HideFromIl2Cpp]
    private void CaptureMapCamera()
    {
        // These are candidates only: the saved texture may have been baked with
        // different settings. Validate projection against in-game landmarks.
        try
        {
            var candidates = new List<object>();
            foreach (var paperMap in Resources.FindObjectsOfTypeAll<PaperMapCamera>())
            {
                if (paperMap == null || paperMap.mapCamera == null) continue;
                var camera = paperMap.mapCamera;
                var texture = paperMap.savedTexture;
                candidates.Add(new
                {
                    name = paperMap.name,
                    cameraName = camera.name,
                    active = camera.gameObject.activeInHierarchy,
                    orthographic = camera.orthographic,
                    orthographicSize = camera.orthographicSize,
                    aspect = camera.aspect,
                    position = Coordinates.From(camera.transform.position),
                    rotation = Coordinates.From(camera.transform.eulerAngles),
                    texture = texture != null ? texture.name : null,
                    textureWidth = texture != null ? texture.width : 0,
                    textureHeight = texture != null ? texture.height : 0,
                    originViewport = Coordinates.From(camera.WorldToViewportPoint(Vector3.zero)),
                    x100Viewport = Coordinates.From(camera.WorldToViewportPoint(new Vector3(100, 0, 0))),
                    y100Viewport = Coordinates.From(camera.WorldToViewportPoint(new Vector3(0, 100, 0))),
                    z100Viewport = Coordinates.From(camera.WorldToViewportPoint(new Vector3(0, 0, 100)))
                });
            }
            if (candidates.Count == 0) return;
            File.WriteAllText(Path.Combine(OutputDirectory, "map-camera-candidates.json"),
                JsonSerializer.Serialize(new { runId, candidates }));
            mapCameraCaptured = true;
            Log.LogInfo($"Captured {candidates.Count} map camera candidate(s) for calibration.");
        }
        catch (Exception ex)
        {
            Log.LogWarning($"Map camera inspection failed: {ex.Message}");
        }
    }

    [HideFromIl2Cpp]
    private async Task WriteSnapshots()
    {
        var target = Path.Combine(OutputDirectory, "positions.json");
        var temporary = target + ".tmp";
        var recording = Path.Combine(OutputDirectory, $"session-{runId}.jsonl");
        var errorReported = false;
        await foreach (var json in snapshots.Reader.ReadAllAsync())
        {
            try
            {
                await File.WriteAllTextAsync(temporary, json);
                File.Move(temporary, target, true);
                await File.AppendAllTextAsync(recording, json + Environment.NewLine);
                errorReported = false;
            }
            catch (Exception ex)
            {
                if (!errorReported) Log.LogWarning($"Snapshot write failed: {ex.Message}");
                errorReported = true;
            }
        }
    }

    public void OnDestroy() => snapshots.Writer.TryComplete();

    private sealed record PlayerSample(string id, string name, bool local,
        float x, float y, float z, float heading,
        Coordinates? kernalPosition, Coordinates? moverPosition);

    private sealed record Coordinates(float x, float y, float z)
    {
        public static Coordinates? From(UnityCore::UnityEngine.Vector3 value) =>
            float.IsFinite(value.x) && float.IsFinite(value.y) && float.IsFinite(value.z)
                ? new Coordinates(value.x, value.y, value.z) : null;
    }
}
