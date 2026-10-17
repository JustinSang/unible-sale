// 세액 규칙 API 시험(서버+복사본 DB 필요). 실행: node scripts/test_tax_api.mjs http://localhost:3398  (전부 PASS여야 한다)
// 규칙: 면세 거래처(vatType none)·면세/영세 품목은 세액 0, 과세 품목은 «세액 가산» 때 세율대로, 별도(세액 0)는 0, 서버가 최종 계산(화면이 보낸 이상한 세액은 바로잡음),
//       세금계산서 발행 API는 세액 0을 그대로 둠, 전표 연결 id(linkedFromId) 저장.
const B = process.argv[2] || 'http://localhost:3398';
let fails = 0; const ok = (n, v, i = '') => { console.log(v ? 'PASS' : 'FAIL', n, v ? '' : String(i)); if (!v) fails++; };
const call = async (m, p, body) => { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const sfx = Date.now().toString().slice(-6);
const mkProd = async (name, taxType) => (await call('POST', '/api/products', { name: `세액시험${name}${sfx}`, spec: 'T', unit: 'EA', sellingPrice: 1000, taxType })).j;
const mkCust = async (name, vatType) => { const c = (await call('POST', '/api/customers', { name: `세액시험${name}${sfx}`, bizNumber: '000-00-00000', ceo: 't', tel: '0' })).j; if (vatType) await call('PUT', `/api/customers/${c.id}`, { vatType }); return c; };
const slip = (c, items, extra = {}) => call('POST', '/api/slips', { slipDate: '2026-10-17', slipType: 'SALES', customerId: c.id, customerName: c.name, paymentType: 'credit', paidAmount: 0, memo: '세액시험', items: items.map(([p, qty, tax]) => ({ productId: p.id, productName: p.name, spec: 'T', unit: 'EA', qty, unitPrice: 1000, taxAmount: tax })), ...extra });
const taxable = await mkProd('과세', 'taxable'), exempt = await mkProd('면세', 'exempt'), zero = await mkProd('영세', 'zero'), plain = await mkProd('미지정', undefined);
const cNorm = await mkCust('일반'), cNone = await mkCust('면세처', 'none');

// 1) 과세+면세+영세+미지정 혼합 전표, 화면이 «세액 가산»으로 모든 줄에 10%를 보낸 경우 → 면세·영세 줄만 0이어야 한다
let r = await slip(cNorm, [[taxable, 1, 100], [exempt, 1, 100], [zero, 1, 100], [plain, 1, 100]]);
const it = r.j?.items || [];
ok('1-a 과세 줄 세액 100', it[0]?.taxAmount === 100, JSON.stringify(it.map(x => x.taxAmount)));
ok('1-b 면세 줄 세액 0', it[1]?.taxAmount === 0, it[1]?.taxAmount);
ok('1-c 영세 줄 세액 0', it[2]?.taxAmount === 0, it[2]?.taxAmount);
ok('1-d 미지정(과세로 취급) 줄 세액 100', it[3]?.taxAmount === 100, it[3]?.taxAmount);
ok('1-e 전표 세액 합계 = 200', r.j?.totalTaxAmount === 200, r.j?.totalTaxAmount);
ok('1-f 전표 합계금액 = 공급가 4000 + 세액 200', r.j?.totalAmount === 4200, r.j?.totalAmount);
ok('1-g 줄에 과세구분 기록(taxType)', it[0]?.taxType === 'taxable' && it[1]?.taxType === 'exempt' && it[2]?.taxType === 'zero', JSON.stringify(it.map(x => x.taxType)));
// 2) 면세 거래처는 어떤 품목도 세액 0
r = await slip(cNone, [[taxable, 1, 100], [plain, 2, 200]]);
ok('2 면세 거래처: 모든 줄 세액 0', r.j?.totalTaxAmount === 0 && r.j?.items.every(x => x.taxAmount === 0), JSON.stringify(r.j?.items?.map(x => x.taxAmount)));
// 3) 별도(세액 없음) 전표: 화면이 0을 보내면 과세 품목도 0
r = await slip(cNorm, [[taxable, 1, 0], [plain, 1, 0]]);
ok('3 별도: 세액 0 유지', r.j?.totalTaxAmount === 0, r.j?.totalTaxAmount);
// 4) 화면이 이상한 세액(예: 99999)을 보내면 서버가 세율대로 바로잡는다
r = await slip(cNorm, [[taxable, 3, 99999]]);
ok('4 이상한 세액 → 세율대로(3000×10%=300)', r.j?.items?.[0]?.taxAmount === 300, r.j?.items?.[0]?.taxAmount);
// 5) 음수 세액 거부/보정
r = await slip(cNorm, [[taxable, 1, -50]]);
ok('5 음수 세액이 그대로 저장되지 않음', (r.j?.items?.[0]?.taxAmount ?? -1) >= 0, r.j?.items?.[0]?.taxAmount);
// 6) 수정 저장(같은 id)해도 세액 규칙 유지
const first = await slip(cNorm, [[taxable, 1, 100], [exempt, 1, 100]]);
const id = first.j?.id;
r = await call('POST', '/api/slips', { id, slipDate: '2026-10-17', slipType: 'SALES', customerId: cNorm.id, customerName: cNorm.name, paymentType: 'credit', paidAmount: 0, items: [taxable, exempt].map(p => ({ productId: p.id, productName: p.name, spec: 'T', unit: 'EA', qty: 2, unitPrice: 1000, taxAmount: 200 })) });
ok('6 수정 저장: 과세 200 + 면세 0', r.j?.totalTaxAmount === 200, r.j?.totalTaxAmount);
// 7) 세금계산서 발행 API: 세액 0을 그대로 둔다(10%를 붙이지 않는다)
r = await call('POST', '/api/tax-invoices', { supplyAmount: 100000, taxAmount: 0, customerName: '세액시험', taxDate: '2026-10-17' });
ok('7-a 세액 0 발행 → 0 유지', r.j?.taxAmount === 0 && r.j?.totalAmount === 100000, JSON.stringify([r.j?.taxAmount, r.j?.totalAmount]));
r = await call('POST', '/api/tax-invoices', { supplyAmount: 100000, customerName: '세액시험', taxDate: '2026-10-17' });
ok('7-b 세액을 안 보내면 세율대로 10,000', r.j?.taxAmount === 10000, r.j?.taxAmount);
// 8) 전표 연결 id 저장
r = await slip(cNorm, [[taxable, 1, 100]], { linkedFromId: first.j?.id });
const back = (await call('GET', '/api/slips')).j?.find(x => x.id === r.j?.id);
ok('8 linkedFromId 저장', back?.linkedFromId === first.j?.id, back?.linkedFromId);
console.log(fails ? `\n실패 ${fails}건` : '\n전부 통과'); process.exit(fails ? 1 : 0);
