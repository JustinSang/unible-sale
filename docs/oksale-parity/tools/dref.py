#!/usr/bin/env python3
"""주소를 4바이트 값으로 담은 위치(vtable·이벤트표) 찾기. 사용: dref.py <주소hex>.."""
import sys,struct,pefile
pe=pefile.PE('/Users/justinsm1max/Desktop/동산화스너/오케이세일/OkSale.exe'); base=pe.OPTIONAL_HEADER.ImageBase
for a in sys.argv[1:]:
    pat=struct.pack('<I',int(a,16))
    for s in pe.sections:
        d=s.get_data(); i=d.find(pat)
        while i!=-1:
            print(a,'@ %08x'%(base+s.VirtualAddress+i),s.Name.rstrip(b'\0').decode(),d[i-8:i+12].hex()); i=d.find(pat,i+1)
