export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { audit } from '@/lib/audit';
import type { Product } from '@/types';

export async function GET() {
  const { data, error } = await supabase.from('products').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    const data: Partial<Product> = await req.json();

    // 화면 양식의 추가 칸(다른명칭·단가2/3·할인율·분류2/3·소비자가 등)을 버리지 않고 저장한다. 집단 복사로 같은 밀리초에 여러 건이 들어와도 id가 겹치지 않게 난수를 붙인다.
    const EXTRA = ['nickName', 'sellingPrice2', 'sellingPrice3', 'discountRate', 'category2', 'category3', 'maker', 'modelNo', 'color', 'retailPrice', 'purchasePrice', 'lastPurchaseDate', 'lastPurchasePrice', 'storageLocation', 'taxType', 'stockManaged', 'applyDiscount', 'supplier2', 'lastPurchaseDate2', 'lastPurchasePrice2', 'openingStock'] as const;
    const extra: Record<string, unknown> = {};
    for (const k of EXTRA) if ((data as Record<string, unknown>)[k] !== undefined) extra[k] = (data as Record<string, unknown>)[k];
    const newProduct = {
      ...extra,
      id: `p-${Date.now()}${Math.floor(Math.random() * 1000)}`,
      code: data.code || `P${String(Date.now()).slice(-6)}`,
      name: data.name || '',
      spec: data.spec || '',
      unit: data.unit || 'EA',
      costPrice: Number(data.costPrice) || 0,
      sellingPrice: Number(data.sellingPrice) || 0,
      currentStock: Number(data.currentStock) || 0,
      safeStock: Number(data.safeStock) || 0,
      category: data.category || '미분류',
      barcode: data.barcode || '',
      supplier: data.supplier || '',
      memo: data.memo || ''
    };

    const { error } = await supabase.from('products').insert(newProduct);
    if (error) throw new Error(error.message);

    await audit('create', 'product', String((newProduct as any).id), `품목 등록: ${(newProduct as any).name ?? ''}`, newProduct);
    return NextResponse.json(newProduct, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '품목 추가 실패' }, { status: 500 });
  }
}
