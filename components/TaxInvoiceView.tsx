'use client';

import React, { useState, useMemo } from 'react';
import {
  FileCheck,
  Plus,
  Search,
  Printer,
  X,
  CheckCircle,
  Building,
  DollarSign
} from 'lucide-react';
import type { Customer, TaxInvoice, SystemConfig, OSTheme } from '@/types';

interface TaxInvoiceViewProps {
  customers: Customer[];
  taxInvoices: TaxInvoice[];
  config: SystemConfig;
  onAddTaxInvoice: (tax: Partial<TaxInvoice>) => Promise<void>;
  osTheme: OSTheme;
}

export function TaxInvoiceView({
  customers,
  taxInvoices,
  config,
  onAddTaxInvoice,
  osTheme
}: TaxInvoiceViewProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<TaxInvoice | null>(null);

  // Form State
  const [form, setForm] = useState<Partial<TaxInvoice>>({
    taxNo: `TX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-001`,
    taxDate: new Date().toISOString().slice(0, 10),
    customerName: customers[0]?.name || '',
    productSummary: '화스너 및 배관자재 일체',
    supplyAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    isIssued: true,
    memo: ''
  });

  const filteredInvoices = useMemo(() => {
    return taxInvoices.filter(tx => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        tx.customerName.toLowerCase().includes(q) ||
        tx.taxNo.toLowerCase().includes(q) ||
        tx.productSummary.toLowerCase().includes(q)
      );
    });
  }, [taxInvoices, searchTerm]);

  const handleSupplyChange = (val: number) => {
    const supply = Number(val) || 0;
    const tax = Math.round(supply * 0.1);
    setForm({
      ...form,
      supplyAmount: supply,
      taxAmount: tax,
      totalAmount: supply + tax
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName || !form.supplyAmount) {
      alert('거래처와 공급가액을 입력해주세요.');
      return;
    }
    await onAddTaxInvoice(form);
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
              <FileCheck className="w-4 h-4 text-blue-600" />
              <span>기간별 세금계산서 발행 및 합산 청구 관리 ({taxInvoices.length}건)</span>
            </h2>
            <p className="text-xs text-slate-500">
              월말 거래처별 전표 합산 청구서 및 국세청 전자세금계산서 표준 서식 발행
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="거래처/세금계산서번호 검색..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded bg-white text-xs w-56"
              />
            </div>

            <button
              onClick={() => {
                setForm({
                  taxNo: `TX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(taxInvoices.length + 1).padStart(3, '0')}`,
                  taxDate: new Date().toISOString().slice(0, 10),
                  customerName: customers[0]?.name || '',
                  productSummary: '화스너 및 배관자재 일체',
                  supplyAmount: 0,
                  taxAmount: 0,
                  totalAmount: 0,
                  isIssued: true,
                  memo: ''
                });
                setIsModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" /> 세금계산서 발행
            </button>
          </div>
        </div>
      </div>

      {/* Tax Invoices Table */}
      <div className={`p-4 rounded-lg border shadow-xs overflow-hidden ${
        osTheme === 'winxp-retro'
          ? 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold select-none">
                <th className="py-2.5 px-3">작성일자</th>
                <th className="py-2.5 px-3">계산서 승인번호</th>
                <th className="py-2.5 px-3">공급받는자 (거래처)</th>
                <th className="py-2.5 px-3">품목 요약</th>
                <th className="py-2.5 px-3 text-right">공급가액</th>
                <th className="py-2.5 px-3 text-right">세액 (10%)</th>
                <th className="py-2.5 px-3 text-right">합계금액</th>
                <th className="py-2.5 px-3 text-center">발행상태</th>
                <th className="py-2.5 px-3 text-center">인쇄 미리보기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    발행된 세금계산서 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-slate-600">{tx.taxDate}</td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{tx.taxNo}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{tx.customerName}</td>
                    <td className="py-2 px-3 text-slate-600">{tx.productSummary}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      {formatKRW(tx.supplyAmount)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-500">
                      {formatKRW(tx.taxAmount)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-blue-700">
                      {formatKRW(tx.totalAmount)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {tx.isIssued ? '발행완료' : '작성중'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => setSelectedInvoice(tx)}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 text-blue-700 border border-slate-200 inline-flex items-center gap-1"
                      >
                        <Printer className="w-3 h-3" /> 세금계산서
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Preview Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-6 text-xs text-slate-900">
            <div className="flex justify-between items-center pb-3 border-b mb-4">
              <h3 className="font-bold text-sm text-red-700">
                전자세금계산서 (공급자 보관용 / 공급받는자용)
              </h3>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border-2 border-red-600 p-4 rounded text-xs space-y-4 font-sans">
              <div className="text-center font-black text-xl text-red-700 tracking-widest border-b-2 border-red-600 pb-2">
                세 금 계 산 서
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border border-red-400 p-2">
                  <div className="bg-red-50 text-red-800 font-bold px-1 py-0.5 mb-1">공급자</div>
                  <div>등록번호: <strong>{config.companyInfo.bizNumber}</strong></div>
                  <div>상호: {config.companyInfo.name} 대표: {config.companyInfo.ceo}</div>
                  <div>사업장: {config.companyInfo.address}</div>
                  <div>업태/종목: {config.companyInfo.bizType} / {config.companyInfo.bizItem}</div>
                </div>
                <div className="border border-blue-400 p-2">
                  <div className="bg-blue-50 text-blue-800 font-bold px-1 py-0.5 mb-1">공급받는자</div>
                  <div>상호: <strong>{selectedInvoice.customerName}</strong></div>
                  <div>작성일자: {selectedInvoice.taxDate}</div>
                  <div>승인번호: {selectedInvoice.taxNo}</div>
                </div>
              </div>

              <div className="border border-slate-300 p-2 bg-slate-50 flex justify-between font-bold text-sm">
                <span>합계금액:</span>
                <span className="font-mono text-blue-800">{formatKRW(selectedInvoice.totalAmount)}</span>
              </div>

              <table className="w-full border-collapse border border-slate-300 text-center">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border p-1.5">품목 및 규격</th>
                    <th className="border p-1.5 text-right">공급가액</th>
                    <th className="border p-1.5 text-right">세액</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2">{selectedInvoice.productSummary}</td>
                    <td className="border p-2 text-right font-mono">{formatKRW(selectedInvoice.supplyAmount)}</td>
                    <td className="border p-2 text-right font-mono">{formatKRW(selectedInvoice.taxAmount)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="text-center text-[11px] text-slate-500 pt-2">
                위 금액을 정히 영수(청구) 함.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-3 py-1.5 border rounded bg-white hover:bg-slate-50"
              >
                닫기
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" /> 인쇄하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tax Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border shadow-xl max-w-md w-full p-4 text-xs">
            <div className="flex justify-between items-center pb-3 border-b mb-3">
              <h3 className="font-bold text-sm text-slate-800">세금계산서 신규 발행</h3>
              <button onClick={() => setIsModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">거래처 선택</label>
                <select
                  value={form.customerName}
                  onChange={e => setForm({ ...form, customerName: e.target.value })}
                  className="w-full px-2.5 py-1.5 border rounded bg-white"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.bizNumber || '사업자미등록'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">품목 요약</label>
                <input
                  type="text"
                  value={form.productSummary || ''}
                  onChange={e => setForm({ ...form, productSummary: e.target.value })}
                  className="w-full px-2.5 py-1.5 border rounded bg-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">공급가액 (원)</label>
                <input
                  type="number"
                  placeholder="공급가액 입력"
                  value={form.supplyAmount || ''}
                  onChange={e => handleSupplyChange(Number(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 border rounded bg-white text-right font-mono font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded">
                <div>
                  <span className="text-slate-500">세액(10%):</span>{' '}
                  <strong className="font-mono">{formatKRW(form.taxAmount || 0)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">총 청구금액:</span>{' '}
                  <strong className="font-mono text-blue-700">{formatKRW(form.totalAmount || 0)}</strong>
                </div>
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
                  발행 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
