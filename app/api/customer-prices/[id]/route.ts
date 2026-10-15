import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { toPriceItem } from '@/lib/loadAll';

// 전표 입력 화면이 거래처를 고를 때 부르는 조회: { 품번: {price1, price2, price3, ...} }
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: customerId } = await params;
    const rows: any[] = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await supabase.from('customer_prices').select('*').eq('customerId', customerId).range(i, i + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    const out: Record<string, any> = {};
    rows.forEach(r => (out[r.productId] = toPriceItem(r)));
    return NextResponse.json(out);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '단가 조회 실패' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: customerId } = await params;
    const body = await req.json();
    const { productId, price, memo } = body;

    const { error } = await supabase.from('customer_prices').upsert(
      { customerId, productId, price: Number(price), price1: Number(price), memo: memo || '' },
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
