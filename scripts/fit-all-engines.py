import sys,json
from pathlib import Path
R=Path.cwd();sys.path.insert(0,str(R/'.local/vision'))
import cv2,numpy as np
from scipy.optimize import least_squares
from scipy.ndimage import map_coordinates
f=[json.loads(l) for l in Path(r'C:\Program Files (x86)\Steam\steamapps\common\Big Walk\BepInEx\companion\session-8681c41f5e86460d9b6ff68648c5f0ae.jsonl').read_text().splitlines()];f=[a for a in f if a['players']]
w=np.array([[list(next(t for t in a['trains'] if not t['hasCable'])['cars'][i]['bodyPosition'][k] for k in ['x','z']) for i in [0,5,10]] for a in f])
m=cv2.imread(str(R/'data/alignment/blue-track-mask.png'),0);d=cv2.distanceTransform(255-m,cv2.DIST_L2,cv2.DIST_MASK_PRECISE)
old=json.loads((R/'data/alignment/calibration-fit.json').read_text());A=np.array(old['matrix']);b=np.array(old['offset']);W=w.reshape(-1,2)
def distances(p):return map_coordinates(d,[p[:,1],p[:,0]],order=1,mode='constant',cval=1000)
print('old',[(np.mean(distances(w[:,i]@A.T+b)),np.max(distances(w[:,i]@A.T+b))) for i in range(3)],flush=True)
res=[]
for mode in ['similarity','affine','45','0','90','180','270']:
 def mat(v):
  if mode=='affine':return np.array(v[:4]).reshape(2,2),v[4:]
  if mode=='similarity':return np.array([[v[0],v[1]],[v[1],-v[0]]]),v[2:]
  t=float(mode)*np.pi/180;return v[0]*np.array([[np.cos(t),np.sin(t)],[np.sin(t),-np.cos(t)]]),v[1:]
 v0=[*A.ravel(),*b] if mode=='affine' else [A[0,0],A[0,1],*b] if mode=='similarity' else [2.73,*b]
 def fun(v):
  a,c=mat(v);return distances(W@a.T+c)
 fit=least_squares(fun,v0,diff_step=1e-4,max_nfev=800)
 a,c=mat(fit.x);err=fun(fit.x);r=dict(mode=mode,matrix=a.tolist(),offset=list(c),mean=float(err.mean()),max=float(err.max()),p95=float(np.quantile(err,.95)));res.append(r);print(r,flush=True)
(R/'data/alignment/all-engine-fits.json').write_text(json.dumps(res,indent=2))
