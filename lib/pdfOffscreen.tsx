'use client';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { appendDomPage, type PdfBuilder } from './pdfExport';

// React 요소를 화면 밖에서 그려 그 안의 [data-pdf-page] 상자들을 PDF 쪽으로 옮긴다(미리보기 창의 줄 상한과 무관하게 전체를 낼 수 있다).
export async function appendReactPages(b: PdfBuilder, element: React.ReactElement): Promise<number> {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => { root.render(element); });
    const pages = Array.from(host.querySelectorAll<HTMLElement>('[data-pdf-page]'));
    for (const pg of pages) await appendDomPage(b, pg);
    return pages.length;
  } finally {
    root.unmount();
    host.remove();
  }
}
