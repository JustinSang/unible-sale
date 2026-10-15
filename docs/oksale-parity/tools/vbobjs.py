#!/usr/bin/env python3
"""VB5/6 객체표 → 객체별 메서드 주소표(JSON)"""
import pefile,struct,json
pe=pefile.PE('/Users/justinsm1max/Desktop/동산화스너/오케이세일/OkSale.exe'); b=pe.OPTIONAL_HEADER.ImageBase
rd=lambda va,n: pe.get_data(va-b,n)
u=lambda va,n=1: struct.unpack('<%dI'%n,rd(va,4*n))
def cstr(va):
    return rd(va,80).split(b'\0')[0].decode('cp949','replace') if va else ''
ot=0x43c2a8; arr=u(ot+0x30)[0]; cnt=struct.unpack('<H',rd(ot+0x2A,2))[0]
out=[]
for i in range(cnt):
    d=u(arr+i*0x30,12)
    info,name,mc,mn=d[0],d[6],d[7],d[8]
    o={'idx':i,'name':cstr(name),'type':hex(d[10]),'methods':[]}
    if info:
        oi=u(info,12); n=struct.unpack('<H',rd(info+0x20,2))[0]; lm=oi[9]
        names=[cstr(x) for x in u(mn,mc)] if mc and mn else []
        for k in range(n):
            a=u(lm+4*k)[0]
            o['methods'].append({'name':names[k] if k<len(names) else '', 'addr':'%08x'%a})
    out.append(o)
json.dump(out,open('/Users/justinsm1max/Desktop/unible_harness/docs/analysis_rea/oksale/vb_objects.json','w'),ensure_ascii=False,indent=1)
for o in out[:6]: print(o['idx'],o['name'],o['type'],len(o['methods']),o['methods'][:3])
print(sum(len(o['methods']) for o in out))
