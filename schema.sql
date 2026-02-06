-- 마이너스 통장 - Supabase 테이블 설정
-- Supabase Dashboard > SQL Editor 에서 이 전체 내용을 복사하여 실행하세요

-- 사용자 테이블
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  total_amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 상환/대출 내역 테이블
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  amount INTEGER NOT NULL,
  memo TEXT DEFAULT '',
  type TEXT DEFAULT 'repayment',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- anon 접근 허용 정책
CREATE POLICY "allow_all_users" ON users FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_payments" ON payments FOR ALL TO anon USING (true) WITH CHECK (true);
