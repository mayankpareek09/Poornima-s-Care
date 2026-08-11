// ═══════════════════════════════════════════════
//  Poornima's Care — Shared API + UI Utilities
//  v12 — Vercel + Render ready — FIXED VERSION
// ═══════════════════════════════════════════════

// ── Backend URL: auto-detect environment ─────────
//  • In production (Vercel):  set window.PC_API_URL in your Vercel env
//    via a small inline script, OR set VITE_API_URL if you ever migrate.
//  • In local dev: defaults to same-origin /api (works with express proxy or
//    when running the express server locally on same port).
//  • To hardcode your Render backend temporarily, replace the URL below.
const API = (function() {
  // 1. Check for injected runtime config (recommended for Vercel)
  if (window.PC_API_URL) return window.PC_API_URL.replace(/\/$/, '') + '/api';
  // 2. Check meta tag: <meta name="api-base" content="https://your-app.onrender.com">
  const meta = document.querySelector('meta[name="api-base"]');
  if (meta && meta.content) return meta.content.replace(/\/$/, '') + '/api';
  // 3. Fallback: same origin (local dev or reverse-proxied deployment)
  return window.location.origin + '/api';
})();

// ── Token helpers ────────────────────────────────
function getToken()  { return localStorage.getItem('pc_token'); }
function getUser()   { const u = localStorage.getItem('pc_user'); try { return u ? JSON.parse(u) : null; } catch { return null; } }
function setSession(token, user) { localStorage.setItem('pc_token', token); localStorage.setItem('pc_user', JSON.stringify(user)); }
function clearSession() { localStorage.removeItem('pc_token'); localStorage.removeItem('pc_user'); }

function requireAuth(allowedRoles) {
  const user  = getUser();
  const token = getToken();

  // If not logged in → go to login
  if (!user || !token) {
    window.location.href = '/index.html';
    return null;
  }

  // If role not allowed → block
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    alert('Access denied. You do not have permission to view this page.');
    window.location.href = '/index.html';
    return null;
  }

  return user;
}

// ── Fetch wrapper ────────────────────────────────
// Escapes HTML special characters before injecting user-supplied text into
// innerHTML. Server-side sanitization already strips tags before storage,
// but this covers any data written before that fix, and any other user text
// rendered on the page — belt and suspenders.
function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${endpoint}`, { ...options, headers });
  
  // Handle non-JSON responses (e.g. Render waking up and returning HTML error pages)
  const contentType = res.headers.get('content-type') || '';
 if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      clearSession();
      // Only redirect if we're not already on the login page
      if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        window.location.href = '/index.html';
      }
      return;
    }
    throw new Error(res.status === 503 
      ? 'Server is waking up, please wait a moment and try again.' 
      : `Server error (${res.status}). Please try again.`);
  }
  
  const data = await res.json();
  if (res.status === 401 || res.status === 403) {
    clearSession();
    if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
      window.location.href = '/index.html';
    }
    return;
  }
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}
// ⬆️ CRITICAL FIX: Added missing closing brace above this line

// ── Toast ────────────────────────────────────────
function showToast(msg, type = 'success') {
  const old = document.querySelector('.pc-toast'); if (old) old.remove();
  const colors = { success:'#27ae60', error:'#e74c3c', info:'#2980b9', warning:'#e67e22' };
  const icons  = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
  const t = document.createElement('div');
  t.className = 'pc-toast';
  t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:${colors[type]||colors.info};color:white;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,0.22);display:flex;align-items:center;gap:10px;max-width:340px;font-family:'Plus Jakarta Sans','Poppins',sans-serif;animation:slideIn .25s cubic-bezier(0.34,1.56,0.64,1);`;
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),300); }, 3500);
}

// ── Modal helpers ────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ── Badge helpers ────────────────────────────────
function statusBadge(status) {
  const m = { open:['badge-open','🔴 Open'], inprogress:['badge-inprogress','🟡 In Progress'], resolved:['badge-resolved','🟢 Resolved'] };
  const [cls, label] = m[status] || ['badge-new', status];
  return `<span class="badge ${cls}">${label}</span>`;
}
function laundryBadge(status) {
  const m = { pending:['badge-new','⏳ Pending'], submitted:['badge-inprogress','📦 Submitted'], washing:['badge-inprogress','🔄 Washing'], ready:['badge-resolved','✅ Ready'], collected:['badge-gold','📬 Collected'] };
  const [cls, label] = m[status] || ['badge-new', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ── Date formatter ────────────────────────────────
function fmtDate(d)     { return d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'; }
function fmtDateTime(d) { return d ? new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'; }

// ── Render logged-in user in header ──────────────
function renderUserHeader(prefix = '') {
  const user = getUser();
  if (!user) return;
  const av  = document.getElementById('userAvatar');
  const nm  = document.getElementById('userName');
  const uid = document.getElementById('userId');
  if (av) {
    av.textContent = user.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    if (user.profilePhoto) {
      av.innerHTML = `<img src="${user.profilePhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="Profile"/>`;
    }
    const pill = document.getElementById('userPill') || av.closest('.user-info-pill');
    if (pill) { pill.style.cursor='pointer'; pill.onclick=()=>{ window.location.href=(window.location.pathname.includes('/pages/')?'':'pages/')+'profile.html'; }; }
  }
  if (nm)  nm.textContent  = user.name;
  if (uid) uid.textContent = `${user.userId} · ${user.course||user.department||user.role.replace('_',' ')}`;
}

// ── Sign out ──────────────────────────────────────
function signOut() { 
  clearSession(); 
  window.location.href = '/index.html';
}

// ── CSS animations ───────────────────────────────
const _s = document.createElement('style');
_s.textContent = `
  @keyframes slideIn { from { transform:translateX(60px);opacity:0; } to { transform:none;opacity:1; } }
  html { opacity: 0; }
  html.pc-ready { opacity: 1; transition: opacity .12s ease; }
`;
document.head.appendChild(_s);
requestAnimationFrame(() => document.documentElement.classList.add('pc-ready'));

// ── Instant navigation: prefetch sidebar/menu link targets on hover/touch ──
// This app uses full page navigation between portals (not a single-page app).
// Prefetching the destination HTML the moment the user hovers/touches a link
// means the next page is already in the browser cache by the time they click,
// so the sidebar reload feels instant instead of a visible flash/reload.
(function() {
  const prefetched = new Set();
  function prefetch(url) {
    if (!url || prefetched.has(url)) return;
    prefetched.add(url);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  }
  function extractUrl(el) {
    const onclick = el.getAttribute('onclick') || '';
    const match = onclick.match(/(?:window\.location\.href\s*=\s*|window\.open\()['"]([^'"]+\.html)['"]/);
    return match ? match[1] : null;
  }
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('.asb-link, a[href$=".html"]');
    if (!el) return;
    const href = el.getAttribute('href');
    if (href && href.endsWith('.html')) return prefetch(href);
    const url = extractUrl(el);
    if (url) prefetch(url);
  }, { passive: true });
  document.addEventListener('touchstart', e => {
    const el = e.target.closest('.asb-link, a[href$=".html"]');
    if (!el) return;
    const href = el.getAttribute('href');
    if (href && href.endsWith('.html')) return prefetch(href);
    const url = extractUrl(el);
    if (url) prefetch(url);
  }, { passive: true });
})();