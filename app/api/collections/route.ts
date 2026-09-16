import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase.from('collections').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { data: customer } = await supabase.from('customers').select('name, receivables').eq('id', data.customerId).single();
    
    const prevBalance = customer?.receivables || 0;
    let currentBalance = prevBalance;
    if (data.type === 'collection') {
      currentBalance = Math.max(0, prevBalance - data.amount);
    } else {
      currentBalance = prevBalance + data.amount;
    }

    const record = {
      id: `cp-${Date.now()}`,
      date: data.date || new Date().toISOString().slice(0, 10),
      type: data.type,
      customerId: data.customerId,
      customerName: customer?.name || '미지정 거래처',
      method: data.method,
      amount: data.amount,
      prevBalance,
      currentBalance,
      memo: data.memo || ''
    };

    const { error: insertError } = await supabase.from('collections').insert(record);
    if (insertError) throw new Error(insertError.message);

    const { error: updateError } = await supabase.from('customers').update({ receivables: currentBalance }).eq('id', data.customerId);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json(record, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '수금/지급 등록 실패' }, { status: 500 });
  }
}
