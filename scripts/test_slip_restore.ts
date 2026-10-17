// 수정 저장이 실패했을 때 원상복구 경로(applyOldSlipEffects 되돌림 → 다시 입힘)가 재고·미수금을 정확히 되돌리는지 시험.
// 실행(복사본 DB 서버가 떠 있어야 함): NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 npx tsx scripts/test_slip_restore.ts
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'x';
(async () => {
const { supabase } = await import('../lib/supabase');
const { applyOldSlipEffects } = await import('../lib/slipEdit');
let fails = 0; const ok = (n: string, v: boolean, i = '') => { console.log(v ? 'PASS' : 'FAIL', n, v ? '' : i); if (!v) fails++; };
const sfx = Date.now().toString().slice(-6);
await supabase.from('products').insert({ id: `p-rs${sfx}`, code: `RS${sfx}`, name: '복구시험', spec: 'R', unit: 'EA', costPrice: 0, sellingPrice: 0, currentStock: 50, safeStock: 0, category: 'x' });
await supabase.from('customers').insert({ id: `c-rs${sfx}`, code: `RS${sfx}`, name: '복구시험처', bizNumber: '', ceo: '', tel: '', receivables: 7000 });
const slip = { slipNo: 'RS-1', slipType: 'SALES', customerId: `c-rs${sfx}`, unpaidAmount: 3000, items: [{ productId: `p-rs${sfx}`, qty: 8, productName: '복구시험', spec: 'R' }] };
const st = async () => ({ stock: (await supabase.from('products').select('currentStock').eq('id', `p-rs${sfx}`).single()).data!.currentStock, recv: (await supabase.from('customers').select('receivables').eq('id', `c-rs${sfx}`).single()).data!.receivables });
const s0 = await st();
await applyOldSlipEffects(slip, null, 1, 'edit');      // 옛 전표 영향 되돌림(재고 +8, 미수금 −3000)
const s1 = await st();
ok('되돌림: 재고 +8·미수금 −3,000', s1.stock === s0.stock + 8 && s1.recv === s0.recv - 3000, JSON.stringify([s0, s1]));
await applyOldSlipEffects(slip, null, -1, 'restore');  // 수정 실패 → 원상복구
const s2 = await st();
ok('원상복구: 재고·미수금이 처음과 같다', s2.stock === s0.stock && s2.recv === s0.recv, JSON.stringify([s0, s2]));
const { data: lg } = await supabase.from('inventory_logs').select('*').eq('productId', `p-rs${sfx}`);
ok('수불부에 취소·복구 기록 2건', (lg || []).length === 2 && lg!.some((l: any) => /수정/.test(l.reason)) && lg!.some((l: any) => /원상복구/.test(l.reason)), JSON.stringify((lg || []).map((l: any) => l.reason)));
// 같은 전표를 장부 방식(opCfg 있음)에서는 미수금을 건드리지 않는다(장부 동기화가 맞춤)
await applyOldSlipEffects(slip, { asOf: '2026-01-01' }, 1, 'edit'); const s3 = await st();
ok('장부 방식: 재고만 되돌리고 미수금은 그대로', s3.stock === s0.stock + 8 && s3.recv === s0.recv, JSON.stringify([s0, s3]));
await supabase.from('products').delete().eq('id', `p-rs${sfx}`); await supabase.from('customers').delete().eq('id', `c-rs${sfx}`);
console.log(fails ? `\n실패 ${fails}건` : '\n전부 통과'); process.exit(fails ? 1 : 0);
})();
