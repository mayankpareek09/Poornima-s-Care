// Loaded synchronously in <head>, before the sidebar markup paints, so there is
// no flash of a duplicate sidebar when this page is opened inside the
// persistent-shell iframe from student.html (or any future shell page).
//
// Standalone visits (direct URL, bookmark, refresh) are completely unaffected —
// PC_EMBEDDED is only true when the page is opened with ?embedded=1, which only
// the shell does.
(function () {
  var params = new URLSearchParams(window.location.search);
  window.PC_EMBEDDED = params.get('embedded') === '1';
  if (window.PC_EMBEDDED) {
    document.documentElement.classList.add('pc-embedded');
  }

  // "Back to Portal" links call this instead of navigating directly, so that
  // when embedded, the request goes to the parent shell (which just switches
  // its dashboard tab back — no navigation, no reload, sidebar never disappears).
  window.pcGoToPortalHome = function () {
    if (window.PC_EMBEDDED && window.parent && window.parent !== window) {
      window.parent.postMessage({ pcPortalNav: 'dashboard' }, window.location.origin);
    } else {
      window.location.href = 'student.html';
    }
  };

  // Sibling-portal links (e.g. PU Canteen -> PU Mess) call this so the
  // embedded flag carries over to the next page in the same iframe.
  window.pcNavigate = function (url) {
    if (window.PC_EMBEDDED) {
      var sep = url.indexOf('?') === -1 ? '?' : '&';
      window.location.href = url + sep + 'embedded=1';
    } else {
      window.location.href = url;
    }
  };
})();
