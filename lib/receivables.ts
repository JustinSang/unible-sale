// 거래처 미수금(customers.receivables)을 «장부 잔액»(수금·지급 화면·거래처 원장과 같은 계산)에 맞춰 두는 서버 쪽 도우미.
// 켜지는 조건: 환경설정에 초기이월금 기준일(openingBalances.asOf)이 있을 때만 — 실제 잔액표를 넣기 전에는 이관된 옛 전표 때문에 장부 잔액이 부풀어 있어서(예: 만주배관센터 789만원) 켜면 오히려 틀린 전잔액이 명세표에 찍힌다.
// 꺼져 있으면(null) 기존 방식(전표 저장 때 미수만큼 더하고 삭제 때 뺌)을 그대로 쓴다.
import { supabase } from '@/lib/supabase';
import { customerBalance, withOpening, dedupeSlips, type OpeningConfig } from '@/lib/ledgerRules';

async function allByCustomer(table: string, customerId: string): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').eq('customerId', customerId).order('id').range(from, from + 999);
    if (error) throw new Error(`${table} 읽기 실패: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function openingConfig(): Promise<OpeningConfig | null> {
  const { data, error } = await supabase.from('system_config').select('config').eq('id', 'default').maybeSingle();
  if (error) throw new Error(`시스템 설정 읽기 실패: ${error.message}`); // 읽기 실패를 «꺼짐»으로 오인해 기존 방식으로 새지 않게
  const ob = data?.config?.openingBalances;
  return ob?.asOf ? { asOf: ob.asOf, byCustomer: ob.byCustomer || {}, strict: !!ob.strict } : null;
}

/** 장부 잔액(받을 돈 +, 줄 돈 −). 장부 방식이 꺼져 있으면 null. */
export async function ledgerBalance(customerId: string, op?: OpeningConfig | null): Promise<number | null> {
  const o = op === undefined ? await openingConfig() : op;
  if (!o || !customerId) return null;
  const [slips, collections] = await Promise.all([allByCustomer('slips', customerId), allByCustomer('collections', customerId)]);
  const eff = withOpening(dedupeSlips(slips).slips, collections, o);
  return customerBalance(eff.slips as any, eff.collections as any, customerId, eff.base.get(customerId) || 0);
}

/** 장부 잔액을 거래처 미수금 칸에 맞춘다. 장부 방식이 꺼져 있으면 아무것도 안 하고 null. */
// 같은 거래처의 동시 sync를 한 줄로 세운다(읽고-계산하고-쓰는 사이에 다른 요청이 끼어 낡은 값으로 덮는 것 방지).
// 지름길: 이 프로세스 안에서만 유효 — 동산화스너는 서버 1대(3300)라 충분, 서버 여러 대로 늘리면 DB 쪽 락 필요.
const customerLocks = new Map<string, Promise<unknown>>();

export async function syncReceivables(customerId: string, op?: OpeningConfig | null): Promise<number | null> {
  const prev = customerLocks.get(customerId) ?? Promise.resolve();
  const task = prev.catch(() => {}).then(async () => {
    const bal = await ledgerBalance(customerId, op);
    if (bal === null) return null;
    const { error } = await supabase.from('customers').update({ receivables: bal }).eq('id', customerId);
    if (error) throw new Error(`미수금 갱신 실패: ${error.message}`);
    return bal;
  });
  customerLocks.set(customerId, task);
  try {
    return await task;
  } finally {
    if (customerLocks.get(customerId) === task) customerLocks.delete(customerId);
  }
}
