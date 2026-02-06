// ============================================
// 비밀번호 설정 (여기서 변경하세요!)
// ============================================
const APP_PASSWORD = '1234';

// ============ 스토리지 키 ============
const STORAGE_KEY = 'hyodo_data';
const AUTH_KEY = 'hyodo_auth';

// ============ 인증 ============
function isAuthenticated() {
  return sessionStorage.getItem(AUTH_KEY) === 'true';
}

function authenticate(password) {
  if (password === APP_PASSWORD) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    return true;
  }
  return false;
}

function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  window.location.href = 'index.html';
}

function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// ============ 데이터 관리 ============
function getDefaultData() {
  return { totalAmount: 0, payments: [] };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultData();
    const data = JSON.parse(raw);
    if (!Array.isArray(data.payments)) data.payments = [];
    if (typeof data.totalAmount !== 'number') data.totalAmount = 0;
    return data;
  } catch (e) {
    return getDefaultData();
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ============ 유틸리티 ============
function formatMoney(num) {
  return num.toLocaleString('ko-KR') + '원';
}

function getPaidTotal(data) {
  return data.payments.reduce((sum, p) => sum + p.amount, 0);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ============ 하단 네비게이션 렌더링 ============
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

// ============ PWA 서비스워커 ============
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
