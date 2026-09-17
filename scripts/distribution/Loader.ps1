# Complete only a clean install or a partial copy of the bundled loader.
# Preflight every archive entry before writing anything; never overwrite a file.
function Install-BigWalkLoader([string]$Game, [string]$Archive) {
    $expected = Join-Path $Game 'BepInEx\core\BepInEx.Unity.IL2CPP.dll'
    if (Test-Path -LiteralPath $expected -PathType Leaf) {
        Write-Host 'Keeping your existing BepInEx IL2CPP loader and configuration.'
        return
    }
    $guidance = @"
Game folder: $Game
Expected loader: $expected
No existing loader files were replaced.
If you use a mod manager, BepInEx may be inside its profile rather than this folder.
Run Install.cmd again, choose M, and select that profile folder; see START HERE.txt.
Otherwise check Steam > Manage > Browse local files and rerun Install.cmd -GamePath "<game folder>".
This companion needs BepInEx 6 Unity IL2CPP Windows x64, not BepInEx 5 or Mono.
Do not delete winhttp.dll blindly: it may belong to another loader.
"@
    foreach ($incompatible in @('BepInEx\core\BepInEx.dll', 'BepInEx\core\BepInEx.Unity.Mono.dll')) {
        if (Test-Path -LiteralPath (Join-Path $Game $incompatible)) {
            throw "An incompatible BepInEx layout was found ($incompatible).`n$guidance"
        }
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($Archive)
    try {
        $root = [IO.Path]::GetFullPath($Game).TrimEnd('\') + '\'
        $missing = @()
        $seen = @{}
        foreach ($entry in $zip.Entries) {
            $destination = [IO.Path]::GetFullPath((Join-Path $Game $entry.FullName))
            if (!$destination.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or $entry.FullName.Contains(':')) {
                throw 'The bundled loader archive contains an invalid path.'
            }
            if ($seen.ContainsKey($destination)) { throw 'The bundled loader archive contains duplicate paths.' }
            $seen[$destination] = $true
            $isDirectory = $entry.FullName.EndsWith('/') -or $entry.FullName.EndsWith('\')
            if (Test-Path -LiteralPath $destination) {
                $item = Get-Item -LiteralPath $destination
                if ([bool]$item.PSIsContainer -ne $isDirectory) { throw "Loader path conflict: $destination`n$guidance" }
                if (!$isDirectory) {
                    $stream = $entry.Open()
                    $sha = [Security.Cryptography.SHA256]::Create()
                    try { $archiveHash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '') }
                    finally { $stream.Dispose(); $sha.Dispose() }
                    if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $archiveHash) {
                        throw "Existing loader file differs from the bundled loader: $destination`n$guidance"
                    }
                }
            } else { $missing += @{Entry=$entry; Path=$destination; Directory=$isDirectory} }
        }
        if (!$seen.ContainsKey([IO.Path]::GetFullPath($expected))) { throw 'The bundled archive is missing the IL2CPP loader.' }
        foreach ($file in $missing) {
            if ($file.Directory) { [IO.Directory]::CreateDirectory($file.Path) | Out-Null }
            else {
                [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($file.Path)) | Out-Null
                [IO.Compression.ZipFileExtensions]::ExtractToFile($file.Entry, $file.Path, $false)
            }
        }
        Write-Host 'Installed missing BepInEx 6 IL2CPP x64 files; matching existing files were kept.'
    } finally { $zip.Dispose() }
}
