-- [초기화 및 보안 설정]
-- Supabase SQL Editor에서 이 스크립트를 실행하면 기존 데이터를 삭제하고
-- Supabase Auth와 연동된 안전한 테이블 구조를 생성합니다.

-- 1. 기존 테이블 정리 (주의: 데이터가 삭제됩니다)
DROP TABLE IF EXISTS public.payments;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.profiles;

-- 2. 프로필 테이블 생성 (총 대출 금액 + 닉네임 저장)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_amount INTEGER DEFAULT 0,
  nickname TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 결제/대출 내역 테이블 생성
CREATE TABLE public.payments (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'repayment',
  memo TEXT DEFAULT '',
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS (행 수준 보안) 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 5. 보안 정책 설정 (내 데이터만 접근 가능)

-- 프로필 정책
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- 결제 내역 정책
CREATE POLICY "Users can CRUD their own payments"
ON public.payments FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. 새 유저 가입 시 자동으로 프로필 생성하는 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, total_amount, nickname)
  VALUES (new.id, 0, new.raw_user_meta_data->>'nickname');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. 계정 삭제 RPC (SECURITY DEFINER로 auth.users 직접 삭제)
CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- 8. 닉네임으로 이메일 찾기 RPC (마스킹된 이메일 반환)
CREATE OR REPLACE FUNCTION find_email_by_nickname(p_nickname TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_email TEXT;
BEGIN
  SELECT u.email INTO v_email
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE LOWER(p.nickname) = LOWER(p_nickname)
  LIMIT 1;
  IF v_email IS NULL THEN RETURN NULL; END IF;
  RETURN CONCAT(LEFT(v_email, 3), '***@', SPLIT_PART(v_email, '@', 2));
END;
$$;
