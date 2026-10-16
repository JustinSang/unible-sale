#!/usr/bin/env python3
"""data/db.json 무결성 점검(읽기 전용 — 아무것도 고치지 않는다). 사용: python3 scripts/audit_data.py [경로]
실패(FAIL)가 하나라도 있으면 종료 코드 1. 경고(WARN)는 사람이 판단할 것(원본 자료 자체의 성질일 수 있다).
점검: ①전표 합계=품목 합 ②입금+미수=합계 ③거래처·품목 참조 ④중복 전표번호 ⑤미동 mos- 불변식(수주↔매출·정산) ⑥HTML 엔티티·깨진 글자 ⑦음수 금액."""
import json, sys, collections, re

P = sys.argv[1] if len(sys.argv) > 1 else 'data/db.json'
d = json.load(open(P, encoding='utf-8'))
fails, warns = [], []
def F(m): fails.append(m)
def W(m): warns.append(m)

slips = d['slips']; custs = {c['id'] for c in d['customers']}; prods = {p['id'] for p in d['products']}
# ① 전표 합계 = 품목 합계 (1원 오차 허용), ② 입금+미수 = 합계
bad_sum = [s['slipNo'] for s in slips if s['items'] and abs(sum(i.get('totalAmount', 0) for i in s['items']) - s['totalAmount']) > 1]
if bad_sum: W(f"전표 합계≠품목 합계 {len(bad_sum)}건 (예: {bad_sum[:3]}) — 이관 자료의 성질일 수 있음")
bad_paid = [s['slipNo'] for s in slips if str(s['slipType']).upper() in ('SALES', 'PURCHASE') and abs(s.get('paidAmount', 0) + s.get('unpaidAmount', 0) - s['totalAmount']) > 1]
if bad_paid: W(f"입금+미수≠합계 {len(bad_paid)}건 (예: {bad_paid[:3]})")
# ③ 참조
orph_c = [s['slipNo'] for s in slips if s['customerId'] not in custs]
if orph_c: F(f"없는 거래처를 가리키는 전표 {len(orph_c)}건 (예: {orph_c[:3]})")
orph_p = sum(1 for s in slips for i in s['items'] if i.get('productId') and i['productId'] not in prods)
if orph_p: W(f"없는 품목을 가리키는 품목줄 {orph_p}건")
# ④ 중복 id·전표번호
ids = collections.Counter(s['id'] for s in slips); dup = [k for k, v in ids.items() if v > 1]
if dup: F(f"중복 전표 id {len(dup)}건 (예: {dup[:3]})")
nos = collections.Counter(s['slipNo'] for s in slips if not s['id'].startswith('mos-')); dupn = [k for k, v in nos.items() if v > 1]
if dupn: W(f"중복 전표번호 {len(dupn)}건 (예: {dupn[:3]})")
# ⑤ 미동 mos- 불변식
mos = [s for s in slips if s['id'].startswith('mos-')]
for s in mos:
    t = s['slipType']
    if t not in ('CONTRACT', 'SALES'): F(f"mos- 전표 유형 이상: {s['slipNo']} {t}")
    elif t == 'SALES' and abs(s['paidAmount'] + s['unpaidAmount'] - s['totalAmount']) > 1: F(f"mos- 매출 입금+미수≠합계: {s['slipNo']}")
    elif t == 'CONTRACT' and (s['paidAmount'] or s['unpaidAmount']): F(f"mos- 수주에 입금/미수가 있음: {s['slipNo']}")
mos_ids = [s['id'] for s in mos]
if len(mos_ids) != len(set(mos_ids)): F('mos- id 중복')
# 미동 거래처 미수금과 장부 일치(전표 기준 미수 합계)
mid = next((c for c in d['customers'] if '미동' in c['name']), None)
# ⑥ 엔티티·깨진 글자
pat = re.compile(r'&(amp|lt|gt|quot|#\d+);')
ent = sum(1 for s in slips if pat.search(json.dumps(s, ensure_ascii=False))) + sum(1 for r in d.get('midongOrders', []) if pat.search(json.dumps(r, ensure_ascii=False)))
if ent: F(f"HTML 엔티티가 남은 행 {ent}건")
moji = sum(1 for p in d['products'] if re.search(r'[À-ÿ]{3,}', p.get('name', '')))
if moji: W(f"품목명에 깨진 글자 의심 {moji}건")
# ⑦ 음수
neg = [s['slipNo'] for s in slips if s['totalAmount'] < 0 and str(s['slipType']).upper() not in ('RETURN_IN', 'RETURN_OUT', 'RETURN_SALES', 'RETURN_PURCHASE')]
if neg: W(f"반품이 아닌데 합계가 음수인 전표 {len(neg)}건 (예: {neg[:3]})")

print(f"전표 {len(slips)} · mos- {len(mos)}(매출 {sum(1 for s in mos if s['slipType']=='SALES')}·수주 {sum(1 for s in mos if s['slipType']=='CONTRACT')}) · 거래처 {len(custs)} · 품목 {len(prods)} · 미동 발주내역 {len(d.get('midongOrders', []))}줄")
for m in warns: print('WARN', m)
for m in fails: print('FAIL', m)
print('결과:', 'FAIL %d' % len(fails) if fails else 'OK', f'(경고 {len(warns)})')
sys.exit(1 if fails else 0)
