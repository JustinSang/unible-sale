"""개발·시험용 가짜 Supabase(PostgREST 일부) — 운영 DB를 건드리지 않고 화면·서버 저장 경로를 시험한다.
사용: python3 scripts/dev/mock_supabase.py   (127.0.0.1:54321, 메모리에만 저장·재시작하면 data/db.json 상태로 되돌아감)
      NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=mock npx next dev --webpack -p 3300
지원: GET(eq 필터·Range)·POST(삽입·upsert)·PATCH·DELETE, system_config. 한계: 조인·정렬·count 정확도 등은 흉내만 낸다.
"""
import json,sys,re,os
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlparse
D=json.load(open(os.path.join(ROOT,'data','db.json')))
P=json.load(open(os.path.join(ROOT,'data','prices.json')))
T={'tax_invoices':D['taxInvoices'],'deliveries':D['deliveries'],'bills':D['bills'],'collections':D['collections'],'inventory_logs':D['inventoryLogs'],'products':D['products'],'customers':D['customers'],'slips':D['slips'],'customer_prices':[]}
for cid,m in P.items():
    for pid,v in m.items(): T['customer_prices'].append({'customerId':cid,'productId':pid,**v})
class H(BaseHTTPRequestHandler):
    def log_message(s,*a):pass
    def do_ANY(s,head):
        t=urlparse(s.path).path.split('/')[-1]
        if t=='system_config':
            b=json.dumps({'config':D['config']}).encode(); s.send_response(200); s.send_header('Content-Type','application/json'); s.send_header('Content-Length',str(len(b))); s.end_headers(); s.wfile.write(b); return
        from urllib.parse import parse_qs
        q=parse_qs(urlparse(s.path).query); rows=T.get(t,[])
        for k,vals in q.items():
            if vals[0].startswith('eq.') and rows and k in rows[0]: rows=[r for r in rows if str(r.get(k))==vals[0][3:]]
        n=len(rows); rng=s.headers.get('Range'); a,b_=0,n-1
        if 'offset' in q: a=int(q['offset'][0]); b_=min(a+int(q.get('limit',['1000'])[0])-1,n-1)
        if rng and '-' in rng: a,e=rng.split('-'); a=int(a); b_=min(int(e),n-1)
        out=[] if head else rows[a:b_+1]
        body=json.dumps(out).encode()
        s.send_response(200 if head else 206); s.send_header('Content-Type','application/json')
        s.send_header('Content-Range', f'*/{n}' if head else f'{a}-{b_}/{n}'); s.send_header('Content-Length',str(len(body))); s.end_headers()
        if not head: s.wfile.write(body)
    def _body(s):
        n=int(s.headers.get('Content-Length') or 0); return json.loads(s.rfile.read(n) or b'{}')
    def _filter(s,rows):
        from urllib.parse import parse_qs
        q=parse_qs(urlparse(s.path).query)
        for k,vals in q.items():
            if vals and vals[0].startswith('eq.'): rows=[r for r in rows if str(r.get(k))==vals[0][3:]]
        return rows
    def _ok(s,code=201):
        s.send_response(code); s.send_header('Content-Length','0'); s.end_headers()
    def do_POST(s):
        t=urlparse(s.path).path.split('/')[-1]; body=s._body()
        if t=='system_config': D['config']=body.get('config',D['config']); return s._ok()
        rows=T.setdefault(t,[]); items=body if isinstance(body,list) else [body]
        for it in items:
            key=('customerId','productId') if t=='customer_prices' else ('id',)
            old=[r for r in rows if all(r.get(k)==it.get(k) for k in key)]
            if old and 'resolution' in (s.headers.get('Prefer') or ''): old[0].update(it)
            else: rows.append(it)
        s._ok()
    def do_PATCH(s):
        t=urlparse(s.path).path.split('/')[-1]; body=s._body()
        for r in s._filter(T.get(t,[])): r.update(body)
        s._ok(204)
    def do_DELETE(s):
        t=urlparse(s.path).path.split('/')[-1]; hit=s._filter(T.get(t,[]))
        T[t]=[r for r in T.get(t,[]) if r not in hit]; s._ok(204)
    def do_GET(s):s.do_ANY(False)
    def do_HEAD(s):s.do_ANY(True)
ThreadingHTTPServer(('127.0.0.1',54321),H).serve_forever()
