#!/usr/bin/env python3
"""이관 과정에서 CP949 바이트가 Latin-1로 읽혀 깨진 한글(예: 'KSÇà°¡' → 'KS행가')을 되살린다.
- 대상: data/db.json·data/prices.json 안의 모든 문자열 값(키는 건드리지 않음).
- 고치는 조건(셋 다 만족): ①Latin-1 확장 글자(U+00A1~U+00FF)가 2개 이상 연속 ②latin1→cp949 복원이 에러 없이 되고 ③복원 결과에 Latin-1 밖 글자(한글·한자·자모·기호)가 있고 깨진 글자(U+FFFD)가 없다. 그 밖의 문자열(°·± 등 정상 기호)은 그대로 둔다.
- --dry: 쓰기 없이 건수만. 실제 실행 때는 파일별로 .bak_<날짜>_<시각> 백업을 먼저 만든다.
근거(2026-10-15 실측): 품목명 17,538 · 세금계산서 거래처명 2,481 · 거래처명 303 · 전표 거래처명 118 · 전표 품목명 216 등이 깨져 있었다.
"""
import json, os, re, shutil, sys, datetime, collections
HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, '..', 'data')
BAD = re.compile('[\u00a1-\u00ff]{2,}'); HANGUL = re.compile('[^\x00-\u00ff]')  # 복원 결과에 Latin-1 밖 글자(한글·한자·자모·기호 Ø 등)가 있으면 성공으로 본다
stats = collections.Counter()
def fix(s):
    if not BAD.search(s): return s
    for cand in (s, s[:-1]):  # 끝 글자가 반으로 잘린 2바이트 글자면 그 한 글자를 뺀다(예: 세금계산서 품목요약 «… ¿»)
        try: t = cand.encode('latin1').decode('cp949')
        except Exception: continue
        if HANGUL.search(t) and '\ufffd' not in t: return t
    return s
def walk(x, path):
    if isinstance(x, str):
        y = fix(x)
        if y != x: stats[path] += 1
        return y
    if isinstance(x, list): return [walk(v, path) for v in x]
    if isinstance(x, dict): return {k: walk(v, path or k) if path else walk(v, k) for k, v in x.items()}
    return x
dry = '--dry' in sys.argv
for name in ('db.json', 'prices.json'):
    fp = os.path.join(DATA, name); d = json.load(open(fp)); stats.clear()
    nd = walk(d, '')
    print(name, dict(stats))
    if not dry and stats:
        bak = fp + '.bak_' + datetime.datetime.now().strftime('%Y%m%d_%H%M%S'); shutil.copy2(fp, bak)
        json.dump(nd, open(fp, 'w'), ensure_ascii=False, indent=2); print(' 저장, 백업', os.path.basename(bak))
