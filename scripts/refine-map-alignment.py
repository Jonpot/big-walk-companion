"""Refine the seed fit on visible railway segments and report held-out agreement."""
exec(open(__file__.replace('refine-map-alignment.py','fit-map-alignment.py'),encoding='utf8').read().split('fits=[]')[0])
fit=json.loads((out/'recording-fit.json').read_text())
A=np.array(fit['matrix']);b=np.array(fit['offset'])
initialDist=tree.query(world@A.T+b)[0]
visible=initialDist<12
indices=np.arange(len(world))
train=visible & (indices%4!=0);test=visible & (indices%4==0)
def proj(v,p):
    a,c,tx,ty=v
    return p@np.array([[a,c],[c,-a]]).T+[tx,ty]
def errors(v):return tree.query(proj(v,world[train]))[0]
v0=[A[0,0],A[0,1],b[0],b[1]]
fit2=least_squares(errors,v0,loss='soft_l1',f_scale=1,diff_step=1e-5,max_nfev=500)
a,c,tx,ty=fit2.x
A=np.array([[a,c],[c,-a]]);b=np.array([tx,ty]);allDist=tree.query(proj(fit2.x,world))[0]
holdout=tree.query(proj(fit2.x,world[test]))[0]
result=dict(matrix=A.tolist(),offset=b.tolist(),scale=float(np.hypot(a,c)),angleDegrees=float(np.degrees(np.arctan2(c,a))),
   heldOutMedianPixels=float(np.median(holdout)),heldOut95Pixels=float(np.quantile(holdout,.95)),heldOutCount=int(test.sum()),
   allMedianPixels=float(np.median(allDist)),all95Pixels=float(np.quantile(allDist,.95)),
   visibleFraction=float(visible.mean()),note='2D similarity fit to visible blue track sections. Inferred calibration, not ground-surveyed. Track gaps excluded for refinement.')
anchors=[]
for p in [world[0],world[len(groups[0])],world[len(groups[0])+len(groups[1])]]:
    uv=(A@p+b)/4096
    anchors.append(dict(x=float(p[0]),z=float(p[1]),u=float(uv[0]),v=float(uv[1])))
result['calibration']=anchors
(out/'calibration-fit.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print(json.dumps(result),flush=True)
canvas=full.copy()
for g,color in zip(groups,[(60,60,255),(0,255,80),(0,220,255)]):
    pts=np.asarray(g)@A.T+b
    for x,y in pts:cv2.circle(canvas,(round(x),round(y)),3,color,-1)
pts=player@A.T+b;cv2.polylines(canvas,[pts.astype(np.int32)],False,(255,255,0),5)
cv2.imwrite(str(out/'calibration-overlay.png'),canvas)
