export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { loadStore, saveStore } from '@/lib/store';
import type { TaxInvoice } from '@/types';

export async function GET() {
  const store = loadStore();
  return NextResponse.json(store.taxInvoices || []);
}

export async function POST(req: Request) {
  try {
    const body: Partial<TaxInvoice> = await req.json();
    const store = loadStore();

    const supplyAmount = Number(body.supplyAmount) || 0;
    const taxAmount = Number(body.taxAmount) || Math.round(supplyAmount * 0.1);
    const totalAmount = supplyAmount + taxAmount;

    const newTax: TaxInvoice = {
      id: `tax-${Date.now()}`,
      taxNo: body.taxNo || `TX-${Date.now().toString().slice(-8)}`,
      taxDate: body.taxDate || new Date().toISOString().slice(0, 10),
      customerName: body.customerName || '미지정 거래처',
      productSummary: body.productSummary || '화스너 및 배관자재 일체',
      supplyAmount,
      taxAmount,
      totalAmount,
      isIssued: body.isIssued !== undefined ? body.isIssued : true,
      memo: body.memo || ''
    };

    if (!store.taxInvoices) store.taxInvoices = [];
    store.taxInvoices.unshift(newTax);
    saveStore(store);

    return NextResponse.json(newTax, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '세금계산서 발행 실패' }, { status: 500 });
  }
}
