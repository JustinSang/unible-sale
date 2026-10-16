// 로컬 DB 서버 쓰기 경로 시험(supabase-js 로 앱과 같은 방식). «시험용 표» 대신 실제 표에 시험 행을 넣고 지운다 — 끝나면 원상태여야 한다.
// 사용: node scripts/server/crud_check.mjs http://127.0.0.1:54399
import { createClient } from '@supabase/supabase-js';
const c = createClient(process.argv[2], 'mock');
let fails = 0; const ok = (n, v, i = '') => { console.log(v ? 'PASS' : 'FAIL', n, v ? '' : i); if (!v) fails++; };
const cnt = async t => (await c.from(t).select('*', { count: 'exact', head: true })).count;
const n0 = await cnt('collections');
let r = await c.from('collections').insert({ id: 'zz-test-1', amount: 1, customerName: '시험' }); ok('insert', !r.error, JSON.stringify(r.error));
ok('insert 후 개수 +1', (await cnt('collections')) === n0 + 1);
r = await c.from('collections').insert({ id: 'zz-test-1', amount: 2 }); ok('같은 id 다시 insert는 거부(23505)', !!r.error && r.error.code === '23505', JSON.stringify(r));
r = await c.from('collections').select('*').eq('id', 'zz-test-1').single(); ok('single 조회', r.data?.amount === 1, JSON.stringify(r));
r = await c.from('collections').update({ amount: 5 }).eq('id', 'zz-test-1'); ok('update', !r.error);
r = await c.from('collections').select('*').eq('id', 'zz-test-1').single(); ok('update 반영', r.data?.amount === 5 && r.data?.customerName === '시험', JSON.stringify(r.data));
r = await c.from('customer_prices').upsert({ customerId: 'zz', productId: 'zz', price1: 7 }, { onConflict: 'customerId,productId' }); ok('upsert(복합키) 삽입', !r.error, JSON.stringify(r.error));
r = await c.from('customer_prices').upsert({ customerId: 'zz', productId: 'zz', price1: 8 }, { onConflict: 'customerId,productId' }); ok('upsert(복합키) 갱신', !r.error);
r = await c.from('customer_prices').select('*').eq('customerId', 'zz').eq('productId', 'zz'); ok('upsert 결과 1행·값 8', r.data?.length === 1 && r.data[0].price1 === 8, JSON.stringify(r.data));
r = await c.from('system_config').upsert({ id: 'zz-cfg', config: { a: 1 } }); ok('config upsert', !r.error);
r = await c.from('audit_log').insert({ id: 'au-zz', at: new Date().toISOString(), action: 'test', entity: 'x', entityId: 'x', summary: '시험', detail: { k: 1 } }); ok('audit_log 새 표 insert', !r.error, JSON.stringify(r.error));
// 안전장치: 조건 없는 삭제·수정은 거부
const raw = async (m, path, body) => (await fetch(process.argv[2] + '/rest/v1/' + path, { method: m, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).status;
ok('조건 없는 DELETE 거부(400)', (await raw('DELETE', 'collections')) === 400);
ok('조건 없는 PATCH 거부(400)', (await raw('PATCH', 'collections', { amount: 0 })) === 400);
r = await c.from('collections').delete().eq('id', 'zz-test-1'); ok('delete', !r.error);
await c.from('customer_prices').delete().eq('customerId', 'zz'); await c.from('system_config').delete().eq('id', 'zz-cfg'); await c.from('audit_log').delete().eq('id', 'au-zz');
ok('정리 후 개수 원복', (await cnt('collections')) === n0);
console.log(fails ? `실패 ${fails}건` : '전부 통과'); process.exit(fails ? 1 : 0);
