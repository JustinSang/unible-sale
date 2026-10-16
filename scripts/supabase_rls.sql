-- 행 수준 보안(RLS) 잠금 — 공개 anon 키로는 아무것도 읽고 쓰지 못하게 한다. 서버 전용 service_role 키는 RLS를 우회하므로 앱(app/api)은 그대로 동작한다.
-- ⚠ 순서(어기면 앱이 «데이터 없음/저장 실패»가 된다):
--   ① Supabase 대시보드 → Project Settings → API 에서 service_role 키를 복사해 서버 환경변수 SUPABASE_SERVICE_ROLE_KEY로 넣는다
--      (로컬 .env.local, Vercel Environment Variables). NEXT_PUBLIC_ 접두어를 붙이지 말 것.
--   ② 그 키로 앱을 재배포하고 화면이 정상인지(품목·전표 목록이 보이는지) 확인한다.
--   ③ 그 다음에 이 파일을 SQL Editor에서 실행한다. (멱등 — 여러 번 실행해도 된다)
-- 되돌리기: 아래 표 이름마다 `alter table public.<표> disable row level security;`
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.slips enable row level security;
alter table public.collections enable row level security;
alter table public.bills enable row level security;
alter table public.tax_invoices enable row level security;
alter table public.deliveries enable row level security;
alter table public.inventory_logs enable row level security;
alter table public.customer_prices enable row level security;
alter table public.system_config enable row level security;
alter table public.midong_orders enable row level security;
alter table public.audit_log enable row level security;
-- 정책(policy)을 만들지 않았으므로 anon·authenticated 역할은 모든 행이 거부된다(service_role만 통과).
