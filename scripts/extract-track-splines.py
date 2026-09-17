"""Read serialized train/spline data for independent map alignment."""
import sys,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.local/python'))
import UnityPy
print('Loading scene assets...',flush=True)
env=UnityPy.load(r'C:\Program Files (x86)\Steam\steamapps\common\Big Walk\Big Walk_Data\data.unity3d')
scripts={}
out=[]
def hierarchy(go):
    transforms=[]
    tr=next(c.component.read() for c in go.m_Component if c.component.type.name=='Transform')
    for _ in range(40):
        transforms.append(tr.object_reader.read_typetree())
        if tr.m_Father.path_id==0:break
        tr=tr.m_Father.read()
    return transforms
for obj in env.objects:
    if obj.type.name!='MonoBehaviour':continue
    try:
        data=obj.read()
        ref=data.m_Script
        key=(obj.assets_file.name,ref.file_id,ref.path_id)
        if key not in scripts:scripts[key]=ref.read().m_ClassName if ref.path_id else ''
        cls=scripts[key]
        if cls not in ('NetworkedTrain','SplineContainer'):continue
        go=data.m_GameObject.read()
        tree=obj.read_typetree()
        out.append(dict(type=cls,name=go.m_Name,pathId=obj.path_id,file=obj.assets_file.name,
                        tree=tree,hierarchy=hierarchy(go)))
        print(cls,go.m_Name,obj.path_id,flush=True)
    except Exception as e:
        if 'cls' in locals() and cls in ('NetworkedTrain','SplineContainer'):print(type(e).__name__,str(e)[:200],flush=True)
(ROOT/'data/map-candidates/track-splines.json').write_text(json.dumps(out),encoding='utf8')
print('Saved',len(out),'objects',flush=True)
