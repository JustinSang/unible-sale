// 로컬 DB 서버가 기존 가짜 서버와(= 앱이 쓰는 supabase-js 질의에서) 같은 결과를 주는지 비교한다(읽기 전용).
// 사용: node scripts/server/compat_check.mjs <기준URL> <새URL>   예) http://127.0.0.1:54321 http://127.0.0.1:54399
import { createClient } from '@supabase/supabase-js';
const [A, B] = process.argv.slice(2);
const a = createClient(A, 'mock'), b = createClient(B, 'mock');
const norm = v => JSON.stringify(v);
let fails = 0;
async function cmp(name, f) {
  const [ra, rb] = await Promise.all([f(a), f(b)]);
  const sa = norm({ d: ra.data, c: ra.count, e: !!ra.error }), sb = norm({ d: rb.data, c: rb.count, e: !!rb.error });
  const ok = sa === sb; if (!ok) fails++;
  console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `\n  기준: ${sa.slice(0, 160)}\n  신규: ${sb.slice(0, 160)}`);
}
const byId = d => (d || []).slice().sort((x, y) => String(x.id).localeCompare(String(y.id)));
const wrap = f => async c => { const r = await f(c); return { ...r, data: Array.isArray(r.data) ? byId(r.data) : r.data }; };
for (const t of ['products', 'customers', 'slips', 'deliveries', 'tax_invoices', 'midong_orders', 'customer_prices']) {
  await cmp(`${t} 개수(head count)`, c => c.from(t).select('*', { count: 'exact', head: true }));
}
await cmp('customers 전체 1000', wrap(c => c.from('customers').select('*').range(0, 999)));
await cmp('slips eq slipType=SALES 개수', c => c.from('slips').select('*', { count: 'exact', head: true }).eq('slipType', 'SALES'));
await cmp('slips maybeSingle 없는 id', c => c.from('slips').select('*').eq('id', 'nope').maybeSingle());
await cmp('midong_orders 범위 2000~2999', wrap(c => c.from('midong_orders').select('*').range(2000, 2999)));
// 아래는 기존 가짜 서버가 틀리게 답하던 것(.single()을 배열로, order·limit 무시) — 새 서버는 실제 Supabase처럼 답해야 한다. 새 서버만 단독 검사.
function check(name, ok, info = '') { console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : info); if (!ok) fails++; }
{ const r = await b.from('slips').select('*').eq('id', 's-2024-801160').single(); check('single은 객체(배열 아님)', !Array.isArray(r.data) && r.data?.id === 's-2024-801160', JSON.stringify(r).slice(0, 120)); }
{ const r = await b.from('slips').select('*').eq('id', 'nope').single(); check('single 없는 id는 오류', !!r.error, JSON.stringify(r).slice(0, 120)); }
{ const r = await b.from('products').select('name, spec, currentStock').eq('id', 'p-200061').single(); check('단건 재고 값이 숫자', typeof r.data?.currentStock === 'number', JSON.stringify(r).slice(0, 120)); }
{ const r = await b.from('system_config').select('config').eq('id', 'default').single(); check('설정 단건', !!r.data?.config?.companyInfo, JSON.stringify(r).slice(0, 80)); }
{ const r = await b.from('slips').select('id,slipDate').order('slipDate', { ascending: false }).limit(5); const d = (r.data || []).map(x => x.slipDate); check('order desc + limit 5', d.length === 5 && d.every((v, i) => i === 0 || d[i - 1] >= v), JSON.stringify(d)); }
{ const r = await b.from('products').select('id').order('id').range(0, 4); const d = (r.data || []).map(x => x.id); check('order asc + range 0~4', d.length === 5 && d.every((v, i) => i === 0 || d[i - 1] <= v), JSON.stringify(d)); }
console.log(fails ? `실패 ${fails}건` : '전부 통과');
process.exit(fails ? 1 : 0);
