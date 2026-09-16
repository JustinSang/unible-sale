export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { loadStore, saveStore } from '@/lib/store';
import type { Bill } from '@/types';

export async function GET() {
  const store = loadStore();
  return NextResponse.json(store.bills || []);
}

export async function POST(req: Request) {
  try {
    const body: Partial<Bill> = await req.json();
    const store = loadStore();

    const newBill: Bill = {
      id: `b-${Date.now()}`,
      billNo: body.billNo || `BILL-${Date.now().toString().slice(-6)}`,
      billKind: body.billKind || '받을어음',
      amount: Number(body.amount) || 0,
      issueDate: body.issueDate || new Date().toISOString().slice(0, 10),
      dueDate: body.dueDate || new Date().toISOString().slice(0, 10),
      customerName: body.customerName || '미지정 거래처',
      bank: body.bank || '국민은행',
      status: body.status || '정상',
      memo: body.memo || ''
    };

    if (!store.bills) store.bills = [];
    store.bills.unshift(newBill);
    saveStore(store);

    return NextResponse.json(newBill, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '어음 등록 실패' }, { status: 500 });
  }
}
