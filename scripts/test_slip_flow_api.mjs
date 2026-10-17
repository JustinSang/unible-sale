// 전표 저장·수정·삭제 흐름과 재고·미수금·재고수불부 일치 시험(서버+복사본 DB 필요). 실행: node scripts/test_slip_flow_api.mjs http://localhost:3398
const B = process.argv[2] || 'http://localhost:3398';
let fails = 0; const ok = (n, v, i = '') => { console.log(v ? 'PASS' : 'FAIL', n, v ? '' : String(i)); if (!v) fails++; };
const call = async (m, p, body) => { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const sfx = Date.now().toString().slice(-6);
const prod = (await call('POST', '/api/products', { name: `흐름시험품${sfx}`, spec: 'F', unit: 'EA', sellingPrice: 1000, currentStock: 100 })).j;
const cust = (await call('POST', '/api/customers', { name: `흐름시험처${sfx}`, bizNumber: '000-00-00000', ceo: 't', tel: '0' })).j;
const stock = async () => (await call('GET', '/api/products')).j.find(p => p.id === prod.id).currentStock;
const recv = async () => (await call('GET', '/api/customers')).j.find(c => c.id === cust.id).receivables || 0;
const logs = async () => ((await call('GET', '/api/init-data')).j.inventoryLogs || []).filter(l => l.productId === prod.id).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || String(a.id).localeCompare(String(b.id)));
const mk = (type, qty, extra = {}) => call('POST', '/api/slips', { slipDate: '2026-10-17', slipType: type, customerId: cust.id, customerName: cust.name, paymentType: 'credit', paidAmount: 0, items: [{ productId: prod.id, productName: prod.name, spec: 'F', unit: 'EA', qty, unitPrice: 1000, taxAmount: 0 }], ...extra });
const r0 = await recv();
// 매출 10 → 재고 90, 미수금 +10,000
let s = await mk('SALES', 10); const id = s.j?.id;
ok('1 매출 저장 → 재고 90·미수금 +10,000', (await stock()) === 90 && (await recv()) === r0 + 10000, `${await stock()} ${await recv()}`);
// 수정 25 → 재고 75, 미수금 +25,000, 전표번호 유지
const no = s.j?.slipNo; s = await mk('SALES', 25, { id });
ok('2 수정 저장 → 재고 75·미수금 +25,000·전표번호 유지', (await stock()) === 75 && (await recv()) === r0 + 25000 && s.j?.slipNo === no, `${await stock()} ${await recv()} ${s.j?.slipNo}`);
// 삭제 → 재고 100, 미수금 원래대로
const d = await call('DELETE', `/api/slips/${id}`);
ok('3 삭제 → 재고 100·미수금 원상', d.s === 200 && (await stock()) === 100 && (await recv()) === r0, `${d.s} ${await stock()} ${await recv()}`);
// 재고수불부 일치: 기록의 증감 합 = 현재고 − 처음 재고, 줄마다 전/후 수량이 이어진다
const L = await logs();
const net = L.reduce((a, l) => a + (['adjust_minus', 'out'].includes(l.changeType) ? -l.changeQty : l.changeQty), 0);
ok('4-a 재고수불부 증감 합 = 현재고 − 처음(0)', net === (await stock()) - 100, `net ${net} 기록 ${L.length}건`);
ok('4-b 기록 4건(저장·수정취소·수정저장·삭제)', L.length === 4, L.map(l => `${l.changeType}${l.changeQty}`).join(','));
ok('4-c 전/후 수량이 이어짐', L.every((l, i) => i === 0 || l.beforeQty === L[i - 1].afterQty), L.map(l => `${l.beforeQty}→${l.afterQty}`).join(' '));
ok('4-d 기록에 이유·전표번호', L.every(l => l.reason && l.slipNo === no), L.map(l => l.reason).join(' | '));
// 매입: 재고 +, 삭제하면 −
const p = await mk('PURCHASE', 7); const before = await stock();
ok('5-a 매입 7 → 재고 +7', before === 107, before);
await call('DELETE', `/api/slips/${p.j?.id}`);
ok('5-b 매입 삭제 → 재고 원상', (await stock()) === 100, await stock());
// 견적·발주·수주·납품은 재고·미수금을 움직이지 않는다
for (const t of ['ESTIMATE', 'ORDER', 'CONTRACT', 'DELIVERY']) { const x = await mk(t, 5); await call('DELETE', `/api/slips/${x.j?.id}`); }
ok('6 견적·발주·수주·납품: 재고·미수금 불변', (await stock()) === 100 && (await recv()) === r0, `${await stock()} ${await recv()}`);
ok('7 없는 전표 삭제는 404', (await call('DELETE', '/api/slips/없는전표')).s === 404);
console.log(fails ? `\n실패 ${fails}건` : '\n전부 통과'); process.exit(fails ? 1 : 0);
