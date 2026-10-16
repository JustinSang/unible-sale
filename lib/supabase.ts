import { createClient } from '@supabase/supabase-js';

// DB 접근은 전부 서버(app/api, lib)에서만 한다. 서버 전용 키 SUPABASE_SERVICE_ROLE_KEY가 있으면 그것을 쓴다(RLS를 우회하므로 절대 NEXT_PUBLIC_ 접두어를 붙이거나 브라우저로 보내지 말 것).
// 없으면 예전처럼 공개 anon 키를 쓴다 — 이 경우 RLS를 켜면 앱이 막히므로 scripts/supabase_rls.sql은 서버 키를 설정·배포한 «뒤에» 실행한다.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
