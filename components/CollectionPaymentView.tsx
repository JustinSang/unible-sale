'use client';

import React, { useState, useMemo, useDeferredValue } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Plus,
  Calendar,
  CheckCircle2,
  Building,
  DollarSign,
  TrendingUp,
  AlertCircle,
  X,
  BarChart3
} from 'lucide-react';
import type { Customer, CollectionPayment, Slip, OSTheme } from '@/types';

interface CollectionPaymentViewProps {
  customers: Customer[];
  collections: CollectionPayment[];
  slips?: Slip[];
  onAddCollection: (data: {
    date: string;
    type: 'collection' | 'payment';
    customerId: string;
    method: 'cash' | 'bank' | 'bill';
    amount: number;
    memo?: string;
  }) => Promise<void>;
  osTheme: OSTheme;
}

export function CollectionPaymentView({
  customers,
  collections,
  slips = [],
  onAddCollection,
  osTheme
}: CollectionPaymentViewProps) {
  const today = new Date().toISOString().slice(0, 10);
  const currentMonthPrefix = today.slice(0, 7);

  const [date, setDate] = useState<string>(today);
  const [type, setType] = useState<'collection' | 'payment'>('collection');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [method, setMethod] = useState<'cash' | 'bank' | 'bill'>('bank');
  const [amount, setAmount] = useState<number>(0);
  const [memo, setMemo] = useState<string>('');

  const [searchTerm, setSearchTerm] = useState<string>('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Customer search filter
  const [customerSearchFilter, setCustomerSearchFilter] = useState<string>('');
  const deferredCustomerSearch = useDeferredValue(customerSearchFilter);

  const filteredCustomersList = useMemo(() => {
    if (!deferredCustomerSearch.trim()) return customers;
    const q = deferredCustomerSearch.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.bizNumber.includes(q)
    );
  }, [customers, deferredCustomerSearch]);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId || c.code === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  // KPI calculations
  const kpiData = useMemo(() => {
    let totalReceivables = 0;
    customers.forEach(c => { totalReceivables += (c.receivables || 0); });

    let monthlyCollections = 0;
    let monthlyPayments = 0;
    collections.forEach(item => {
      if (item.date.startsWith(currentMonthPrefix)) {
        if (item.type === 'collection') monthlyCollections += item.amount;
        else monthlyPayments += item.amount;
      }
    });

    let monthlySales = 0;
    slips.forEach(s => {
      if (s.slipDate.startsWith(currentMonthPrefix) && s.slipType === 'sales') {
        monthlySales += s.totalAmount;
      }
    });
    const collectionRate = monthlySales > 0 ? Math.round((monthlyCollections / monthlySales) * 100) : 0;

    return { totalReceivables, monthlyCollections, monthlyPayments, collectionRate };
  }, [customers, collections, slips, currentMonthPrefix]);

  const filteredHistory = useMemo(() => {
    return collections.filter(item => {
      if (!deferredSearchTerm.trim()) return true;
      const q = deferredSearchTerm.toLowerCase();
      return (
        item.customerName.toLowerCase().includes(q) ||
        item.date.includes(q) ||
        (item.memo && item.memo.toLowerCase().includes(q))
      );
    });
  }, [collections, deferredSearchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || amount <= 0) {
      alert('거래처와 0원 이상의 금액을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddCollection({ date, type, customerId: selectedCustomerId, method, amount, memo });
      setAmount(0);
      setMemo('');
      alert(`${type === 'collection' ? '수금' : '지급'} 처리가 완료되었습니다.`);
    } catch (err: any) {
      alert(err.message || '처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatKRW = (num: number) => num.toLocaleString('ko-KR') + '원';

  return (
    <div className="space-y-4">
      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-rose-600 text-[11px] font-bold mb-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> 총 미수금 잔액
              </div>
              <div className="text-xl font-black text-rose-700 font-mono">
                {formatKRW(kpiData.totalReceivables)}
              </div>
              <div className="text-[10px] text-rose-500 mt-0.5">전 거래처 합계</div>
            </div>
            <DollarSign className="w-9 h-9 text-rose-300" />
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-emerald-600 text-[11px] font-bold mb-1 flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5" /> 당월 수금 합계
              </div>
              <div className="text-xl font-black text-emerald-700 font-mono">
                {formatKRW(kpiData.monthlyCollections)}
              </div>
              <div className="text-[10px] text-emerald-500 mt-0.5">{currentMonthPrefix} 입금 총액</div>
            </div>
            <ArrowDownLeft className="w-9 h-9 text-emerald-300" />
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-blue-600 text-[11px] font-bold mb-1 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> 당월 지급 합계
              </div>
              <div className="text-xl font-black text-blue-700 font-mono">
                {formatKRW(kpiData.monthlyPayments)}
              </div>
              <div className="text-[10px] text-blue-500 mt-0.5">{currentMonthPrefix} 출금 총액</div>
            </div>
            <ArrowUpRight className="w-9 h-9 text-blue-300" />
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-amber-600 text-[11px] font-bold mb-1 flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5" /> 당월 수금률
              </div>
              <div className="text-xl font-black text-amber-700 font-mono">
                {kpiData.collectionRate}%
              </div>
              <div className="text-[10px] text-amber-500 mt-0.5">수금 / 매출 × 100</div>
            </div>
            <TrendingUp className="w-9 h-9 text-amber-300" />
          </div>
        </div>
      </div>

      {/* Top Registration Form */}
      <div className={`p-4 rounded-xl border shadow-sm ${
        osTheme === 'winxp-retro' ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span>수금 및 지급 관리 (외상매출금 회수 및 미수금 정리)</span>
            </h2>
            <p className="text-xs text-slate-500">
              외상 매출대금 통장입금, 현금수금, 어음 수령 시 거래처 외상잔액 즉시 자동 차감
            </p>
          </div>

          {/* Type Toggle Cards */}
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setType('collection')}
              className={`px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all border ${
                type === 'collection'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <div className="text-left">
                <div>외상 수금</div>
                <div className={`text-[10px] font-normal ${type === 'collection' ? 'text-emerald-200' : 'text-slate-400'}`}>입금 처리</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setType('payment')}
              className={`px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all border ${
                type === 'payment'
                  ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <div className="text-left">
                <div>매입 지급</div>
                <div className={`text-[10px] font-normal ${type === 'payment' ? 'text-blue-200' : 'text-slate-400'}`}>출금 처리</div>
              </div>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">처리 일자</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">거래처 선택</label>
              {selectedCustomerId && (
                <button type="button" onClick={() => { setSelectedCustomerId(''); setCustomerSearchFilter(''); }} className="text-[11px] text-rose-500 hover:underline font-medium">선택 취소</button>
              )}
            </div>
            <div className="flex gap-1.5 mb-1.5">
              <input
                type="text"
                placeholder="🔍 거래처 검색..."
                value={customerSearchFilter}
                onChange={e => setCustomerSearchFilter(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 font-medium transition-colors"
              />
              {customerSearchFilter && (
                <button type="button" onClick={() => setCustomerSearchFilter('')} className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 rounded-lg font-bold"><X className="w-3 h-3" /></button>
              )}
            </div>
            <select
              value={selectedCustomerId}
              onChange={e => setSelectedCustomerId(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- 거래처를 선택하세요 --</option>
              {filteredCustomersList.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code}) - 미수: {formatKRW(c.receivables || 0)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">결제 수단</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value as any)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500"
            >
              <option value="bank">통장 계좌입금</option>
              <option value="cash">현금 수금</option>
              <option value="bill">전자어음 / 약속어음</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">수금(지급) 금액</label>
            <input
              type="number"
              placeholder="금액 입력"
              value={amount || ''}
              onChange={e => setAmount(Number(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono font-bold focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <input
              type="text"
              placeholder="적요 / 입금인 메모 (예: 2월분 정기결제 국민은행 입금)"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors ${
                type === 'collection'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? '처리 중...' : (type === 'collection' ? '수금 전표 등록' : '지급 전표 등록')}</span>
            </button>
          </div>
        </form>

        {selectedCustomer && (
          <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between text-xs bg-slate-50 p-3 rounded-lg">
            <div className="flex items-center gap-4">
              <span className="text-slate-600 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-600" />
                선택 거래처: <strong>{selectedCustomer.name}</strong>
              </span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-600">현재 외상미수금: <strong className="font-mono text-rose-600">{formatKRW(selectedCustomer.receivables || 0)}</strong></span>
            </div>
            <div>
              {type === 'collection' ? '수금' : '지급'} 후 예상 잔액: <strong className="font-mono text-blue-700">{formatKRW(Math.max(0, (selectedCustomer.receivables || 0) - amount))}</strong>
            </div>
          </div>
        )}
      </div>

      {/* History Table */}
      <div className={`rounded-xl border shadow-sm overflow-hidden ${
        osTheme === 'winxp-retro' ? 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-200">
          <h3 className="font-bold text-xs text-slate-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            수금 / 지급 전표 처리 내역 ({filteredHistory.length}건)
          </h3>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="거래처/적요 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-8 py-1.5 border border-slate-300 rounded-lg bg-white text-xs w-56 focus:ring-1 focus:ring-blue-500"
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto" role="region" aria-label="수금 지급 내역 그리드">
          <table className="w-full text-left text-xs border-collapse font-sans" role="grid">
            <thead role="rowgroup">
              <tr className="bg-slate-50/90 backdrop-blur-sm text-slate-500 font-semibold border-b border-slate-200 select-none whitespace-nowrap sticky top-0 z-10">
                <th className="py-3 px-3 min-w-[100px]">처리일자</th>
                <th className="py-3 px-3 min-w-[90px]">구분</th>
                <th className="py-3 px-3 min-w-[140px]">거래처명</th>
                <th className="py-3 px-3 min-w-[90px]">수단</th>
                <th className="py-3 px-3 min-w-[120px] text-right">금회 처리금액</th>
                <th className="py-3 px-3 min-w-[110px] text-right">처리 전 잔액</th>
                <th className="py-3 px-3 min-w-[110px] text-right">처리 후 잔액</th>
                <th className="py-3 px-3 min-w-[160px]">적요 메모</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white" role="rowgroup">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Wallet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    등록된 수금/지급 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredHistory.map(item => (
                  <tr key={item.id} role="row" className="hover:bg-blue-50/40 transition-colors whitespace-nowrap">
                    <td className="py-2.5 px-3 font-mono text-slate-600">{item.date}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.type === 'collection' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {item.type === 'collection' ? '수금(입금)' : '지급(출금)'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{item.customerName}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {item.method === 'bank' ? '통장계좌' : item.method === 'cash' ? '현금' : '어음'}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold ${
                      item.type === 'collection' ? 'text-emerald-700' : 'text-blue-700'
                    }`}>
                      {formatKRW(item.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                      {formatKRW(item.prevBalance)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-800">
                      {formatKRW(item.currentBalance)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{item.memo || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
