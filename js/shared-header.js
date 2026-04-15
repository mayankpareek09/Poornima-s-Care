// Shared header renderer for all inner pages
// Call: renderSharedHeader(activeLink, prefix)
// prefix = '../' for pages/, '' for root

window.PC_SHARED_HEADER = {
  render: function(activeLink, prefix) {
    prefix = prefix || '../';
    const navLinks = [
      { id:'home',       href:'index.html',          label:'Home',        svg:'<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
      { id:'complaints', href:'pages/complaints.html',label:'Complaints',  svg:'<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>' },
      { id:'laundry',    href:'pages/laundry.html',   label:'Laundry',     svg:'<rect x="2" y="3" width="20" height="18" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 7h.01M11 7h.01M14 7h.01"/>' },
      { id:'timetable',  href:'pages/timetable.html', label:'Timetable',   svg:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
      { id:'materials',  href:'pages/materials.html', label:'Materials',   svg:'<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>' },
      { id:'events',     href:'pages/events.html',    label:'Events',      svg:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="12" cy="16" r="2"/>' },
      { id:'clubs',      href:'clubs.html',            label:'Clubs',       svg:'<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>' },
      { id:'hostel',     href:'pages/hostel.html',     label:'Hostel',      svg:'<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>' },
      { id:'bus',        href:'pages/bus.html',        label:'Bus',         svg:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M7 15h.01M17 15h.01"/><path d="M5 19v2M19 19v2"/>' },
      { id:'profile',    href:'pages/profile.html',    label:'Profile',     svg:'<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
      { id:'chatbot',    href:'pages/chatbot.html',    label:'ORION AI',    svg:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>', ai:true },
    ];

    // Build nav HTML
    const navHtml = navLinks.map(l => {
      const isActive = l.id === activeLink;
      const isAi = l.ai;
      const href = prefix === '' ? l.href : (l.id === 'clubs' ? prefix + l.href : prefix + l.href);
      // For root pages, clubs.html is at same level; for pages/ it's ../clubs.html
      const finalHref = l.id === 'clubs' 
        ? (prefix === '' ? 'clubs.html' : '../clubs.html')
        : (prefix === '' ? l.href : '../' + l.href);
      return `<a href="${finalHref}" class="main-nav-link${isActive?' active':''}${isAi?' nav-ai':''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${l.svg}</svg>
        ${l.label}
      </a>`;
    }).join('');

    document.querySelectorAll('.pc-nav-placeholder').forEach(el => {
      el.outerHTML = `<div class="hero-nav-strip">
        <div style="max-width:1280px;margin:0 auto;padding:0 28px;display:flex;align-items:center;overflow-x:auto;scrollbar-width:none;">
          ${navHtml}
        </div>
      </div>`;
    });
  }
};
