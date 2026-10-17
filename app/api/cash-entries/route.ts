export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { audit } from '@/lib/audit';

// 현금 입출금(원본 «현금출납 입력»): 거래처가 없는 기타 현금 입금·출금을 한 줄씩 적는다. 현금출납부 조회가 이 줄을 함께 합산한다.
// 거래처 미수금·재고에는 영향이 없다(수금·지급은 «수금/지급관리»에서).
export async function GET() {
  const { data, error } = await supabase.from('cash_entries').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const amount = Math.round(Number(b.amount));
    const date = String(b.date || '');
    if (b.type !== 'in' && b.type !== 'out') return NextResponse.json({ error: '입금 또는 출금을 고르세요.' }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: '금액은 1원 이상이어야 합니다.' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: '일자를 YYYY-MM-DD로 입력하세요.' }, { status: 400 });
    const row = { id: `ce-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, date, type: b.type, account: String(b.account || '').slice(0, 40), amount, memo: String(b.memo || '').slice(0, 200), createdAt: new Date().toISOString() };
    const { error } = await supabase.from('cash_entries').insert(row);
    if (error) throw new Error(error.message);
    await audit('create', 'cash_entry', row.id, `현금 ${row.type === 'in' ? '입금' : '출금'}: ${row.account || '(계정 없음)'} ${amount.toLocaleString('ko-KR')}원`, row);
    return NextResponse.json(row, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '현금 입출금 저장 실패' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get('id') || '';
    const { data: before } = await supabase.from('cash_entries').select('*').eq('id', id).maybeSingle();
    if (!before) return NextResponse.json({ error: '해당 입출금 줄을 찾을 수 없습니다.' }, { status: 404 });
    const { error } = await supabase.from('cash_entries').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await audit('delete', 'cash_entry', id, `현금 입출금 삭제: ${before.account || ''} ${Number(before.amount).toLocaleString('ko-KR')}원`, before);
    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '삭제 실패' }, { status: 500 });
  }
}
