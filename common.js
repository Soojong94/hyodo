// ============ 스토리지 키 ============
const STORAGE_KEY_PREFIX = 'hyodo_data_v2_'; // 유저별 데이터 저장 키 접두사
const LAST_USER_KEY = 'hyodo_last_user'; // 마지막 로그인 이메일

// ============ 전역 상태 ============
let currentUserEmail = null;

// ============ 인증 관리 ============

// 초기화: 페이지 로드 시 세션 복구 시도
async function initAuth() {
  if (typeof getSessionSupabase !== 'function') return false;
  
  const session = await getSessionSupabase();
  if (session && session.user) {
    currentUserEmail = session.user.email;
    return true;
  }
  return false;
}

function getCurrentUser() {
  return currentUserEmail;
}

function isAuthenticated() {
  return !!currentUserEmail;
}

async function login(email, password) {
  if (!email || !password) return { ok: false, msg: '이메일과 비밀번호를 입력해주세요.' };
  
  try {
    const result = await loginSupabase(email, password);
    if (result.ok) {
      currentUserEmail = result.user.email;
      localStorage.setItem(LAST_USER_KEY, currentUserEmail);
      return { ok: true };
    }
    return result;
  } catch (e) {
    console.error(e);
    return { ok: false, msg: '로그인 중 오류가 발생했습니다.' };
  }
}

async function signup(email, password) {
  if (!email || !password) return { ok: false, msg: '이메일과 비밀번호를 입력해주세요.' };
  if (password.length < 6) return { ok: false, msg: '비밀번호는 6자 이상이어야 합니다.' }; // Supabase 기본 정책
  
  try {
    const result = await signupSupabase(email, password);
    if (result.ok) {
      // 자동 로그인 처리 안됨 (이메일 확인 필요할 수 있음) -> 바로 로그인 시도해보기
      // Supabase 설정에서 'Confirm email'이 꺼져있다면 바로 로그인 가능
      const loginResult = await loginSupabase(email, password);
      if (loginResult.ok) {
        currentUserEmail = loginResult.user.email;
        localStorage.setItem(LAST_USER_KEY, currentUserEmail);
        return { ok: true };
      }
      return { ok: true, msg: '가입되었습니다. 로그인해주세요.' }; 
    }
    return result;
  } catch (e) {
    return { ok: false, msg: '가입 중 오류가 발생했습니다.' };
  }
}

async function logout() {
  await logoutSupabase();
  currentUserEmail = null;
  localStorage.removeItem(LAST_USER_KEY);
  window.location.reload();
}

async function deleteAccount() {
  if (!confirm('정말로 탈퇴하시겠습니까? 모든 데이터가 삭제됩니다.')) return;
  await deleteAccountSupabase();
  currentUserEmail = null;
  localStorage.removeItem(LAST_USER_KEY);
  alert('탈퇴되었습니다.');
  window.location.reload();
}

// ============ 데이터 관리 ============

function getStorageKey() {
  return currentUserEmail ? STORAGE_KEY_PREFIX + currentUserEmail : 'hyodo_temp_data';
}

function getDefaultData() {
  return { totalAmount: 0, payments: [] };
}

// 데이터 불러오기: 로컬 캐시 우선, 그 후 클라우드 동기화
function loadData() {
  try {
    const raw = localStorage.getItem(getStorageKey());
    const data = raw ? JSON.parse(raw) : getDefaultData();
    
    // 데이터 구조 안전장치
    if (!Array.isArray(data.payments)) data.payments = [];
    if (typeof data.totalAmount !== 'number') data.totalAmount = 0;
    
    return data;
  } catch (e) {
    return getDefaultData();
  }
}

// 클라우드 데이터와 동기화 (앱 시작 시 호출)
async function syncData() {
  if (!isAuthenticated()) return null;
  
  try {
    const cloudData = await pullFromSupabase();
    if (cloudData) {
      // 클라우드 데이터가 있으면 로컬 덮어쓰기 (단순화)
      localStorage.setItem(getStorageKey(), JSON.stringify(cloudData));
      return cloudData;
    }
  } catch (e) {
    console.warn('데이터 동기화 실패:', e);
  }
  return null;
}

// 데이터 저장: 로컬 저장 후 클라우드 전송
async function saveData(data) {
  localStorage.setItem(getStorageKey(), JSON.stringify(data));
  
  if (isAuthenticated()) {
    try {
      await pushToSupabase(data);
    } catch (e) {
      console.warn('클라우드 저장 실패:', e);
    }
  }
}

// ============ 유틸리티 ============
function formatMoney(num) {
  return num.toLocaleString('ko-KR') + '원';
}

function getPaidTotal(data) {
  return data.payments
    .filter(p => !p.type || p.type === 'repayment')
    .reduce((sum, p) => sum + p.amount, 0);
}

function getSpendTotal(data) {
  return data.payments
    .filter(p => p.type === 'spend')
    .reduce((sum, p) => sum + p.amount, 0);
}

function getEffectiveTotal(data) {
  // 유효 총액 = 설정한 총액 + 추가 대출액
  return data.totalAmount + getSpendTotal(data);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ============ 로그인 로그 (로컬 전용) ============
// 기능 유지하되 로컬에만 저장
const LOGIN_LOG_KEY = 'hyodo_login_log';
function addLoginLog(username, action) {
  try {
    const log = JSON.parse(localStorage.getItem(LOGIN_LOG_KEY)) || [];
    log.push({ username, action, time: new Date().toISOString() });
    localStorage.setItem(LOGIN_LOG_KEY, JSON.stringify(log));
  } catch (e) {}
}

// ============ 하단 네비게이션 ============
function renderBottomNav(activePage) {
  const nav = document.getElementById('bottomNav');
  if (!nav) return;
  const homeActive = activePage === 'home';
  const historyActive = activePage === 'history';
  nav.innerHTML = `
    <a href="index.html" class="flex-1 flex flex-col items-center gap-1 py-3 ${homeActive ? 'text-[#1e3a5f]' : 'text-gray-400'}">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
      <span class="text-sm font-bold">홈</span>
    </a>
    <a href="history.html" class="flex-1 flex flex-col items-center gap-1 py-3 ${historyActive ? 'text-[#1e3a5f]' : 'text-gray-400'}">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </svg>
      <span class="text-sm font-bold">내역</span>
    </a>
  `;
}