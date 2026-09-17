import sys, json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.local/python'))
import UnityPy
game = Path(r'C:\Program Files (x86)\Steam\steamapps\common\Big Walk')
print('Reading scene bundle...', flush=True)
env = UnityPy.load(str(game / 'Big Walk_Data/data.unity3d'))
results = []
for obj in env.objects:
    if obj.type.name == 'Camera':
        tree = obj.read_typetree()
        cam = obj.read()
        go = cam.m_GameObject.read()
        transform = None
        for component in go.m_Component:
            target = component.component
            if target.type.name == 'Transform':
                transform = target.read_typetree()
        results.append(dict(type='Camera', name=go.m_Name, file=obj.assets_file.name,
                            pathId=obj.path_id, camera=tree, transform=transform))
    elif obj.type.name == 'GameObject':
        go = obj.read()
        if re.search(r'paper.?map|map.?camera|map.?render', go.m_Name, re.I):
            results.append(dict(type='GameObject',name=go.m_Name,file=obj.assets_file.name,pathId=obj.path_id))
out = ROOT / 'data/map-candidates/scene-camera-inspection.json'
out.write_text(json.dumps(results,indent=2),encoding='utf8')
print(json.dumps([{'name':r['name'],'type':r['type']} for r in results]),flush=True)
