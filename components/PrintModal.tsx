'use client';

import React, { useState } from 'react';
import { Printer, X, FileText, Receipt } from 'lucide-react';
import type { Slip, SystemConfig, Customer } from '@/types';

interface PrintModalProps {
  slip: Slip | null;
  config: SystemConfig;
  customer?: Customer;
  customers?: Customer[];
  isOpen: boolean;
  onClose: () => void;
}

export function PrintModal({ slip, config, customer, customers = [], isOpen, onClose }: PrintModalProps) {
  const [printType, setPrintType] = useState<'statement' | 'receipt'>('statement');
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
    if (channel === 'FAX' || channel === 'KAKAO') defaultContact = customer?.tel || customer?.mobile || '';
    
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
    setDispatchStatus('SENDING');
    
    try {
      let fileBase64 = undefined;

      // FAX의 경우 화면을 캡처하여 PDF Base64 생성
      if (channel === 'FAX') {
        showToast('⏳ 팩스 전송을 위해 PDF를 생성 중입니다...', 'info', 5000);
        const element = document.getElementById('pdf-printable-area');
        if (element) {
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
          
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          // Get base64 string without the data URL prefix
          const dataUri = pdf.output('datauristring') as string;
          fileBase64 = dataUri.split(',')[1];
        }
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

  const handleDownloadPDF = async () => {
    try {
      const element = document.getElementById('pdf-printable-area');
      if (!element) return;
      
      const suggestedName = `명세서_${slip.slipNo || '문서'}.pdf`;
      let handle = null;
      
      // Request file handle FIRST to maintain user gesture
      if ((window as any).showSaveFilePicker) {
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
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
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
          ws.getCell(`C${row}`).value = item.productName;
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
          {slip.slipType === 'ORDER' ? (
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
                          <td className="w-[70px] border-l border-slate-900 p-1 text-center text-[12px]">{config.companyInfo.ceo}</td>
                        </tr>
                        <tr className="border-b border-slate-900">
                          <td className="w-[60px] border-r border-slate-900 p-1 text-center font-medium">주 &nbsp; 소</td>
                          <td colSpan={2} className="p-1 px-1 text-center break-keep leading-tight">{config.companyInfo.address}</td>
                        </tr>
                        <tr className="border-b border-slate-900">
                          <td className="w-[60px] border-r border-slate-900 p-1 text-center font-medium">Tel,Fax</td>
                          <td colSpan={2} className="p-1 text-center font-mono tracking-tighter">
                            _{config.companyInfo.tel} &nbsp;,&nbsp; _{config.companyInfo.fax || ''}
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
                      <td className="border-r border-slate-900 py-1.5 px-2 font-medium">{item.productName}</td>
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
                    {slip.memo || '*세종시 행복대로 824 네이버데이터센터 (현택)\n*(주)미동이엔씨 네이버 세종 데이터센터 2~3차\n*010-6559-6012.'}
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
                        <img src="/seal.png" alt="인" className="absolute left-12 top-1/2 -translate-y-1/2 w-[34px] h-[34px] mix-blend-multiply" />
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
                      <td className="border-r border-slate-900 px-2 py-1 text-[10px]">dsfastener@daum.net</td>
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
                      <td className="border-r border-slate-900 py-2 px-2 font-medium">{item.productName}</td>
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
                  {!hidePriceColumns && '(공급받는자 보관용 / 공급자 보관용) · '}전표번호: {slip.slipNo}
                </p>
              </div>

              {/* Header Info Tables (Supplier & Buyer) */}
              <div className="grid grid-cols-2 gap-4 my-4">
                {/* Supplier Info (사용 업체: 동산화스너) */}
                <div className="border border-slate-400 p-2 text-[11px]">
                  <div className="bg-slate-100 font-bold px-2 py-0.5 mb-1.5 border-b border-slate-300 text-blue-900">
                    공급자 ({config.companyInfo.name || '동산화스너'})
                  </div>
                  <table className="w-full text-left">
                    <tbody>
                      <tr>
                        <th className="py-0.5 w-16 text-slate-500">등록번호</th>
                        <td className="font-mono font-bold">{config.companyInfo.bizNumber}</td>
                      </tr>
                      <tr>
                        <th className="py-0.5 text-slate-500">상호 / 대표</th>
                        <td className="relative">
                          <span>{config.companyInfo.name} / {config.companyInfo.ceo}</span>
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border-2 border-red-500/70 text-red-500/70 flex items-center justify-center text-[11px] font-black transform -rotate-12 bg-white/30 backdrop-blur-[1px] mix-blend-multiply select-none print:border-red-600 print:text-red-600">
                            (인)
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <th className="py-0.5 text-slate-500">사업장주소</th>
                        <td className="truncate max-w-[200px]">{config.companyInfo.address}</td>
                      </tr>
                      <tr>
                        <th className="py-0.5 text-slate-500">업태 / 종목</th>
                        <td>{config.companyInfo.bizType} / {config.companyInfo.bizItem}</td>
                      </tr>
                      <tr>
                        <th className="py-0.5 text-slate-500">전화번호</th>
                        <td>{config.companyInfo.tel}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Buyer Info */}
                <div className="border border-slate-400 p-2 text-[11px]">
                  <div className="bg-slate-100 font-bold px-2 py-0.5 mb-1.5 border-b border-slate-300 text-blue-900 flex justify-between items-center">
                    <span>공급받는 자 (거래처)</span>
                    {slip.siteName && (
                      <span className="text-[10px] bg-blue-600 text-white font-medium px-1.5 py-0.2 rounded">
                        현장: {slip.siteName}
                      </span>
                    )}
                  </div>
                  <table className="w-full text-left">
                    <tbody>
                      <tr>
                        <th className="py-0.5 w-16 text-slate-500">등록번호</th>
                        <td className="font-mono font-bold">{customer?.bizNumber || '-'}</td>
                      </tr>
                      <tr>
                        <th className="py-0.5 text-slate-500">상호 / 대표</th>
                        <td className="font-bold">
                          {slip.customerName}
                          {slip.siteName && <span className="text-blue-700 ml-1">[{slip.siteName}]</span>}
                          {' / '}{customer?.ceo || '-'}
                        </td>
                      </tr>
                      <tr>
                        <th className="py-0.5 text-slate-500">현장/주소</th>
                        <td className="truncate max-w-[200px]">
                          {slip.siteAddress || customer?.address || '-'}
                          {slip.siteManager ? ` (소장: ${slip.siteManager})` : ''}
                        </td>
                      </tr>
                      <tr>
                        <th className="py-0.5 text-slate-500">전화번호</th>
                        <td>{customer?.tel || customer?.mobile || '-'}</td>
                      </tr>
                      <tr>
                        <th className="py-0.5 text-slate-500">발행일자</th>
                        <td className="font-mono font-bold">{slip.slipDate}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
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
                        {item.productName}
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
                        <tr>
                          <th className="py-0.5 text-left text-slate-500">전잔액:</th>
                          <td className="text-right font-mono font-bold">
                            {formatKRW(slip.prevReceivables || 0)}
                          </td>
                        </tr>
                        <tr>
                          <th className="py-0.5 text-left text-slate-500">금회 총액:</th>
                          <td className="text-right font-mono font-bold text-blue-800">
                            {formatKRW(slip.totalAmount)}
                          </td>
                        </tr>
                        <tr>
                          <th className="py-0.5 text-left text-slate-500">금회 입금액:</th>
                          <td className="text-right font-mono font-bold text-emerald-700">
                            {formatKRW(slip.paidAmount || 0)}
                          </td>
                        </tr>
                        <tr className="border-t border-slate-300">
                          <th className="py-1 text-left font-bold">거래 후 잔액:</th>
                          <td className="text-right font-mono font-bold text-rose-700 text-xs">
                            {formatKRW((slip.prevReceivables || 0) + slip.unpaidAmount)}
                          </td>
                        </tr>
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
                    위 품목을 정히 영수(인수) 함.
                  </div>
                  <div className="flex justify-around items-end pt-6">
                    <div>
                      <span className="text-slate-500 text-[10px]">인수자 : </span>
                      <span className="border-b border-slate-400 px-6 py-0.5 font-bold">
                        (인 / 서명)
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px]">납품자 : </span>
                      <span className="border-b border-slate-400 px-6 py-0.5 font-bold">
                        {config.companyInfo.ceo} (인)
                      </span>
                    </div>
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
                <div className="text-sm font-extrabold mt-1">{config.companyInfo.name || '동산화스너'}</div>
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
                    <div className="font-bold truncate">{item.productName}</div>
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
                <div className="flex justify-between font-bold">
                  <span>미수잔액:</span>
                  <span>{((slip.prevReceivables || 0) + slip.unpaidAmount).toLocaleString('ko-KR')}원</span>
                </div>
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
              onClick={() => handleDispatch('FAX')}
              disabled={dispatchStatus === 'SENDING'}
              className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 shadow-sm disabled:opacity-50 transition-colors"
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
                    const number = c.tel || c.mobile;
                    if (number) return <option key={c.id} value={number}>{c.name} {c.ceo ? `(${c.ceo})` : ''}</option>;
                  }
                  return null;
                })}
              </datalist>
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
