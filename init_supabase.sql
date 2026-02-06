-- [Supabase 초기화 SQL 스크립트]
-- 실행 위치: Supabase Dashboard > SQL Editor
-- 주의: 이 스크립트를 실행하면 기존의 payments, users, profiles 테이블이 삭제되고 초기화됩니다.

-- 1. 기존 테이블 삭제
DROP TABLE IF EXISTS public.payments;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.profiles;

-- 2. 프로필 테이블 생성 (총 대출 금액 저장용)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_amount INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 결제/대출 내역 테이블 생성
CREATE TABLE public.payments (
  id TEXT PRIMARY KEY, 
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'repayment', -- 'repayment' 또는 'spend'
  memo TEXT DEFAULT '',
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS (Row Level Security) 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 5. 보안 정책 설정 (본인 데이터만 접근 가능)

-- 프로필 정책
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- 결제 내역 정책 (CRUD 전체)
CREATE POLICY "Users can manage their own payments" 
ON public.payments FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. 새 유저 가입 시 자동으로 프로필을 생성하는 트리거 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, total_amount)
  VALUES (new.id, 0);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 연결
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
