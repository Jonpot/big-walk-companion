exec(open('scripts/fit-all-engines.py').read().split('res=[]')[0])
results=[]
for s in [.8,.9,1,1.1]:
 for dy in [0,60,120]:
  for dx in [-40,0,40]:
   def fun(v):return distances(W@np.array([[v[0],v[1]],[v[1],-v[0]]]).T+v[2:])
   aa=A*s;bb=np.array([2400,2900])+(b-np.array([2400,2900]))*s+[dx,dy]
   fit=least_squares(fun,[aa[0,0],aa[0,1],*bb],diff_step=1e-4,max_nfev=300,bounds=([1.4,1.4,2300,200],[2.5,2.5,3000,1200]))
   e=fun(fit.x);results.append(dict(v=fit.x.tolist(),rms=float(np.sqrt(np.mean(e*e))),max=float(e.max())))
results.sort(key=lambda r:r['rms']);print(results[:5]);(R/'data/alignment/multistart.json').write_text(json.dumps(results,indent=2))
v=results[0]['v'];a=np.array([[v[0],v[1]],[v[1],-v[0]]]);b=v[2:];im=cv2.imread(str(R/'data/map-candidates/PaperMapSaved-270.png'))
for g,c in enumerate([(70,70,255),(50,255,100),(0,220,255)]):
 p=w[:,g]@a.T+b;print(g,float(distances(p).max()));cv2.polylines(im,[p.astype(np.int32)],False,c,3)
p=np.array([[v['players'][0][k] for k in ['x','z']] for v in f])@a.T+b;cv2.polylines(im,[p.astype(np.int32)],False,(255,255,0),4)
cv2.imwrite(str(R/'data/alignment/multi-closeup.png'),im[1050:1480,1120:1500])
