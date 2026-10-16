import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { audit, diffFields } from '@/lib/audit';
import type { Bill } from '@/types';

// 어음 상태 변경(결제·할인·배서·부도·부도해제)·내용 수정과 삭제 — 원본 «Update Bill Set …»·«Delete From Bill Where BillNo=…»에 해당
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const patch: Partial<Bill> = await req.json();
    const { id } = await params;
    delete (patch as Partial<Bill>).id;
    const { data: before } = await supabase.from('bills').select('*').eq('id', id).maybeSingle();
    const { error } = await supabase.from('bills').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
    const diff = diffFields(before, patch as Record<string, any>);
    if (Object.keys(diff).length) await audit('update', 'bill', id, `어음 수정: ${before?.billNo ?? id} (${Object.keys(diff).join(', ')})`, diff);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '어음 수정 실패' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data: before } = await supabase.from('bills').select('*').eq('id', id).maybeSingle();
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await audit('delete', 'bill', id, `어음 삭제: ${before?.billNo ?? id}`, before);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '어음 삭제 실패' }, { status: 500 });
  }
}
