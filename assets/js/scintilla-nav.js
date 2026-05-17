(function () {
  var header = document.querySelector('.sw-header');
  if (!header) return;

  var btn = header.querySelector('.sw-menu-btn');
  var nav = header.querySelector('.sw-nav');

  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      nav.classList.toggle('is-open', !open);
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        btn.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      });
    });
  }

  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
