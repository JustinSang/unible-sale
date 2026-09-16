export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';

export async function GET() {
  const { data, error } = await supabase.from('products').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    const data: Partial<Product> = await req.json();

    const newProduct = {
      id: `p-${Date.now()}`,
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

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '품목 추가 실패' }, { status: 500 });
  }
}
