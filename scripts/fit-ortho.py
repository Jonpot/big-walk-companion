exec(open('scripts/fit-height.py').read().split('results=[]')[0])
results=[]
# Orthographic camera: horizontal axis diagonal in XZ; height shifts vertically.
for sy in [1.6,1.9,2.2]:
 for h in [-3,-1,0]:
  def mat(v):return np.array([[v[0],v[0],0],[v[1],-v[1],v[2]]]),v[3:]
  def fun(v):
   a,b=mat(v);return distances(W3@a.T+b)
  fit=least_squares(fun,[1.93,sy,h,2670,600-h*50],diff_step=1e-4,max_nfev=700,bounds=([1.4,1.4,-4,2400,250],[2.4,2.4,0,2850,1000]))
  a,b=mat(fit.x);e=fun(fit.x);results.append(dict(matrix=a.tolist(),offset=list(b),mean=float(e.mean()),max=float(e.max()),p95=float(np.quantile(e,.95)),rms=float(np.sqrt(np.mean(e*e)))))
results.sort(key=lambda r:r['rms']);print(json.dumps(results[:3]));(R/'data/alignment/orthographic-fits.json').write_text(json.dumps(results,indent=2))
a=np.array(results[0]['matrix']);b=np.array(results[0]['offset']);im=cv2.imread(str(R/'data/map-candidates/PaperMapSaved-270.png'))
for g,c in enumerate([(70,70,255),(50,255,100),(0,220,255)]):
 p=W3.reshape(-1,3,3)[:,g]@a.T+b;print(g, float(distances(p).max()));cv2.polylines(im,[p.astype(np.int32)],False,c,3)
p=np.array([[v['players'][0][k] for k in ['x','z','y']] for v in f])@a.T+b;cv2.polylines(im,[p.astype(np.int32)],False,(255,255,0),4)
cv2.imwrite(str(R/'data/alignment/ortho-closeup.png'),im[1050:1480,1120:1500])
