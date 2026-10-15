import { supabase } from '@/lib/supabase';

// 표 전체를 1000건씩 병렬로 읽는다(Supabase 1000행 제한 우회). 표가 없거나 오류면 빈 목록.
export async function fetchAll(table: string, orderBy?: string) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    console.error(`Error counting ${table}:`, error.message);
    return [];
  }
  const total = count || 0;
  const promises = [];
  for (let i = 0; i < total; i += 1000) {
    let q = supabase.from(table).select('*');
    if (orderBy) q = q.order(orderBy, { ascending: false });
    promises.push(q.range(i, i + 999));
  }
  const results = await Promise.all(promises);
  return results.flatMap(r => r.data || []);
}

// customer_prices 행 → 화면이 쓰는 모양. price1이 없던 옛 행(price만 저장)은 price를 단가1로 본다.
export function toPriceItem(p: any) {
  return {
    price1: p.price1 ?? p.price ?? 0,
    price2: p.price2 ?? 0,
    price3: p.price3 ?? 0,
    price: p.price ?? p.price1 ?? 0,
    productName: p.productName || '',
    spec: p.spec || '',
    memo: p.memo || ''
  };
}

export async function loadAll() {
  const [
    { data: configData },
    products,
    customers,
    slips,
    pricesData,
    collections,
    bills,
    taxInvoices,
    deliveries,
    inventoryLogs
  ] = await Promise.all([
    supabase.from('system_config').select('config').eq('id', 'default').single(),
    fetchAll('products'),
    fetchAll('customers'),
    fetchAll('slips'),
    fetchAll('customer_prices'),
    fetchAll('collections'),
    fetchAll('bills'),
    fetchAll('tax_invoices'),
    fetchAll('deliveries'),
    fetchAll('inventory_logs')
  ]);

  // customer_prices → Record<customerId, Record<productId, {price, memo}>>
  const prices: Record<string, Record<string, any>> = {};
  pricesData.forEach((p: any) => {
    if (!prices[p.customerId]) prices[p.customerId] = {};
    prices[p.customerId][p.productId] = toPriceItem(p);
  });

  return {
    config: configData?.config || {},
    products,
    customers,
    slips,
    customerPrices: prices,
    deliveries,
    inventoryLogs,
    bills,
    taxInvoices,
    collections
  };
}
