// 오케이세일 Balance 표 규칙(월 순증감) — 근거: unible_harness/docs/analysis_rea/oksale/reports/월잔액표_Balance_원본규칙_실측.md
// 부호: 미수금(받을 돈) +, 미지급금(줄 돈) −. S08~S26 실데이터 7,830셀 중 99.8% 일치로 검증(scripts/verify_balance_rule.ts).
// 지름길: 원본 S05~S07(구형)·SA/RE/PU/PA 열은 다루지 않는다 — 규칙 미확인.
export interface RuleSlip { slipType: string; slipDate: string; customerId: string; totalAmount: number; paidAmount: number }
export interface RuleCollection { type: 'collection' | 'payment'; date: string; customerId: string; amount: number; discount?: number } // discount=할인액(받을/줄 돈에서 같이 줄어드는 금액)

const kind = (t: string) => String(t || '').toLowerCase();

/** 거래처별 월(1~12) 순증감. year는 'YYYY'. */
export function monthlyNet(slips: RuleSlip[], collections: RuleCollection[], year: string): Map<string, number[]> {
  const out = new Map<string, number[]>();
  const add = (cid: string, date: string, v: number) => {
    if (!date.startsWith(year + '-') || !v) return;
    const m = parseInt(date.slice(5, 7), 10) - 1;
    if (!(m >= 0 && m < 12)) return;
    if (!out.has(cid)) out.set(cid, Array(12).fill(0));
    out.get(cid)![m] += v;
  };
  for (const s of slips) {
    const t = kind(s.slipType);
    if (t === 'sales') add(s.customerId, s.slipDate, s.totalAmount - s.paidAmount);
    else if (t === 'purchase') add(s.customerId, s.slipDate, -s.totalAmount + s.paidAmount);
    else if (t === 'return_sales' || t === 'return_in') add(s.customerId, s.slipDate, -s.totalAmount);
    else if (t === 'return_purchase' || t === 'return_out') add(s.customerId, s.slipDate, s.totalAmount);
    // 견적·발주·납품·계약은 잔액에 영향 없음(원본 SlipKind 5·6·7과 동일)
  }
  for (const c of collections) add(c.customerId, c.date, c.type === 'collection' ? -(c.amount + (c.discount || 0)) : c.amount + (c.discount || 0));
  return out;
}

// ───── 분기 집계표(원본 QuarterSummaryTable 열: BeforeBalance·Month1~3Sale·Month1~3Receipt·Balance) ─────
// 근거: Ghidra refs 00799120·007abf80·007a2890·007b1380(열 이름, «Balance >= 0»=미수금 집계표 / «Balance < 0»=미지급금 집계표, Order by Balance desc|CustomerName).
// 추정(원본 저장값 없어 직접 대조 불가): Sale = 매출 − 매입 − 반품 합, Receipt = 매출 동시수금·수금 − 매입 동시지급·지급. Sale − Receipt = 월 순증감(위 monthlyNet, 실측 검증)과 항등.
export interface QuarterRow { id: string; before: number; sale: [number, number, number]; receipt: [number, number, number]; balance: number }

export function quarterSummary(slips: RuleSlip[], collections: RuleCollection[], year: string, quarter: 1 | 2 | 3 | 4, opening: Map<string, number> = new Map()): QuarterRow[] {
  const sale = new Map<string, number[]>(), rec = new Map<string, number[]>();
  const bump = (mp: Map<string, number[]>, cid: string, date: string, v: number) => {
    if (!date.startsWith(year + '-') || !v) return;
    const m = parseInt(date.slice(5, 7), 10) - 1;
    if (!(m >= 0 && m < 12)) return;
    if (!mp.has(cid)) mp.set(cid, Array(12).fill(0));
    mp.get(cid)![m] += v;
  };
  for (const s of slips) {
    const t = kind(s.slipType);
    if (t === 'sales') { bump(sale, s.customerId, s.slipDate, s.totalAmount); bump(rec, s.customerId, s.slipDate, s.paidAmount); }
    else if (t === 'purchase') { bump(sale, s.customerId, s.slipDate, -s.totalAmount); bump(rec, s.customerId, s.slipDate, -s.paidAmount); }
    else if (t === 'return_sales' || t === 'return_in') bump(sale, s.customerId, s.slipDate, -s.totalAmount);
    else if (t === 'return_purchase' || t === 'return_out') bump(sale, s.customerId, s.slipDate, s.totalAmount);
  }
  for (const c of collections) bump(rec, c.customerId, c.date, c.type === 'collection' ? c.amount + (c.discount || 0) : -(c.amount + (c.discount || 0)));
  const ids = new Set<string>([...sale.keys(), ...rec.keys(), ...opening.keys()]);
  const q0 = (quarter - 1) * 3, rows: QuarterRow[] = [];
  ids.forEach(id => {
    const sv = sale.get(id) ?? Array(12).fill(0), rv = rec.get(id) ?? Array(12).fill(0);
    let before = opening.get(id) ?? 0;
    for (let m = 0; m < q0; m++) before += sv[m] - rv[m];
    const s3 = [sv[q0], sv[q0 + 1], sv[q0 + 2]] as [number, number, number], r3 = [rv[q0], rv[q0 + 1], rv[q0 + 2]] as [number, number, number];
    const balance = before + s3[0] + s3[1] + s3[2] - r3[0] - r3[1] - r3[2];
    if (before || balance || s3.some(Boolean) || r3.some(Boolean)) rows.push({ id, before, sale: s3, receipt: r3, balance });
  });
  return rows;
}

// ───── 거래처 원장(원본 CustomerBookPrintTable 열: SlipDate·Kind·ProductName·Spec·Unit·Qty·Price·Amount·Tax·Balance·Comments) ─────
// 잔액 부호는 monthlyNet과 같다(미수금 +). 전표 품목합 = 전표 합계는 원본 SalesDetails로 확인(S25 456/456, S20 2,729/2,730).
export interface LedgerItem { productName: string; spec: string; unit: string; qty: number; unitPrice: number; supplyAmount: number; taxAmount: number; totalAmount: number }
export interface LedgerSlip extends RuleSlip { slipNo: string; items: LedgerItem[]; memo?: string }
export interface LedgerRow { date: string; kind: string; productName: string; spec: string; unit: string; qty: number | null; price: number | null; amount: number; tax: number; balance: number; comments: string }

const KIND_LABEL: Record<string, string> = { sales: '매출', purchase: '매입', return_sales: '매출반품', return_in: '매출반품', return_purchase: '매입반품', return_out: '매입반품' };

export function customerLedger(slips: LedgerSlip[], collections: RuleCollection[], customerId: string, from: string, to: string, baseBalance = 0, asOf = ''): { opening: number; rows: LedgerRow[]; closing: number } {
  const sign = (t: string) => (t === 'sales' ? 1 : t === 'purchase' ? -1 : t === 'return_sales' || t === 'return_in' ? -1 : t === 'return_purchase' || t === 'return_out' ? 1 : 0);
  const evs: { date: string; order: string; lines: { r: Omit<LedgerRow, 'balance'>; delta: number }[] }[] = [];
  for (const s of slips) {
    if (s.customerId !== customerId) continue;
    const t = kind(s.slipType), sg = sign(t);
    if (!sg) continue;
    const lines: { r: Omit<LedgerRow, 'balance'>; delta: number }[] = s.items.map(it => ({ r: { date: s.slipDate, kind: KIND_LABEL[t], productName: it.productName, spec: it.spec, unit: it.unit, qty: it.qty, price: it.unitPrice, amount: it.supplyAmount, tax: it.taxAmount, comments: s.memo || '' }, delta: sg * it.totalAmount }));
    const gap = s.totalAmount - s.items.reduce((a, it) => a + it.totalAmount, 0); // 품목합과 합계가 다르면 차액을 별도 줄로 남겨 잔액을 합계에 맞춘다
    if (gap) lines.push({ r: { date: s.slipDate, kind: KIND_LABEL[t], productName: '(품목합 차액)', spec: '', unit: '', qty: null, price: null, amount: gap, tax: 0, comments: s.slipNo }, delta: sg * gap });
    if (s.paidAmount && (t === 'sales' || t === 'purchase')) lines.push({ r: { date: s.slipDate, kind: t === 'sales' ? '수금' : '지급', productName: '동시 ' + (t === 'sales' ? '수금' : '지급'), spec: '', unit: '', qty: null, price: null, amount: s.paidAmount, tax: 0, comments: s.slipNo }, delta: t === 'sales' ? -s.paidAmount : s.paidAmount });
    evs.push({ date: s.slipDate, order: s.slipNo, lines });
  }
  for (const c of collections) if (c.customerId === customerId)
    evs.push({ date: c.date, order: 'zz', lines: [
      { r: { date: c.date, kind: c.type === 'collection' ? '수금' : '지급', productName: c.type === 'collection' ? '수금' : '지급', spec: '', unit: '', qty: null, price: null, amount: c.amount, tax: 0, comments: '' }, delta: c.type === 'collection' ? -c.amount : c.amount },
      ...(c.discount ? [{ r: { date: c.date, kind: '할인', productName: '할인', spec: '', unit: '', qty: null, price: null, amount: c.discount, tax: 0, comments: '' }, delta: c.type === 'collection' ? -c.discount : c.discount }] : [])
    ] });
  evs.sort((a, b) => a.date.localeCompare(b.date) || a.order.localeCompare(b.order));
  // 기초잔액(baseBalance)은 asOf일 시작 시점의 잔액 — 그 이전 거래는 이미 포함된 것으로 보고 건너뛴다.
  let bal = baseBalance, opening = baseBalance; const rows: LedgerRow[] = [];
  let started = false;
  for (const e of evs) {
    if (e.date > to) break;
    if (asOf && e.date < asOf) continue;
    if (e.date < from) { e.lines.forEach(l => (bal += l.delta)); continue; }
    if (!started) { opening = bal; started = true; }
    e.lines.forEach(l => { bal += l.delta; rows.push({ ...l.r, balance: bal }); });
  }
  if (!started) opening = bal;
  return { opening, rows, closing: bal };
}

/** [fromDate, beforeDate) 구간의 거래처별 순증감 합(기초잔액 이후 ~ 조회 연도 시작 전). */
export function netBetween(slips: RuleSlip[], collections: RuleCollection[], fromDate: string, beforeDate: string): Map<string, number> {
  const out = new Map<string, number>();
  const inR = (d: string) => d >= fromDate && d < beforeDate;
  const fs = slips.filter(x => inR(x.slipDate)), fc = collections.filter(x => inR(x.date));
  for (let y = parseInt(fromDate.slice(0, 4) || '0', 10); y <= parseInt(beforeDate.slice(0, 4), 10); y++) {
    monthlyNet(fs, fc, String(y)).forEach((m, id) => out.set(id, (out.get(id) || 0) + m.reduce((a, b) => a + b, 0)));
  }
  return out;
}

// ───── 월별 재고 증감(원본 Stock 표: S01~S12 = −매출수량 + 매입수량, P열 전 파일 0·미사용) ─────
// 근거: Ghidra refs 0067cdd0·00686880(Stock Select/Insert/Update, 열 S00~S12). S08~S26 대조: 셀 57,110개 중 62개 불일치(−1,+1,+1 계수).
// 지름길: 반품(SlipKind 3)은 표본 3건뿐이라 부호 미확정 — 매출반품 +, 매입반품 −로 두었다(재고가 돌아오는 방향).
export interface StockSlip { slipType: string; slipDate: string; items: { productId: string; productName: string; spec?: string; unit?: string; qty: number }[] }
export interface StockFlowRow { productId: string; name: string; spec: string; unit: string; net: number[]; inQty: number; outQty: number }

export function monthlyStock(slips: StockSlip[], year: string): StockFlowRow[] {
  const m = new Map<string, StockFlowRow>();
  for (const s of slips) {
    if (!s.slipDate.startsWith(year + '-')) continue;
    const t = kind(s.slipType);
    const sg = t === 'sales' ? -1 : t === 'purchase' ? 1 : t === 'return_sales' || t === 'return_in' ? 1 : t === 'return_purchase' || t === 'return_out' ? -1 : 0;
    if (!sg) continue;
    const mi = parseInt(s.slipDate.slice(5, 7), 10) - 1;
    for (const it of s.items) {
      const key = it.productId || it.productName;
      if (!m.has(key)) m.set(key, { productId: key, name: it.productName, spec: it.spec || '', unit: it.unit || '', net: Array(12).fill(0), inQty: 0, outQty: 0 });
      const r = m.get(key)!, q = sg * (it.qty || 0);
      r.net[mi] += q; if (q > 0) r.inQty += q; else r.outQty -= q;
    }
  }
  return [...m.values()];
}

// ───── 수금지급 화면: 거래처 월별 내역·현재 잔액(원본 «수금지급» 하단 표: 전표년월·매입액·대급금·지급액·매출액·예수금·수금액·잔액, 첫 줄 «이월») ─────
// 잔액 = 기초잔액 + 매출(공급가+세액) − 수금(동시수금·수금·할인) − 매입(공급가+세액) + 지급(동시지급·지급·할인). 미수금 +, 미지급금 −.
// 근거: 원본 캡처에서 매출 9,000·예수금 900·수금 0 → 잔액 9,900. «대급금»=매입 세액은 예수금과 대칭으로 해석(추정).
export interface StatSlip extends RuleSlip { totalTaxAmount: number } // totalAmount는 RuleSlip에 있음
export interface MonthlyStatementRow { ym: string; purchase: number; purchaseTax: number; payment: number; sales: number; salesTax: number; receipt: number; balance: number }

function eventsFor(slips: StatSlip[], collections: RuleCollection[], customerId: string, asOf: string) {
  const ev: { date: string; purchase: number; purchaseTax: number; payment: number; sales: number; salesTax: number; receipt: number }[] = [];
  const z = { purchase: 0, purchaseTax: 0, payment: 0, sales: 0, salesTax: 0, receipt: 0 };
  for (const s of slips) {
    if (s.customerId !== customerId || (asOf && s.slipDate < asOf)) continue;
    const t = kind(s.slipType);
    // 합계(totalAmount)를 기준으로 하고 세액을 떼어 공급가를 구한다 — 전표 합계와 공급가+세액이 어긋난 이관 전표가 있어서 잔액이 장부와 갈라지지 않게 한다.
    const tax = s.totalTaxAmount || 0, supply = s.totalAmount - tax;
    if (t === 'sales') ev.push({ ...z, date: s.slipDate, sales: supply, salesTax: tax, receipt: s.paidAmount });
    else if (t === 'purchase') ev.push({ ...z, date: s.slipDate, purchase: supply, purchaseTax: tax, payment: s.paidAmount });
    else if (t === 'return_sales' || t === 'return_in') ev.push({ ...z, date: s.slipDate, sales: -supply, salesTax: -tax });
    else if (t === 'return_purchase' || t === 'return_out') ev.push({ ...z, date: s.slipDate, purchase: -supply, purchaseTax: -tax });
  }
  for (const c of collections) {
    if (c.customerId !== customerId || (asOf && c.date < asOf)) continue;
    const a = c.amount + (c.discount || 0);
    ev.push(c.type === 'collection' ? { ...z, date: c.date, receipt: a } : { ...z, date: c.date, payment: a });
  }
  return ev;
}
const effect = (e: { purchase: number; purchaseTax: number; payment: number; sales: number; salesTax: number; receipt: number }) => e.sales + e.salesTax - e.receipt - e.purchase - e.purchaseTax + e.payment;

/** 현재(또는 upTo일까지) 잔액: 기초잔액(asOf 시작 시점) + 이후 거래. */
export function customerBalance(slips: StatSlip[], collections: RuleCollection[], customerId: string, base = 0, asOf = '', upTo = ''): number {
  return eventsFor(slips, collections, customerId, asOf).filter(e => !upTo || e.date <= upTo).reduce((b, e) => b + effect(e), base);
}

export function customerMonthly(slips: StatSlip[], collections: RuleCollection[], customerId: string, from: string, to: string, base = 0, asOf = ''): { opening: number; rows: MonthlyStatementRow[] } {
  const ev = eventsFor(slips, collections, customerId, asOf).sort((a, b) => a.date.localeCompare(b.date));
  let bal = base; const byMonth = new Map<string, MonthlyStatementRow>(); let opening = base;
  for (const e of ev) {
    if (e.date > to) break;
    if (e.date < from) { bal += effect(e); opening = bal; continue; }
    const ym = e.date.slice(0, 7);
    if (!byMonth.has(ym)) byMonth.set(ym, { ym, purchase: 0, purchaseTax: 0, payment: 0, sales: 0, salesTax: 0, receipt: 0, balance: 0 });
    const r = byMonth.get(ym)!;
    r.purchase += e.purchase; r.purchaseTax += e.purchaseTax; r.payment += e.payment; r.sales += e.sales; r.salesTax += e.salesTax; r.receipt += e.receipt;
    bal += effect(e); r.balance = bal;
  }
  return { opening, rows: [...byMonth.values()].sort((a, b) => a.ym.localeCompare(b.ym)) };
}

/** 이관 과정에서 생긴 대문자 'SALES' 전표 중, 같은 날짜·합계의 소문자 'sales' 전표가 이미 있는 것을 뺀다(원본 정리 전까지의 임시 처리).
 *  지름길: 날짜+합계만 비교하므로 우연히 같은 금액의 정상 전표는 빠질 수 있다 — 원본 정리 후 이 함수를 없앤다. */
export function dedupeSlips<T extends { slipType: string; slipDate: string; totalAmount: number }>(slips: T[]): { slips: T[]; dupCount: number } {
  const seen = new Set(slips.filter(s => String(s.slipType) === 'sales').map(s => `${s.slipDate}|${s.totalAmount}`));
  const kept = slips.filter(s => !(String(s.slipType) === 'SALES' && seen.has(`${s.slipDate}|${s.totalAmount}`)));
  return { slips: kept, dupCount: slips.length - kept.length };
}

// ───── 초기이월금(기초잔액) 적용 — 원본(머니플러스)과 같은 뜻으로 «거래처별»이다 ─────
// 원본: 초기이월금은 거래처마다 따로 입력하고(받을 금액 +, 줄 금액 −), Balance의 AC00(연 파일 첫머리 잔액)에 얹힌다. 입력하지 않은 거래처는 이월 0으로 모든 거래가 그대로 센다.
// 그래서 기준일(asOf) 이전 거래를 «이미 기초잔액에 들어 있다»며 빼는 것은 초기이월금을 입력한 거래처에만 적용하고, 나머지 거래처는 건드리지 않는다.
// strict: 켜면 «기준일 이전 거래는 모두 기초잔액에 이미 들어 있다»고 보고 입력하지 않은 거래처(이월 0)에도 적용한다 — 실제 잔액표를 받아 전 거래처 기초잔액을 넣은 뒤(2026-10-16 추가) 오래된 이관 전표가 잔액을 부풀리지 않게 하는 용도.
export interface OpeningConfig { asOf: string; byCustomer: Record<string, number>; strict?: boolean }
export function withOpening<S extends { customerId: string; slipDate: string }, C extends { customerId: string; date: string }>(
  slips: S[], collections: C[], op: OpeningConfig
): { slips: S[]; collections: C[]; base: Map<string, number> } {
  const has = (id: string) => !!op.asOf && (!!op.strict || Object.prototype.hasOwnProperty.call(op.byCustomer, id));
  return {
    slips: slips.filter(s => !has(s.customerId) || s.slipDate >= op.asOf),
    collections: collections.filter(c => !has(c.customerId) || c.date >= op.asOf),
    base: new Map(Object.entries(op.byCustomer))
  };
}
