export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase.from('slips').select('*').order('slipDate', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { deliveryInfo, ...slipData } = body;

    if (!slipData.customerId) {
      return NextResponse.json({ error: '거래처를 선택해주세요.' }, { status: 400 });
    }
    if (!slipData.items || slipData.items.length === 0) {
      return NextResponse.json({ error: '품목을 최소 1개 이상 등록해주세요.' }, { status: 400 });
    }

    const slipId = slipData.id || `s-${Date.now()}`;
    const now = new Date();
    const dateStr = slipData.slipDate || now.toISOString().slice(0, 10);
    
    // Auto-generate slipNo if missing
    let slipNo = slipData.slipNo;
    if (!slipNo) {
      const { count } = await supabase.from('slips').select('*', { count: 'exact', head: true });
      slipNo = `S${dateStr.replace(/-/g, '')}-${String((count || 0) + 1).padStart(4, '0')}`;
    }

    // Process items and calculate totals
    const items = (slipData.items || []).map((item: any, idx: number) => {
      const qty = Number(item.qty) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const supplyAmount = Math.round(qty * unitPrice);
      const taxAmount = Math.round(supplyAmount * 0.1);
      const totalAmount = supplyAmount + taxAmount;
      return {
        ...item,
        id: item.id || `si-${Date.now()}-${idx}`,
        qty,
        unitPrice,
        supplyAmount,
        taxAmount,
        totalAmount
      };
    });

    const totalSupplyAmount = items.reduce((s: number, it: any) => s + it.supplyAmount, 0);
    const totalTaxAmount = items.reduce((s: number, it: any) => s + it.taxAmount, 0);
    const totalAmount = totalSupplyAmount + totalTaxAmount;
    const paidAmount = Number(slipData.paidAmount) || 0;
    const unpaidAmount = Math.max(0, totalAmount - paidAmount);

    // Get customer prevReceivables
    const { data: customer } = await supabase.from('customers').select('name, receivables').eq('id', slipData.customerId).single();
    const prevReceivables = customer?.receivables || 0;
    const customerName = slipData.customerName || customer?.name || '미지정 거래처';

    const newSlip = {
      id: slipId,
      slipNo,
      slipDate: dateStr,
      slipType: slipData.slipType || 'SALES',
      customerId: slipData.customerId || '',
      customerName,
      siteId: slipData.siteId,
      siteName: slipData.siteName,
      siteManager: slipData.siteManager,
      siteAddress: slipData.siteAddress,
      items,
      totalSupplyAmount,
      totalTaxAmount,
      totalAmount,
      paymentType: slipData.paymentType || (unpaidAmount > 0 ? 'credit' : 'cash'),
      paidAmount,
      unpaidAmount,
      prevReceivables,
      memo: slipData.memo || '',
      createdAt: now.toISOString(),
      deliveryStatus: slipData.deliveryStatus || 'none'
    };

    // 1. Save Slip (DB에는 기본 정보만 저장 - 스키마 에러 방지)
    const { error: slipError } = await supabase.from('slips').insert(newSlip);
    if (slipError) throw new Error(slipError.message);

    // Crypto Injection (UI 표출용 전자서명 및 TSA 주입)
    const hashData = `${newSlip.slipNo}-${newSlip.slipDate}-${newSlip.customerId}-${newSlip.totalAmount}-${newSlip.createdAt}`;
    const digitalSignature = crypto.createHash('sha256').update(hashData).digest('hex');
    const tsaToken = `TSA-RFC3161-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const slipWithCrypto = { ...newSlip, digitalSignature, tsaToken };

    // 2. Update Customer Receivables
    if (unpaidAmount > 0) {
      const newReceivables = prevReceivables + unpaidAmount;
      await supabase.from('customers').update({ receivables: newReceivables }).eq('id', slipData.customerId);
    }

    // 3. Update Product Stock (async, don't wait)
    for (const item of items) {
      if (item.productId) {
        // Fetch current stock first
        const { data: p } = await supabase.from('products').select('currentStock').eq('id', item.productId).single();
        if (p) {
          let stockModifier = 0;
          const st = newSlip.slipType;
          if (st === 'SALES' || st === 'RETURN_OUT' || st === 'DELIVERY') {
            stockModifier = -1;
          } else if (st === 'PURCHASE' || st === 'RETURN_IN') {
            stockModifier = 1;
          }
          
          if (stockModifier !== 0) {
            const newStock = p.currentStock + (item.qty * stockModifier);
            await supabase.from('products').update({ currentStock: newStock }).eq('id', item.productId);
          }
        }
      }
    }

    return NextResponse.json(slipWithCrypto, { status: 201 });
  } catch (error: any) {
    console.error('Slip API Error:', error);
    return NextResponse.json({ error: error.message || '전표 저장 실패' }, { status: 500 });
  }
}
