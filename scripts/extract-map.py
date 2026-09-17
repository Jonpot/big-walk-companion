"""Inspect owned local Unity assets and extract map candidates, never modify game files."""
import sys
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.local/python'))
import UnityPy

game = Path(sys.argv[1] if len(sys.argv) > 1 else r'C:\Program Files (x86)\Steam\steamapps\common\Big Walk')
output = ROOT / 'data/map-candidates'
output.mkdir(parents=True, exist_ok=True)
print('Reading data.unity3d...', flush=True)
env = UnityPy.load(str(game / 'Big Walk_Data/data.unity3d'))
print('Loaded asset bundle. Inspecting texture names...', flush=True)
textures = []
for obj in env.objects:
    if obj.type.name != 'Texture2D':
        continue
    try:
        tex = obj.read()
        entry = dict(name=tex.m_Name, width=tex.m_Width, height=tex.m_Height,
                     pathId=obj.path_id, assetFile=obj.assets_file.name)
        textures.append(entry)
        if re.search(r'map|island|cartograph', tex.m_Name, re.I):
            filename = re.sub(r'[^a-zA-Z0-9_.-]', '_', tex.m_Name) + f'-{obj.path_id}.png'
            tex.image.save(output / filename)
            print(json.dumps({**entry, 'file': filename}), flush=True)
    except Exception as exc:
        print(f'Texture {obj.path_id}: {exc}', flush=True)
(output / 'textures.json').write_text(json.dumps(textures, indent=2), encoding='utf-8')
print(f'Inspected {len(textures)} textures.', flush=True)
