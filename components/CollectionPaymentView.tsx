'use client';

import React, { useState, useMemo } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Plus,
  Calendar,
  CheckCircle2,
  Building,
  DollarSign
} from 'lucide-react';
import type { Customer, CollectionPayment, OSTheme } from '@/types';

interface CollectionPaymentViewProps {
  customers: Customer[];
  collections: CollectionPayment[];
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
  onAddCollection,
  osTheme
}: CollectionPaymentViewProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState<string>(today);
  const [type, setType] = useState<'collection' | 'payment'>('collection');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const [method, setMethod] = useState<'cash' | 'bank' | 'bill'>('bank');
  const [amount, setAmount] = useState<number>(0);
  const [memo, setMemo] = useState<string>('');

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId || c.code === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const filteredHistory = useMemo(() => {
    return collections.filter(item => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        item.customerName.toLowerCase().includes(q) ||
        item.date.includes(q) ||
        (item.memo && item.memo.toLowerCase().includes(q))
      );
    });
  }, [collections, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || amount <= 0) {
      alert('거래처와 0원 이상의 금액을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddCollection({
        date,
        type,
        customerId: selectedCustomerId,
        method,
        amount,
        memo
      });
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
      {/* Top Registration Form */}
      <div className={`p-4 rounded-lg border shadow-xs ${
        osTheme === 'winxp-retro'
          ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
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

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">구분:</span>
            <div className="flex rounded border border-slate-300 overflow-hidden bg-slate-100">
              <button
                type="button"
                onClick={() => setType('collection')}
                className={`px-3 py-1 font-bold transition-colors ${
                  type === 'collection' ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                외상 수금 (입금)
              </button>
              <button
                type="button"
                onClick={() => setType('payment')}
                className={`px-3 py-1 font-bold transition-colors ${
                  type === 'payment' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                매입 지급 (출금)
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">처리 일자</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
              required
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">거래처 선택</label>
            <select
              value={selectedCustomerId}
              onChange={e => setSelectedCustomerId(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-medium"
            >
              {customers.map(c => (
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
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
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
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-right font-mono font-bold"
              required
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <input
              type="text"
              placeholder="적요 / 입금인 메모 (예: 2월분 정기결제 국민은행 입금)"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1 shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? '처리 중...' : '수금 전표 등록'}</span>
            </button>
          </div>
        </form>

        {selectedCustomer && (
          <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between text-xs bg-slate-50 p-2.5 rounded">
            <div className="flex items-center gap-4">
              <span className="text-slate-600">선택 거래처: <strong>{selectedCustomer.name}</strong></span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-600">현재 외상미수금: <strong className="font-mono text-rose-600">{formatKRW(selectedCustomer.receivables || 0)}</strong></span>
            </div>
            <div>
              수금 후 예상 잔액: <strong className="font-mono text-blue-700">{formatKRW(Math.max(0, (selectedCustomer.receivables || 0) - amount))}</strong>
            </div>
          </div>
        )}
      </div>

      {/* History Table */}
      <div className={`p-4 rounded-lg border shadow-xs overflow-hidden ${
        osTheme === 'winxp-retro'
          ? 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="font-bold text-xs text-slate-800">
            수금 / 지급 전표 처리 내역 ({filteredHistory.length}건)
          </h3>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="거래처/적요 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-300 rounded bg-white text-xs w-56"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold select-none">
                <th className="py-2 px-3">처리일자</th>
                <th className="py-2 px-3">구분</th>
                <th className="py-2 px-3">거래처명</th>
                <th className="py-2 px-3">수단</th>
                <th className="py-2 px-3 text-right">금회 처리금액</th>
                <th className="py-2 px-3 text-right">처리 전 잔액</th>
                <th className="py-2 px-3 text-right">처리 후 잔액</th>
                <th className="py-2 px-3">적요 메모</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    등록된 수금/지급 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredHistory.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-slate-600">{item.date}</td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        item.type === 'collection' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {item.type === 'collection' ? '수금(입금)' : '지급(출금)'}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{item.customerName}</td>
                    <td className="py-2 px-3 text-slate-600">
                      {item.method === 'bank' ? '통장계좌' : item.method === 'cash' ? '현금' : '어음'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                      {formatKRW(item.amount)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-500">
                      {formatKRW(item.prevBalance)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-blue-800">
                      {formatKRW(item.currentBalance)}
                    </td>
                    <td className="py-2 px-3 text-slate-600">{item.memo || '-'}</td>
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
