namespace BigWalk.Companion;

// This class deliberately has no Unity dependencies. The PNG is already encoded
// and matches the companion's default calibration; no game/save state is needed.
internal static class BundledMap
{
    public static bool WriteIfMissing(string directory)
    {
        Directory.CreateDirectory(directory);
        var target = Path.Combine(directory, "map.png");
        if (File.Exists(target)) return false;
        using var resource = typeof(BundledMap).Assembly.GetManifestResourceStream("BigWalk.Companion.Map.png")
            ?? throw new InvalidOperationException("The bundled map resource is missing.");
        var temporary = Path.Combine(directory, $"map-{Guid.NewGuid():N}.tmp");
        try
        {
            using (var output = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                resource.CopyTo(output);
            try { File.Move(temporary, target); }
            catch (IOException) when (File.Exists(target)) { return false; }
            return true;
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
}
