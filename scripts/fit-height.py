exec(open('scripts/fit-all-engines.py').read().split('res=[]')[0])
W3=np.array([[list(next(t for t in a['trains'] if not t['hasCable'])['cars'][i]['bodyPosition'][k] for k in ['x','z','y']) for i in [0,5,10]] for a in f]).reshape(-1,3)
results=[]
for tilt in [-4,-2,0,2,4]:
 def mat(v):return np.array([[v[0],v[1],v[2]],[v[1],-v[0],v[3]]]),v[4:]
 def fun(v):
  a,b=mat(v);return distances(W3@a.T+b)
 fit=least_squares(fun,[1.93,1.93,0,tilt,2670,600-tilt*50],diff_step=1e-4,max_nfev=1000,bounds=([1,1,-5,-5,2200,0],[3,3,5,5,3100,1100]))
 a,b=mat(fit.x);e=fun(fit.x);r=dict(matrix=a.tolist(),offset=list(b),mean=float(e.mean()),max=float(e.max()),p95=float(np.quantile(e,.95)));results.append(r);print(r,flush=True)
(R/'data/alignment/height-fits.json').write_text(json.dumps(results,indent=2))
