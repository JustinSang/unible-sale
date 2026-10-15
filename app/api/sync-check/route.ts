export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 화면 자동 동기화용 경량 확인: 전체 데이터(약 9MB) 대신 표별 건수만 돌려준다.
export async function GET() {
  const count = async (table: string) => {
    const { count: n, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    return error ? null : n;
  };
  const [products, customers, slips] = await Promise.all([count('products'), count('customers'), count('slips')]);
  return NextResponse.json({ products, customers, slips });
}
