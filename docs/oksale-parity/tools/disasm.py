#!/usr/bin/env python3
"""OkSale.exe 함수 어셈블리 + 문자열·임포트 주석. 사용: disasm.py <주소hex> [크기]"""
import sys,struct,pefile
from capstone import Cs,CS_ARCH_X86,CS_MODE_32
EXE='/Users/justinsm1max/Desktop/동산화스너/오케이세일/OkSale.exe'
pe=pefile.PE(EXE); base=pe.OPTIONAL_HEADER.ImageBase
iat={}
for e in getattr(pe,'DIRECTORY_ENTRY_IMPORT',[]):
    for i in e.imports:
        iat[i.address]=(i.name or b'#%d'%i.ordinal).decode()
def rd(va,n):
    try: return pe.get_data(va-base,n)
    except Exception: return b''
def s16(va):
    b=rd(va,200); out=''
    for i in range(0,len(b)-1,2):
        c=struct.unpack('<H',b[i:i+2])[0]
        if c==0: break
        out+=chr(c)
    return out
def ann(va):
    b=rd(va,2)
    if len(b)<2: return ''
    t=s16(va)
    if t and sum(1 for ch in t if ch.isprintable() or '가'<=ch<='힣')==len(t) and len(t)>=2: return 'U"%s"'%t[:60]
    a=rd(va,60).split(b'\0')[0]
    try:
        t=a.decode('cp949')
        if len(t)>=3 and t.isprintable(): return 'A"%s"'%t[:60]
    except Exception: pass
    return ''
if __name__=='__main__':
    a=int(sys.argv[1],16); n=int(sys.argv[2]) if len(sys.argv)>2 else 400
    a=a if a>=base else a+base if a<0x10000000 and False else a
    md=Cs(CS_ARCH_X86,CS_MODE_32)
    for ins in md.disasm(rd(a,n),a):
        note=''
        if ins.mnemonic in('push','mov','lea') :
            for tok in ins.op_str.replace(',',' ').replace('[',' ').replace(']',' ').split():
                try: v=int(tok,16) if tok.startswith('0x') else 0
                except ValueError: v=0
                if 0x400000<=v<0x1000000: note=ann(v) or note
        if ins.mnemonic=='call':
            t=ins.op_str
            if t.startswith('dword ptr [0x'):
                v=int(t.split('[')[1].rstrip(']'),16); note=iat.get(v,'')
            elif t.startswith('0x'): note='fn_%x'%int(t,16)
        print('%08x  %-6s %-28s %s'%(ins.address,ins.mnemonic,ins.op_str,note))
