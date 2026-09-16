'use client';

import React, { useState, useMemo, useDeferredValue } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  Building,
  Phone,
  MapPin,
  X,
  FileText,
  DollarSign,
  HardHat,
  Check,
  TrendingUp,
  Calendar,
  AlertCircle,
  BarChart3
} from 'lucide-react';
import type { Customer, Slip, OSTheme, CustomerSite } from '@/types';

interface CustomerMasterViewProps {
  customers: Customer[];
  slips: Slip[];
  onAddCustomer: (c: Partial<Customer>) => Promise<void>;
  onUpdateCustomer: (id: string, c: Partial<Customer>) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  osTheme: OSTheme;
}

export function CustomerMasterView({
  customers,
  slips,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  osTheme
}: CustomerMasterViewProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<'basic' | 'sites'>('basic');

  // Selected customer for viewing transactions history
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('all');
  const [expandedSlipId, setExpandedSlipId] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<Customer>>({
    code: '',
    name: '',
    bizNumber: '',
    ceo: '',
    tel: '',
    fax: '',
    mobile: '',
    address: '',
    bizType: '',
    bizItem: '',
    receivables: 0,
    closingDay: 25,
    priceTier: 1,
    email: '',
    taxEmail: '',
    memo: '',
    sites: []
  });

  // Form state for adding a new site within the customer modal
  const [newSite, setNewSite] = useState<Partial<CustomerSite>>({
    siteCode: '',
    siteName: '',
    manager: '',
    tel: '',
    address: '',
    memo: ''
  });

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if (!deferredSearchTerm.trim()) return true;
      const q = deferredSearchTerm.toLowerCase();
      const matchSite = c.sites?.some(s => s.siteName.toLowerCase().includes(q) || (s.manager && s.manager.toLowerCase().includes(q)));
      return (
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.bizNumber.includes(q) ||
        c.ceo.toLowerCase().includes(q) ||
        c.tel.includes(q) ||
        (c.mobile && c.mobile.includes(q)) ||
        matchSite
      );
    });
  }, [customers, deferredSearchTerm]);

  // KPI Calculations
  const kpiData = useMemo(() => {
    let totalReceivables = 0;
    let totalSites = 0;
    const today = new Date();
    const currentDay = today.getDate();
    let closingThisMonth = 0;
    customers.forEach(c => {
      totalReceivables += (c.receivables || 0);
      totalSites += (c.sites?.length || 0);
      if (c.closingDay && Math.abs(c.closingDay - currentDay) <= 5) closingThisMonth++;
    });
    return { totalCustomers: customers.length, totalReceivables, totalSites, closingThisMonth };
  }, [customers]);

  // Pagination for 790+ customers
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;
  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  // Slips for selected customer (with site filter)
  const customerSlips = useMemo(() => {
    if (!historyCustomer) return [];
    let list = slips.filter(s => s.customerId === historyCustomer.id);
    if (selectedSiteFilter !== 'all') {
      list = list.filter(s => s.siteName === selectedSiteFilter || s.siteId === selectedSiteFilter);
    }
    // 최신 날짜순 정렬
    return list.sort((a, b) => b.slipDate.localeCompare(a.slipDate));
  }, [slips, historyCustomer, selectedSiteFilter]);

  // Ledger Summary Widgets Data (당월 기준)
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const { summaryTotalSales, summaryTotalCollections } = useMemo(() => {
    let sales = 0;
    let collections = 0;
    customerSlips.forEach(s => {
      if (s.slipDate.startsWith(currentMonthPrefix)) {
        if (s.slipType === 'sales') sales += s.totalAmount;
        collections += s.paidAmount || 0;
      }
    });
    return { summaryTotalSales: sales, summaryTotalCollections: collections };
  }, [customerSlips, currentMonthPrefix]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setModalTab('basic');
    setForm({
      code: `C${(customers.length + 101).toString().padStart(5, '0')}`,
      name: '',
      bizNumber: '',
      ceo: '',
      tel: '',
      fax: '',
      mobile: '',
      address: '',
      bizType: '',
      bizItem: '',
      receivables: 0,
      closingDay: 25,
      priceTier: 1,
      email: '',
      taxEmail: '',
      memo: '',
      sites: []
    });
    setNewSite({ siteCode: '', siteName: '', manager: '', tel: '', address: '', memo: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Customer, tab: 'basic' | 'sites' = 'basic') => {
    setEditingId(c.id);
    setModalTab(tab);
    setForm({ ...c, sites: c.sites ? [...c.sites] : [] });
    setNewSite({
      siteCode: `${c.code}-${(c.sites?.length || 0) + 1}`,
      siteName: '',
      manager: '',
      tel: '',
      address: '',
      memo: ''
    });
    setIsModalOpen(true);
  };

  const handleAddSiteToCustomer = () => {
    if (!newSite.siteName?.trim()) {
      alert('공사현장명을 입력해주세요.');
      return;
    }
    const siteToAdd: CustomerSite = {
      id: `site-${Date.now()}`,
      siteCode: newSite.siteCode || `S-${Date.now().toString().slice(-4)}`,
      siteName: newSite.siteName.trim(),
      manager: newSite.manager?.trim() || '',
      tel: newSite.tel?.trim() || '',
      address: newSite.address?.trim() || '',
      memo: newSite.memo?.trim() || ''
    };
    const updatedSites = [...(form.sites || []), siteToAdd];
    setForm({ ...form, sites: updatedSites });
    setNewSite({
      siteCode: `${form.code || 'C'}-${updatedSites.length + 1}`,
      siteName: '',
      manager: '',
      tel: '',
      address: '',
      memo: ''
    });
  };

  const handleRemoveSiteFromCustomer = (siteId: string) => {
    if (!confirm('이 현장을 거래처 목록에서 제거하시겠습니까?')) return;
    const updatedSites = (form.sites || []).filter(s => s.id !== siteId && s.siteCode !== siteId);
    setForm({ ...form, sites: updatedSites });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      alert('거래처 상호를 입력해주세요.');
      return;
    }

    if (editingId) {
      await onUpdateCustomer(editingId, form);
    } else {
      await onAddCustomer(form);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (c: Customer) => {
    if (confirm(`거래처 [${c.name}]을(를) 삭제하시겠습니까?\n등록된 전표가 있는 경우 주의가 필요합니다.`)) {
      await onDeleteCustomer(c.id);
    }
  };

  const formatKRW = (num: number) => num.toLocaleString('ko-KR') + '원';

  return (
    <div className="space-y-4">
      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-blue-600 text-[11px] font-bold mb-1 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> 총 거래처</div>
              <div className="text-2xl font-black text-blue-900 font-mono">{kpiData.totalCustomers}</div>
              <div className="text-[10px] text-blue-500 mt-0.5">등록된 거래처 수</div>
            </div>
            <Building className="w-9 h-9 text-blue-300" />
          </div>
        </div>
        <div className="p-4 bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-rose-600 text-[11px] font-bold mb-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> 총 외상 미수금</div>
              <div className="text-xl font-black text-rose-700 font-mono">{formatKRW(kpiData.totalReceivables)}</div>
              <div className="text-[10px] text-rose-500 mt-0.5">전 거래처 합계</div>
            </div>
            <DollarSign className="w-9 h-9 text-rose-300" />
          </div>
        </div>
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-emerald-600 text-[11px] font-bold mb-1 flex items-center gap-1"><HardHat className="w-3.5 h-3.5" /> 총 공사현장</div>
              <div className="text-2xl font-black text-emerald-700 font-mono">{kpiData.totalSites}<span className="text-sm font-semibold text-emerald-500 ml-1">곳</span></div>
              <div className="text-[10px] text-emerald-500 mt-0.5">전 거래처 산하 현장</div>
            </div>
            <HardHat className="w-9 h-9 text-emerald-300" />
          </div>
        </div>
        <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-amber-600 text-[11px] font-bold mb-1 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> 마감 임박</div>
              <div className="text-2xl font-black text-amber-700 font-mono">{kpiData.closingThisMonth}<span className="text-sm font-semibold text-amber-500 ml-1">개사</span></div>
              <div className="text-[10px] text-amber-500 mt-0.5">마감일 ±5일 이내</div>
            </div>
            <Calendar className="w-9 h-9 text-amber-300" />
          </div>
        </div>
      </div>

      {/* Top action bar */}
      <div className={`p-4 rounded-xl border shadow-sm ${
        osTheme === 'winxp-retro'
          ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>거래처 마스터 관리</span>
              <span className="text-xs font-mono text-slate-400">({filteredCustomers.length}개사 표시)</span>
            </h2>
            <p className="text-xs text-slate-500">
              매출처, 매입처 사업자정보, 외상미수금 잔액 및 결제일 관리
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="상호/대표자/사업자번호/현장명 검색..."
                value={searchTerm}
                onChange={e => handleSearchChange(e.target.value)}
                className="pl-8 pr-8 py-1.5 border border-slate-300 rounded-lg bg-white w-64 text-xs focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              {searchTerm && (
                <button type="button" onClick={() => handleSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X className="w-3.5 h-3.5" /></button>
              )}
            </div>

            <button
              onClick={handleOpenAdd}
              className="px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> 거래처 등록
            </button>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className={`rounded-xl border shadow-sm overflow-hidden ${
        osTheme === 'winxp-retro'
          ? 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto" role="region" aria-label="거래처 마스터 그리드">
          <table className="w-full text-left text-xs border-collapse font-sans" role="grid">
            <thead role="rowgroup">
              <tr className="bg-slate-50/90 backdrop-blur-sm text-slate-500 font-semibold border-b border-slate-200 select-none whitespace-nowrap sticky top-0 z-10">
                <th className="py-3 px-3 min-w-[80px]">코드</th>
                <th className="py-3 px-3 min-w-[160px]">거래처 상호명</th>
                <th className="py-3 px-3 min-w-[130px]">사업자등록번호</th>
                <th className="py-3 px-3 min-w-[80px]">대표자</th>
                <th className="py-3 px-3 min-w-[130px]">전화번호 / 모바일</th>
                <th className="py-3 px-3 min-w-[180px]">사업장 주소</th>
                <th className="py-3 px-3 min-w-[120px] text-right">외상 미수잔액</th>
                <th className="py-3 px-3 min-w-[90px] text-center">마감일</th>
                <th className="py-3 px-3 min-w-[80px] text-center">원장조회</th>
                <th className="py-3 px-3 min-w-[70px] text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white" role="rowgroup">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    일치하는 거래처 정보가 없습니다.
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map(c => (
                  <tr key={c.id} role="row" className={`hover:bg-blue-50/40 transition-colors whitespace-nowrap ${(c.receivables || 0) >= 5000000 ? 'border-l-[3px] border-l-rose-400' : ''}`}>
                    <td className="py-2 px-3 font-mono font-bold text-slate-700">{c.code}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Building className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{c.name}</span>
                        {c.sites && c.sites.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c, 'sites')}
                            className="ml-1 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors shadow-2xs"
                            title="공사현장 목록 관리"
                          >
                            <HardHat className="w-2.5 h-2.5 text-blue-600" />
                            <span>현장 {c.sites.length}곳</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c, 'sites')}
                            className="ml-1 text-[10px] text-slate-400 hover:text-blue-600 hover:underline"
                            title="공사현장 등록"
                          >
                            +현장추가
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-600">{c.bizNumber}</td>
                    <td className="py-2 px-3 text-slate-800">{c.ceo}</td>
                    <td className="py-2 px-3 text-slate-600 font-mono">
                      <div>{c.tel}</div>
                      {c.mobile && <div className="text-[11px] text-slate-400">{c.mobile}</div>}
                    </td>
                    <td className="py-2 px-3 text-slate-600 truncate max-w-[200px]" title={c.address}>
                      {c.address}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">
                      {formatKRW(c.receivables || 0)}
                    </td>
                    <td className="py-2 px-3 text-center text-slate-500 font-mono">
                      {c.closingDay ? `매월 ${c.closingDay}일` : '-'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => setHistoryCustomer(c)}
                        className="px-2 py-1 text-[11px] font-semibold rounded bg-slate-100 hover:bg-blue-50 text-blue-700 border border-slate-200 inline-flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" /> 거래원장
                      </button>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="거래처 수정"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="거래처 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
            <div>
              전체 <strong className="text-slate-800">{filteredCustomers.length}</strong>개사 중{' '}
              <strong className="text-blue-700">
                {(currentPage - 1) * pageSize + 1}-
                {Math.min(currentPage * pageSize, filteredCustomers.length)}
              </strong>
              번째 표시 (페이지당 50개사)
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="px-2 py-1 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                &laquo;
              </button>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-2.5 py-1 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                이전
              </button>
              <span className="px-3 py-1 bg-blue-50 border border-blue-300 rounded font-bold text-blue-700 font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-2.5 py-1 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                다음
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2 py-1 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                &raquo;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction History Modal */}
      {historyCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-5xl w-full p-4 max-h-[85vh] flex flex-col text-xs">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-800">
                    [{historyCustomer.name}] 전표 거래 원장
                  </h3>
                  {historyCustomer.sites && historyCustomer.sites.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                      등록 현장 {historyCustomer.sites.length}곳
                    </span>
                  )}
                </div>
                <p className="text-slate-500 mt-0.5">
                  대표: {historyCustomer.ceo} &middot; 연락처: {historyCustomer.tel} &middot; 총 미수잔액: <strong className="text-rose-600">{formatKRW(historyCustomer.receivables)}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Site Filter Dropdown */}
                {historyCustomer.sites && historyCustomer.sites.length > 0 && (
                  <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                    <HardHat className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-slate-500 font-medium text-[11px]">현장선택:</span>
                    <select
                      value={selectedSiteFilter}
                      onChange={e => setSelectedSiteFilter(e.target.value)}
                      className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-medium text-slate-700"
                    >
                      <option value="all">전체 공사현장 ({customerSlips.length}건)</option>
                      {historyCustomer.sites.map(st => (
                        <option key={st.id || st.siteCode} value={st.siteName}>
                          {st.siteName} {st.manager ? `(${st.manager})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={() => {
                    setHistoryCustomer(null);
                    setSelectedSiteFilter('all');
                  }}
                  className="p-1 hover:bg-slate-100 rounded text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-4">
              {/* Summary Widgets (KPI Cards) */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                  <div className="text-rose-600 text-[11px] font-bold mb-1">총 미수 잔액</div>
                  <div className="text-xl font-black text-rose-700 font-mono">
                    {formatKRW(historyCustomer.receivables)}
                  </div>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-blue-600 text-[11px] font-bold mb-1">당월 매출액</div>
                  <div className="text-xl font-black text-blue-700 font-mono">
                    {formatKRW(summaryTotalSales)}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="text-emerald-600 text-[11px] font-bold mb-1">당월 수금액</div>
                  <div className="text-xl font-black text-emerald-700 font-mono">
                    {formatKRW(summaryTotalCollections)}
                  </div>
                </div>
              </div>

              {customerSlips.length === 0 ? (
                <div className="py-12 text-center text-slate-400 border border-slate-200 rounded-lg bg-slate-50">
                  선택한 조건에 일치하는 전표 내역이 없습니다.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                        <th className="py-2.5 px-3">전표일자</th>
                        <th className="py-2.5 px-3">구분 / 번호</th>
                        <th className="py-2.5 px-3">현장 / 요약</th>
                        <th className="py-2.5 px-3 text-right">전표금액</th>
                        <th className="py-2.5 px-3 text-right">미수잔액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customerSlips.map(s => (
                        <React.Fragment key={s.id}>
                          <tr 
                            className="hover:bg-slate-50 cursor-pointer transition-colors"
                            onClick={() => setExpandedSlipId(expandedSlipId === s.id ? null : s.id)}
                          >
                            <td className="py-2.5 px-3 font-mono text-slate-600 font-medium">
                              {s.slipDate}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  s.slipType === 'sales' ? 'bg-rose-100 text-rose-700' : 
                                  s.slipType === 'purchase' ? 'bg-emerald-100 text-emerald-700' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {s.slipType === 'sales' ? '매출' : s.slipType === 'purchase' ? '매입' : '반품'}
                                </span>
                                <span className="font-mono text-slate-500 text-[10px]">{s.slipNo.split('-').pop()}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-col gap-0.5">
                                {s.siteName && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 w-fit">
                                    <HardHat className="w-3 h-3 text-blue-600" />
                                    <span>{s.siteName}</span>
                                  </span>
                                )}
                                <span className="text-slate-600 text-[11px] font-medium truncate max-w-[180px]">
                                  {s.items[0]?.productName} {s.items.length > 1 ? `외 ${s.items.length - 1}건` : ''}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                              {s.totalAmount.toLocaleString('ko-KR')}원
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                              {s.unpaidAmount.toLocaleString('ko-KR')}원
                            </td>
                          </tr>
                          
                          {/* Expandable Row for Details (Progressive Disclosure) */}
                          {expandedSlipId === s.id && (
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <td colSpan={5} className="p-4">
                                <div className="bg-white border border-slate-200 rounded-md shadow-sm p-3">
                                  <div className="font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1 flex justify-between">
                                    <span>전표 상세 품목 내역</span>
                                    {s.memo && <span className="font-normal text-slate-500 text-[11px]">메모: {s.memo}</span>}
                                  </div>
                                  <table className="w-full text-left text-[11px]">
                                    <thead>
                                      <tr className="text-slate-500 border-b border-slate-100">
                                        <th className="py-1">품명 / 규격</th>
                                        <th className="py-1 text-center">단위</th>
                                        <th className="py-1 text-right">수량</th>
                                        <th className="py-1 text-right">단가</th>
                                        <th className="py-1 text-right">합계금액</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {s.items.map(i => (
                                        <tr key={i.id}>
                                          <td className="py-1.5 font-medium text-slate-700">
                                            {i.productName} <span className="text-slate-400 font-normal ml-1">[{i.spec}]</span>
                                          </td>
                                          <td className="py-1.5 text-center text-slate-500">{i.unit}</td>
                                          <td className="py-1.5 text-right font-mono font-bold">{i.qty}</td>
                                          <td className="py-1.5 text-right font-mono text-slate-600">{i.unitPrice.toLocaleString('ko-KR')}</td>
                                          <td className="py-1.5 text-right font-mono text-blue-700 font-bold">{i.totalAmount.toLocaleString('ko-KR')}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setHistoryCustomer(null)}
                className="px-4 py-1.5 rounded bg-slate-800 text-white font-semibold"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl rounded-lg border shadow-xl overflow-hidden flex flex-col max-h-[90vh] ${
            osTheme === 'winxp-retro'
              ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
              : 'bg-white border-slate-200'
          }`}>
            <div className={`px-4 py-2.5 flex items-center justify-between text-xs font-bold ${
              osTheme === 'winxp-retro'
                ? 'bg-gradient-to-r from-blue-700 to-blue-500 text-white'
                : 'bg-slate-100 text-slate-800 border-b'
            }`}>
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-600" />
                <span>{editingId ? `[${form.name || '거래처'}] 정보 및 공사현장 관리` : '신규 거래처 등록'}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:opacity-75"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-4 text-xs">
              <button
                type="button"
                onClick={() => setModalTab('basic')}
                className={`py-2 px-3 font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  modalTab === 'basic'
                    ? 'border-blue-600 text-blue-700 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>기본 사업자 정보</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('sites')}
                className={`py-2 px-3 font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  modalTab === 'sites'
                    ? 'border-blue-600 text-blue-700 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <HardHat className="w-3.5 h-3.5" />
                <span>등록 공사현장 관리</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-bold">
                  {form.sites?.length || 0}곳
                </span>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-3 text-xs overflow-y-auto flex-1">
              {modalTab === 'basic' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">거래처 코드</label>
                      <input
                        type="text"
                        value={form.code || ''}
                        onChange={e => setForm({ ...form, code: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">거래처 상호명</label>
                      <input
                        type="text"
                        placeholder="예: (주)한국플랜트"
                        value={form.name || ''}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-bold text-slate-900"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">사업자등록번호</label>
                      <input
                        type="text"
                        placeholder="000-00-00000"
                        value={form.bizNumber || ''}
                        onChange={e => setForm({ ...form, bizNumber: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">종사업자번호</label>
                      <input
                        type="text"
                        placeholder="예: 0001"
                        value={form.subBizNumber || ''}
                        onChange={e => setForm({ ...form, subBizNumber: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">대표자명</label>
                      <input
                        type="text"
                        value={form.ceo || ''}
                        onChange={e => setForm({ ...form, ceo: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">전화번호 (유선)</label>
                      <input
                        type="text"
                        value={form.tel || ''}
                        onChange={e => setForm({ ...form, tel: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">휴대폰번호</label>
                      <input
                        type="text"
                        value={form.mobile || ''}
                        onChange={e => setForm({ ...form, mobile: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">본사 사업장 주소</label>
                    <input
                      type="text"
                      placeholder="예: 서울특별시 구로구 디지털로33길 11"
                      value={form.address || ''}
                      onChange={e => setForm({ ...form, address: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">업태</label>
                      <input
                        type="text"
                        value={form.bizType || ''}
                        onChange={e => setForm({ ...form, bizType: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">종목</label>
                      <input
                        type="text"
                        value={form.bizItem || ''}
                        onChange={e => setForm({ ...form, bizItem: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">초기 외상미수금</label>
                      <input
                        type="number"
                        value={form.receivables || 0}
                        onChange={e => setForm({ ...form, receivables: Number(e.target.value) || 0 })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-right font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">정기 결제 마감일</label>
                      <input
                        type="number"
                        placeholder="25 또는 30"
                        value={form.closingDay || 25}
                        onChange={e => setForm({ ...form, closingDay: Number(e.target.value) || 25 })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">단가 적용 등급 (Tier)</label>
                      <select
                        value={form.priceTier || 1}
                        onChange={e => setForm({ ...form, priceTier: Number(e.target.value) as 1|2|3 })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
                      >
                        <option value={1}>1등급 (기본 단가)</option>
                        <option value={2}>2등급 (도매 단가)</option>
                        <option value={3}>3등급 (특판 단가)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">세금계산서 전용 이메일</label>
                      <input
                        type="email"
                        placeholder="tax@example.com"
                        value={form.taxEmail || ''}
                        onChange={e => setForm({ ...form, taxEmail: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">거래처 비고 / 특이사항</label>
                    <textarea
                      rows={2}
                      value={form.memo || ''}
                      onChange={e => setForm({ ...form, memo: e.target.value })}
                      placeholder="특약 사항, 단가 협의 내역 등..."
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white resize-none"
                    />
                  </div>
                </>
              ) : (
                /* Sites Tab (1:N 공사현장 관리) */
                <div className="space-y-4">
                  {/* New Site Input Card */}
                  <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-900 flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> 신규 공사현장 등록
                      </span>
                      <span className="text-[11px] text-blue-700">전표 작성 시 바로 선택 가능</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div>
                        <label className="block font-semibold text-slate-700 text-[11px] mb-0.5">현장 코드</label>
                        <input
                          type="text"
                          placeholder="코드 (자동부여)"
                          value={newSite.siteCode || ''}
                          onChange={e => setNewSite({ ...newSite, siteCode: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-xs font-mono"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block font-semibold text-slate-700 text-[11px] mb-0.5">
                          공사현장명 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="예: 김포데이터센터 신축, 마곡지구 R&D센터"
                          value={newSite.siteName || ''}
                          onChange={e => setNewSite({ ...newSite, siteName: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className="block font-semibold text-slate-700 text-[11px] mb-0.5">현장 소장 / 담당자</label>
                        <input
                          type="text"
                          placeholder="예: 김소장, 박차장"
                          value={newSite.manager || ''}
                          onChange={e => setNewSite({ ...newSite, manager: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 text-[11px] mb-0.5">현장 직통 / 휴대폰</label>
                        <input
                          type="text"
                          placeholder="010-0000-0000"
                          value={newSite.tel || ''}
                          onChange={e => setNewSite({ ...newSite, tel: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 text-[11px] mb-0.5">현장 납품지 주소</label>
                      <input
                        type="text"
                        placeholder="화물/직송 기사에게 안내될 실제 납품 주소"
                        value={newSite.address || ''}
                        onChange={e => setNewSite({ ...newSite, address: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-xs"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddSiteToCustomer}
                        className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>현장 목록에 추가</span>
                      </button>
                    </div>
                  </div>

                  {/* Registered Sites List */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <HardHat className="w-3.5 h-3.5 text-blue-600" />
                        등록된 공사현장 ({form.sites?.length || 0}개소)
                      </span>
                      <span className="text-[11px] text-slate-500">전표 입력창에서 즉시 불러올 수 있습니다.</span>
                    </div>

                    {(!form.sites || form.sites.length === 0) ? (
                      <div className="py-8 text-center text-slate-400 bg-slate-50 rounded border border-dashed border-slate-200">
                        등록된 공사현장이 없습니다. 위에서 신규 현장을 등록해주세요.
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100 bg-white">
                        {form.sites.map((st, idx) => (
                          <div key={st.id || idx} className="p-2.5 hover:bg-slate-50 flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-1 rounded">
                                  {st.siteCode || `S-${idx + 1}`}
                                </span>
                                <strong className="text-slate-900 text-xs">{st.siteName}</strong>
                                {st.manager && (
                                  <span className="text-blue-700 font-medium text-[11px]">
                                    (소장: {st.manager})
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-3">
                                {st.tel && <span>TEL: {st.tel}</span>}
                                {st.address && <span className="truncate max-w-[280px]">주소: {st.address}</span>}
                              </div>
                              {st.memo && <div className="text-[10px] text-slate-400">비고: {st.memo}</div>}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveSiteFromCustomer(st.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="현장 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs"
                >
                  {editingId ? '거래처 및 현장 정보 저장' : '신규 거래처 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
