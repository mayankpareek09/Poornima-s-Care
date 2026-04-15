// Poornima's Care — shared UI init (cursor, scroll reveal, page transitions)
(function() {
  // Custom cursor
  var cur = document.createElement('div'); cur.className = 'cursor';
  var ring = document.createElement('div'); ring.className = 'cursor-ring';
  document.body.appendChild(cur); document.body.appendChild(ring);
  document.addEventListener('mousemove', function(e) {
    cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px';
    ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
  });
  document.querySelectorAll('a,button,input,select,textarea,[role="button"]').forEach(function(el) {
    el.addEventListener('mouseenter', function() { document.body.classList.add('cursor-hover'); });
    el.addEventListener('mouseleave', function() { document.body.classList.remove('cursor-hover'); });
  });

  // Scroll reveal
  function checkReveal() {
    document.querySelectorAll('.reveal').forEach(function(el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight - 60) el.classList.add('visible');
    });
  }
  window.addEventListener('scroll', checkReveal, { passive: true });
  checkReveal();
})();
