export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Bill } from '@/types';

export async function GET() {
  const { data, error } = await supabase.from('bills').select('*').order('issueDate', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: Request) {
  try {
    const body: Partial<Bill> = await req.json();
    const newBill: Bill = {
      id: `b-${Date.now()}`,
      billNo: body.billNo || `BILL-${Date.now().toString().slice(-6)}`,
      billKind: body.billKind || '받을어음',
      amount: Number(body.amount) || 0,
      issueDate: body.issueDate || new Date().toISOString().slice(0, 10),
      dueDate: body.dueDate || new Date().toISOString().slice(0, 10),
      customerName: body.customerName || '미지정 거래처',
      bank: body.bank || '국민은행',
      status: body.status || (body.billKind === '지급어음' ? '미결제' : '보유'),
      memo: body.memo || '',
      ...Object.fromEntries(['receiptDate', 'issuer', 'issueSite', 'payBank', 'payCustomerName', 'payDate'].filter(k => (body as Record<string, unknown>)[k]).map(k => [k, (body as Record<string, unknown>)[k]]))
    };

    const { error } = await supabase.from('bills').insert(newBill);
    if (error) throw new Error(error.message);

    return NextResponse.json(newBill, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '어음 등록 실패' }, { status: 500 });
  }
}
