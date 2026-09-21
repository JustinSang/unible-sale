'use client';

import React, { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import type { SystemConfig } from '@/types';

interface TaxPrintModalProps {
  invoices: any[];
  config: SystemConfig;
  isOpen: boolean;
  onClose: () => void;
}

export function TaxPrintModal({ invoices, config, isOpen, onClose }: TaxPrintModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || invoices.length === 0) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatAmount = (num: number) => num ? num.toLocaleString('ko-KR') : '';

  // Each page will contain ONE invoice, printed twice (Top: Red/Supplier, Bottom: Blue/Receiver)
  // Coordinates are estimated in millimeters for standard A4 Korean Tax Invoice pre-printed form.
  
  const InvoiceOverlay = ({ invoice, isBottom }: { invoice: any, isBottom: boolean }) => {
    const yOffset = isBottom ? 148.5 : 0; // Bottom form starts at half of A4 (297 / 2)

    // Splitting the bizNumber to parts if possible
    const suppBiz = config.companyInfo.bizNumber.replace(/-/g, '');
    const custBiz = invoice.customer?.bizNumber?.replace(/-/g, '') || '';
    const dateArr = invoice.taxDate.split('-');

    // Determine 영수/청구 from invoice data
    const receiptType = invoice.checkReceipt || (invoice.isIssued ? '영수' : '청구');
    
    return (
      <div style={{ position: 'absolute', top: `${yOffset}mm`, left: '0mm', width: '210mm', height: '148.5mm', fontFamily: 'Courier New, monospace', fontSize: '12px', fontWeight: 'bold' }}>
        {/* 공급자 정보 (Supplier) */}
        <div style={{ position: 'absolute', top: '30mm', left: '42mm', letterSpacing: '3px' }}>
          {suppBiz}
        </div>
        <div style={{ position: 'absolute', top: '38mm', left: '26mm', width: '55mm', overflow: 'hidden' }}>
          {config.companyInfo.name}
        </div>
        <div style={{ position: 'absolute', top: '38mm', left: '88mm', width: '20mm', overflow: 'hidden' }}>
          {config.companyInfo.ceo}
        </div>
        <div style={{ position: 'absolute', top: '46mm', left: '26mm', width: '80mm', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {config.companyInfo.address}
        </div>
        <div style={{ position: 'absolute', top: '54mm', left: '26mm', width: '40mm', overflow: 'hidden' }}>
          {config.companyInfo.bizType}
        </div>
        <div style={{ position: 'absolute', top: '54mm', left: '72mm', width: '35mm', overflow: 'hidden' }}>
          {config.companyInfo.bizItem}
        </div>

        {/* 공급받는자 정보 (Receiver) */}
        <div style={{ position: 'absolute', top: '30mm', left: '136mm', letterSpacing: '3px' }}>
          {custBiz}
        </div>
        <div style={{ position: 'absolute', top: '38mm', left: '120mm', width: '55mm', overflow: 'hidden' }}>
          {invoice.customerName}
        </div>
        <div style={{ position: 'absolute', top: '38mm', left: '182mm', width: '20mm', overflow: 'hidden' }}>
          {invoice.customer?.ceo || ''}
        </div>
        <div style={{ position: 'absolute', top: '46mm', left: '120mm', width: '80mm', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {invoice.customer?.address || ''}
        </div>
        <div style={{ position: 'absolute', top: '54mm', left: '120mm', width: '40mm', overflow: 'hidden' }}>
          {invoice.customer?.bizType || ''}
        </div>
        <div style={{ position: 'absolute', top: '54mm', left: '166mm', width: '35mm', overflow: 'hidden' }}>
          {invoice.customer?.bizItem || ''}
        </div>

        {/* 작성일자, 공급가액, 세액 */}
        <div style={{ position: 'absolute', top: '65mm', left: '12mm' }}>{dateArr[0]?.slice(2)}</div>
        <div style={{ position: 'absolute', top: '65mm', left: '23mm' }}>{dateArr[1]}</div>
        <div style={{ position: 'absolute', top: '65mm', left: '33mm' }}>{dateArr[2]}</div>
        
        <div style={{ position: 'absolute', top: '65mm', left: '85mm', textAlign: 'right', width: '55mm' }}>
          {formatAmount(invoice.supplyAmount)}
        </div>
        <div style={{ position: 'absolute', top: '65mm', left: '150mm', textAlign: 'right', width: '35mm' }}>
          {formatAmount(invoice.taxAmount)}
        </div>

        {/* 품목 상세 (1st line - summary with spec/qty/unitPrice if available) */}
        <div style={{ position: 'absolute', top: '78mm', left: '10mm' }}>{dateArr[1]}</div>
        <div style={{ position: 'absolute', top: '78mm', left: '18mm' }}>{dateArr[2]}</div>
        <div style={{ position: 'absolute', top: '78mm', left: '26mm', width: '40mm', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {invoice.productSummary}
        </div>
        {/* 규격 (Spec) */}
        {invoice.spec && (
          <div style={{ position: 'absolute', top: '78mm', left: '68mm', width: '20mm', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '10px' }}>
            {invoice.spec}
          </div>
        )}
        {/* 수량 (Qty) */}
        {invoice.qty && (
          <div style={{ position: 'absolute', top: '78mm', left: '90mm', textAlign: 'right', width: '15mm' }}>
            {invoice.qty}
          </div>
        )}
        {/* 단가 (UnitPrice) */}
        {invoice.unitPrice && (
          <div style={{ position: 'absolute', top: '78mm', left: '106mm', textAlign: 'right', width: '15mm' }}>
            {formatAmount(invoice.unitPrice)}
          </div>
        )}
        {/* 공급가액 */}
        <div style={{ position: 'absolute', top: '78mm', left: '120mm', textAlign: 'right', width: '30mm' }}>
          {formatAmount(invoice.supplyAmount)}
        </div>
        {/* 세액 */}
        <div style={{ position: 'absolute', top: '78mm', left: '155mm', textAlign: 'right', width: '25mm' }}>
          {formatAmount(invoice.taxAmount)}
        </div>

        {/* 합계금액 */}
        <div style={{ position: 'absolute', top: '115mm', left: '42mm', textAlign: 'right', width: '55mm' }}>
          {formatAmount(invoice.totalAmount)}
        </div>
        {/* 영수/청구 구분 - OkSale CheckReceipt 반영 */}
        <div style={{ position: 'absolute', top: '115mm', left: '110mm' }}>
          {receiptType}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/50 flex flex-col md:flex-row print:bg-white">
      {/* Sidebar Controls (Hidden on Print) */}
      <div className="w-full md:w-80 bg-white border-r border-slate-200 p-5 flex flex-col shadow-2xl z-10 print:hidden h-auto md:h-full shrink-0">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" /> 양식지 전용 인쇄
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg mb-4">
          <strong>주의:</strong> 이 화면은 국세청 표준 세금계산서 폼지(적색/청색 양식지) 전용 출력 화면입니다.<br/>
          백지 프린터가 아닌 양식지가 급지된 프린터에서 인쇄하세요.
        </div>

        <div className="space-y-4 flex-1">
          <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <p className="font-bold mb-1">인쇄 대상: {invoices.length}건</p>
            {invoices.slice(0, 5).map((inv: any, i: number) => (
              <p key={i} className="text-[11px] truncate">
                • {inv.customerName} — {formatAmount(inv.totalAmount)}원 ({inv.checkReceipt || '영수'})
              </p>
            ))}
            {invoices.length > 5 && <p className="text-[11px] text-slate-400">...외 {invoices.length - 5}건</p>}
          </div>
          <button onClick={handlePrint} className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm">
            세금계산서 인쇄 (F9)
          </button>
        </div>
        
        <div className="mt-auto pt-6 border-t border-slate-200">
           <p className="text-xs text-slate-500 font-medium">프린터 설정 지침:</p>
           <ul className="text-xs text-slate-500 mt-2 space-y-1 list-disc pl-4">
             <li>용지 크기: <strong>A4</strong></li>
             <li>방향: <strong>세로</strong></li>
             <li>배율: <strong>100% (기본값)</strong></li>
             <li>여백: <strong>없음 (최소)</strong></li>
             <li>머리글/바닥글: <strong>체크 해제</strong></li>
           </ul>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 bg-slate-100 overflow-y-auto p-4 md:p-8 flex justify-center print:p-0 print:bg-white print:overflow-visible">
        <div 
          className="bg-white print:shadow-none w-full max-w-[210mm] mx-auto p-0 relative print:bg-transparent"
          ref={printRef}
          style={{ boxShadow: '0 0 20px rgba(0,0,0,0.1)' }}
        >
          {/* Print specific CSS */}
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              @page { size: A4 portrait; margin: 0; }
              body * { visibility: hidden; }
              #tax-print-container, #tax-print-container * { visibility: visible; }
              #tax-print-container { position: absolute; left: 0; top: 0; width: 210mm; }
              .print-page-break { page-break-after: always; }
            }
          `}} />
          
          <div id="tax-print-container">
            {invoices.map((inv, index) => (
              <div key={index} className={`relative w-[210mm] h-[297mm] ${index < invoices.length - 1 ? 'print-page-break' : ''} bg-[url('/templates/tax-invoice-bg.png')] bg-cover bg-no-repeat print:bg-none`}>
                {/* 
                  Note: The background image (bg-[url(...)]) is shown ONLY on screen so the user can visually verify alignment.
                  In print mode, print:bg-none hides the background image, so only the text prints on the physical form.
                  You can add a sample tax-invoice-bg.png to public/templates/ for visual preview.
                */}
                <InvoiceOverlay invoice={inv} isBottom={false} />
                <InvoiceOverlay invoice={inv} isBottom={true} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
