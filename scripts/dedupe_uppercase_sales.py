#!/usr/bin/env python3
"""이관 데이터의 중복 전표 정리: 대문자 'SALES'(거래원장 엑셀 2차 이관, 전표번호 S20260106-0 꼴) 118건은
같은 전표를 소문자 'sales'(MDB 이관, S2026-8000xx 꼴)가 이미 갖고 있다(고객·일자·합계·품목명·수량 동일, 1:1).
대문자 쪽은 공급가 합계·현장·배송 정보가 비어 있거나 틀려서 소문자를 남기고 대문자를 뺀다.
단, 소문자 품목 단가가 소수 단가를 반올림해 둔 경우(7 ↔ 7.8)는 대문자의 정확한 단가를 소문자 품목에 옮긴다(공급가 같을 때만).
사용: python3 scripts/dedupe_uppercase_sales.py [--apply]   (기본은 모의 실행)
안전: 적용 전 data/db.json.bak_dedupe_<시각> 백업, 빼는 전표 전체를 data/dedupe_removed_<시각>.json에 남긴다(복구 가능)."""
import json, sys, time, collections, shutil
P = 'data/db.json'
apply = '--apply' in sys.argv
d = json.load(open(P, encoding='utf-8'))
S = d['slips']
up = [s for s in S if s['slipType'] == 'SALES']
low = [s for s in S if s['slipType'] != 'SALES']
key = lambda s: (s['customerId'], s['slipDate'], s['totalAmount'], tuple(sorted((i['productName'], i['qty']) for i in s['items'])))
G = collections.defaultdict(lambda: {'up': [], 'lo': []})
for s in up: G[key(s)]['up'].append(s)
for s in low: G[key(s)]['lo'].append(s)
remove, merged, skipped = [], [], []
for k, v in G.items():
    if not v['up']: continue
    if len(v['up']) > len(v['lo']):
        skipped += v['up']; continue  # 짝이 모자라면 건드리지 않는다
    for u, t in zip(v['up'], v['lo']):
        ui = sorted(u['items'], key=lambda i: (i['productName'], i['qty'], i['supplyAmount']))
        ti = sorted(t['items'], key=lambda i: (i['productName'], i['qty'], i['supplyAmount']))
        for a, b in zip(ui, ti):
            if a['unitPrice'] != b['unitPrice'] and a['supplyAmount'] == b['supplyAmount'] and abs(a['unitPrice'] * a['qty'] - a['supplyAmount']) < 1:
                merged.append({'slip': t['slipNo'], 'item': b['productName'], 'old': b['unitPrice'], 'new': a['unitPrice']})
                if apply: b['unitPrice'] = a['unitPrice']
        remove.append({'removed': u, 'keptSlipNo': t['slipNo'], 'keptId': t['id']})
print(f"대문자 {len(up)}건 중 제거 {len(remove)}건, 보류 {len(skipped)}건, 소문자에 옮길 정확한 단가 {len(merged)}건")
if not apply:
    print('(모의 실행 — 적용하려면 --apply)'); sys.exit(0)
ts = time.strftime('%Y%m%d_%H%M%S')
shutil.copy2(P, f'data/db.json.bak_dedupe_{ts}')
json.dump({'when': ts, 'removed': remove, 'unitPriceMerged': merged}, open(f'data/dedupe_removed_{ts}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
ids = {r['removed']['id'] for r in remove}
d['slips'] = [s for s in S if s['id'] not in ids]
d['deliveries'] = [x for x in d['deliveries'] if x['slipId'] not in ids]
json.dump(d, open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('적용 완료. 남은 전표', len(d['slips']), '| 백업', f'data/db.json.bak_dedupe_{ts}', '| 제거 목록', f'data/dedupe_removed_{ts}.json')
open('data/dedupe_ids.txt', 'w').write('\n'.join(sorted(ids)))
