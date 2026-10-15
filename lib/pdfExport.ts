// 인쇄 양식 → 벡터 PDF 내보내기.
// 우리 원본 양식 렌더러(OriginalSlipForm·OriginalFormReport·RptReportPrint)는 전부 «절대 위치 상자(left·top·width·height는 mm, 글자 크기는 pt)»로 그려지므로,
// 그 DOM의 인라인 스타일을 읽어 PDF에 글자(나눔고딕 부분 내장)·선·상자·도장 그림으로 그대로 옮긴다.
// 비트맵(html2canvas)이 아니라서 글자가 선명하고 선택·검색되며 용량이 작다.
// 지름길: 글자 가로 눌림(scaleX)·정렬·세로 가운데는 CSS 규칙을 흉내 낸 것이다(실제 렌더와 ±0.3mm 차이 가능). 도장은 흰 배경을 투명으로 바꿔(곱하기 합성 흉내) 넣는다.
import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, pushGraphicsState, popGraphicsState, concatTransformationMatrix } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const PT = 72 / 25.4; // 1mm = 2.8346pt
const mmOf = (v: string | null | undefined) => { const n = parseFloat(v || ''); return Number.isFinite(n) ? n : 0; };
const ptOf = (v: string | null | undefined) => { const n = parseFloat(v || ''); return Number.isFinite(n) ? n : 9; };

export interface PdfBuilder {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  images: Map<string, PDFImage>;
  pageCount: number;
}

export async function createPdfBuilder(): Promise<PdfBuilder> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const load = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`글꼴을 불러오지 못했습니다: ${url} (${res.status})`);
    return res.arrayBuffer();
  };
  const [r, b] = await Promise.all([load('/fonts/NanumGothic-Regular.ttf'), load('/fonts/NanumGothic-Bold.ttf')]);
  const regular = await doc.embedFont(r, { subset: true });
  const bold = await doc.embedFont(b, { subset: true });
  doc.setProducer('UNIBLE SALE 인쇄 양식 PDF');
  doc.setCreator('UNIBLE SALE');
  return { doc, regular, bold, images: new Map(), pageCount: 0 };
}

// 도장 같은 «흰 배경 그림» → 흰색을 투명으로(곱하기 합성 흉내) 한 PNG로 만들어 넣는다.
async function embedStamp(b: PdfBuilder, src: string): Promise<PDFImage> {
  const cached = b.images.get(src);
  if (cached) return cached;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error(`그림을 불러오지 못했습니다: ${src}`)); i.src = src; });
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const cx = cv.getContext('2d')!;
  cx.drawImage(img, 0, 0);
  const data = cx.getImageData(0, 0, cv.width, cv.height);
  for (let i = 0; i < data.data.length; i += 4) {
    const m = Math.min(data.data[i], data.data[i + 1], data.data[i + 2]);
    data.data[i + 3] = Math.min(255, (255 - m) * 1.6); // 흰색일수록 투명, 붉은 획은 진하게
  }
  cx.putImageData(data, 0, 0);
  const blob: Blob = await new Promise((res, rej) => cv.toBlob(bl => (bl ? res(bl) : rej(new Error('그림 변환 실패'))), 'image/png'));
  const png = await b.doc.embedPng(await blob.arrayBuffer());
  b.images.set(src, png);
  return png;
}

type Walk = { page: PDFPage; H: number; b: PdfBuilder };

function drawLine(w: Walk, x1: number, y1: number, x2: number, y2: number, thick: number) {
  w.page.drawLine({ start: { x: x1 * PT, y: (w.H - y1) * PT }, end: { x: x2 * PT, y: (w.H - y2) * PT }, thickness: Math.max(0.2, thick * PT), color: rgb(0, 0, 0) });
}

async function walk(w: Walk, el: HTMLElement) {
  for (const child of Array.from(el.children) as HTMLElement[]) {
    const st = child.style;
    if (child.tagName === 'IMG') {
      const src = child.getAttribute('src') || '';
      if (!src) continue;
      const png = await embedStamp(w.b, src);
      const x = mmOf(st.left), y = mmOf(st.top), wd = mmOf(st.width), ht = mmOf(st.height);
      if (wd > 0 && ht > 0) w.page.drawImage(png, { x: x * PT, y: (w.H - y - ht) * PT, width: wd * PT, height: ht * PT });
      continue;
    }
    if (child.tagName !== 'DIV') continue;
    const x = mmOf(st.left), y = mmOf(st.top), wd = mmOf(st.width), ht = mmOf(st.height);
    // 선·상자
    const bt = st.borderTopStyle && st.borderTopStyle !== 'none', bl = st.borderLeftStyle && st.borderLeftStyle !== 'none';
    const br = st.borderRightStyle && st.borderRightStyle !== 'none', bb = st.borderBottomStyle && st.borderBottomStyle !== 'none';
    if (bt && bl && br && bb) {
      const t = mmOf(st.borderTopWidth) || 0.25;
      drawLine(w, x, y, x + wd, y, t); drawLine(w, x, y + ht, x + wd, y + ht, t); drawLine(w, x, y, x, y + ht, t); drawLine(w, x + wd, y, x + wd, y + ht, t);
      continue;
    }
    if (bt && !bl) { drawLine(w, x, y, x + wd, y, mmOf(st.borderTopWidth) || 0.25); continue; }
    if (bl && !bt) { drawLine(w, x, y, x, y + ht, mmOf(st.borderLeftWidth) || 0.25); continue; }
    // 글자(자식 요소가 없거나 눌림용 span 하나뿐인 상자)
    const kids = Array.from(child.children) as HTMLElement[];
    const onlySpan = kids.length === 1 && kids[0].tagName === 'SPAN';
    if (kids.length === 0 || onlySpan) {
      const text = (child.textContent || '').replace(/ /g, ' ');
      if (text.trim()) {
        const size = ptOf(st.fontSize);
        const font = parseInt(st.fontWeight || '400', 10) >= 600 ? w.b.bold : w.b.regular;
        const align = (onlySpan ? kids[0].style.textAlign : '') || st.textAlign || 'left';
        const m = onlySpan ? /scaleX\(([\d.]+)\)/.exec(kids[0].style.transform || '') : null;
        let k = m ? parseFloat(m[1]) : 1;
        let tw = font.widthOfTextAtSize(text, size) / PT; // mm
        if (tw * k > wd * 1.02 && wd > 0) k = Math.max(0.8, (wd * 1.02) / tw); // PDF 글꼴(나눔고딕)이 화면 글꼴보다 넓을 때를 대비한 안전 눌림(0.8배까지, 화면 미리보기와 같은 한도)
        let shown = text;
        if (wd > 0 && tw * k > wd * 1.02) { // 그래도 넘치면 화면(overflow:hidden)처럼 끝을 자른다
          while (shown.length > 1 && (font.widthOfTextAtSize(shown, size) / PT) * k > wd * 1.02) shown = shown.slice(0, -1);
          tw = font.widthOfTextAtSize(shown, size) / PT;
        }
        const drawn = tw * k;
        let tx = x;
        if (align === 'right') tx = x + wd - drawn; else if (align === 'center') tx = x + (wd - drawn) / 2;
        // 세로: 줄 높이=상자 높이인 가운데 정렬 → 기준선은 가운데에서 글자 크기의 약 0.34배 아래
        const baseY = y + ht / 2 + (size / PT) * 0.34;
        const X = tx * PT, Y = (w.H - baseY) * PT;
        if (k !== 1) {
          w.page.pushOperators(pushGraphicsState(), concatTransformationMatrix(k, 0, 0, 1, X * (1 - k), 0));
          w.page.drawText(shown, { x: X, y: Y, size, font, color: rgb(0, 0, 0) });
          w.page.pushOperators(popGraphicsState());
        } else {
          w.page.drawText(shown, { x: X, y: Y, size, font, color: rgb(0, 0, 0) });
        }
      }
      continue;
    }
    await walk(w, child);
  }
}

/** 페이지 상자(data-pdf-page, 인라인 width·height가 mm) 하나를 PDF 한 쪽으로 옮긴다. */
export async function appendDomPage(b: PdfBuilder, el: HTMLElement) {
  const wmm = mmOf(el.style.width), hmm = mmOf(el.style.height);
  if (!wmm || !hmm) throw new Error('쪽 크기를 알 수 없습니다(data-pdf-page 상자에 mm 크기가 필요).');
  // 원본 양식은 쪽 높이가 A4보다 조금 짧거나 같다 — A4(210×297 또는 가로 297×210)에 위쪽을 맞춰 넣어, 프린터·메일에서 같은 용지로 다뤄지게 한다.
  const portraitA4 = Math.abs(wmm - 210) < 1.5 && hmm <= 297.5, landscapeA4 = Math.abs(wmm - 297) < 1.5 && hmm <= 210.5;
  const PW = portraitA4 ? 210 : landscapeA4 ? 297 : wmm, PH = portraitA4 ? 297 : landscapeA4 ? 210 : hmm;
  const page = b.doc.addPage([PW * PT, PH * PT]);
  b.pageCount++;
  await walk({ page, H: PH, b }, el);
}

export async function finishPdf(b: PdfBuilder): Promise<Uint8Array> {
  return b.doc.save();
}

/** 파일로 저장: 저장 위치 선택 창(지원 브라우저) → 안 되면 내려받기. 반환 true=저장됨, false=취소. */
export async function savePdfBytes(bytes: Uint8Array, filename: string, handle?: any): Promise<boolean> {
  const cap = (typeof window !== 'undefined' ? (window as any).__pdfCapture : null); // 자동 시험용 연결 고리(없으면 무시)
  if (cap) { cap(bytes, filename); return true; }
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  if (handle) { const wr = await handle.createWritable(); await wr.write(blob); await wr.close(); return true; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}

/** 저장 위치 선택 창은 «사용자 클릭 직후»에만 열 수 있으므로, 긴 작업 전에 먼저 호출해 핸들을 받아 둔다. 취소하면 null. */
export async function askSaveHandle(suggestedName: string): Promise<any | null | undefined> {
  const w = window as any;
  if (w.__pdfCapture || !w.showSaveFilePicker) return undefined; // 시험 연결 고리가 있거나 미지원이면 저장 창 없이 진행 // 지원 안 함 → 내려받기로 처리
  try {
    return await w.showSaveFilePicker({ suggestedName, types: [{ description: 'PDF 문서', accept: { 'application/pdf': ['.pdf'] } }] });
  } catch (e: any) {
    if (e?.name === 'AbortError') return null;
    throw e;
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80);
