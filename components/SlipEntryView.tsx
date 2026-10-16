'use client';

import { isDispatched } from '@/lib/adminPin';
import React, { useState, useMemo, useDeferredValue, useRef, useEffect } from 'react';
import { displayProductName } from '@/lib/productName';
import { HistoryPicker, MyItemsPicker } from '@/components/SlipAssist';
import { roundBy, normalizeCalc, type CalcConfig } from '@/lib/calcRules';
import {
  Copy,
  Plus,
  Trash2,
  Printer,
  Save,
  RotateCcw,
  Search,
  Truck,
  DollarSign,
  AlertCircle,
  FileSpreadsheet,
  HardHat,
  Building,
  X
} from 'lucide-react';
import type { Product, Customer, Slip, SlipItem, SlipType, OSTheme, CustomerSite, DispatchStatus } from '@/types';

interface SlipEntryViewProps {
  products: Product[];
  customers: Customer[];
  slips: Slip[];
  onSaveSlip: (slipData: Partial<Slip>, deliveryInfo?: any) => Promise<Slip>;
  onDeleteSlip: (id: string) => Promise<void>;
  onOpenPrint: (slip: Slip) => void;
  onBundlePdf?: (slips: Slip[]) => void;
  adminMode?: boolean; // 관리자 모드: 발송·배송된 전표도 수정·삭제 가능
  onNavigateTab: (tab: string) => void;
  onQuickAddCustomer?: (c: Partial<Customer>) => Promise<Customer | undefined>;
  osTheme: OSTheme;
  calc?: Partial<CalcConfig>; // 환경설정의 금액 반올림(없으면 반올림=기존 동작)
}

export function SlipEntryView({
  products,
  customers,
  slips,
  onSaveSlip,
  onDeleteSlip,
  onOpenPrint,
  onBundlePdf,
  adminMode = false,
  onNavigateTab,
  onQuickAddCustomer,
  osTheme,
  calc
}: SlipEntryViewProps) {
  // Today date format
  const todayStr = new Date().toISOString().slice(0, 10);

  // Form states
  const [slipDate, setSlipDate] = useState<string>(todayStr);
  const [slipType, setSlipType] = useState<SlipType>('SALES');
  // 부가가치세 포함/별도 — 원본은 한 번 선택하면 계속 유지한다(매뉴얼 4쪽).
  // 매뉴얼 캡처로 확정: «포함» = 합계 5,000에 세액 500을 얹어 총액 5,500 / «별도» = 세액 칸 비움(총액=합계). 원본 실전표가 100% 세액 0인 것은 거래를 «별도»로 쓰기 때문(기본값).
  const [vatMode, setVatMode] = useState<'incl' | 'excl'>('excl');
  useEffect(() => { try { const v = localStorage.getItem('oksale.vatMode2'); if (v === 'excl' || v === 'incl') setVatMode(v); } catch {} }, []);
  // 단가소수점(0·1·2 순환)·전잔액출력·현재 선택 행(하단 정보행용)·견적서 참조사항 입력창 — 원본 전표작업 창의 같은 이름 항목
  const [priceDecimals, setPriceDecimals] = useState<0 | 1 | 2>(0);
  const [printPrevBalance, setPrintPrevBalance] = useState<boolean>(false);
  const [focusRow, setFocusRow] = useState<number>(0);
  const [refDialog, setRefDialog] = useState<string[] | null>(null);
  const calcCfg = normalizeCalc(calc);
  const amtR = (x: number) => roundBy(x, calcCfg.amt);
  const taxOf = (supply: number) => (vatMode === 'incl' ? roundBy(supply * 0.1, calcCfg.vat) : 0);
  const [editingSlipId, setEditingSlipId] = useState<string | null>(null);
  const [linkedFromId, setLinkedFromId] = useState<string | null>(null);
  // 원본 전표작업은 빈 격자로 시작한다(품목을 미리 채우지 않는다) — 거래처도 고르기 전에는 비어 있다.
  const blankRow = (): SlipItem => ({
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId: '', productCode: '', productName: '', spec: '', unit: '', qty: 0, unitPrice: 0,
    supplyAmount: 0, taxAmount: 0, totalAmount: 0, memo: ''
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'credit' | 'cash' | 'card' | 'mixed'>('credit');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [memo, setMemo] = useState<string>('');

  const [deliveryStatus, setDeliveryStatus] = useState<string>('none');
  const [dispatchStatus, setDispatchStatus] = useState<DispatchStatus | undefined>();
  
  // UX Enhancement: 스마트 재고 전표 보호 (원장 잠금)
  const isLocked = !adminMode && editingSlipId !== null && (
    deliveryStatus === 'delivered' || 
    deliveryStatus === 'shipping' || 
    (dispatchStatus && (dispatchStatus.faxStatus === 'SUCCESS' || dispatchStatus.emailStatus === 'SUCCESS' || dispatchStatus.kakaoStatus === 'SUCCESS'))
  );

  // 1:N Site states for selected customer
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedSiteName, setSelectedSiteName] = useState<string>('');
  const [selectedSiteManager, setSelectedSiteManager] = useState<string>('');
  const [selectedSiteAddress, setSelectedSiteAddress] = useState<string>('');

  // Quick Site Modal
  const [isQuickSiteModalOpen, setIsQuickSiteModalOpen] = useState<boolean>(false);
  const [quickSiteInput, setQuickSiteInput] = useState({
    siteName: '',
    manager: '',
    tel: '',
    address: '',
    memo: ''
  });

  // Delivery options
  const [needDelivery, setNeedDelivery] = useState<boolean>(false);
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [deliveryTel, setDeliveryTel] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');

  // Progressive Disclosure State for Site & Delivery
  const [isOptionsExpanded, setIsOptionsExpanded] = useState<boolean>(false);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dispatch Modal State
  const [dispatchModal, setDispatchModal] = useState<{ isOpen: boolean; channel: 'FAX' | 'KAKAO' | 'EMAIL' | null; contact: string }>({
    isOpen: false,
    channel: null,
    contact: ''
  });

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info', durationMs = 4000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ text, type });
    toastTimerRef.current = setTimeout(() => setToastMessage(null), durationMs);
  };

  const handleExternalDispatch = async (e: React.MouseEvent, channel: 'FAX' | 'KAKAO' | 'EMAIL') => {
    e.preventDefault();
    e.stopPropagation();
    if (!editingSlipId) {
      showToast('출력 및 전송을 위해 먼저 전표를 저장해주세요.', 'error');
      return;
    }
    const currentSlip = slips.find(s => s.id === editingSlipId);
    if (!currentSlip) {
      showToast('저장된 전표 정보를 찾을 수 없습니다.', 'error');
      return;
    }
    
    // Fallback contact info based on channel
    let defaultContact = '';
    if (channel === 'EMAIL') defaultContact = '고객사메일@example.com';
    if (channel === 'FAX' || channel === 'KAKAO') defaultContact = '010-0000-0000';
    
    setDispatchModal({
      isOpen: true,
      channel,
      contact: defaultContact
    });
  };

  const confirmExternalDispatch = async () => {
    const { channel, contact } = dispatchModal;
    if (!channel || !contact.trim()) {
      showToast('연락처(또는 이메일)를 입력해주세요.', 'error');
      return;
    }

    setDispatchModal(prev => ({ ...prev, isOpen: false }));
    showToast(`${channel === 'FAX' ? '팩스' : channel === 'KAKAO' ? '카카오톡' : '이메일'} 전송을 요청하는 중입니다...`, 'info', 10000);
    
    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slipId: editingSlipId, channel, targetContact: contact.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ ${channel === 'FAX' ? '팩스' : channel === 'KAKAO' ? '카카오톡' : '이메일'} 발송 성공: ${data.message || '요청이 접수되었습니다.'}`, 'success', 5000);
      } else {
        showToast(`❌ 전송 실패: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('❌ 네트워크 오류가 발생했습니다.', 'error');
    }
  };

  const handleDownloadExcel = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editingSlipId) {
      showToast('엑셀 저장을 위해 먼저 전표를 저장해주세요.', 'error');
      return;
    }
    
    const currentSlip = slips.find(s => s.id === editingSlipId);
    if (!currentSlip || !currentSlip.items) return;
    const suggestedName = `전표_${currentSlip.slipNo || editingSlipId}.xlsx`;
    let handle = null;
    
    if ((window as any).showSaveFilePicker) {
      try {
        handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: [{ description: 'Excel Workbook', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]
        });
      } catch (err: any) {
        if (err.name === 'AbortError') {
           showToast('ℹ️ 저장이 취소되었습니다.', 'info');
           return;
        }
        showToast('❌ 엑셀 저장 권한 오류가 발생했습니다.', 'error');
        return;
      }
    }

    showToast('엑셀 파일을 생성하는 중입니다...', 'info');
    
    try {
      const XLSX = await import('xlsx');
      const wsData = currentSlip.items.map((item, idx) => ({
        'No': idx + 1,
        '품목명': item.productName,
        '규격': item.spec,
        '단위': item.unit,
        '수량': item.qty,
        '단가': item.unitPrice,
        '공급가액': item.supplyAmount,
        '세액': item.taxAmount,
        '합계액': item.totalAmount,
        '비고': item.memo || ''
      }));
      
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "명세서");
      
      if (handle) {
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        showToast('✅ 엑셀 파일이 지정된 위치에 저장되었습니다.', 'success');
      } else {
        XLSX.writeFile(wb, suggestedName);
        showToast('✅ 엑셀 파일이 다운로드되었습니다.', 'success');
      }
    } catch (e) {
      showToast('❌ 엑셀 모듈을 불러오거나 저장 중 오류가 발생했습니다.', 'error');
      console.error(e);
    }
  };

  // Items grid rows
  const [items, setItems] = useState<SlipItem[]>([blankRow()]);

  // History search filter
  const [historyStartDate, setHistoryStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [historyEndDate, setHistoryEndDate] = useState<string>(todayStr);
  const [historyFilter, setHistoryFilter] = useState<string>('');
  const deferredHistoryFilter = useDeferredValue(historyFilter);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fast Product Search Modal States (11,000+ items high performance)
  const [isProductSearchOpen, setIsProductSearchOpen] = useState<boolean>(false);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [productSearchKeyword, setProductSearchKeyword] = useState<string>('');
  // 원본 규격 목록 창: 같은 품명의 여러 규격에 수량을 한꺼번에 넣고 Esc로 확정한다.
  const [modalQty, setModalQty] = useState<Record<string, string>>({});
  const deferredProductSearchKeyword = useDeferredValue(productSearchKeyword);

  // Customer instant search filter
  const [customerSearchFilter, setCustomerSearchFilter] = useState<string>('');
  const deferredCustomerSearchFilter = useDeferredValue(customerSearchFilter);
  const [siteSearchFilter, setSiteSearchFilter] = useState<string>('');
  const deferredSiteSearchFilter = useDeferredValue(siteSearchFilter);

  const filteredCustomersList = useMemo(() => {
    if (!deferredCustomerSearchFilter.trim()) return customers.filter(c => !c.inactive);
    const q = deferredCustomerSearchFilter.toLowerCase();
    return customers.filter(c => !c.inactive && (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.sites && c.sites.some(s => s.siteName.toLowerCase().includes(q)))
    ));
  }, [customers, deferredCustomerSearchFilter]);

  // 거래처 찾기(원본): 두 글자쯤 입력하고 Enter → 목록 → ↑↓·Enter로 선택, 목록에 없으면 Insert로 바로 등록.
  // (예전의 «검색하면 첫 거래처 자동 선택»은 거래처별 단가를 불러오지 않아 없앴다 — 선택은 항상 handleCustomerChange를 거친다.)
  const [custListOpen, setCustListOpen] = useState<boolean>(false);
  const [custIdx, setCustIdx] = useState<number>(0);
  const custMatches = filteredCustomersList.slice(0, 12);
  const [quickCust, setQuickCust] = useState<null | { name: string; bizNumber: string; ceo: string; tel: string }>(null);
  const pickCustomer = (id: string) => { handleCustomerChange(id); setCustListOpen(false); setCustomerSearchFilter(''); };
  const handleCustKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!customerSearchFilter.trim()) return;
      if (custListOpen && custMatches[custIdx]) pickCustomer(custMatches[custIdx].id);
      else if (custMatches.length === 1) pickCustomer(custMatches[0].id);
      else { setCustListOpen(true); setCustIdx(0); }
    } else if (e.key === 'ArrowDown') { e.preventDefault(); setCustListOpen(true); setCustIdx(i => Math.min(i + 1, custMatches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCustIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Escape') setCustListOpen(false);
    else if (e.key === 'Insert') { e.preventDefault(); setQuickCust({ name: customerSearchFilter.trim(), bizNumber: '', ceo: '', tel: '' }); }
  };
  const submitQuickCust = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!quickCust || !quickCust.name.trim()) { alert('거래처명을 입력하세요.'); return; }
    if (!onQuickAddCustomer) { alert('이 화면에서는 거래처를 바로 등록할 수 없습니다. 거래처관리에서 등록하세요.'); return; }
    const created = await onQuickAddCustomer({ name: quickCust.name.trim(), bizNumber: quickCust.bizNumber.trim(), ceo: quickCust.ceo.trim(), tel: quickCust.tel.trim() });
    if (!created) { alert('거래처 등록에 실패했습니다.'); return; }
    setQuickCust(null); pickCustomer(created.id); showToast(`거래처 «${created.name}»을(를) 등록하고 선택했습니다.`, 'success');
  };

  const searchResults = useMemo(() => {
    if (!deferredProductSearchKeyword.trim()) {
      return products.filter(p => !p.inactive).slice(0, 50);
    }
    const q = deferredProductSearchKeyword.toLowerCase();
    const matches: Product[] = [];
    for (const p of products) {
      if (p.inactive) continue;
      if (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.spec.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      ) {
        matches.push(p);
        if (matches.length >= 60) break;
      }
    }
    // 바코드 스캐너는 숫자열 + Enter로 입력된다 — 바코드가 정확히 같은 품목을 맨 앞에 둬서 Enter 한 번에 바로 선택되게 한다.
    const exact = matches.findIndex(p => p.barcode && p.barcode.toLowerCase() === q);
    if (exact > 0) matches.unshift(matches.splice(exact, 1)[0]);
    return matches;
  }, [products, deferredProductSearchKeyword]);

  // Selected customer object
  const currentCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const filteredSitesList = useMemo(() => {
    const sites = currentCustomer?.sites || [];
    if (!deferredSiteSearchFilter.trim()) return sites;
    const q = deferredSiteSearchFilter.toLowerCase();
    return sites.filter(s => 
      s.siteName.toLowerCase().includes(q) || 
      (s.manager && s.manager.toLowerCase().includes(q))
    );
  }, [currentCustomer, deferredSiteSearchFilter]);

  React.useEffect(() => {
    if (deferredSiteSearchFilter.trim() && filteredSitesList.length > 0) {
      const exists = filteredSitesList.find(s => (s.id || s.siteCode) === selectedSiteId);
      if (!exists) {
        const firstId = filteredSitesList[0].id || filteredSitesList[0].siteCode;
        setSelectedSiteId(firstId);
        setSelectedSiteName(filteredSitesList[0].siteName);
        setSelectedSiteManager(filteredSitesList[0].manager || '');
        setSelectedSiteAddress(filteredSitesList[0].address || '');
      }
    }
  }, [filteredSitesList, deferredSiteSearchFilter, selectedSiteId]);

  // Customer-specific agreed prices (Price.mdb)
  const [customerPrices, setCustomerPrices] = useState<Record<string, any>>({});

  // When site changes, update delivery address and slip site states
  const handleSiteSelect = (siteId: string) => {
    setSelectedSiteId(siteId);
    if (!siteId) {
      setSelectedSiteName('');
      setSelectedSiteManager('');
      setSelectedSiteAddress('');
      if (currentCustomer) {
        setDeliveryAddress(currentCustomer.address || '');
        setDeliveryTel(currentCustomer.mobile || currentCustomer.tel || '');
      }
      return;
    }

    const site = currentCustomer?.sites?.find(s => s.id === siteId || s.siteCode === siteId);
    if (site) {
      setSelectedSiteName(site.siteName);
      setSelectedSiteManager(site.manager || '');
      setSelectedSiteAddress(site.address || '');
      if (site.address) setDeliveryAddress(site.address);
      if (site.tel) setDeliveryTel(site.tel);
      setNeedDelivery(true);
      if (!memo) {
        setMemo(`[현장: ${site.siteName}]`);
      }
    }
  };

  // Quick add site from slip entry
  const handleQuickAddSite = () => {
    if (!quickSiteInput.siteName.trim()) {
      alert('현장명을 입력해주세요.');
      return;
    }
    if (!currentCustomer) return;

    const newSiteObj: CustomerSite = {
      id: `site-${Date.now()}`,
      siteCode: `S-${Date.now().toString().slice(-4)}`,
      siteName: quickSiteInput.siteName.trim(),
      manager: quickSiteInput.manager.trim(),
      tel: quickSiteInput.tel.trim(),
      address: quickSiteInput.address.trim(),
      memo: quickSiteInput.memo.trim()
    };

    if (!currentCustomer.sites) currentCustomer.sites = [];
    currentCustomer.sites.push(newSiteObj);

    // Select the new site
    setSelectedSiteId(newSiteObj.id);
    setSelectedSiteName(newSiteObj.siteName);
    setSelectedSiteManager(newSiteObj.manager || '');
    setSelectedSiteAddress(newSiteObj.address || '');
    if (newSiteObj.address) setDeliveryAddress(newSiteObj.address);
    if (newSiteObj.tel) setDeliveryTel(newSiteObj.tel);
    setNeedDelivery(true);
    setMemo(`[현장: ${newSiteObj.siteName}]`);

    // Reset & close quick modal
    setQuickSiteInput({ siteName: '', manager: '', tel: '', address: '', memo: '' });
    setIsQuickSiteModalOpen(false);
  };

  // When customer changes, update delivery address defaults and fetch agreed prices
  const handleCustomerChange = async (cId: string) => {
    setSelectedCustomerId(cId);
    setSelectedSiteId('');
    setSelectedSiteName('');
    setSelectedSiteManager('');
    setSelectedSiteAddress('');
    
    const targetCust = customers.find(c => c.id === cId);
    // 거래처에 «부가세 적용»이 지정돼 있으면 그에 맞춰 이 전표의 포함/별도를 바꾼다(저장된 기본 선택은 건드리지 않음). 없음(면세)은 세액 없음.
    if (targetCust?.vatType) handleVatModeChange(targetCust.vatType === 'incl' ? 'incl' : 'excl', false);
    if (targetCust) {
      setDeliveryAddress(targetCust.address || '');
      setDeliveryTel(targetCust.mobile || targetCust.tel || '');
      // If customer has default sites, don't force select, but let user choose
    }
    try {
      const cleanId = cId.replace(/^c-/, '');
      const res = await fetch(`/api/customer-prices/${cleanId}`);
      if (res.ok) {
        const pData = await res.json();
        setCustomerPrices(pData || {});
      }
    } catch {
      setCustomerPrices({});
    }
  };

  // Helper to resolve product price based on customer's priceTier and agreed prices
  const getProductPrice = (prod: Product, targetCustomer: Customer | undefined = currentCustomer, targetSlipType: SlipType = slipType) => {
    // 원본: 매입(2)·반출(4)은 매입단가. 매출·반입 등은 «거래처별 이전 단가가 있으면 우선, 없으면 판매단가» — 0이면 «이 거래처 첫 거래».
    if (targetSlipType === 'PURCHASE' || targetSlipType === 'RETURN_OUT') return prod.lastPurchasePrice || prod.costPrice;

    const agreed = customerPrices[prod.code] || customerPrices[prod.id.replace(/^p-/, '')];
    if (agreed && agreed.price1 > 0) return agreed.price1;

    const tier = targetCustomer?.priceTier || 1;
    let price = prod.sellingPrice;
    if (tier === 2 && prod.sellingPrice2) price = prod.sellingPrice2;
    if (tier === 3 && prod.sellingPrice3) price = prod.sellingPrice3;
    if (prod.discountRate && prod.discountRate > 0) price = price * (1 - prod.discountRate / 100);
    return price;
  };

  // When slip type changes, adjust default pricing (sales -> sellingPrice, purchase -> costPrice)
  const handleSlipTypeChange = (newType: SlipType) => {
    setSlipType(newType);
    setItems(prev =>
      prev.map(it => {
        const prod = products.find(p => p.id === it.productId);
        if (!prod) return it;
        const newUnitPrice = getProductPrice(prod, currentCustomer, newType);
        const supply = amtR(it.qty * newUnitPrice);
        const tax = taxOf(supply);
        return {
          ...it,
          unitPrice: newUnitPrice,
          supplyAmount: supply,
          taxAmount: tax,
          totalAmount: supply + tax
        };
      })
    );
  };

  // Row operations
  const handleItemChange = (idx: number, field: keyof SlipItem, val: any) => {
    setItems(prev => {
      const next = [...prev];
      const target = { ...next[idx], [field]: val };

      // Product selected
      if (field === 'productId') {
        const prod = products.find(p => p.id === val);
        if (prod) {
          target.productId = prod.id;
          target.productCode = prod.code;
          target.productName = prod.name;
          target.qty = target.qty > 0 ? target.qty : 1;
          target.spec = prod.spec;
          target.unit = prod.unit;
          const price = getProductPrice(prod);
          
          target.unitPrice = price;
          target.supplyAmount = amtR(target.qty * price);
          target.taxAmount = taxOf(target.supplyAmount);
          target.totalAmount = target.supplyAmount + target.taxAmount;
        }
      }

      // 할인율 변경: 단가 = 협정가(소비자가) × (100+할인율)/100 (원본 캡처: 협정가 90,600에 -100 → 단가 0)
      if (field === 'discountRate') {
        const prodForRate = products.find(p => p.id === target.productId);
        const rateRaw = String(val).trim();
        if (rateRaw === '' ) { target.discountRate = undefined; }
        else {
          const rate = Number(rateRaw) || 0;
          target.discountRate = rate;
          if (prodForRate && (prodForRate.retailPrice || 0) > 0) {
            target.unitPrice = Number(((prodForRate.retailPrice as number) * (100 + rate) / 100).toFixed(priceDecimals));
            target.supplyAmount = amtR(target.qty * target.unitPrice);
            target.taxAmount = taxOf(target.supplyAmount);
            target.totalAmount = target.supplyAmount + target.taxAmount;
          }
        }
      }

      // Quantity or UnitPrice changed
      if (field === 'qty' || field === 'unitPrice') {
        const q = field === 'qty' ? Number(val) || 0 : target.qty;
        const p = field === 'unitPrice' ? Number((Number(val) || 0).toFixed(priceDecimals)) : target.unitPrice;
        target.supplyAmount = amtR(q * p);
        target.taxAmount = taxOf(target.supplyAmount);
        target.totalAmount = target.supplyAmount + target.taxAmount;
      }

      next[idx] = target;
      return next;
    });
  };

  const handleVatModeChange = (mode: 'incl' | 'excl', persist = true) => {
    setVatMode(mode);
    if (persist) { try { localStorage.setItem('oksale.vatMode2', mode); } catch {} }
    setItems(prev => prev.map(it => {
      const tax = mode === 'incl' ? roundBy(it.supplyAmount * 0.1, calcCfg.vat) : 0;
      return { ...it, taxAmount: tax, totalAmount: it.supplyAmount + tax };
    }));
  };

  // 품목 검색창에서 수량을 넣은 규격들을 전표 줄로 담는다(첫 줄은 선택한 빈 줄을 채우고 나머지는 그 아래에 추가).
  const applyModalQty = (): boolean => {
    const picks = searchResults.filter(p => Number(modalQty[p.id]) > 0);
    if (picks.length === 0) return false;
    const rows: SlipItem[] = picks.map((prod, i) => {
      const qty = Number(modalQty[prod.id]);
      const price = getProductPrice(prod);
      const supply = amtR(qty * price);
      const tax = taxOf(supply);
      return { id: `row-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`, productId: prod.id, productCode: prod.code, productName: prod.name, spec: prod.spec, unit: prod.unit, qty, unitPrice: price, supplyAmount: supply, taxAmount: tax, totalAmount: supply + tax, memo: '' };
    });
    setItems(prev => {
      const at = activeRowIndex !== null && activeRowIndex < prev.length ? activeRowIndex : prev.length - 1;
      const next = [...prev];
      if (next[at] && !next[at].productId) next.splice(at, 1, ...rows); else next.splice(at + 1, 0, ...rows);
      return next;
    });
    setModalQty({});
    return true;
  };

  // F4 할인율: 현재 행 품명과 같은 품명의 모든 행에 같은 할인율을 적용한다(규격별 협정가 기준).
  const handleApplyDiscountToSameName = () => {
    const row = items[Math.min(focusRow, items.length - 1)];
    if (!row || !row.productId) { alert('할인율을 적용할 품목 줄을 먼저 선택하세요.'); return; }
    const raw = window.prompt(`«${displayProductName(row.productName)}» 같은 품명 전체에 적용할 할인율(%)을 입력하세요.\n예) -30 = 협정가에서 30% 할인, -100 = 0원`, row.discountRate != null ? String(row.discountRate) : '');
    if (raw === null) return;
    const rate = Number(raw);
    if (!Number.isFinite(rate)) { alert('숫자로 입력하세요.'); return; }
    const noAgreed: string[] = [];
    setItems(prev => prev.map(it => {
      if (it.productName !== row.productName || !it.productId) return it;
      const pr = products.find(p => p.id === it.productId);
      if (!pr || !(pr.retailPrice || 0) ) { noAgreed.push(it.spec); return { ...it, discountRate: rate }; }
      const unitPrice = Number(((pr.retailPrice as number) * (100 + rate) / 100).toFixed(priceDecimals));
      const supply = amtR(it.qty * unitPrice);
      const tax = taxOf(supply);
      return { ...it, discountRate: rate, unitPrice, supplyAmount: supply, taxAmount: tax, totalAmount: supply + tax };
    }));
    if (noAgreed.length) setTimeout(() => alert(`협정가가 없는 규격은 단가를 바꾸지 못했습니다: ${noAgreed.join(', ')}\n(품목관리에서 협정가를 입력하세요)`), 0);
  };

  const handleAddRow = () => {
    setItems(prev => [...prev, blankRow()]);
  };

  // 거래내역 보기·My품목에서 고른 줄을 전표 끝에 담는다(빈 줄은 정리). 금액은 지금 전표의 세금 방식으로 다시 계산한다.
  const [assistModal, setAssistModal] = useState<null | 'history' | 'my'>(null);
  const handleAddAssistItems = (picked: SlipItem[]) => {
    if (picked.length === 0) return;
    const fresh = picked.map(it => {
      const supply = amtR((it.qty || 0) * (it.unitPrice || 0));
      const tax = taxOf(supply);
      return { ...it, id: 'row-' + Math.random().toString(36).slice(2, 11), supplyAmount: supply, taxAmount: tax, totalAmount: supply + tax };
    });
    setItems(prev => {
      const kept = prev.filter(r => r.productName || r.productId);
      return [...kept, ...fresh];
    });
    showToast(`${fresh.length}줄을 전표에 담았습니다.`, 'info');
  };

  const handleRemoveRow = (idx: number) => {
    if (items.length <= 1) {
      alert('최소 1개 이상의 품목 행이 있어야 합니다.');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // 하단 정보행(원본: 최근매입가·판매단가·협정가·이익률·최근거래일·단가변동일·현재고) — 현재 선택 행의 품목 기준.
  // 최근거래·단가변동은 같은 거래처·같은 구분의 저장된 전표에서 계산한다(이관 시 Price 표의 날짜 칸이 빠져 있어 전표 이력으로 대신함).
  const rowInfo = useMemo(() => {
    const row = items[Math.min(focusRow, items.length - 1)];
    const prod = row && products.find(p => p.id === row.productId);
    if (!row || !prod) return null;
    const hist = slips
      .filter(sl => sl.slipType === slipType && sl.customerId === selectedCustomerId && sl.id !== editingSlipId)
      .flatMap(sl => sl.items.filter(it => it.productId === prod.id).map(it => ({ date: sl.slipDate, price: it.unitPrice })))
      .sort((a, b) => b.date.localeCompare(a.date));
    const last = hist[0];
    let changedOn = last?.date; // 현재 단가가 처음 적용된 날(같은 단가가 이어진 가장 오래된 거래일)
    for (const h of hist) { if (h.price !== last.price) break; changedOn = h.date; }
    const cost = prod.lastPurchasePrice || prod.costPrice || 0;
    const margin = row.unitPrice > 0 && cost > 0 ? ((row.unitPrice - cost) / row.unitPrice) * 100 : null;
    return { cost, sell: prod.sellingPrice || 0, agreed: prod.retailPrice || 0, margin, last, changedOn, stock: prod.currentStock || 0 };
  }, [items, focusRow, products, slips, slipType, selectedCustomerId, editingSlipId]);

  // 핫키(원본): F4 할인율 · F8 저장 · F2 품목 검색 열기. 입력 칸에서도 동작하도록 창 단위로 듣는다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isProductSearchOpen || isQuickSiteModalOpen) return;
      if (e.key === 'F4') { e.preventDefault(); handleApplyDiscountToSameName(); }
      else if (e.key === 'F8') { e.preventDefault(); if (!isSubmitting) handleSubmitSlip(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Calculations
  const totalSupplyAmount = items.reduce((s, it) => s + (it.supplyAmount || 0), 0);
  const totalTaxAmount = items.reduce((s, it) => s + (it.taxAmount || 0), 0);
  const totalAmount = totalSupplyAmount + totalTaxAmount;
  // 이미 저장된 전표를 열어 둔 상태에서는 거래처 미수금(receivables)에 «이 전표의 미수»가 이미 들어 있으므로 빼서 «거래 전»을 만든다(안 빼면 저장 직후 화면이 미수를 두 번 센다 — 2026-10-16 실측: 410원 → 거래 후 820원).
  // 이관 전표처럼 미수금에 안 들어 있던 경우를 위해 0 아래로는 내리지 않는다.
  const origSlipForPrev = editingSlipId ? slips.find(s => s.id === editingSlipId) : undefined;
  const origUnpaidForPrev = origSlipForPrev && String(origSlipForPrev.slipType).toUpperCase() === 'SALES' ? Number(origSlipForPrev.unpaidAmount) || 0 : 0;
  const prevReceivables = Math.max(0, (currentCustomer?.receivables || 0) - origUnpaidForPrev);
  const unpaidAmount = Math.max(0, totalAmount - paidAmount);
  const nextReceivables = slipType === 'SALES' ? prevReceivables + unpaidAmount : prevReceivables;

  // Load Slip for Editing
  const handleLoadSlip = (slip: Slip) => {
    setEditingSlipId(slip.id);
    setLinkedFromId(slip.linkedFromId || null);
    setSlipType(slip.slipType);
    setSlipDate(slip.slipDate);
    setSelectedCustomerId(slip.customerId);
    setSelectedSiteId(slip.siteId || '');
    setSelectedSiteName(slip.siteName || '');
    setSelectedSiteManager(slip.siteManager || '');
    setSelectedSiteAddress(slip.siteAddress || '');
    setItems(slip.items.map(it => ({ ...it })));
    setPaymentType(slip.paymentType);
    setPaidAmount(slip.paidAmount);
    setMemo(slip.memo || '');
    
    if (slip.deliveryStatus && slip.deliveryStatus !== 'none') {
      setNeedDelivery(true);
      setIsOptionsExpanded(true);
      setDeliveryStatus(slip.deliveryStatus);
    } else {
      setNeedDelivery(false);
      setDeliveryStatus('none');
    }
    setDispatchStatus(slip.dispatchStatus);
  };

  // 전표 복사(원본 «전표복사»): 이미 쓴 전표(예: 견적)를 새 전표로 가져와 구분·내용을 고쳐 따로 저장한다. 원본 전표는 그대로 둔다.
  const handleCopySlip = (slip: Slip) => {
    setEditingSlipId(null);
    setLinkedFromId(null);
    setSlipType(slip.slipType);
    setSlipDate(todayStr);
    setSelectedCustomerId(slip.customerId);
    setSelectedSiteId(slip.siteId || '');
    setSelectedSiteName(slip.siteName || '');
    setSelectedSiteManager(slip.siteManager || '');
    setSelectedSiteAddress(slip.siteAddress || '');
    setItems(slip.items.map(it => {
      const tax = taxOf(it.supplyAmount);
      return { ...it, id: 'row-' + Math.random().toString(36).slice(2, 11), taxAmount: tax, totalAmount: it.supplyAmount + tax };
    }));
    setPaymentType('credit');
    setPaidAmount(0);
    setMemo('');
    setNeedDelivery(false);
    setDeliveryStatus('none');
    setDispatchStatus(undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`전표 #${slip.slipNo}를 복사했습니다. 구분·내용을 고친 뒤 저장하면 새 전표가 만들어집니다.`, 'info');
  };

  // Convert Slip for O2C (e.g., ORDER -> DELIVERY)
  const handleConvertSlip = (slip: Slip, targetType: SlipType) => {
    setEditingSlipId(null); // 신규 작성 모드
    setLinkedFromId(slip.id); // 원본 추적
    setSlipType(targetType);
    setSlipDate(new Date().toISOString().split('T')[0]); // 날짜는 오늘로 초기화
    setSelectedCustomerId(slip.customerId);
    setSelectedSiteId(slip.siteId || '');
    setSelectedSiteName(slip.siteName || '');
    setSelectedSiteManager(slip.siteManager || '');
    setSelectedSiteAddress(slip.siteAddress || '');
    setItems(slip.items.map(it => ({ ...it, id: 'row-' + Math.random().toString(36).substr(2, 9) }))); // 새 row ID 부여
    setPaymentType('credit'); // 초기화
    setPaidAmount(0); // 초기화
    setMemo(''); // 메모는 비우거나 원본 유지 가능 (현재는 비움)
    
    // 강제로 우측 폼으로 스크롤 이동
    window.scrollTo({ top: 0, behavior: 'smooth' });
    alert(`[${targetType === 'DELIVERY' ? '납품서' : '거래명세서'}] 변환 준비 완료.\n내용을 확인하고 저장해주세요.`);
  };

  // Save Slip
  const handleSubmitSlip = async () => {
    if (isLocked) {
      alert('이미 발송(팩스·이메일·카카오)되었거나 배송 중인 전표입니다.\n고치려면 위쪽 «🔒 관리자 모드»를 켜세요.');
      return;
    }
    if (!selectedCustomerId) {
      alert('거래처를 선택해주세요.');
      return;
    }
    const filledItems = items.filter(it => it.productId); // 빈 줄은 저장하지 않는다
    if (filledItems.length === 0) {
      alert('품목을 한 줄 이상 입력해주세요.');
      return;
    }
    if (filledItems.some(it => it.qty <= 0)) {
      alert('모든 품목의 수량을 1 이상으로 입력해주세요.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const saved = await onSaveSlip(
        {
          id: editingSlipId || undefined,
          linkedFromId: linkedFromId || undefined,
          slipDate,
          slipType,
          customerId: selectedCustomerId,
          customerName: currentCustomer?.name || '',
          siteId: selectedSiteId,
          siteName: selectedSiteName,
          siteManager: selectedSiteManager,
          siteAddress: selectedSiteAddress,
          items: filledItems,
          totalSupplyAmount,
          totalTaxAmount,
          totalAmount,
          paymentType,
          paidAmount,
          unpaidAmount,
          prevReceivables,
          memo
        },
        needDelivery
          ? {
              required: true,
              siteId: selectedSiteId,
              siteName: selectedSiteName,
              address: deliveryAddress || selectedSiteAddress || currentCustomer?.address,
              tel: deliveryTel || currentCustomer?.tel,
              driverName: driverName || '미배차',
              requestedDate: slipDate,
              memo: selectedSiteName ? `[현장: ${selectedSiteName}] ${memo}` : memo
            }
          : undefined
      );

      // IMPORTANT: Keep editingSlipId set to saved.id so that
      // fax/kakao/email/pdf/excel buttons can reference the saved slip.
      // The user can manually reset via the "취소" button.
      setEditingSlipId(saved.id);
      setLinkedFromId(null);
      
      // Directly open print modal (no confirm() which causes focus event → re-render → modal disappears)
      onOpenPrint(saved);
    } catch (err: any) {
      alert(err.message || '전표 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    if (confirm('작성 중인 전표 내용을 초기화하시겠습니까?')) {
      setSlipDate(todayStr);
      setPaidAmount(0);
      setMemo('');
      setNeedDelivery(false);
      setItems([blankRow()]);
      setSelectedCustomerId('');
      setSelectedSiteId(''); setSelectedSiteName(''); setSelectedSiteManager(''); setSelectedSiteAddress('');
    }
  };

  // Filtered Slip History
  const filteredSlips = useMemo(() => {
    const result = slips.filter(s => {
      if (s.slipDate < historyStartDate || s.slipDate > historyEndDate) return false;
      
      if (!deferredHistoryFilter.trim()) return true;
      const q = deferredHistoryFilter.toLowerCase();
      return (
        s.slipNo.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        (s.siteName && s.siteName.toLowerCase().includes(q)) ||
        s.items.some(i => i.productName.toLowerCase().includes(q))
      );
    });
    // 최신순(전표일자 내림차순, 생성일시 내림차순) 정렬
    return result.sort((a, b) => b.slipDate.localeCompare(a.slipDate) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [slips, historyStartDate, historyEndDate, deferredHistoryFilter]);

  const { totalFilteredSupply, totalFilteredTax, totalFilteredAmount } = useMemo(() => {
    return filteredSlips.reduce((acc, slip) => {
      // 발주서나 납품서는 금액 합계에서 제외(숨김 처리되므로)
      if (slip.slipType === 'ORDER' || slip.slipType === 'DELIVERY') return acc;
      
      const slipSupply = slip.items.reduce((s, it) => s + (it.supplyAmount || 0), 0);
      const slipTax = slip.items.reduce((s, it) => s + (it.taxAmount || 0), 0);
      
      return {
        totalFilteredSupply: acc.totalFilteredSupply + slipSupply,
        totalFilteredTax: acc.totalFilteredTax + slipTax,
        totalFilteredAmount: acc.totalFilteredAmount + slip.totalAmount
      };
    }, { totalFilteredSupply: 0, totalFilteredTax: 0, totalFilteredAmount: 0 });
  }, [filteredSlips]);

  const formatKRW = (num: number) => num.toLocaleString('ko-KR') + '원';

  const handleOpenPrintPreview = (notesArg?: unknown) => {
    const notes = Array.isArray(notesArg) ? (notesArg as string[]) : null; // 견적서 참조사항(참조1~4) — 입력창 확인 뒤 다시 호출될 때만 들어온다
    if (!selectedCustomerId) {
      showToast('명세서 출력을 위해 먼저 거래처를 선택해주세요.', 'error');
      return;
    }
    const currentCustomer = customers.find(c => c.id === selectedCustomerId);
    
    // 견적서: 원본은 출력 전에 «비고입력» 창(참조1~4, 참조1 기본 «부가가치세 별도»)을 띄운다 — 확인하면 이어서 미리보기를 연다.
    if (slipType === 'ESTIMATE' && notes === null) {
      setRefDialog(['부가가치세 별도', '', '', '']);
      return;
    }
    const refNote = (notes || []).map(x => x.trim()).filter(Boolean).join(' / ');
    const previewSlip: Slip = {
      id: editingSlipId || 'PREVIEW',
      slipNo: editingSlipId ? (slips.find(s => s.id === editingSlipId)?.slipNo || 'PREVIEW') : 'PREVIEW',
      slipDate,
      slipType,
      customerId: selectedCustomerId,
      customerName: currentCustomer?.name || '',
      siteId: selectedSiteId,
      siteName: selectedSiteName,
      siteManager: selectedSiteManager,
      siteAddress: selectedSiteAddress,
      items: items.filter(it => it.productId),
      totalSupplyAmount,
      totalTaxAmount,
      totalAmount,
      paymentType,
      paidAmount,
      unpaidAmount,
      prevReceivables,
      showPrevBalance: printPrevBalance,
      memo: refNote ? `[참조사항] ${refNote}${memo ? ' / ' + memo : ''}` : memo,
      createdAt: editingSlipId ? (slips.find(s => s.id === editingSlipId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      digitalSignature: editingSlipId ? slips.find(s => s.id === editingSlipId)?.digitalSignature : undefined,
      tsaToken: editingSlipId ? slips.find(s => s.id === editingSlipId)?.tsaToken : undefined,
    };
    onOpenPrint(previewSlip);
  };

  const handleDownloadHistoryExcel = async () => {
    try {
      const xlsx = await import('xlsx');
      
      const exportData = filteredSlips.map((slip, idx) => {
        const supplyAmt = slip.items.reduce((s, it) => s + (it.supplyAmount || 0), 0);
        const taxAmt = slip.items.reduce((s, it) => s + (it.taxAmount || 0), 0);
        const hideAmounts = slip.slipType === 'DELIVERY' || slip.slipType === 'ORDER';

        return {
          'NO': filteredSlips.length - idx,
          '전표일자': slip.slipDate,
          '구분': slip.slipType === 'SALES' ? '매출' : slip.slipType === 'DELIVERY' ? '납품' : slip.slipType === 'ORDER' ? '발주' : slip.slipType === 'PURCHASE' ? '매입' : '반품',
          '거래처명': slip.customerName,
          '현장명': slip.siteName || '',
          '공급가액': hideAmounts ? 0 : supplyAmt,
          '세액': hideAmounts ? 0 : taxAmt,
          '합계': hideAmounts ? 0 : slip.totalAmount,
          '전표번호': slip.slipNo
        };
      });

      // 요약행 추가
      exportData.push({
        'NO': '총 합계' as any,
        '전표일자': '',
        '구분': '',
        '거래처명': '',
        '현장명': '',
        '공급가액': totalFilteredSupply,
        '세액': totalFilteredTax,
        '합계': totalFilteredAmount,
        '전표번호': ''
      });

      const worksheet = xlsx.utils.json_to_sheet(exportData);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, '전표조회내역');
      
      xlsx.writeFile(workbook, `전표조회내역_${historyStartDate}_${historyEndDate}.xlsx`);
      showToast('✅ 검색된 전표 내역이 엑셀로 저장되었습니다.', 'success');
    } catch (e) {
      showToast('❌ 엑셀 저장 중 오류가 발생했습니다.', 'error');
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-140px)] min-h-[600px] overflow-hidden relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-[200] px-4 py-3 rounded shadow-xl text-sm font-bold flex items-center gap-2 max-w-md w-max transition-all duration-300 ease-out ${
          toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-2 border-emerald-500' :
          toastMessage.type === 'error' ? 'bg-red-50 text-red-800 border-2 border-red-500' :
          'bg-blue-50 text-blue-800 border-2 border-blue-500'
        }`}>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* LEFT COLUMN: Slip History Table (Master) */}
      <div className={`w-full lg:w-[45%] flex flex-col rounded-lg border shadow-xs overflow-hidden ${osTheme === 'winxp-retro' ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col flex-1 min-h-0 p-4 pb-2">
        <div className="flex flex-col gap-1 mb-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-800">
                최근 발행 전표 내역 ({filteredSlips.length}건)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                발행된 매출/매입 전표 조회, 거래명세표 재인쇄 및 삭제 관리
              </p>
            </div>
            <div className="flex items-center gap-1.5">
            {onBundlePdf && (
              <button
                onClick={() => onBundlePdf(filteredSlips)}
                className="px-2.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded text-[11px] font-bold flex items-center gap-1 shadow-sm transition-colors"
                title="현재 조회된 전표를 원본 양식(거래명세표·견적서·발주서)으로 한 PDF 파일에 묶습니다."
              >
                📄 PDF 묶음
              </button>
            )}
            <button
              onClick={handleDownloadHistoryExcel}
              className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded text-[11px] font-bold flex items-center gap-1 shadow-sm transition-colors"
              title="현재 조회된 내역을 엑셀 파일로 다운로드합니다."
            >
              📊 엑셀 저장
            </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600">조회일자</span>
              <input
                type="date"
                value={historyStartDate}
                onChange={e => setHistoryStartDate(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
              />
              <span>~</span>
              <input
                type="date"
                value={historyEndDate}
                onChange={e => setHistoryEndDate(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="전표번호, 거래처명, 현장명, 품목명 검색..."
                value={historyFilter}
                onChange={e => setHistoryFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
              />
            </div>
          </div>
        </div>

        {/* History Table View (Ledger View) */}
        <div className="flex-1 overflow-x-auto overflow-y-auto border-t border-slate-200">
          <table className="w-full text-left text-[11px] border-collapse font-sans whitespace-nowrap min-w-[600px]">
            <thead className="sticky top-0 bg-slate-100 text-slate-600 border-b border-slate-200 z-10">
              <tr>
                <th className="py-2 px-2 text-center w-10">NO</th>
                <th className="py-2 px-2 text-center w-20">전표일자</th>
                <th className="py-2 px-2 text-center w-12">구분</th>
                <th className="py-2 px-2 min-w-[120px]">거래처명</th>
                <th className="py-2 px-2 min-w-[120px]">현장명</th>
                <th className="py-2 px-2 text-right w-20">공급가액</th>
                <th className="py-2 px-2 text-right w-20">합계</th>
                <th className="py-2 px-2 text-right w-16">세액</th>
                <th className="py-2 px-2 text-center w-16">전표번호</th>
                <th className="py-2 px-2 text-center w-16">기능</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredSlips.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    해당 기간에 발행된 전표 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredSlips.map((slip, idx) => {
                  const isSales = slip.slipType === 'SALES';
                  const isPurchase = slip.slipType === 'PURCHASE';
                  const slipTypeLabel = 
                    slip.slipType === 'SALES' || isSales ? '매출' : 
                    slip.slipType === 'DELIVERY' ? '납품' : 
                    slip.slipType === 'ORDER' ? '발주' : 
                    isPurchase ? '매입' : '반품';
                  const slipTypeColor =
                    slip.slipType === 'SALES' || isSales ? 'text-blue-700 font-bold' :
                    slip.slipType === 'DELIVERY' ? 'text-emerald-700 font-bold' :
                    slip.slipType === 'ORDER' ? 'text-rose-700 font-bold' :
                    isPurchase ? 'text-emerald-700 font-bold' : 'text-slate-700';
                  
                  const supplyAmt = slip.items.reduce((s, it) => s + (it.supplyAmount || 0), 0);
                  const taxAmt = slip.items.reduce((s, it) => s + (it.taxAmount || 0), 0);
                  const hideAmounts = slip.slipType === 'DELIVERY' || slip.slipType === 'ORDER';

                  return (
                    <tr
                      key={slip.id}
                      onClick={() => handleLoadSlip(slip)}
                      className={`cursor-pointer transition-colors hover:bg-blue-50 ${
                        editingSlipId === slip.id ? 'bg-blue-100' : ''
                      }`}
                    >
                      <td className="py-1.5 px-2 text-center text-slate-400">{filteredSlips.length - idx}</td>
                      <td className="py-1.5 px-2 text-center font-mono text-slate-600">{slip.slipDate}</td>
                      <td className={`py-1.5 px-2 text-center ${slipTypeColor}`}>{slipTypeLabel}</td>
                      <td className="py-1.5 px-2 font-bold text-slate-800 truncate max-w-[150px]" title={slip.customerName}>{slip.customerName}</td>
                      <td className="py-1.5 px-2 text-slate-600 truncate max-w-[150px]" title={slip.siteName || ''}>{slip.siteName || '-'}</td>
                      <td className="py-1.5 px-2 text-right font-mono font-semibold text-slate-700">
                        {hideAmounts ? '-' : supplyAmt.toLocaleString('ko-KR')}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-blue-700">
                        {hideAmounts ? '-' : slip.totalAmount.toLocaleString('ko-KR')}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                        {hideAmounts ? '-' : taxAmt.toLocaleString('ko-KR')}
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono text-slate-500">#{slip.slipNo}{isDispatched(slip.dispatchStatus) && <span className="ml-1 px-1 rounded bg-emerald-100 text-emerald-700 text-[10px] font-sans font-bold" title={[slip.dispatchStatus?.faxStatus === 'SUCCESS' ? `팩스 ${slip.dispatchStatus?.faxAt?.slice(0, 16).replace('T', ' ') || ''} ${slip.dispatchStatus?.faxTo || ''}` : '', slip.dispatchStatus?.emailStatus === 'SUCCESS' ? '이메일' : '', slip.dispatchStatus?.kakaoStatus === 'SUCCESS' ? '카카오' : ''].filter(Boolean).join(' · ')}>발송됨</span>}</td>
                      <td className="py-1.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleCopySlip(slip); }} 
                            className="p-1 text-emerald-600 hover:bg-emerald-100 rounded" 
                            title="전표 복사 — 새 전표로 가져와 수정"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onOpenPrint(slip); }} 
                            className="p-1 text-blue-600 hover:bg-blue-200 rounded" 
                            title="명세서 인쇄"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); if (!adminMode && isDispatched(slip.dispatchStatus)) { alert('발송된 전표는 삭제할 수 없습니다.\n관리자 모드를 켜면 삭제할 수 있습니다.'); return; } onDeleteSlip(slip.id); }} 
                            className={`p-1 rounded ${!adminMode && isDispatched(slip.dispatchStatus) ? 'text-slate-300' : 'text-rose-500 hover:bg-rose-100'}`} 
                            title={!adminMode && isDispatched(slip.dispatchStatus) ? '발송된 전표 — 관리자 모드에서만 삭제' : '전표 삭제'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredSlips.length > 0 && (
              <tfoot className="sticky bottom-0 bg-slate-50 border-t-2 border-slate-300 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] text-slate-800">
                <tr>
                  <td colSpan={5} className="py-2 px-2 text-center font-bold text-slate-700 border-r border-slate-200">
                    검색 내역 총 합계
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-slate-800">
                    {totalFilteredSupply.toLocaleString('ko-KR')}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-blue-700 text-sm">
                    {totalFilteredAmount.toLocaleString('ko-KR')}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-slate-700">
                    {totalFilteredTax.toLocaleString('ko-KR')}
                  </td>
                  <td colSpan={2} className="py-2 px-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        </div>
      </div>
      {/* RIGHT COLUMN: Entry Form (Detail) */}
      <div className={`w-full lg:w-[60%] flex flex-col rounded-lg border shadow-xs overflow-hidden ${osTheme === 'winxp-retro' ? 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Top Slip Config Card (Sticky Header) */}
      <div className={`p-4 rounded-lg border shadow-xs sticky top-0 z-10 backdrop-blur-md ${
        osTheme === 'winxp-retro'
          ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white/90 border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <span>{editingSlipId ? '기존 전표 수정 (업데이트 모드)' : '신규 전표 작성'}</span>
              <span className="text-xs font-normal text-slate-500">
                (FarPoint Spread 3.0 초고속 키보드 최적화)
              </span>
            </h2>
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-slate-600">명세서 구분 (8종):</span>
            <div className="flex flex-wrap rounded-md border border-slate-300 overflow-hidden bg-slate-100 w-full max-w-3xl">
              {[
                { type: 'SALES', label: '매출', icon: '💳', color: 'bg-blue-600' },
                { type: 'PURCHASE', label: '매입', icon: '🛒', color: 'bg-purple-600' },
                { type: 'RETURN_IN', label: '반입', icon: '↩️', color: 'bg-amber-600' },
                { type: 'RETURN_OUT', label: '반출', icon: '↪️', color: 'bg-orange-600' },
                { type: 'ESTIMATE', label: '견적', icon: '📊', color: 'bg-teal-600' },
                { type: 'ORDER', label: '발주', icon: '📝', color: 'bg-rose-600' },
                { type: 'DELIVERY', label: '납품', icon: '🚚', color: 'bg-emerald-600' },
                { type: 'CONTRACT', label: '수주', icon: '🤝', color: 'bg-cyan-600' }
              ].map(t => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => handleSlipTypeChange(t.type as SlipType)}
                  className={`flex-1 min-w-[70px] px-2 py-1.5 font-bold transition-colors text-[11px] whitespace-nowrap border-r border-slate-200 last:border-0 ${
                    slipType === t.type ? `${t.color} text-white shadow-inner` : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold text-slate-600">부가가치세:</span>
            <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="vatMode" checked={vatMode === 'incl'} onChange={() => handleVatModeChange('incl')} />포함(세액 10% 가산)</label>
            <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="vatMode" checked={vatMode === 'excl'} onChange={() => handleVatModeChange('excl')} />별도(세액 없음)</label>
            <span className="text-slate-400">한 번 고르면 계속 유지됩니다.</span>
            <label className="flex items-center gap-1 cursor-pointer ml-3"><input type="checkbox" checked={printPrevBalance} onChange={e => setPrintPrevBalance(e.target.checked)} />전잔액 출력</label>
            <button type="button" onClick={handleApplyDiscountToSameName} className="border border-slate-300 rounded px-2 py-0.5 font-semibold hover:bg-slate-100" title="같은 품명 전체에 협정가 기준 할인율 적용">할인율 (F4)</button>
            <button type="button" onClick={() => setPriceDecimals(d => ((d + 1) % 3) as 0 | 1 | 2)} className="border border-slate-300 rounded px-2 py-0.5 font-semibold hover:bg-slate-100" title="누를 때마다 0 → 1 → 2 → 0">단가소수점 {priceDecimals}</button>
          </div>
        </div>

        {/* Bento Grid Layout for Form Fields */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-3">
          {/* Card 1: 기본 정보 (Basic Info) */}
          <div className="lg:col-span-2 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <h3 className="font-bold text-slate-700 text-xs flex items-center gap-1 border-b border-slate-200 pb-1.5">
              <span>기본 거래 정보</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">전표 일자</label>
                <input
                  type="date"
                  value={slipDate}
                  onChange={e => setSlipDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-800 font-mono focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-700">거래처 선택</label>
                  <div className="flex items-center gap-2">
                    {selectedCustomerId && (
                      <button
                        type="button"
                        onClick={() => { setSelectedCustomerId(''); setSelectedSiteId(''); }}
                        className="text-[11px] text-rose-500 hover:underline font-medium"
                      >
                        선택 취소
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigateTab('customers')}
                      className="text-[11px] text-blue-600 hover:underline"
                    >
                      + 거래처
                    </button>
                  </div>
                </div>
                <div className="flex gap-1.5 mb-1.5 relative">
                  <input
                    type="text"
                    placeholder="🔍 거래처 두 글자 + Enter (Insert: 새 거래처 등록)"
                    value={customerSearchFilter}
                    onKeyDown={handleCustKey}
                    onChange={e => { setCustomerSearchFilter(e.target.value); setCustListOpen(false); }}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 font-medium transition-colors"
                  />
                  {customerSearchFilter && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearchFilter('')}
                      className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 rounded font-bold"
                    >
                      ✕
                    </button>
                  )}
                  {custListOpen && custMatches.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full mt-1 z-30 max-h-64 overflow-y-auto bg-white border border-slate-300 rounded-md shadow-lg text-xs">
                      {custMatches.map((c, i) => (
                        <li
                          key={c.id}
                          onMouseDown={e => { e.preventDefault(); pickCustomer(c.id); }}
                          onMouseEnter={() => setCustIdx(i)}
                          className={`px-2.5 py-1.5 cursor-pointer flex justify-between gap-2 ${i === custIdx ? 'bg-blue-600 text-white' : 'hover:bg-slate-50'}`}
                        >
                          <span className="font-semibold truncate">{c.name}</span>
                          <span className={`font-mono shrink-0 ${i === custIdx ? 'text-blue-100' : 'text-slate-400'}`}>{c.code}{c.sites && c.sites.length > 0 ? ` · 현장 ${c.sites.length}` : ''}</span>
                        </li>
                      ))}
                      <li className="px-2.5 py-1 text-[10px] text-slate-400 border-t">↑↓ 이동 · Enter 선택 · Esc 닫기 · 없으면 Insert로 등록</li>
                    </ul>
                  )}
                </div>
                <select
                  value={selectedCustomerId}
                  onChange={e => handleCustomerChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-800 font-medium focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- 거래처를 선택하세요 --</option>
                  {filteredCustomersList.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code}) {c.sites && c.sites.length > 0 ? `[현장 ${c.sites.length}곳]` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {slipType === 'ORDER' ? (
              <div>
                <label className="block font-bold text-rose-600 mb-1 text-xs">발송(현장) 주소 [필수]</label>
                <textarea
                  placeholder="공장/제조사에서 발송할 목적지 주소를 반드시 입력하세요."
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  className="w-full px-2 py-1.5 border-2 border-rose-300 rounded bg-rose-50 text-xs h-12"
                />
              </div>
            ) : (
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-xs">명세서 비고/메모</label>
                <input
                  type="text"
                  placeholder="간단한 메모 입력..."
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs"
                />
              </div>
            )}
          </div>

          {/* Card 2: 결제 및 금액 (Payment Info) */}
          <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg space-y-3">
            <h3 className="font-bold text-blue-900 text-xs flex items-center gap-1 border-b border-blue-200 pb-1.5">
              <span>결제 및 잔액 정보</span>
            </h3>
            <div className="text-xs space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">거래 전 외상미수금</label>
                <div className="px-2.5 py-1.5 border border-slate-200 rounded bg-white font-mono font-bold text-slate-700 text-right">
                  {formatKRW(prevReceivables)}
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">결제 방식</label>
                <select
                  value={paymentType}
                  onChange={e => setPaymentType(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-800 focus:ring-1 focus:ring-blue-500 mb-1.5"
                >
                  <option value="credit">외상 (미수누적)</option>
                  <option value="cash">현금 즉시결제</option>
                  <option value="card">카드 결제</option>
                  <option value="mixed">복합 결제</option>
                </select>
                {paymentType !== 'credit' && (
                  <input
                    type="number"
                    placeholder="입금액 입력"
                    value={paidAmount || ''}
                    onChange={e => setPaidAmount(Number(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-right font-mono text-blue-700 font-bold"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Progressive Disclosure: Site & Delivery (Accordion) */}
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white mb-2">
          <button
            type="button"
            onClick={() => setIsOptionsExpanded(!isOptionsExpanded)}
            className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700"
          >
            <div className="flex items-center gap-2">
              <Truck className={`w-4 h-4 ${needDelivery || selectedSiteId ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>공사현장 지정 및 출고/배송 오더 (선택)</span>
              {(selectedSiteId || needDelivery) && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">설정됨</span>
              )}
            </div>
            <span className="text-slate-400 font-mono text-[10px]">
              {isOptionsExpanded ? '▲ 접기' : '▼ 펼치기'}
            </span>
          </button>
          
          {isOptionsExpanded && (
            <div className="p-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50">
              {/* Site Selection */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-blue-900 flex items-center gap-1 text-xs">
                    <HardHat className="w-3.5 h-3.5 text-blue-600" />
                    <span>공사현장 (Site)</span>
                    {currentCustomer?.sites && currentCustomer.sites.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-200 text-blue-900 text-[10px] font-bold">
                        {currentCustomer.sites.length}
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickSiteModalOpen(true)}
                    className="text-[10px] font-bold text-blue-700 bg-white hover:bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded shadow-2xs"
                  >
                    + 새 현장
                  </button>
                </div>
                <div className="flex gap-1.5 mb-1.5">
                  <input
                    type="text"
                    placeholder="🔍 현장명/소장 검색..."
                    value={siteSearchFilter}
                    onChange={e => setSiteSearchFilter(e.target.value)}
                    className="w-full px-2 py-1 border border-blue-200 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500"
                  />
                  {siteSearchFilter && (
                    <button
                      type="button"
                      onClick={() => setSiteSearchFilter('')}
                      className="px-2 py-1 text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 rounded"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <select
                  value={selectedSiteId}
                  onChange={e => handleSiteSelect(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-blue-300 rounded bg-white text-blue-950 font-semibold focus:ring-1 focus:ring-blue-500 text-xs"
                >
                  <option value="">[본사 / 현장지정 없음]</option>
                  {filteredSitesList.map(st => (
                    <option key={st.id || st.siteCode} value={st.id || st.siteCode}>
                      {st.siteName} {st.manager ? `(${st.manager})` : ''}
                    </option>
                  ))}
                </select>
                {selectedSiteId && (
                  <div className="text-[11px] text-slate-500 bg-white p-2 border border-slate-200 rounded">
                    <div><strong>주소:</strong> {selectedSiteAddress || '-'}</div>
                    <div><strong>소장:</strong> {selectedSiteManager || '-'}</div>
                  </div>
                )}
              </div>

              {/* Delivery Toggle & Options */}
              <div className="space-y-3">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={needDelivery}
                    onChange={e => setNeedDelivery(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800 text-xs">
                    배송 / 출고 오더 생성
                  </span>
                </label>

                {needDelivery && (
                  <div className="space-y-2 text-xs bg-white p-2.5 border border-slate-200 rounded">
                    <div>
                      <label className="block text-slate-500 mb-0.5">배송지 주소</label>
                      <input
                        type="text"
                        value={deliveryAddress}
                        onChange={e => setDeliveryAddress(e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-500 mb-0.5">연락처</label>
                        <input
                          type="text"
                          value={deliveryTel}
                          onChange={e => setDeliveryTel(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-0.5">배송기사명</label>
                        <input
                          type="text"
                          value={driverName}
                          onChange={e => setDriverName(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* FarPoint Spread Grid Component */}
      <div className={`rounded-lg border shadow-xs overflow-hidden ${
        osTheme === 'winxp-retro'
          ? 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-xs text-slate-800">
              전표 상세 품목 그리드 (품목선택 &middot; 수량 &middot; 단가 자동연산)
            </span>
            <span className="text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
              {items.length}개 품목
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleAddRow}
              className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" /> 행 추가 (Ins)
            </button>
            <button type="button" onClick={() => setAssistModal('history')}
              className="px-2.5 py-1 text-xs font-semibold rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">거래내역 보기</button>
            <button type="button" onClick={() => setAssistModal('my')}
              className="px-2.5 py-1 text-xs font-semibold rounded border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100">My품목</button>
            {assistModal === 'history' && (
              <HistoryPicker slips={slips} customerId={selectedCustomerId} customerName={customers.find(c => c.id === selectedCustomerId)?.name || ''}
                onAdd={handleAddAssistItems} onClose={() => setAssistModal(null)} />
            )}
            {assistModal === 'my' && (
              <MyItemsPicker currentItem={items[Math.min(focusRow, items.length - 1)]} onAdd={handleAddAssistItems} onClose={() => setAssistModal(null)} />
            )}
          </div>
        </div>

        {/* Table Container - SaaS Style Spacious Grid */}
        <div className="overflow-x-auto" role="region" aria-label="전표 상세 품목 그리드">
          <table className="w-full text-left text-xs border-collapse font-sans" role="grid" aria-rowcount={items.length}>
            <thead role="rowgroup">
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 select-none whitespace-nowrap">
                <th className="py-3 px-3 w-10 text-center">NO</th>
                <th className="py-3 px-3 min-w-[200px]">품목 선택 / 검색</th>
                <th className="py-3 px-3 min-w-[140px]">규격 (Spec)</th>
                <th className="py-3 px-3 min-w-[70px] text-center">단위</th>
                <th className="py-3 px-3 min-w-[90px] text-right">수량</th>
                {slipType !== 'DELIVERY' && (
                  <>
                    <th className="py-3 px-3 min-w-[110px] text-right">단가</th>
                    <th className="py-3 px-3 min-w-[80px] text-right" title="협정가 기준 할인율(%). F4로 같은 품명 전체에 적용">할인율%</th>
                    <th className="py-3 px-3 min-w-[120px] text-right">공급가액</th>
                    <th className="py-3 px-3 min-w-[100px] text-right">세액</th>
                    <th className="py-3 px-3 min-w-[130px] text-right">합계금액</th>
                  </>
                )}
                <th className="py-3 px-3 min-w-[140px]">품목비고</th>
                <th className="py-3 px-3 min-w-[60px] text-center">삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white" role="rowgroup">
              {items.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  role="row"
                  aria-rowindex={idx + 1}
                  className="hover:bg-blue-50/30 transition-colors focus-within:bg-blue-50/50 whitespace-nowrap"
                >
                  <td className="py-3 px-3 text-center text-slate-400 font-mono">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveRowIndex(idx);
                        setProductSearchKeyword('');
                        setIsProductSearchOpen(true);
                      }}
                      className="w-full text-left py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-400 rounded-md font-medium text-slate-800 text-sm flex items-center justify-between group transition-all shadow-sm"
                      title="클릭하여 11,000+개 품목 중 빠른 검색 및 선택"
                    >
                      <div className="truncate flex-1 mr-1">
                        {row.productName ? (
                          <span className="font-bold text-slate-800">
                            {displayProductName(row.productName)}{' '}
                            <span className="text-slate-500 font-normal text-xs">[{row.spec}]</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic flex items-center gap-1">
                            <Search className="w-4 h-4 text-slate-400" />
                            품목 검색 / 선택 (클릭)
                          </span>
                        )}
                      </div>
                      <span className="px-2 py-1 bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-600 font-bold text-[10px] rounded transition-colors shrink-0">
                        🔍 검색 (F2)
                      </span>
                    </button>
                  </td>
                  <td className="py-3 px-3 text-slate-600 font-mono text-[11px] truncate max-w-[140px]">
                    {row.spec}
                  </td>
                  <td className="py-3 px-3 text-center text-slate-500 font-mono">
                    {row.unit}
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      min={1}
                      value={row.qty}
                      onFocus={() => setFocusRow(idx)}
                      onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                      className="w-full py-2 px-2 border border-slate-200 rounded-md text-right font-mono font-bold text-slate-800 focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  {slipType !== 'DELIVERY' && (
                    <>
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          value={row.unitPrice}
                          onFocus={() => setFocusRow(idx)}
                          step={priceDecimals ? Math.pow(10, -priceDecimals) : 1}
                          onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)}
                          className="w-full py-2 px-2 border border-slate-200 rounded-md text-right font-mono text-slate-800 focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          step="0.1"
                          value={row.discountRate ?? ''}
                          placeholder="-"
                          onFocus={() => setFocusRow(idx)}
                          onChange={e => handleItemChange(idx, 'discountRate', e.target.value)}
                          className="w-full py-2 px-2 border border-slate-200 rounded-md text-right font-mono text-slate-800 focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {row.supplyAmount.toLocaleString('ko-KR')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        {row.taxAmount.toLocaleString('ko-KR')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-blue-600 text-sm">
                        {row.totalAmount.toLocaleString('ko-KR')}
                      </td>
                    </>
                  )}
                  <td className="py-3 px-3">
                    <input
                      type="text"
                      placeholder="비고"
                      value={row.memo || ''}
                      onChange={e => handleItemChange(idx, 'memo', e.target.value)}
                      className="w-full py-2 px-2 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="행 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 하단 정보행 — 원본 전표작업 창 */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-px bg-slate-200 border-t border-slate-200 text-[11px]">
          {([
            ['최근매입가', rowInfo ? rowInfo.cost.toLocaleString('ko-KR') : '-'],
            ['판매단가', rowInfo ? rowInfo.sell.toLocaleString('ko-KR') : '-'],
            ['협정가', rowInfo ? rowInfo.agreed.toLocaleString('ko-KR') : '-'],
            ['이익률', rowInfo?.margin != null ? `${rowInfo.margin.toFixed(1)}%` : '-'],
            ['최근거래일', rowInfo?.last ? `${rowInfo.last.date}: ${rowInfo.last.price.toLocaleString('ko-KR')}` : '첫 거래'],
            ['단가변동일', rowInfo?.last && rowInfo.changedOn ? `${rowInfo.changedOn}: ${rowInfo.last.price.toLocaleString('ko-KR')}` : '-'],
            ['현재고', rowInfo ? rowInfo.stock.toLocaleString('ko-KR') : '-']
          ] as const).map(([k, v]) => (
            <div key={k} className="bg-white px-2 py-1 flex items-center justify-between gap-2"><span className="text-slate-500 font-semibold">{k}</span><span className="font-mono font-bold text-slate-800 truncate">{v}</span></div>
          ))}
        </div>

        {/* Totals & Transaction Summary Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            {slipType !== 'DELIVERY' ? (
              <>
                <div>
                  <span className="text-slate-500">공급가액: </span>
                  <strong className="font-mono text-slate-800 text-sm">
                    {totalSupplyAmount.toLocaleString('ko-KR')}원
                  </strong>
                </div>
                <div className="w-px h-3 bg-slate-300" />
                <div>
                  <span className="text-slate-500">부가세: </span>
                  <strong className="font-mono text-slate-800 text-sm">
                    {totalTaxAmount.toLocaleString('ko-KR')}원
                  </strong>
                </div>
                <div className="w-px h-3 bg-slate-300" />
                <div>
                  <span className="text-slate-500">전표 총액: </span>
                  <strong className="font-mono text-blue-700 text-base font-black">
                    {totalAmount.toLocaleString('ko-KR')}원
                  </strong>
                </div>
                <div className="w-px h-3 bg-slate-300" />
                <div className="bg-amber-50 border border-amber-200 px-2.5 py-1 rounded text-amber-900 font-medium">
                  거래 후 예상 미수잔액: <strong className="font-mono">{formatKRW(nextReceivables)}</strong>
                </div>
              </>
            ) : (
              <div className="text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 border border-emerald-200 rounded">
                ※ 납품명세서는 단가 및 금액이 노출되지 않습니다. (오직 수량만 기재)
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row w-full items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={(e) => handleExternalDispatch(e, 'FAX')}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 shadow-sm transition-colors"
              >
                📠 팩스
              </button>
              <button
                type="button"
                onClick={(e) => handleExternalDispatch(e, 'KAKAO')}
                className="px-3 py-1.5 rounded bg-[#FEE500] hover:bg-[#F4DC00] text-black font-bold text-xs flex items-center gap-1 shadow-sm transition-colors"
              >
                💬 카톡
              </button>
              <button
                type="button"
                onClick={(e) => handleExternalDispatch(e, 'EMAIL')}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 shadow-sm transition-colors"
              >
                ✉️ 이메일
              </button>
              <div className="w-px h-5 bg-slate-300 mx-1 hidden sm:block"></div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOpenPrintPreview();
                }}
                className="px-3 py-1.5 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center gap-1 shadow-sm transition-colors"
              >
                📄 PDF
              </button>
              <button
                type="button"
                onClick={handleDownloadExcel}
                className="px-3 py-1.5 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1 shadow-sm transition-colors"
              >
                📊 엑셀
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  handleOpenPrintPreview();
                }}
                className="px-3 py-1.5 text-xs font-bold rounded border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>명세서 출력</span>
              </button>
              <button
                type="button"
                onClick={handleResetForm}
                className="px-3 py-1.5 text-xs font-semibold rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>취소</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmitSlip}
                className="px-5 py-1.5 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>
                  {isSubmitting 
                    ? '저장 중...' 
                    : (editingSlipId ? '데이터 업데이트 저장 (F4)' : '신규 전표 저장 (F4)')
                  }
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

        </div>
      </div>

      {/* Quick Add Site Modal (from Slip Entry) */}
      {isQuickSiteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-md w-full p-4 text-xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <HardHat className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm">
                  [{currentCustomer?.name || '거래처'}] 신규 공사현장 등록
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickSiteModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3 space-y-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  공사현장명 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="예: 김포데이터센터 신축, 춘천레고랜드"
                  value={quickSiteInput.siteName}
                  onChange={e => setQuickSiteInput({ ...quickSiteInput, siteName: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs font-bold"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">현장 소장 / 담당자</label>
                  <input
                    type="text"
                    placeholder="예: 김소장"
                    value={quickSiteInput.manager}
                    onChange={e => setQuickSiteInput({ ...quickSiteInput, manager: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">현장 전화 / 모바일</label>
                  <input
                    type="text"
                    placeholder="010-0000-0000"
                    value={quickSiteInput.tel}
                    onChange={e => setQuickSiteInput({ ...quickSiteInput, tel: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">현장 납품지 주소</label>
                <input
                  type="text"
                  placeholder="직송 화물 기사에게 전달될 실제 현장 주소"
                  value={quickSiteInput.address}
                  onChange={e => setQuickSiteInput({ ...quickSiteInput, address: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">현장 특이사항 / 비고</label>
                <input
                  type="text"
                  placeholder="도착 전 소장님께 전화 필수 등"
                  value={quickSiteInput.memo}
                  onChange={e => setQuickSiteInput({ ...quickSiteInput, memo: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsQuickSiteModalOpen(false)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleQuickAddSite}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>등록 및 전표에 지정</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fast Product Search & Select Modal (Optimized for 11,000+ Products) */}
      {refDialog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={e => { e.preventDefault(); const v = refDialog; setRefDialog(null); handleOpenPrintPreview(v); }}
            onKeyDown={e => { if (e.key === 'Escape') setRefDialog(null); }}
            className="bg-white rounded-lg border shadow-xl max-w-md w-full p-4 text-xs space-y-3"
          >
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="font-bold text-sm text-slate-800">견적서 비고 입력</h3>
              <button type="button" onClick={() => setRefDialog(null)}><X className="w-4 h-4" /></button>
            </div>
            {refDialog.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <label className="w-12 font-semibold text-slate-600">참조{i + 1}</label>
                <input autoFocus={i === 0} value={v} onChange={e => setRefDialog(refDialog.map((x, j) => (j === i ? e.target.value : x)))} className="flex-1 px-2.5 py-1.5 border rounded bg-white" />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setRefDialog(null)} className="px-3 py-1.5 rounded border">종료 (Esc)</button>
              <button type="submit" className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold">확인 (Enter)</button>
            </div>
          </form>
        </div>
      )}

      {quickCust && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={submitQuickCust} className="bg-white rounded-lg border shadow-xl max-w-sm w-full p-4 text-xs space-y-3" onKeyDown={e => { if (e.key === 'Escape') setQuickCust(null); }}>
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="font-bold text-sm text-slate-800">거래처 바로 등록</h3>
              <button type="button" onClick={() => setQuickCust(null)}><X className="w-4 h-4" /></button>
            </div>
            <p className="text-slate-500">나머지 정보는 거래처관리에서 나중에 채워도 됩니다.</p>
            {([['거래처명', 'name', true], ['사업자번호', 'bizNumber', false], ['대표자', 'ceo', false], ['전화', 'tel', false]] as const).map(([label, key, req]) => (
              <div key={key}>
                <label className="block font-semibold mb-1">{label}</label>
                <input autoFocus={key === 'name'} required={req} value={quickCust[key]} onChange={e => setQuickCust({ ...quickCust, [key]: e.target.value })} className="w-full px-2.5 py-1.5 border rounded bg-white" />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setQuickCust(null)} className="px-3 py-1.5 rounded border">취소 (Esc)</button>
              <button type="submit" className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold">등록하고 선택</button>
            </div>
          </form>
        </div>
      )}

      {isProductSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-bold text-sm">
                    품목 빠른 검색 및 전표 반영
                  </h3>
                  <p className="text-[11px] text-blue-100">
                    전체 {products.length.toLocaleString()}개 품목 데이터베이스 실시간 연동
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProductSearchOpen(false)}
                className="p-1 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Filter Bar */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="품목명, 규격, 코드, 바코드(스캐너로 읽고 Enter)..."
                  value={productSearchKeyword}
                  onChange={e => setProductSearchKeyword(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { applyModalQty(); setIsProductSearchOpen(false); }
                    if (e.key === 'Enter' && searchResults.length > 0 && !Object.values(modalQty).some(v => Number(v) > 0)) {
                      handleItemChange(activeRowIndex !== null ? activeRowIndex : 0, 'productId', searchResults[0].id);
                      setIsProductSearchOpen(false);
                    }
                  }}
                  className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                {productSearchKeyword && (
                  <button
                    type="button"
                    onClick={() => setProductSearchKeyword('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
              <span className="text-[11px] text-slate-500 font-mono px-2 py-1 bg-white border border-slate-200 rounded shrink-0">
                {searchResults.length}건
              </span>
            </div>

            {/* Results Table */}
            <div className="flex-1 overflow-y-auto p-2">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-2 px-2.5 w-20">코드</th>
                    <th className="py-2 px-2.5">품목명</th>
                    <th className="py-2 px-2.5">규격 (Spec)</th>
                    <th className="py-2 px-2 text-center w-14">단위</th>
                    <th className="py-2 px-2.5 text-right w-24">재고</th>
                    <th className="py-2 px-2.5 text-right w-28">출고단가</th>
                    <th className="py-2 px-2 text-center w-20">수량</th>
                    <th className="py-2 px-2.5 text-center w-20">선택</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {searchResults.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        &quot;{productSearchKeyword}&quot;에 일치하는 품목이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    searchResults.map(p => (
                      <tr
                        key={p.id}
                        onClick={() => {
                          if (activeRowIndex !== null) {
                            handleItemChange(activeRowIndex, 'productId', p.id);
                          }
                          setIsProductSearchOpen(false);
                        }}
                        className="hover:bg-blue-50 cursor-pointer transition-colors group"
                      >
                        <td className="py-2 px-2.5 font-mono text-slate-500 font-semibold">{p.code}</td>
                        <td className="py-2 px-2.5 font-bold text-slate-900 group-hover:text-blue-700">{p.name}</td>
                        <td className="py-2 px-2.5 text-slate-600 font-mono text-[11px]">{p.spec}</td>
                        <td className="py-2 px-2 text-center text-slate-500">{p.unit}</td>
                        <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-700">
                          {p.currentStock.toLocaleString()}{p.unit}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-bold text-blue-700">
                          {p.sellingPrice.toLocaleString()}원
                        </td>
                        <td className="py-2 px-2 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="number"
                            min={0}
                            value={modalQty[p.id] ?? ''}
                            onChange={e => setModalQty(q => ({ ...q, [p.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Escape') { applyModalQty(); setIsProductSearchOpen(false); } }}
                            placeholder="수량"
                            className="w-16 py-1 px-1.5 border border-slate-300 rounded text-right font-mono text-xs focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              if (activeRowIndex !== null) {
                                handleItemChange(activeRowIndex, 'productId', p.id);
                              }
                              setIsProductSearchOpen(false);
                            }}
                            className="px-2.5 py-1 bg-blue-600 group-hover:bg-blue-700 text-white rounded font-bold text-[11px] shadow-2xs"
                          >
                            선택
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <span>
                💡 규격마다 수량을 넣고 Esc(또는 «담기»)를 누르면 한꺼번에 담깁니다. 수량 없이 Enter는 첫 품목 선택.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!Object.values(modalQty).some(v => Number(v) > 0)}
                  onClick={() => { if (applyModalQty()) setIsProductSearchOpen(false); }}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-40"
                >
                  수량 입력한 규격 담기 (Esc)
                </button>
                <button
                  type="button"
                  onClick={() => { setModalQty({}); setIsProductSearchOpen(false); }}
                  className="px-4 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 font-semibold text-slate-700"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {dispatchModal.isOpen && dispatchModal.channel && (
        <div className="fixed inset-0 z-[150] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5 border border-slate-200">
            <h3 className="font-bold text-lg mb-4 text-slate-800 border-b pb-2">
              {dispatchModal.channel === 'EMAIL' ? '✉️ 이메일 전송' : 
               dispatchModal.channel === 'KAKAO' ? '💬 카카오톡 전송' : '📠 팩스 전송'}
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                {dispatchModal.channel === 'EMAIL' ? '받는 사람 이메일' : '받는 사람 연락처'}
              </label>
              <input
                type={dispatchModal.channel === 'EMAIL' ? 'email' : 'text'}
                className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500"
                value={dispatchModal.contact}
                onChange={(e) => setDispatchModal(prev => ({ ...prev, contact: e.target.value }))}
                placeholder={dispatchModal.channel === 'EMAIL' ? 'example@email.com' : '010-0000-0000'}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmExternalDispatch();
                }}
              />
              <p className="text-xs text-slate-500 mt-2">
                실제 전송 테스트를 원하시면 본인의 연락처/이메일을 입력 후 발송해보세요.
              </p>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDispatchModal({ isOpen: false, channel: null, contact: '' })}
                className="px-4 py-2 border border-slate-300 rounded text-slate-700 font-medium text-sm hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmExternalDispatch}
                className="px-4 py-2 bg-blue-600 text-white rounded font-bold text-sm hover:bg-blue-700 shadow-sm"
              >
                발송하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
