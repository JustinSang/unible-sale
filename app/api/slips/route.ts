export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { shiftPrices } from '@/lib/priceHistory';
import { rotatePurchase } from '@/lib/purchaseHistory';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';
import { roundBy, normalizeCalc } from '@/lib/calcRules';
import { openingConfig, ledgerBalance, syncReceivables } from '@/lib/receivables';
import { audit } from '@/lib/audit';
import { applyOldSlipEffects } from '@/lib/slipEdit';
import { normalizeOptions } from '@/lib/envOptions';

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
    // 이미 저장된 전표를 고쳐 저장하는 경우(화면의 «데이터 업데이트 저장»): 옛 전표를 기억해 두고 아래에서 영향을 되돌린 뒤 새 내용으로 바꾼다.
    const { data: existing } = slipData.id ? await supabase.from('slips').select('*').eq('id', slipData.id).maybeSingle() : { data: null };
    const now = new Date();
    const dateStr = slipData.slipDate || now.toISOString().slice(0, 10);
    
    // Auto-generate slipNo if missing
    let slipNo = slipData.slipNo || existing?.slipNo;
    if (!slipNo) {
      const { count } = await supabase.from('slips').select('*', { count: 'exact', head: true });
      slipNo = `S${dateStr.replace(/-/g, '')}-${String((count || 0) + 1).padStart(4, '0')}`;
    }

    // 금액 반올림 설정(환경설정). 없으면 반올림=기존 동작
    const { data: cfgRow } = await supabase.from('system_config').select('config').eq('id', 'default').maybeSingle();
    const calcCfg = normalizeCalc(cfgRow?.config?.calc);
    const envOpt = normalizeOptions(cfgRow?.config?.options);

    // Process items and calculate totals
    const items = (slipData.items || []).map((item: any, idx: number) => {
      const qty = Number(item.qty) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const supplyAmount = roundBy(qty * unitPrice, calcCfg.amt);
      // 세액은 화면의 «부가가치세 포함(세액 10% 가산)/별도(세액 없음)» 선택대로 받는다(매뉴얼 캡처 확정; 원본 실전표가 100% 세액 0 = 별도). 값이 없으면 0.
      const taxAmount = Number.isFinite(Number(item.taxAmount)) ? Math.round(Number(item.taxAmount)) : 0;
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

    // 수정 저장: 옛 전표의 재고·미수금·배송 요청 영향을 먼저 되돌린다(아래 «전잔액»이 옛 전표를 빼고 계산되도록). 새 내용 저장이 실패하면 아래에서 원상복구한다.
    const editCfg = existing ? await openingConfig() : null;
    const oldDeliveries = existing ? ((await supabase.from('deliveries').select('*').eq('slipId', slipId)).data || []) : [];
    if (existing) {
      await applyOldSlipEffects(existing, editCfg, 1);
      await supabase.from('deliveries').delete().eq('slipId', slipId);
      const { error: delOld } = await supabase.from('slips').delete().eq('id', slipId);
      if (delOld) { await applyOldSlipEffects(existing, editCfg, -1); throw new Error(delOld.message); }
    }

    // Get customer prevReceivables
    const { data: customer } = await supabase.from('customers').select('name, receivables').eq('id', slipData.customerId).single();
    // 장부 방식(초기이월금 기준일이 설정된 경우)이면 «전잔액»을 장부 잔액으로, 아니면 예전처럼 거래처 미수금 칸으로
    const opCfg = await openingConfig();
    const prevReceivables = (await ledgerBalance(String(slipData.customerId || ''), opCfg)) ?? (customer?.receivables || 0);
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
      ...(slipData.progressStatus ? { progressStatus: slipData.progressStatus } : {}), // 수정 저장 때 진행상태를 잃지 않게
      createdAt: existing?.createdAt || now.toISOString(),
      deliveryStatus: deliveryInfo?.required ? 'pending' : (slipData.deliveryStatus || existing?.deliveryStatus || 'none'),
      ...(existing?.dispatchStatus ? { dispatchStatus: existing.dispatchStatus } : {}) // 발송 이력은 수정해도 남긴다
    };

    // 1. Save Slip (DB에는 기본 정보만 저장 - 스키마 에러 방지)
    const { error: slipError } = await supabase.from('slips').insert(newSlip);
    if (slipError) {
      if (existing) { // 수정 저장 실패 → 옛 전표와 그 영향을 그대로 되살린다
        await supabase.from('slips').insert(existing);
        if (oldDeliveries.length) await supabase.from('deliveries').insert(oldDeliveries);
        await applyOldSlipEffects(existing, editCfg, -1);
        if (editCfg) await syncReceivables(String(existing.customerId || ''), editCfg);
      }
      throw new Error(slipError.message);
    }

    // Crypto Injection (UI 표출용 전자서명 및 TSA 주입)
    const hashData = `${newSlip.slipNo}-${newSlip.slipDate}-${newSlip.customerId}-${newSlip.totalAmount}-${newSlip.createdAt}`;
    const digitalSignature = crypto.createHash('sha256').update(hashData).digest('hex');
    const tsaToken = `TSA-RFC3161-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const slipWithCrypto = { ...newSlip, digitalSignature, tsaToken };

    // 2. Update Customer Receivables
    if (opCfg) {
      await syncReceivables(String(slipData.customerId || ''), opCfg); // 장부 방식: 저장한 전표까지 반영한 장부 잔액으로 맞춘다
    } else if (unpaidAmount > 0 && newSlip.slipType === 'SALES') {
      const newReceivables = prevReceivables + unpaidAmount;
      await supabase.from('customers').update({ receivables: newReceivables }).eq('id', slipData.customerId);
    }

    // 2-1. 거래처별 단가 이력 갱신(원본 Price 표: 저장 때 Price1이 바뀌면 1→2→3으로 민다). 매출 전표만. 실패해도 전표 저장은 유지한다.
    if (envOpt.autoSaveSalesPrice && newSlip.slipType === 'SALES' && newSlip.customerId) {
      const custKey = String(newSlip.customerId).replace(/^c-/, '');
      for (const item of items) {
        if (!item.productId) continue;
        try {
          const prodKey = String(item.productId).replace(/^p-/, '');
          const { data: cur } = await supabase.from('customer_prices').select('price1, price2, price3').eq('customerId', custKey).eq('productId', prodKey).maybeSingle();
          const next = shiftPrices(cur, Number(item.unitPrice));
          if (!next) continue;
          await supabase.from('customer_prices').upsert({ customerId: custKey, productId: prodKey, productName: item.productName, spec: item.spec, ...next });
        } catch { /* 단가 이력은 보조 기능 */ }
      }
    }

    // 2-2. 매입 전표: 품목의 매입단가·최종매입처·일자·가(직전 1건은 «2»로 이동)를 갱신한다. 실패해도 전표 저장은 유지.
    if (envOpt.autoSavePurchasePrice && newSlip.slipType === 'PURCHASE') {
      for (const item of items) {
        if (!item.productId) continue;
        try {
          const { data: cur } = await supabase.from('products').select('supplier, lastPurchaseDate, lastPurchasePrice').eq('id', item.productId).maybeSingle();
          const patch = rotatePurchase(cur || {}, customerName, dateStr, Number(item.unitPrice));
          if (patch) await supabase.from('products').update(patch).eq('id', item.productId);
        } catch { /* 매입 이력은 보조 기능 */ }
      }
    }

    // 3. Update Product Stock (async, don't wait)
    for (const item of items) {
      if (item.productId) {
        // Fetch current stock first
        const { data: p } = await supabase.from('products').select('currentStock').eq('id', item.productId).single();
        if (p) {
          let stockModifier = 0;
          const st = newSlip.slipType;
          // 원본 Stock 규칙: 재고는 매출(−)·매입(+)·반품만 움직인다. 납품서(7)·견적·발주는 재고에 영향이 없다(원본 실데이터 대조 99.86%).
          if (st === 'SALES' || st === 'RETURN_OUT') {
            stockModifier = -1;
          } else if (st === 'PURCHASE' || st === 'RETURN_IN') {
            stockModifier = 1;
          }
          
          if (stockModifier !== 0) {
            const newStock = p.currentStock + (item.qty * stockModifier);
            await supabase.from('products').update({ currentStock: newStock }).eq('id', item.productId);
            const { error: logError } = await supabase.from('inventory_logs').insert({
              id: `log-${Date.now()}-${item.id}`,
              date: dateStr,
              productId: item.productId,
              productName: item.productName,
              spec: item.spec,
              changeType: stockModifier > 0 ? (st === 'RETURN_IN' ? 'return' : 'in') : 'out',
              changeQty: item.qty,
              beforeQty: p.currentStock,
              afterQty: newStock,
              slipNo: newSlip.slipNo,
              reason: `${st === 'SALES' ? '매출' : st === 'PURCHASE' ? '매입' : '반품·출고'} 전표 처리: ${customerName}`,
              createdAt: now.toISOString()
            });
            if (logError) console.error('inventory_logs insert failed:', logError.message);
          }
        }
      }
    }

    // 4. Delivery order (출고 요청이 있을 때)
    if (deliveryInfo?.required) {
      const itemsSummary = items.map((i: any) => `${i.productName}(${i.qty}${i.unit})`).join(', ');
      const { error: delError } = await supabase.from('deliveries').insert({
        id: `d-${Date.now()}`,
        slipId: newSlip.id,
        slipNo: newSlip.slipNo,
        customerName,
        siteId: deliveryInfo.siteId || slipData.siteId,
        siteName: deliveryInfo.siteName || slipData.siteName,
        address: deliveryInfo.address || '배송지 미지정',
        tel: deliveryInfo.tel || '',
        driverName: deliveryInfo.driverName || '미배차',
        driverTel: deliveryInfo.driverTel || '',
        status: 'pending',
        requestedDate: deliveryInfo.requestedDate || dateStr,
        itemsSummary,
        memo: deliveryInfo.memo || newSlip.memo || ''
      });
      if (delError) console.error('deliveries insert failed:', delError.message);
    }

    await audit('create', 'slip', slipWithCrypto.id, `전표 저장: ${slipWithCrypto.slipNo} ${slipWithCrypto.customerName} ${Number(slipWithCrypto.totalAmount || 0).toLocaleString('ko-KR')}원`, { slipType: slipWithCrypto.slipType, items: items.length, paid: slipWithCrypto.paidAmount, unpaid: slipWithCrypto.unpaidAmount });
    return NextResponse.json(slipWithCrypto, { status: 201 });
  } catch (error: any) {
    console.error('Slip API Error:', error);
    return NextResponse.json({ error: error.message || '전표 저장 실패' }, { status: 500 });
  }
}
