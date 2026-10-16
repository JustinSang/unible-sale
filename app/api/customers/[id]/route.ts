import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { audit, diffFields } from '@/lib/audit';
import type { Customer } from '@/types';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const data: Partial<Customer> = await req.json();
    const { id } = await params;

    const { data: before } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
    const { error } = await supabase.from('customers').update(data).eq('id', id);
    if (error) throw new Error(error.message);
    const diff = diffFields(before, data as Record<string, any>);
    if (Object.keys(diff).length) await audit('update', 'customer', id, `거래처 수정: ${before?.name ?? id} (${Object.keys(diff).join(', ')})`, diff);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '거래처 수정 실패' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data: before } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await audit('delete', 'customer', id, `거래처 삭제: ${before?.name ?? id}`, before);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '거래처 삭제 실패' }, { status: 500 });
  }
}
