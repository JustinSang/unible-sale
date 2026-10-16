'use client';

import { displayProductName } from '@/lib/productName';
import { BRAND } from '@/lib/brand';
import { OriginalSlipForm } from './OriginalSlipForm';
import { OriginalFormReport } from './OriginalFormReport';
import { SlipOriginalForm } from './SlipOriginalForm';
import { RptReportPages, type RptRow } from './RptReportPrint';
import { normSlipType } from '@/lib/slipType';
import React, { useState } from 'react';
import { Printer, X, FileText, Receipt } from 'lucide-react';
import type { Slip, SystemConfig, Customer } from '@/types';

interface PrintModalProps {
  slip: Slip | null;
  config: SystemConfig;
  customer?: Customer;
  customers?: Customer[];
  isOpen: boolean;
  onDispatched?: (slipId: string, status: any) => void; // 발송 성공을 화면 목록에 반영
  onClose: () => void;
}

// 이관 데이터에는 원본 입력 마스크(«___-__-_____»·«_011)492_-7864»)가 그대로 들어 있다 — 숫자가 없으면 빈칸, 있으면 밑줄만 뺀다.
const cleanMask = (v?: string) => (v && /\d/.test(v) ? v.replace(/_/g, '').trim() : '');

export function PrintModal({ slip: slipProp, config, customer: customerProp, customers = [], isOpen, onClose, onDispatched }: PrintModalProps) {
  // 이관 전표는 유형 표기가 'sales'·'return_sales'처럼 섞여 있어 표준형(SALES·RETURN_IN…)으로 맞춘 뒤 쓴다.
  const slip = slipProp ? { ...slipProp, slipType: normSlipType(slipProp.slipType) } : slipProp;
  const customer = customerProp ? { ...customerProp, bizNumber: cleanMask(customerProp.bizNumber), tel: cleanMask(customerProp.tel), mobile: cleanMask(customerProp.mobile), fax: cleanMask(customerProp.fax) } : customerProp;
  const [printType, setPrintType] = useState<'statement' | 'receipt' | 'original' | 'request' | 'misc'>('statement');
  const [miscKey, setMiscKey] = useState<string>('rptSlipStatus');
  const [slipCopies, setSlipCopies] = useState<'both' | 'recipient' | 'supplier'>('both'); // 원본 양식(2단): 두 벌(인쇄) / 받는 쪽 한 벌(팩스) / 보관용 한 벌
  const [dispatchStatus, setDispatchStatus] = useState<'IDLE'|'SENDING'|'SUCCESS'|'FAIL'>('IDLE');
  // Inline toast notification — replaces all alert() calls to prevent
  // browser focus event → React re-render → modal disappearing in 0.1s
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

  if (!isOpen || !slip) return null;

  const handleDispatch = (channel: 'FAX' | 'KAKAO' | 'EMAIL') => {
    let defaultContact = '';
    if (channel === 'EMAIL') defaultContact = customer?.email || '';
    if (channel === 'FAX') defaultContact = customer?.fax || customer?.tel || customer?.mobile || ''; // 팩스는 팩스 번호 칸을 먼저
    if (channel === 'KAKAO') defaultContact = customer?.tel || customer?.mobile || '';
    
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
    if (channel === 'FAX' && contact.replace(/\D/g, '').length < 8) {
      showToast('팩스 번호가 너무 짧습니다. 지역번호까지 입력해 주세요.', 'error');
      return;
    }

    setDispatchModal(prev => ({ ...prev, isOpen: false }));
    setDispatchStatus('SENDING');
    
    try {
      let fileBase64 = undefined;

      // FAX의 경우 화면을 캡처하여 PDF Base64 생성
      if (channel === 'FAX') {
        showToast('⏳ 팩스 전송을 위해 PDF를 생성 중입니다...', 'info', 5000);
        // 팩스는 어느 탭에서 눌러도 «원본 양식의 받는 쪽 한 벌»(공급받는자 보관용)만 벡터 PDF로 보낸다 — 우리 보관용은 보내지 않는다(예전 팩스 방식).
        const { createPdfBuilder, finishPdf, bytesToBase64 } = await import('@/lib/pdfExport');
        const { appendReactPages } = await import('@/lib/pdfOffscreen');
        const b = await createPdfBuilder();
        await appendReactPages(b, <SlipOriginalForm slip={slip} config={config} customer={customer} copies="recipient" />);
        fileBase64 = bytesToBase64(await finishPdf(b));
      }

      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slipId: slip.id,
          channel,
          targetContact: contact.trim(),
          fileBase64
        })
      });
      const data = await res.json();
      if (data.success) {
        setDispatchStatus('SUCCESS');
        if (data.dispatchStatus) onDispatched?.(slip.id, data.dispatchStatus); // 서버가 저장한 발송 이력을 목록에 반영
        const channelLabel = channel === 'FAX' ? '팩스' : channel === 'KAKAO' ? '카카오톡' : '이메일';
        showToast(`✅ ${channelLabel} 발송 성공: ${data.message || '요청이 접수되었습니다.'}`, 'success', 5000);
      } else {
        setDispatchStatus('FAIL');
        showToast(`❌ 전송 실패: ${data.error}`, 'error', 5000);
      }
    } catch (e) {
      setDispatchStatus('FAIL');
      showToast('❌ 네트워크 오류가 발생했습니다.', 'error', 5000);
    }
  };

  // 원본 양식 탭(좌표 복원 양식)은 비트맵이 아니라 «벡터 PDF»(글자 선명·용량 작음·여러 쪽)로 만든다.
  const handleVectorPdf = async (pages: HTMLElement[]) => {
    const KINDS: Record<string, string> = { SALES: '매출', PURCHASE: '매입', RETURN_IN: '반입', RETURN_OUT: '반출', ESTIMATE: '견적', ORDER: '발주', DELIVERY: '납품', CONTRACT: '수주' };
    const { askSaveHandle, safeName, createPdfBuilder, appendDomPage, finishPdf, savePdfBytes } = await import('@/lib/pdfExport');
    const copyTag = printType === 'original' && slip.slipType !== 'ESTIMATE' && slip.slipType !== 'ORDER' ? (slipCopies === 'recipient' ? '_팩스용' : slipCopies === 'supplier' ? '_보관용' : '') : '';
    const name = `${safeName(`${slip.slipNo}_${slip.customerName}_${KINDS[slip.slipType] || '전표'}${copyTag}`)}.pdf`;
    const handle = await askSaveHandle(name);
    if (handle === null) { showToast('ℹ️ 저장이 취소되었습니다.', 'info'); return; }
    showToast('⏳ PDF를 만드는 중입니다...', 'info', 8000);
    const b = await createPdfBuilder();
    for (const pg of pages) await appendDomPage(b, pg);
    const bytes = await finishPdf(b);
    await savePdfBytes(bytes, name, handle);
    showToast(`✅ PDF ${b.pageCount}쪽을 저장했습니다 (${Math.round(bytes.length / 1024)}KB).`, 'success');
  };

  // 거래명세표(A4)·80mm 영수증: 화면 배치(흐름)를 읽어 벡터 PDF로. 실패하면 아래 비트맵 방식으로 넘어간다.
  const handleFlowPdf = async (paper: HTMLElement, ctx: { handle?: any }) => {
    const { askSaveHandle, safeName, createPdfBuilder, appendFlowPages, finishPdf, savePdfBytes } = await import('@/lib/pdfExport');
    const name = `${safeName(`명세서_${slip.slipNo || '문서'}_${slip.customerName}${printType === 'receipt' ? '_영수증' : ''}`)}.pdf`;
    const handle = await askSaveHandle(name);
    if (handle === null) { showToast('ℹ️ 저장이 취소되었습니다.', 'info'); return true; }
    ctx.handle = handle; // 실패해 비트맵 방식으로 넘어가도 저장 창을 다시 띄우지 않는다
    showToast('⏳ PDF를 만드는 중입니다...', 'info', 8000);
    const b = await createPdfBuilder();
    await appendFlowPages(b, paper, printType === 'receipt' ? { pageWidthMm: 80, marginMm: 0 } : { pageWidthMm: 210, pageHeightMm: 297, marginMm: 0 });
    const bytes = await finishPdf(b);
    await savePdfBytes(bytes, name, handle);
    showToast(`✅ PDF ${b.pageCount}쪽을 저장했습니다 (${Math.round(bytes.length / 1024)}KB).`, 'success');
    return true;
  };

  const handleDownloadPDF = async () => {
    try {
      const element = document.getElementById('pdf-printable-area');
      if (!element) return;
      const vectorPages = Array.from(element.querySelectorAll<HTMLElement>('[data-pdf-page]'));
      if (vectorPages.length > 0) { await handleVectorPdf(vectorPages); return; }
      const paper = element.firstElementChild as HTMLElement | null;
      const flowCtx: { handle?: any } = {};
      if ((printType === 'statement' || printType === 'receipt') && paper) {
        try { if (await handleFlowPdf(paper, flowCtx)) return; } catch (e) { console.error('벡터 PDF 실패 — 비트맵 방식으로 대신합니다', e); }
      }
      
      const suggestedName = `명세서_${slip.slipNo || '문서'}.pdf`;
      let handle = flowCtx.handle ?? null;
      
      // Request file handle FIRST to maintain user gesture
      if (!flowCtx.handle && (window as any).showSaveFilePicker) {
        try {
          handle = await (window as any).showSaveFilePicker({
            suggestedName,
            types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }]
          });
        } catch (err: any) {
          if (err.name === 'AbortError') {
             showToast('ℹ️ 저장이 취소되었습니다.', 'info');
             return;
          }
          throw err;
        }
      }
      
      showToast('⏳ PDF 변환을 시작합니다... 잠시만 기다려주세요.', 'info', 10000);
      
      const scrollWrapper = element.parentElement;
      const originalOverflow = scrollWrapper!.style.overflow;
      const originalHeight = scrollWrapper!.style.height;
      scrollWrapper!.style.overflow = 'visible';
      scrollWrapper!.style.height = 'auto';

      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
      const canvas = await html2canvas(element, { scale: 2, scrollY: -window.scrollY });
      
      scrollWrapper!.style.overflow = originalOverflow;
      scrollWrapper!.style.height = originalHeight;
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // 화면이 한 쪽보다 길면 여러 쪽으로 나눈다(예전에는 한 쪽에 넘치는 부분이 잘렸다).
      const pageH = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      let rest = pdfHeight - pageH, offY = 0;
      while (rest > 1) { offY -= pageH; pdf.addPage(); pdf.addImage(imgData, 'PNG', 0, offY, pdfWidth, pdfHeight); rest -= pageH; }

      if (handle) {
        const blob = pdf.output('blob');
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        showToast('✅ PDF 파일이 지정된 위치에 저장되었습니다.', 'success');
      } else {
        pdf.save(suggestedName);
        showToast('✅ PDF 파일이 다운로드되었습니다.', 'success');
      }
    } catch (e) {
      showToast('❌ PDF 변환 중 오류가 발생했습니다.', 'error');
      console.error(e);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      if (!slip || !slip.items) return;
      const suggestedName = `전표_${slip.slipNo || '문서'}.xlsx`;
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
          throw err;
        }
      }

      showToast('⏳ 엑셀 파일을 생성하는 중입니다...', 'info');
      if (slip.slipType === 'DELIVERY') {
        const ExcelJS = (await import('exceljs')).default || await import('exceljs');
        const response = await fetch('/templates/delivery_template.xlsx');
        if (!response.ok) throw new Error('템플릿 파일을 찾을 수 없습니다.');
        const arrayBuffer = await response.arrayBuffer();
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const ws = workbook.worksheets[0];
        
        ws.getCell('B2').value = `거래일자: ${slip.slipDate}                거래명세서(납품)`;
        
        // 공급받는자
        ws.getCell('J4').value = ` ${slip.customerName}${slip.siteName ? ` [현장: ${slip.siteName}]` : ''}`;
        ws.getCell('J5').value = customer?.ceo ? ` ${customer.ceo}` : '';
        ws.getCell('J6').value = customer?.bizNumber ? ` ${customer.bizNumber}` : '';
        ws.getCell('J7').value = ` ${(slip.siteAddress || customer?.address || '')}${slip.siteManager ? ` (소장: ${slip.siteManager})` : ''}`;
        ws.getCell('J8').value = customer?.email ? ` ${customer.email}` : '';
        ws.getCell('J9').value = (customer?.tel || customer?.mobile) ? ` ${customer?.tel || customer?.mobile}` : '';
        
        // Items
        slip.items.forEach((item, idx) => {
          if (idx >= 15) return; // Template only supports up to 15 items
          const row = 11 + idx;
          ws.getCell(`B${row}`).value = idx + 1;
          ws.getCell(`C${row}`).value = displayProductName(item.productName);
          ws.getCell(`E${row}`).value = item.spec;
          ws.getCell(`F${row}`).value = item.qty;
          ws.getCell(`G${row}`).value = item.unit;
          ws.getCell(`H${row}`).value = item.unitPrice || '';
          ws.getCell(`J${row}`).value = item.supplyAmount || '';
          ws.getCell(`K${row}`).value = item.memo || '';
        });
        
        // Memo
        ws.getCell('C19').value = slip.memo || '';

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        if (handle) {
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          showToast('✅ 납품명세서 엑셀 파일이 지정된 위치에 저장되었습니다.', 'success');
        } else {
          // Fallback if no FilePicker
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = suggestedName;
          a.click();
          window.URL.revokeObjectURL(url);
          showToast('✅ 납품명세서 엑셀 파일이 다운로드되었습니다.', 'success');
        }
        return;
      }

      const XLSX = await import('xlsx');
      
      const wsData = slip.items.map((item, idx) => ({
        'No': idx + 1,
        '품목명': displayProductName(item.productName),
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
      showToast('❌ 엑셀 변환 중 오류가 발생했습니다.', 'error');
      console.error(e);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatKRW = (num: number) => num.toLocaleString('ko-KR') + '원';

  const getDocumentTitle = () => {
    switch (slip.slipType) {
      case 'ORDER': return '發 注 書 (발주서)';
      case 'ESTIMATE': return '견 적 서';
      case 'CONTRACT': return '수 주 서';
      case 'DELIVERY': return '거 래 명 세 표 (납 품)';
      case 'PURCHASE': return '매 입 명 세 표';
      case 'RETURN_IN': return '반 입 명 세 표';
      case 'RETURN_OUT': return '반 출 명 세 표';
      case 'SALES':
      default:
        return '거 래 명 세 표';
    }
  };

  const isQuote = slip.slipType === 'ESTIMATE' || slip.slipType === 'CONTRACT';
  const isInbound = slip.slipType === 'PURCHASE' || slip.slipType === 'RETURN_IN'; // 거래처가 보내고 우리가 받는 전표
  const ci = config.companyInfo;
  const ownParty = { own: true, name: ci.name, ceo: ci.ceo, bizNumber: ci.bizNumber, address: ci.address, bizType: ci.bizType, bizItem: ci.bizItem, tel: ci.tel, site: '', manager: '' };
  const custParty = { own: false, name: slip.customerName, ceo: customer?.ceo || '', bizNumber: customer?.bizNumber || '', address: slip.siteAddress || customer?.address || '', bizType: customer?.bizType || '', bizItem: customer?.bizItem || '', tel: customer?.tel || customer?.mobile || '', site: slip.siteName || '', manager: slip.siteManager || '' };
  const hidePriceColumns = slip.slipType === 'DELIVERY' || slip.slipType === 'ORDER';

  // Number to Korean currency text converter
  const numberToKorean = (number: number): string => {
    if (number === 0) return '영';
    const units = ['', '만', '억', '조'];
    const smallUnits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    const posUnits = ['', '십', '백', '천'];

    let numStr = number.toString();
    let result = '';
    let unitIdx = 0;

    while (numStr.length > 0) {
      const chunk = numStr.slice(-4);
      numStr = numStr.slice(0, -4);
      let chunkStr = '';

      for (let i = 0; i < chunk.length; i++) {
        const digit = parseInt(chunk[chunk.length - 1 - i], 10);
        if (digit > 0) {
          chunkStr = smallUnits[digit] + posUnits[i] + chunkStr;
        }
      }

      if (chunkStr) {
        result = chunkStr + units[unitIdx] + ' ' + result;
      }
      unitIdx++;
    }

    return '일금 ' + result.trim() + '원정';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full my-auto flex flex-col max-h-[95vh] print:m-0 print:p-0 print:w-full print:max-w-none print:shadow-none print:border-none print:block print:h-auto print:max-h-none print:static">
        {/* Modal Header (Hidden during actual print) */}
        <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-lg print:hidden">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Printer className="w-4 h-4 text-blue-600" />
              <span>전표 문서 인쇄 미리보기 [{slip.slipNo}]</span>
            </h3>

            {/* Print Form Switcher */}
            <div className="flex rounded border border-slate-200 overflow-hidden text-xs bg-white">
              <button
                onClick={() => setPrintType('statement')}
                className={`px-3 py-1 flex items-center gap-1 font-semibold ${
                  printType === 'statement'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>거래명세표 (A4)</span>
              </button>
              <button
                onClick={() => setPrintType('original')}
                className={`px-3 py-1 flex items-center gap-1 font-semibold ${
                  printType === 'original'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>원본 양식</span>
              </button>
              {(slip.slipType === 'ORDER' || slip.slipType === 'ESTIMATE') && (
                <button
                  onClick={() => setPrintType('request')}
                  className={`px-3 py-1 flex items-center gap-1 font-semibold ${
                    printType === 'request'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>견적의뢰서 (원본)</span>
                </button>
              )}
              <select
                value={printType === 'misc' ? miscKey : ''}
                onChange={e => { if (e.target.value) { setMiscKey(e.target.value); setPrintType('misc'); } }}
                className={`px-2 py-1 text-xs font-semibold border-l border-slate-200 ${printType === 'misc' ? 'bg-blue-600 text-white' : 'text-slate-600 bg-white'}`}
              >
                <option value="">기타 원본 양식 ▾</option>
                <option value="rptSlipStatus">전표 선인쇄 용지용 (rptSlipStatus·원본 미완성)</option>
                {(slip.slipType === 'ESTIMATE' || slip.slipType === 'ORDER') && <option value="Estimate111">견적서 변형 (Estimate111)</option>}
                {(slip.slipType === 'ESTIMATE' || slip.slipType === 'ORDER') && <option value="Estimate02">견적서 가로 (Estimate02·공급자 칸 비어 있음)</option>}
                {(slip.slipType === 'ESTIMATE' || slip.slipType === 'ORDER') && <option value="DemandEstimate">견적의뢰서 머리글만 (DemandEstimate)</option>}
              </select>
              {printType === 'original' && slip.slipType !== 'ESTIMATE' && slip.slipType !== 'ORDER' && (
                <select
                  value={slipCopies}
                  onChange={e => setSlipCopies(e.target.value as 'both' | 'recipient' | 'supplier')}
                  className="px-2 py-1 text-xs font-semibold border-l border-slate-200 bg-amber-50 text-amber-800"
                  title="원본 양식은 한 쪽에 위(공급자 보관용)·아래(공급받는자 보관용) 두 벌입니다. 팩스로 보낼 때는 받는 쪽 한 벌만 내보냅니다."
                >
                  <option value="both">두 벌 (인쇄·보관용)</option>
                  <option value="recipient">받는 쪽 한 벌 (팩스용)</option>
                  <option value="supplier">우리 보관용 한 벌</option>
                </select>
              )}
              <button
                onClick={() => setPrintType('receipt')}
                className={`px-3 py-1 flex items-center gap-1 font-semibold ${
                  printType === 'receipt'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>80mm 영수증</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>인쇄 (Ctrl+P)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-neutral-100/50 flex justify-center print:bg-white print:p-0 print:overflow-visible print:block print:h-auto print:static">
          <div id="pdf-printable-area" className="flex justify-center w-full">
          {printType === 'misc' ? (
            (() => {
              const total = slip.totalAmount || 0;
              const won = (n: number) => Math.round(n || 0).toLocaleString('ko-KR');
              const items = slip.items || [];
              const remarks = (slip.memo || '').split(/\n| \/ (?=\[)/).map(t => t.replace(/^\[참조사항\]\s*/, '').trim()).filter(t => t && !/^\[현장:[^\]]*\]$/.test(t));
              if (miscKey === 'rptSlipStatus') {
                const rec: RptRow = {};
                items.slice(0, 16).forEach((it, i) => { const n = i + 1; rec[`ProductsName${n}`] = it.productName; rec[`Standard${n}`] = it.spec; rec[`Unit${n}`] = it.unit; rec[`Qty${n}`] = it.qty; rec[`Price${n}`] = it.unitPrice; rec[`Amount${n}`] = it.supplyAmount; });
                const params = { 날짜: slip.slipDate, 사업자번호: customer?.bizNumber || '', 상호: slip.customerName, 성명: customer?.ceo || '', 주소: slip.siteAddress || customer?.address || '', 주소1: '', 업태: customer?.bizType || '', 종목: customer?.bizItem || '', 소제목: slip.siteName || '', 공급가액: won(slip.totalSupplyAmount), 부가세: won(slip.totalTaxAmount), 합계금액: won(total), 레코드번호: slip.slipNo, 페이지번호: '1' };
                return <>{items.length > 16 && <p className="text-xs text-amber-700 mb-2">품목이 16줄을 넘어 앞 16줄만 찍습니다(원본 선인쇄 용지는 한 장에 16줄).</p>}<RptReportPages layoutKey="rptSlipStatus" rows={[rec]} params={params} single /></>;
              }
              const params = { UserTelNo: ci.tel || '', UserBusinessStatus: ci.bizType || '', UserBusinessType: ci.bizItem || '', UserFaxNo: ci.fax || '', UserAddress: ci.address || '', UserOwnerName: ci.ceo || '', UserTaxNo: ci.bizNumber || '', UserCompanyName: ci.name, CustomerName: slip.customerName, SlipDate: slip.slipDate, SiteName: slip.siteName || '', HeaderTotal: `${numberToKorean(total)} (₩${won(total)})`, FooterTotal: `합계 ₩${won(total)}`, Remark1: remarks[0] || '', Remark2: remarks[1] || '', Remark3: remarks[2] || '', Remark4: remarks[3] || '', Comments: '' };
              const rows: RptRow[] = items.map(it => ({ ProductName: it.productName, Spec: it.spec, Unit: it.unit, Qty: it.qty, Price: it.unitPrice, Amount: it.supplyAmount }));
              return <RptReportPages layoutKey={miscKey} rows={miscKey === 'DemandEstimate' ? [] : rows} params={params} />;
            })()
          ) : printType === 'request' ? (
            <OriginalFormReport
              slip={slip}
              kind="request"
              own={{ name: ci.name, ceo: ci.ceo, bizNumber: ci.bizNumber, address: ci.address, tel: ci.tel, fax: ci.fax, bizType: ci.bizType, bizItem: ci.bizItem }}
              counterpart={slip.customerName}
              seal={BRAND.seal}
            />
          ) : printType === 'original' ? (
            slip.slipType === 'ESTIMATE' || slip.slipType === 'ORDER' ? (
            <OriginalFormReport
              slip={slip}
              kind={slip.slipType === 'ESTIMATE' ? 'estimate' : 'order'}
              own={{ name: ci.name, ceo: ci.ceo, bizNumber: ci.bizNumber, address: ci.address, tel: ci.tel, fax: ci.fax, bizType: ci.bizType, bizItem: ci.bizItem }}
              counterpart={slip.customerName}
              seal={BRAND.seal}
            />
            ) : (
            <OriginalSlipForm
              slip={slip}
              supplier={isInbound ? custParty : ownParty}
              buyer={isInbound ? ownParty : custParty}
              kindLabel={({ SALES: '매출', PURCHASE: '매입', RETURN_IN: '반입', RETURN_OUT: '반출', ESTIMATE: '견적', ORDER: '발주', DELIVERY: '납품', CONTRACT: '수주' } as Record<string, string>)[slip.slipType] || ''}
              seal={isInbound ? '' : BRAND.seal}
              prevBalance={slip.prevReceivables}
              showPrev={slip.showPrevBalance !== false}
              copies={slipCopies}
            />
            )
          ) : slip.slipType === 'ORDER' ? (
            /* Order (발주서) Layout matching the requested image */
            <div className="w-[210mm] min-h-[297mm] bg-white p-8 shadow-sm border border-slate-300 print:border-none print:shadow-none print:p-0 print:w-full text-slate-900 text-[12px] font-sans">
              {/* Title */}
              <div className="text-center pb-6">
                <h1 className="text-3xl font-serif tracking-[1em] text-slate-900 inline-block border-b-[1.5px] border-slate-900 pb-2 px-12">
                  發 注 書
                </h1>
              </div>

              {/* Header Section */}
              <div className="flex justify-between items-stretch mt-2 border border-slate-900 p-0">
                {/* Left Box */}
                <div className="flex-1 p-3 flex flex-col justify-end text-[11px]">
                  <div className="flex items-end mb-2">
                    <span className="w-10">No. :</span>
                    <span className="flex-1 border-b border-slate-900 ml-2"></span>
                  </div>
                  <div className="flex items-end mb-2">
                    <span className="w-10 whitespace-nowrap">일자 :</span>
                    <span className="flex-1 border-b border-slate-900 ml-2 font-mono">{slip.slipDate}</span>
                  </div>
                  <div className="flex items-end mb-4">
                    <span className="flex-1 border-b border-slate-900 text-center text-lg font-bold pb-1">{slip.customerName}</span>
                    <span className="ml-2 font-bold mb-1">貴中</span>
                  </div>
                  <div className="mb-2 flex items-start">
                    <span className="w-10">참조 :</span>
                    <span className="flex-1 border-b border-slate-900 ml-2 h-4"></span>
                  </div>
                  <div className="text-center font-bold text-[13px] tracking-wide mt-2">
                    下記와 같이 發注 하나이다.
                  </div>
                </div>

                {/* Right Box (발주자) */}
                <div className="w-[320px] border-l border-slate-900 flex text-[11px]">
                  <div className="w-8 flex items-center justify-center border-r border-slate-900">
                    <span className="font-bold tracking-[0.5em] text-[13px]" style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>
                      발 주 자
                    </span>
                  </div>
                  <div className="flex-1">
                    <table className="w-full h-full leading-snug table-fixed text-[11px]">
                      <tbody>
                        <tr className="border-b border-slate-900">
                          <td className="w-[60px] border-r border-slate-900 p-1 text-center font-medium">사업번호</td>
                          <td colSpan={2} className="p-1 text-center font-mono font-bold text-[14px] tracking-wider">{config.companyInfo.bizNumber}</td>
                        </tr>
                        <tr className="border-b border-slate-900">
                          <td className="w-[60px] border-r border-slate-900 p-1 text-center font-medium">상 &nbsp; 호</td>
                          <td className="p-1 text-center font-bold text-[13px]">{config.companyInfo.name}</td>
                          <td className="w-[70px] border-l border-slate-900 p-1 text-center text-[12px] relative">{config.companyInfo.ceo}{BRAND.seal && <img src={BRAND.seal} alt="인" className="absolute right-0 top-1/2 -translate-y-1/2 w-7 h-7 mix-blend-multiply" />}</td>
                        </tr>
                        <tr className="border-b border-slate-900">
                          <td className="w-[60px] border-r border-slate-900 p-1 text-center font-medium">주 &nbsp; 소</td>
                          <td colSpan={2} className="p-1 px-1 text-center break-keep leading-tight">{config.companyInfo.address}</td>
                        </tr>
                        <tr className="border-b border-slate-900">
                          <td className="w-[60px] border-r border-slate-900 p-1 text-center font-medium">Tel,Fax</td>
                          <td colSpan={2} className="p-1 text-center font-mono tracking-tighter">
                            {config.companyInfo.tel} &nbsp;,&nbsp; {config.companyInfo.fax || ''}
                          </td>
                        </tr>
                        <tr>
                          <td className="w-[60px] border-r border-slate-900 p-1 text-center font-medium">업태종목</td>
                          <td className="p-1 text-center">{config.companyInfo.bizType}</td>
                          <td className="w-[70px] border-l border-slate-900 p-1 text-center leading-tight whitespace-nowrap">{config.companyInfo.bizItem}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Total amount */}
              <div className="border border-t-0 border-slate-900 p-1.5 flex text-[11px]">
                <span className="font-bold ml-1 text-slate-800">합계금액:</span>
              </div>

              {/* Items Table */}
              <table className="w-full border-collapse border border-t-0 border-slate-900 text-[11px]">
                <thead>
                  <tr className="border-b border-slate-900 text-center font-bold">
                    <th className="border-r border-slate-900 py-1.5 px-2 w-10">No.</th>
                    <th className="border-r border-slate-900 py-1.5 px-2 w-48">품 명</th>
                    <th className="border-r border-slate-900 py-1.5 px-2 w-40">규 격</th>
                    <th className="border-r border-slate-900 py-1.5 px-2 w-16">단위</th>
                    <th className="border-r border-slate-900 py-1.5 px-2 w-20 text-right">수량</th>
                    <th className="py-1.5 px-2 text-center">비 고</th>
                  </tr>
                </thead>
                <tbody>
                  {slip.items.map((item, idx) => (
                    <tr key={item.id} className="border-b border-slate-400">
                      <td className="border-r border-slate-900 py-1.5 px-2 text-center font-mono">{idx + 1}</td>
                      <td className="border-r border-slate-900 py-1.5 px-2 font-medium">{displayProductName(item.productName)}</td>
                      <td className="border-r border-slate-900 py-1.5 px-2 font-mono text-[10px]">{item.spec}</td>
                      <td className="border-r border-slate-900 py-1.5 px-2 text-center">{item.unit}</td>
                      <td className="border-r border-slate-900 py-1.5 px-2 text-right font-mono font-bold">{item.qty}</td>
                      <td className="py-1.5 px-2 text-left font-mono truncate max-w-[150px]">{item.memo || ''}</td>
                    </tr>
                  ))}
                  {/* Empty filler rows */}
                  {Array.from({ length: Math.max(0, 5 - slip.items.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="border-b border-slate-400 text-transparent">
                      <td className="border-r border-slate-900 py-1.5 px-2">&nbsp;</td>
                      <td className="border-r border-slate-900 py-1.5 px-2">&nbsp;</td>
                      <td className="border-r border-slate-900 py-1.5 px-2">&nbsp;</td>
                      <td className="border-r border-slate-900 py-1.5 px-2">&nbsp;</td>
                      <td className="border-r border-slate-900 py-1.5 px-2">&nbsp;</td>
                      <td className="py-1.5 px-2">&nbsp;</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border border-t-0 border-slate-900 min-h-[300px] bg-white">
                {/* Empty area without checkmark */}
              </div>
              
              {/* Remark */}
              <div className="border border-t-0 border-slate-900 p-3 text-[11px] min-h-[80px]">
                <div className="flex">
                  <span className="font-bold w-[60px] flex-shrink-0">Remark:</span>
                  <span className="whitespace-pre-wrap leading-relaxed tracking-wide">
                    {slip.memo || ''}
                  </span>
                </div>
              </div>
            </div>
          ) : slip.slipType === 'DELIVERY' ? (
            /* Delivery (납품거래명세서) Layout matching the requested Excel */
            <div className="w-[210mm] min-h-[297mm] bg-white p-8 shadow-sm border border-slate-300 print:border-none print:shadow-none print:p-0 print:w-full text-slate-900 text-[11px] font-sans flex flex-col">
              <div className="flex justify-between items-end mb-4 border-b-2 border-slate-900 pb-2">
                <div className="font-bold">거래일자: {slip.slipDate}</div>
                <h1 className="text-2xl font-black tracking-[0.5em] text-slate-900 ml-10">
                  거래명세서(납품)
                </h1>
                <div className="w-24 text-right text-xs text-slate-500 font-mono">(공급받는자용)</div>
              </div>

              {/* Provider / Receiver Tables */}
              <div className="flex w-full mb-2 h-[120px]">
                <div className="w-8 flex flex-col items-center justify-center border border-slate-900 bg-slate-100 text-center text-[12px] font-bold py-2 gap-1.5 leading-none">
                  <span>공</span>
                  <span>급</span>
                  <span>하</span>
                  <span>는</span>
                  <span>자</span>
                </div>
                <table className="flex-1 border-y border-r border-slate-900 text-[11px] h-full">
                  <tbody>
                    <tr>
                      <th className="border-r border-b border-slate-900 py-1 bg-slate-50 w-16 text-center">상호</th>
                      <td colSpan={3} className="border-b border-slate-900 px-2 py-1 font-bold">{config.companyInfo.name}</td>
                    </tr>
                    <tr>
                      <th className="border-r border-b border-slate-900 py-1 bg-slate-50 text-center">대표</th>
                      <td colSpan={3} className="border-b border-slate-900 px-2 py-1 font-bold relative">
                        <span>{config.companyInfo.ceo}</span>
                        {BRAND.seal && <img src={BRAND.seal} alt="인" className="absolute left-12 top-1/2 -translate-y-1/2 w-[34px] h-[34px] mix-blend-multiply" />}
                      </td>
                    </tr>
                    <tr>
                      <th className="border-r border-b border-slate-900 py-1 bg-slate-50 text-center">등록번호</th>
                      <td colSpan={3} className="border-b border-slate-900 px-2 py-1 font-mono">{config.companyInfo.bizNumber}</td>
                    </tr>
                    <tr>
                      <th className="border-r border-b border-slate-900 py-1 bg-slate-50 text-center">주소</th>
                      <td colSpan={3} className="border-b border-slate-900 px-2 py-1 text-[10px] leading-tight break-keep">{config.companyInfo.address}</td>
                    </tr>
                    <tr>
                      <th className="border-r border-slate-900 py-1 bg-slate-50 text-center">메일</th>
                      <td className="border-r border-slate-900 px-2 py-1 text-[10px]">{config.companyInfo.email || ''}</td>
                      <th className="border-r border-slate-900 py-1 bg-slate-50 w-12 text-center">연락처</th>
                      <td className="border-slate-900 px-2 py-1 font-mono text-[10px]">{config.companyInfo.tel}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="w-2"></div>

                <div className="w-8 flex flex-col items-center justify-center border border-slate-900 bg-slate-100 text-center text-[12px] font-bold py-2 gap-1.5 leading-none">
                  <span>공</span>
                  <span>급</span>
                  <span>받</span>
                  <span>는</span>
                  <span>자</span>
                </div>
                <table className="flex-1 border-y border-r border-slate-900 text-[11px] h-full">
                  <tbody>
                    <tr>
                      <th className="border-r border-b border-slate-900 py-1 bg-slate-50 w-16 text-center">상호</th>
                      <td colSpan={3} className="border-b border-slate-900 px-2 py-1 font-bold">
                        {slip.customerName} {slip.siteName ? `[현장: ${slip.siteName}]` : ''}
                      </td>
                    </tr>
                    <tr>
                      <th className="border-r border-b border-slate-900 py-1 bg-slate-50 text-center">대표</th>
                      <td colSpan={3} className="border-b border-slate-900 px-2 py-1 font-bold">{customer?.ceo || ''}</td>
                    </tr>
                    <tr>
                      <th className="border-r border-b border-slate-900 py-1 bg-slate-50 text-center">등록번호</th>
                      <td colSpan={3} className="border-b border-slate-900 px-2 py-1 font-mono">{customer?.bizNumber || ''}</td>
                    </tr>
                    <tr>
                      <th className="border-r border-b border-slate-900 py-1 bg-slate-50 text-center">주소</th>
                      <td colSpan={3} className="border-b border-slate-900 px-2 py-1 text-[10px] leading-tight break-keep">
                        {slip.siteAddress || customer?.address || ''}
                        {slip.siteManager ? ` (소장: ${slip.siteManager})` : ''}
                      </td>
                    </tr>
                    <tr>
                      <th className="border-r border-slate-900 py-1 bg-slate-50 text-center">메일</th>
                      <td className="border-r border-slate-900 px-2 py-1 text-[10px]">{customer?.email || ''}</td>
                      <th className="border-r border-slate-900 py-1 bg-slate-50 w-12 text-center">연락처</th>
                      <td className="border-slate-900 px-2 py-1 font-mono text-[10px]">{customer?.tel || customer?.mobile || ''}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Items Table */}
              <table className="w-full border-collapse border border-slate-900 text-[11px] mt-2 flex-1">
                <thead>
                  <tr className="border-b border-slate-900 text-center bg-slate-100 font-bold">
                    <th className="border-r border-slate-900 py-2 px-1 w-8">NO.</th>
                    <th className="border-r border-slate-900 py-2 px-2 w-48">품 목</th>
                    <th className="border-r border-slate-900 py-2 px-2 w-40">규격</th>
                    <th className="border-r border-slate-900 py-2 px-1 w-14">수량</th>
                    <th className="border-r border-slate-900 py-2 px-1 w-12">단위</th>
                    <th className="border-r border-slate-900 py-2 px-2 w-20">단가</th>
                    <th className="border-r border-slate-900 py-2 px-2 w-24">금액</th>
                    <th className="py-2 px-2">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {slip.items.map((item, idx) => (
                    <tr key={item.id} className="border-b border-slate-400">
                      <td className="border-r border-slate-900 py-2 px-1 text-center font-mono">{idx + 1}</td>
                      <td className="border-r border-slate-900 py-2 px-2 font-medium">{displayProductName(item.productName)}</td>
                      <td className="border-r border-slate-900 py-2 px-2 font-mono text-[10px]">{item.spec}</td>
                      <td className="border-r border-slate-900 py-2 px-1 text-right font-mono font-bold">{item.qty}</td>
                      <td className="border-r border-slate-900 py-2 px-1 text-center">{item.unit}</td>
                      <td className="border-r border-slate-900 py-2 px-2 text-right"></td>
                      <td className="border-r border-slate-900 py-2 px-2 text-right"></td>
                      <td className="py-2 px-2 text-left font-mono truncate max-w-[120px]">{item.memo || ''}</td>
                    </tr>
                  ))}
                  {Array.from({ length: Math.max(0, 18 - slip.items.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="border-b border-slate-400 text-transparent">
                      <td className="border-r border-slate-900 py-2 px-1">&nbsp;</td>
                      <td className="border-r border-slate-900 py-2 px-2">&nbsp;</td>
                      <td className="border-r border-slate-900 py-2 px-2">&nbsp;</td>
                      <td className="border-r border-slate-900 py-2 px-1">&nbsp;</td>
                      <td className="border-r border-slate-900 py-2 px-1">&nbsp;</td>
                      <td className="border-r border-slate-900 py-2 px-2">&nbsp;</td>
                      <td className="border-r border-slate-900 py-2 px-2">&nbsp;</td>
                      <td className="py-2 px-2">&nbsp;</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <table className="w-full border-collapse border border-t-0 border-slate-900 text-[11px] mt-0">
                <tbody>
                  <tr className="bg-slate-100 border-b border-slate-900 text-center font-bold">
                    <td className="border-r border-slate-900 py-2">합계</td>
                    <td className="border-r border-slate-900 py-2 w-28">전잔액</td>
                    <td className="border-r border-slate-900 py-2 w-28">전잔액+출고액</td>
                    <td className="border-r border-slate-900 py-2 w-28">입금액</td>
                    <td className="py-2 w-28">현잔액</td>
                  </tr>
                  <tr className="text-right font-mono border-b border-slate-900 bg-white">
                    <td className="border-r border-slate-900 py-2 px-2 text-transparent">0</td>
                    <td className="border-r border-slate-900 py-2 px-2 text-transparent">0</td>
                    <td className="border-r border-slate-900 py-2 px-2 text-transparent">0</td>
                    <td className="border-r border-slate-900 py-2 px-2 text-transparent">0</td>
                    <td className="py-2 px-2 text-transparent">0</td>
                  </tr>
                  <tr>
                    <td className="border-r border-slate-900 py-3 px-2 font-bold text-center w-16 bg-slate-100">비 고</td>
                    <td colSpan={3} className="border-r border-slate-900 py-2 px-3 whitespace-pre-wrap leading-relaxed">{slip.memo}</td>
                    <td className="py-2 px-2 font-bold text-center bg-slate-100 leading-tight">검수<br/>및<br/>인수</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : printType === 'statement' ? (
            /* Standard A4 Transaction Statement */
            <div className="w-[210mm] min-h-[297mm] bg-white p-8 shadow-sm border border-slate-300 print:border-none print:shadow-none print:p-0 print:w-full text-slate-900 text-[11px] font-sans">
              <div className="text-center pb-4 border-b-2 border-slate-800">
                <h1 className="text-2xl font-black tracking-widest text-slate-900">
                  {getDocumentTitle()}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {!hidePriceColumns && '(공급받는자 보관용 / 공급자 보관용) · '}전표번호: {slip.slipNo} · 발행일자: {slip.slipDate}
                </p>
              </div>

              {/* Header Info Tables (공급자 · 공급받는 자) — 매입 전표는 거래처가 공급자, 우리 회사가 공급받는 자 */}
              <div className="grid grid-cols-2 gap-4 my-4">
                {(isInbound ? [custParty, ownParty] : [ownParty, custParty]).map((party, idx) => (
                  <div key={idx} className="border border-slate-400 p-2 text-[11px]">
                    <div className="bg-slate-100 font-bold px-2 py-0.5 mb-1.5 border-b border-slate-300 text-blue-900 flex justify-between items-center">
                      <span>{idx === 0 ? '공급자' : '공급받는 자'}{party.own ? '' : ' (거래처)'}</span>
                      {!party.own && slip.siteName && (
                        <span className="text-[10px] bg-blue-600 text-white font-medium px-1.5 py-0.2 rounded">
                          현장: {slip.siteName}
                        </span>
                      )}
                    </div>
                    <table className="w-full text-left">
                      <tbody>
                        <tr>
                          <th className="py-0.5 w-16 text-slate-500">등록번호</th>
                          <td className="font-mono font-bold">{party.bizNumber || '-'}</td>
                        </tr>
                        <tr>
                          <th className="py-0.5 text-slate-500">상호 / 대표</th>
                          <td className={`relative ${party.own ? '' : 'font-bold'}`}>
                            <span>{party.name}{party.site && <span className="text-blue-700 ml-1">[{party.site}]</span>} / {party.ceo || '-'}</span>
                            {party.own && BRAND.seal && <img src={BRAND.seal} alt="인" className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 mix-blend-multiply" />}
                          </td>
                        </tr>
                        <tr>
                          <th className="py-0.5 text-slate-500">{party.own ? '사업장주소' : '현장/주소'}</th>
                          <td className="truncate max-w-[200px]">{party.address || '-'}{party.manager ? ` (소장: ${party.manager})` : ''}</td>
                        </tr>
                        <tr>
                          <th className="py-0.5 text-slate-500">업태 / 종목</th>
                          <td>{party.bizType || party.bizItem ? `${party.bizType || ''} / ${party.bizItem || ''}` : '-'}</td>
                        </tr>
                        <tr>
                          <th className="py-0.5 text-slate-500">전화번호</th>
                          <td>{party.tel || '-'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              {/* Total Korean Amount Banner */}
              {true && (
                <div className="bg-slate-50 border border-slate-400 p-2 my-2 flex justify-between items-center font-bold">
                  <div>
                    <span className="text-slate-600 mr-2">합계금액:</span>
                    <span className="text-sm font-black text-blue-900">
                      {numberToKorean(slip.totalAmount)}
                    </span>
                  </div>
                  <div className="font-mono text-base text-slate-900">
                    (₩{slip.totalAmount.toLocaleString('ko-KR')})
                  </div>
                </div>
              )}

              {/* Items Table */}
              <table className="w-full border-collapse border border-slate-400 text-[11px] my-3">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400 text-center font-bold">
                    <th className="border border-slate-400 py-1.5 px-2 w-10">NO</th>
                    <th className="border border-slate-400 py-1.5 px-2">품목명</th>
                    <th className="border border-slate-400 py-1.5 px-2">규격 (Spec)</th>
                    <th className="border border-slate-400 py-1.5 px-2 w-14">단위</th>
                    <th className="border border-slate-400 py-1.5 px-2 w-16 text-right">수량</th>
                    {hidePriceColumns && (slip as any).slipType === 'ORDER' && (
                      <th className="border border-slate-400 py-1.5 px-2 text-left">비고</th>
                    )}
                    {!hidePriceColumns && (
                      <>
                        <th className="border border-slate-400 py-1.5 px-2 w-20 text-right">단가</th>
                        <th className="border border-slate-400 py-1.5 px-2 w-24 text-right">금액</th>
                        <th className="border border-slate-400 py-1.5 px-2 w-20 text-right">세액</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {slip.items.map((item, idx) => (
                    <tr key={item.id} className="border-b border-slate-300">
                      <td className="border border-slate-300 py-1.5 px-2 text-center font-mono">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-2 font-medium">
                        {displayProductName(item.productName)}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-2 font-mono text-[10px]">
                        {item.spec}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-2 text-center">
                        {item.unit}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-2 text-right font-mono font-bold">
                        {item.qty}
                      </td>
                      {hidePriceColumns && (slip as any).slipType === 'ORDER' && (
                        <td className="border border-slate-300 py-1.5 px-2 text-left font-mono truncate max-w-[150px]">
                          {item.memo || ''}
                        </td>
                      )}
                      {!hidePriceColumns && (
                        <>
                          <td className="border border-slate-300 py-1.5 px-2 text-right font-mono">
                            {item.unitPrice.toLocaleString('ko-KR')}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-right font-mono font-bold">
                            {item.supplyAmount.toLocaleString('ko-KR')}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-right font-mono text-slate-600">
                            {item.taxAmount.toLocaleString('ko-KR')}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {/* Empty filler rows */}
                  {Array.from({ length: Math.max(0, 5 - slip.items.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="border-b border-slate-200 text-transparent">
                      <td className="border border-slate-200 py-1.5 px-2">&nbsp;</td>
                      <td className="border border-slate-200 py-1.5 px-2">&nbsp;</td>
                      <td className="border border-slate-200 py-1.5 px-2">&nbsp;</td>
                      <td className="border border-slate-200 py-1.5 px-2">&nbsp;</td>
                      <td className="border border-slate-200 py-1.5 px-2">&nbsp;</td>
                      <td className="border border-slate-200 py-1.5 px-2">&nbsp;</td>
                      <td className="border border-slate-200 py-1.5 px-2">&nbsp;</td>
                      <td className="border border-slate-200 py-1.5 px-2">&nbsp;</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-500">
                    <td colSpan={4} className="border border-slate-400 py-1.5 px-3 text-center">
                      합 계
                    </td>
                    <td className="border border-slate-400 py-1.5 px-2 text-right font-mono">
                      {slip.items.reduce((s, it) => s + it.qty, 0)}
                    </td>
                    {true && (
                      <>
                        <td className="border border-slate-400 py-1.5 px-2">&nbsp;</td>
                        <td className="border border-slate-400 py-1.5 px-2 text-right font-mono text-blue-900">
                          {slip.totalSupplyAmount.toLocaleString('ko-KR')}
                        </td>
                        <td className="border border-slate-400 py-1.5 px-2 text-right font-mono text-blue-900">
                          {slip.totalTaxAmount.toLocaleString('ko-KR')}
                        </td>
                      </>
                    )}
                  </tr>
                </tfoot>
              </table>

              {/* Settlement summary & Signature */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="border border-slate-400 p-2 text-[11px] bg-slate-50 relative">
                  {!hidePriceColumns ? (
                    <table className="w-full">
                      <tbody>
                        {slip.showPrevBalance !== false && !isQuote && (
                          <tr>
                            <th className="py-0.5 text-left text-slate-500">전잔액:</th>
                            <td className="text-right font-mono font-bold">
                              {formatKRW(slip.prevReceivables || 0)}
                            </td>
                          </tr>
                        )}
                        <tr>
                          <th className="py-0.5 text-left text-slate-500">금회 총액:</th>
                          <td className="text-right font-mono font-bold text-blue-800">
                            {formatKRW(slip.totalAmount)}
                          </td>
                        </tr>
                        {!isQuote && (<tr>
                          <th className="py-0.5 text-left text-slate-500">금회 입금액:</th>
                          <td className="text-right font-mono font-bold text-emerald-700">
                            {formatKRW(slip.paidAmount || 0)}
                          </td>
                        </tr>)}
                        {slip.showPrevBalance !== false && !isQuote && (
                          <tr className="border-t border-slate-300">
                            <th className="py-1 text-left font-bold">거래 후 잔액:</th>
                            <td className="text-right font-mono font-bold text-rose-700 text-xs">
                              {formatKRW((slip.prevReceivables || 0) + slip.unpaidAmount)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <div className="h-full flex flex-col items-start justify-center text-slate-800 font-bold p-2 text-[12px]">
                      {(slip as any).slipType === 'ORDER' ? (
                        <>
                          <div className="text-rose-700 mb-1">■ Remark (발주 요청사항)</div>
                          <div className="font-medium whitespace-pre-wrap leading-relaxed">{slip.memo || '특이사항 없음'}</div>
                        </>
                      ) : (
                        <div className="text-center w-full text-slate-500">[ 납품명세서 ] 단가 및 금액 표시 생략</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="border border-slate-400 p-3 flex flex-col justify-between text-center">
                  <div className="text-xs font-semibold text-slate-700">
                    {slip.slipType === 'ESTIMATE' ? '위와 같이 견적합니다.' : slip.slipType === 'CONTRACT' ? '위 품목을 수주합니다.' : '위 품목을 정히 영수(인수) 함.'}
                  </div>
                  <div className="flex justify-around items-end pt-6">
                    {(isQuote ? [{ label: slip.slipType === 'ESTIMATE' ? '견적자' : '수주자', own: true }]
                      : isInbound ? [{ label: '인수자', own: true }, { label: '납품자', own: false }]
                      : [{ label: '인수자', own: false }, { label: '납품자', own: true }]).map(sg => (
                      <div key={sg.label}>
                        <span className="text-slate-500 text-[10px]">{sg.label} : </span>
                        <span className="border-b border-slate-400 px-6 py-0.5 font-bold">
                          {sg.own ? <>{config.companyInfo.ceo} {BRAND.seal && <img src={BRAND.seal} alt="인" className="inline-block w-7 h-7 align-middle mix-blend-multiply" />}</> : '(인 / 서명)'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Memo */}
              {slip.memo && (
                <div className="mt-4 p-2 bg-slate-50 border border-slate-300 text-[11px]">
                  <strong>전표 비고: </strong> {slip.memo}
                </div>
              )}

              {/* Digital Signature Watermark (Anti-Forgery) */}
              {(slip.digitalSignature || slip.tsaToken) && (
                <div className="mt-6 pt-2 border-t border-slate-300 text-[8px] text-slate-400 font-mono flex flex-col gap-0.5 opacity-80 print:opacity-100">
                  <div className="font-bold mb-1">[전자서명 및 원본 증명 (RFC 3161)] 본 문서는 위변조 방지 알고리즘으로 암호화되어 안전하게 보관 중입니다.</div>
                  {slip.tsaToken && <div>TSA Token: {slip.tsaToken}</div>}
                  {slip.digitalSignature && <div>Signature (SHA-256): {slip.digitalSignature}</div>}
                </div>
              )}
            </div>
          ) : (
            /* 80mm Roll Receipt */
            <div className="w-[80mm] bg-white p-4 shadow-sm border border-slate-300 print:border-none print:shadow-none print:p-0 print:w-full font-mono text-[11px] text-black">
              <div className="text-center pb-2 border-b border-dashed border-black">
                <h2 className="text-base font-black tracking-widest">[ 영 수 증 ]</h2>
                <div className="text-sm font-extrabold mt-1">{config.companyInfo.name || BRAND.company}</div>
                <div>{config.companyInfo.address}</div>
                <div>TEL: {config.companyInfo.tel}</div>
                <div>사업자: {config.companyInfo.bizNumber} &middot; 대표: {config.companyInfo.ceo}</div>
              </div>

              <div className="py-2 border-b border-dashed border-black text-[10px]">
                <div>전표번호: {slip.slipNo}</div>
                <div>발행일시: {slip.slipDate} {slip.createdAt?.slice(11, 19)}</div>
                <div>
                  거래처명: {slip.customerName}
                  {slip.siteName ? ` [현장: ${slip.siteName}]` : ''}
                </div>
              </div>

              {/* Receipt Item List */}
              <div className="py-2 border-b border-dashed border-black">
                <div className="flex justify-between font-bold border-b pb-1">
                  <span>품명/규격</span>
                  <span>수량/금액</span>
                </div>
                {slip.items.map(item => (
                  <div key={item.id} className="py-1">
                    <div className="font-bold truncate">{displayProductName(item.productName)}</div>
                    <div className="flex justify-between text-[10px] text-slate-700">
                      <span>{item.spec}</span>
                      <span>
                        {item.qty} x {item.unitPrice.toLocaleString('ko-KR')} = {item.totalAmount.toLocaleString('ko-KR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="py-2 border-b border-dashed border-black space-y-1">
                <div className="flex justify-between">
                  <span>공급가액:</span>
                  <span>{slip.totalSupplyAmount.toLocaleString('ko-KR')}원</span>
                </div>
                <div className="flex justify-between">
                  <span>부가세(10%):</span>
                  <span>{slip.totalTaxAmount.toLocaleString('ko-KR')}원</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t pt-1">
                  <span>합계금액:</span>
                  <span>{slip.totalAmount.toLocaleString('ko-KR')}원</span>
                </div>
              </div>

              <div className="py-2 text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span>결제구분:</span>
                  <span>{slip.paymentType === 'credit' ? '외상미수' : '현금/카드'}</span>
                </div>
                <div className="flex justify-between">
                  <span>금회입금:</span>
                  <span>{slip.paidAmount.toLocaleString('ko-KR')}원</span>
                </div>
                {slip.showPrevBalance !== false && (
                  <div className="flex justify-between font-bold">
                    <span>미수잔액:</span>
                    <span>{((slip.prevReceivables || 0) + slip.unpaidAmount).toLocaleString('ko-KR')}원</span>
                  </div>
                )}
              </div>

              <div className="pt-3 text-center text-[10px] border-t border-dashed border-black">
                감사합니다. 또 이용해 주십시오.
              </div>

              {/* Digital Signature Watermark for Roll */}
              {(slip.digitalSignature || slip.tsaToken) && (
                <div className="mt-3 pt-2 border-t border-dashed border-black text-[7px] text-slate-500 font-mono opacity-80 break-all leading-tight">
                  [전자서명/TSA 적용 문서]<br/>
                  {slip.tsaToken}<br/>
                  {slip.digitalSignature?.substring(0, 32)}...
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-2 print:hidden rounded-b-lg">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setPrintType('original'); setSlipCopies('recipient'); handleDispatch('FAX'); }}
              disabled={dispatchStatus === 'SENDING'}
              className="px-3 py-1.5 rounded border border-emerald-400 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1 shadow-sm disabled:opacity-50 transition-colors"
              title="원본 양식의 받는 쪽 한 벌(공급받는자 보관용)을 팩스로 보냅니다. 번호를 확인하는 창이 뜨고, 「발송하기」를 눌러야 실제로 나갑니다."
            >
              📠 받는 쪽 한 벌 바로 팩스
            </button>
            <button
              onClick={() => handleDispatch('FAX')}
              disabled={dispatchStatus === 'SENDING'}
              className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 shadow-sm disabled:opacity-50 transition-colors"
              title="지금 보이는 탭과 관계없이 원본 양식의 받는 쪽 한 벌을 보냅니다."
            >
              📠 팩스 발송
            </button>
            <button
              onClick={() => handleDispatch('KAKAO')}
              disabled={dispatchStatus === 'SENDING'}
              className="px-3 py-1.5 rounded bg-[#FEE500] hover:bg-[#F4DC00] text-black font-bold text-xs flex items-center gap-1 shadow-sm disabled:opacity-50 transition-colors"
            >
              💬 카카오톡 발송
            </button>
            <button
              onClick={() => handleDispatch('EMAIL')}
              disabled={dispatchStatus === 'SENDING'}
              className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 shadow-sm disabled:opacity-50 transition-colors"
            >
              ✉️ 이메일 발송
            </button>
            <div className="w-px h-5 bg-slate-300 mx-1 hidden sm:block"></div>
            <button
              onClick={handleDownloadPDF}
              className="px-3 py-1.5 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center gap-1 shadow-sm transition-colors"
            >
              📄 PDF 저장
            </button>
            <button
              onClick={handleDownloadExcel}
              className="px-3 py-1.5 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1 shadow-sm transition-colors"
            >
              📊 엑셀 저장
            </button>
          </div>
          
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
            >
              닫기 (Esc)
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>프린터 출력 (Enter)</span>
            </button>
          </div>
        </div>

        {/* Toast Notification Layer */}
        {toastMessage && (
          <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-[100] px-4 py-3 rounded shadow-xl text-sm font-bold flex items-center gap-2 max-w-md w-max print:hidden transition-all duration-300 ease-out ${
            toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-2 border-emerald-500' :
            toastMessage.type === 'error' ? 'bg-red-50 text-red-800 border-2 border-red-500' :
            'bg-blue-50 text-blue-800 border-2 border-blue-500'
          }`}>
            <span>{toastMessage.text}</span>
          </div>
        )}
      </div>

      {/* Dispatch Modal inside PrintModal */}
      {dispatchModal.isOpen && dispatchModal.channel && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
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
                list="contact-suggestions"
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
              <datalist id="contact-suggestions">
                {customers.map(c => {
                  if (dispatchModal.channel === 'EMAIL' && c.email) {
                    return <option key={c.id} value={c.email}>{c.name} {c.ceo ? `(${c.ceo})` : ''}</option>;
                  }
                  if (dispatchModal.channel === 'FAX' || dispatchModal.channel === 'KAKAO') {
                    const number = dispatchModal.channel === 'FAX' ? (c.fax || c.tel || c.mobile) : (c.tel || c.mobile);
                    if (number) return <option key={c.id} value={number}>{c.name} {c.ceo ? `(${c.ceo})` : ''}</option>;
                  }
                  return null;
                })}
              </datalist>
              {dispatchModal.channel === 'FAX' ? (
                <div className="mt-2 text-xs bg-amber-50 border border-amber-200 rounded p-2 space-y-0.5 text-amber-900">
                  <p><b>보내는 문서</b>: 거래명세표 원본 양식 — <b>받는 쪽 한 벌</b>(공급받는자 보관용)</p>
                  <p><b>받는 곳</b>: {slip.customerName} · 전표 {slip.slipNo}</p>
                  <p className="text-amber-700">팩스 번호를 한 번 더 확인하세요. 「발송하기」를 누르면 <b>실제로 팩스가 나갑니다</b>.</p>
                  {dispatchModal.contact.replace(/\D/g, '').length < 8 && <p className="text-red-600 font-semibold">팩스 번호가 비어 있거나 짧습니다.</p>}
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-2">
                  실제 전송 테스트를 원하시면 본인의 연락처/이메일을 입력 후 발송해보세요.
                </p>
              )}
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
