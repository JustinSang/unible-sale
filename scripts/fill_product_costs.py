#!/usr/bin/env python3
"""원본 Data/Master.mdb Products의 PurchasePrice(·PurchaseDate1)로 data/db.json 품목의 비어 있는 매입가를 채운다.
- 이미 값이 있는 칸은 건드리지 않는다. 실행 전 db.json을 db.json.bak_<날짜>로 복사한다(--dry면 쓰기 없음).
- 근거(2026-10-15 실측): 원본 11,319품목 중 PurchasePrice>0 4,714, db.json에서 매입가 0인데 원본에 있는 품목 4,458.
"""
import csv, json, os, shutil, subprocess, sys, datetime
HERE = os.path.dirname(os.path.abspath(__file__)); DB = os.path.join(HERE, '..', 'data', 'db.json')
MDB = os.path.expanduser('~/Desktop/동산화스너/오케이세일/Data/Master.mdb')
out = subprocess.run(['mdb-export', MDB, 'Products'], capture_output=True, text=True, env={**os.environ, 'MDB_JET3_CHARSET': 'cp949'}).stdout
src = {r['ProductID']: r for r in csv.DictReader(out.splitlines())}
d = json.load(open(DB)); n = 0; m = 0
for p in d['products']:
    o = src.get(p['id'].replace('p-', ''))
    if not o: continue
    price = float(o.get('PurchasePrice') or 0)
    if price > 0 and not p.get('costPrice'):
        p['costPrice'] = price
        if not p.get('lastPurchasePrice'): p['lastPurchasePrice'] = price
        if not p.get('lastPurchaseDate') and o.get('PurchaseDate1'): p['lastPurchaseDate'] = o['PurchaseDate1']
        n += 1
    nick = (o.get('NicName') or '').strip()
    if nick and not p.get('nickName'):
        p['nickName'] = nick; m += 1
print(f'채울 품목 {n}, 다른명칭 {m}')
if '--dry' not in sys.argv:
    bak = DB + '.bak_' + datetime.date.today().strftime('%Y%m%d')
    if os.path.exists(bak): bak += datetime.datetime.now().strftime('_%H%M%S')  # 먼저 만든 백업을 덮어쓰지 않는다
    shutil.copy2(DB, bak)
    json.dump(d, open(DB, 'w'), ensure_ascii=False, indent=2); print('저장 완료, 백업', bak)
