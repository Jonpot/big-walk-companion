using System.Diagnostics;
using System.Text.Json;

namespace BigWalk.Companion;

internal static class CompanionLauncher
{
    public static void Start(string registrationPath, string telemetryDirectory)
    {
        if (!File.Exists(registrationPath))
            throw new FileNotFoundException("Run Install.cmd once to register the companion for automatic startup.", registrationPath);
        var registration = JsonSerializer.Deserialize<Registration>(File.ReadAllText(registrationPath),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidDataException("The companion launch registration is empty. Run Install.cmd again.");
        var root = registration.PackageRoot;
        if (string.IsNullOrWhiteSpace(root) || !Path.IsPathFullyQualified(root))
            throw new InvalidDataException("The companion launch path is invalid. Run Install.cmd again.");
        var node = Path.Combine(root, "runtime", "node.exe");
        var launcher = Path.Combine(root, "companion", "launch.mjs");
        if (!File.Exists(node) || !File.Exists(launcher))
            throw new FileNotFoundException("The companion folder has moved or is incomplete. Run Install.cmd from its new location.");
        var start = new ProcessStartInfo(node)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            WorkingDirectory = root
        };
        start.ArgumentList.Add(launcher);
        start.Environment["BIGWALK_PATH"] = registration.GamePath;
        start.Environment["COMPANION_TELEMETRY_DIR"] = Path.GetFullPath(telemetryDirectory);
        start.Environment["COMPANION_DATA_DIR"] = string.IsNullOrWhiteSpace(registration.DataDirectory)
            ? Path.Combine(root, "data") : Path.GetFullPath(registration.DataDirectory);
        start.Environment["COMPANION_OPEN_BROWSER"] = "1";
        start.Environment["PORT"] = "4317";
        using var process = Process.Start(start)
            ?? throw new InvalidOperationException("Could not start the companion launcher.");
    }

    private sealed record Registration(string PackageRoot, string GamePath, string? DataDirectory);
}
