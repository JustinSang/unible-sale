export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { audit } from '@/lib/audit';

// 거래처 단가표 복사(원본 «단가표 복사»): 한 거래처의 품목별 단가1·2·3을 다른 거래처로 옮긴다.
// mode 'fill' = 받는 거래처에 없는 품목만 추가, 'overwrite' = 같은 품목은 보내는 쪽 단가로 덮어쓴다. dryRun이면 건수만 알려준다(쓰기 없음).
const clean = (id: unknown) => String(id || '').replace(/^c-/, '');
async function rowsOf(customerId: string) {
  const rows: any[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await supabase.from('customer_prices').select('*').eq('customerId', customerId).range(i, i + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export async function POST(req: Request) {
  try {
    const { fromId, toId, mode, dryRun } = await req.json();
    const from = clean(fromId), to = clean(toId);
    if (!from || !to) return NextResponse.json({ error: '보내는 거래처와 받는 거래처를 모두 고르세요.' }, { status: 400 });
    if (from === to) return NextResponse.json({ error: '같은 거래처로는 복사할 수 없습니다.' }, { status: 400 });
    if (mode !== 'fill' && mode !== 'overwrite') return NextResponse.json({ error: '복사 방식은 fill 또는 overwrite 입니다.' }, { status: 400 });

    const src = await rowsOf(from);
    const have = new Map((await rowsOf(to)).map(r => [String(r.productId), r]));
    const add = src.filter(r => !have.has(String(r.productId)));
    const same = src.filter(r => have.has(String(r.productId)));
    const changed = same.filter(r => { const h = have.get(String(r.productId)); return (h.price1 ?? h.price ?? 0) !== (r.price1 ?? r.price ?? 0) || (h.price2 ?? 0) !== (r.price2 ?? 0) || (h.price3 ?? 0) !== (r.price3 ?? 0); });
    const result = { 보내는_품목: src.length, 새로_추가: add.length, 이미_있음: same.length, 이미_있고_단가가_다름: changed.length };
    if (dryRun) return NextResponse.json({ dryRun: true, ...result });

    const write = mode === 'overwrite' ? [...add, ...changed] : add;
    for (const r of write) {
      const { error } = await supabase.from('customer_prices').upsert({ ...r, customerId: to });
      if (error) throw new Error(error.message);
    }
    await audit('create', 'customer_prices', to, `단가표 복사: ${from} → ${to} (${mode === 'overwrite' ? '덮어쓰기' : '없는 품목만'}) ${write.length}건`, result);
    return NextResponse.json({ success: true, 반영: write.length, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '단가표 복사 실패' }, { status: 500 });
  }
}
