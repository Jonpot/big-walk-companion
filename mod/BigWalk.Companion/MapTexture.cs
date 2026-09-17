extern alias UnityCore;
using Il2CppInterop.Runtime.Attributes;
using Texture2D = UnityCore::UnityEngine.Texture2D;
using RenderTexture = UnityCore::UnityEngine.RenderTexture;
using Graphics = UnityCore::UnityEngine.Graphics;
using Resources = UnityCore::UnityEngine.Resources;
using Object = UnityCore::UnityEngine.Object;
using Rect = UnityCore::UnityEngine.Rect;
using TextureFormat = UnityCore::UnityEngine.TextureFormat;

namespace BigWalk.Companion;

public sealed partial class PositionReader
{
    private volatile bool mapTextureExported;

    [HideFromIl2Cpp]
    private void ExportMapTexture()
    {
        // A native encoding failure can recurse in interop exception formatting and
        // terminate the process with StackOverflowException; a catch cannot contain it.
        if (!EnableExperimentalMapExport || mapTextureExported) return;
        var target = Path.Combine(OutputDirectory, "map.png");
        if (File.Exists(target)) { mapTextureExported = true; return; }
        try
        {
            foreach (var source in Resources.FindObjectsOfTypeAll<Texture2D>())
            {
                if (source == null || source.name != "PaperMapSaved" || source.width < 1024) continue;
                var previous = RenderTexture.active;
                var buffer = RenderTexture.GetTemporary(source.width, source.height, 0);
                Texture2D? readable = null;
                byte[] bytes;
                try
                {
                    Graphics.Blit(source, buffer);
                    RenderTexture.active = buffer;
                    readable = new Texture2D(source.width, source.height, TextureFormat.RGBA32, false);
                    readable.ReadPixels(new Rect(0, 0, source.width, source.height), 0, 0);
                    readable.Apply();
                    bytes = UnityEngine.ImageConversion.EncodeToPNG(readable).ToArray();
                }
                finally
                {
                    RenderTexture.active = previous;
                    RenderTexture.ReleaseTemporary(buffer);
                    if (readable != null) Object.Destroy(readable);
                }
                // Capture Unity resources on the game thread, then write managed PNG bytes off-thread.
                mapTextureExported = true;
                _ = Task.Run(() =>
                {
                    try { File.WriteAllBytes(target + ".tmp", bytes); File.Move(target + ".tmp", target, true); }
                    catch (Exception ex) { mapTextureExported = false; Log.LogWarning($"Map export failed: {ex.Message}"); }
                });
                Log.LogInfo("Exported PaperMapSaved for the local companion.");
                return;
            }
        }
        catch (Exception ex) { Log.LogWarning($"Map export failed: {ex.Message}"); }
    }
}
