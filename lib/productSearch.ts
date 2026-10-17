// 전표 입력의 품목 검색. mode 'basic' = 기존 방식 그대로(입력한 글자 전체가 이름·코드·규격·분류·바코드 중 하나에 들어 있는 품목, 앞에서 60건).
// mode 'words' = 띄어 쓴 단어가 «모두» 이름·규격·코드·분류·바코드·다른명칭을 합친 글자에 들어 있는 품목 — «볼트 3/8»·«앙카 1/2»처럼 품명과 규격을 같이 쓴 검색이 된다.
// words 는 단어가 하나일 때 basic 과 같은 품목을 찾고(다른명칭까지 더 찾음), 결과는 품명이 첫 단어로 시작하는 품목을 먼저 둔다.
import type { Product } from '@/types';

export const SEARCH_LIMIT = 60;

export function searchProducts(products: Product[], keyword: string, mode: 'basic' | 'words' = 'basic'): Product[] {
  const raw = keyword.trim();
  if (!raw) return products.filter(p => !p.inactive).slice(0, 50);
  const q = (mode === 'words' ? raw : keyword).toLowerCase(); // basic 은 기존처럼 입력한 글자 그대로(앞뒤 공백 포함)
  const out: Product[] = [];
  if (mode === 'words') {
    const toks = q.split(/\s+/).filter(Boolean);
    const first = toks[0];
    const head: Product[] = [], rest: Product[] = [];
    for (const p of products) {
      if (p.inactive) continue;
      const hay = `${p.name} ${p.spec} ${p.code} ${p.category || ''} ${p.barcode || ''} ${p.nickName || ''}`.toLowerCase();
      if (!toks.every(t => hay.includes(t))) continue;
      (p.name.toLowerCase().startsWith(first) ? head : rest).push(p);
      if (head.length >= SEARCH_LIMIT) break;
    }
    out.push(...head, ...rest);
    out.length = Math.min(out.length, SEARCH_LIMIT);
  } else {
    for (const p of products) {
      if (p.inactive) continue;
      if (p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.spec.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q)) || (p.barcode && p.barcode.toLowerCase().includes(q))) {
        out.push(p);
        if (out.length >= SEARCH_LIMIT) break;
      }
    }
  }
  // 바코드 스캐너는 숫자열 + Enter로 입력된다 — 바코드가 정확히 같은 품목을 맨 앞에 둬서 Enter 한 번에 바로 선택되게 한다.
  const exact = out.findIndex(p => p.barcode && p.barcode.toLowerCase() === q);
  if (exact > 0) out.unshift(out.splice(exact, 1)[0]);
  return out;
}
