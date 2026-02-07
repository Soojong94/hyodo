// ============ Supabase 설정 ============
const SUPABASE_URL = 'https://vzagslpqucsyeefdndaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6YWdzbHBxdWNzeWVlZmRuZGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzQ0NDgsImV4cCI6MjA4NTk1MDQ0OH0.Ld2PQJ76DBPRjSLDf_5jtN8viPpCom60bYstXs8bEDM';

let _sb = null;

function getSupabase() {
  if (!_sb && window.supabase) {
    _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _sb;
}

// ============ 인증 (Auth) ============

/**
 * 회원가입 (이메일 + 닉네임)
 */
async function signupSupabase(email, password, nickname) {
  const sb = getSupabase();
  if (!sb) return { ok: false, msg: 'Supabase 클라이언트 오류' };

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { nickname } // 유저 메타데이터에 저장
    }
  });

  if (error) {
    console.error('Signup Error:', error);
    return { ok: false, msg: error.message };
  }

  // 프로필 테이블에도 닉네임 저장 (schema.sql 수정 필요할 수 있음)
  if (data.user) {
    await sb.from('profiles').upsert({ id: data.user.id, nickname });
  }

  return { ok: true, user: data.user };
}

/**
 * 로그인 (이메일)
 */
async function loginSupabase(email, password) {
  const sb = getSupabase();
  if (!sb) return { ok: false, msg: 'Supabase 클라이언트 오류' };

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error('Login Error:', error);
    // 보안상 상세 에러보다는 일반적인 메시지 추천하지만 디버깅 위해 구분
    if (error.message.includes('Invalid login credentials')) {
      return { ok: false, msg: '이메일 또는 비밀번호가 잘못되었습니다.' };
    }
    return { ok: false, msg: error.message };
  }

  return { ok: true, user: data.user };
}

/**
 * 로그아웃
 */
async function logoutSupabase() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

/**
 * 현재 로그인된 유저 세션 확인
 */
async function getSessionSupabase() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

/**
 * 닉네임 변경
 */
async function updateNicknameSupabase(nickname) {
  const sb = getSupabase();
  if (!sb) return { ok: false, msg: 'Supabase 클라이언트 오류' };

  // auth user_metadata 업데이트
  const { error: authError } = await sb.auth.updateUser({
    data: { nickname }
  });
  if (authError) return { ok: false, msg: authError.message };

  // profiles 테이블도 업데이트
  const { data: { user } } = await sb.auth.getUser();
  if (user) {
    await sb.from('profiles').update({ nickname }).eq('id', user.id);
  }

  return { ok: true };
}

/**
 * 비밀번호 재설정 이메일 발송
 */
async function resetPasswordSupabase(email) {
  const sb = getSupabase();
  if (!sb) return { ok: false, msg: 'Supabase 클라이언트 오류' };

  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/index.html'
  });

  if (error) return { ok: false, msg: error.message };
  return { ok: true };
}

/**
 * 새 비밀번호 설정 (리커버리 후)
 */
async function updatePasswordSupabase(newPassword) {
  const sb = getSupabase();
  if (!sb) return { ok: false, msg: 'Supabase 클라이언트 오류' };

  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, msg: error.message };
  return { ok: true };
}

/**
 * 닉네임으로 이메일 찾기 (마스킹)
 */
async function findEmailByNicknameSupabase(nickname) {
  const sb = getSupabase();
  if (!sb) return { ok: false, msg: 'Supabase 클라이언트 오류' };

  const { data, error } = await sb.rpc('find_email_by_nickname', {
    p_nickname: nickname
  });

  if (error) return { ok: false, msg: error.message };
  if (!data) return { ok: false, msg: '해당 닉네임으로 등록된 계정이 없습니다.' };
  return { ok: true, email: data };
}

/**
 * Auth 상태 변경 리스너 등록
 */
function onAuthStateChangeSupabase(callback) {
  const sb = getSupabase();
  if (!sb) return;
  sb.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

// ============ 데이터 동기화 (DB) ============

/**
 * 데이터 불러오기 (로그인된 유저의 데이터)
 */
async function pullFromSupabase() {
  const sb = getSupabase();
  if (!sb) return null;

  // 1. 현재 유저 확인
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  // 2. 프로필(총 금액) 가져오기
  const { data: profile } = await sb
    .from('profiles')
    .select('total_amount')
    .eq('id', user.id)
    .single();

  // 3. 결제 내역 가져오기
  const { data: payments } = await sb
    .from('payments')
    .select('*')
    .eq('user_id', user.id); // RLS가 있어서 .eq 생략해도 되지만 명시적으로 작성

  return {
    totalAmount: profile ? profile.total_amount : 0,
    payments: (payments || []).map(p => ({
      id: p.id,
      date: p.date,
      amount: p.amount,
      memo: p.memo || '',
      type: p.type || 'repayment'
    }))
  };
}

/**
 * 데이터 저장하기 (로그인된 유저의 데이터 덮어쓰기)
 * - 실제 서비스에선 '변경분'만 업데이트하는 게 좋지만, 로직 단순화를 위해 전체 동기화 방식 유지
 */
async function pushToSupabase(data) {
  const sb = getSupabase();
  if (!sb) return;

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  // 1. 총 금액 업데이트 (profiles)
  await sb
    .from('profiles')
    .upsert({ id: user.id, total_amount: data.totalAmount });

  // 2. 기존 내역 삭제 후 재삽입 (단순 동기화 전략)
  // 주의: 데이터가 많아지면 비효율적이므로 추후 수정 권장
  
  // 먼저 기존 데이터를 다 지움
  await sb.from('payments').delete().eq('user_id', user.id);

  // 새 데이터 삽입
  if (data.payments.length > 0) {
    const records = data.payments.map(p => ({
      id: p.id, // 클라이언트 ID 유지
      user_id: user.id,
      date: p.date,
      amount: p.amount,
      memo: p.memo || '',
      type: p.type || 'repayment'
    }));
    
    const { error } = await sb.from('payments').insert(records);
    if (error) console.error('Data Push Error:', error);
  }
}

/**
 * 계정 삭제 (RPC 함수로 auth.users 직접 삭제 → CASCADE로 profiles/payments 정리)
 */
async function deleteAccountSupabase() {
  const sb = getSupabase();
  if (!sb) return;

  const { error } = await sb.rpc('delete_own_account');
  if (error) {
    console.error('계정 삭제 오류:', error);
    throw error;
  }

  await sb.auth.signOut();
}