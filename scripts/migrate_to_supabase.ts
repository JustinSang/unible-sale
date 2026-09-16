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
    const { error } = await supabase.from('system_config').upsert({ id: 'default', config: db.config });
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
            // @ts-ignore
            price: priceData.price || 0,
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
