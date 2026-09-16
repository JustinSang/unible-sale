import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Customer } from '@/types';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const data: Partial<Customer> = await req.json();
    const { id } = await params;

    const { error } = await supabase.from('customers').update(data).eq('id', id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '거래처 수정 실패' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '거래처 삭제 실패' }, { status: 500 });
  }
}
