'use client';

import React, { useState } from 'react';
import { Printer, X, FileText, Receipt } from 'lucide-react';
import type { Slip, SystemConfig, Customer } from '@/types';

interface PrintModalProps {
  slip: Slip | null;
  config: SystemConfig;
  customer?: Customer;
  isOpen: boolean;
  onClose: () => void;
}

export function PrintModal({ slip, config, customer, isOpen, onClose }: PrintModalProps) {
  const [printType, setPrintType] = useState<'statement' | 'receipt'>('statement');

  if (!isOpen || !slip) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatKRW = (num: number) => num.toLocaleString('ko-KR') + '원';

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
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full my-auto flex flex-col max-h-[95vh] print:m-0 print:p-0 print:w-full print:max-w-none print:shadow-none print:border-none">
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
              <span>인쇄하기 (Ctrl+P)</span>
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
        <div className="p-6 overflow-y-auto flex-1 bg-neutral-100/50 flex justify-center print:bg-white print:p-0">
          {printType === 'statement' ? (
            /* Standard A4 Transaction Statement */
            <div className="w-[210mm] min-h-[297mm] bg-white p-8 shadow-sm border border-slate-300 print:border-none print:shadow-none print:p-0 print:w-full text-slate-900 text-[11px] font-sans">
              <div className="text-center pb-4 border-b-2 border-slate-800">
                <h1 className="text-2xl font-black tracking-widest text-slate-900">
                  거 래 명 세 표
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  (공급받는자 보관용 / 공급자 보관용) &middot; 전표번호: {slip.slipNo}
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
                        <td>{config.companyInfo.name} / {config.companyInfo.ceo}</td>
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

              {/* Items Table */}
              <table className="w-full border-collapse border border-slate-400 text-[11px] my-3">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400 text-center font-bold">
                    <th className="border border-slate-400 py-1.5 px-2 w-10">NO</th>
                    <th className="border border-slate-400 py-1.5 px-2">품목명</th>
                    <th className="border border-slate-400 py-1.5 px-2">규격 (Spec)</th>
                    <th className="border border-slate-400 py-1.5 px-2 w-14">단위</th>
                    <th className="border border-slate-400 py-1.5 px-2 w-16 text-right">수량</th>
                    <th className="border border-slate-400 py-1.5 px-2 w-20 text-right">단가</th>
                    <th className="border border-slate-400 py-1.5 px-2 w-24 text-right">공급가액</th>
                    <th className="border border-slate-400 py-1.5 px-2 w-20 text-right">세액</th>
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
                      <td className="border border-slate-300 py-1.5 px-2 text-right font-mono">
                        {item.unitPrice.toLocaleString('ko-KR')}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-2 text-right font-mono font-bold">
                        {item.supplyAmount.toLocaleString('ko-KR')}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-2 text-right font-mono text-slate-600">
                        {item.taxAmount.toLocaleString('ko-KR')}
                      </td>
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
                    <td className="border border-slate-400 py-1.5 px-2">&nbsp;</td>
                    <td className="border border-slate-400 py-1.5 px-2 text-right font-mono text-blue-900">
                      {slip.totalSupplyAmount.toLocaleString('ko-KR')}
                    </td>
                    <td className="border border-slate-400 py-1.5 px-2 text-right font-mono text-blue-900">
                      {slip.totalTaxAmount.toLocaleString('ko-KR')}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Settlement summary & Signature */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="border border-slate-400 p-2 text-[11px]">
                  <table className="w-full">
                    <tbody>
                      <tr>
                        <th className="py-0.5 text-left text-slate-500">전잔액 (전월미수):</th>
                        <td className="text-right font-mono font-bold">
                          {formatKRW(slip.prevReceivables || 0)}
                        </td>
                      </tr>
                      <tr>
                        <th className="py-0.5 text-left text-slate-500">금회 매출총액:</th>
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
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 print:hidden rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
          >
            닫기 (Esc)
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>프린터 출력 (Enter)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
