import sys,json
from pathlib import Path
R=Path.cwd();sys.path.insert(0,str(R/'.local/vision'))
import cv2,numpy as np
from scipy.spatial import cKDTree
G=Path(r'C:\Program Files (x86)\Steam\steamapps\common\Big Walk\BepInEx\companion')
g=json.loads((G/'rail-geometry-52.json').read_text());print({k:v for k,v in g.items() if k!='paths'});print([(p['name'],len(p['points'])) for p in g['paths']]);w=np.array([[p[k] for k in ['x','z','y']] for p in g['paths'][0]['points']]);print('range',w.min(axis=0),w.max(axis=0))
f=[json.loads(l) for l in (G/'session-8681c41f5e86460d9b6ff68648c5f0ae.jsonl').read_text().splitlines()];f=[a for a in f if a['players']];eng=np.array([[t['cars'][i]['bodyPosition'][k] for k in ['x','z','y']] for a in f for t in a['trains'] if not t['hasCable'] for i in [0,5,10]])
print('engine distance to sampled spline',np.quantile(cKDTree(w).query(eng)[0],[0,.5,.95,1]))
fit=next(r for r in json.loads((R/'data/alignment/all-engine-fits.json').read_text()) if r['mode']=='affine');a=np.array(fit['matrix']);b=np.array(fit['offset']);im=cv2.imread(str(R/'data/map-candidates/PaperMapSaved-270.png'));p=w[:,:2]@a.T+b;cv2.polylines(im,[p.astype(np.int32)],False,(255,255,0),3);cv2.imwrite(str(R/'data/alignment/full-spline-current.png'),im)
np.save(R/'data/alignment/rail-world.npy',w)
