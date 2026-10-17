// 2026-10-17 추가분의 순수 계산 로직 시험(DB·서버 불필요). 실행: npx tsx scripts/test_new_logic.ts (전부 PASS여야 한다)
import { normalizeOptions, normalizePrint, roundTo, DEFAULT_OPTIONS, DEFAULT_PRINT } from '../lib/envOptions';
import { searchProducts } from '../lib/productSearch';
import { recalcStock } from '../lib/stockRecalc';
import { lineTax, serverLineTax, normTaxType, isTaxFree } from '../lib/taxRules';
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://127.0.0.1:1'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'x';
let fails = 0;
const eq = (n: string, a: unknown, b: unknown) => { const ok = JSON.stringify(a) === JSON.stringify(b); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `\n  got ${JSON.stringify(a)}\n  exp ${JSON.stringify(b)}`); if (!ok) fails++; };

(async () => {
  // 환경설정 정규화: 비어 있거나 이상한 값은 기존 동작(기본값)
  eq('옵션 기본값', normalizeOptions(undefined), { ...DEFAULT_OPTIONS, print: DEFAULT_PRINT });
  eq('이상한 옵션 → 기본값', normalizeOptions({ vatRate: 'abc', qtyDecimals: 9, priceDecimals: 'x', productSearch: 'zzz' } as never), { ...DEFAULT_OPTIONS, print: DEFAULT_PRINT });
  eq('정상 옵션 유지', normalizeOptions({ vatRate: 8, qtyDecimals: 2, productSearch: 'words', quickAddProduct: true } as never).productSearch, 'words');
  eq('세율 0%·100% 허용, 101% 거부', [normalizeOptions({ vatRate: 0 }).vatRate, normalizeOptions({ vatRate: 100 }).vatRate, normalizeOptions({ vatRate: 101 }).vatRate], [0, 100, 10]);
  eq('다른 항목 저장 때 출력 옵션 보존', normalizeOptions({ print: { siteName: true } } as never).print?.siteName, true);
  eq('결재란 이름: 공백 제거·4개 제한·기본값', [normalizePrint({ approvalLabels: ' 담당 , 대표,소장,전무,초과' }).approvalLabels, normalizePrint({ approvalLabels: ' , ' }).approvalLabels], ['담당,대표,소장,전무', '담당,대표']);
  eq('안내문 60자·줄바꿈 제거', normalizePrint({ message: 'a\nb' + 'x'.repeat(100) }).message.length, 60);
  eq('반올림 자리수', [roundTo(1.55, 1), roundTo(1.005, 2), roundTo(2.5, 0)], [1.6, 1.01, 3]);

  // 상품 검색
  const P = (id: string, name: string, spec: string, extra: object = {}) => ({ id, code: id, name, spec, unit: 'EA', category: '', ...extra }) as never;
  const prods = [P('1', '볼트(SS41)', '3/8"*1"'), P('2', '볼트(SS41)', '1/2"*2"'), P('3', '스트롱앙카', '1/2"'), P('4', '평머리볼트', '8*43', { nickName: '단스끼' }), P('5', '너트', 'M12', { inactive: true }), P('6', '너트', 'M12'), P('7', '샹크', 'x', { barcode: '880123' })];
  eq('기본: 띄어 쓴 검색은 0건(기존 동작)', searchProducts(prods, '볼트 3/8', 'basic').length, 0);
  eq('단어별: 품명+규격', searchProducts(prods, '볼트 3/8', 'words').map(p => p.id), ['1']);
  eq('단어별: 순서 무관', searchProducts(prods, '3/8 볼트', 'words').map(p => p.id), ['1']);
  eq('단어별: 다른명칭 검색(기본은 못 찾음)', [searchProducts(prods, '단스끼', 'words').length, searchProducts(prods, '단스끼', 'basic').length], [1, 0]);
  eq('사용중단 품목 제외', searchProducts(prods, '너트 M12', 'words').map(p => p.id), ['6']);
  eq('단어 하나는 기본과 같은 품목', searchProducts(prods, '볼트', 'words').map(p => p.id), searchProducts(prods, '볼트', 'basic').map(p => p.id));
  eq('품명이 첫 단어로 시작하는 품목이 앞', searchProducts([P('a', '앙카볼트', '1/2'), P('b', '볼트', '앙카')], '볼트 앙카', 'words').map(p => p.id), ['b', 'a']);
  eq('바코드 정확 일치가 맨 앞', searchProducts([P('x', '볼트880123', ''), P('y', '샹크', 'x', { barcode: '880123' })], '880123', 'basic')[0].id, 'y');
  eq('검색어 없음 → 활성 앞 50건', searchProducts(prods, '  ', 'words').length, 6);

  // 재고 재계산: 매출(−)·매입(+)·반입(+)·반출(−), 견적·수주·소문자 이관 전표는 움직이지 않음
  const prod = (id: string, cur: number, extra: object = {}) => ({ id, code: id, name: id, spec: '', unit: 'EA', currentStock: cur, ...extra });
  const slip = (type: string, items: [string, number][]) => ({ slipType: type, items: items.map(([productId, qty]) => ({ productId, qty })) });
  const r = recalcStock(
    [prod('a', 70), prod('b', 5), prod('c', 100), prod('d', 0, { stockManaged: false }), prod('e', 12, { openingStock: 10 })],
    [slip('SALES', [['a', 30]]), slip('PURCHASE', [['b', 5]]), slip('RETURN_OUT', [['a', 1]]), slip('RETURN_IN', [['a', 1]]), slip('ESTIMATE', [['c', 9]]), slip('CONTRACT', [['c', 9]]), slip('sales', [['c', 99]]), slip('SALES', [['e', 3]]), slip('PURCHASE', [['e', 5]])]
  );
  eq('재고 점검: 검사 품목(재고관리 안 하는 품목 제외)', r.checked, 4);
  eq('재고 점검: 불일치(전표 없는 100 / 이월재고+전표)', r.diffs.map(d => [d.id, d.expected, d.current, d.kind]), [['a', -30, 70, 'hasSlips'], ['c', 0, 100, 'noSlips']] as never);
  eq('재고 점검: 소문자 이관 전표 건수', r.legacySlips, 1);

  // 세액 규칙(lib/taxRules): 면세 거래처 > 면세/영세 품목 > 별도 > 과세 품목 세율
  const ctx = (o: object = {}) => ({ mode: 'incl' as const, rate: 10, calcVat: 'R' as const, ...o });
  eq('세액: 과세·가산 1005원 10% 반올림=101', lineTax(1005, 'taxable', ctx()), 101);
  eq('세액: 내림(F)=100·올림(C)=101', [lineTax(1005, 'taxable', ctx({ calcVat: 'F' })), lineTax(1005, 'taxable', ctx({ calcVat: 'C' }))], [100, 101]);
  eq('세액: 세율 8%·7% (1000원)', [lineTax(1000, 'taxable', ctx({ rate: 8 })), lineTax(1000, undefined, ctx({ rate: 7 }))], [80, 70]);
  eq('세액: 별도(excl)는 0', lineTax(1000, 'taxable', ctx({ mode: 'excl' })), 0);
  eq('세액: 면세·영세 품목은 가산이어도 0', [lineTax(1000, 'exempt', ctx()), lineTax(1000, 'zero', ctx())], [0, 0]);
  eq('세액: 면세 거래처는 과세 품목도 0', lineTax(1000, 'taxable', ctx({ customerVat: 'none' })), 0);
  eq('세액: 거래처 가산/별도 지정은 막지 않음', [lineTax(1000, 'taxable', ctx({ customerVat: 'incl' })), lineTax(1000, 'taxable', ctx({ customerVat: 'excl' }))], [100, 100]);
  eq('세액: 공급가 0·NaN·무한대는 0', [lineTax(0, 'taxable', ctx()), lineTax(NaN, 'taxable', ctx()), lineTax(Infinity, 'taxable', ctx())], [0, 0, 0]);
  eq('과세구분 정규화: 모르는 값은 과세', [normTaxType(undefined), normTaxType('x'), normTaxType('exempt'), normTaxType('zero')], ['taxable', 'taxable', 'exempt', 'zero']);
  eq('isTaxFree', [isTaxFree('taxable'), isTaxFree('exempt'), isTaxFree('zero'), isTaxFree('taxable', 'none'), isTaxFree(undefined, 'incl')], [false, true, true, true, false]);
  eq('서버 세액: 0·음수·NaN은 0', [serverLineTax(1000, 0, 'taxable', undefined, 10), serverLineTax(1000, -50, 'taxable', undefined, 10), serverLineTax(1000, 'abc', 'taxable', undefined, 10)], [0, 0, 0]);
  eq('서버 세액: 이상한 양수는 세율대로(99999→100)', serverLineTax(1000, 99999, 'taxable', undefined, 10), 100);
  eq('서버 세액: 면세·영세·면세거래처는 0', [serverLineTax(1000, 100, 'exempt', undefined, 10), serverLineTax(1000, 100, 'zero', undefined, 10), serverLineTax(1000, 100, 'taxable', 'none', 10)], [0, 0, 0]);
  eq('서버 세액: 설정 반올림 따름(1005, F)', serverLineTax(1005, 1, 'taxable', undefined, 10, 'F'), 100);
  console.log(fails ? `\n실패 ${fails}건` : '\n전부 통과');
  process.exit(fails ? 1 : 0);
})();
