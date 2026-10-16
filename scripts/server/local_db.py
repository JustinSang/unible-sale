#!/usr/bin/env python3
"""UNIBLE SALE 로컬 DB 서버 — Supabase(PostgREST) 호환 일부 + «디스크에 영구 저장».
왜 필요한가: 개발용 가짜 서버(scripts/dev/mock_supabase.py)는 메모리에만 저장해서 꺼지면 입력한 전표가 사라진다. 운영 Supabase가 준비되기 전까지 동산화스너가 실제로 쓰려면 «꺼져도 남는» 저장소가 필요하다.
저장: SQLite(WAL, synchronous=FULL) 한 파일 data/live/unible_live.sqlite — 쓰기마다 즉시 커밋. 시작 때·6시간마다 data/live/backups/ 에 일관된 백업본(sqlite 백업 API)을 만들고 최근 40개만 남긴다.
처음 켤 때 저장소가 비어 있으면 data/db.json + data/prices.json 으로 채운다(이미 있으면 절대 덮어쓰지 않는다).
사용: python3 scripts/server/local_db.py [--port 54321]      내보내기: python3 scripts/server/local_db.py --export 파일.json
한계(정직): 한 대 컴퓨터의 파일이라 그 컴퓨터가 망가지면 같이 사라진다 → 백업본을 다른 곳(구글 드라이브)에도 복사할 것. 동시 사용자는 소수(락 하나로 직렬 처리). 조인·집계·권한(RLS)은 없다 — 접속은 이 컴퓨터(127.0.0.1)로만 받는다.
지원: GET(eq·neq·gt·gte·lt·lte·in·like·ilike·is 필터, order, limit/offset, Range 머리글, count, single 객체 응답)·HEAD·POST(삽입·upsert)·PATCH·DELETE(조건 없는 삭제는 거부)."""
import json, os, re, sqlite3, sys, threading, time, glob, shutil
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LIVE = os.environ.get('UNIBLE_LIVE_DIR') or os.path.join(ROOT, 'data', 'live')  # 시험할 때만 다른 폴더를 가리킨다
DB_PATH = os.path.join(LIVE, 'unible_live.sqlite')
BACKUPS = os.path.join(LIVE, 'backups')
LOCK = threading.RLock()
KEYS = {'customer_prices': ('customerId', 'productId')}  # 나머지 표는 id
TABLE_FROM_JSON = {'products': 'products', 'customers': 'customers', 'slips': 'slips', 'deliveries': 'deliveries', 'bills': 'bills', 'collections': 'collections',
                   'taxInvoices': 'tax_invoices', 'inventoryLogs': 'inventory_logs', 'midongOrders': 'midong_orders'}
T = {}      # 표 이름 → {키: 행}
con = None


def key_of(table, row):
    cols = KEYS.get(table, ('id',))
    return '|'.join(str(row.get(c, '')) for c in cols)


def open_db():
    global con
    os.makedirs(BACKUPS, exist_ok=True)
    con = sqlite3.connect(DB_PATH, check_same_thread=False, isolation_level=None)
    con.execute('PRAGMA journal_mode=WAL'); con.execute('PRAGMA synchronous=FULL')
    con.execute('CREATE TABLE IF NOT EXISTS rows (tbl TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL, PRIMARY KEY (tbl, k))')
    n = con.execute('SELECT COUNT(*) FROM rows').fetchone()[0]
    if n == 0:
        seed_from_json()
    for tbl, k, v in con.execute('SELECT tbl, k, v FROM rows'):
        T.setdefault(tbl, {})[k] = json.loads(v)
    for t in list(TABLE_FROM_JSON.values()) + ['customer_prices', 'system_config', 'audit_log']:
        T.setdefault(t, {})


def seed_from_json():
    """저장소가 비어 있을 때만: data/db.json·prices.json 에서 채운다."""
    d = json.load(open(os.path.join(ROOT, 'data', 'db.json'), encoding='utf-8'))
    p = json.load(open(os.path.join(ROOT, 'data', 'prices.json'), encoding='utf-8')) if os.path.exists(os.path.join(ROOT, 'data', 'prices.json')) else {}
    con.execute('BEGIN')
    for jk, tbl in TABLE_FROM_JSON.items():
        for r in d.get(jk, []):
            if 'id' not in r: raise SystemExit(f'{tbl}에 id 없는 행이 있어 가져올 수 없습니다: {str(r)[:80]}')
            con.execute('INSERT OR REPLACE INTO rows VALUES (?,?,?)', (tbl, key_of(tbl, r), json.dumps(r, ensure_ascii=False)))
    for cid, m in p.items():
        for pid, v in m.items():
            r = {'customerId': cid, 'productId': pid, **v}
            con.execute('INSERT OR REPLACE INTO rows VALUES (?,?,?)', ('customer_prices', key_of('customer_prices', r), json.dumps(r, ensure_ascii=False)))
    cfg = {'id': 'default', 'config': d.get('config', {})}
    con.execute('INSERT OR REPLACE INTO rows VALUES (?,?,?)', ('system_config', 'default', json.dumps(cfg, ensure_ascii=False)))
    con.execute('COMMIT')
    print('저장소가 비어 있어 data/db.json 으로 채웠습니다.', flush=True)


def persist_put(table, row):
    con.execute('INSERT OR REPLACE INTO rows VALUES (?,?,?)', (table, key_of(table, row), json.dumps(row, ensure_ascii=False)))


def backup_now(tag=''):
    name = os.path.join(BACKUPS, time.strftime('unible_%Y%m%d_%H%M%S') + tag + '.sqlite')
    with LOCK:
        dst = sqlite3.connect(name)
        con.backup(dst); dst.close()
    for old in sorted(glob.glob(os.path.join(BACKUPS, 'unible_*.sqlite')))[:-40]:
        os.remove(old)
    return name


def backup_loop():
    while True:
        time.sleep(6 * 3600)
        try: print('백업', backup_now(), flush=True)
        except Exception as e: print('백업 실패', e, flush=True)


def export_json(path):
    out = {v: [] for v in TABLE_FROM_JSON.values()}
    for tbl, rows in T.items():
        if tbl in ('customer_prices', 'system_config'): continue
        out[tbl] = list(rows.values())
    inv = {v: k for k, v in TABLE_FROM_JSON.items()}
    d = {inv.get(t, t): rows for t, rows in out.items()}
    d['config'] = (T['system_config'].get('default') or {}).get('config', {})
    prices = {}
    for r in T['customer_prices'].values():
        prices.setdefault(r['customerId'], {})[r['productId']] = {k: v for k, v in r.items() if k not in ('customerId', 'productId')}
    json.dump({'db': d, 'prices': prices}, open(path, 'w', encoding='utf-8'), ensure_ascii=False)
    print('내보냄:', path)


# ───────── 필터 ─────────
def coerce(a, b):
    if isinstance(a, bool): return str(a).lower() == str(b).lower()
    if isinstance(a, (int, float)):
        try: return float(a) == float(b)
        except ValueError: return False
    return str(a) == str(b)


def num(x):
    try: return float(x)
    except (TypeError, ValueError): return None


def match(row, col, expr):
    op, _, val = expr.partition('.')
    v = row.get(col)
    if op == 'eq': return coerce(v, val) if v is not None else val == 'null'
    if op == 'neq': return not (coerce(v, val) if v is not None else val == 'null')
    if op == 'is': return (v is None) if val == 'null' else (str(v).lower() == val)
    if op == 'in': return any(coerce(v, x.strip('"')) for x in re.split(r',(?=(?:[^"]*"[^"]*")*[^"]*$)', val.strip('()'))) if v is not None else False
    if op in ('gt', 'gte', 'lt', 'lte'):
        a, b = (num(v), num(val)) if num(v) is not None and num(val) is not None else (str(v), val)
        return {'gt': a > b, 'gte': a >= b, 'lt': a < b, 'lte': a <= b}[op]
    if op in ('like', 'ilike'):
        rx = '^' + re.escape(val).replace('%', '.*').replace('_', '.') + '$'
        return re.match(rx, str(v if v is not None else ''), re.I if op == 'ilike' else 0) is not None
    return True


def filtered(table, q):
    rows = list(T.setdefault(table, {}).values())
    for col, vals in q.items():
        if col in ('select', 'order', 'limit', 'offset', 'on_conflict', 'columns'): continue
        for expr in vals: rows = [r for r in rows if match(r, col, expr)]
    return rows


def has_filter(q):
    return any(c not in ('select', 'order', 'limit', 'offset', 'on_conflict', 'columns') for c in q)


class H(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def log_message(s, *a): pass

    def _send(s, code, body=b'', ctype='application/json', extra=None):
        s.send_response(code)
        s.send_header('Content-Type', ctype); s.send_header('Content-Length', str(len(body)))
        for k, v in (extra or {}).items(): s.send_header(k, v)
        s.end_headers()
        if s.command != 'HEAD' and body: s.wfile.write(body)

    def _err(s, code, msg, pg=''):
        s._send(code, json.dumps({'code': pg, 'message': msg, 'details': None, 'hint': None}, ensure_ascii=False).encode())

    def _parts(s):
        u = urlparse(s.path); table = u.path.rstrip('/').split('/')[-1]
        return table, parse_qs(u.query, keep_blank_values=True)

    def _read(s):
        n = int(s.headers.get('Content-Length') or 0)
        return json.loads(s.rfile.read(n) or b'{}') if n else {}

    def do_GET(s): s._get(False)
    def do_HEAD(s): s._get(True)

    def _get(s, head):
        table, q = s._parts()
        with LOCK:
            rows = filtered(table, q)
            for o in q.get('order', [])[:1]:
                col, _, d = o.partition('.')
                rows.sort(key=lambda r: (r.get(col) is None, r.get(col) if isinstance(r.get(col), (int, float)) else str(r.get(col, ''))), reverse=(d == 'desc'))
            total = len(rows)
            a, b = 0, total - 1
            if 'offset' in q: a = int(q['offset'][0])
            if 'limit' in q: b = min(a + int(q['limit'][0]) - 1, total - 1)
            rng = s.headers.get('Range')
            if rng and '-' in rng:
                x, y = rng.split('-')[:2]
                if x.isdigit(): a = int(x); b = min(int(y), total - 1) if y.isdigit() else total - 1
            page = rows[a:b + 1] if total else []
            cr = f'{a}-{b}/{total}' if total else f'*/{total}'
            if 'application/vnd.pgrst.object+json' in (s.headers.get('Accept') or ''):
                if len(page) != 1: return s._err(406, 'JSON object requested, multiple (or no) rows returned', 'PGRST116')
                return s._send(200, json.dumps(page[0], ensure_ascii=False).encode(), extra={'Content-Range': cr})
            s._send(200 if (a == 0 and b >= total - 1) else 206, b'' if head else json.dumps(page, ensure_ascii=False).encode(), extra={'Content-Range': cr})

    def do_POST(s):
        table, q = s._parts(); body = s._read(); prefer = s.headers.get('Prefer') or ''
        items = body if isinstance(body, list) else [body]
        with LOCK:
            tbl = T.setdefault(table, {}); plan = {}
            try:
                for it in items:
                    if not all(c in it for c in KEYS.get(table, ('id',))): return s._err(400, '기본키(id) 없는 행입니다.')
                    k = key_of(table, it); base = plan.get(k) or tbl.get(k)
                    if base is not None and 'resolution=merge-duplicates' in prefer: plan[k] = {**base, **it}
                    elif base is not None and 'resolution=ignore-duplicates' in prefer: continue
                    elif base is not None: return s._err(409, f'duplicate key value violates unique constraint ({k})', '23505')
                    else: plan[k] = it
                con.execute('BEGIN')
                for k, row in plan.items(): persist_put(table, row)   # 먼저 디스크에 커밋하고
                con.execute('COMMIT')
            except Exception as e:
                try: con.execute('ROLLBACK')
                except Exception: pass
                return s._err(500, f'저장 실패: {e}')
            tbl.update(plan)                                           # 성공한 뒤에만 메모리에 반영
        if 'return=representation' in prefer: return s._send(201, json.dumps(list(plan.values()), ensure_ascii=False).encode())
        s._send(201)

    def do_PATCH(s):
        table, q = s._parts(); body = s._read()
        if not has_filter(q): return s._err(400, '조건 없는 수정은 허용하지 않습니다.')
        with LOCK:
            hit = filtered(table, q)
            try:
                con.execute('BEGIN')
                for r in hit: persist_put(table, {**r, **body})
                con.execute('COMMIT')
            except Exception as e:
                try: con.execute('ROLLBACK')
                except Exception: pass
                return s._err(500, f'저장 실패: {e}')
            for r in hit: r.update(body)
        if 'return=representation' in (s.headers.get('Prefer') or ''): return s._send(200, json.dumps(hit, ensure_ascii=False).encode())
        s._send(204)

    def do_DELETE(s):
        table, q = s._parts()
        if not has_filter(q): return s._err(400, '조건 없는 삭제는 허용하지 않습니다.')
        with LOCK:
            hit = filtered(table, q)
            try:
                con.execute('BEGIN')
                for r in hit: con.execute('DELETE FROM rows WHERE tbl=? AND k=?', (table, key_of(table, r)))
                con.execute('COMMIT')
            except Exception as e:
                try: con.execute('ROLLBACK')
                except Exception: pass
                return s._err(500, f'저장 실패: {e}')
            for r in hit: T[table].pop(key_of(table, r), None)
        s._send(204)

    def do_OPTIONS(s): s._send(204)


def main():
    args = sys.argv[1:]
    port = int(args[args.index('--port') + 1]) if '--port' in args else 54321
    open_db()
    if '--export' in args:
        export_json(args[args.index('--export') + 1]); return
    print('시작 백업', backup_now('_start'), flush=True)
    threading.Thread(target=backup_loop, daemon=True).start()
    n = sum(len(v) for v in T.values())
    print(f'UNIBLE 로컬 DB 서버 127.0.0.1:{port} — 표 {len(T)}개·행 {n:,}개, 저장 {DB_PATH}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()


if __name__ == '__main__':
    main()
