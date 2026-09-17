import sys,json
from pathlib import Path
R=Path.cwd();sys.path.insert(0,str(R/'.local/vision'))
import cv2,numpy as np
from scipy.spatial import cKDTree
from scipy.optimize import least_squares
w=np.load(R/'data/alignment/rail-world.npy');dense=np.vstack([w[i]+(w[i+1]-w[i])*np.arange(8)[:,None]/8 for i in range(len(w)-1)])
im=cv2.imread(str(R/'data/map-candidates/PaperMapSaved-270.png'));m=cv2.imread(str(R/'data/alignment/blue-track-mask.png'),0)
n,labels,stats,cents=cv2.connectedComponentsWithStats(m);print([(i,int(s[4]),cents[i].round(1).tolist()) for i,s in enumerate(stats) if 250<s[4]<100000])
r=next(r for r in json.loads((R/'data/alignment/all-engine-fits.json').read_text()) if r['mode']=='affine');A=np.array(r['matrix']);b=np.array(r['offset'])
ys,xs=np.where(np.isin(labels,[i for i,s in enumerate(stats) if 500<s[4]<100000]));target=np.column_stack([xs,ys])[::5];dist=cKDTree(dense[:,:2]@A.T+b).query(target)[0];target=target[dist<130];print('target',len(target))
results=[]
for dims in [2,3]:
 X=dense[:,:dims];a=A if dims==2 else np.column_stack([A,np.zeros(2)]);off=b.copy()
 for it in range(150):
  dst,ix=cKDTree(X@a.T+off).query(target);err=target-(X[ix]@a.T+off);weight=1/np.maximum(1,dst/12)
  design=np.column_stack([X[ix],np.ones(len(ix))]);coef=np.linalg.lstsq(design*weight[:,None],target*weight[:,None],rcond=None)[0];aa=coef[:-1].T;bb=coef[-1]
  if np.max(abs(aa-a))<1e-7:break
  a,off=aa,bb
 dst=cKDTree(X@a.T+off).query(target)[0];result=dict(dims=dims,matrix=a.tolist(),offset=off.tolist(),median=float(np.median(dst)),p95=float(np.quantile(dst,.95)),max=float(dst.max()));results.append(result);print(result,flush=True)
 canvas=im.copy();p=w[:,:dims]@a.T+off;cv2.polylines(canvas,[p.astype(np.int32)],False,(255,255,0),3);cv2.imwrite(str(R/f'data/alignment/full-fit-{dims}d.png'),canvas)
(R/'data/alignment/full-rail-fit.json').write_text(json.dumps(results,indent=2))
