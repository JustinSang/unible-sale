export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { audit } from '@/lib/audit';

export async function GET() {
  const { data, error } = await supabase.from('collections').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { data: customer } = await supabase.from('customers').select('name, receivables').eq('id', data.customerId).single();
    
    // 처리 전 잔액은 화면이 계산해 보낸다(기초잔액·전표·수금을 모두 합친 값). 없으면 거래처 누계(receivables)를 쓴다.
    // 부호: 미수금 +, 미지급금 −. 수금은 잔액을 줄이고 지급은 늘린다(0 아래로도 내려갈 수 있다 — 원본은 받을 금액 +·줄 금액 −로 관리).
    const prevBalance = Number.isFinite(Number(data.prevBalance)) && data.prevBalance !== null && data.prevBalance !== '' ? Number(data.prevBalance) : (customer?.receivables || 0);
    const amount = Number(data.amount) || 0;
    const discount = Number(data.discount) || 0;
    const currentBalance = data.type === 'collection' ? prevBalance - amount - discount : prevBalance + amount + discount;

    const record = {
      id: `cp-${Date.now()}`,
      date: data.date || new Date().toISOString().slice(0, 10),
      type: data.type,
      customerId: data.customerId,
      customerName: customer?.name || '미지정 거래처',
      method: data.method,
      amount,
      discount,
      billNo: data.billNo || '',
      prevBalance,
      currentBalance,
      memo: data.memo || ''
    };

    const { error: insertError } = await supabase.from('collections').insert(record);
    if (insertError) throw new Error(insertError.message);

    const { error: updateError } = await supabase.from('customers').update({ receivables: currentBalance }).eq('id', data.customerId);
    if (updateError) throw new Error(updateError.message);

    await audit('create', 'collection', String((record as any).id), `${(record as any).type === 'payment' ? '지급' : '수금'} 등록: ${(record as any).customerName} ${Number((record as any).amount || 0).toLocaleString('ko-KR')}원`, { date: (record as any).date, amount: (record as any).amount, discount: (record as any).discount ?? 0, method: (record as any).method ?? null, billNo: (record as any).billNo ?? null });
    return NextResponse.json(record, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '수금/지급 등록 실패' }, { status: 500 });
  }
}
