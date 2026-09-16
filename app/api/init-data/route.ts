export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

async function fetchAll(table: string) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    console.error(`Error counting ${table}:`, error);
    return [];
  }
  const total = count || 0;
  const promises = [];
  for (let i = 0; i < total; i += 1000) {
    promises.push(supabase.from(table).select('*').range(i, i + 999));
  }
  const results = await Promise.all(promises);
  return results.flatMap(r => r.data || []);
}

export async function GET() {
  try {
    // 1. 병렬 쿼리로 Supabase에서 전체 데이터를 가져옵니다. (SaaS 모드, 1000건 제한 우회)
    const [
      { data: configData },
      productsData,
      customersData,
      slipsData,
      pricesData
    ] = await Promise.all([
      supabase.from('system_config').select('config').eq('id', 'default').single(),
      fetchAll('products'),
      fetchAll('customers'),
      fetchAll('slips'),
      fetchAll('customer_prices')
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
