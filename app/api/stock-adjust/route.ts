export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { audit } from '@/lib/audit';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    let { productId, changeType, changeQty } = data;
    const { reason, adjustQty } = data;
    // 재고 조정 화면은 부호 있는 수량(adjustQty: +늘림/−줄임)을 보낸다 — 예전에는 이 값을 읽지 않아 재고가 null로 망가졌다(2026-10-17 발견).
    if (changeQty === undefined && adjustQty !== undefined) {
      const q = Number(adjustQty);
      changeType = q >= 0 ? 'adjust_plus' : 'adjust_minus';
      changeQty = Math.abs(q);
    }
    if (!productId || !Number.isFinite(Number(changeQty)) || !['adjust_plus', 'adjust_minus', 'in', 'out', 'return'].includes(changeType)) {
      return NextResponse.json({ error: '조정할 품목·수량·종류가 올바르지 않습니다.' }, { status: 400 });
    }
    changeQty = Number(changeQty);

    const { data: product } = await supabase.from('products').select('name, spec, currentStock').eq('id', productId).single();
    if (!product) throw new Error('Product not found');

    const beforeQty = product.currentStock;
    let afterQty = beforeQty;
    if (changeType === 'adjust_plus' || changeType === 'in' || changeType === 'return') {
      afterQty += changeQty;
    } else {
      afterQty = Math.max(0, beforeQty - changeQty);
    }

    const log = {
      id: `il-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      productId,
      productName: product.name,
      spec: product.spec,
      changeType,
      changeQty,
      beforeQty,
      afterQty,
      reason,
      createdAt: new Date().toISOString()
    };

    const { error: updateError } = await supabase.from('products').update({ currentStock: afterQty }).eq('id', productId);
    if (updateError) throw new Error(updateError.message);

    const { error: logError } = await supabase.from('inventory_logs').insert(log);
    if (logError) console.error('inventory_logs insert failed:', logError.message);

    await audit('update', 'stock', String(productId), `재고 조정: ${(log as any).productName ?? productId} ${(log as any).beforeQty ?? ''}→${afterQty}`, log);
    return NextResponse.json(log, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '재고 조정 실패' }, { status: 500 });
  }
}
