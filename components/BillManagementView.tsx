'use client';

import React, { useState, useMemo, useDeferredValue } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Calendar,
  AlertTriangle,
  Building,
  CheckCircle2,
  X,
  Wallet,
  Clock,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import type { Bill, BillStatus, Customer, OSTheme } from '@/types';

interface BillManagementViewProps {
  bills: Bill[];
  customers: Customer[];
  onAddBill: (b: Partial<Bill>) => Promise<void>;
  onUpdateBill: (id: string, patch: Partial<Bill>) => Promise<void>;
  onDeleteBill: (id: string) => Promise<void>;
  osTheme: OSTheme;
}

export function BillManagementView({
  bills,
  customers,
  onAddBill,
  onUpdateBill,
  onDeleteBill,
  osTheme
}: BillManagementViewProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [filterKind, setFilterKind] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  // 원본 어음 상태(BillStatusMode): 받을어음 보유·결제·할인·부도·배서 / 지급어음 미결제·결제. 옛 표기 «정상»·«결제완료»도 같은 뜻으로 읽는다.
  const stateOf = (b: Bill): BillStatus => (b.status === '정상' ? (b.billKind === '지급어음' ? '미결제' : '보유') : b.status === '결제완료' ? '결제' : b.status);
  const [action, setAction] = useState<null | { bill: Bill; kind: 'settle' | 'discount' | 'endorse' | 'dishonor' | 'release' }>(null);
  const [act, setAct] = useState<{ date: string; who: string; rate: string; period: string; amount: string }>({ date: '', who: '', rate: '', period: '', amount: '' });

  const [form, setForm] = useState<Partial<Bill>>({
    billNo: '',
    billKind: '받을어음',
    amount: 0,
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    customerName: customers[0]?.name || '',
    bank: '국민은행',
    status: '보유',
    memo: ''
  });

  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      const matchKind = filterKind === 'all' || b.billKind === filterKind;
      if (!matchKind) return false;
      if (filterStatus !== 'all' && stateOf(b) !== filterStatus) return false;
      if (!deferredSearchTerm.trim()) return true;
      const q = deferredSearchTerm.toLowerCase();
      return (
        b.billNo.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        b.bank.toLowerCase().includes(q)
      );
    });
  }, [bills, filterKind, filterStatus, deferredSearchTerm]);

  // KPI Calculations
  const kpiData = useMemo(() => {
    let receiveBalance = 0;
    let payBalance = 0;
    let dueThisMonth = 0;
    const todayStr = new Date().toISOString().slice(0, 7); // YYYY-MM

    bills.forEach(b => {
      const st = stateOf(b);
      if (b.billKind === '받을어음' && st === '보유') receiveBalance += b.amount; // 보유어음합계
      if (b.billKind === '지급어음' && st === '미결제') payBalance += b.amount;   // 미결재합계액
      if (b.dueDate.startsWith(todayStr) && (st === '보유' || st === '미결제')) dueThisMonth++;
    });
    return { receiveBalance, payBalance, dueThisMonth };
  }, [bills]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.billNo || !form.amount) {
      alert('어음 번호와 금액을 입력해주세요.');
      return;
    }
    await onAddBill(form);
    setIsModalOpen(false);
  };

  const openAction = (bill: Bill, kind: 'settle' | 'discount' | 'endorse' | 'dishonor' | 'release') => {
    setAct({ date: new Date().toISOString().slice(0, 10), who: '', rate: '', period: '', amount: '' });
    setAction({ bill, kind });
  };
  const handleDeleteBill = async (b: Bill) => {
    if (!window.confirm(`어음 «${b.billNo}»을(를) 삭제하시겠습니까?`)) return;
    try { await onDeleteBill(b.id); } catch (e: any) { alert(e.message); }
  };
  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!action) return;
    const { bill, kind } = action;
    if ((kind === 'endorse' || kind === 'discount') && !act.who.trim()) { alert(kind === 'endorse' ? '배서할 거래처를 입력하세요.' : '할인받은 곳(은행 등)을 입력하세요.'); return; }
    const patch: Partial<Bill> =
      kind === 'settle' ? { status: '결제', payDate: act.date } :
      kind === 'discount' ? { status: '할인', discountDate: act.date, discountCustomer: act.who.trim(), discountRate: Number(act.rate) || 0, discountPeriod: Number(act.period) || 0, discountAmount: Number(act.amount) || 0 } :
      kind === 'endorse' ? { status: '배서', payCustomerName: act.who.trim(), payDate: act.date } :
      kind === 'dishonor' ? { status: '부도', dishonorDate: act.date } :
      { status: '보유', releaseDishonorDate: act.date };
    try { await onUpdateBill(bill.id, patch); setAction(null); } catch (err: any) { alert(err.message); }
  };

  const formatKRW = (num: number) => num.toLocaleString('ko-KR') + '원';

  return (
    <div className="space-y-4">
      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-emerald-600 text-[11px] font-bold mb-1 flex items-center gap-1"><ArrowDownLeft className="w-3.5 h-3.5" /> 받을어음 잔액</div>
              <div className="text-2xl font-black text-emerald-700 font-mono">{formatKRW(kpiData.receiveBalance)}</div>
              <div className="text-[10px] text-emerald-500 mt-0.5">보유어음합계 (결제·할인·배서 전)</div>
            </div>
            <Wallet className="w-9 h-9 text-emerald-300" />
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-rose-600 text-[11px] font-bold mb-1 flex items-center gap-1"><ArrowUpRight className="w-3.5 h-3.5" /> 지급어음 잔액</div>
              <div className="text-2xl font-black text-rose-700 font-mono">{formatKRW(kpiData.payBalance)}</div>
              <div className="text-[10px] text-rose-500 mt-0.5">미결재합계액</div>
            </div>
            <CreditCard className="w-9 h-9 text-rose-300" />
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-amber-600 text-[11px] font-bold mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 당월 만기 도래</div>
              <div className="text-2xl font-black text-amber-700 font-mono">{kpiData.dueThisMonth}<span className="text-sm font-semibold text-amber-500 ml-1">건</span></div>
              <div className="text-[10px] text-amber-500 mt-0.5">이번 달 결제 예정 어음</div>
            </div>
            <Calendar className="w-9 h-9 text-amber-300" />
          </div>
        </div>
      </div>

      {/* Top Banner */}
      <div className={`p-4 rounded-xl border shadow-sm ${
        osTheme === 'winxp-retro'
          ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>어음 관리 (받을어음 &middot; 지급어음 만기 및 결제 추적)</span>
            </h2>
            <p className="text-xs text-slate-500">
              전자어음 및 약속어음 수령/배서 양도, 만기일 캘린더 및 결제 상태 추적
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="어음번호/거래처/은행 검색..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-8 py-1.5 border border-slate-300 rounded-lg bg-white text-xs w-64 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X className="w-3.5 h-3.5" /></button>
              )}
            </div>

            <button
              onClick={() => {
                setForm({
                  billNo: `BILL-${Date.now().toString().slice(-8)}`,
                  billKind: '받을어음',
                  amount: 0,
                  issueDate: new Date().toISOString().slice(0, 10),
                  dueDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
                  customerName: customers[0]?.name || '',
                  bank: '국민은행',
                  status: '보유',
                  memo: ''
                });
                setIsModalOpen(true);
              }}
              className="px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> 어음 등록
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-600">구분:</span>
          <button
            onClick={() => setFilterKind('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
              filterKind === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            전체 ({bills.length})
          </button>
          <button
            onClick={() => setFilterKind('받을어음')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
              filterKind === '받을어음' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            받을어음 ({bills.filter(b => b.billKind === '받을어음').length})
          </button>
          <button
            onClick={() => setFilterKind('지급어음')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
              filterKind === '지급어음' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            지급어음 ({bills.filter(b => b.billKind === '지급어음').length})
          </button>
          <span className="font-semibold text-slate-600 ml-3">상태:</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-slate-300 rounded px-2 py-1 bg-white">
            <option value="all">전체</option>
            {['보유', '결제', '할인', '부도', '배서', '미결제'].map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
      </div>

      {/* Bills Table */}
      <div className={`rounded-xl border shadow-sm overflow-hidden ${
        osTheme === 'winxp-retro'
          ? 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto" role="region" aria-label="어음 마스터 그리드">
          <table className="w-full text-left text-xs border-collapse font-sans" role="grid">
            <thead role="rowgroup">
              <tr className="bg-slate-50/90 backdrop-blur-sm text-slate-500 font-semibold border-b border-slate-200 select-none whitespace-nowrap sticky top-0 z-10">
                <th className="py-3 px-3 min-w-[120px]">어음번호</th>
                <th className="py-3 px-3 min-w-[90px]">구분</th>
                <th className="py-3 px-3 min-w-[150px]">거래처명</th>
                <th className="py-3 px-3 min-w-[120px]">발행은행</th>
                <th className="py-3 px-3 min-w-[100px]">발행일자</th>
                <th className="py-3 px-3 min-w-[100px]">만기일자</th>
                <th className="py-3 px-3 min-w-[120px] text-right">어음금액</th>
                <th className="py-3 px-3 min-w-[80px] text-center">상태</th>
                <th className="py-3 px-3 min-w-[180px]">비고</th>
                <th className="py-3 px-3 min-w-[230px] text-center">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white" role="rowgroup">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    등록된 어음 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredBills.map(b => {
                  const today = new Date().toISOString().slice(0, 10);
                  const daysToDue = Math.ceil((new Date(b.dueDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
                  const st = stateOf(b);
                  const isNearDue = daysToDue >= 0 && daysToDue <= 7 && (st === '보유' || st === '미결제');

                  return (
                    <tr key={b.id} role="row" className={`hover:bg-blue-50/40 transition-colors whitespace-nowrap ${isNearDue ? 'bg-rose-50/30 border-l-[3px] border-l-rose-500' : ''}`}>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{b.billNo}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.billKind === '받을어음' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          {b.billKind}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{b.customerName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{b.bank}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{b.issueDate}</td>
                      <td className={`py-2.5 px-3 font-mono font-bold ${isNearDue ? 'text-rose-600' : 'text-slate-800'}`}>
                        {b.dueDate}
                        {isNearDue && <span className="ml-1 text-[9px] bg-rose-100 text-rose-600 px-1 rounded">D-{daysToDue}</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                        {formatKRW(b.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          st === '보유' || st === '미결제' ? 'bg-slate-100 text-slate-600' :
                          st === '결제' ? 'bg-emerald-100 text-emerald-700' :
                          st === '부도' ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {st}
                        </span>
                        {(st === '배서' && b.payCustomerName) && <div className="text-[10px] text-slate-500 mt-0.5">→ {b.payCustomerName}</div>}
                        {(st === '할인' && b.discountCustomer) && <div className="text-[10px] text-slate-500 mt-0.5">{b.discountCustomer}</div>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 truncate max-w-[200px]" title={b.memo}>{b.memo || '-'}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {b.billKind === '받을어음' && st === '보유' && (<>
                            <button onClick={() => openAction(b, 'settle')} className="px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold">결제</button>
                            <button onClick={() => openAction(b, 'discount')} className="px-1.5 py-0.5 rounded border border-amber-300 text-amber-700 hover:bg-amber-50 font-semibold">할인</button>
                            <button onClick={() => openAction(b, 'endorse')} className="px-1.5 py-0.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold">배서</button>
                            <button onClick={() => openAction(b, 'dishonor')} className="px-1.5 py-0.5 rounded border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold">부도</button>
                          </>)}
                          {b.billKind === '받을어음' && st === '부도' && (
                            <button onClick={() => openAction(b, 'release')} className="px-1.5 py-0.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold">부도해제</button>
                          )}
                          {b.billKind === '지급어음' && st === '미결제' && (
                            <button onClick={() => openAction(b, 'settle')} className="px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold">결제</button>
                          )}
                          <button onClick={() => handleDeleteBill(b)} className="px-1.5 py-0.5 rounded border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300" title="어음 삭제"><X className="w-3 h-3" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 어음 상태 변경 모달 */}
      {action && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleAction} className="bg-white rounded-lg border shadow-xl max-w-sm w-full p-4 text-xs space-y-3">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="font-bold text-sm text-slate-800">
                어음 {{ settle: '결제', discount: '할인', endorse: '배서', dishonor: '부도', release: '부도 해제' }[action.kind]} 처리
              </h3>
              <button type="button" onClick={() => setAction(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="text-slate-600">{action.bill.billNo} · {action.bill.customerName} · <b className="font-mono">{formatKRW(action.bill.amount)}</b></div>
            <div>
              <label className="block font-semibold mb-1">{action.kind === 'settle' ? '결제일' : action.kind === 'discount' ? '할인일' : action.kind === 'endorse' ? '배서일' : action.kind === 'dishonor' ? '부도일' : '해제일'}</label>
              <input type="date" value={act.date} onChange={e => setAct({ ...act, date: e.target.value })} className="w-full px-2.5 py-1.5 border rounded bg-white font-mono" required />
            </div>
            {(action.kind === 'endorse' || action.kind === 'discount') && (
              <div>
                <label className="block font-semibold mb-1">{action.kind === 'endorse' ? '배서처 (어음을 넘긴 거래처)' : '할인처 (은행 등)'}</label>
                <input type="text" list="bill-customers" value={act.who} onChange={e => setAct({ ...act, who: e.target.value })} className="w-full px-2.5 py-1.5 border rounded bg-white" />
                <datalist id="bill-customers">{customers.slice(0, 500).map(c => <option key={c.id} value={c.name} />)}</datalist>
              </div>
            )}
            {action.kind === 'discount' && (
              <div className="grid grid-cols-3 gap-2">
                <div><label className="block font-semibold mb-1">할인율(%)</label><input type="number" step="0.01" value={act.rate} onChange={e => setAct({ ...act, rate: e.target.value })} className="w-full px-2 py-1.5 border rounded text-right font-mono" /></div>
                <div><label className="block font-semibold mb-1">기간(일)</label><input type="number" value={act.period} onChange={e => setAct({ ...act, period: e.target.value })} className="w-full px-2 py-1.5 border rounded text-right font-mono" /></div>
                <div><label className="block font-semibold mb-1">할인금액</label><input type="number" value={act.amount} onChange={e => setAct({ ...act, amount: e.target.value })} className="w-full px-2 py-1.5 border rounded text-right font-mono" /></div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setAction(null)} className="px-3 py-1.5 rounded border">취소</button>
              <button type="submit" className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold">확인</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Bill Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border shadow-xl max-w-md w-full p-4 text-xs">
            <div className="flex justify-between items-center pb-3 border-b mb-3">
              <h3 className="font-bold text-sm text-slate-800">어음 신규 등록</h3>
              <button onClick={() => setIsModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">어음 구분</label>
                  <select
                    value={form.billKind}
                    onChange={e => setForm({ ...form, billKind: e.target.value as any, status: e.target.value === '지급어음' ? '미결제' : '보유' })}
                    className="w-full px-2.5 py-1.5 border rounded bg-white"
                  >
                    <option value="받을어음">받을어음</option>
                    <option value="지급어음">지급어음</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">어음 번호</label>
                  <input
                    type="text"
                    value={form.billNo || ''}
                    onChange={e => setForm({ ...form, billNo: e.target.value })}
                    className="w-full px-2.5 py-1.5 border rounded bg-white font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">거래처 선택</label>
                <select
                  value={form.customerName}
                  onChange={e => setForm({ ...form, customerName: e.target.value })}
                  className="w-full px-2.5 py-1.5 border rounded bg-white"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">발행은행</label>
                  <input
                    type="text"
                    value={form.bank || ''}
                    onChange={e => setForm({ ...form, bank: e.target.value })}
                    className="w-full px-2.5 py-1.5 border rounded bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">어음 금액 (원)</label>
                  <input
                    type="number"
                    value={form.amount || ''}
                    onChange={e => setForm({ ...form, amount: Number(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border rounded bg-white text-right font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">발행 일자</label>
                  <input
                    type="date"
                    value={form.issueDate}
                    onChange={e => setForm({ ...form, issueDate: e.target.value })}
                    className="w-full px-2.5 py-1.5 border rounded bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">만기 일자</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full px-2.5 py-1.5 border rounded bg-white font-mono font-bold text-blue-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold mb-1">수취일</label>
                  <input type="date" value={form.receiptDate || ''} onChange={e => setForm({ ...form, receiptDate: e.target.value })} className="w-full px-2 py-1.5 border rounded bg-white font-mono" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">발행인</label>
                  <input type="text" value={form.issuer || ''} onChange={e => setForm({ ...form, issuer: e.target.value })} className="w-full px-2 py-1.5 border rounded bg-white" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">결제은행</label>
                  <input type="text" value={form.payBank || ''} onChange={e => setForm({ ...form, payBank: e.target.value })} className="w-full px-2 py-1.5 border rounded bg-white" />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">비고 메모</label>
                <input
                  type="text"
                  placeholder="예: 공사 기성대금 전자어음 수령"
                  value={form.memo || ''}
                  onChange={e => setForm({ ...form, memo: e.target.value })}
                  className="w-full px-2.5 py-1.5 border rounded bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded border"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  등록 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
