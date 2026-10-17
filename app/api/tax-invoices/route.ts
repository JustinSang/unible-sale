export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { audit } from '@/lib/audit';
import { normalizeOptions } from '@/lib/envOptions';
import type { TaxInvoice } from '@/types';

export async function GET() {
  const { data, error } = await supabase.from('tax_invoices').select('*').order('taxDate', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: Request) {
  try {
    const body: Partial<TaxInvoice> = await req.json();
    const supplyAmount = Number(body.supplyAmount) || 0;
    const { data: cfgRow } = await supabase.from('system_config').select('config').eq('id', 'default').maybeSingle();
    const taxAmount = Number(body.taxAmount) || Math.round(supplyAmount * (normalizeOptions(cfgRow?.config?.options).vatRate / 100));
    const totalAmount = supplyAmount + taxAmount;

    const newTax: TaxInvoice = {
      id: `tax-${Date.now()}`,
      taxNo: body.taxNo || `TX-${Date.now().toString().slice(-8)}`,
      taxDate: body.taxDate || new Date().toISOString().slice(0, 10),
      taxKind: body.taxKind || '1',           // OkSale TaxKind (default: 매출)
      customerId: body.customerId,             // OkSale CustomerID
      customerName: body.customerName || '미지정 거래처',
      postId: body.postId,                     // OkSale PostID
      postName: body.postName,                 // OkSale Post (현장명)
      productSummary: body.productSummary || '화스너 및 배관자재 일체',
      spec: body.spec,                         // OkSale Spec
      qty: body.qty,                           // OkSale Qty
      unitPrice: body.unitPrice,               // OkSale UnitPrice
      emptyCount: body.emptyCount,             // OkSale EmptyCount
      supplyAmount,
      taxAmount,
      totalAmount,
      isIssued: body.isIssued !== undefined ? body.isIssued : true,
      checkReceipt: body.checkReceipt || '영수', // OkSale CheckReceipt
      checkSale: body.checkSale || '1',          // OkSale CheckSale
      ntsIssueId: body.ntsIssueId,              // OkSale AccountBookNo
      memo: body.memo || ''
    };

    const { error } = await supabase.from('tax_invoices').insert(newTax);
    if (error) throw new Error(error.message);

    await audit('create', 'taxInvoice', String((newTax as any).id), `세금계산서 발행: ${(newTax as any).customerName ?? ''} ${Number((newTax as any).totalAmount ?? (newTax as any).supplyAmount ?? 0).toLocaleString('ko-KR')}원`, newTax);
    return NextResponse.json(newTax, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '세금계산서 발행 실패' }, { status: 500 });
  }
}
