import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { openingConfig, syncReceivables } from '@/lib/receivables';
import { audit } from '@/lib/audit';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const { data: slip } = await supabase.from('slips').select('*').eq('id', id).maybeSingle();
    if (!slip) {
      return NextResponse.json({ error: '전표를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Rollback customer receivables (매출 외상분)
    const opCfg = await openingConfig();
    if (!opCfg && slip.slipType === 'SALES') {
      const { data: cust } = await supabase.from('customers').select('receivables').eq('id', slip.customerId).maybeSingle();
      if (cust) {
        const next = Math.max(0, (cust.receivables || 0) - (slip.unpaidAmount || 0));
        await supabase.from('customers').update({ receivables: next }).eq('id', slip.customerId);
      }
    }

    // Rollback stock (전표 저장 때와 반대 방향)
    for (const item of slip.items || []) {
      if (!item.productId) continue;
      const st = slip.slipType;
      const delta = st === 'SALES' || st === 'RETURN_OUT' ? item.qty : st === 'PURCHASE' || st === 'RETURN_IN' ? -item.qty : 0;
      if (delta === 0) continue;
      const { data: p } = await supabase.from('products').select('currentStock').eq('id', item.productId).maybeSingle();
      if (p) await supabase.from('products').update({ currentStock: p.currentStock + delta }).eq('id', item.productId);
    }

    await supabase.from('deliveries').delete().eq('slipId', id);
    const { error } = await supabase.from('slips').delete().eq('id', id);
    if (error) throw new Error(error.message);
    if (opCfg) await syncReceivables(String(slip.customerId || ''), opCfg); // 장부 방식: 지운 뒤 장부 잔액으로 다시 맞춘다

    await audit('delete', 'slip', id, `전표 삭제: ${slip.slipNo} ${slip.customerName} ${Number(slip.totalAmount || 0).toLocaleString('ko-KR')}원`, slip); // 전체 내용을 남겨 복원 가능
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '전표 삭제 실패' }, { status: 500 });
  }
}

// 전표 진행상태만 바꾼다(금액·재고·미수금은 건드리지 않는다).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { progressStatus } = await req.json();
    if (!['open', 'hold', 'done', 'cancel'].includes(progressStatus)) {
      return NextResponse.json({ error: '진행상태는 진행중·보류·완료·취소 중 하나여야 합니다.' }, { status: 400 });
    }
    const { data: slip } = await supabase.from('slips').select('id, slipNo, progressStatus').eq('id', id).maybeSingle();
    if (!slip) return NextResponse.json({ error: '전표를 찾을 수 없습니다.' }, { status: 404 });
    const { error } = await supabase.from('slips').update({ progressStatus }).eq('id', id);
    if (error) throw new Error(error.message);
    await audit('update', 'slip', id, `전표 진행상태: ${slip.slipNo} ${slip.progressStatus || 'open'} → ${progressStatus}`);
    return NextResponse.json({ success: true, id, progressStatus });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '진행상태 변경 실패' }, { status: 500 });
  }
}
