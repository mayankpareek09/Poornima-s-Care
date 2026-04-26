/// ═══════════════════════════════════════════════════════════════
// POORNIMA'S CARE — FEATURES.JS  v2 (production-safe)
// ═══════════════════════════════════════════════════════════════

// ─── Safe API base (does NOT conflict with api.js) ───────────────
const FEAT_API = (function() {
  if (window.PC_API_URL) return window.PC_API_URL.replace(/\/$/, '');
  const meta = document.querySelector('meta[name="api-base"]');
  if (meta && meta.content) return meta.content.replace(/\/$/, '');
  return 'https://poornima-s-care.onrender.com';
})();

// ─── Safe wrappers (use api.js functions if loaded, else fallback) ─
function _getToken() { return (typeof getToken==='function') ? getToken() : localStorage.getItem('pc_token'); }
function _getUser()  { if(typeof getUser==='function') return getUser(); try{return JSON.parse(localStorage.getItem('pc_user'));}catch{return null;} }
function _showToast(msg,type){ if(typeof showToast==='function') return showToast(msg,type); console.log(`[${type||'info'}] ${msg}`); }
function _authHeaders(extra={}){ return {'Content-Type':'application/json','Authorization':`Bearer ${_getToken()}`,...extra}; }

function _showToast(msg, type) {
  if (typeof showToast === 'function') return _showToast(msg, type);
  console.log(`[${type}] ${msg}`);
}
function _authHeaders(extra = {}) {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_getToken()}`, ...extra };
}


// ═══════════════════════════════════════════════════════════════
// FEATURE 4: NOTIFICATION BELL SYSTEM
// ═══════════════════════════════════════════════════════════════
let notifPollInterval = null;

function initNotifications() {
  const user = _getUser();
  if (!user) return;

  // Inject bell HTML into header if not present
  if (!document.getElementById('pc-notif-bell')) {
    const bellHTML = `
      <div id="pc-notif-bell" style="position:relative;display:inline-block;cursor:pointer;margin-right:12px;" onclick="toggleNotifDropdown()">
        <span style="font-size:22px;">🔔</span>
        <span id="pc-notif-badge" style="display:none;position:absolute;top:-4px;right:-4px;
          background:#e74c3c;color:white;border-radius:50%;padding:2px 6px;font-size:10px;font-weight:700;min-width:18px;text-align:center;">0</span>
      </div>
      <div id="pc-notif-dropdown" style="display:none;position:absolute;top:50px;right:10px;
        background:white;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.15);
        width:340px;max-height:420px;overflow-y:auto;z-index:9999;border:1px solid #eee;">
        <div style="padding:14px 16px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
          <b style="font-size:14px;">Notifications</b>
          <button onclick="markAllNotifRead()" style="font-size:11px;color:#667eea;background:none;border:none;cursor:pointer;">Mark all read</button>
        </div>
        <div id="pc-notif-list" style="padding:8px 0;">
          <p style="text-align:center;color:#999;padding:20px;font-size:13px;">Loading...</p>
        </div>
      </div>`;

    // Find header area
const header = document.querySelector('.header-actions') ||
                   document.querySelector('.nav-right') ||
                   document.querySelector('.top-bar-right') ||
                   document.querySelector('.header-right') ||
                   document.querySelector('.user-info-pill')?.parentElement ||
                   document.querySelector('.topbar') ||
                   document.querySelector('header');
    if (header) {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;display:inline-block;';
      wrapper.innerHTML = bellHTML;
      header.prepend(wrapper);
    }
  }

  fetchNotifications();
  notifPollInterval = setInterval(fetchNotifications, 30000); // poll every 30s
}

async function fetchNotifications() {
  try {
    const r = await fetch(`${FEAT_API}/api/notifications`, { headers: _authHeaders() });
    const data = await r.json();
    if (!data.success) return;

    const badge = document.getElementById('pc-notif-badge');
    if (badge) {
      if (data.unreadCount > 0) {
        badge.style.display = 'block';
        badge.textContent = data.unreadCount > 99 ? '99+' : data.unreadCount;
      } else {
        badge.style.display = 'none';
      }
    }

    renderNotifications(data.notifications || []);
  } catch (e) { /* silent */ }
}

function renderNotifications(notifs) {
  const list = document.getElementById('pc-notif-list');
  if (!list) return;

  if (!notifs.length) {
    list.innerHTML = `<p style="text-align:center;color:#999;padding:20px;font-size:13px;">No notifications yet</p>`;
    return;
  }

  const icons = { complaint:'📝', laundry:'👕', event:'📅', sos:'🚨', escalation:'⚠️', reminder:'⏰', system:'ℹ️' };
  const priorityColors = { low:'#27ae60', medium:'#f39c12', high:'#e67e22', critical:'#e74c3c' };

  list.innerHTML = notifs.map(n => `
    <div onclick="markNotifRead('${n._id}')" style="padding:12px 16px;border-bottom:1px solid #f5f5f5;
      background:${n.isRead ? 'white' : '#f0f4ff'};cursor:pointer;transition:background 0.2s;"
      onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='${n.isRead ? 'white' : '#f0f4ff'}'">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <span style="font-size:18px;">${icons[n.type] || 'ℹ️'}</span>
        <div style="flex:1;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <b style="font-size:13px;color:#333;">${n.title}</b>
            <span style="width:8px;height:8px;border-radius:50%;background:${priorityColors[n.priority] || '#999'};flex-shrink:0;"></span>
          </div>
          <p style="margin:3px 0 0;font-size:12px;color:#666;line-height:1.4;">${n.message}</p>
          <span style="font-size:10px;color:#999;">${new Date(n.createdAt).toLocaleString()}</span>
        </div>
      </div>
    </div>`).join('');
}

function toggleNotifDropdown() {
  const dd = document.getElementById('pc-notif-dropdown');
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

async function markNotifRead(id) {
  try {
    await fetch(`${FEAT_API}/api/notifications/${id}/read`, { method: 'PATCH', headers: _authHeaders() });
    fetchNotifications();
  } catch (e) {}
}

async function markAllNotifRead() {
  try {
    await fetch(`${FEAT_API}/api/notifications/read-all`, { method: 'PATCH', headers: _authHeaders() });
    fetchNotifications();
  } catch (e) {}
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const bell = document.getElementById('pc-notif-bell');
  const dd = document.getElementById('pc-notif-dropdown');
  if (dd && bell && !bell.contains(e.target) && !dd.contains(e.target)) {
    dd.style.display = 'none';
  }
});

// ═══════════════════════════════════════════════════════════════
// FEATURE 2: SOS EMERGENCY BUTTON
// ═══════════════════════════════════════════════════════════════
function initSOS() {
  const user = _getUser();
  if (!user || user.role !== 'student') return;
  if (document.getElementById('pc-sos-btn')) return;

  const btn = document.createElement('div');
  btn.id = 'pc-sos-btn';
  btn.innerHTML = '🆘 SOS';
  btn.style.cssText = `
    position: fixed; bottom: 30px; right: 30px;
    background: linear-gradient(135deg, #e74c3c, #c0392b);
    color: white; font-weight: 800; font-size: 14px;
    padding: 14px 20px; border-radius: 50px;
    cursor: pointer; z-index: 99999;
    box-shadow: 0 4px 20px rgba(231,76,60,0.5);
    animation: sos-pulse 2s infinite;
    user-select: none; letter-spacing: 1px;
  `;
  btn.onclick = showSOSModal;
  document.body.appendChild(btn);

  // Pulse animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes sos-pulse {
      0%, 100% { box-shadow: 0 4px 20px rgba(231,76,60,0.5); transform: scale(1); }
      50% { box-shadow: 0 4px 35px rgba(231,76,60,0.8); transform: scale(1.05); }
    }
    #pc-sos-modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:999999; align-items:center; justify-content:center; }
    #pc-sos-modal-overlay.show { display:flex; }
  `;
  document.head.appendChild(style);

  // Modal
  const modal = document.createElement('div');
  modal.id = 'pc-sos-modal-overlay';
  modal.innerHTML = `
    <div style="background:white;border-radius:20px;padding:32px;max-width:420px;width:90%;text-align:center;
      box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <div style="font-size:50px;margin-bottom:12px;">🚨</div>
      <h2 style="color:#e74c3c;margin:0 0 8px;font-size:24px;">EMERGENCY SOS</h2>
      <p style="color:#666;font-size:14px;margin:0 0 20px;">This will immediately alert ALL administrators. Use only in genuine emergencies.</p>
      <textarea id="sos-desc" placeholder="Briefly describe your emergency..." rows="3"
        style="width:100%;padding:12px;border:2px solid #eee;border-radius:10px;font-size:14px;
        resize:none;box-sizing:border-box;margin-bottom:16px;"></textarea>
      <div style="display:flex;gap:12px;justify-content:center;">
        <button onclick="document.getElementById('pc-sos-modal-overlay').classList.remove('show')"
          style="padding:12px 24px;border:2px solid #ddd;background:white;border-radius:10px;cursor:pointer;font-weight:600;color:#666;">
          Cancel
        </button>
        <button onclick="sendSOS()"
          style="padding:12px 28px;background:linear-gradient(135deg,#e74c3c,#c0392b);color:white;
          border:none;border-radius:10px;cursor:pointer;font-weight:800;font-size:16px;letter-spacing:0.5px;">
          🆘 SEND SOS
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function showSOSModal() {
  const modal = document.getElementById('pc-sos-modal-overlay');
  if (modal) modal.classList.add('show');
}

async function sendSOS() {
  const desc = document.getElementById('sos-desc')?.value?.trim();
  if (!desc) { alert('Please describe your emergency first.'); return; }

  const user = _getUser();
  try {
    const r = await fetch(`${FEAT_API}/api/complaints`, {
      method: 'POST',
      headers: _authHeaders(),
      body: JSON.stringify({
        title: `🚨 SOS EMERGENCY - ${user?.name || 'Student'}`,
        category: 'Security',
        description: desc,
        priority: 'SOS',
        isSOS: true,
      })
    });
    const data = await r.json();
    if (data.success) {
      document.getElementById('pc-sos-modal-overlay').classList.remove('show');
      _showToast('🚨 SOS Alert Sent! Help is on the way.', 'error');
      // Show confirmation
      setTimeout(() => {
        const btn = document.getElementById('pc-sos-btn');
        if (btn) {
          const orig = btn.innerHTML;
          btn.innerHTML = '✅ SOS Sent';
          btn.style.background = 'linear-gradient(135deg,#27ae60,#229954)';
          setTimeout(() => { btn.innerHTML = orig; btn.style.background = 'linear-gradient(135deg,#e74c3c,#c0392b)'; }, 5000);
        }
      }, 100);
    } else {
      alert(data.message || 'SOS failed. Please call 112.');
    }
  } catch (e) {
    alert('Network error. Please call 112 or contact warden directly.');
  }
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 3: ORION AI COMMAND SYSTEM
// ═══════════════════════════════════════════════════════════════
function initOrionAI() {
  const user = _getUser();
  if (!user || user.role !== 'student') return;

  // Inject Orion panel — find dashboard content area
  const container = document.querySelector('.dashboard-content') ||
                    document.querySelector('.main-content') ||
                    document.querySelector('.content-area') ||
                    document.querySelector('#main-content') ||
                    document.querySelector('.page-content') ||
                    document.querySelector('.content') ||
                    document.querySelector('main') ||
                    document.querySelector('.cards-grid')?.parentElement;
  if (!container || document.getElementById('orion-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'orion-panel';
  panel.style.cssText = 'background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;padding:20px;margin:16px 0;color:white;';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      <div style="width:36px;height:36px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;">🤖</div>
      <div>
        <b style="font-size:16px;letter-spacing:0.5px;">ORION AI Assistant</b>
        <p style="margin:0;font-size:11px;color:#aaa;">Type a command to get real data instantly</p>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <input id="orion-input" type="text" placeholder='Try: "my complaints", "laundry status", "upcoming events"...'
        style="flex:1;padding:12px 16px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);
        border-radius:10px;color:white;font-size:13px;outline:none;"
        onkeydown="if(event.key==='Enter') runOrion()" />
      <button onclick="runOrion()" style="padding:12px 18px;background:linear-gradient(135deg,#667eea,#764ba2);
        color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;font-size:13px;">Ask</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;" id="orion-quick-btns">
      ${['my complaints','laundry status','upcoming events','my timetable','pending items'].map(q =>
        `<button onclick="document.getElementById('orion-input').value='${q}';runOrion()"
          style="padding:6px 12px;background:rgba(255,255,255,0.1);color:#ccc;border:1px solid rgba(255,255,255,0.2);
          border-radius:20px;cursor:pointer;font-size:12px;">${q}</button>`
      ).join('')}
    </div>
    <div id="orion-results"></div>`;
  container.prepend(panel);
}

async function runOrion() {
  const input = document.getElementById('orion-input');
  const results = document.getElementById('orion-results');
  if (!input || !results) return;
  const query = input.value.toLowerCase().trim();
  if (!query) return;

  results.innerHTML = `<div style="color:#aaa;font-size:13px;padding:8px 0;">⏳ Processing...</div>`;

  try {
    if (query.includes('complaint')) {
      const r = await fetch(`${FEAT_API}/api/complaints`, { headers: _authHeaders() });
      const data = await r.json();
      if (!data.success) throw new Error(data.message);
      const list = data.complaints || [];
      results.innerHTML = `
        <div style="color:#aaa;font-size:11px;margin-bottom:10px;">Found ${list.length} complaint(s)</div>
        ${list.slice(0,5).map(c => `
          <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:12px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;">
              <b style="font-size:13px;">${c.title}</b>
              <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${
                c.status==='resolved'?'#27ae60':c.status==='inprogress'?'#f39c12':'#e74c3c'
              };color:white;">${c.status}</span>
            </div>
            <p style="margin:4px 0 0;font-size:12px;color:#aaa;">${c.category} · ${new Date(c.createdAt).toLocaleDateString()}</p>
            ${c.isEscalated?'<span style="font-size:10px;color:#f39c12;">⚠️ Escalated to L'+c.escalationLevel+'</span>':''}
          </div>`).join('')}`;
    } else if (query.includes('laundry')) {
      const r = await fetch(`${FEAT_API}/api/laundry/my`, { headers: _authHeaders() });
      const data = await r.json();
      if (!data.success) throw new Error(data.message);
      const l = data.laundry;
      const used = l?.usedWashes || 0;
      const total = l?.totalWashes || 30;
      const pct = Math.round(used / total * 100);
      results.innerHTML = `
        <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:14px;">
          <b style="font-size:14px;">👕 Laundry Status</b>
          <div style="margin:12px 0;">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:#aaa;margin-bottom:6px;">
              <span>Washes Used</span><span>${used} / ${total}</span>
            </div>
            <div style="background:rgba(255,255,255,0.1);border-radius:4px;height:8px;">
              <div style="background:${pct>80?'#e74c3c':pct>50?'#f39c12':'#27ae60'};width:${pct}%;height:100%;border-radius:4px;transition:width 0.5s;"></div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <span style="font-size:12px;padding:4px 12px;background:rgba(255,255,255,0.1);border-radius:20px;color:#aaa;">Status: ${l?.currentStatus||'idle'}</span>
            ${pct>80?'<span style="font-size:12px;padding:4px 12px;background:rgba(231,76,60,0.3);border-radius:20px;color:#e74c3c;">⚠️ Quota almost full</span>':''}
          </div>
        </div>`;
    } else if (query.includes('event')) {
      const r = await fetch(`${FEAT_API}/api/events`, { headers: _authHeaders() });
      const data = await r.json();
      if (!data.success) throw new Error(data.message);
      const upcoming = (data.events || []).filter(e => new Date(e.date) >= new Date()).slice(0,4);
      results.innerHTML = `
        <div style="color:#aaa;font-size:11px;margin-bottom:10px;">${upcoming.length} upcoming event(s)</div>
        ${upcoming.map(e => `
          <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:12px;margin-bottom:8px;">
            <b style="font-size:13px;">${e.title}</b>
            <p style="margin:4px 0 0;font-size:12px;color:#aaa;">${new Date(e.date).toLocaleDateString()} · ${e.venue||'TBA'}</p>
            <span style="font-size:11px;padding:2px 8px;background:rgba(102,126,234,0.3);border-radius:10px;color:#667eea;">${e.type}</span>
          </div>`).join('')}`;
    } else if (query.includes('pending') || query.includes('todo') || query.includes('summary')) {
      const [compR, laundR] = await Promise.all([
        fetch(`${FEAT_API}/api/complaints`, { headers: _authHeaders() }),
        fetch(`${FEAT_API}/api/laundry/my`, { headers: _authHeaders() })
      ]);
      const compData = await compR.json();
      const laundData = await laundR.json();
      const openComp = (compData.complaints||[]).filter(c=>c.status!=='resolved').length;
      const laundry = laundData.laundry;
      const quotaLeft = (laundry?.totalWashes||30) - (laundry?.usedWashes||0);
      results.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="background:rgba(231,76,60,0.2);border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#e74c3c;">${openComp}</div>
            <div style="font-size:12px;color:#aaa;">Open Complaints</div>
          </div>
          <div style="background:rgba(52,152,219,0.2);border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#3498db;">${quotaLeft}</div>
            <div style="font-size:12px;color:#aaa;">Laundry Washes Left</div>
          </div>
        </div>`;
    } else {
      results.innerHTML = `<div style="color:#aaa;font-size:13px;padding:8px 0;">
        💡 Try: "my complaints", "laundry status", "upcoming events", "pending items"
      </div>`;
    }
  } catch (e) {
    results.innerHTML = `<div style="color:#e74c3c;font-size:13px;padding:8px 0;">❌ ${e.message}</div>`;
  }
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 5: STATUS TIMELINE
// ═══════════════════════════════════════════════════════════════
function renderComplaintTimeline(complaint, container) {
  const steps = [
    { key: 'open', label: 'Submitted', icon: '📤' },
    { key: 'inprogress', label: 'In Progress', icon: '🔧' },
    { key: 'resolved', label: 'Resolved', icon: '✅' },
  ];
  const statusOrder = { open: 0, inprogress: 1, resolved: 2 };
  const currentIdx = statusOrder[complaint.status] ?? 0;
  const colors = ['#667eea','#f39c12','#27ae60'];

  container.innerHTML = `
    <div style="display:flex;align-items:center;margin:12px 0;gap:0;">
      ${steps.map((step, i) => `
        <div style="display:flex;align-items:center;flex:1;${i===steps.length-1?'flex:0':''}">
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;
              font-size:16px;border:3px solid ${i<=currentIdx?colors[i]:'#e0e0e0'};
              background:${i<=currentIdx?colors[i]+'22':'#f9f9f9'};
              box-shadow:${i===currentIdx?'0 0 0 4px '+colors[i]+'33':''};
              transition:all 0.3s;">
              ${i<currentIdx?'✅':step.icon}
            </div>
            <span style="font-size:10px;color:${i<=currentIdx?colors[i]:'#bbb'};font-weight:${i===currentIdx?700:400};white-space:nowrap;">${step.label}</span>
          </div>
          ${i<steps.length-1?`<div style="flex:1;height:3px;background:linear-gradient(to right,${i<currentIdx?colors[i]:'#e0e0e0'},${i+1<=currentIdx?colors[i+1]:'#e0e0e0'});margin:-20px 4px 0;transition:all 0.3s;"></div>`:''}
        </div>`).join('')}
    </div>
    ${complaint.isEscalated ? `<div style="padding:8px 12px;background:#fff3cd;border-radius:8px;font-size:12px;color:#856404;margin-top:8px;">
      ⚠️ Escalated to Level ${complaint.escalationLevel} — ${new Date(complaint.lastEscalatedAt).toLocaleString()}
    </div>` : ''}`;
}

// Attach timelines to complaint cards
function attachComplaintTimelines() {
  const cards = document.querySelectorAll('[data-complaint-id]');
  cards.forEach(card => {
    if (card.querySelector('.complaint-timeline')) return;
    const status = card.dataset.complaintStatus || 'open';
    const isEscalated = card.dataset.escalated === 'true';
    const level = parseInt(card.dataset.escalationLevel || '0');
    const escalatedAt = card.dataset.escalatedAt;

    const tlContainer = document.createElement('div');
    tlContainer.className = 'complaint-timeline';
    renderComplaintTimeline({ status, isEscalated, escalationLevel: level, lastEscalatedAt: escalatedAt }, tlContainer);
    card.appendChild(tlContainer);
  });
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 7: SMART AUTO-CATEGORY
// ═══════════════════════════════════════════════════════════════
const categoryKeywords = {
  'Electricity': ['light','fan','ac','power','electricity','socket','short','fuse','wire','switch'],
  'Water':       ['water','tap','pipe','leak','supply','bore','tank','plumbing','drain'],
  'Hostel':      ['room','hostel','bed','almirah','lock','door','window','hostel room'],
  'Food':        ['food','meal','mess','canteen','quality','taste','dining','cafeteria'],
  'Internet':    ['wifi','internet','network','connection','lan','broadband','slow','speed'],
  'Cleanliness': ['dirty','clean','garbage','dust','sweep','mop','toilet','bathroom','washroom'],
  'Transport':   ['bus','vehicle','transport','route','driver','timing','pickup'],
  'Academic':    ['marks','exam','attendance','faculty','class','lecture','assignment','subject'],
  'Timetable':   ['timetable','schedule','clash','slot','period'],
  'Security':    ['safety','security','guard','harassment','threat','danger','theft'],
  'Facilities':  ['lab','library','gym','sports','ground','equipment','projector','classroom'],
};

function initAutoCategory() {
  const descInput = document.getElementById('complaint-description') ||
                    document.querySelector('[name="description"]') ||
                    document.querySelector('textarea[placeholder*="describe"]');
  const catSelect = document.getElementById('complaint-category') ||
                    document.querySelector('[name="category"]') ||
                    document.querySelector('select');
  if (!descInput || !catSelect) return;

  let suggDiv = document.getElementById('auto-cat-suggestion');
  if (!suggDiv) {
    suggDiv = document.createElement('div');
    suggDiv.id = 'auto-cat-suggestion';
    suggDiv.style.cssText = 'margin-top:6px;font-size:12px;padding:0;';
    descInput.parentNode.insertBefore(suggDiv, descInput.nextSibling);
  }

  descInput.addEventListener('input', () => {
    const text = descInput.value.toLowerCase();
    let bestCat = null, bestScore = 0;

    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      const score = keywords.filter(kw => text.includes(kw)).length;
      if (score > bestScore) { bestScore = score; bestCat = cat; }
    }

    if (bestCat && bestScore > 0) {
      suggDiv.innerHTML = `
        <div style="display:inline-flex;align-items:center;gap:8px;background:#f0f4ff;border:1px solid #667eea;
          border-radius:8px;padding:6px 12px;cursor:pointer;" onclick="applyAutoCategory('${bestCat}')">
          <span>💡 Suggested category:</span>
          <b style="color:#667eea;">${bestCat}</b>
          <span style="font-size:11px;color:#999;">(click to apply)</span>
        </div>`;
    } else {
      suggDiv.innerHTML = '';
    }
  });
}

function applyAutoCategory(cat) {
  const catSelect = document.getElementById('complaint-category') ||
                    document.querySelector('[name="category"]') ||
                    document.querySelector('select');
  if (catSelect) {
    catSelect.value = cat;
    catSelect.dispatchEvent(new Event('change'));
    _showToast(`Category set to: ${cat}`, 'success');
  }
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 9: DASHBOARD PERSONALIZATION
// ═══════════════════════════════════════════════════════════════
function personalizeWidgets() {
  const user = _getUser();
  if (!user || user.role !== 'student') return;

  const isHosteler = user.hostel && user.hostel.trim() !== '';

  // Hide laundry widget for day scholars
  if (!isHosteler) {
    const laundryWidgets = document.querySelectorAll(
      '[data-widget="laundry"], .laundry-section, #laundry-section, .laundry-widget, .laundry-card'
    );
    laundryWidgets.forEach(w => { w.style.display = 'none'; });
  }

  // Add personalized greeting
  const greetContainer = document.querySelector('.dashboard-greeting') ||
                         document.querySelector('.welcome-text') ||
                         document.querySelector('h2');
  if (greetContainer) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    greetContainer.textContent = `${greeting}, ${user.name?.split(' ')[0] || 'Student'} 👋`;
  }
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 11: PREDICTIVE INSIGHTS
// ═══════════════════════════════════════════════════════════════
async function initPredictiveInsights() {
  const user = _getUser();
  if (!user || user.role !== 'student') return;

  const container = document.querySelector('.dashboard-content') ||
                    document.querySelector('.main-content') ||
                    document.querySelector('#main-content');
  if (!container || document.getElementById('predictive-insights')) return;

  const insightsDiv = document.createElement('div');
  insightsDiv.id = 'predictive-insights';
  insightsDiv.style.cssText = 'margin:12px 0;';

  try {
    const insights = [];

    // Check laundry
    if (user.hostel) {
      try {
        const r = await fetch(`${FEAT_API}/api/laundry/my`, { headers: _authHeaders() });
        const d = await r.json();
        if (d.success && d.laundry) {
          const used = d.laundry.usedWashes || 0;
          const total = d.laundry.totalWashes || 30;
          const pct = used / total;
          if (pct > 0.8) insights.push({ icon:'👕', color:'#e74c3c', msg:`Laundry quota ${Math.round(pct*100)}% used — only ${total-used} washes left!` });
          if (d.laundry.currentStatus === 'ready') insights.push({ icon:'✅', color:'#27ae60', msg:'Your laundry is READY for pickup!' });
        }
      } catch {}
    }

    // Check complaints
    try {
      const r = await fetch(`${FEAT_API}/api/complaints`, { headers: _authHeaders() });
      const d = await r.json();
      if (d.success) {
        const open = (d.complaints||[]).filter(c=>c.status!=='resolved');
        if (open.length > 0) insights.push({ icon:'📝', color:'#f39c12', msg:`${open.length} complaint${open.length>1?'s':''} still pending` });
        const escalated = open.filter(c=>c.isEscalated);
        if (escalated.length > 0) insights.push({ icon:'⚠️', color:'#e67e22', msg:`${escalated.length} complaint(s) escalated to higher authority` });
      }
    } catch {}

    // Check events today
    try {
      const r = await fetch(`${FEAT_API}/api/events`, { headers: _authHeaders() });
      const d = await r.json();
      if (d.success) {
        const today = new Date().toDateString();
        const todayEvents = (d.events||[]).filter(e=>new Date(e.date).toDateString()===today);
        if (todayEvents.length>0) insights.push({ icon:'📅', color:'#667eea', msg:`${todayEvents.length} event(s) happening TODAY!` });
      }
    } catch {}

    if (insights.length === 0) return;

    insightsDiv.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${insights.map(ins => `
          <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;
            background:${ins.color}15;border:1px solid ${ins.color}40;border-radius:10px;
            font-size:12px;color:#333;animation:fadeIn 0.4s ease;">
            <span style="font-size:16px;">${ins.icon}</span>
            <span>${ins.msg}</span>
          </div>`).join('')}
      </div>`;

    // Insert after first card
    const firstCard = container.querySelector('.card, .dashboard-card, .stat-card');
    if (firstCard && firstCard.parentNode) {
      firstCard.parentNode.insertBefore(insightsDiv, firstCard.nextSibling);
    } else {
      container.prepend(insightsDiv);
    }
  } catch {}
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 14: IMAGE UPLOAD IN COMPLAINT
// ═══════════════════════════════════════════════════════════════
function initImageUpload() {
  const form = document.getElementById('complaint-form') ||
               document.querySelector('form[data-form="complaint"]');
  if (!form || document.getElementById('pc-img-upload')) return;

  const uploadHTML = `
    <div id="pc-img-upload" style="margin:12px 0;">
      <label style="font-size:13px;font-weight:600;color:#555;display:block;margin-bottom:6px;">
        📎 Attach Photo (optional)
      </label>
      <div id="img-drop-zone" style="border:2px dashed #ccc;border-radius:10px;padding:20px;text-align:center;cursor:pointer;
        transition:all 0.2s;background:#fafafa;" onclick="document.getElementById('pc-img-file').click()"
        ondragover="event.preventDefault();this.style.borderColor='#667eea'"
        ondragleave="this.style.borderColor='#ccc'"
        ondrop="handleImgDrop(event)">
        <span style="font-size:24px;">📷</span>
        <p style="margin:6px 0 0;font-size:12px;color:#999;">Click or drag & drop image here</p>
      </div>
      <input type="file" id="pc-img-file" accept="image/*" style="display:none" onchange="handleImgSelect(event)" />
      <div id="pc-img-preview" style="display:none;margin-top:10px;position:relative;">
        <img id="pc-img-preview-img" style="max-width:100%;max-height:180px;border-radius:8px;border:1px solid #eee;" />
        <button onclick="clearImage()" style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.6);color:white;
          border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:12px;">✕</button>
      </div>
      <input type="hidden" id="pc-img-b64" name="mediaUrl" />
    </div>`;

  const submitBtn = form.querySelector('button[type="submit"]') || form.querySelector('.submit-btn');
  if (submitBtn) {
    submitBtn.insertAdjacentHTML('beforebegin', uploadHTML);
  } else {
    form.insertAdjacentHTML('beforeend', uploadHTML);
  }
}

function handleImgSelect(e) {
  const file = e.target.files[0];
  if (file) processImageFile(file);
}

function handleImgDrop(e) {
  e.preventDefault();
  document.getElementById('img-drop-zone').style.borderColor = '#ccc';
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) processImageFile(file);
}

function processImageFile(file) {
  if (file.size > 5 * 1024 * 1024) { _showToast('Image must be under 5MB', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    const b64 = e.target.result;
    document.getElementById('pc-img-b64').value = b64;
    document.getElementById('pc-img-preview-img').src = b64;
    document.getElementById('pc-img-preview').style.display = 'block';
    document.getElementById('img-drop-zone').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  document.getElementById('pc-img-b64').value = '';
  document.getElementById('pc-img-preview').style.display = 'none';
  document.getElementById('img-drop-zone').style.display = 'block';
  document.getElementById('pc-img-file').value = '';
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 16: REAL-TIME STATUS UPDATES (polling)
// ═══════════════════════════════════════════════════════════════
let realtimePollInterval = null;
let lastKnownStatuses = {};

function initRealtimeUpdates() {
  if (realtimePollInterval) return;
  realtimePollInterval = setInterval(async () => {
    try {
      const r = await fetch(`${FEAT_API}/api/complaints`, { headers: _authHeaders() });
      const data = await r.json();
      if (!data.success) return;
      (data.complaints||[]).forEach(c => {
        const prev = lastKnownStatuses[c._id];
        if (prev && prev !== c.status) {
          _showToast(`📝 Complaint "${c.title}" is now: ${c.status}`, 'info');
          fetchNotifications(); // refresh notification bell
        }
        lastKnownStatuses[c._id] = c.status;
      });
    } catch {}
  }, 60000); // check every 60s
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 12: COMPLAINT CLUSTERING
// ═══════════════════════════════════════════════════════════════
async function renderComplaintClusters() {
  const user = _getUser();
  if (!user || !ADMIN_ROLES_CLIENT.includes(user.role)) return;

  try {
    const r = await fetch(`${FEAT_API}/api/complaints`, { headers: _authHeaders() });
    const data = await r.json();
    if (!data.success) return;

    const complaints = data.complaints || [];
    const clusters = {};
    complaints.filter(c=>c.status!=='resolved').forEach(c => {
      const key = `${c.category}-${c.routedTo}`;
      if (!clusters[key]) clusters[key] = { category: c.category, count: 0, items: [] };
      clusters[key].count++;
      clusters[key].items.push(c);
    });

    const hotspots = Object.values(clusters).filter(cl => cl.count >= 3);
    if (hotspots.length === 0) return;

    const container = document.querySelector('.admin-content') || document.querySelector('.main-content');
    if (!container || document.getElementById('cluster-alerts')) return;

    const clusterDiv = document.createElement('div');
    clusterDiv.id = 'cluster-alerts';
    clusterDiv.style.cssText = 'margin:16px 0;';
    clusterDiv.innerHTML = `
      <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:12px;padding:16px;">
        <b style="font-size:14px;color:#856404;">🔥 Complaint Hotspots Detected</b>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">
          ${hotspots.map(hs => `
            <div style="background:${hs.count>=10?'#f8d7da':hs.count>=5?'#fff3cd':'#d1ecf1'};
              border-radius:10px;padding:10px 14px;min-width:140px;">
              <b style="font-size:16px;color:${hs.count>=10?'#721c24':hs.count>=5?'#856404':'#0c5460'};">${hs.count}</b>
              <p style="margin:2px 0 0;font-size:12px;">${hs.category} complaints</p>
            </div>`).join('')}
        </div>
      </div>`;
    container.prepend(clusterDiv);
  } catch {}
}

const ADMIN_ROLES_CLIENT = ['academic_admin','hostel_admin','campus_admin'];

// ═══════════════════════════════════════════════════════════════
// FEATURE 18: OFFLINE SUPPORT (Service Worker data cache)
// ═══════════════════════════════════════════════════════════════
function initOfflineCache() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(()=>{});
  }

  // Cache timetable and materials locally
  window.addEventListener('online', async () => {
    _showToast('✅ Back online! Syncing...', 'success');
  });
  window.addEventListener('offline', () => {
    _showToast('📶 You are offline. Some features may not work.', 'error');
    // Show cached data if available
    const cachedTT = localStorage.getItem('pc_cache_timetable');
    if (cachedTT) {
      console.log('Using cached timetable data');
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS (shared utility)
// ═══════════════════════════════════════════════════════════════
function _showToast(msg, type = 'info') {
  // Remove existing
  const existing = document.getElementById('pc-toast');
  if (existing) existing.remove();

  const colors = { success:'#27ae60', error:'#e74c3c', info:'#3498db', warning:'#f39c12' };
  const toast = document.createElement('div');
  toast.id = 'pc-toast';
  toast.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);
    background:${colors[type]||colors.info};color:white;
    padding:12px 24px;border-radius:30px;font-size:14px;font-weight:600;
    z-index:999998;box-shadow:0 4px 20px rgba(0,0,0,0.2);
    animation:toastIn 0.3s forwards;max-width:90vw;text-align:center;`;
  toast.textContent = msg;

  if (!document.getElementById('toast-keyframes')) {
    const s = document.createElement('style');
    s.id = 'toast-keyframes';
    s.textContent = `@keyframes toastIn{to{transform:translateX(-50%) translateY(0);opacity:1}}`;
    document.head.appendChild(s);
  }

  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
}

// ═══════════════════════════════════════════════════════════════
// MAIN INIT — auto-runs on page load
// ═══════════════════════════════════════════════════════════════
function initAllFeatures() {
  const user = _getUser();
  if (!user || !_getToken()) return;

  initNotifications();
  initSOS();
  initOfflineCache();
  personalizeWidgets();

  if (user.role === 'student') {
    initOrionAI();
    initPredictiveInsights();
    initAutoCategory();
    initImageUpload();
    initRealtimeUpdates();
  }

  if (ADMIN_ROLES_CLIENT.includes(user.role)) {
    renderComplaintClusters();
  }

  // Attach timelines when complaint cards exist
  setTimeout(attachComplaintTimelines, 1500);
}

// Run on DOMContentLoaded or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllFeatures);
} else {
  initAllFeatures();
}

// Also expose globally
window.runOrion = runOrion;
window.sendSOS = sendSOS;
window.showSOSModal = showSOSModal;
window.toggleNotifDropdown = toggleNotifDropdown;
window.markNotifRead = markNotifRead;
window.markAllNotifRead = markAllNotifRead;
window.applyAutoCategory = applyAutoCategory;
window.clearImage = clearImage;
window.handleImgSelect = handleImgSelect;
window.handleImgDrop = handleImgDrop;
window.renderComplaintTimeline = renderComplaintTimeline;