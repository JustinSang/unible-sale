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
        // 숫자·날짜(원본 굴림체는 영숫자 폭이 글자 크기의 절반이라 칸이 좁다)는 끝 글자가 잘리면 값이 달라지므로 절대 자르지 않고 더 눌러서 넣는다.
        const numeric = /^[\d,.\-~:()/₩원%+\s]+$/.test(text.trim());
        const floorK = numeric ? 0.5 : 0.8;
        if (tw * k > wd * 1.02 && wd > 0) k = Math.max(floorK, (wd * 1.02) / tw); // PDF 글꼴(나눔고딕)이 화면 글꼴보다 넓을 때를 대비한 안전 눌림(글자는 0.8배, 숫자는 0.5배까지)
        let shown = text;
        if (!numeric && wd > 0 && tw * k > wd * 1.02) { // 그래도 넘치면 화면(overflow:hidden)처럼 끝을 자른다
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

// ───────── 흐름 배치 화면(거래명세표 A4·80mm 영수증)용 벡터 변환 ─────────
// 원본 양식은 «절대 위치 상자»라 위의 appendDomPage를 쓰지만, 이 두 화면은 일반 웹 배치(표·flex)라 DOM의 «실제 위치(getBoundingClientRect)와 계산된 스타일»을 읽어
// 배경·테두리·글자(줄마다)·그림을 PDF로 옮긴다. 화면에 보이는 그대로가 목표이며 비트맵이 아니라서 글자가 선택·검색된다.
// 지름길: 둥근 모서리·그림자·그라데이션·SVG 아이콘은 그리지 않는다. 쪽 경계에 걸친 글자 줄은 윗부분이 있는 쪽에 통째로 그린다(배경·선은 쪽마다 잘라 그림).
const colorCache = new Map<string, [number, number, number, number]>();
let colorCx: CanvasRenderingContext2D | null = null;
function parseColor(css: string): [number, number, number, number] {
  const hit = colorCache.get(css); if (hit) return hit;
  if (!colorCx) { const c = document.createElement('canvas'); c.width = c.height = 1; colorCx = c.getContext('2d', { willReadFrequently: true }); }
  const cx = colorCx!; cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); // oklch·lab 같은 새 색 표기도 브라우저가 풀어 준다
  const d = cx.getImageData(0, 0, 1, 1).data;
  const out: [number, number, number, number] = [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255];
  colorCache.set(css, out); return out;
}
async function embedPlainImage(b: PdfBuilder, img: HTMLImageElement): Promise<PDFImage | null> {
  const key = img.currentSrc || img.src;
  const cached = b.images.get('flow:' + key); if (cached) return cached;
  if (!img.naturalWidth) return null;
  const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  try {
    cv.getContext('2d')!.drawImage(img, 0, 0);
    const blob: Blob = await new Promise((res, rej) => cv.toBlob(bl => (bl ? res(bl) : rej(new Error('그림 변환 실패'))), 'image/png'));
    const png = await b.doc.embedPng(await blob.arrayBuffer());
    b.images.set('flow:' + key, png); return png;
  } catch { return null; } // 다른 출처 그림(canvas 오염)은 건너뛴다
}

type FlowOp =
  | { k: 'rect'; x: number; y: number; w: number; h: number; c: [number, number, number, number] }
  | { k: 'text'; x: number; y: number; w: number; fs: number; bold: boolean; s: string; c: [number, number, number, number] }
  | { k: 'img'; x: number; y: number; w: number; h: number; png: PDFImage };

export interface FlowOpts { pageWidthMm: number; pageHeightMm?: number; marginMm: number }

/** 흐름 배치 화면 한 덩어리(root)를 PDF로. pageHeightMm가 없으면 내용 높이만큼 한 쪽(영수증), 있으면 그 높이로 여러 쪽(A4). */
export async function appendFlowPages(b: PdfBuilder, root: HTMLElement, o: FlowOpts) {
  const rr = root.getBoundingClientRect();
  if (!rr.width || !rr.height) throw new Error('인쇄 영역의 크기를 알 수 없습니다.');
  const s = (o.pageWidthMm - 2 * o.marginMm) / rr.width; // 화면 px → mm
  const pxMm = 25.4 / 96;
  const ops: FlowOp[] = [];
  const X = (px: number) => (px - rr.left) * s + o.marginMm, Y = (px: number) => (px - rr.top) * s; // Y는 위쪽 여백 제외 내용 기준
  const charset = new Set<number>([...b.regular.getCharacterSet()]);
  const pushRect = (x1: number, y1: number, x2: number, y2: number, c: [number, number, number, number]) => { if (c[3] > 0.02 && x2 > x1 && y2 > y1) ops.push({ k: 'rect', x: X(x1), y: Y(y1), w: (x2 - x1) * s, h: (y2 - y1) * s, c }); };
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'svg', 'INPUT', 'SELECT', 'TEXTAREA', 'OPTION', 'BUTTON', 'CANVAS']);
  const visit = async (el: HTMLElement) => {
    if (SKIP.has(el.tagName)) return;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) === 0) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && el !== root) { // 바깥 종이(root)의 테두리·그림자·배경은 PDF 쪽 자체라 그리지 않는다
      const bg = parseColor(st.backgroundColor); if (bg[3] > 0) pushRect(r.left, r.top, r.right, r.bottom, bg);
      const side = (w: string, sty: string, col: string) => (sty !== 'none' && sty !== 'hidden' && parseFloat(w) > 0 ? { w: Math.max(parseFloat(w), 0.5), c: parseColor(col) } : null);
      const bt = side(st.borderTopWidth, st.borderTopStyle, st.borderTopColor), bb = side(st.borderBottomWidth, st.borderBottomStyle, st.borderBottomColor);
      const bl = side(st.borderLeftWidth, st.borderLeftStyle, st.borderLeftColor), br = side(st.borderRightWidth, st.borderRightStyle, st.borderRightColor);
      if (bt) pushRect(r.left, r.top, r.right, r.top + bt.w, bt.c);
      if (bb) pushRect(r.left, r.bottom - bb.w, r.right, r.bottom, bb.c);
      if (bl) pushRect(r.left, r.top, r.left + bl.w, r.bottom, bl.c);
      if (br) pushRect(r.right - br.w, r.top, r.right, r.bottom, br.c);
      if (el.tagName === 'IMG') {
        const png = await embedPlainImage(b, el as HTMLImageElement);
        if (png) ops.push({ k: 'img', x: X(r.left), y: Y(r.top), w: r.width * s, h: r.height * s, png });
        return;
      }
    }
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 1) await visit(node as HTMLElement);
      else if (node.nodeType === 3) {
        const text = node.textContent || '';
        if (!text.trim()) continue;
        const fsPx = parseFloat(st.fontSize) || 12, bold = parseInt(st.fontWeight || '400', 10) >= 600, col = parseColor(st.color);
        const range = document.createRange();
        // 화면에서 잘려 보이는 글자(overflow hidden/clip + 말줄임)는 PDF에서도 같은 상자 밖을 버린다.
        let clip: DOMRect | null = null;
        for (let a: HTMLElement | null = el; a && a !== root.parentElement; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.overflowX !== 'visible') { clip = a.getBoundingClientRect(); break; } }
        const ellipsis = st.textOverflow === 'ellipsis';
        let run: { s: string; l: number; r: number; t: number; h: number } | null = null;
        let cut = false;
        const flush = () => { if (run && run.s.trim()) { const more = cut && ellipsis && charset.has(0x2026); ops.push({ k: 'text', x: X(run.l), y: Y(run.t + run.h * 0.795), w: (run.r - run.l) * s * (more ? 1.06 : 1), fs: fsPx * pxMm * (s / pxMm), bold, s: run.s + (more ? '…' : ''), c: col }); } run = null; cut = false; };
        for (let i = 0; i < text.length; i++) {
          range.setStart(node, i); range.setEnd(node, i + 1);
          const rc = range.getClientRects()[0];
          if (!rc || (rc.width === 0 && rc.height === 0)) continue;
          if (clip && (rc.right > clip.right + 0.5 || rc.left < clip.left - 0.5 || rc.bottom > clip.bottom + 1 || rc.top < clip.top - 1)) { cut = true; continue; }
          if (run && Math.abs(rc.top - run.t) < fsPx * 0.5 && rc.left >= run.r - 1) { run.s += text[i]; run.r = Math.max(run.r, rc.right); }
          else { flush(); run = { s: text[i], l: rc.left, r: rc.right, t: rc.top, h: rc.height }; }
        }
        flush();
      }
    }
  };
  await visit(root);

  // 종이 상자가 고정 높이여도 내용이 넘칠 수 있으니, 실제로 그린 것의 맨 아래까지 높이로 잡는다.
  const contentH = Math.max(rr.height * s, ...ops.map(op => (op.k === 'text' ? op.y + op.fs * 0.3 : op.y + op.h)));
  const PH = o.pageHeightMm ?? contentH + 2 * o.marginMm, ch = PH - 2 * o.marginMm;
  const pages = Math.max(1, Math.ceil((contentH - 1.5) / ch)); // 1.5mm 이하 넘침은 반올림 오차로 보고 새 쪽을 만들지 않는다
  for (let p = 0; p < pages; p++) {
    const page = b.doc.addPage([o.pageWidthMm * PT, PH * PT]); b.pageCount++;
    const top = p * ch, bot = top + ch, oy = o.marginMm - top; // 내용 y → 쪽 y(mm)
    const yPt = (mmY: number) => (PH - mmY) * PT;
    for (const op of ops) {
      if (op.k === 'text') {
        if (op.y < top || op.y >= bot + 0.01) continue; // 기준선이 이 쪽 안에 있는 글자만
        const font = op.bold ? b.bold : b.regular;
        const shown = Array.from(op.s).filter(ch2 => charset.has(ch2.codePointAt(0)!) || ch2 === ' ').join('');
        if (!shown.trim()) continue;
        const size = op.fs * PT; // pt
        let k = 1;
        try {
          const wPdf = font.widthOfTextAtSize(shown, size) / PT; // mm
          if (wPdf > 0) k = Math.min(1.2, Math.max(0.6, op.w / wPdf)); // 화면 글꼴 폭에 맞춰 가로를 눌러/늘려 줄 끝이 어긋나지 않게
        } catch { continue; }
        const Xp = op.x * PT, Yp = yPt(op.y + oy);
        const color = rgb(op.c[0], op.c[1], op.c[2]);
        page.pushOperators(pushGraphicsState(), concatTransformationMatrix(k, 0, 0, 1, Xp * (1 - k), 0));
        page.drawText(shown, { x: Xp, y: Yp, size, font, color });
        page.pushOperators(popGraphicsState());
      } else {
        const y1 = Math.max(op.y, top), y2 = Math.min(op.y + op.h, bot);
        if (y2 <= y1) continue;
        if (op.k === 'rect') page.drawRectangle({ x: op.x * PT, y: yPt(y2 + oy), width: op.w * PT, height: (y2 - y1) * PT, color: rgb(op.c[0], op.c[1], op.c[2]), opacity: op.c[3] });
        else page.drawImage(op.png, { x: op.x * PT, y: yPt(op.y + op.h + oy), width: op.w * PT, height: op.h * PT }); // 쪽 경계에 걸친 그림도 사라지지 않게 겹치는 쪽마다 그린다
      }
    }
  }
}

export async function finishPdf(b: PdfBuilder): Promise<Uint8Array> {
  return b.doc.save();
}

/** 파일로 저장: 저장 위치 선택 창(지원 브라우저) → 안 되면 내려받기. 반환 true=저장됨, false=취소. */
export async function savePdfBytes(bytes: Uint8Array, filename: string, handle?: any, mime = 'application/pdf'): Promise<boolean> {
  const cap = (typeof window !== 'undefined' ? (window as any).__pdfCapture : null); // 자동 시험용 연결 고리(없으면 무시)
  if (cap) { cap(bytes, filename); return true; }
  const blob = new Blob([bytes as BlobPart], { type: mime });
  if (handle) { const wr = await handle.createWritable(); await wr.write(blob); await wr.close(); return true; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}

/** 저장 위치 선택 창은 «사용자 클릭 직후»에만 열 수 있으므로, 긴 작업 전에 먼저 호출해 핸들을 받아 둔다. 취소하면 null. */
export async function askSaveHandle(suggestedName: string, kind: 'pdf' | 'zip' = 'pdf'): Promise<any | null | undefined> {
  const w = window as any;
  if (w.__pdfCapture || !w.showSaveFilePicker) return undefined; // 시험 연결 고리가 있거나 미지원이면 저장 창 없이 진행 // 지원 안 함 → 내려받기로 처리
  try {
    return await w.showSaveFilePicker({ suggestedName, types: [kind === 'zip' ? { description: 'ZIP 압축 파일', accept: { 'application/zip': ['.zip'] } } : { description: 'PDF 문서', accept: { 'application/pdf': ['.pdf'] } }] });
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
