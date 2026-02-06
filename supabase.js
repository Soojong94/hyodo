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

// ============ 인증 ============
async function signupSupabase(username, password) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트 초기화 실패');

  const { data, error } = await sb
    .from('users')
    .insert({ username, password })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return { ok: false, msg: '이미 존재하는 아이디입니다.' };
    throw error;
  }

  return { ok: true, userId: data.id };
}

async function loginSupabase(username, password) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase 클라이언트 초기화 실패');

  const { data: user, error } = await sb
    .from('users')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !user) {
    return { ok: false, msg: '존재하지 않는 아이디입니다.', notFound: true };
  }

  if (user.password !== password) {
    return { ok: false, msg: '비밀번호가 틀렸습니다.' };
  }

  return { ok: true, userId: user.id, totalAmount: user.total_amount };
}

// ============ 데이터 동기화 ============
async function pullFromSupabase(username) {
  const sb = getSupabase();
  if (!sb) return null;

  const { data: user } = await sb
    .from('users')
    .select('*')
    .eq('username', username)
    .single();

  if (!user) return null;

  const { data: payments } = await sb
    .from('payments')
    .select('*')
    .eq('user_id', user.id);

  return {
    totalAmount: user.total_amount || 0,
    payments: (payments || []).map(p => ({
      id: p.id,
      date: p.date,
      amount: p.amount,
      memo: p.memo || '',
      type: p.type || 'repayment'
    }))
  };
}

async function pushToSupabase(username, data) {
  const sb = getSupabase();
  if (!sb) return;

  const { data: user } = await sb
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (!user) return;

  // 총 금액 업데이트
  await sb
    .from('users')
    .update({ total_amount: data.totalAmount })
    .eq('id', user.id);

  // 기존 내역 삭제 후 재삽입
  await sb
    .from('payments')
    .delete()
    .eq('user_id', user.id);

  if (data.payments.length > 0) {
    await sb.from('payments').insert(
      data.payments.map(p => ({
        id: p.id,
        user_id: user.id,
        date: p.date,
        amount: p.amount,
        memo: p.memo || '',
        type: p.type || 'repayment'
      }))
    );
  }
}

async function deleteAccountSupabase(username) {
  const sb = getSupabase();
  if (!sb) return;

  const { data: user } = await sb
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (user) {
    await sb.from('payments').delete().eq('user_id', user.id);
    await sb.from('users').delete().eq('id', user.id);
  }
}
