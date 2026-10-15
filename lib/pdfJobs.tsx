'use client';

import React from 'react';
import type { Slip, SystemConfig, Customer } from '@/types';
import { createPdfBuilder, finishPdf, savePdfBytes } from './pdfExport';
import { appendReactPages } from './pdfOffscreen';
import { RptReportPages, rptPageInfo, type RptRow } from '@/components/RptReportPrint';
import { SlipOriginalForm } from '@/components/SlipOriginalForm';

export interface PdfProgress { done: number; total: number; label: string }
const BATCH_PAGES = 12; // 한 번에 화면 밖에서 그리는 쪽 수(메모리·응답성)
const tick = () => new Promise<void>(r => setTimeout(r, 0));

/** 보고서(좌표 복원 양식) 전체를 PDF로. 줄 수 제한 없음(미리보기의 1,200줄 상한과 무관). */
export async function exportReportPdf(opts: { layoutKey: string; rows: RptRow[]; params: Record<string, string>; single?: boolean; filename: string; handle?: any; onProgress?: (p: PdfProgress) => void }): Promise<{ pages: number; bytes: number }> {
  const b = await createPdfBuilder();
  const { pages } = opts.single ? { pages: 1 } : rptPageInfo(opts.layoutKey, opts.rows.length);
  for (let a = 0; a < pages; a += BATCH_PAGES) {
    const to = Math.min(pages, a + BATCH_PAGES);
    opts.onProgress?.({ done: a, total: pages, label: `${a + 1}~${to}쪽 만드는 중` });
    await tick();
    await appendReactPages(b, <RptReportPages layoutKey={opts.layoutKey} rows={opts.rows} params={opts.params} single={opts.single} pageRange={[a, to]} />);
  }
  opts.onProgress?.({ done: pages, total: pages, label: '파일로 저장 중' });
  const bytes = await finishPdf(b);
  await savePdfBytes(bytes, opts.filename, opts.handle);
  return { pages: b.pageCount, bytes: bytes.length };
}

/** 전표 여러 장을 «원본 양식»으로 한 PDF에 묶는다(전표마다 새 쪽에서 시작). */
export async function exportSlipsPdf(opts: { slips: Slip[]; config: SystemConfig; customers: Customer[]; filename: string; handle?: any; onProgress?: (p: PdfProgress) => void }): Promise<{ pages: number; bytes: number }> {
  const b = await createPdfBuilder();
  const byId = new Map(opts.customers.map(c => [c.id, c]));
  const byName = new Map(opts.customers.map(c => [c.name, c]));
  for (let i = 0; i < opts.slips.length; i++) {
    const s = opts.slips[i];
    opts.onProgress?.({ done: i, total: opts.slips.length, label: `${s.slipNo} ${s.customerName}` });
    if (i % 3 === 0) await tick();
    await appendReactPages(b, <SlipOriginalForm slip={s} config={opts.config} customer={byId.get(s.customerId) || byName.get(s.customerName)} />);
  }
  opts.onProgress?.({ done: opts.slips.length, total: opts.slips.length, label: '파일로 저장 중' });
  const bytes = await finishPdf(b);
  await savePdfBytes(bytes, opts.filename, opts.handle);
  return { pages: b.pageCount, bytes: bytes.length };
}
