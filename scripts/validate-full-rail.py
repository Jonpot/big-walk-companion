exec(open('scripts/fit-full-rail.py',encoding='utf-8-sig').read().split('results=[]')[0])
# Hold out the entire western bend by its connected blue-image component.
component=labels[target[:,1],target[:,0]];train=target[component!=9];test=target[component==9];a=A.copy();off=b.copy();X=dense[:,:2]
for _ in range(200):
 dst,ix=cKDTree(X@a.T+off).query(train);weight=1/np.maximum(1,dst/12);design=np.column_stack([X[ix],np.ones(len(ix))]);coef=np.linalg.lstsq(design*weight[:,None],train*weight[:,None],rcond=None)[0];a,off=coef[:-1].T,coef[-1]
e=cKDTree(X@a.T+off).query(test)[0];print('HELD OUT GREEN BEND',len(test),np.quantile(e,[.5,.95,1]))
r=json.loads((R/'data/alignment/full-rail-fit.json').read_text())[0];aa=np.array(r['matrix']);print('singular scales',np.linalg.svd(aa)[1]);print('x-axis angle',np.degrees(np.arctan2(aa[1,0],aa[0,0])))
(R/'data/alignment/full-rail-validation.json').write_text(json.dumps(dict(heldOutComponent=9,heldOutPixels=len(test),median=float(np.median(e)),p95=float(np.quantile(e,.95)),max=float(e.max()),singularScales=np.linalg.svd(aa)[1].tolist()),indent=2))
