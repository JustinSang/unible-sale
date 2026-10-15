import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nekkgodtsorizpisfbyf.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_APGLQv5bFm_P-sX8nml_zA_9S_32ISj';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DATA_PATH = path.join(process.cwd(), 'data', 'db.json');
const PRICES_PATH = path.join(process.cwd(), 'data', 'prices.json');

async function migrate() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error('db.json not found');
    return;
  }

  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  const db = JSON.parse(raw);

  console.log('Starting migration to Supabase...');

  // 1. Config
  if (db.config) {
    // db.json의 회사정보는 임시값(홍길동·120-81-45678)이라, 실제 거래명세표(서류/1.xlsx)에서 확인된 값으로 덮어쓴다.
    const config = {
      ...db.config,
      companyInfo: {
        ...db.config.companyInfo,
        name: '동산화스너',
        bizNumber: '202-14-62327',
        ceo: '상원준',
        address: '고양시 덕양구 삼원로 73, 210호',
        tel: '02-2267-1300',
        fax: '02-2274-4386',
        email: 'dsfastener@daum.net',
        bizType: '도매',
        bizItem: '볼트너트 철물외'
      }
    };
    const { error } = await supabase.from('system_config').upsert({ id: 'default', config });
    if (error) console.error('Config Error:', error);
    else console.log('✅ Config migrated');
  }

  // 2. Products (Batch upload)
  if (db.products && db.products.length > 0) {
    console.log(`Migrating ${db.products.length} products...`);
    const batchSize = 1000;
    for (let i = 0; i < db.products.length; i += batchSize) {
      const batch = db.products.slice(i, i + batchSize);
      const { error } = await supabase.from('products').upsert(batch);
      if (error) {
        console.error('Products Error:', error);
      } else {
        console.log(`✅ Products ${i + 1} to ${Math.min(i + batchSize, db.products.length)} migrated`);
      }
    }
  }

  // 3. Customers
  if (db.customers && db.customers.length > 0) {
    console.log(`Migrating ${db.customers.length} customers...`);
    const batchSize = 500;
    for (let i = 0; i < db.customers.length; i += batchSize) {
      const batch = db.customers.slice(i, i + batchSize);
      const { error } = await supabase.from('customers').upsert(batch);
      if (error) console.error('Customers Error:', error);
      else console.log(`✅ Customers ${i + 1} to ${Math.min(i + batchSize, db.customers.length)} migrated`);
    }
  }

  // 4. Slips
  if (db.slips && db.slips.length > 0) {
    console.log(`Migrating ${db.slips.length} slips...`);
    const batchSize = 500;
    for (let i = 0; i < db.slips.length; i += batchSize) {
      const batch = db.slips.slice(i, i + batchSize);
      const { error } = await supabase.from('slips').upsert(batch);
      if (error) console.error('Slips Error:', error);
      else console.log(`✅ Slips ${i + 1} to ${Math.min(i + batchSize, db.slips.length)} migrated`);
    }
  }

  // 4-2. 세금계산서·출고·어음·수금·재고수불부 (db.json 키 → Supabase 표)
  const extraTables: [string, string][] = [
    ['taxInvoices', 'tax_invoices'],
    ['deliveries', 'deliveries'],
    ['bills', 'bills'],
    ['midongOrders', 'midong_orders'], // 미동이엔씨 파트너 포털 자재마감 품목 내역(scripts/import_midong_orders.py)
    ['collections', 'collections'],
    ['inventoryLogs', 'inventory_logs']
  ];
  for (const [key, table] of extraTables) {
    const rows = db[key] || [];
    if (rows.length === 0) continue;
    console.log(`Migrating ${rows.length} ${table}...`);
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from(table).upsert(rows.slice(i, i + 500));
      if (error) console.error(`${table} Error:`, error);
      else console.log(`✅ ${table} ${i + 1} to ${Math.min(i + 500, rows.length)} migrated`);
    }
  }

  // 5. Prices
  if (fs.existsSync(PRICES_PATH)) {
    const pricesRaw = fs.readFileSync(PRICES_PATH, 'utf-8');
    const prices = JSON.parse(pricesRaw);
    
    let priceRows = [];
    for (const [customerId, productMap] of Object.entries(prices)) {
      if (productMap && typeof productMap === 'object') {
        for (const [productId, priceData] of Object.entries(productMap)) {
          // @ts-ignore
          priceRows.push({
            customerId,
            productId,
            // prices.json 원본은 price1·price2·price3(+품명·규격)이다. price 하나만 옮기면 단가가 0이 된다.
            // @ts-ignore
            price1: priceData.price1 || 0,
            // @ts-ignore
            price2: priceData.price2 || 0,
            // @ts-ignore
            price3: priceData.price3 || 0,
            // @ts-ignore
            price: priceData.price1 || priceData.price || 0,
            // @ts-ignore
            productName: priceData.productName || '',
            // @ts-ignore
            spec: priceData.spec || '',
            // @ts-ignore
            memo: priceData.memo || ''
          });
        }
      }
    }

    if (priceRows.length > 0) {
      console.log(`Migrating ${priceRows.length} customer prices...`);
      const batchSize = 1000;
      for (let i = 0; i < priceRows.length; i += batchSize) {
        const batch = priceRows.slice(i, i + batchSize);
        const { error } = await supabase.from('customer_prices').upsert(batch);
        if (error) console.error('Prices Error:', error);
        else console.log(`✅ Prices ${i + 1} to ${Math.min(i + batchSize, priceRows.length)} migrated`);
      }
    }
  }

  console.log('🎉 Migration completed!');
}

migrate().catch(console.error);
