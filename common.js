// ============ 스토리지 키 ============
const USERS_KEY = 'hyodo_users';
const AUTH_KEY = 'hyodo_auth';
const LOGIN_LOG_KEY = 'hyodo_login_log';

// ============ 사용자 관리 ============
function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
  catch { return {}; }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function signup(username, password) {
  const id = username.trim();
  const pw = password.trim();
  if (!id || !pw) return { ok: false, msg: '아이디와 비밀번호를 입력해주세요.' };
  if (id.length < 2) return { ok: false, msg: '아이디는 2자 이상이어야 합니다.' };
  if (pw.length < 4) return { ok: false, msg: '비밀번호는 4자 이상이어야 합니다.' };

  const users = getUsers();
  if (users[id]) return { ok: false, msg: '이미 존재하는 아이디입니다.' };

  users[id] = { password: pw, createdAt: new Date().toISOString() };
  saveUsers(users);
  addLoginLog(id, 'signup');
  return { ok: true };
}

function login(username, password) {
  const id = username.trim();
  const pw = password.trim();
  if (!id || !pw) return { ok: false, msg: '아이디와 비밀번호를 입력해주세요.' };

  const users = getUsers();
  if (!users[id]) return { ok: false, msg: '존재하지 않는 아이디입니다.' };
  if (users[id].password !== pw) return { ok: false, msg: '비밀번호가 틀렸습니다.' };

  sessionStorage.setItem(AUTH_KEY, id);
  addLoginLog(id, 'login');
  return { ok: true };
}

function getCurrentUser() {
  return sessionStorage.getItem(AUTH_KEY);
}

function isAuthenticated() {
  return !!getCurrentUser();
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

// ============ 로그인 기록 ============
function addLoginLog(username, action) {
  const log = getLoginLog();
  log.push({ username, action, time: new Date().toISOString() });
  if (log.length > 100) log.splice(0, log.length - 100);
  localStorage.setItem(LOGIN_LOG_KEY, JSON.stringify(log));
}

function getLoginLog() {
  try { return JSON.parse(localStorage.getItem(LOGIN_LOG_KEY)) || []; }
  catch { return []; }
}

// ============ 데이터 관리 (유저별) ============
function getStorageKey() {
  const user = getCurrentUser();
  return user ? 'hyodo_data_' + user : 'hyodo_data';
}

function getDefaultData() {
  return { totalAmount: 0, payments: [] };
}

function loadData() {
  try {
    const raw = localStorage.getItem(getStorageKey());
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
  localStorage.setItem(getStorageKey(), JSON.stringify(data));
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

// ============ PWA 서비스워커 ============
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
