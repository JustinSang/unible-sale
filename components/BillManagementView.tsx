'use client';

import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Calendar,
  AlertTriangle,
  Building,
  CheckCircle2,
  X
} from 'lucide-react';
import type { Bill, Customer, OSTheme } from '@/types';

interface BillManagementViewProps {
  bills: Bill[];
  customers: Customer[];
  onAddBill: (b: Partial<Bill>) => Promise<void>;
  osTheme: OSTheme;
}

export function BillManagementView({
  bills,
  customers,
  onAddBill,
  osTheme
}: BillManagementViewProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterKind, setFilterKind] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const [form, setForm] = useState<Partial<Bill>>({
    billNo: '',
    billKind: '받을어음',
    amount: 0,
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    customerName: customers[0]?.name || '',
    bank: '국민은행',
    status: '정상',
    memo: ''
  });

  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      const matchKind = filterKind === 'all' || b.billKind === filterKind;
      if (!matchKind) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        b.billNo.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        b.bank.toLowerCase().includes(q)
      );
    });
  }, [bills, filterKind, searchTerm]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.billNo || !form.amount) {
      alert('어음 번호와 금액을 입력해주세요.');
      return;
    }
    await onAddBill(form);
    setIsModalOpen(false);
  };

  const formatKRW = (num: number) => num.toLocaleString('ko-KR') + '원';

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className={`p-4 rounded-lg border shadow-xs ${
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
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded bg-white text-xs w-56"
              />
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
                  status: '정상',
                  memo: ''
                });
                setIsModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs"
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
            className={`px-2.5 py-1 rounded text-xs font-semibold ${
              filterKind === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            전체 ({bills.length})
          </button>
          <button
            onClick={() => setFilterKind('받을어음')}
            className={`px-2.5 py-1 rounded text-xs font-semibold ${
              filterKind === '받을어음' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            받을어음 ({bills.filter(b => b.billKind === '받을어음').length})
          </button>
          <button
            onClick={() => setFilterKind('지급어음')}
            className={`px-2.5 py-1 rounded text-xs font-semibold ${
              filterKind === '지급어음' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            지급어음 ({bills.filter(b => b.billKind === '지급어음').length})
          </button>
        </div>
      </div>

      {/* Bills Table */}
      <div className={`p-4 rounded-lg border shadow-xs overflow-hidden ${
        osTheme === 'winxp-retro'
          ? 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold select-none">
                <th className="py-2.5 px-3">어음번호</th>
                <th className="py-2.5 px-3">구분</th>
                <th className="py-2.5 px-3">거래처명</th>
                <th className="py-2.5 px-3">발행은행</th>
                <th className="py-2.5 px-3">발행일자</th>
                <th className="py-2.5 px-3">만기일자</th>
                <th className="py-2.5 px-3 text-right">어음금액</th>
                <th className="py-2.5 px-3 text-center">상태</th>
                <th className="py-2.5 px-3">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    등록된 어음 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredBills.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{b.billNo}</td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        b.billKind === '받을어음' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {b.billKind}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{b.customerName}</td>
                    <td className="py-2 px-3 text-slate-600">{b.bank}</td>
                    <td className="py-2 px-3 font-mono text-slate-500">{b.issueDate}</td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{b.dueDate}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-blue-800">
                      {formatKRW(b.amount)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {b.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600">{b.memo || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                    onChange={e => setForm({ ...form, billKind: e.target.value as any })}
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
