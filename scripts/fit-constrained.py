exec(open('scripts/fit-height.py').read().split('results=[]')[0])
def mat(v):return np.array([[v[0],v[1],0],[v[2],v[3],v[4]]]),v[5:]
def fun(v):
 a,b=mat(v);return distances(W3@a.T+b)
fit=least_squares(fun,[1.93,1.80,1.80,-1.93,-3,2600,715],diff_step=1e-5,max_nfev=1000,bounds=([1.5,1.5,1.5,-2.5,-4,2400,400],[2.5,2.5,2.5,-1.5,0,2900,1000]))
a,b=mat(fit.x);e=fun(fit.x);r=dict(matrix=a.tolist(),offset=list(b),mean=float(e.mean()),max=float(e.max()),p95=float(np.quantile(e,.95)),samples=len(e));print(r);(R/'data/alignment/constrained-height-fit.json').write_text(json.dumps(r,indent=2))
im=cv2.imread(str(R/'data/map-candidates/PaperMapSaved-270.png'))
for g,c in enumerate([(70,70,255),(50,255,100),(0,220,255)]):
 p=W3.reshape(-1,3,3)[:,g]@a.T+b;print(g, float(distances(p).max()));cv2.polylines(im,[p.astype(np.int32)],False,c,3)
p=np.array([[v['players'][0][k] for k in ['x','z','y']] for v in f])@a.T+b;cv2.polylines(im,[p.astype(np.int32)],False,(255,255,0),4)
cv2.imwrite(str(R/'data/alignment/constrained-closeup.png'),im[1050:1480,1120:1500]);cv2.imwrite(str(R/'data/alignment/constrained-overlay.png'),im)
