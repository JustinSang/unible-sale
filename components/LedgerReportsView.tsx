'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Download } from 'lucide-react';
import type { LedgerRow } from '@/lib/ledgerRules';
import { RptPrintModal, type RptRow } from '@/components/RptReportPrint';
import { monthlyNet, quarterSummary, customerLedger, netBetween, monthlyStock, withOpening } from '@/lib/ledgerRules';
import type { Slip, CollectionPayment, Customer, TaxInvoice, OSTheme, Product, Bill } from '@/types';

interface LedgerReportsViewProps {
  slips: Slip[];
  collections: CollectionPayment[];
  customers: Customer[];
  taxInvoices: TaxInvoice[];
  products?: Product[];
  bills?: Bill[];
  company?: { name: string; ceo: string; bizNumber: string; address: string; bizType: string; bizItem: string };
  customerPrices: Record<string, Record<string, any>>;
  osTheme: OSTheme;
}

type Section = 'daily' | 'cashbook' | 'period' | 'receivable' | 'ledger' | 'stockflow' | 'vat' | 'pricelist' | 'yearend' | 'phonebook' | 'custsum' | 'query' | 'rcpquery' | 'subulbook' | 'subulsum' | 'sitebook' | 'rcpsum' | 'billbook' | 'prodsum' | 'slipstatus' | 'dailydetail' | 'taxbook' | 'prodlist' | 'custlist';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'daily', label: '일계표' },
  { id: 'cashbook', label: '현금출납부' },
  { id: 'period', label: '월·분기 집계표' },
  { id: 'receivable', label: '미수·미지급 집계표' },
  { id: 'ledger', label: '거래처 원장' },
  { id: 'stockflow', label: '월별 재고 수불' },
  { id: 'vat', label: '부가세 집계' },
  { id: 'pricelist', label: '단가표' },
  { id: 'yearend', label: '연말 이월' },
  { id: 'phonebook', label: '전화번호부' },
  { id: 'custsum', label: '거래처별 집계표' },
  { id: 'query', label: '거래내역 조회' },
  { id: 'dailydetail', label: '일계 상세' },
  { id: 'rcpquery', label: '수금지급 조회' },
  { id: 'subulbook', label: '상품수불장' },
  { id: 'subulsum', label: '상품수불 집계' },
  { id: 'sitebook', label: '현장별 장부' },
  { id: 'rcpsum', label: '수금·지급 집계' },
  { id: 'billbook', label: '어음 장부' },
  { id: 'prodsum', label: '품목별 집계' },
  { id: 'slipstatus', label: '전표 현황' },
  { id: 'taxbook', label: '세금계산서 장부' },
  { id: 'prodlist', label: '품목·재고 현황' },
  { id: 'custlist', label: '거래처 목록' }
];

type VatRow = { sSupply: number; sTax: number; sCnt: number; pSupply: number; pTax: number; pCnt: number };

type Kind = 'sales' | 'purchase' | 'salesReturn' | 'purchaseReturn' | 'other';

// 저장 데이터에 'sales'·'SALES'·'return_sales' 등 표기가 섞여 있어 소문자로 맞춰 분류한다.
function kindOf(slip: Slip): Kind {
  const t = String(slip.slipType || '').toLowerCase();
  if (t === 'sales') return 'sales';
  if (t === 'purchase') return 'purchase';
  if (t === 'return_sales' || t === 'return_in') return 'salesReturn';
  if (t === 'return_purchase' || t === 'return_out') return 'purchaseReturn';
  return 'other'; // 견적·발주·납품·계약은 금액 집계에서 제외
}

const won = (n: number) => Math.round(n || 0).toLocaleString('ko-KR');
const monthOf = (d: string) => d.slice(0, 7);

function downloadCsv(name: string, rows: (string | number)[][]) {
  const body = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const th = 'px-2 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 whitespace-nowrap';
const td = 'px-2 py-1 text-xs border border-slate-200';
const num = `${td} text-right font-mono`;

// 단순 보고서 표(머리글·행·합계 한 줄) — 숫자 칸은 오른쪽 정렬
function ReportTable({ head, rows, foot, numFrom, limit = 1000 }: { head: string[]; rows: (string | number)[][]; foot?: (string | number)[]; numFrom: number; limit?: number }) {
  const cell = (v: string | number, i: number) => <td key={i} className={i >= numFrom && typeof v === 'number' ? num : td}>{typeof v === 'number' ? won(v) : v}</td>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead><tr>{head.map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.slice(0, limit).map((r, i) => <tr key={i}>{r.map(cell)}</tr>)}
          {rows.length === 0 && <tr><td className={td} colSpan={head.length}>해당 기간에 자료가 없습니다.</td></tr>}
          {foot && <tr className="bg-slate-50 font-bold">{foot.map(cell)}</tr>}
        </tbody>
      </table>
      {rows.length > limit && <p className="text-[11px] text-slate-500 mt-1">처음 {limit.toLocaleString('ko-KR')}줄만 표시했습니다 — 전체는 CSV로 받으세요.</p>}
    </div>
  );
}

function OpeningEditor({ customers, opening, onSave }: { customers: { id: string; name: string }[]; opening: { asOf: string; byCustomer: Record<string, number> }; onSave: (o: { asOf: string; byCustomer: Record<string, number> }) => void }) {
  const [asOf, setAsOf] = useState(opening.asOf || '');
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(opening.byCustomer).map(([k, v]) => [k, String(v)])));
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="font-semibold">기준일</label>
        <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
        <span className="text-slate-500">입력한 거래처만, 이 날짜 시작 시점의 잔액으로 봅니다(이전 거래는 그 잔액에 들어 있다고 보고 제외). 입력하지 않은 거래처는 모든 거래가 그대로 셉니다. 미수금 +, 미지급금 −.</span>
        <button
          disabled={!asOf}
          onClick={() => onSave({ asOf, byCustomer: Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, Number(v) || 0]).filter(([, v]) => v !== 0)) })}
          className="ml-auto border border-slate-300 rounded px-3 py-1 font-bold hover:bg-slate-50 disabled:opacity-40"
        >저장</button>
      </div>
      <div className="max-h-64 overflow-auto border border-slate-200">
        <table className="w-full border-collapse"><tbody>
          {customers.slice(0, 300).map(c => (
            <tr key={c.id}><td className={td}>{c.name}</td>
              <td className={td}><input inputMode="numeric" value={vals[c.id] ?? ''} onChange={e => setVals(v => ({ ...v, [c.id]: e.target.value.replace(/[^\d-]/g, '') }))} className="w-40 text-right font-mono border border-slate-200 rounded px-1 py-0.5" /></td></tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );
}

export function LedgerReportsView({ slips: rawSlips, collections, customers, taxInvoices, products = [], bills = [], company, customerPrices }: LedgerReportsViewProps) {
  const [section, setSection] = useState<Section>('daily');

  // 이관 과정에서 생긴 대문자 'SALES' 전표 중, 같은 날짜·합계의 소문자 'sales' 전표가 이미 있는 것은 중복 의심으로 집계에서 뺀다.
  // 지름길: 날짜+합계만 비교하므로 우연히 같은 금액의 정상 전표는 빠질 수 있음 — 원본 정리 후 이 로직 제거.
  const { slips, dupCount } = useMemo(() => {
    const seen = new Set(rawSlips.filter(s => String(s.slipType) === 'sales').map(s => `${s.slipDate}|${s.totalAmount}`));
    const kept = rawSlips.filter(s => !(s.slipType === 'SALES' && seen.has(`${s.slipDate}|${s.totalAmount}`)));
    return { slips: kept, dupCount: rawSlips.length - kept.length };
  }, [rawSlips]);

  const latestDate = useMemo(
    () => slips.reduce((m, s) => (s.slipDate > m ? s.slipDate : m), '') || new Date().toISOString().slice(0, 10),
    [slips]
  );
  const [day, setDay] = useState<string>(latestDate);
  const [from, setFrom] = useState<string>(latestDate.slice(0, 7) + '-01');
  const [to, setTo] = useState<string>(latestDate);
  const [year, setYear] = useState<string>(latestDate.slice(0, 4));
  const [phoneQuery, setPhoneQuery] = useState<string>('');

  // ───────── 일계표 ─────────
  const daily = useMemo(() => {
    const day_slips = slips.filter(s => s.slipDate === day);
    const sum = { sales: 0, purchase: 0, salesReturn: 0, purchaseReturn: 0, tax: 0, cash: 0, credit: 0 };
    day_slips.forEach(s => {
      const k = kindOf(s);
      if (k === 'other') return;
      sum[k] += s.totalAmount || 0;
      if (k === 'sales') {
        sum.tax += s.totalTaxAmount || 0;
        sum.cash += s.paidAmount || 0;
        sum.credit += s.unpaidAmount || 0;
      }
    });
    const dayColl = collections.filter(c => c.date === day);
    const collected = dayColl.filter(c => c.type === 'collection').reduce((a, c) => a + c.amount, 0);
    const paid = dayColl.filter(c => c.type === 'payment').reduce((a, c) => a + c.amount, 0);
    return { day_slips, sum, collected, paid };
  }, [slips, collections, day]);

  // 거래처별 일계표 — 원본 DailyBalanceTable 열(Kind·CustomerName·SalesBuyingAmount·ReturnAmount·ReceiptPaymentAmount), 정렬 «Kind, SalesBuyingAmount 내림차순», 합계 «매출계/월매출계».
  // 집계식은 원본 호출자 추적 실패로 미확인 — 열 의미(매출·반품·수금)에 맞춘 추정 구현이다.
  const dailyByCust = useMemo(() => {
    type R = { id: string; name: string; amt: number; ret: number; rcp: number };
    const build = (side: 'sales' | 'purchase', inRange: (d: string) => boolean) => {
      const m = new Map<string, R>();
      const get = (id: string, name: string) => { if (!m.has(id)) m.set(id, { id, name, amt: 0, ret: 0, rcp: 0 }); return m.get(id)!; };
      slips.forEach(sl => {
        if (!inRange(sl.slipDate)) return;
        const k = kindOf(sl);
        if (k === side) { const r = get(sl.customerId, sl.customerName); r.amt += sl.totalAmount || 0; r.rcp += sl.paidAmount || 0; }
        else if ((side === 'sales' && k === 'salesReturn') || (side === 'purchase' && k === 'purchaseReturn')) get(sl.customerId, sl.customerName).ret += sl.totalAmount || 0;
      });
      collections.forEach(c => {
        if (!inRange(c.date) || c.type !== (side === 'sales' ? 'collection' : 'payment')) return;
        get(c.customerId, c.customerName).rcp += c.amount;
      });
      const rows = [...m.values()].filter(r => r.amt || r.ret || r.rcp).sort((a, b) => b.amt - a.amt);
      const tot = rows.reduce((t, r) => ({ amt: t.amt + r.amt, ret: t.ret + r.ret, rcp: t.rcp + r.rcp }), { amt: 0, ret: 0, rcp: 0 });
      return { rows, tot };
    };
    const mon = day.slice(0, 7);
    return {
      sales: build('sales', d => d === day), purchase: build('purchase', d => d === day),
      monSales: build('sales', d => d.slice(0, 7) === mon && d <= day).tot, monPurchase: build('purchase', d => d.slice(0, 7) === mon && d <= day).tot
    };
  }, [slips, collections, day]);

  // ───────── 현금출납부 ─────────
  const cashbook = useMemo(() => {
    type Entry = { date: string; desc: string; inAmt: number; outAmt: number };
    const all: Entry[] = [];
    slips.forEach(s => {
      const k = kindOf(s);
      if (k === 'sales' && s.paidAmount > 0 && s.paymentType !== 'card')
        all.push({ date: s.slipDate, desc: `매출 현금 ${s.customerName} (${s.slipNo})`, inAmt: s.paidAmount, outAmt: 0 });
      if (k === 'purchase' && s.paidAmount > 0 && s.paymentType !== 'card')
        all.push({ date: s.slipDate, desc: `매입 현금 ${s.customerName} (${s.slipNo})`, inAmt: 0, outAmt: s.paidAmount });
    });
    collections.forEach(c => {
      if (c.method !== 'cash') return; // 통장·어음은 현금 아님
      if (c.type === 'collection') all.push({ date: c.date, desc: `수금 ${c.customerName}`, inAmt: c.amount, outAmt: 0 });
      else all.push({ date: c.date, desc: `지급 ${c.customerName}`, inAmt: 0, outAmt: c.amount });
    });
    all.sort((a, b) => a.date.localeCompare(b.date));
    const opening = all.filter(e => e.date < from).reduce((a, e) => a + e.inAmt - e.outAmt, 0);
    let bal = opening;
    const rows = all
      .filter(e => e.date >= from && e.date <= to)
      .map(e => {
        bal += e.inAmt - e.outAmt;
        return { ...e, bal };
      });
    return { opening, rows, totalIn: rows.reduce((a, r) => a + r.inAmt, 0), totalOut: rows.reduce((a, r) => a + r.outAmt, 0), closing: bal };
  }, [slips, collections, from, to]);

  // 기초잔액(도입 시점 미수 +·미지급 −) — 원본은 연도 이월 잔액을 저장하지 않으므로(Balance AC00 전 파일 0) 직접 입력받아 system_config에 보관한다.
  const [opening, setOpening] = useState<{ asOf: string; byCustomer: Record<string, number> }>({ asOf: '', byCustomer: {} });
  const [openingEdit, setOpeningEdit] = useState(false);
  const [openingMsg, setOpeningMsg] = useState('');
  useEffect(() => {
    fetch('/api/config').then(r => (r.ok ? r.json() : null)).then(c => { if (c?.openingBalances?.byCustomer) setOpening(c.openingBalances); }).catch(() => {});
  }, []);
  const saveOpening = async (next: typeof opening) => {
    try {
      const cur = await fetch('/api/config').then(r => (r.ok ? r.json() : {}));
      const res = await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...cur, openingBalances: next }) });
      if (!res.ok) throw new Error(String(res.status));
      setOpening(next); setOpeningMsg('저장했습니다.');
    } catch { setOpeningMsg('저장에 실패했습니다. 잠시 뒤 다시 시도하세요.'); }
  };

  const [rcvMode, setRcvMode] = useState<'month' | 'quarter'>('month');
  const [qtr, setQtr] = useState<1 | 2 | 3 | 4>(1);
  const quarter = useMemo(() => {
    const name = new Map(customers.map(c => [c.id, c.name]));
    // 초기이월금(거래처별)을 반영한 전표·수금: 입력한 거래처만 기준일 이전 거래를 빼고, 올해 이전 거래는 «전기 잔액»에 모두 얹는다.
    const eff = withOpening(slips, collections, opening);
    const sl = eff.slips, co = eff.collections;
    const base = new Map<string, number>(eff.base);
    netBetween(sl, co, '0000-00-00', `${year}-01-01`).forEach((v, id) => base.set(id, (base.get(id) || 0) + v));
    const rows = quarterSummary(sl, co, year, qtr, base).map(r => ({ ...r, name: name.get(r.id) || r.id }));
    const recv = rows.filter(r => r.balance >= 0).sort((a, b) => b.balance - a.balance);
    const pay = rows.filter(r => r.balance < 0).sort((a, b) => a.balance - b.balance);
    return { recv, pay };
  }, [slips, collections, customers, year, qtr, opening]);

  const [stockQ, setStockQ] = useState('');
  const stockflow = useMemo(() => {
    const q = stockQ.trim().toLowerCase();
    const opening = new Map(products.map(p => [p.id, p.openingStock || 0]));
    const rows = monthlyStock(slips as any, year).map(r => ({ ...r, open: opening.get(r.productId) || 0, close: (opening.get(r.productId) || 0) + r.net.reduce((a, b) => a + b, 0) })).filter(r => !q || `${r.name} ${r.spec}`.toLowerCase().includes(q)).sort((a, b) => b.outQty + b.inQty - (a.outQty + a.inQty));
    return rows;
  }, [slips, year, stockQ, products]);

  const [ledgerCust, setLedgerCust] = useState<string>('');
  const ledgerOptions = useMemo(() => {
    const cnt = new Map<string, number>();
    slips.forEach(s => cnt.set(s.customerId, (cnt.get(s.customerId) || 0) + 1));
    const name = new Map(customers.map(c => [c.id, c.name]));
    return [...cnt.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => ({ id, name: name.get(id) || id }));
  }, [slips, customers]);
  const ledger = useMemo(() => {
    const id = ledgerCust || ledgerOptions[0]?.id || '';
    const eff2 = withOpening(slips, collections, opening);
    return { id, ...customerLedger(eff2.slips as any, eff2.collections, id, from, to, eff2.base.get(id) || 0) };
  }, [slips, collections, ledgerCust, ledgerOptions, from, to, opening]);

  // ───────── 미수·미지급 집계표(원본 Balance 규칙) ─────────
  const receivable = useMemo(() => {
    const net = monthlyNet(slips, collections, year);
    const name = new Map(customers.map(c => [c.id, c.name]));
    const rows = [...net.entries()].map(([id, m]) => ({ id, name: name.get(id) || id, m, total: m.reduce((a, b) => a + b, 0) }))
      .filter(r => r.total !== 0 || r.m.some(v => v !== 0)).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
    const sum = Array(12).fill(0) as number[];
    rows.forEach(r => r.m.forEach((v, i) => (sum[i] += v)));
    return { rows, sum };
  }, [slips, collections, customers, year]);

  // ───────── 월·분기 집계표 ─────────
  const period = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const blank = () => ({ sales: 0, purchase: 0, salesReturn: 0, purchaseReturn: 0, collected: 0, paid: 0 });
    const byMonth: Record<string, ReturnType<typeof blank>> = Object.fromEntries(months.map(m => [m, blank()]));
    slips.forEach(s => {
      const k = kindOf(s);
      const m = byMonth[monthOf(s.slipDate)];
      if (m && k !== 'other') m[k] += s.totalAmount || 0;
    });
    collections.forEach(c => {
      const m = byMonth[monthOf(c.date)];
      if (!m) return;
      if (c.type === 'collection') m.collected += c.amount;
      else m.paid += c.amount;
    });
    const quarters = [0, 1, 2, 3].map(q => {
      const t = blank();
      months.slice(q * 3, q * 3 + 3).forEach(m => (Object.keys(t) as (keyof typeof t)[]).forEach(k => (t[k] += byMonth[m][k])));
      return t;
    });
    // 거래처별 매출·매입 집계(선택 연도 전체)
    const byCust = new Map<string, { name: string; sales: number; purchase: number }>();
    slips.forEach(s => {
      if (!s.slipDate.startsWith(year)) return;
      const k = kindOf(s);
      if (k !== 'sales' && k !== 'purchase') return;
      const row = byCust.get(s.customerId) || { name: s.customerName, sales: 0, purchase: 0 };
      row[k] += s.totalAmount || 0;
      byCust.set(s.customerId, row);
    });
    const custRows = [...byCust.values()].sort((a, b) => b.sales + b.purchase - (a.sales + a.purchase));
    return { months, byMonth, quarters, custRows };
  }, [slips, collections, year]);

  // ───────── 부가세 집계 ─────────
  const vat = useMemo(() => {
    // 세금계산서 발행이력 기준. 종류가 비어 있는 옛 자료는 매출(1)로 본다(오케이세일 기본값). 날짜가 깨진 건(예: 8888-..)은 연도 필터에서 자연히 빠진다.
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const blank = (): VatRow => ({ sSupply: 0, sTax: 0, sCnt: 0, pSupply: 0, pTax: 0, pCnt: 0 });
    const byMonth: Record<string, VatRow> = Object.fromEntries(months.map(m => [m, blank()]));
    taxInvoices.forEach(t => {
      const m = byMonth[monthOf(t.taxDate || '')];
      if (!m) return;
      if (String(t.taxKind) === '2') {
        m.pSupply += t.supplyAmount || 0;
        m.pTax += t.taxAmount || 0;
        m.pCnt += 1;
      } else {
        m.sSupply += t.supplyAmount || 0;
        m.sTax += t.taxAmount || 0;
        m.sCnt += 1;
      }
    });
    const quarters = [0, 1, 2, 3].map(q => {
      const t = blank();
      months.slice(q * 3, q * 3 + 3).forEach(m => (Object.keys(t) as (keyof typeof t)[]).forEach(k => (t[k] += byMonth[m][k])));
      return t;
    });
    const years = [...new Set(taxInvoices.map(t => (t.taxDate || '').slice(0, 4)).filter(y => /^(19|20)\d\d$/.test(y)))].sort();
    return { months, byMonth, quarters, years };
  }, [taxInvoices, year]);

  // ───────── 단가표 ─────────
  // ───────── 거래처별 집계표(원본 CustomerSummaryPrintTable: 전기이월·매입·매입세·지급·매출·매출세·수금·잔액) ─────────
  // 집계식은 원본 호출자 추적 실패로 미확인 — 열 의미에 맞춘 추정 구현(잔액=전기이월+매출−수금−매입+지급, 할인은 잔액에만 반영).
  const custSum = useMemo(() => {
    const eff = withOpening(slips, collections, opening);
    const before = netBetween(eff.slips, eff.collections, '0000-00-00', from);
    const upTo = netBetween(eff.slips, eff.collections, '0000-00-00', to + '~');
    type R = { id: string; name: string; before: number; buy: number; buyVat: number; pay: number; sale: number; saleVat: number; rcp: number; bal: number };
    const m = new Map<string, R>();
    const get = (id: string, name: string) => { if (!m.has(id)) m.set(id, { id, name, before: 0, buy: 0, buyVat: 0, pay: 0, sale: 0, saleVat: 0, rcp: 0, bal: 0 }); return m.get(id)!; };
    slips.forEach(sl => {
      if (sl.slipDate < from || sl.slipDate > to) return;
      const k = kindOf(sl); const r = get(sl.customerId, sl.customerName);
      if (k === 'sales') { r.sale += sl.totalAmount || 0; r.saleVat += sl.totalTaxAmount || 0; r.rcp += sl.paidAmount || 0; }
      else if (k === 'salesReturn') { r.sale -= sl.totalAmount || 0; r.saleVat -= sl.totalTaxAmount || 0; }
      else if (k === 'purchase') { r.buy += sl.totalAmount || 0; r.buyVat += sl.totalTaxAmount || 0; r.pay += sl.paidAmount || 0; }
      else if (k === 'purchaseReturn') { r.buy -= sl.totalAmount || 0; r.buyVat -= sl.totalTaxAmount || 0; }
    });
    collections.forEach(c => {
      if (c.date < from || c.date > to) return;
      const r = get(c.customerId, c.customerName);
      if (c.type === 'collection') r.rcp += c.amount; else r.pay += c.amount;
    });
    const rows = [...m.values()].map(r => {
      const b = (before.get(r.id) || 0) + (eff.base.get(r.id) || 0);
      return { ...r, before: b, bal: (upTo.get(r.id) || 0) + (eff.base.get(r.id) || 0) };
    }).filter(r => r.before || r.buy || r.pay || r.sale || r.rcp || r.bal).sort((a, b) => b.sale - a.sale || b.buy - a.buy);
    const tot = rows.reduce((t, r) => ({ before: t.before + r.before, buy: t.buy + r.buy, buyVat: t.buyVat + r.buyVat, pay: t.pay + r.pay, sale: t.sale + r.sale, saleVat: t.saleVat + r.saleVat, rcp: t.rcp + r.rcp, bal: t.bal + r.bal }), { before: 0, buy: 0, buyVat: 0, pay: 0, sale: 0, saleVat: 0, rcp: 0, bal: 0 });
    return { rows, tot };
  }, [slips, collections, opening, from, to]);

  // ───────── 거래내역 조회(원본 SalesQuery·PostBook·SiteBook 인쇄표 열: 일자·구분·품목·규격·단위·수량·단가·금액·세액·거래처·현장) ─────────
  const [qKind, setQKind] = useState<string>('all');
  const [qCust, setQCust] = useState<string>('');
  const [qSite, setQSite] = useState<string>('');
  const [qProd, setQProd] = useState<string>('');
  const KIND_NAME: Record<string, string> = { sales: '매출', purchase: '매입', salesReturn: '매출반품', purchaseReturn: '매입반품', other: '기타' };
  const queryRows = useMemo(() => {
    const rows: { date: string; kind: string; cust: string; site: string; name: string; spec: string; unit: string; qty: number; price: number; amount: number; tax: number; no: string }[] = [];
    slips.forEach(sl => {
      if (sl.slipDate < from || sl.slipDate > to) return;
      const k = kindOf(sl); if (k === 'other') return;
      if (qKind !== 'all' && qKind !== k) return;
      if (qCust && !sl.customerName.includes(qCust)) return;
      if (qSite && !(sl.siteName || '').includes(qSite)) return;
      (sl.items || []).forEach(it => {
        if (qProd && !`${it.productName} ${it.spec}`.includes(qProd)) return;
        rows.push({ date: sl.slipDate, kind: KIND_NAME[k], cust: sl.customerName, site: sl.siteName || '', name: it.productName, spec: it.spec || '', unit: it.unit || '', qty: it.qty, price: it.unitPrice, amount: it.supplyAmount, tax: it.taxAmount, no: sl.slipNo });
      });
    });
    return rows.sort((a, b) => a.date.localeCompare(b.date) || a.no.localeCompare(b.no));
  }, [slips, from, to, qKind, qCust, qSite, qProd]);

  // ───────── 세금계산서 장부(원본 TaxBook·TaxList·SaleTaxList·BuyTaxList: 일자·구분·거래처·현장·공급가·세액·합계·품명) ─────────
  const [tbKind, setTbKind] = useState<string>('all');
  const [tbQ, setTbQ] = useState<string>('');
  const taxBook = useMemo(() => {
    const q = tbQ.trim();
    const rows = (taxInvoices || []).filter(t => {
      if (t.taxDate < from || t.taxDate > to) return false;
      const k = t.taxKind === '2' || t.taxKind === 'B' ? 'purchase' : 'sales';
      if (tbKind !== 'all' && tbKind !== k) return false;
      return !q || `${t.customerName} ${t.postName || ''} ${t.productSummary}`.includes(q);
    }).sort((a, b) => a.taxDate.localeCompare(b.taxDate) || a.taxNo.localeCompare(b.taxNo));
    const sum = (k: 'sales' | 'purchase') => rows.filter(t => (t.taxKind === '2' || t.taxKind === 'B' ? 'purchase' : 'sales') === k).reduce((a, t) => ({ supply: a.supply + t.supplyAmount, tax: a.tax + t.taxAmount, total: a.total + t.totalAmount, n: a.n + 1 }), { supply: 0, tax: 0, total: 0, n: 0 });
    return { rows, sales: sum('sales'), purchase: sum('purchase') };
  }, [taxInvoices, from, to, tbKind, tbQ]);

  // ───────── 품목·재고 현황(원본 ProductsList·PRODUCTS·Gaego: 품명·규격·단위·수량·단가·금액) ─────────
  const [plQ, setPlQ] = useState<string>('');
  const [plStockOnly, setPlStockOnly] = useState(false);
  const prodList = useMemo(() => {
    const q = plQ.trim();
    const rows = (products || []).filter(p => (!q || `${p.name} ${p.spec} ${p.code}`.includes(q)) && (!plStockOnly || (p.currentStock || 0) !== 0))
      .map(p => ({ code: p.code, name: p.name, spec: p.spec || '', unit: p.unit || '', stock: p.currentStock || 0, cost: p.costPrice || 0, sell: p.sellingPrice || 0, value: (p.currentStock || 0) * (p.costPrice || 0) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.spec.localeCompare(b.spec, 'ko', { numeric: true }));
    return { rows, totalValue: rows.reduce((a, r) => a + r.value, 0) };
  }, [products, plQ, plStockOnly]);

  // ───────── 거래처 목록(원본 Customer·Customer1 인쇄표) ─────────
  const [clQ, setClQ] = useState<string>('');
  const custList = useMemo(() => {
    const q = clQ.trim();
    return customers.filter(c => !q || `${c.name} ${c.ceo} ${c.bizNumber} ${c.tel}`.includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [customers, clQ]);

  // ───────── 일계 상세(원본 DailyDetailBalancePrintTable: 일자·구분·거래처·품명·규격·단위·수량·단가·금액·세액·잔액) ─────────
  // 그날 거래가 있는 거래처마다 거래처 원장 규칙으로 줄과 거래 직후 잔액을 구한다(집계식은 원본 호출자 추적 실패로 추정).
  const dailyDetail = useMemo(() => {
    const eff = withOpening(slips, collections, opening);
    const ids = new Map<string, string>();
    slips.forEach(sl => { if (sl.slipDate === day && kindOf(sl) !== 'other') ids.set(sl.customerId, sl.customerName); });
    collections.forEach(c => { if (c.date === day) ids.set(c.customerId, c.customerName); });
    const costOf = new Map(products.map(pr => [`${pr.name}|${pr.spec || ''}`, pr.costPrice || 0]));
    const rows: (LedgerRow & { cust: string; cost: number | null; profit: number | null })[] = [];
    [...ids.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ko')).forEach(([id, name]) => {
      customerLedger(eff.slips as any, eff.collections, id, day, day, eff.base.get(id) || 0).rows.forEach(r => {
        const c0 = r.kind === '매출' && r.qty != null ? costOf.get(`${r.productName}|${r.spec}`) : undefined;
        const cost = c0 && c0 > 0 ? c0 : null; // 매입가가 비어 있는 품목은 원가 미입력 — 이익 100%로 보이지 않게 비운다
        rows.push({ ...r, cust: name, cost, profit: cost != null && r.qty != null ? r.amount - cost * r.qty : null });
      });
    });
    // 원본 DailyDetailBalance 머리줄: 매출계·원가계·이익계·이익율·수금액·매입계·세액·지급액
    const sum = (f: (r: typeof rows[number]) => boolean, g: (r: typeof rows[number]) => number) => rows.filter(f).reduce((a, r) => a + g(r), 0);
    const salesTot = sum(r => r.kind === '매출', r => r.amount), costTot = sum(r => r.cost != null, r => (r.cost || 0) * (r.qty || 0)), profitTot = sum(r => r.profit != null, r => r.profit || 0);
    const costBase = sum(r => r.cost != null, r => r.amount);
    const head = { salesTot, costTot, profitTot, rate: costBase ? (profitTot / costBase) * 100 : 0, rcp: sum(r => r.kind === '수금', r => r.amount), buyTot: sum(r => r.kind === '매입', r => r.amount), tax: sum(r => true, r => r.tax), paid: sum(r => r.kind === '지급', r => r.amount) };
    return { rows, head };
  }, [slips, collections, opening, day, products]);

  // ───────── 현장별 장부(원본 SiteBook·PostBook) · 수금·지급 집계(ReceiptPaymentSummary) · 어음 장부(ReceiptBill·PaymentBill) · 품목별 집계(SubulSummary·SubulSummaryAmount) · 전표 현황(rptSlipStatus) ─────────
  // 열은 원본 인쇄표 열을 따르고 집계식은 원본 호출자 추적 실패로 추정이다.
  const siteBook = useMemo(() => {
    const m = new Map<string, { cust: string; site: string; n: number; sales: number; purchase: number }>();
    slips.forEach(sl => {
      if (sl.slipDate < from || sl.slipDate > to) return;
      const k = kindOf(sl); if (k !== 'sales' && k !== 'purchase') return;
      const site = sl.siteName || '(현장 없음)'; const key = `${sl.customerId}|${site}`;
      const r = m.get(key) || { cust: sl.customerName, site, n: 0, sales: 0, purchase: 0 }; r.n++;
      if (k === 'sales') r.sales += sl.totalAmount || 0; else r.purchase += sl.totalAmount || 0; m.set(key, r);
    });
    const rows = [...m.values()].sort((a, b) => a.cust.localeCompare(b.cust, 'ko') || a.site.localeCompare(b.site, 'ko'));
    return { rows: rows.map(r => [r.cust, r.site, r.n, r.sales, r.purchase] as (string | number)[]), tot: rows.reduce((t, r) => [t[0] + r.n, t[1] + r.sales, t[2] + r.purchase], [0, 0, 0]) };
  }, [slips, from, to]);

  const rcpSum = useMemo(() => {
    const m = new Map<string, { name: string; cash: number; bank: number; bill: number; disc: number; paid: number; pbill: number }>();
    collections.forEach(c => {
      if (c.date < from || c.date > to) return;
      const r = m.get(c.customerId) || { name: c.customerName, cash: 0, bank: 0, bill: 0, disc: 0, paid: 0, pbill: 0 };
      if (c.type === 'collection') { if (c.method === 'cash') r.cash += c.amount; else if (c.method === 'bank') r.bank += c.amount; else r.bill += c.amount; r.disc += c.discount || 0; }
      else r.paid += c.amount;
      m.set(c.customerId, r);
    });
    const rows = [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return { rows: rows.map(r => [r.name, r.cash, r.bank, r.bill, r.cash + r.bank + r.bill, r.disc, r.paid] as (string | number)[]), tot: rows.reduce((t, r) => [t[0] + r.cash, t[1] + r.bank, t[2] + r.bill, t[3] + r.cash + r.bank + r.bill, t[4] + r.disc, t[5] + r.paid], [0, 0, 0, 0, 0, 0]) };
  }, [collections, from, to]);

  const [bbKind, setBbKind] = useState<string>('all');
  const billBook = useMemo(() => {
    const rows = (bills || []).filter(b => (bbKind === 'all' || b.billKind === bbKind) && b.dueDate >= from && b.dueDate <= to)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return { rows: rows.map(b => [b.dueDate, b.billKind, b.billNo, b.customerName, b.bank, b.status, b.amount] as (string | number)[]), total: rows.reduce((a, b) => a + b.amount, 0) };
  }, [bills, bbKind, from, to]);

  // 상품매입매출집계표(원본 SubulSummaryAmount): 품명·단위·규격 — 매입·반입·매출·반출 수량과 금액
  const prodSum = useMemo(() => {
    type A = { name: string; spec: string; unit: string; q: [number, number, number, number]; a: [number, number, number, number] };
    const m = new Map<string, A>();
    const idx: Record<string, number> = { purchase: 0, salesReturn: 1, sales: 2, purchaseReturn: 3 };
    slips.forEach(sl => {
      if (sl.slipDate < from || sl.slipDate > to) return;
      const k = kindOf(sl); if (k === 'other') return;
      (sl.items || []).forEach(it => {
        const key = `${it.productName}|${it.spec}`; const r = m.get(key) || { name: it.productName, spec: it.spec || '', unit: it.unit || '', q: [0, 0, 0, 0], a: [0, 0, 0, 0] };
        r.q[idx[k]] += it.qty; r.a[idx[k]] += it.supplyAmount; m.set(key, r);
      });
    });
    const rows = [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.spec.localeCompare(b.spec, 'ko', { numeric: true }));
    const tot = rows.reduce((t, r) => t.map((x, i) => x + r.a[i]), [0, 0, 0, 0]);
    return { rows: rows.map(r => [r.name, r.spec, r.unit, ...r.q, ...r.a] as (string | number)[]), tot };
  }, [slips, from, to]);

  // 상품수불집계표(원본 SubulSummary): 전재고·매입·반입·매출·반출·현재고·매입가·재고액 (재고 부호는 월별 재고 수불과 같은 규칙: 매입+·반입+·매출−·반출−)
  const subulSum = useMemo(() => {
    const m = new Map<string, { name: string; spec: string; unit: string; pid: string; before: number; q: [number, number, number, number] }>();
    slips.forEach(sl => {
      const k = kindOf(sl); if (k === 'other') return;
      const sg = k === 'sales' || k === 'purchaseReturn' ? -1 : 1;
      (sl.items || []).forEach(it => {
        const key = `${it.productName}|${it.spec}`; const r = m.get(key) || { name: it.productName, spec: it.spec || '', unit: it.unit || '', pid: it.productId, before: 0, q: [0, 0, 0, 0] };
        if (sl.slipDate < from) r.before += sg * it.qty;
        else if (sl.slipDate <= to) r.q[{ purchase: 0, salesReturn: 1, sales: 2, purchaseReturn: 3 }[k]] += it.qty;
        m.set(key, r);
      });
    });
    const byId = new Map(products.map(pr => [`${pr.name}|${pr.spec || ''}`, pr]));
    const rows = [...m.entries()].map(([key, r]) => {
      const pr = byId.get(key); const open = (pr?.openingStock || 0) + r.before;
      const cur = open + r.q[0] + r.q[1] - r.q[2] - r.q[3]; const cost = pr?.costPrice || 0;
      return [r.name, r.unit, r.spec, open, ...r.q, cur, cost, cur * cost] as (string | number)[];
    }).filter(r => r.slice(3, 9).some(v => v !== 0)).sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'ko') || String(a[2]).localeCompare(String(b[2]), 'ko', { numeric: true }));
    return { rows, tot: rows.reduce((t, r) => t + (r[10] as number), 0) };
  }, [slips, products, from, to]);

  // 상품수불장(원본 Subul·ProductsList): 한 품목의 일자별 입고·출고·잔고(거래처·현장 표시)
  const [sbQ, setSbQ] = useState<string>('');
  const subulBook = useMemo(() => {
    const q = sbQ.trim(); if (!q) return { rows: [] as (string | number)[][], open: 0, name: '' };
    const keyMatch = (it: { productName: string; spec?: string }) => `${it.productName} ${it.spec || ''}`.includes(q);
    const ev: { d: string; no: string; kind: string; who: string; site: string; qty: number; price: number; amt: number; sg: number; spec: string; unit: string }[] = [];
    slips.forEach(sl => {
      const k = kindOf(sl); if (k === 'other') return;
      const sg = k === 'sales' || k === 'purchaseReturn' ? -1 : 1;
      (sl.items || []).forEach(it => { if (keyMatch(it)) ev.push({ d: sl.slipDate, no: sl.slipNo, kind: KIND_NAME[k], who: sl.customerName, site: sl.siteName || '', qty: it.qty, price: it.unitPrice, amt: it.supplyAmount, sg, spec: it.spec || '', unit: it.unit || '' }); });
    });
    ev.sort((a, b) => a.d.localeCompare(b.d) || a.no.localeCompare(b.no));
    const open0 = products.filter(pr => `${pr.name} ${pr.spec || ''}`.includes(q)).reduce((a, pr) => a + (pr.openingStock || 0), 0);
    let bal = open0; const rows: (string | number)[][] = [];
    ev.forEach(e => { bal += e.sg * e.qty; if (e.d >= from && e.d <= to) rows.push([e.d, e.kind, `${e.who}${e.site ? ` / ${e.site}` : ''}`, e.spec, e.sg > 0 ? e.qty : '', e.sg < 0 ? e.qty : '', e.price, e.amt, bal, e.unit]); });
    return { rows, open: open0, name: q };
  }, [slips, products, sbQ, from, to]);

  // 수금지급조회(원본 AccountBook: 일자·구분·수금·지급·적요) — 수금지급 입력 화면 건 + 전표 동시 수금·지급
  const rcpQuery = useMemo(() => {
    const rows: { d: string; kind: string; rcp: number; pay: number; memo: string }[] = [];
    collections.forEach(c => { if (c.date >= from && c.date <= to) rows.push({ d: c.date, kind: c.type === 'collection' ? '수금' : '지급', rcp: c.type === 'collection' ? c.amount : 0, pay: c.type === 'payment' ? c.amount : 0, memo: `${c.customerName} (${c.method === 'cash' ? '현금' : c.method === 'bank' ? '통장' : '어음'})${c.memo ? ' ' + c.memo : ''}` }); });
    slips.forEach(sl => {
      if (sl.slipDate < from || sl.slipDate > to || !sl.paidAmount) return;
      const k = kindOf(sl);
      if (k === 'sales') rows.push({ d: sl.slipDate, kind: '수금', rcp: sl.paidAmount, pay: 0, memo: `${sl.customerName} (전표 동시 ${sl.slipNo})` });
      else if (k === 'purchase') rows.push({ d: sl.slipDate, kind: '지급', rcp: 0, pay: sl.paidAmount, memo: `${sl.customerName} (전표 동시 ${sl.slipNo})` });
    });
    rows.sort((a, b) => a.d.localeCompare(b.d));
    return { rows: rows.map(r => [r.d, r.kind, r.rcp, r.pay, r.memo] as (string | number)[]), tot: [rows.reduce((a, r) => a + r.rcp, 0), rows.reduce((a, r) => a + r.pay, 0)] };
  }, [collections, slips, from, to]);

  const slipStatus = useMemo(() => {
    const kinds: [string, string][] = [['sales', '매출'], ['purchase', '매입'], ['salesReturn', '반입'], ['purchaseReturn', '반출']];
    const m = new Map<string, Record<string, number>>();
    slips.forEach(sl => {
      if (sl.slipDate < from || sl.slipDate > to) return;
      const k = kindOf(sl); const ym = monthOf(sl.slipDate); const r = m.get(ym) || {};
      const key = k === 'other' ? String(sl.slipType).toLowerCase() : k; r[key] = (r[key] || 0) + 1; r.total = (r.total || 0) + 1; m.set(ym, r);
    });
    const rows = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([ym, r]) => [ym, ...kinds.map(([k]) => r[k] || 0), (r.estimate || 0), (r.order || 0), (r.delivery || 0), (r.contract || 0), r.total || 0] as (string | number)[]);
    const tot = rows.reduce((t, r) => t.map((x, i) => x + (r[i + 1] as number)), new Array(9).fill(0));
    return { rows, tot };
  }, [slips, from, to]);

  const [priceCustomer, setPriceCustomer] = useState<string>('');
  const [priceQuery, setPriceQuery] = useState<string>('');
  const priceCustomers = useMemo(
    () =>
      customers
        .map(c => ({ c, map: customerPrices[c.code] || customerPrices[String(c.id).replace(/^c-/, '')] }))
        .filter(x => x.map && Object.keys(x.map).length > 0),
    [customers, customerPrices]
  );
  const priceRows = useMemo(() => {
    const hit = priceCustomers.find(x => x.c.id === priceCustomer) || priceCustomers[0];
    if (!hit) return { name: '', rows: [] as { code: string; name: string; spec: string; p1: number; p2: number; p3: number }[] };
    const q = priceQuery.trim().toLowerCase();
    const rows = Object.entries(hit.map as Record<string, any>)
      .map(([code, v]) => ({ code, name: v.productName || '', spec: v.spec || '', p1: v.price1 || 0, p2: v.price2 || 0, p3: v.price3 || 0 }))
      .filter(r => !q || r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.spec.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return { name: hit.c.name, rows };
  }, [priceCustomers, priceCustomer, priceQuery]);

  // ───────── 연말 이월(미수금 기준) ─────────
  const yearEnd = useMemo(() => {
    // 거래처 미수금 필드가 비어 있어 전표·수금의 누적으로 계산한다(데이터 시작 이전 이월은 0으로 본다).
    // 연도 증감 = 외상 매출(미수) − 매출반품 − 수금.
    const net = new Map<string, Map<string, number>>(); // customerId → year → delta
    const add = (id: string, y: string, v: number) => {
      const m = net.get(id) || new Map<string, number>();
      m.set(y, (m.get(y) || 0) + v);
      net.set(id, m);
    };
    const nameOf = new Map(customers.map(c => [c.id, c]));
    const effY = withOpening(slips, collections, opening);
    effY.slips.forEach(s => {
      const k = kindOf(s);
      if (k === 'sales') add(s.customerId, s.slipDate.slice(0, 4), s.unpaidAmount || 0);
      if (k === 'salesReturn') add(s.customerId, s.slipDate.slice(0, 4), -(s.totalAmount || 0));
    });
    effY.collections.forEach(c => {
      if (c.type === 'collection') add(c.customerId, c.date.slice(0, 4), -(c.amount + (c.discount || 0)));
    });
    effY.base.forEach((v, id) => add(id, '0000', v)); // 초기이월금은 가장 이른 해 앞에 얹는다
    const rows = [...net.entries()]
      .map(([id, m]) => {
        let opening = 0;
        m.forEach((v, y) => {
          if (y < year) opening += v;
        });
        const change = m.get(year) || 0;
        const c = nameOf.get(id);
        return { id, code: c?.code || '', name: c?.name || id, opening, change, closing: opening + change };
      })
      .filter(r => r.opening !== 0 || r.change !== 0)
      .sort((a, b) => b.closing - a.closing);
    const years = [...new Set(slips.map(s => s.slipDate.slice(0, 4)))].sort();
    return { rows, years };
  }, [slips, collections, customers, year]);

  // ───────── 전화번호부 ─────────
  const phonebook = useMemo(() => {
    const q = phoneQuery.trim().toLowerCase();
    const rows = customers.flatMap(c => {
      const base = { code: c.code, name: c.name, who: c.ceo, tel: c.tel, mobile: c.mobile, fax: c.fax, email: c.email, place: c.address };
      const sites = (c.sites || []).map(s => ({ code: s.siteCode, name: `${c.name} · ${s.siteName}`, who: s.manager, tel: s.tel, mobile: undefined, fax: undefined, email: undefined, place: s.address }));
      return [base, ...sites];
    });
    return rows.filter(r => !q || [r.name, r.who, r.tel, r.mobile, r.fax, r.email].some(v => v && String(v).toLowerCase().includes(q)));
  }, [customers, phoneQuery]);

  // ───────── 원본 양식 인쇄(RptReportPrint) — 화면의 줄을 원본 .rpt 필드 이름으로 바꿔 복원한 좌표에 찍는다 ─────────
  const [rptOpen, setRptOpen] = useState<number | null>(null);
  // 이관 데이터의 전화번호에는 원본 입력 마스크(«__02)2267-1300»·«--»)가 남아 있다 — 숫자가 없으면 빈칸, 있으면 밑줄과 앞쪽 기호만 뺀다.
  const cleanTel = (v?: string) => (v && /\d/.test(v) ? v.replace(/_/g, '').replace(/^[-)\s]+/, '').trim() : '');
  type RptSpec = { key: string; title: string; rows: RptRow[]; params: Record<string, string> };
  const rptSpecs = useMemo((): RptSpec[] => {
    const co = company?.name || '동산화스너';
    const base = { FromDate: from, ToDate: to, UserCompanyName: co };
    const one = ((): RptSpec | RptSpec[] | null => {
    switch (section) {
      case 'cashbook': return { key: 'CashBook', title: '현금출납부', params: { ...base, CustomerName: '', AccountName: '현금' }, rows: [{ AccountDate: '', Comments: '전기 이월', Balance: cashbook.opening }, ...cashbook.rows.map(r => ({ AccountDate: r.date, Comments: r.desc, CreditAmount: r.inAmt, DebitAmount: r.outAmt, Balance: r.bal }))] };
      case 'ledger': { const nm = (ledgerOptions.find(o => o.id === ledger.id)?.name) || ''; return { key: 'CustomerBook', title: '거래처별원장', params: { ...base, CustomerCompanyName: nm }, rows: [{ ProductName: '전기 이월', Balance: ledger.opening }, ...ledger.rows.map(r => ({ SlipDate: r.date, Kind: r.kind, ProductName: r.productName, Spec: r.spec, Qty: r.qty ?? '', Price: r.price ?? '', Amount: r.amount, Tax: r.tax, Balance: r.balance, Comments: r.comments }))] }; }
      case 'custsum': return [{ key: 'CustomerSummary', title: '거래현황집계', params: base, rows: custSum.rows.map(r => ({ CustomerName: r.name, BeforeBalance: r.before, BuyingAmount: r.buy, BuyingVatAmount: r.buyVat, PaymentAmount: r.pay, SalesAmount: r.sale, SalesVatAmount: r.saleVat, ReceiptAmount: r.rcp, Balance: r.bal })) }, { key: 'SalesSummary', title: '매출 거래처별 집계표', params: { ...base, Title: '매출 거래처별 집계표', SalesBuyingAmount: '매출액', ReceiptPayment: '수금액' }, rows: custSum.rows.map(r => ({ CustomerName: r.name, BeforeBalance: r.before, SalesBuyingAmount: r.sale, SalesBuyingVatAmount: r.saleVat, ReceiptPaymentAmount: r.rcp, Balance: r.bal })) }, { key: 'SalesSummary', title: '매입 거래처별 집계표', params: { ...base, Title: '매입 거래처별 집계표', SalesBuyingAmount: '매입액', ReceiptPayment: '지급액' }, rows: custSum.rows.map(r => ({ CustomerName: r.name, BeforeBalance: r.before, SalesBuyingAmount: r.buy, SalesBuyingVatAmount: r.buyVat, ReceiptPaymentAmount: r.pay, Balance: r.bal })) }];
      case 'query': return [{ key: 'SalesQuery', title: '매입매출장', params: base, rows: queryRows.map(r => ({ SlipDate: r.date, Kind: r.kind, ProductName: r.name, Spec: r.spec, Unit: r.unit, Qty: r.qty, Price: r.price, Amount: r.amount })) }, { key: 'PostBook', title: '현장별입출고대장', params: { ...base, CustomerCompanyName: qCust || '전체' }, rows: queryRows.map(r => ({ SlipDate: r.date, KindName: r.kind, ProductName: r.name, Spec: r.spec, Unit: r.unit, Qty: r.qty, Price: r.price, Amount: r.amount, Tax: r.tax, Comments: r.site })) }, { key: 'PostBook대호', title: '거래명세표(대호 양식)', params: { ...base, CustomerCompanyName: qCust || '전체' }, rows: queryRows.map(r => ({ SlipDate: r.date, KindName: r.kind, ProductName: r.name, Spec: r.spec, Unit: r.unit, Qty: r.qty, Price: r.price, Amount: r.amount, Tax: r.tax, Comments: r.site })) }, { key: 'SiteBook', title: '현장별입출고대장(현장 변형)', params: { ...base, CustomerCompanyName: qCust || '전체' }, rows: queryRows.map(r => ({ SlipDate: r.date, KindName: r.kind, ProductName: r.name, Spec: r.spec, Unit: r.unit, Qty: r.qty, Price: r.price, Amount: r.amount, Tax: r.tax, Comments: r.site })) }];
      case 'taxbook': {
        const isBuy = (t: { taxKind?: string }) => t.taxKind === '2' || t.taxKind === 'B';
        const sheet = (buy: boolean): RptSpec => {
          const list = taxBook.rows.filter(t => isBuy(t) === buy);
          const byName = new Map<string, { id: string; name: string; n: number; supply: number; tax: number }>();
          list.forEach(t => { const r = byName.get(t.customerName) || { id: t.customerId || '', name: t.customerName, n: 0, supply: 0, tax: 0 }; r.n++; r.supply += t.supplyAmount; r.tax += t.taxAmount; byName.set(t.customerName, r); });
          const cmap = new Map(customers.map(c => [c.id, c])), nmap = new Map(customers.map(c => [c.name, c]));
          const rows = [...byName.values()].sort((a, b) => b.supply - a.supply).map(r => { const c = cmap.get(r.id) || nmap.get(r.name); return { TaxNo: c?.bizNumber && /\d/.test(c.bizNumber) ? c.bizNumber.replace(/_/g, '') : '', CustomerName: r.name, BusinessStatus: c?.bizType || '', BusinessType: c?.bizItem || '', Count: r.n, Blank: 0, Amount: r.supply, Tax: r.tax }; });
          const tot = rows.reduce((a, r) => ({ supply: a.supply + (r.Amount as number), tax: a.tax + (r.Tax as number) }), { supply: 0, tax: 0 });
          const title = buy ? '매입처별 세금계산서 합계표' : '매출처별 세금계산서 합계표';
          return { key: 'TaxList', title, rows, params: { ...base, title, kind: buy ? '매입' : '매출', sDate: `${from.slice(0, 4)}년 ${Number(from.slice(5, 7)) <= 6 ? '제1기' : '제2기'}`, sPeriod: `${from} ~ ${to}`, sIssueDate: new Date().toISOString().slice(0, 10), CustomerCount: String(rows.length), dTotalSheet: won(list.length), dSumKum: won(tot.supply), dSumVat: won(tot.tax), UserAddress: company?.address || '', UserBusinessStatus: company?.bizType || '', UserBusinessType: company?.bizItem || '', UserOwnerName: company?.ceo || '', UserTaxNo: company?.bizNumber || '' } };
        };
        return [{ key: 'TaxBook', title: '세금계산서조회', params: base, rows: taxBook.rows.map(t => ({ TaxDate: t.taxDate, TaxKind: isBuy(t) ? '매입' : '매출', CustomerName: t.customerName, Post: t.postName || '', ProductName: t.productSummary, Amount: t.supplyAmount, Tax: t.taxAmount, Total: t.totalAmount })) }, sheet(false), sheet(true),
          (() => { const sp = sheet(false); return { key: 'SaleTaxList', title: '매출처별 세금계산서 합계표(구형 양식)', rows: sp.rows.map(r => ({ Serial: r.TaxNo, C_Name: r.CustomerName, Status: r.BusinessStatus, Item: r.BusinessType, Count: r.Count, Blank: 0, TradeKum: r.Amount, VatKum: r.Tax })), params: { ...sp.params, 'User.Serial': company?.bizNumber || '', 'User.Delegate': company?.ceo || '', 'User.Status': company?.bizType || '', 'User.Item': company?.bizItem || '', 'User.Company': company?.name || '', 'User.Addr': company?.address || '', sTraderCount: sp.params.CustomerCount } }; })(),
          { ...sheet(true), key: 'BuyTaxList', title: '매입처별 세금계산서 합계표(구형 양식)' }];
      }
      case 'dailydetail': { const h = dailyDetail.head; return { key: 'DailyDetailBalance', title: '일계 상세', params: { ...base, FromDate: day, ToDate: day, Title: '일계 상세', SalesTotal: won(h.salesTot), Cost: won(h.costTot), Benefit: won(h.profitTot), BenefitRate: `${h.rate.toFixed(1)}`, Receipt: won(h.rcp), BuyingTotal: won(h.buyTot), BuyingTax: won(h.tax), SalesTax: '', Payment: won(h.paid) }, rows: dailyDetail.rows.map(r => ({ SlipDate: r.date, Kind: r.kind, ProductName: `${r.cust} / ${r.productName}`, Spec: r.spec, Qty: r.qty ?? '', Price: r.price ?? '', Amount: r.amount, Cost: r.cost ?? '', Benefit: r.profit ?? '', Rate: r.profit != null && r.amount ? ((r.profit / r.amount) * 100).toFixed(1) : '' })) }; }
      case 'subulsum': return [{ key: 'SubulSummary', title: '상품수불집계표', params: base, rows: subulSum.rows.map(r => ({ ProductName: r[0], Unit: r[1], Spec: r[2], BeforeStockQty: r[3], BuyingQty: r[4], ReturnSalesQty: r[5], SalesQty: r[6], ReturnBuyingQty: r[7], StockQty: r[8], PurchasePrice: r[9], StockAmount: r[10] })) }, { key: 'Customer1', title: '상품수불집계표(변형)', params: base, rows: subulSum.rows.map(r => ({ ProductName: r[0], Unit: r[1], Spec: r[2], BeforeStockQty: r[3], BuyingQty: r[4], ReturnSalesQty: r[5], SalesQty: r[6], ReturnBuyingQty: r[7], StockQty: r[8], PurchasePrice: r[9], StockAmount: r[10] })) }];
      case 'prodsum': return { key: 'SubulSummaryAmount', title: '상품매입매출집계표', params: { ...base, FromProductsName: '', ToProductsName: '' }, rows: prodSum.rows.map((r, i) => ({ No: i + 1, ProductName: r[0], Spec: r[1], Unit: r[2], BuyingQty: r[3], ReturnSalesQty: r[4], SalesQty: r[5], ReturnBuyingQty: r[6], BuyingAmount: r[7], ReturnSalesAmount: r[8], SalesAmount: r[9], ReturnBuyingAmount: r[10] })) };
      case 'subulbook': return { key: 'Subul', title: '상품수불장', params: base, rows: subulBook.rows.map(r => ({ strDate: r[0], Unit: r[9], ProductName: r[2], Spec: r[3], BuyingQty: r[4], SalesQty: r[5], Price: r[6], Amount: r[7], StockQty: r[8] })) };
      case 'pricelist': return { key: 'PriceList', title: '단가표', params: base, rows: priceRows.rows.map(r => ({ ProductName: r.name, Spec: r.spec, Price: r.p1 })) };
      case 'prodlist': return [{ key: 'Gaego', title: '상품재고리스트', params: base, rows: prodList.rows.map(r => ({ ProductName: r.name, Spec: r.spec, Unit: r.unit, Qty: r.stock, Price: r.cost, Amount: r.value })) }, { key: 'PRODUCTS', title: '상품코드리스트', params: base, rows: prodList.rows.map(r => ({ ProductName: r.name, Spec: r.spec, Unit: r.unit, PurchasePrice: r.cost, SalesPrice: r.sell })) }, { key: 'products1', title: '상품목록(초안 양식)', params: base, rows: prodList.rows.map(r => ({ ProductsName: r.name, Standard: r.spec, Unit: r.unit, BuyingPrice: r.cost, SalesPrice: r.sell, StockQtyOnHand: r.stock })) }];
      case 'custlist': return { key: 'Customer', title: '거래처리스트', params: base, rows: custList.map(c => ({ CustomerName: c.name, Post: c.post || '', OwnerName: c.ceo, ChargerName: c.contactName || '', TelephoneNo1: cleanTel(c.tel), TelephoneNo2: cleanTel(c.tel2 || c.mobile), FaxNo: cleanTel(c.fax), Address1Zip: c.zip || '', Address1: c.address })) };
      case 'phonebook': return [{ key: 'Telephones', title: '전화번호부', params: base, rows: phonebook.map(r => ({ Name: r.name, OwnerName: r.who || '', TelephoneNo1: cleanTel(r.tel), TelephoneNo2: cleanTel(r.mobile), FaxNo: cleanTel(r.fax), Comments: r.email || '' })) }, { key: 'TelBook', title: '전화번호부(변형)', params: base, rows: phonebook.map(r => ({ Name: r.name, OwnerName: r.who || '', TelephoneNo1: cleanTel(r.tel), TelephoneNo2: cleanTel(r.mobile), FaxNo: cleanTel(r.fax), Comments: r.email || '' })) }];
      case 'rcpquery': return { key: 'AccountBook', title: '수금지급조회', params: base, rows: rcpQuery.rows.map(r => ({ AccountDate: r[0], AccountKind: r[1], CreditAmount: r[2], DebitAmount: r[3], Comments: r[4] })) };
      case 'billbook': {
        const list = (bills || []).filter(b => (bbKind === 'all' || b.billKind === bbKind) && b.dueDate >= from && b.dueDate <= to).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        const pay = bbKind === '지급어음';
        return { key: pay ? 'PaymentBill' : 'ReceiptBill', title: pay ? '지급어음집계표' : '받은어음집계표', params: base, rows: list.map(b => ({ BillNo: b.billNo, BillStatusModeName: b.status, BillAmount: b.amount, ReceiptCustomerName: b.customerName, PayCustomerName: pay ? b.customerName : b.payCustomerName || '', ReceiptDate: b.receiptDate || '', IssueDate: b.issueDate, FallDate: b.dueDate, PayBank: pay ? b.payBank || b.bank : b.bank, PayDate: b.payDate || '' })) };
      }
      case 'daily': {
        const g = (label: '매출' | '매입', grp: typeof dailyByCust.sales, mon: typeof dailyByCust.monSales): RptRow[] => [
          ...grp.rows.map(r => ({ Kind: label, CustomerName: r.name, SalesBuyingAmount: r.amt, ReturnAmount: r.ret, ReceiptAmount: label === '매출' ? r.rcp : 0, PaymentAmount: label === '매입' ? r.rcp : 0 })),
          { CustomerName: `${label}계`, SalesBuyingAmount: grp.tot.amt, ReturnAmount: grp.tot.ret, ReceiptAmount: label === '매출' ? grp.tot.rcp : 0, PaymentAmount: label === '매입' ? grp.tot.rcp : 0 },
          { CustomerName: `월${label}계`, SalesBuyingAmount: mon.amt, ReturnAmount: mon.ret, ReceiptAmount: label === '매출' ? mon.rcp : 0, PaymentAmount: label === '매입' ? mon.rcp : 0 }
        ];
        const rows: RptRow[] = [...g('매출', dailyByCust.sales, dailyByCust.monSales), ...g('매입', dailyByCust.purchase, dailyByCust.monPurchase)];
        let n = 0; rows.forEach(r => { if (r.Kind) r.No = ++n; });
        const flat: RptRow[] = [...dailyByCust.sales.rows.map(r => ({ Kind: '매출', CustomerName: r.name, SalesBuyingAmount: r.amt, ReturnAmount: r.ret, ReceiptPaymentAmount: r.rcp })), ...dailyByCust.purchase.rows.map(r => ({ Kind: '매입', CustomerName: r.name, SalesBuyingAmount: r.amt, ReturnAmount: r.ret, ReceiptPaymentAmount: r.rcp }))];
        return [{ key: 'DailyBalanceSummary', title: '영업일계표', params: { ...base, FromDate: day, ToDate: day }, rows }, { key: 'DailyBalance', title: '영업일계표(영문 머리글 변형)', params: { ...base, FromDate: day, ToDate: day }, rows: flat }];
      }
      case 'receivable': {
        const k1 = (v: number) => Math.round(v / 1000);
        if (rcvMode === 'quarter') {
          const q0 = (qtr - 1) * 3 + 1; const lab = (i: number, w: string) => `${q0 + i}월${w}`;
          const rows = [...quarter.recv, ...quarter.pay].map(r => ({ CustomerName: r.name, BeforeBalance: k1(r.before), Month1Sale: k1(r.sale[0]), Month1Receipt: k1(r.receipt[0]), Month2Sale: k1(r.sale[1]), Month2Receipt: k1(r.receipt[1]), Month3Sale: k1(r.sale[2]), Month3Receipt: k1(r.receipt[2]), Balance: k1(r.balance) }));
          return { key: 'QuarterSummary', title: '분기 집계표', params: { FromDate: `${year}-${String(q0).padStart(2, '0')}-01`, ToDate: `${year}-${String(q0 + 2).padStart(2, '0')}-31`, UserCompanyName: co, Title: `${year}년 ${qtr}분기 거래처별 집계표`, Month1Sale: lab(0, '매출'), Month1Receipt: lab(0, '수금'), Month2Sale: lab(1, '매출'), Month2Receipt: lab(1, '수금'), Month3Sale: lab(2, '매출'), Month3Receipt: lab(2, '수금') }, rows };
        }
        // 월별: 마지막 거래 달을 «금월»로 하고 전월·전전월·전기이월(그 이전 합)·잔액(전체 합)을 찍는다 — 원본 열 의미(전기이월·전전월·전월·금월·잔액)에 맞춘 추정.
        let end = 11; for (let i = 11; i >= 0; i--) if (receivable.rows.some(r => r.m[i] !== 0)) { end = i; break; }
        const tel = new Map(customers.map(c => [c.id, cleanTel(c.tel)]));
        const rows = receivable.rows.map(r => ({ CustomerName: r.name, TelephoneNo1: tel.get(r.id) || '', Balance: r.m.slice(0, end + 1).reduce((a, b) => a + b, 0), Month3Receipt: r.m[end] || 0, Month2Receipt: end >= 1 ? r.m[end - 1] : 0, Month1Receipt: end >= 2 ? r.m[end - 2] : 0, BeforeBalance: end >= 3 ? r.m.slice(0, end - 2).reduce((a, b) => a + b, 0) : 0 }));
        return { key: 'ReceiptPaymentSummary', title: '미수·미지급 집계표', params: { FromDate: `${year}-01-01`, ToDate: `${year}-${String(end + 1).padStart(2, '0')}-31`, UserCompanyName: co, Title: '미수금·미지급금 현황' }, rows };
      }
      case 'sitebook': { const pbp2 = { ...base, CustomerCompanyName: qCust || '전체' }; const rr = queryRows.map(r => ({ SlipDate: r.date, KindName: r.kind, ProductName: r.name, Spec: r.spec, Unit: r.unit, Qty: r.qty, Price: r.price, Amount: r.amount, Tax: r.tax, Comments: r.site })); return [{ key: 'PostBook', title: '현장별입출고대장', params: pbp2, rows: rr }, { key: 'SiteBook', title: '현장별입출고대장(현장 변형)', params: pbp2, rows: rr }]; }
      default: return null;
    }
    })();
    return one == null ? [] : Array.isArray(one) ? one : [one];
  }, [section, company, rcvMode, qtr, year, quarter, receivable, customers, dailyByCust, from, to, day, cashbook, ledger, ledgerOptions, custSum, queryRows, taxBook, dailyDetail, subulSum, prodSum, subulBook, priceRows, prodList, custList, phonebook, rcpQuery, bills, bbKind]);

  const yearOptions = yearEnd.years.length ? yearEnd.years : [year];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-slate-800">
        <BookOpen className="w-5 h-5 text-blue-600" />
        <h2 className="font-bold text-base">장부 / 집계표</h2>
      </div>

      {dupCount > 0 && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          같은 날짜·합계의 전표가 대소문자 구분만 다르게 중복된 것으로 보이는 {dupCount}건을 집계에서 뺐습니다. 원본 정리 후 해제됩니다.
        </p>
      )}
      <div className="flex gap-1 border-b border-slate-200">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 ${section === s.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {rptSpecs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {rptSpecs.map((sp, i) => (
            <button key={`${sp.key}-${i}`} onClick={() => setRptOpen(i)} className="flex items-center gap-1 border border-blue-300 text-blue-700 rounded px-2 py-1 hover:bg-blue-50 font-semibold"><BookOpen className="w-3 h-3" /> 원본 양식 인쇄 미리보기{rptSpecs.length > 1 ? ` — ${sp.title}` : ''}</button>
          ))}
          <span className="text-slate-500">원본 오케이세일 양식(좌표·글꼴 복원)으로 찍습니다.</span>
        </div>
      )}
      {rptOpen != null && rptSpecs[rptOpen] && <RptPrintModal layoutKey={rptSpecs[rptOpen].key} title={rptSpecs[rptOpen].title} rows={rptSpecs[rptOpen].rows.slice(0, 1200)} total={rptSpecs[rptOpen].rows.length} allRows={rptSpecs[rptOpen].rows} params={rptSpecs[rptOpen].params} onClose={() => setRptOpen(null)} />}

      {section === 'daily' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <label className="font-semibold">조회일</label>
            <input type="date" value={day} onChange={e => setDay(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span className="text-slate-500">최근 거래일 {latestDate}</span>
          </div>
          <table className="border-collapse">
            <tbody>
              {[
                ['금일 매출', daily.sum.sales],
                ['  └ 부가세', daily.sum.tax],
                ['  └ 현금(입금) 매출', daily.sum.cash],
                ['  └ 외상(미수) 매출', daily.sum.credit],
                ['금일 매입', daily.sum.purchase],
                ['매출 반품(반입)', daily.sum.salesReturn],
                ['매입 반품(반출)', daily.sum.purchaseReturn],
                ['금일 수금', daily.collected],
                ['금일 지급', daily.paid]
              ].map(([label, v]) => (
                <tr key={String(label)}>
                  <th className={`${th} text-left w-44`}>{label}</th>
                  <td className={`${num} w-36`}>{won(Number(v))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {([['매출', dailyByCust.sales, dailyByCust.monSales], ['매입', dailyByCust.purchase, dailyByCust.monPurchase]] as const).map(([label, g, mon]) => (
            <div key={label} className="overflow-x-auto">
              <h4 className="text-xs font-bold mb-1">거래처별 일계표 — {label} ({g.rows.length}곳)</h4>
              <table className="w-full border-collapse">
                <thead><tr>{['구분', '거래처', `${label}금액`, '반품', label === '매출' ? '수금(현금 포함)' : '지급(현금 포함)'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {g.rows.slice(0, 200).map(r => (<tr key={r.id}><td className={td}>{label}</td><td className={td}>{r.name}</td><td className={num}>{won(r.amt)}</td><td className={num}>{r.ret ? won(r.ret) : ''}</td><td className={num}>{r.rcp ? won(r.rcp) : ''}</td></tr>))}
                  <tr className="bg-slate-50 font-bold"><td className={td} colSpan={2}>{label}계</td><td className={num}>{won(g.tot.amt)}</td><td className={num}>{won(g.tot.ret)}</td><td className={num}>{won(g.tot.rcp)}</td></tr>
                  <tr className="bg-slate-50 font-bold"><td className={td} colSpan={2}>월{label}계(월초~조회일)</td><td className={num}>{won(mon.amt)}</td><td className={num}>{won(mon.ret)}</td><td className={num}>{won(mon.rcp)}</td></tr>
                </tbody>
              </table>
            </div>
          ))}
          <p className="text-[11px] text-slate-500">열 구성과 정렬은 원본 일계표를 따랐고, 금액 집계 규칙은 원본에서 확인하지 못해 전표·수금 기록에서 계산했습니다.</p>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['전표번호', '구분', '거래처', '현장', '합계', '입금', '미수'].map(h => <th key={h} className={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {daily.day_slips.map(s => (
                <tr key={s.id}>
                  <td className={td}>{s.slipNo}</td>
                  <td className={td}>{s.slipType}</td>
                  <td className={td}>{s.customerName}</td>
                  <td className={td}>{s.siteName || ''}</td>
                  <td className={num}>{won(s.totalAmount)}</td>
                  <td className={num}>{won(s.paidAmount)}</td>
                  <td className={num}>{won(s.unpaidAmount)}</td>
                </tr>
              ))}
              {daily.day_slips.length === 0 && <tr><td colSpan={7} className={`${td} text-center text-slate-400 py-6`}>해당 일자 전표가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {section === 'cashbook' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <label className="font-semibold">기간</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span>~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <button
              onClick={() => downloadCsv(`현금출납부_${from}_${to}.csv`, [['일자', '적요', '입금', '출금', '잔액'], ['', '전기 이월', '', '', cashbook.opening], ...cashbook.rows.map(r => [r.date, r.desc, r.inAmt, r.outAmt, r.bal])])}
              className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          <table className="w-full border-collapse">
            <thead><tr>{['일자', '적요', '입금', '출금', '잔액'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              <tr className="bg-amber-50"><td className={td}></td><td className={`${td} font-bold`}>전기 이월</td><td className={num}></td><td className={num}></td><td className={num}>{won(cashbook.opening)}</td></tr>
              {cashbook.rows.map((r, i) => (
                <tr key={i}>
                  <td className={td}>{r.date}</td><td className={td}>{r.desc}</td>
                  <td className={num}>{r.inAmt ? won(r.inAmt) : ''}</td><td className={num}>{r.outAmt ? won(r.outAmt) : ''}</td><td className={num}>{won(r.bal)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold"><td className={td}></td><td className={td}>합계 / 기말 잔액</td><td className={num}>{won(cashbook.totalIn)}</td><td className={num}>{won(cashbook.totalOut)}</td><td className={num}>{won(cashbook.closing)}</td></tr>
            </tbody>
          </table>
          <p className="text-[11px] text-slate-500">현금 매출·매입 전표의 입금액과 현금 수금·지급을 합산합니다. 통장·어음·카드는 포함하지 않습니다.</p>
        </div>
      )}

      {section === 'period' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs">
            <label className="font-semibold">연도</label>
            <select value={year} onChange={e => setYear(e.target.value)} className="border border-slate-300 rounded px-2 py-1">
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={() => downloadCsv(`월별집계_${year}.csv`, [['월', '매출', '매입', '매출반품', '매입반품', '수금', '지급'], ...period.months.map(m => [m, ...(['sales', 'purchase', 'salesReturn', 'purchaseReturn', 'collected', 'paid'] as const).map(k => period.byMonth[m][k])])])}
              className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          <table className="w-full border-collapse">
            <thead><tr>{['구분', '매출', '매입', '매출반품', '매입반품', '수금', '지급'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {period.months.map((m, i) => (
                <React.Fragment key={m}>
                  <tr>
                    <td className={td}>{m}</td>
                    {(['sales', 'purchase', 'salesReturn', 'purchaseReturn', 'collected', 'paid'] as const).map(k => <td key={k} className={num}>{won(period.byMonth[m][k])}</td>)}
                  </tr>
                  {i % 3 === 2 && (
                    <tr className="bg-blue-50 font-bold">
                      <td className={td}>{Math.floor(i / 3) + 1}분기 소계</td>
                      {(['sales', 'purchase', 'salesReturn', 'purchaseReturn', 'collected', 'paid'] as const).map(k => <td key={k} className={num}>{won(period.quarters[Math.floor(i / 3)][k])}</td>)}
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <div>
            <h3 className="text-xs font-bold mb-1">거래처별 매출·매입 집계표 ({year}년)</h3>
            <table className="w-full border-collapse">
              <thead><tr>{['거래처', '매출', '매입'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {period.custRows.slice(0, 200).map(r => (
                  <tr key={r.name}><td className={td}>{r.name}</td><td className={num}>{won(r.sales)}</td><td className={num}>{won(r.purchase)}</td></tr>
                ))}
                {period.custRows.length === 0 && <tr><td colSpan={3} className={`${td} text-center text-slate-400 py-6`}>해당 연도 거래가 없습니다.</td></tr>}
              </tbody>
            </table>
            {period.custRows.length > 200 && <p className="text-[11px] text-slate-500 mt-1">상위 200곳만 표시했습니다(전체 {period.custRows.length}곳).</p>}
          </div>
        </div>
      )}

      {section === 'receivable' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <label className="font-semibold">연도</label>
            <select value={year} onChange={e => setYear(e.target.value)} className="border border-slate-300 rounded px-2 py-1">
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={rcvMode} onChange={e => setRcvMode(e.target.value as 'month' | 'quarter')} className="border border-slate-300 rounded px-2 py-1">
              <option value="month">월별 순증감</option><option value="quarter">분기 집계(미수금·미지급금)</option>
            </select>
            {rcvMode === 'quarter' && (
              <select value={qtr} onChange={e => setQtr(Number(e.target.value) as 1 | 2 | 3 | 4)} className="border border-slate-300 rounded px-2 py-1">
                {[1, 2, 3, 4].map(q => <option key={q} value={q}>{q}분기</option>)}
              </select>
            )}
            <span className="text-slate-500">{rcvMode === 'month' ? '거래처별 월 순증감 — 미수금(받을 돈) +, 미지급금(줄 돈) −' : '전기 잔액 + 분기 매출 − 수금 = 잔액'}</span>
            <button
              onClick={() => downloadCsv(`미수미지급집계_${year}.csv`, [['거래처', ...Array.from({ length: 12 }, (_, i) => `${i + 1}월`), '합계'], ...receivable.rows.map(r => [r.name, ...r.m, r.total])])}
              className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          {rcvMode === 'month' && (<>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>{['거래처', ...Array.from({ length: 12 }, (_, i) => `${i + 1}월`), '합계'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {receivable.rows.slice(0, 300).map(r => (
                  <tr key={r.id}><td className={td}>{r.name}</td>{r.m.map((v, i) => <td key={i} className={num}>{v ? won(v) : ''}</td>)}<td className={`${num} font-bold`}>{won(r.total)}</td></tr>
                ))}
                <tr className="bg-slate-50 font-bold"><td className={td}>합계</td>{receivable.sum.map((v, i) => <td key={i} className={num}>{won(v)}</td>)}<td className={num}>{won(receivable.sum.reduce((a, b) => a + b, 0))}</td></tr>
              </tbody>
            </table>
          </div>
          {receivable.rows.length > 300 && <p className="text-[11px] text-slate-500">상위 300곳만 표시했습니다(전체 {receivable.rows.length}곳).</p>}
          <div className="border border-slate-200 rounded p-2 text-xs space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setOpeningEdit(v => !v)} className="border border-slate-300 rounded px-2 py-1 hover:bg-slate-50 font-semibold">기초잔액 입력 {openingEdit ? '닫기' : '열기'}</button>
              <span className="text-slate-500">{opening.asOf ? `기준일 ${opening.asOf} 시작 시점 잔액 반영 중 (${Object.values(opening.byCustomer).filter(Boolean).length}곳)` : '입력된 기초잔액 없음 — 분기 집계의 전기 잔액·거래처 원장 전기 이월에 반영됩니다'}</span>
              {openingMsg && <span className="text-emerald-700">{openingMsg}</span>}
            </div>
            {openingEdit && <OpeningEditor customers={ledgerOptions} opening={opening} onSave={saveOpening} />}
          </div>
          <p className="text-[11px] text-slate-500">월별 순증감은 기초잔액을 포함하지 않은 «해당 연도 순증감»입니다.</p>
          </>)}
          {rcvMode === 'quarter' && ([['미수금 집계표', quarter.recv], ['미지급금 집계표', quarter.pay]] as const).map(([title, list]) => (
            <div key={title} className="overflow-x-auto">
              <h4 className="text-xs font-bold mb-1">{title} ({list.length}곳)</h4>
              <table className="w-full border-collapse">
                <thead><tr>{['거래처', '전기 잔액', ...[0, 1, 2].flatMap(i => [`${(qtr - 1) * 3 + i + 1}월 매출`, `${(qtr - 1) * 3 + i + 1}월 수금`]), '잔액'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {list.slice(0, 300).map(r => (
                    <tr key={r.id}><td className={td}>{r.name}</td><td className={num}>{won(r.before)}</td>
                      {[0, 1, 2].flatMap(i => [<td key={`s${i}`} className={num}>{r.sale[i] ? won(r.sale[i]) : ''}</td>, <td key={`r${i}`} className={num}>{r.receipt[i] ? won(r.receipt[i]) : ''}</td>])}
                      <td className={`${num} font-bold`}>{won(r.balance)}</td></tr>
                  ))}
                  <tr className="bg-slate-50 font-bold"><td className={td}>합계</td><td className={num}>{won(list.reduce((a, r) => a + r.before, 0))}</td>
                    {[0, 1, 2].flatMap(i => [<td key={`s${i}`} className={num}>{won(list.reduce((a, r) => a + r.sale[i], 0))}</td>, <td key={`r${i}`} className={num}>{won(list.reduce((a, r) => a + r.receipt[i], 0))}</td>])}
                    <td className={num}>{won(list.reduce((a, r) => a + r.balance, 0))}</td></tr>
                </tbody>
              </table>
            </div>
          ))}
          {rcvMode === 'quarter' && <p className="text-[11px] text-slate-500">전기 잔액은 해당 연도 이전 분기까지의 누계이며 전년도 이월은 포함하지 않았습니다. «매출/수금» 구분은 전표·수금 기록에서 나눈 값입니다.</p>}
        </div>
      )}

      {section === 'ledger' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="font-semibold">거래처</label>
            <select value={ledger.id} onChange={e => setLedgerCust(e.target.value)} className="border border-slate-300 rounded px-2 py-1 max-w-[16rem]">
              {ledgerOptions.slice(0, 500).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <label className="font-semibold">기간</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span>~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span className="text-slate-500">잔액: 미수금 +, 미지급금 −</span>
            <button
              onClick={() => downloadCsv(`거래처원장_${ledger.id}_${from}_${to}.csv`, [['일자', '구분', '품목', '규격', '단위', '수량', '단가', '금액', '세액', '잔액', '비고'], ['', '', '전기 이월', '', '', '', '', '', '', ledger.opening, ''], ...ledger.rows.map(r => [r.date, r.kind, r.productName, r.spec, r.unit, r.qty ?? '', r.price ?? '', r.amount, r.tax, r.balance, r.comments])])}
              className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>{['일자', '구분', '품목', '규격', '단위', '수량', '단가', '금액', '세액', '잔액', '비고'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                <tr className="bg-slate-50"><td className={td} colSpan={9}>전기 이월</td><td className={`${num} font-bold`}>{won(ledger.opening)}</td><td className={td}></td></tr>
                {ledger.rows.slice(0, 1000).map((r, i) => (
                  <tr key={i}><td className={td}>{r.date}</td><td className={td}>{r.kind}</td><td className={td}>{r.productName}</td><td className={td}>{r.spec}</td><td className={td}>{r.unit}</td>
                    <td className={num}>{r.qty ?? ''}</td><td className={num}>{r.price != null ? won(r.price) : ''}</td><td className={num}>{won(r.amount)}</td><td className={num}>{r.tax ? won(r.tax) : ''}</td><td className={`${num} font-bold`}>{won(r.balance)}</td><td className={td}>{r.comments}</td></tr>
                ))}
                <tr className="bg-slate-50 font-bold"><td className={td} colSpan={9}>기말 잔액</td><td className={num}>{won(ledger.closing)}</td><td className={td}></td></tr>
              </tbody>
            </table>
          </div>
          {ledger.rows.length > 1000 && <p className="text-[11px] text-slate-500">처음 1,000줄만 표시했습니다(전체 {ledger.rows.length}줄) — 전체는 CSV로 받으세요.</p>}
          <p className="text-[11px] text-slate-500">열 구성은 원본 거래처원장 인쇄표를 따랐습니다. 전기 이월은 이 데이터 안의 조회 시작일 이전 거래 합계이며 전년도 이월 잔액은 포함하지 않습니다.</p>
        </div>
      )}

      {section === 'stockflow' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="font-semibold">연도</label>
            <select value={year} onChange={e => setYear(e.target.value)} className="border border-slate-300 rounded px-2 py-1">
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <input value={stockQ} onChange={e => setStockQ(e.target.value)} placeholder="품목·규격 검색" className="border border-slate-300 rounded px-2 py-1 w-48" />
            <span className="text-slate-500">월 순증감 = 매입 입고 − 매출 출고 (+ 입고 / − 출고)</span>
            <button
              onClick={() => downloadCsv(`월별재고수불_${year}.csv`, [['품목', '규격', '단위', '이월재고', ...Array.from({ length: 12 }, (_, i) => `${i + 1}월`), '입고계', '출고계', '기말'], ...stockflow.map(r => [r.name, r.spec, r.unit, r.open, ...r.net, r.inQty, r.outQty, r.close])])}
              className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>{['품목', '규격', '단위', '이월재고', ...Array.from({ length: 12 }, (_, i) => `${i + 1}월`), '입고계', '출고계', '기말'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {stockflow.slice(0, 300).map(r => (
                  <tr key={r.productId}><td className={td}>{r.name}</td><td className={td}>{r.spec}</td><td className={td}>{r.unit}</td>
                    <td className={num}>{r.open ? r.open.toLocaleString('ko-KR') : ''}</td>
                    {r.net.map((v, i) => <td key={i} className={`${num} ${v < 0 ? 'text-rose-600' : ''}`}>{v ? v.toLocaleString('ko-KR') : ''}</td>)}
                    <td className={num}>{r.inQty.toLocaleString('ko-KR')}</td><td className={num}>{r.outQty.toLocaleString('ko-KR')}</td><td className={`${num} font-bold ${r.close < 0 ? 'text-rose-600' : ''}`}>{r.close.toLocaleString('ko-KR')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {stockflow.length > 300 && <p className="text-[11px] text-slate-500">거래량 상위 300개 품목만 표시했습니다(전체 {stockflow.length}개) — 전체는 CSV로 받으세요.</p>}
          <p className="text-[11px] text-slate-500">전표 품목수량에서 계산한 월별 증감입니다(원본 재고표와 같은 규칙). 이월재고는 품목관리에 입력한 값이며 기말 = 이월재고 + 해당 연도 증감입니다(실사 조정은 포함하지 않음). 반품 방향은 표본이 적어 미확정입니다.</p>
        </div>
      )}

      {section === 'vat' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <label className="font-semibold">연도</label>
            <select value={year} onChange={e => setYear(e.target.value)} className="border border-slate-300 rounded px-2 py-1">
              {(vat.years.length ? vat.years : [year]).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-slate-500">세금계산서 발행이력 기준 (매출=예수금, 매입=대급금)</span>
            <button
              onClick={() => downloadCsv(`부가세집계_${year}.csv`, [['월', '매출 공급가', '매출 세액', '매출 건수', '매입 공급가', '매입 세액', '매입 건수', '납부(환급)세액', '부가율(%)'], ...vat.months.map(m => { const r = vat.byMonth[m]; return [m, r.sSupply, r.sTax, r.sCnt, r.pSupply, r.pTax, r.pCnt, r.sTax - r.pTax, r.sSupply ? (r.sTax / r.sSupply * 100).toFixed(1) : '']; })])}
              className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          <table className="w-full border-collapse">
            <thead><tr>{['구분', '매출 공급가', '매출 세액(예수금)', '건수', '매입 공급가', '매입 세액(대급금)', '건수', '납부(환급)세액', '부가율'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {vat.months.map((m, i) => {
                const row = (label: string, r: VatRow, cls = '') => (
                  <tr key={label} className={cls}>
                    <td className={td}>{label}</td>
                    <td className={num}>{won(r.sSupply)}</td><td className={num}>{won(r.sTax)}</td><td className={num}>{r.sCnt}</td>
                    <td className={num}>{won(r.pSupply)}</td><td className={num}>{won(r.pTax)}</td><td className={num}>{r.pCnt}</td>
                    <td className={num}>{won(r.sTax - r.pTax)}</td>
                    <td className={num}>{r.sSupply ? ((r.sTax / r.sSupply) * 100).toFixed(1) + '%' : ''}</td>
                  </tr>
                );
                return (
                  <React.Fragment key={m}>
                    {row(m, vat.byMonth[m])}
                    {i % 3 === 2 && row(`${Math.floor(i / 3) + 1}분기 소계`, vat.quarters[Math.floor(i / 3)], 'bg-blue-50 font-bold')}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-500">발행이력이 있는 연도만 목록에 나옵니다. 신고용 확정값이 아니라 발행 내역 합계이며, 매입 세금계산서를 따로 입력하지 않았다면 매입은 0으로 나옵니다.</p>
        </div>
      )}

      {section === 'pricelist' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <label className="font-semibold">거래처</label>
            <select value={priceCustomers.find(x => x.c.id === priceCustomer) ? priceCustomer : priceCustomers[0]?.c.id || ''} onChange={e => setPriceCustomer(e.target.value)} className="border border-slate-300 rounded px-2 py-1 max-w-xs">
              {priceCustomers.map(x => <option key={x.c.id} value={x.c.id}>{x.c.name} ({Object.keys(x.map as object).length}종)</option>)}
            </select>
            <input value={priceQuery} onChange={e => setPriceQuery(e.target.value)} placeholder="품번·품명·규격 검색" className="border border-slate-300 rounded px-2 py-1 w-56" />
            <span className="text-slate-500">{priceRows.rows.length.toLocaleString()}건</span>
            <button
              onClick={() => downloadCsv(`단가표_${priceRows.name}.csv`, [['품번', '품명', '규격', '단가1', '단가2', '단가3'], ...priceRows.rows.map(r => [r.code, r.name, r.spec, r.p1, r.p2, r.p3])])}
              className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          <table className="w-full border-collapse">
            <thead><tr>{['품번', '품명', '규격', '단가1', '단가2', '단가3'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {priceRows.rows.slice(0, 300).map(r => (
                <tr key={r.code}><td className={td}>{r.code}</td><td className={td}>{r.name}</td><td className={td}>{r.spec}</td><td className={num}>{won(r.p1)}</td><td className={num}>{won(r.p2)}</td><td className={num}>{won(r.p3)}</td></tr>
              ))}
              {priceRows.rows.length === 0 && <tr><td colSpan={6} className={`${td} text-center text-slate-400 py-6`}>등록된 거래처별 단가가 없습니다.</td></tr>}
            </tbody>
          </table>
          {priceRows.rows.length > 300 && <p className="text-[11px] text-slate-500">300건까지 표시했습니다. 검색으로 좁히거나 CSV로 전체를 받으세요.</p>}
        </div>
      )}

      {section === 'yearend' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <label className="font-semibold">마감 연도</label>
            <select value={year} onChange={e => setYear(e.target.value)} className="border border-slate-300 rounded px-2 py-1">
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-slate-500">→ {Number(year) + 1}년 기초잔액으로 이월</span>
            <button
              onClick={() => downloadCsv(`연말이월_${year}.csv`, [['거래처코드', '거래처', `${year} 기초`, `${year} 증감`, `${year} 기말(=${Number(year) + 1} 기초)`], ...yearEnd.rows.map(r => [r.code, r.name, r.opening, r.change, r.closing])])}
              className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          <table className="w-full border-collapse">
            <thead><tr>{['코드', '거래처', '기초 미수금', '당해 증감', '기말 미수금(이월액)'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {yearEnd.rows.slice(0, 300).map(r => (
                <tr key={r.id}><td className={td}>{r.code}</td><td className={td}>{r.name}</td><td className={num}>{won(r.opening)}</td><td className={num}>{won(r.change)}</td><td className={`${num} font-bold`}>{won(r.closing)}</td></tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className={td} colSpan={2}>합계 ({yearEnd.rows.length}곳)</td>
                <td className={num}>{won(yearEnd.rows.reduce((a, r) => a + r.opening, 0))}</td>
                <td className={num}>{won(yearEnd.rows.reduce((a, r) => a + r.change, 0))}</td>
                <td className={num}>{won(yearEnd.rows.reduce((a, r) => a + r.closing, 0))}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-[11px] text-slate-500">전표의 외상(미수)액에서 반품·수금을 빼 누적한 값입니다. 거래처 미수금은 누적 잔액으로 보관되므로 데이터를 옮기지 않고 연말 기준 이월표로 확정합니다. 수금 입력이 없는 기간은 미수가 실제보다 크게 나옵니다.</p>
        </div>
      )}

      {section === 'phonebook' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <input value={phoneQuery} onChange={e => setPhoneQuery(e.target.value)} placeholder="상호·대표·전화·이메일 검색" className="border border-slate-300 rounded px-2 py-1 w-72" />
            <span className="text-slate-500">{phonebook.length.toLocaleString()}건</span>
            <button
              onClick={() => downloadCsv('전화번호부.csv', [['코드', '상호', '담당·대표', '전화', '휴대폰', '팩스', '이메일', '주소'], ...phonebook.map(r => [r.code, r.name, r.who || '', r.tel || '', r.mobile || '', r.fax || '', r.email || '', r.place || ''])])}
              className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          <table className="w-full border-collapse">
            <thead><tr>{['상호', '담당·대표', '전화', '휴대폰', '팩스', '이메일', '주소'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {phonebook.slice(0, 300).map((r, i) => (
                <tr key={i}>
                  <td className={td}>{r.name}</td><td className={td}>{r.who}</td>
                  <td className={td}>{r.tel && <a href={`tel:${r.tel}`} className="text-blue-600">{r.tel}</a>}</td>
                  <td className={td}>{r.mobile && <a href={`tel:${r.mobile}`} className="text-blue-600">{r.mobile}</a>}</td>
                  <td className={td}>{r.fax}</td><td className={td}>{r.email}</td><td className={td}>{r.place}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {phonebook.length > 300 && <p className="text-[11px] text-slate-500">300건까지 표시했습니다. 검색으로 좁히거나 CSV로 전체를 받으세요.</p>}
        </div>
      )}

      {section === 'custsum' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="font-semibold">기간</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span>~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span className="text-slate-500">잔액: 미수금 +, 미지급금 −</span>
            <button onClick={() => downloadCsv(`거래처별집계표_${from}_${to}.csv`, [['거래처', '전기이월', '매입', '매입세액', '지급', '매출', '매출세액', '수금', '잔액'], ...custSum.rows.map(r => [r.name, r.before, r.buy, r.buyVat, r.pay, r.sale, r.saleVat, r.rcp, r.bal]), ['합계', custSum.tot.before, custSum.tot.buy, custSum.tot.buyVat, custSum.tot.pay, custSum.tot.sale, custSum.tot.saleVat, custSum.tot.rcp, custSum.tot.bal]])} className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"><Download className="w-3 h-3" /> CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>{['거래처', '전기이월', '매입', '매입세액', '지급', '매출', '매출세액', '수금', '잔액'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {custSum.rows.slice(0, 500).map(r => (
                  <tr key={r.id}><td className={td}>{r.name}</td><td className={num}>{won(r.before)}</td><td className={num}>{won(r.buy)}</td><td className={num}>{won(r.buyVat)}</td><td className={num}>{won(r.pay)}</td><td className={num}>{won(r.sale)}</td><td className={num}>{won(r.saleVat)}</td><td className={num}>{won(r.rcp)}</td><td className={`${num} font-bold`}>{won(r.bal)}</td></tr>
                ))}
                <tr className="bg-slate-50 font-bold"><td className={td}>합계</td><td className={num}>{won(custSum.tot.before)}</td><td className={num}>{won(custSum.tot.buy)}</td><td className={num}>{won(custSum.tot.buyVat)}</td><td className={num}>{won(custSum.tot.pay)}</td><td className={num}>{won(custSum.tot.sale)}</td><td className={num}>{won(custSum.tot.saleVat)}</td><td className={num}>{won(custSum.tot.rcp)}</td><td className={num}>{won(custSum.tot.bal)}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500">열 구성은 원본 거래처별 집계표 인쇄표를 따랐습니다. 반품은 매출·매입에서 차감하고, 잔액은 할인까지 반영한 거래처 순증감입니다(집계식은 원본 추적 전까지 추정).</p>
        </div>
      )}

      {section === 'query' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="font-semibold">기간</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span>~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <select value={qKind} onChange={e => setQKind(e.target.value)} className="border border-slate-300 rounded px-2 py-1">
              <option value="all">전체 구분</option><option value="sales">매출</option><option value="purchase">매입</option><option value="salesReturn">매출반품</option><option value="purchaseReturn">매입반품</option>
            </select>
            <input value={qCust} onChange={e => setQCust(e.target.value)} placeholder="거래처" className="border border-slate-300 rounded px-2 py-1 w-28" />
            <input value={qSite} onChange={e => setQSite(e.target.value)} placeholder="현장" className="border border-slate-300 rounded px-2 py-1 w-28" />
            <input value={qProd} onChange={e => setQProd(e.target.value)} placeholder="품명·규격" className="border border-slate-300 rounded px-2 py-1 w-28" />
            <button onClick={() => downloadCsv(`거래내역_${from}_${to}.csv`, [['일자', '구분', '거래처', '현장', '품명', '규격', '단위', '수량', '단가', '금액', '세액', '전표번호'], ...queryRows.map(r => [r.date, r.kind, r.cust, r.site, r.name, r.spec, r.unit, r.qty, r.price, r.amount, r.tax, r.no])])} className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"><Download className="w-3 h-3" /> CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>{['일자', '구분', '거래처', '현장', '품명', '규격', '단위', '수량', '단가', '금액', '세액'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {queryRows.slice(0, 1000).map((r, i) => (
                  <tr key={i}><td className={td}>{r.date}</td><td className={td}>{r.kind}</td><td className={td}>{r.cust}</td><td className={td}>{r.site}</td><td className={td}>{r.name}</td><td className={td}>{r.spec}</td><td className={td}>{r.unit}</td><td className={num}>{r.qty}</td><td className={num}>{won(r.price)}</td><td className={num}>{won(r.amount)}</td><td className={num}>{r.tax ? won(r.tax) : ''}</td></tr>
                ))}
                <tr className="bg-slate-50 font-bold"><td className={td} colSpan={9}>합계 ({queryRows.length.toLocaleString('ko-KR')}줄)</td><td className={num}>{won(queryRows.reduce((a, r) => a + r.amount, 0))}</td><td className={num}>{won(queryRows.reduce((a, r) => a + r.tax, 0))}</td></tr>
              </tbody>
            </table>
          </div>
          {queryRows.length > 1000 && <p className="text-[11px] text-slate-500">처음 1,000줄만 표시했습니다 — 전체는 CSV로 받으세요.</p>}
          <p className="text-[11px] text-slate-500">원본 판매조회·전기장·현장별장부 인쇄표(일자·구분·품목·규격·단위·수량·단가·금액·세액)를 한 화면으로 모았습니다. 견적·발주·납품과 품목 줄이 없는 전표(이관된 반품 전표 등)는 제외합니다.</p>
        </div>
      )}

      {section === 'taxbook' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="font-semibold">기간</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span>~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <select value={tbKind} onChange={e => setTbKind(e.target.value)} className="border border-slate-300 rounded px-2 py-1"><option value="all">매출+매입</option><option value="sales">매출</option><option value="purchase">매입</option></select>
            <input value={tbQ} onChange={e => setTbQ(e.target.value)} placeholder="거래처·현장·품명" className="border border-slate-300 rounded px-2 py-1 w-32" />
            <button onClick={() => downloadCsv(`세금계산서장부_${from}_${to}.csv`, [['일자', '구분', '번호', '거래처', '현장', '품명', '공급가액', '세액', '합계', '발행'], ...taxBook.rows.map(t => [t.taxDate, t.taxKind === '2' || t.taxKind === 'B' ? '매입' : '매출', t.taxNo, t.customerName, t.postName || '', t.productSummary, t.supplyAmount, t.taxAmount, t.totalAmount, t.isIssued ? '발행' : '미발행'])])} className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"><Download className="w-3 h-3" /> CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>{['일자', '구분', '번호', '거래처', '현장', '품명', '공급가액', '세액', '합계', '발행'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {taxBook.rows.slice(0, 1000).map(t => (
                  <tr key={t.id}><td className={td}>{t.taxDate}</td><td className={td}>{t.taxKind === '2' || t.taxKind === 'B' ? '매입' : '매출'}</td><td className={td}>{t.taxNo}</td><td className={td}>{t.customerName}</td><td className={td}>{t.postName || ''}</td><td className={td}>{t.productSummary}</td><td className={num}>{won(t.supplyAmount)}</td><td className={num}>{won(t.taxAmount)}</td><td className={num}>{won(t.totalAmount)}</td><td className={td}>{t.isIssued ? '발행' : '미발행'}</td></tr>
                ))}
                {(['sales', 'purchase'] as const).map(k => (
                  <tr key={k} className="bg-slate-50 font-bold"><td className={td} colSpan={6}>{k === 'sales' ? '매출' : '매입'} 계 ({taxBook[k].n.toLocaleString('ko-KR')}장)</td><td className={num}>{won(taxBook[k].supply)}</td><td className={num}>{won(taxBook[k].tax)}</td><td className={num}>{won(taxBook[k].total)}</td><td className={td}></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {taxBook.rows.length > 1000 && <p className="text-[11px] text-slate-500">처음 1,000줄만 표시했습니다 — 전체는 CSV로 받으세요.</p>}
          <p className="text-[11px] text-slate-500">원본 세금계산서 장부·매출/매입 목록 인쇄표를 한 화면으로 모았습니다(구분 1=매출, 2·B=매입).</p>
        </div>
      )}

      {section === 'prodlist' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input value={plQ} onChange={e => setPlQ(e.target.value)} placeholder="품명·규격·코드" className="border border-slate-300 rounded px-2 py-1 w-40" />
            <label className="flex items-center gap-1"><input type="checkbox" checked={plStockOnly} onChange={e => setPlStockOnly(e.target.checked)} /> 재고 있는 품목만</label>
            <span className="text-slate-500">{prodList.rows.length.toLocaleString('ko-KR')}품목 · 재고금액(현재고×매입가) {won(prodList.totalValue)}</span>
            <button onClick={() => downloadCsv('품목재고현황.csv', [['코드', '품명', '규격', '단위', '현재고', '매입가', '판매단가', '재고금액'], ...prodList.rows.map(r => [r.code, r.name, r.spec, r.unit, r.stock, r.cost, r.sell, r.value])])} className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"><Download className="w-3 h-3" /> CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>{['코드', '품명', '규격', '단위', '현재고', '매입가', '판매단가', '재고금액'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {prodList.rows.slice(0, 500).map((r, i) => (
                  <tr key={i}><td className={td}>{r.code}</td><td className={td}>{r.name}</td><td className={td}>{r.spec}</td><td className={td}>{r.unit}</td><td className={num}>{r.stock}</td><td className={num}>{won(r.cost)}</td><td className={num}>{won(r.sell)}</td><td className={num}>{won(r.value)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {prodList.rows.length > 500 && <p className="text-[11px] text-slate-500">500건까지 표시했습니다. 검색으로 좁히거나 CSV로 전체를 받으세요.</p>}
          <p className="text-[11px] text-slate-500">원본 품목 목록·재고 현황(개고) 인쇄표를 따랐습니다. 원본 이관 데이터에는 현재고가 없어(이월재고 0) 입력·전표가 쌓여야 의미가 있습니다.</p>
        </div>
      )}

      {section === 'custlist' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input value={clQ} onChange={e => setClQ(e.target.value)} placeholder="거래처·대표·사업자번호·전화" className="border border-slate-300 rounded px-2 py-1 w-52" />
            <span className="text-slate-500">{custList.length.toLocaleString('ko-KR')}곳</span>
            <button onClick={() => downloadCsv('거래처목록.csv', [['코드', '거래처', '대표', '사업자번호', '업태', '종목', '전화', '팩스', '주소'], ...custList.map(c => [c.code, c.name, c.ceo, c.bizNumber, c.bizType || '', c.bizItem || '', c.tel, c.fax || '', c.address])])} className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"><Download className="w-3 h-3" /> CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>{['코드', '거래처', '대표', '사업자번호', '업태', '종목', '전화', '팩스', '주소'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {custList.slice(0, 500).map(c => (
                  <tr key={c.id}><td className={td}>{c.code}</td><td className={td}>{c.name}</td><td className={td}>{c.ceo}</td><td className={td}>{c.bizNumber}</td><td className={td}>{c.bizType}</td><td className={td}>{c.bizItem}</td><td className={td}>{c.tel}</td><td className={td}>{c.fax}</td><td className={td}>{c.address}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {custList.length > 500 && <p className="text-[11px] text-slate-500">500건까지 표시했습니다. 검색으로 좁히거나 CSV로 전체를 받으세요.</p>}
        </div>
      )}

      {section === 'dailydetail' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="font-semibold">일자</label>
            <input type="date" value={day} onChange={e => setDay(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span className="text-slate-500">잔액: 거래 직후 거래처 잔액(미수금 +, 미지급금 −)</span>
            <button onClick={() => downloadCsv(`일계상세_${day}.csv`, [['일자', '구분', '거래처', '품명', '규격', '단위', '수량', '단가', '금액', '매입단가', '경상이익', '세액', '잔액'], ...dailyDetail.rows.map(r => [r.date, r.kind, r.cust, r.productName, r.spec, r.unit, r.qty ?? '', r.price ?? '', r.amount, r.cost ?? '', r.profit ?? '', r.tax, r.balance])])} className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"><Download className="w-3 h-3" /> CSV</button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2">
            {([['매출계', dailyDetail.head.salesTot], ['원가계', dailyDetail.head.costTot], ['이익계', dailyDetail.head.profitTot], ['수금액', dailyDetail.head.rcp], ['매입계', dailyDetail.head.buyTot], ['세액', dailyDetail.head.tax], ['지급액', dailyDetail.head.paid]] as [string, number][]).map(([k, v]) => <span key={k}><b>{k}</b> <span className="font-mono">{won(v)}</span></span>)}
            <span><b>이익율</b> <span className="font-mono">{dailyDetail.head.rate.toFixed(1)}%</span></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>{['일자', '구분', '거래처', '품명', '규격', '단위', '수량', '단가', '금액', '매입단가', '경상이익', '이익%', '세액', '잔액'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {dailyDetail.rows.slice(0, 1000).map((r, i) => (
                  <tr key={i}><td className={td}>{r.date}</td><td className={td}>{r.kind}</td><td className={td}>{r.cust}</td><td className={td}>{r.productName}</td><td className={td}>{r.spec}</td><td className={td}>{r.unit}</td><td className={num}>{r.qty ?? ''}</td><td className={num}>{r.price != null ? won(r.price) : ''}</td><td className={num}>{won(r.amount)}</td><td className={num}>{r.cost != null ? won(r.cost) : ''}</td><td className={num}>{r.profit != null ? won(r.profit) : ''}</td><td className={num}>{r.profit != null && r.amount ? ((r.profit / r.amount) * 100).toFixed(1) : ''}</td><td className={num}>{r.tax ? won(r.tax) : ''}</td><td className={`${num} font-bold`}>{won(r.balance)}</td></tr>
                ))}
                {dailyDetail.rows.length === 0 && <tr><td className={td} colSpan={14}>이 날짜에는 거래가 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === 'sitebook' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="font-semibold">기간</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span>~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <button onClick={() => downloadCsv(`현장별장부_${from}_${to}.csv`, [['거래처', '현장', '전표수', '매출', '매입'], ...siteBook.rows, ['합계', '', ...siteBook.tot]])} className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"><Download className="w-3 h-3" /> CSV</button>
          </div>
          <ReportTable head={['거래처', '현장', '전표수', '매출', '매입']} rows={siteBook.rows} foot={['합계', '', ...siteBook.tot]} numFrom={2} />
          <p className="text-[11px] text-slate-500">거래처·현장별 매출·매입 합계(반품·견적·발주 제외). 현장 줄 내역은 «거래내역 조회»에서 현장 칸으로 좁혀 보세요.</p>
        </div>
      )}

      {section === 'rcpsum' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="font-semibold">기간</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span>~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <button onClick={() => downloadCsv(`수금지급집계_${from}_${to}.csv`, [['거래처', '수금 현금', '수금 통장', '수금 어음', '수금 계', '할인', '지급'], ...rcpSum.rows, ['합계', ...rcpSum.tot]])} className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"><Download className="w-3 h-3" /> CSV</button>
          </div>
          <ReportTable head={['거래처', '수금 현금', '수금 통장', '수금 어음', '수금 계', '할인', '지급']} rows={rcpSum.rows} foot={['합계', ...rcpSum.tot]} numFrom={1} />
          <p className="text-[11px] text-slate-500">수금·지급 입력 화면에서 등록한 건만 집계합니다(전표 동시 수금은 거래처 원장·일계표에 있음).</p>
        </div>
      )}

      {section === 'billbook' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="font-semibold">기간</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span>~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <select value={bbKind} onChange={e => setBbKind(e.target.value)} className="border border-slate-300 rounded px-2 py-1"><option value="all">받을+지급</option><option value="받을어음">받을어음</option><option value="지급어음">지급어음</option></select>
            <span className="text-slate-500">기준: 만기일</span>
            <button onClick={() => downloadCsv(`어음장부_${from}_${to}.csv`, [['만기일', '구분', '어음번호', '거래처', '은행', '상태', '금액'], ...billBook.rows, ['합계', '', '', '', '', '', billBook.total]])} className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"><Download className="w-3 h-3" /> CSV</button>
          </div>
          <ReportTable head={['만기일', '구분', '어음번호', '거래처', '은행', '상태', '금액']} rows={billBook.rows} foot={['합계', '', '', '', '', '', billBook.total]} numFrom={6} />
        </div>
      )}

      {section === 'prodsum' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="font-semibold">기간</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span>~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <button onClick={() => downloadCsv(`상품매입매출집계표_${from}_${to}.csv`, [['품명', '규격', '단위', '매입', '반입', '매출', '반출', '매입액', '반입액', '매출액', '반출액'], ...prodSum.rows, ['합계', '', '', '', '', '', '', ...prodSum.tot]])} className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"><Download className="w-3 h-3" /> CSV</button>
          </div>
          <ReportTable head={['품명', '규격', '단위', '매입', '반입', '매출', '반출', '매입액', '반입액', '매출액', '반출액']} rows={prodSum.rows} foot={['합계', '', '', '', '', '', '', ...prodSum.tot]} numFrom={3} />
          <p className="text-[11px] text-slate-500">원본 «상품매입매출집계표»(품명·단위·규격, 매입·반입·매출·반출 수량과 금액)를 따랐습니다. 금액은 공급가 기준.</p>
        </div>
      )}

      {section === 'subulsum' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="font-semibold">기간</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span>~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span className="text-slate-500">재고액 합계 {won(subulSum.tot)}원</span>
            <button onClick={() => downloadCsv(`상품수불집계표_${from}_${to}.csv`, [['품명', '단위', '규격', '전재고', '매입', '반입', '매출', '반출', '현재고', '매입가', '재고액'], ...subulSum.rows])} className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"><Download className="w-3 h-3" /> CSV</button>
          </div>
          <ReportTable head={['품명', '단위', '규격', '전재고', '매입', '반입', '매출', '반출', '현재고', '매입가', '재고액']} rows={subulSum.rows} numFrom={3} />
          <p className="text-[11px] text-slate-500">원본 «상품수불집계표» 열(전재고·매입·반입·매출·반출·현재고·매입가·재고액)을 따랐습니다. 전재고 = 이월재고 + 기간 이전 수불. 이관 품목은 이월재고가 0이라 이 데이터 안의 거래만 반영됩니다.</p>
        </div>
      )}

      {section === 'subulbook' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input value={sbQ} onChange={e => setSbQ(e.target.value)} placeholder="품명·규격 (예: 볼트 3/8)" className="border border-slate-300 rounded px-2 py-1 w-52" />
            <label className="font-semibold">기간</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span>~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            {subulBook.name && <span className="text-slate-500">이월재고 {subulBook.open}</span>}
          </div>
          {subulBook.name ? <ReportTable head={['일자', '구분', '품명/거래처', '규격', '입고', '출고', '단가', '금액', '잔고']} rows={subulBook.rows.map(r => r.slice(0, 9))} numFrom={4} /> : <p className="text-xs text-slate-500">품명이나 규격 일부를 넣으면 그 품목들의 입고·출고·잔고를 날짜순으로 보여줍니다.</p>}
          <p className="text-[11px] text-slate-500">원본 «상품수불장»(일자·품명/거래처·규격/현장명·입고·출고·단가·금액·잔고)을 따랐습니다. 잔고는 검색된 품목 전체의 합산 누계입니다.</p>
        </div>
      )}

      {section === 'rcpquery' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="font-semibold">기간</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span>~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <button onClick={() => downloadCsv(`수금지급조회_${from}_${to}.csv`, [['일자', '구분', '수금', '지급', '적요'], ...rcpQuery.rows, ['합계', '', ...rcpQuery.tot]])} className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"><Download className="w-3 h-3" /> CSV</button>
          </div>
          <ReportTable head={['일자', '구분', '수금', '지급', '적요']} rows={rcpQuery.rows} foot={['합계', '', ...rcpQuery.tot, '']} numFrom={2} />
          <p className="text-[11px] text-slate-500">원본 «수금지급조회»(일자·구분·수금·지급·적요·비고)를 따랐습니다. 전표에서 동시에 받은·준 돈도 «전표 동시»로 함께 보여줍니다.</p>
        </div>
      )}

      {section === 'slipstatus' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="font-semibold">기간</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
            <span>~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-slate-300 rounded px-2 py-1" />
          </div>
          <ReportTable head={['월', '매출', '매입', '반입', '반출', '견적', '발주', '납품', '수주', '합계']} rows={slipStatus.rows} foot={['합계', ...slipStatus.tot]} numFrom={1} />
        </div>
      )}
    </div>
  );
}
