'use client';

import React, { useState, useMemo, useDeferredValue, useEffect, useRef } from 'react';
import {
  Plus,
  Copy,
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
  // 목록에서 매입단가·협정가·판매단가를 바로 고치고 F8로 저장(원본 «목록자료» 화면 — 상품코드 관리 매뉴얼 8항).
  const [inlineEdit, setInlineEdit] = useState<boolean>(false);
  const [edits, setEdits] = useState<Record<string, Partial<Product>>>({});
  const [savingEdits, setSavingEdits] = useState<boolean>(false);
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
    // 원본: 품명-규격 사전순으로 자동 정렬해 보여준다(상품코드 관리 매뉴얼). 다른명칭·바코드로도 찾는다.
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!deferredSearchTerm.trim()) return true;
      const q = deferredSearchTerm.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) ||
        p.spec.toLowerCase().includes(q) || (p.supplier && p.supplier.toLowerCase().includes(q)) ||
        (p.nickName && p.nickName.toLowerCase().includes(q)) || (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko') || (a.spec || '').localeCompare(b.spec || '', 'ko', { numeric: true }));
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
    try {
      if (editingId) { await onUpdateProduct(editingId, form); } else { await onAddProduct(form); }
    } catch (err: any) { alert(err.message || '저장 중 오류가 발생했습니다.'); return; }
    setIsModalOpen(false);
  };

  // 품목 복사(F5): 품명은 같고 규격만 다를 때. 복사본은 새 품목으로 저장된다.
  const handleOpenCopy = (p: Product) => {
    setEditingId(null);
    setForm({ ...p, id: undefined, code: `PRD-${(products.length + 1).toString().padStart(4, '0')}`, currentStock: 0 });
    setIsModalOpen(true);
  };

  // 집단 수정(F12): 같은 품명 전체를 다른 품명으로 한꺼번에 바꾼다.
  const handleGroupRename = async (p: Product) => {
    const next = window.prompt(`«${p.name}» 품명을 가진 모든 품목의 품명을 바꿉니다.\n새 품명을 입력하세요.`, p.name);
    if (!next || next.trim() === p.name) return;
    const group = products.filter(x => x.name === p.name);
    if (!window.confirm(`${group.length}개 품목의 품명을 «${next.trim()}»(으)로 바꿉니다. 진행할까요?`)) return;
    for (const x of group) await onUpdateProduct(x.id, { name: next.trim() });
  };

  // 집단 복사(F11): 규격은 같고 품명만 다른 품목 묶음 등록 — 같은 품명 전체를 새 품명으로 복사한다.
  const handleGroupCopy = async (p: Product) => {
    const next = window.prompt(`«${p.name}» 품명의 모든 규격을 새 품명으로 복사합니다.\n새 품명을 입력하세요.`, '');
    if (!next || !next.trim() || next.trim() === p.name) return;
    const group = products.filter(x => x.name === p.name);
    if (!window.confirm(`${group.length}개 품목을 «${next.trim()}»(으)로 복사합니다. 진행할까요?`)) return;
    let n = products.length;
    for (const x of group) {
      n += 1;
      const { id: _id, ...rest } = x;
      await onAddProduct({ ...rest, name: next.trim(), code: `PRD-${String(n).padStart(4, '0')}`, currentStock: 0 });
    }
  };

  const saveEdits = async () => {
    const ids = Object.keys(edits);
    if (ids.length === 0) { setInlineEdit(false); return; }
    setSavingEdits(true);
    try {
      for (const id of ids) await onUpdateProduct(id, edits[id]);
      setEdits({}); setInlineEdit(false);
    } catch (e: any) { alert(e.message || '저장 중 오류가 발생했습니다.'); }
    finally { setSavingEdits(false); }
  };
  const cancelEdits = () => { setEdits({}); setInlineEdit(false); };

  // 엑셀 가져오기(단가 수정): 파일의 단가를 «목록 직접 수정» 칸(edits)에 채워 넣기만 한다. 저장(F8)을 눌러야 DB에 반영되고, 취소(Esc)하면 아무것도 바뀌지 않는다.
  // 품목 찾기: 품목코드가 있으면 코드로, 없으면 품명+규격(공백·대소문자 무시). 같은 품명+규격이 여럿이면 «모호»로 건너뛴다. 새 품목 등록은 하지 않는다(1차).
  // 지름길: 열 이름은 아래 별칭 표로만 인식한다 — 다른 이름이면 «인식 못 한 열»로 알려 준다.
  const [importMsg, setImportMsg] = useState<string>('');
  // 엑셀에는 있는데 품목에 없는 행 — «새 품목 N건 등록» 버튼을 눌러야만 등록된다(자동 등록 안 함).
  const [importNew, setImportNew] = useState<Partial<Product>[]>([]);
  const importRef = useRef<HTMLInputElement>(null);
  const registerImported = async () => {
    if (importNew.length === 0) return;
    const sample = importNew.slice(0, 5).map(p => `${p.name}${p.spec ? ' ' + p.spec : ''}`).join(', ');
    if (!window.confirm(`엑셀에만 있는 품목 ${importNew.length}건을 새 품목으로 등록합니다.\n(예: ${sample}${importNew.length > 5 ? ' …' : ''})\n재고는 0, 분류는 비워 둡니다. 진행할까요?`)) return;
    let n = Math.max(0, ...products.map(p => Number(/^PRD-(\d+)$/.exec(p.code || '')?.[1]) || 0)); let ok = 0;
    try {
      for (const p of importNew) { n += 1; await onAddProduct({ ...p, code: p.code || `PRD-${String(n).padStart(4, '0')}`, currentStock: 0, safeStock: 0, category: '' }); ok++; }
      setImportMsg(`새 품목 ${ok}건을 등록했습니다.`); setImportNew([]);
    } catch (e: any) { setImportMsg(`새 품목 등록 중 오류: ${e.message || e} — ${ok}건까지 등록됨. 남은 것은 같은 엑셀을 다시 가져오면 다시 나타납니다.`); setImportNew([]); }
  };
  const importExcel = async (file: File) => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true }) // raw: CSV의 «1/2» 같은 규격이 날짜로 바뀌지 않게;
      const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
      const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, '').toLowerCase();
      const ALIAS: Record<string, string[]> = { unit: ['단위'], code: ['품목코드', '상품코드', '코드'], name: ['품명', '품목명', '상품명'], spec: ['규격', '사양'], sellingPrice: ['판매단가', '출고가', '출고단가', '단가'], costPrice: ['매입단가', '매입가', '매입'], retailPrice: ['협정가', '소비자가'] };
      const hi = rows.slice(0, 10).findIndex(r => r.some(c => ALIAS.name.includes(norm(c))) || r.some(c => ALIAS.code.includes(norm(c))));
      setImportNew([]);
      if (hi < 0) { setImportMsg('헤더 줄을 찾지 못했습니다. 첫 10줄 안에 «품명»(또는 «품목코드») 열이 있어야 합니다.'); return; }
      const head = rows[hi].map(norm); const col: Record<string, number> = {};
      Object.entries(ALIAS).forEach(([k, names]) => { const i = head.findIndex(h => names.includes(h)); if (i >= 0) col[k] = i; });
      const priceCols = (['sellingPrice', 'costPrice', 'retailPrice'] as const).filter(k => col[k] != null);
      if (priceCols.length === 0) { setImportMsg('판매단가·매입단가·협정가 열을 찾지 못했습니다(인식하는 열 이름: 판매단가/출고가, 매입단가/매입가, 협정가/소비자가).'); return; }
      const byCode = new Map<string, Product[]>(), byName = new Map<string, Product[]>();
      products.forEach(p => { if (p.code) byCode.set(norm(p.code), [...(byCode.get(norm(p.code)) || []), p]); const k = `${norm(p.name)}|${norm(p.spec)}`; byName.set(k, [...(byName.get(k) || []), p]); });
      const fresh = new Map<string, Partial<Product>>();
      const filteredIds = new Set(filteredProducts.map(p => p.id));
      const next = { ...edits } as Record<string, Partial<Product>>; let hidden = 0, matched = 0, changed = 0, missing = 0, ambiguous = 0, bad = 0; const missList: string[] = [];
      for (const r of rows.slice(hi + 1)) {
        const name = col.name != null ? String(r[col.name] ?? '').trim() : '', code = col.code != null ? String(r[col.code] ?? '').trim() : '';
        if (!name && !code) continue;
        let hit = code ? byCode.get(norm(code)) : undefined;
        if (!hit && name) hit = byName.get(`${norm(name)}|${norm(col.spec != null ? r[col.spec] : '')}`);
        if (!hit || hit.length === 0) { missing++; const nm = name, sp = col.spec != null ? String(r[col.spec] ?? '').trim() : ''; if (nm && !fresh.has(`${norm(nm)}|${norm(sp)}`)) { const num = (k: 'sellingPrice' | 'costPrice' | 'retailPrice') => (col[k] != null ? Number(String(r[col[k]] ?? '').replace(/[,\s원]/g, '')) || 0 : 0); fresh.set(`${norm(nm)}|${norm(sp)}`, { name: nm, spec: sp, unit: col.unit != null ? String(r[col.unit] ?? '').trim() || 'EA' : 'EA', code: code || undefined, sellingPrice: num('sellingPrice'), costPrice: num('costPrice'), retailPrice: num('retailPrice') }); } if (missList.length < 8) missList.push(`${name || code}${col.spec != null && r[col.spec] ? ' ' + r[col.spec] : ''}`); continue; }
        if (hit.length > 1) { ambiguous++; continue; }
        matched++; const p = hit[0]; const base = { ...(next[p.id] || {}) } as Record<string, unknown>; let did = false;
        for (const k of priceCols) {
          const raw = r[col[k]]; if (raw === '' || raw == null) continue;
          const v = Number(String(raw).replace(/[,\s원]/g, ''));
          if (!Number.isFinite(v) || v < 0) { bad++; continue; }
          if ((p[k] || 0) !== v) { base[k] = v; did = true; } else if (k in base) { delete base[k]; if (Object.keys(base).length === 0) delete next[p.id]; } // 엑셀 값이 DB 값과 같으면 이전에 손으로 고친 칸도 되돌린다
        }
        if (did) { next[p.id] = base as Partial<Product>; changed++; hidden += filteredIds.has(p.id) ? 0 : 1; } else if (Object.keys(base).length) next[p.id] = base as Partial<Product>;
      }
      setEdits(next); setInlineEdit(true); setImportNew([...fresh.values()]);
      setImportMsg(`엑셀 ${matched + missing + ambiguous}행 중 일치 ${matched} · 단가 변경 ${changed} · 못 찾음 ${missing}${fresh.size ? `(새 품목으로 등록할 수 있는 것 ${fresh.size}건)` : ''}${ambiguous ? ` · 모호(같은 품명·규격 중복) ${ambiguous}` : ''}${bad ? ` · 잘못된 금액 ${bad}칸 무시` : ''}${hidden ? ` · 현재 검색·분류에 안 보이는 품목 ${hidden}건 포함(분류를 «전체»로, 검색을 비우면 보입니다)` : ''}. 아래 목록에서 바뀐 칸을 확인하고 «저장(F8)»을 눌러야 반영됩니다(취소하면 아무것도 바뀌지 않음).${missList.length ? ' 못 찾은 예: ' + missList.join(' / ') : ''}`);
    } catch (e: any) { setImportMsg(`엑셀을 읽지 못했습니다: ${e.message || e}`); }
  };
  const setEdit = (p: Product, field: 'costPrice' | 'retailPrice' | 'sellingPrice', raw: string) => {
    const v = Number(raw) || 0;
    setEdits(prev => {
      const base = { ...(prev[p.id] || {}) } as Partial<Product>;
      if ((p[field] || 0) === v) delete (base as Record<string, unknown>)[field]; else (base as Record<string, unknown>)[field] = v;
      const next = { ...prev };
      if (Object.keys(base).length === 0) delete next[p.id]; else next[p.id] = base;
      return next;
    });
  };

  // 핫키(원본): Insert 추가 · F2 조회(검색 칸으로) · F8 저장 · Esc 닫기
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isModalOpen) {
        if (e.key === 'F8') { e.preventDefault(); (document.getElementById('product-form') as HTMLFormElement | null)?.requestSubmit(); }
        else if (e.key === 'Escape') setIsModalOpen(false);
        return;
      }
      if (inlineEdit && e.key === 'F8') { e.preventDefault(); saveEdits(); return; }
      if (inlineEdit && e.key === 'Escape') { cancelEdits(); return; }
      if (e.key === 'Insert') { e.preventDefault(); handleOpenAdd(); }
      else if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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
          {inlineEdit ? (
              <>
                <button onClick={saveEdits} disabled={savingEdits} className="px-3 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-sm">{savingEdits ? '저장 중…' : `저장 (F8) · ${Object.keys(edits).length}건`}</button>
                <button onClick={cancelEdits} className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50">취소 (Esc)</button>
              </>
            ) : (
              <button onClick={() => setInlineEdit(true)} className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50" title="목록에서 매입단가·협정가·판매단가를 바로 고치고 F8로 저장">단가 일괄 수정</button>
            )}
            <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importExcel(f); e.target.value = ''; }} />
            <button onClick={() => importRef.current?.click()} className="px-3 py-2 text-xs font-semibold rounded-lg border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50" title="엑셀의 품명·규격(또는 품목코드)과 판매단가·매입단가·협정가 열을 읽어 단가 수정 칸에 채웁니다. 저장(F8)을 눌러야 반영됩니다.">📥 엑셀로 단가 수정</button>
            <button onClick={handleOpenAdd} className="px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm transition-colors">
            <Plus className="w-4 h-4" /> 신규 품목 등록
          </button>
        </div>
        {importMsg && (
          <div className="mt-2 p-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-800 flex items-start gap-2">
            <span className="flex-1">{importMsg}</span>
            {importNew.length > 0 && <button onClick={registerImported} className="px-2.5 py-1 rounded border border-emerald-400 bg-white font-bold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap">새 품목 {importNew.length}건 등록</button>}
            <button onClick={() => { setImportMsg(''); setImportNew([]); }} className="text-emerald-700 hover:text-emerald-900 font-bold" aria-label="안내 닫기">×</button>
          </div>
        )}

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
            <input ref={searchRef} type="text" placeholder="품명/다른명칭/코드/규격/매입처 검색... (F2)" value={searchTerm} onChange={e => handleSearchChange(e.target.value)} className="pl-8 pr-8 py-1.5 border border-slate-300 rounded-lg bg-white w-64 text-xs focus:ring-1 focus:ring-blue-500 transition-colors" />
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
                <th className="py-3 px-3 min-w-[100px]">다른명칭</th>
                <th className="py-3 px-3 min-w-[120px]">규격 (Spec)</th>
                <th className="py-3 px-3 min-w-[60px] text-center">단위</th>
                <th className="py-3 px-3 min-w-[90px] text-right">매입단가</th>
                <th className="py-3 px-3 min-w-[90px] text-right">협정가</th>
                <th className="py-3 px-3 min-w-[90px] text-center">최종매입일</th>
                <th className="py-3 px-3 min-w-[130px] text-right">출고단가(1/2/3)</th>
                <th className="py-3 px-3 min-w-[90px] text-right">마진/할인</th>
                <th className="py-3 px-3 min-w-[80px] text-right">현재고</th>
                <th className="py-3 px-3 min-w-[120px]">비고</th>
                <th className="py-3 px-3 min-w-[80px] text-center">상태</th>
                <th className="py-3 px-3 min-w-[70px] text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white" role="rowgroup">
              {paginatedProducts.length === 0 ? (
                <tr><td colSpan={15} className="py-12 text-center text-slate-400"><Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />일치하는 품목이 없습니다.</td></tr>
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
                      <td className="py-2.5 px-3 text-slate-600">{p.nickName}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{p.spec}</td>
                      <td className="py-2.5 px-3 text-center text-slate-500">{p.unit}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        {inlineEdit ? <input type="number" value={edits[p.id]?.costPrice ?? p.costPrice} onChange={e => setEdit(p, 'costPrice', e.target.value)} className="w-24 py-1 px-1.5 border border-amber-300 rounded text-right bg-amber-50" /> : p.costPrice.toLocaleString('ko-KR')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        {inlineEdit ? <input type="number" value={edits[p.id]?.retailPrice ?? p.retailPrice ?? 0} onChange={e => setEdit(p, 'retailPrice', e.target.value)} className="w-24 py-1 px-1.5 border border-amber-300 rounded text-right bg-amber-50" /> : (p.retailPrice ? p.retailPrice.toLocaleString('ko-KR') : '')}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500">{p.lastPurchaseDate || ''}</td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {inlineEdit
                          ? <input type="number" value={edits[p.id]?.sellingPrice ?? p.sellingPrice} onChange={e => setEdit(p, 'sellingPrice', e.target.value)} className="w-24 py-1 px-1.5 border border-amber-300 rounded text-right bg-amber-50 font-bold" />
                          : <div className="font-bold text-slate-900">{p.sellingPrice.toLocaleString('ko-KR')}</div>}
                        {(p.sellingPrice2 || p.sellingPrice3) && (
                          <div className="text-[10px] text-slate-500">{p.sellingPrice2 ? p.sellingPrice2.toLocaleString('ko-KR') : '-'} / {p.sellingPrice3 ? p.sellingPrice3.toLocaleString('ko-KR') : '-'}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold">
                        <div className="text-emerald-600">{margin}%</div>
                        {p.discountRate ? <div className="text-[10px] text-blue-600">-{p.discountRate}%</div> : null}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono font-bold ${isShortage ? 'text-rose-600' : 'text-slate-800'}`}>{p.currentStock.toLocaleString('ko-KR')}</td>
                      <td className="py-2.5 px-3 text-slate-500 max-w-[160px] truncate" title={p.memo}>{p.memo}</td>
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
                          <button onClick={() => handleOpenCopy(p)} className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="품목 복사 (F5) — 같은 품명에 다른 규격 등록"><Copy className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleGroupRename(p)} className="px-1.5 py-1 text-[10px] font-bold text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors" title="집단 수정 (F12) — 같은 품명 전체의 품명 변경">집단수정</button>
                          <button onClick={() => handleGroupCopy(p)} className="px-1.5 py-1 text-[10px] font-bold text-slate-500 hover:text-violet-700 hover:bg-violet-50 rounded-lg transition-colors" title="집단 복사 (F11) — 같은 품명 전체를 새 품명으로 복사">집단복사</button>
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

            <form id="product-form" onSubmit={handleSave} className="p-4 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
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
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">다른명칭 <span className="font-normal text-slate-400">(약어·관리코드, 검색에 쓰임)</span></label>
                  <input type="text" value={form.nickName || ''} onChange={e => setForm({ ...form, nickName: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 font-mono" />
                </div>
                <p className="text-[10px] text-slate-400 -mt-1">같은 품명을 구분할 때는 «볼트{'{'}중국제{'}'}»처럼 중괄호로 적으면 전표·출력에는 중괄호 안 글자가 빠집니다.</p>
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

              {/* 오케이세일 호환 상세 정보 */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px] border-b border-slate-200 pb-1.5">상세 정보 (메이커·매입·보관)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">메이커</label>
                    <input type="text" value={form.maker || ''} onChange={e => setForm({ ...form, maker: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">모델 No</label>
                    <input type="text" value={form.modelNo || ''} onChange={e => setForm({ ...form, modelNo: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">색상</label>
                    <input type="text" value={form.color || ''} onChange={e => setForm({ ...form, color: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">협정가 (소비자가)</label>
                    <input type="number" value={form.retailPrice ?? ''} onChange={e => setForm({ ...form, retailPrice: Number(e.target.value) || 0 })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">매입단가</label>
                    <input type="number" value={form.purchasePrice ?? ''} onChange={e => setForm({ ...form, purchasePrice: Number(e.target.value) || 0 })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">최종 매입일</label>
                    <input type="date" value={form.lastPurchaseDate || ''} onChange={e => setForm({ ...form, lastPurchaseDate: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">최종 매입가</label>
                    <input type="number" value={form.lastPurchasePrice ?? ''} onChange={e => setForm({ ...form, lastPurchasePrice: Number(e.target.value) || 0 })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">보관 위치</label>
                    <input type="text" value={form.storageLocation || ''} onChange={e => setForm({ ...form, storageLocation: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">과세 여부</label>
                    <select value={form.taxType || 'taxable'} onChange={e => setForm({ ...form, taxType: e.target.value as 'taxable' | 'exempt' })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white">
                      <option value="taxable">과세</option>
                      <option value="exempt">면세</option>
                    </select>
                  </div>
                  <div className="flex items-end gap-4 pb-1.5">
                    <label className="flex items-center gap-1.5 font-semibold text-slate-700"><input type="checkbox" checked={form.applyDiscount ?? false} onChange={e => setForm({ ...form, applyDiscount: e.target.checked })} /> 할인율 적용</label>
                    <label className="flex items-center gap-1.5 font-semibold text-slate-700"><input type="checkbox" checked={form.stockManaged ?? true} onChange={e => setForm({ ...form, stockManaged: e.target.checked })} /> 재고관리</label>
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
                    <label className="block font-semibold text-slate-700 mb-1">이월재고 <span className="font-normal text-slate-400">(사용 이전·전년도 말)</span></label>
                    <input type="number" value={form.openingStock ?? ''} onChange={e => setForm({ ...form, openingStock: Number(e.target.value) || 0 })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 text-right font-mono" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">안전/적정 재고</label>
                    <input type="number" value={form.safeStock || 0} onChange={e => setForm({ ...form, safeStock: Number(e.target.value) || 0 })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-right font-mono focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 border border-slate-200 rounded-md p-2 bg-slate-50/50">
                  <div className="col-span-3 text-[11px] font-bold text-slate-600">직전 매입 (매입 전표를 저장하면 자동으로 밀려 들어갑니다)</div>
                  <div><label className="block font-semibold text-slate-600 mb-1">최종매입처2</label><input type="text" value={form.supplier2 || ''} onChange={e => setForm({ ...form, supplier2: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded-md" /></div>
                  <div><label className="block font-semibold text-slate-600 mb-1">최종매입일2</label><input type="date" value={form.lastPurchaseDate2 || ''} onChange={e => setForm({ ...form, lastPurchaseDate2: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded-md font-mono" /></div>
                  <div><label className="block font-semibold text-slate-600 mb-1">최종매입가2</label><input type="number" value={form.lastPurchasePrice2 ?? ''} onChange={e => setForm({ ...form, lastPurchasePrice2: Number(e.target.value) || 0 })} className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-right font-mono" /></div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">매입처 / 공급공장 <span className="font-normal text-slate-400">(최종매입처1)</span></label>
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
