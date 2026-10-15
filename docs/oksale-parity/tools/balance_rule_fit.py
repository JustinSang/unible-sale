import csv,subprocess,io,os,collections,glob,numpy as np,sys
os.environ['MDB_JET3_CHARSET']='cp949'
def ex(f,t): return list(csv.DictReader(io.StringIO(subprocess.run(['mdb-export',f,t],capture_output=True,text=True).stdout)))
FL=('Total','Receipt','Payment','Discount','Tax')
rows=[];y=[];feats=set();cells=[]
for f in sorted(glob.glob('S[0-9][0-9].mdb')):
    b=ex(f,'Balance'); s=ex(f,'SlipHeader')
    if not b or not s: continue
    agg=collections.defaultdict(float)
    for x in s:
        m=int(x['SlipDate'][5:7])
        for fl in FL:
            agg[(x['CustomerID'],m,x['SlipKind']+':'+fl)]+=float(x[fl] or 0)
            feats.add(x['SlipKind']+':'+fl)
    for r in b:
        for m in range(1,13):
            cells.append((f,r['CustomerID'],m,agg,float(r['AC%02d'%m] or 0)))
feats=sorted(feats);print(len(cells),len(feats))
A=np.array([[c[3].get((c[1],c[2],k),0) for k in feats] for c in cells]);y=np.array([c[4] for c in cells])
coef,res,rk,_=np.linalg.lstsq(A,y,rcond=None)
pred=A@coef;print('최대잔차',abs(pred-y).max(),'rank',rk)
for k,c in zip(feats,coef):
    if abs(c)>0.01: print(k,round(c,4))
print('--- 변형 비교(불일치 셀 수/전체)')
def test(coefs):
    bad=0
    for c in cells:
        p=sum(g*c[3].get((c[1],c[2],k),0) for k,g in coefs.items())
        bad+=abs(p-c[4])>1
    return bad
base={'1:Total':1,'2:Total':-1,'3:Total':-1}
print('A 1-2-3',test(base))
print('B 1만',test({'1:Total':1}))
print('C 1-2',test({'1:Total':1,'2:Total':-1}))
print('D +수금',test({**base,'1:Receipt':-1,'2:Payment':1}))
print('E 1+2',test({'1:Total':1,'2:Total':1}))
nz=sum(1 for c in cells if c[4]!=0);print('비영 셀',nz)
print('--- 파일별 D식 불일치')
D={**base,'1:Receipt':-1,'2:Payment':1}
pf=collections.defaultdict(lambda:[0,0]);kinds_bad=collections.Counter()
for c in cells:
    p=sum(g*c[3].get((c[1],c[2],k),0) for k,g in D.items())
    if c[4]!=0 or p!=0:
        pf[c[0]][1]+=1
        if abs(p-c[4])>1:
            pf[c[0]][0]+=1
            for k in {kk.split(':')[0] for (cc,mm,kk) in c[3] if cc==c[1] and mm==c[2]}: kinds_bad[k]+=1
for f,v in pf.items(): print(f,v)
print(kinds_bad)
print('--- 잔여 불일치')
for c in cells:
    if c[0] in ('S11.mdb','S12.mdb','S19.mdb','S20.mdb','S21.mdb','S22.mdb','S23.mdb'):
        p=sum(g*c[3].get((c[1],c[2],k),0) for k,g in D.items())
        if abs(p-c[4])>1:
            ks={kk:v for (cc,mm,kk),v in c[3].items() if cc==c[1] and mm==c[2] and v}
            print(c[0],c[1],c[2],'원본AC',c[4],'식',p,ks)
print('--- 최종식 F(9·0 포함)')
F={**D,'9:Receipt':-1,'0:Payment':1}
pf=collections.defaultdict(lambda:[0,0])
for c in cells:
    p=sum(g*c[3].get((c[1],c[2],k),0) for k,g in F.items())
    if c[4]!=0 or p!=0:
        pf[c[0]][1]+=1; pf[c[0]][0]+=abs(p-c[4])>1
tb=sum(v[0] for v in pf.values());tt=sum(v[1] for v in pf.values())
print({f:v for f,v in pf.items() if f in('S05.mdb','S06.mdb','S07.mdb')},'전체',tb,tt)
