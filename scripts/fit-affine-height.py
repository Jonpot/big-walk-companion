exec(open('scripts/fit-height.py').read().split('results=[]')[0])
start=json.loads((R/'data/alignment/height-fits.json').read_text())[0];a=np.array(start['matrix']);b=start['offset']
def fun(v):return distances(W3@v[:6].reshape(2,3).T+v[6:])
fit=least_squares(fun,np.r_[a.ravel(),b],diff_step=1e-5,max_nfev=1500)
a=fit.x[:6].reshape(2,3);b=fit.x[6:];e=fun(fit.x)
r=dict(matrix=a.tolist(),offset=b.tolist(),mean=float(e.mean()),max=float(e.max()),p95=float(np.quantile(e,.95)));print(r)
(R/'data/alignment/affine-height-fit.json').write_text(json.dumps(r,indent=2))
im=cv2.imread(str(R/'data/map-candidates/PaperMapSaved-270.png'))
for g,c in enumerate([(70,70,255),(50,255,100),(0,220,255)]):
 p=W3.reshape(-1,3,3)[:,g]@a.T+b
 cv2.polylines(im,[p.astype(np.int32)],False,c,3)
p=np.array([[v['players'][0][k] for k in ['x','z','y']] for v in f])@a.T+b;cv2.polylines(im,[p.astype(np.int32)],False,(255,255,0),4)
cv2.imwrite(str(R/'data/alignment/height-overlay.png'),im);cv2.imwrite(str(R/'data/alignment/height-closeup.png'),im[1050:1480,1120:1500])
