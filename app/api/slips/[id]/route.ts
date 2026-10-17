import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { openingConfig, syncReceivables } from '@/lib/receivables';
import { audit } from '@/lib/audit';
import { applyOldSlipEffects } from '@/lib/slipEdit';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const { data: slip } = await supabase.from('slips').select('*').eq('id', id).maybeSingle();
    if (!slip) {
      return NextResponse.json({ error: '전표를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 미수금(매출 외상분)·재고를 되돌린다(수정 저장과 같은 규칙, 재고수불부에 기록)
    const opCfg = await openingConfig();
    await applyOldSlipEffects(slip, opCfg, 1, 'delete');

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
