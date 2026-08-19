const header = document.querySelector('[data-header]');
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#site-nav');
const navLinks = document.querySelectorAll('#site-nav a');

// SOCIAL LINKS - REPLACE WITH PRODUCTION URLS
const SOCIAL_LINKS = {
  linkedin: 'https://www.linkedin.com/company/rwaxi/',
  instagram: 'https://www.instagram.com/tokenizacionrwaxi/',
  youtube: 'https://www.youtube.com/@RWAXI',
  substack: 'https://substack.com/@rwaxi?r=8ckvp8&utm_campaign=profile&utm_medium=profile-page'
};

const updateHeader = () => {
  header.classList.toggle('scrolled', window.scrollY > 24);
};

window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

menuToggle.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!isOpen));
  nav.classList.toggle('is-open', !isOpen);
  document.body.classList.toggle('menu-open', !isOpen);
});

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    menuToggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
    document.body.classList.remove('menu-open');
  });
});

document.querySelectorAll('.social-placeholders a, .social-links a').forEach((link) => {
  const label = `${link.textContent} ${link.getAttribute('aria-label') || ''}`.toLowerCase();
  const network = Object.keys(SOCIAL_LINKS).find((key) => label.includes(key));
  const url = network ? SOCIAL_LINKS[network] : '';
  if (url) {
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  } else {
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
  }
});

const revealItems = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    observer.unobserve(entry.target);
  });
}, { threshold: 0.12 });

revealItems.forEach((item) => revealObserver.observe(item));
