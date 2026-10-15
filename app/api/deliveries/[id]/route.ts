import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { DeliveryOrder } from '@/types';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const updates: Partial<DeliveryOrder> = await req.json();
    const { id: _ignored, ...fields } = updates;

    const { data, error } = await supabase.from('deliveries').update(fields).eq('id', id).select().maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json({ error: '배송 주문을 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '배송 정보 수정 실패' }, { status: 500 });
  }
}
