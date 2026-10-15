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

export type SlipCopies = 'both' | 'recipient';

async function buildSlipsPdfBytes(slips: Slip[], config: SystemConfig, customers: Customer[], copies: SlipCopies, onProgress?: (p: PdfProgress) => void, base = 0, total = slips.length): Promise<{ bytes: Uint8Array; pages: number }> {
  const b = await createPdfBuilder();
  const byId = new Map(customers.map(c => [c.id, c]));
  const byName = new Map(customers.map(c => [c.name, c]));
  for (let i = 0; i < slips.length; i++) {
    const s = slips[i];
    onProgress?.({ done: base + i, total, label: `${s.slipNo} ${s.customerName}` });
    if (i % 3 === 0) await tick();
    await appendReactPages(b, <SlipOriginalForm slip={s} config={config} customer={byId.get(s.customerId) || byName.get(s.customerName)} copies={copies} />);
  }
  return { bytes: await finishPdf(b), pages: b.pageCount };
}

/** 전표 여러 장을 «원본 양식»으로 한 PDF에 묶는다(전표마다 새 쪽에서 시작). copies: both=한 쪽에 두 벌(인쇄·보관용) / recipient=받는 쪽 한 벌(팩스 원고용). */
export async function exportSlipsPdf(opts: { slips: Slip[]; config: SystemConfig; customers: Customer[]; filename: string; handle?: any; copies?: SlipCopies; onProgress?: (p: PdfProgress) => void }): Promise<{ pages: number; bytes: number }> {
  const r = await buildSlipsPdfBytes(opts.slips, opts.config, opts.customers, opts.copies || 'both', opts.onProgress);
  opts.onProgress?.({ done: opts.slips.length, total: opts.slips.length, label: '파일로 저장 중' });
  await savePdfBytes(r.bytes, opts.filename, opts.handle);
  return { pages: r.pages, bytes: r.bytes.length };
}

/** 거래처마다 따로 한 PDF(받는 쪽 한 벌, 팩스 원고)를 만들어 ZIP 한 파일로. 거래처별로 팩스를 보낼 때 쓴다. */
export async function exportSlipsZipPerCustomer(opts: { slips: Slip[]; config: SystemConfig; customers: Customer[]; filename: string; handle?: any; copies?: SlipCopies; onProgress?: (p: PdfProgress) => void }): Promise<{ files: number; pages: number; bytes: number }> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const groups = new Map<string, Slip[]>();
  opts.slips.forEach(s => { const k = s.customerId || s.customerName; groups.set(k, [...(groups.get(k) || []), s]); });
  const { safeName } = await import('./pdfExport');
  let done = 0, pages = 0; const used = new Set<string>();
  for (const [, list] of groups) {
    list.sort((a, b) => a.slipDate.localeCompare(b.slipDate) || a.slipNo.localeCompare(b.slipNo));
    const r = await buildSlipsPdfBytes(list, opts.config, opts.customers, opts.copies || 'recipient', opts.onProgress, done, opts.slips.length);
    done += list.length; pages += r.pages;
    const d0 = list[0].slipDate, d1 = list[list.length - 1].slipDate;
    let name = `${safeName(`${list[0].customerName}_${d0 === d1 ? d0 : `${d0}~${d1}`}_${list.length}건`)}.pdf`;
    for (let n = 2; used.has(name); n++) name = name.replace(/\.pdf$/, `_${n}.pdf`);
    used.add(name);
    zip.file(name, r.bytes);
  }
  opts.onProgress?.({ done: opts.slips.length, total: opts.slips.length, label: '압축해서 저장 중' });
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' }); // PDF는 이미 압축돼 있어 저장만
  await savePdfBytes(bytes, opts.filename, opts.handle, 'application/zip');
  return { files: groups.size, pages, bytes: bytes.length };
}
