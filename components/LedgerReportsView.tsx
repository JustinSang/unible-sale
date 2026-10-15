'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Download } from 'lucide-react';
import { monthlyNet, quarterSummary, customerLedger, netBetween, monthlyStock, withOpening } from '@/lib/ledgerRules';
import type { Slip, CollectionPayment, Customer, TaxInvoice, OSTheme, Product } from '@/types';

interface LedgerReportsViewProps {
  slips: Slip[];
  collections: CollectionPayment[];
  customers: Customer[];
  taxInvoices: TaxInvoice[];
  products?: Product[];
  customerPrices: Record<string, Record<string, any>>;
  osTheme: OSTheme;
}

type Section = 'daily' | 'cashbook' | 'period' | 'receivable' | 'ledger' | 'stockflow' | 'vat' | 'pricelist' | 'yearend' | 'phonebook';

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
  { id: 'phonebook', label: '전화번호부' }
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

export function LedgerReportsView({ slips: rawSlips, collections, customers, taxInvoices, products = [], customerPrices }: LedgerReportsViewProps) {
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
    </div>
  );
}
