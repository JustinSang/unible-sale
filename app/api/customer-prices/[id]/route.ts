import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: customerId } = await params;
    const body = await req.json();
    const { productId, price, memo } = body;

    const { error } = await supabase.from('customer_prices').upsert(
      { customerId, productId, price: Number(price), memo: memo || '' },
      { onConflict: 'customerId, productId' }
    );
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '단가 저장 실패' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: customerId } = await params;
    const url = new URL(req.url);
    const productId = url.searchParams.get('productId');
    
    if (!productId) throw new Error('Missing productId');

    const { error } = await supabase.from('customer_prices').delete().match({ customerId, productId });
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '단가 삭제 실패' }, { status: 500 });
  }
}
