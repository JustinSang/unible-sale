#!/usr/bin/env python3
"""직접 call(E8)·jmp(E9) 호출자 찾기. 사용: xref.py <주소hex>..."""
import sys,json,struct,bisect,pefile
pe=pefile.PE('/Users/justinsm1max/Desktop/동산화스너/오케이세일/OkSale.exe'); base=pe.OPTIONAL_HEADER.ImageBase
sec=[s for s in pe.sections if s.Characteristics&0x20000000]
fa=sorted(int(json.loads(l)['addr'],16) for l in open('/Users/justinsm1max/Desktop/unible_harness/docs/analysis_rea/oksale/ghidra/functions.jsonl'))
tg={int(a,16) for a in sys.argv[1:]}
for s in sec:
    d=s.get_data(); va0=base+s.VirtualAddress
    i=d.find(b'\xe8')
    while i!=-1:
        if i+5<=len(d):
            t=(va0+i+5+struct.unpack('<i',d[i+1:i+5])[0])&0xffffffff
            if t in tg:
                c=va0+i; k=bisect.bisect_right(fa,c)-1
                print('%x <- %x (함수 %08x)'%(t,c,fa[k]))
        i=d.find(b'\xe8',i+1)
