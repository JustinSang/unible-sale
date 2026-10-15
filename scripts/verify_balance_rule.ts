// 원본 Data/S08~S26.mdb의 Balance(AC01~12)와 lib/ledgerRules.ts 결과를 셀 단위로 대조한다.
import { execFileSync } from 'child_process';
import { monthlyNet, quarterSummary, customerLedger, monthlyStock, LedgerSlip, RuleSlip } from '../lib/ledgerRules';
const DIR = process.env.HOME + '/Desktop/동산화스너/오케이세일/Data/';
const env = { ...process.env, MDB_JET3_CHARSET: 'cp949' };
function table(f: string, t: string): Record<string, string>[] {
  const csv = execFileSync('mdb-export', [DIR + f, t], { env, maxBuffer: 1 << 28 }).toString();
  const rows: string[][] = []; let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < csv.length; i++) { const ch = csv[i];
    if (q) { if (ch === '"') { if (csv[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; } else cur += ch; }
  const h = rows[0]; return rows.slice(1).map(r => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}
const TYPE: Record<string, string> = { '1': 'sales', '2': 'purchase', '3': 'return_sales' };
let bad = 0, tot = 0; const per: Record<string, number[]> = {};
for (let n = 8; n <= 26; n++) {
  const f = `S${String(n).padStart(2, '0')}.mdb`;
  const sh = table(f, 'SlipHeader'), bal = table(f, 'Balance');
  const year = '2000'; // 원본 Balance는 «월 번호»로만 쌓는다(S11.mdb처럼 2개 연도가 든 파일 존재) → 연도 무시
  const slips: RuleSlip[] = sh.filter(x => TYPE[x.SlipKind]).map(x => ({ slipType: TYPE[x.SlipKind], slipDate: '2000' + x.SlipDate.slice(4), customerId: x.CustomerID,
    totalAmount: Number(x.Total || 0), paidAmount: x.SlipKind === '1' ? Number(x.Receipt || 0) : x.SlipKind === '2' ? Number(x.Payment || 0) : 0 }));
  const net = monthlyNet(slips, [], year);
  for (const b of bal) for (let m = 1; m <= 12; m++) {
    const orig = Number(b['AC' + String(m).padStart(2, '0')] || 0), mine = net.get(b.CustomerID)?.[m - 1] ?? 0;
    if (orig === 0 && mine === 0) continue; tot++; const x = (per[f] ??= [0, 0]); x[1]++; if (Math.abs(orig - mine) > 1) { bad++; x[0]++; }
  }
}
// 분기 집계표: 전기잔액+분기 매출−수금 = 원본 Balance의 AC 누계(연 초 0 기준)와 일치하는지
let qBad = 0, qTot = 0;
for (let n = 8; n <= 26; n++) {
  const f = `S${String(n).padStart(2, '0')}.mdb`;
  const sh = table(f, 'SlipHeader'), bal = table(f, 'Balance');
  const slips: RuleSlip[] = sh.filter(x => TYPE[x.SlipKind]).map(x => ({ slipType: TYPE[x.SlipKind], slipDate: '2000' + x.SlipDate.slice(4), customerId: x.CustomerID,
    totalAmount: Number(x.Total || 0), paidAmount: x.SlipKind === '1' ? Number(x.Receipt || 0) : x.SlipKind === '2' ? Number(x.Payment || 0) : 0 }));
  for (const q of [1, 2, 3, 4] as const) {
    const rows = new Map(quarterSummary(slips, [], '2000', q).map(r => [r.id, r]));
    for (const b of bal) {
      let cum = 0; for (let m = 1; m <= q * 3; m++) cum += Number(b['AC' + String(m).padStart(2, '0')] || 0);
      const r = rows.get(b.CustomerID); if (cum === 0 && !r) continue; qTot++; if (Math.abs((r?.balance ?? 0) - cum) > 1) qBad++;
    }
  }
}
// 거래처 원장: 품목 줄 + 동시수금 줄을 쌓은 최종 잔액 = 원본 Balance AC 연합계, 품목합=전표합계(원본 SalesDetails 기준)
let lBad = 0, lTot = 0;
for (let n = 8; n <= 26; n++) {
  const f = `S${String(n).padStart(2, '0')}.mdb`;
  const sh = table(f, 'SlipHeader'), bal = table(f, 'Balance'), det = table(f, 'SalesDetails');
  const items = new Map<string, any[]>();
  for (const d of det) { const a = items.get(d.SlipID) ?? []; a.push({ productName: d.ProductName, spec: d.Spec, unit: d.Unit, qty: Number(d.Qty || 0), unitPrice: Number(d.Price || 0), supplyAmount: Number(d.Amount || 0), taxAmount: Number(d.Tax || 0), totalAmount: Number(d.Amount || 0) + Number(d.Tax || 0) }); items.set(d.SlipID, a); }
  const slips: LedgerSlip[] = sh.filter(x => TYPE[x.SlipKind]).map(x => ({ slipType: TYPE[x.SlipKind], slipDate: x.SlipDate, customerId: x.CustomerID, slipNo: x.SlipNo,
    totalAmount: Number(x.Total || 0), paidAmount: x.SlipKind === '1' ? Number(x.Receipt || 0) : x.SlipKind === '2' ? Number(x.Payment || 0) : 0, items: items.get(x.SlipID) ?? [] }));
  for (const b of bal) {
    let sum = 0; for (let m = 1; m <= 12; m++) sum += Number(b['AC' + String(m).padStart(2, '0')] || 0);
    const l = customerLedger(slips, [], b.CustomerID, '0000-00-00', '9999-99-99'); if (sum === 0 && !l.rows.length) continue; lTot++; if (Math.abs(l.closing - sum) > 1) lBad++;
  }
}
// 월별 재고: 원본 Stock S01~S12(−매출수량+매입수량) 대조
let sBad = 0, sTot = 0;
for (let n = 8; n <= 26; n++) {
  const f = `S${String(n).padStart(2, '0')}.mdb`;
  const sh = table(f, 'SlipHeader'), st = table(f, 'Stock'), det = table(f, 'SalesDetails');
  const kindOfSlip = new Map(sh.map(x => [x.SlipID, x.SlipKind]));
  const bySlip = new Map<string, any[]>();
  for (const d of det) { const a = bySlip.get(d.SlipID) ?? []; a.push({ productId: d.ProductID, productName: d.ProductName, qty: Number(d.Qty || 0) }); bySlip.set(d.SlipID, a); }
  const stockSlips = sh.filter(x => TYPE[x.SlipKind]).map(x => ({ slipType: TYPE[x.SlipKind], slipDate: '2000' + x.SlipDate.slice(4), items: bySlip.get(x.SlipID) ?? [] }));
  const rows = new Map(monthlyStock(stockSlips, '2000').map(r => [r.productId, r]));
  for (const r of st) for (let m = 1; m <= 12; m++) {
    const orig = Number(r['S' + String(m).padStart(2, '0')] || 0), mine = rows.get(r.ProductID)?.net[m - 1] ?? 0;
    if (orig === 0 && mine === 0) continue; sTot++; if (Math.abs(orig - mine) > 0.01) sBad++;
  }
}
console.log(`월별 재고 대조 ${sTot}, 불일치 ${sBad}`);
console.log(`거래처 원장 최종잔액 대조 ${lTot}, 불일치 ${lBad}`);
console.log(`분기 잔액 대조 ${qTot}, 불일치 ${qBad}`);
console.log(`대조 셀 ${tot}, 불일치 ${bad}`); if (process.env.PER) console.log(JSON.stringify(per));
