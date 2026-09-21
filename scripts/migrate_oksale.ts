import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { parse } from 'csv-parse/sync';
import type { Customer, Product, Slip, SlipItem, TaxInvoice } from '../types';

const MASTER_DB = path.resolve('../오케이세일/Master1109.mdb');
const TRANSACTIONS_DB = path.resolve('/tmp/oksale_backup/S26.mdb');
const OUT_DB_PATH = path.resolve('data/db.json');

function extractTable(dbPath: string, table: string): any[] {
  console.log(`Extracting ${table} from ${dbPath}...`);
  try {
    const csvData = execSync(`mdb-export -d '|' "${dbPath}" ${table}`, { maxBuffer: 1024 * 1024 * 50 }).toString();
    return parse(csvData, {
      delimiter: '|',
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  } catch (err) {
    console.error(`Failed to extract ${table}:`, err);
    return [];
  }
}

function mapCustomers(rows: any[]): Customer[] {
  return rows.map((r, i) => {
    let bizNumber = r.TaxNo || '';
    if (bizNumber.length === 10) {
      bizNumber = `${bizNumber.slice(0,3)}-${bizNumber.slice(3,5)}-${bizNumber.slice(5)}`;
    }
    return {
      id: `c-${r.CustomerID}`,
      code: r.CustomerID,
      name: r.CustomerName,
      bizNumber: bizNumber,
      ceo: r.OwnerName || '',
      tel: r.TelephoneNo1 || '',
      fax: r.FaxNo || '',
      mobile: r.ChargerName ? r.TelephoneNo1 : '',
      address: `${r.Address1} ${r.Address11}`.trim(),
      bizType: r.BusinessType || '',
      bizItem: r.BusinessStatus || '',
      receivables: 0, 
      email: r.eMail || '',
      memo: r.Comments || ''
    };
  });
}

function mapProducts(rows: any[]): Product[] {
  return rows.map(r => ({
    id: `p-${r.ProductID}`,
    code: r.Code || r.ProductID,
    name: r.ProductName || '',
    spec: r.Spec || '',
    unit: r.Unit || 'EA',
    costPrice: Number(r.Cost) || 0,
    sellingPrice: Number(r.SalesPrice) || 0,
    currentStock: Number(r.StockOnHand) || 0,
    safeStock: Number(r.SafetyStock) || 0,
    category: r.Category || '',
    barcode: r.Barcode || '',
    memo: r.Comments || ''
  }));
}

function mapTaxInvoices(rows: any[]): TaxInvoice[] {
  return rows.map((r, i) => ({
    id: `tax-${i}-${Date.now()}`,
    taxNo: r.TaxNo,
    taxDate: r.TaxDate,
    customerName: r.CustomerName,
    productSummary: r.ProductName,
    supplyAmount: Number(r.Amount) || 0,
    taxAmount: Number(r.Tax) || 0,
    totalAmount: Number(r.Total) || 0,
    isIssued: r.CheckIssue === '1',
    memo: r.Comments || ''
  }));
}

function mapSlips(slipRows: any[], detailRows: any[]): Slip[] {
  const slips: Record<string, Slip> = {};
  
  slipRows.forEach(s => {
    let type: Slip['slipType'] = 'SALES';
    if (s.SlipKind === '1') type = 'SALES';
    if (s.SlipKind === '2') type = 'PURCHASE';

    slips[s.SlipID] = {
      id: `s-${s.SlipID}`,
      slipNo: `S${s.SlipDate.replace(/-/g, '')}-${s.SlipNo}`,
      slipDate: s.SlipDate,
      slipType: type,
      customerId: `c-${s.CustomerID}`,
      customerName: s.CustomerName || '미지정 거래처',
      items: [],
      totalSupplyAmount: Number(s.TotalCost) || 0,
      totalTaxAmount: Number(s.Tax) || 0,
      totalAmount: Number(s.Total) || 0,
      paymentType: 'credit',
      paidAmount: Number(s.Payment) || Number(s.Receipt) || 0,
      unpaidAmount: Number(s.Balance) || 0,
      memo: s.Post || '',
      createdAt: s.SlipDate,
      deliveryStatus: 'none'
    };
  });

  detailRows.forEach(d => {
    const slip = slips[d.SlipID];
    if (slip) {
      const qty = Number(d.Qty) || 0;
      const price = Number(d.Price) || 0;
      const supplyAmt = Number(d.Amount) || (qty * price);
      const taxAmt = Number(d.Tax) || 0;

      slip.items.push({
        id: `si-${d.SlipID}-${d.Sequence}`,
        productId: `p-${d.ProductID}`,
        productCode: d.ProductCode || '',
        productName: d.ProductName || '',
        spec: d.Spec || '',
        unit: d.Unit || 'EA',
        qty: qty,
        unitPrice: price,
        supplyAmount: supplyAmt,
        taxAmount: taxAmt,
        totalAmount: supplyAmt + taxAmt,
        memo: d.Comment || ''
      });
    }
  });

  return Object.values(slips).sort((a, b) => b.slipNo.localeCompare(a.slipNo));
}

async function migrate() {
  console.log('Starting Migration...');

  const dbExists = fs.existsSync(OUT_DB_PATH);
  let db: any = {};
  if (dbExists) {
    db = JSON.parse(fs.readFileSync(OUT_DB_PATH, 'utf-8'));
  } else {
    db = {
      products: [],
      customers: [],
      slips: [],
      taxInvoices: [],
      deliveries: [],
      inventoryLogs: [],
      bills: [],
      collections: [],
      config: {}
    };
  }

  const mdbCustomers = extractTable(MASTER_DB, 'Customers');
  const mdbProducts = extractTable(MASTER_DB, 'Products');
  const mdbTax = extractTable(MASTER_DB, 'Tax');

  const mdbSlipHeader = extractTable(TRANSACTIONS_DB, 'SlipHeader');
  const mdbSalesDetails = extractTable(TRANSACTIONS_DB, 'SalesDetails');

  const newCustomers = mapCustomers(mdbCustomers);
  const newProducts = mapProducts(mdbProducts);
  const newTaxInvoices = mapTaxInvoices(mdbTax);
  const newSlips = mapSlips(mdbSlipHeader, mdbSalesDetails);

  const mergeArray = (existing: any[], incoming: any[], key = 'id') => {
    const existingMap = new Map(existing.map(x => [x[key], x]));
    incoming.forEach(x => existingMap.set(x[key], x));
    return Array.from(existingMap.values());
  };

  db.customers = mergeArray(db.customers || [], newCustomers);
  db.products = mergeArray(db.products || [], newProducts);
  db.taxInvoices = mergeArray(db.taxInvoices || [], newTaxInvoices);
  db.slips = mergeArray(db.slips || [], newSlips);

  const dir = path.dirname(OUT_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(OUT_DB_PATH, JSON.stringify(db, null, 2));
  console.log('Migration Completed Successfully!');
  console.log(`Migrated: ${newCustomers.length} Customers, ${newProducts.length} Products, ${newTaxInvoices.length} Tax Invoices, ${newSlips.length} Slips.`);
}

migrate();
