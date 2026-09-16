'use client';

import React, { useState, useMemo, useDeferredValue } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Package,
  Check,
  X,
  TrendingUp,
  BarChart3,
  Box
} from 'lucide-react';
import type { Product, OSTheme } from '@/types';

interface ProductMasterViewProps {
  products: Product[];
  onAddProduct: (p: Partial<Product>) => Promise<void>;
  onUpdateProduct: (id: string, p: Partial<Product>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  osTheme: OSTheme;
}

export function ProductMasterView({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  osTheme
}: ProductMasterViewProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Product>>({
    code: '', name: '', spec: '', unit: 'BOX',
    costPrice: 0, sellingPrice: 0, sellingPrice2: 0, sellingPrice3: 0,
    discountRate: 0, currentStock: 0, safeStock: 10,
    category: '볼트', category2: '', category3: '',
    barcode: '', supplier: '', memo: ''
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!deferredSearchTerm.trim()) return true;
      const q = deferredSearchTerm.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) ||
        p.spec.toLowerCase().includes(q) || (p.supplier && p.supplier.toLowerCase().includes(q))
      );
    });
  }, [products, deferredSearchTerm, selectedCategory]);

  const kpiData = useMemo(() => {
    let shortageCount = 0; let totalMarginSum = 0; let marginCount = 0;
    products.forEach(p => {
      if (p.currentStock <= p.safeStock) shortageCount++;
      if (p.sellingPrice > 0) {
        totalMarginSum += ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100;
        marginCount++;
      }
    });
    return {
      totalProducts: products.length, shortageCount,
      avgMargin: marginCount > 0 ? Math.round(totalMarginSum / marginCount) : 0
    };
  }, [products]);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;
  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage]);

  const handleSearchChange = (val: string) => { setSearchTerm(val); setCurrentPage(1); };
  const handleCategoryChange = (cat: string) => { setSelectedCategory(cat); setCurrentPage(1); };

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      code: `PRD-${(products.length + 1).toString().padStart(4, '0')}`,
      name: '', spec: '', unit: 'BOX', costPrice: 0, sellingPrice: 0,
      sellingPrice2: 0, sellingPrice3: 0, discountRate: 0, currentStock: 0, safeStock: 20,
      category: categories[0] || '볼트', category2: '', category3: '',
      barcode: '', supplier: '', memo: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => { setEditingId(p.id); setForm({ ...p }); setIsModalOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) { alert('품목명을 입력해주세요.'); return; }
    if (editingId) { await onUpdateProduct(editingId, form); } else { await onAddProduct(form); }
    setIsModalOpen(false);
  };

  const handleDelete = async (p: Product) => {
    if (confirm(`품목 [${p.name} (${p.spec})]을 삭제하시겠습니까?`)) { await onDeleteProduct(p.id); }
  };

  const formMargin = (form.sellingPrice && form.sellingPrice > 0)
    ? Math.round(((form.sellingPrice - (form.costPrice || 0)) / form.sellingPrice) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-blue-600 text-[11px] font-bold mb-1 flex items-center gap-1">
                <Package className="w-3.5 h-3.5" /> 총 등록 품목
              </div>
              <div className="text-2xl font-black text-blue-900 font-mono">
                {kpiData.totalProducts.toLocaleString('ko-KR')}
              </div>
              <div className="text-[10px] text-blue-500 mt-0.5">{categories.length}개 분류 운영</div>
            </div>
            <Box className="w-10 h-10 text-blue-300" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => { setSelectedCategory('all'); setSearchTerm(''); setCurrentPage(1); }}
          className="p-4 bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200 rounded-xl shadow-sm hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-rose-600 text-[11px] font-bold mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> 재고 부족 경고
              </div>
              <div className="text-2xl font-black text-rose-700 font-mono">
                {kpiData.shortageCount}<span className="text-sm font-semibold text-rose-500 ml-1">건</span>
              </div>
              <div className="text-[10px] text-rose-500 mt-0.5">안전재고 이하 품목</div>
            </div>
            <AlertTriangle className="w-10 h-10 text-rose-300" />
          </div>
        </button>

        <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-emerald-600 text-[11px] font-bold mb-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> 평균 마진율
              </div>
              <div className="text-2xl font-black text-emerald-700 font-mono">{kpiData.avgMargin}%</div>
              <div className="text-[10px] text-emerald-500 mt-0.5">(판매가 - 원가) / 판매가</div>
            </div>
            <BarChart3 className="w-10 h-10 text-emerald-300" />
          </div>
        </div>
      </div>

      {/* Top action bar */}
      <div className={`p-4 rounded-xl border shadow-sm ${
        osTheme === 'winxp-retro' ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              <span>품목 마스터 관리</span>
              <span className="text-xs font-mono text-slate-400">({filteredProducts.length.toLocaleString('ko-KR')}건 표시)</span>
            </h2>
            <p className="text-xs text-slate-500">동산화스너 취급 볼트, 너트, 와셔, 앙카, 찬넬 규격 및 원가/출고단가 관리</p>
          </div>
          <button onClick={handleOpenAdd} className="px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm transition-colors">
            <Plus className="w-4 h-4" /> 신규 품목 등록
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-600">분류:</span>
            <button onClick={() => handleCategoryChange('all')} className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${selectedCategory === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              전체 ({products.length.toLocaleString('ko-KR')})
            </button>
            {categories.map(c => {
              const count = products.filter(p => p.category === c).length;
              return (
                <button key={c} onClick={() => handleCategoryChange(c)} className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${selectedCategory === c ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {c} ({count.toLocaleString('ko-KR')})
                </button>
              );
            })}
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="품명/코드/규격/매입처 검색..." value={searchTerm} onChange={e => handleSearchChange(e.target.value)} className="pl-8 pr-8 py-1.5 border border-slate-300 rounded-lg bg-white w-64 text-xs focus:ring-1 focus:ring-blue-500 transition-colors" />
            {searchTerm && (
              <button type="button" onClick={() => handleSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className={`rounded-xl border shadow-sm overflow-hidden ${
        osTheme === 'winxp-retro' ? 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]' : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto" role="region" aria-label="품목 마스터 그리드">
          <table className="w-full text-left text-xs border-collapse font-sans" role="grid">
            <thead role="rowgroup">
              <tr className="bg-slate-50/90 backdrop-blur-sm text-slate-500 font-semibold border-b border-slate-200 select-none whitespace-nowrap sticky top-0 z-10">
                <th className="py-3 px-3 min-w-[90px]">품목코드</th>
                <th className="py-3 px-3 min-w-[100px]">분류</th>
                <th className="py-3 px-3 min-w-[160px]">품명 (상품명)</th>
                <th className="py-3 px-3 min-w-[120px]">규격 (Spec)</th>
                <th className="py-3 px-3 min-w-[60px] text-center">단위</th>
                <th className="py-3 px-3 min-w-[90px] text-right">매입단가</th>
                <th className="py-3 px-3 min-w-[130px] text-right">출고단가(1/2/3)</th>
                <th className="py-3 px-3 min-w-[90px] text-right">마진/할인</th>
                <th className="py-3 px-3 min-w-[80px] text-right">현재고</th>
                <th className="py-3 px-3 min-w-[80px] text-center">상태</th>
                <th className="py-3 px-3 min-w-[70px] text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white" role="rowgroup">
              {paginatedProducts.length === 0 ? (
                <tr><td colSpan={11} className="py-12 text-center text-slate-400"><Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />일치하는 품목이 없습니다.</td></tr>
              ) : (
                paginatedProducts.map(p => {
                  const margin = p.sellingPrice > 0 ? Math.round(((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100) : 0;
                  const isShortage = p.currentStock <= p.safeStock;
                  return (
                    <tr key={p.id} role="row" className={`hover:bg-blue-50/40 transition-colors whitespace-nowrap ${isShortage ? 'border-l-[3px] border-l-rose-400' : ''}`}>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{p.code}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 w-max font-medium">{p.category}</span>
                          {p.category2 && <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-50 text-slate-500 w-max">{p.category2} {p.category3 ? `> ${p.category3}` : ''}</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{p.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{p.spec}</td>
                      <td className="py-2.5 px-3 text-center text-slate-500">{p.unit}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">{p.costPrice.toLocaleString('ko-KR')}</td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <div className="font-bold text-slate-900">{p.sellingPrice.toLocaleString('ko-KR')}</div>
                        {(p.sellingPrice2 || p.sellingPrice3) && (
                          <div className="text-[10px] text-slate-500">{p.sellingPrice2 ? p.sellingPrice2.toLocaleString('ko-KR') : '-'} / {p.sellingPrice3 ? p.sellingPrice3.toLocaleString('ko-KR') : '-'}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold">
                        <div className="text-emerald-600">{margin}%</div>
                        {p.discountRate ? <div className="text-[10px] text-blue-600">-{p.discountRate}%</div> : null}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono font-bold ${isShortage ? 'text-rose-600' : 'text-slate-800'}`}>{p.currentStock.toLocaleString('ko-KR')}</td>
                      <td className="py-2.5 px-3 text-center">
                        {isShortage ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700"><AlertTriangle className="w-2.5 h-2.5" /> 부족</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"><Check className="w-2.5 h-2.5" /> 정상</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleOpenEdit(p)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="품목 수정"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(p)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="품목 삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-slate-500">
            총 <strong className="font-mono text-slate-800">{filteredProducts.length.toLocaleString('ko-KR')}</strong>개 중{' '}
            <strong className="font-mono text-blue-700">{Math.min(filteredProducts.length, (currentPage - 1) * pageSize + 1)} - {Math.min(filteredProducts.length, currentPage * pageSize)}</strong>번째 표시
          </div>
          <div className="flex items-center gap-1">
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage(1)} className="px-2 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-xs font-mono transition-colors">&lt;&lt;</button>
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="px-2 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-xs font-mono transition-colors">&lt; 이전</button>
            <span className="px-3 py-1 font-mono font-bold text-blue-700 bg-blue-50 rounded-lg border border-blue-200">{currentPage} / {totalPages}</span>
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} className="px-2 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-xs font-mono transition-colors">다음 &gt;</button>
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)} className="px-2 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-xs font-mono transition-colors">&gt;&gt;</button>
          </div>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-xl border shadow-2xl overflow-hidden ${
            osTheme === 'winxp-retro' ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]' : 'bg-white border-slate-200'
          }`}>
            <div className={`px-4 py-3 flex items-center justify-between text-xs font-bold ${
              osTheme === 'winxp-retro' ? 'bg-gradient-to-r from-blue-700 to-blue-500 text-white' : 'bg-gradient-to-r from-slate-800 to-slate-700 text-white'
            }`}>
              <span className="flex items-center gap-2"><Package className="w-4 h-4" />{editingId ? '품목 정보 수정' : '신규 품목 등록'}</span>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/20 rounded transition-colors"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
              {/* 기본 정보 */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px] border-b border-slate-200 pb-1.5">
                  <Package className="w-3.5 h-3.5 text-blue-600" /> 기본 정보
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">품목코드</label>
                    <input type="text" value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono focus:ring-1 focus:ring-blue-500" required />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">분류 (대분류)</label>
                    <input type="text" placeholder="볼트, 너트, 와셔 등" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">분류 (중분류)</label>
                    <input type="text" placeholder="육각, 둥근 등" value={form.category2 || ''} onChange={e => setForm({ ...form, category2: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">분류 (소분류)</label>
                    <input type="text" placeholder="세부 재질 등" value={form.category3 || ''} onChange={e => setForm({ ...form, category3: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">품명 (상품명)</label>
                  <input type="text" placeholder="예: 육각볼트 (Hex Bolt)" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">규격 (Spec)</label>
                    <input type="text" placeholder="예: M10 x 35" value={form.spec || ''} onChange={e => setForm({ ...form, spec: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">단위</label>
                    <input type="text" placeholder="BOX(500), EA, SET 등" value={form.unit || ''} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              {/* 가격 정보 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-slate-800 font-bold text-[11px] border-b border-slate-200 pb-1.5">
                  <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> 가격 정보</span>
                  {formMargin > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${formMargin >= 30 ? 'bg-emerald-100 text-emerald-700' : formMargin >= 15 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                      예상 마진 {formMargin}%
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">매입가 (원가)</label>
                    <input type="number" value={form.costPrice || 0} onChange={e => setForm({ ...form, costPrice: Number(e.target.value) || 0 })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">출고가 1 (기본 판매가)</label>
                    <input type="number" value={form.sellingPrice || 0} onChange={e => setForm({ ...form, sellingPrice: Number(e.target.value) || 0 })} className="w-full px-2.5 py-1.5 border border-blue-300 rounded-lg bg-blue-50/50 text-right font-mono font-bold text-blue-700 focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">출고가 2 (도매)</label>
                    <input type="number" value={form.sellingPrice2 || 0} onChange={e => setForm({ ...form, sellingPrice2: Number(e.target.value) || 0 })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">출고가 3 (특판)</label>
                    <input type="number" value={form.sellingPrice3 || 0} onChange={e => setForm({ ...form, sellingPrice3: Number(e.target.value) || 0 })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">할인율 (%)</label>
                    <input type="number" value={form.discountRate || 0} onChange={e => setForm({ ...form, discountRate: Number(e.target.value) || 0 })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              {/* 재고 정보 */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px] border-b border-slate-200 pb-1.5">
                  <Box className="w-3.5 h-3.5 text-amber-600" /> 재고 및 공급처
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">현재 재고수량</label>
                    <input type="number" value={form.currentStock || 0} onChange={e => setForm({ ...form, currentStock: Number(e.target.value) || 0 })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">안전/적정 재고</label>
                    <input type="number" value={form.safeStock || 0} onChange={e => setForm({ ...form, safeStock: Number(e.target.value) || 0 })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">매입처 / 공급공장</label>
                  <input type="text" placeholder="성화내진전착볼트(주) 등" value={form.supplier || ''} onChange={e => setForm({ ...form, supplier: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors">취소</button>
                <button type="submit" className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm transition-colors">{editingId ? '수정 완료' : '품목 등록'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
