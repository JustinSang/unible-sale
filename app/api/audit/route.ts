export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 변경 이력 조회(최근 순). ?limit=300 (최대 1000), ?entity=slip|product|customer
export async function GET(req: Request) {
  const u = new URL(req.url);
  const limit = Math.min(1000, Math.max(1, Number(u.searchParams.get('limit')) || 300));
  const entity = u.searchParams.get('entity');
  let q = supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(limit);
  if (entity) q = q.eq('entity', entity);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
