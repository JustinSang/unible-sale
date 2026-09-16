export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. 병렬 쿼리로 Supabase에서 전체 데이터를 가져옵니다. (SaaS 모드)
    const [
      { data: configData },
      { data: productsData },
      { data: customersData },
      { data: slipsData },
      { data: pricesData }
    ] = await Promise.all([
      supabase.from('system_config').select('config').eq('id', 'default').single(),
      supabase.from('products').select('*'),
      supabase.from('customers').select('*'),
      supabase.from('slips').select('*'),
      supabase.from('customer_prices').select('*')
    ]);

    // 2. pricesData를 기존 prices.json 구조 (Record<customerId, Record<productId, priceItem>>) 형태로 변환
    let prices: Record<string, Record<string, any>> = {};
    if (pricesData) {
      pricesData.forEach(p => {
        if (!prices[p.customerId]) prices[p.customerId] = {};
        prices[p.customerId][p.productId] = {
          price: p.price,
          memo: p.memo
        };
      });
    }

    const state = {
      config: configData?.config || {},
      products: productsData || [],
      customers: customersData || [],
      slips: slipsData || [],
      customerPrices: prices,
      deliveries: [],
      inventoryLogs: [],
      bills: [],
      taxInvoices: [],
      collections: []
    };

    return NextResponse.json(state);
  } catch (error: any) {
    console.error('Data Fetch Error:', error);
    return NextResponse.json({ error: error.message || '데이터 로드 실패' }, { status: 500 });
  }
}
