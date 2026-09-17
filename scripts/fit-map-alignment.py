"""Fit a map projection using image registration and recorded train positions."""
import sys,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.local/vision'))
import cv2
import numpy as np
from scipy.spatial import cKDTree
from scipy.optimize import least_squares
out=ROOT/'data/alignment';out.mkdir(exist_ok=True)
full=cv2.imread(str(ROOT/'data/map-candidates/PaperMapSaved-270.png'))
if len(sys.argv)!=2:raise SystemExit('Usage: python scripts/fit-map-alignment.py <reference-screenshot.png>')
crop=cv2.imread(sys.argv[1])
if crop is None:raise SystemExit('Could not read the reference screenshot')
sift=cv2.SIFT_create(nfeatures=15000)
k1,d1=sift.detectAndCompute(crop,None);k2,d2=sift.detectAndCompute(full,None)
matches=cv2.BFMatcher().knnMatch(d1,d2,k=2)
good=[m for m,n in matches if m.distance<.7*n.distance]
src=np.float32([k1[m.queryIdx].pt for m in good]);dst=np.float32([k2[m.trainIdx].pt for m in good])
H,inliers=cv2.estimateAffinePartial2D(src,dst,method=cv2.RANSAC,ransacReprojThreshold=2)
if H is None or int(inliers.sum())<20:raise RuntimeError('Screenshot could not be registered reliably')
def registered(p):return np.array(p)@H[:,:2].T+H[:,2]
print('Screenshot registration',H.tolist(),'inliers',int(inliers.sum()),flush=True)
hsv=cv2.cvtColor(full,cv2.COLOR_BGR2HSV)
mask=((hsv[:,:,0]>=100)&(hsv[:,:,0]<=120)&(hsv[:,:,1]>185)&(hsv[:,:,2]>65)).astype(np.uint8)
ys,xs=np.where(mask);tree=cKDTree(np.column_stack([xs,ys]))
cv2.imwrite(str(out/'blue-track-mask.png'),mask*255)
recording=Path(r'C:\Program Files (x86)\Steam\steamapps\common\Big Walk\BepInEx\companion\session-8681c41f5e86460d9b6ff68648c5f0ae.jsonl')
frames=[json.loads(l) for l in recording.read_text().splitlines()]
frames=[f for f in frames if f['players']]
groups=[[],[],[]]
for f in frames[::3]:
    train=next(t for t in f['trains'] if not t['hasCable'])
    for group in range(3):
        for car in train['cars'][group*5:group*5+5]:
            p=car['bodyPosition'];groups[group].append([p['x'],p['z']])
world=np.concatenate(groups)
player=np.array([[f['players'][0]['x'],f['players'][0]['z']] for f in frames])
anchorsWorld=np.array([player[0],[-178.7786,-522.23975]])
anchorsMap=registered([[219,115],[240,182]])
def matrix(v,reflect):
    s,theta,tx,ty=v;c=math.cos(theta);t=math.sin(theta)
    return s*np.array([[c,-t],[t,c]])@np.diag([1,reflect]),np.array([tx,ty])
def residual(v,reflect):
    A,b=matrix(v,reflect);pred=world@A.T+b
    dist=tree.query(pred)[0]
    # Broad user-trace constraints pick the correct place and direction, not individual rail pixels.
    anchors=(anchorsWorld@A.T+b-anchorsMap).ravel()*.5
    return np.r_[dist,anchors]
fits=[]
for reflect in [-1,1]:
    w=(anchorsWorld[1]-anchorsWorld[0])*[1,reflect];p=anchorsMap[1]-anchorsMap[0]
    scale=np.linalg.norm(p)/np.linalg.norm(w);angle=math.atan2(p[1],p[0])-math.atan2(w[1],w[0])
    for ds in [.8,1,1.2]:
        for da in [-.2,0,.2]:
            A,_=matrix([scale*ds,angle+da,0,0],reflect);b=anchorsMap[0]-A@anchorsWorld[0]
            initial=[scale*ds,angle+da,*b]
            fit=least_squares(residual,initial,args=(reflect,),diff_step=1e-4,max_nfev=220,loss='soft_l1',f_scale=4,
                bounds=([scale*.5,angle-.8,b[0]-500,b[1]-500],[scale*1.6,angle+.8,b[0]+500,b[1]+500]))
            fits.append((np.mean(residual(fit.x,reflect)**2),fit.x,reflect))
fits.sort(key=lambda x:x[0]);score,params,reflect=fits[0];A,b=matrix(params,reflect)
pred=world@A.T+b;dist=tree.query(pred)[0]
result=dict(screenshotTransform=H.tolist(),screenshotInliers=int(inliers.sum()),matrix=A.tolist(),offset=b.tolist(),
            fitScore=score,railPixelMedian=float(np.median(dist)),railPixel95=float(np.quantile(dist,.95)),
            alternatives=[dict(score=float(s),parameters=v.tolist(),reflect=r) for s,v,r in fits[:5]])
(out/'recording-fit.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result),flush=True)
canvas=full.copy()
for g,color in zip(groups,[(60,60,255),(0,255,80),(0,220,255)]):
    pts=np.asarray(g)@A.T+b
    for x,y in pts:cv2.circle(canvas,(round(x),round(y)),3,color,-1)
pts=player@A.T+b
cv2.polylines(canvas,[pts.astype(np.int32)],False,(255,255,0),5)
cv2.imwrite(str(out/'recording-fit-overlay.png'),canvas)
