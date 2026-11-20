const header = document.querySelector('[data-header]');
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#site-nav');
const navLinks = document.querySelectorAll('#site-nav a');

// CONTACT FORM ENDPOINT - the site's own Worker (src/worker.js) emails each request through Resend.
const CONTACT_ENDPOINT = '/api/contact';
const FORM_TIMEOUT_MS = 15000;

// SOCIAL LINKS - REPLACE WITH PRODUCTION URLS
const SOCIAL_LINKS = {
  linkedin: 'https://www.linkedin.com/company/rwaxi/',
  instagram: 'https://www.instagram.com/tokenizacionrwaxi/',
  youtube: 'https://www.youtube.com/@RWAXI',
  substack: 'https://substack.com/@rwaxi'
};

const updateHeader = () => {
  header.classList.toggle('scrolled', window.scrollY > 24);
};

window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

const setMenu = (isOpen) => {
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  nav.classList.toggle('is-open', isOpen);
  document.body.classList.toggle('menu-open', isOpen);
};

menuToggle.addEventListener('click', () => {
  setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
});

navLinks.forEach((link) => {
  link.addEventListener('click', () => setMenu(false));
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || menuToggle.getAttribute('aria-expanded') !== 'true') return;
  setMenu(false);
  menuToggle.focus();
});

document.querySelectorAll('.social-links a').forEach((link) => {
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

// PROJECT FORM - sent in the background (fetch) to CONTACT_ENDPOINT; the visitor stays on the page.
const form = document.querySelector('#project-form');

if (form) {
  const formBody = form.querySelector('#form-body');
  const success = form.querySelector('#form-success');
  const errorAlert = form.querySelector('#form-error');
  const submit = form.querySelector('.form-submit');
  const submitLabel = submit.querySelector('[data-submit-label]');
  const submitText = submitLabel.textContent;
  const whatsapp = form.querySelector('#f-whatsapp');

  // The error message offers the same WhatsApp chat as the floating button (one number to maintain).
  const waFloatLink = document.querySelector('[data-wa-float]');
  form.querySelectorAll('[data-wa-link]').forEach((link) => {
    if (waFloatLink) link.href = waFloatLink.href;
  });

  // "Request a demo" links inside each business line preselect the matching demo focus.
  document.querySelectorAll('a[data-interest]').forEach((link) => {
    link.addEventListener('click', () => {
      const option = form.querySelector(`option[data-interest="${link.dataset.interest}"]`);
      if (option) option.selected = true;
    });
  });

  // WhatsApp is required: an international number starting with "+" and 8 to 15 digits (E.164).
  const checkWhatsapp = () => {
    const value = whatsapp.value.trim();
    const digits = value.replace(/\D/g, '');
    const valid = value === '' || (value.startsWith('+') && digits.length >= 8 && digits.length <= 15);
    whatsapp.setCustomValidity(valid ? '' : form.dataset.msgWhatsapp);
  };
  whatsapp.addEventListener('input', checkWhatsapp);

  // The same keys src/worker.js validates. "website" is the hidden honeypot against spam bots.
  const value = (selector) => form.querySelector(selector).value.trim();
  const buildPayload = () => ({
    name: value('#f-name'),
    company: value('#f-company'),
    role: value('#f-role'),
    country: value('#f-country'),
    whatsapp: value('#f-whatsapp'),
    email: value('#f-email'),
    focus: value('#f-focus'),
    projectType: value('#f-asset'),
    stage: value('#f-stage'),
    message: value('#f-message'),
    consent: form.querySelector('#f-consent').checked,
    lang: document.documentElement.lang === 'en' ? 'en' : 'es',
    website: value('#f-website')
  });

  const setSending = (sending) => {
    submit.disabled = sending;
    submit.classList.toggle('is-sending', sending);
    form.setAttribute('aria-busy', String(sending));
    submitLabel.textContent = sending ? form.dataset.msgSending : submitText;
  };

  const send = async (formData) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FORM_TIMEOUT_MS);
    try {
      const response = await fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(formData),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) {
        throw new Error(`Contact endpoint answered ${response.status} ${result.error || ''}`.trim());
      }
    } finally {
      clearTimeout(timer);
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    checkWhatsapp();
    if (!form.reportValidity()) return;
    errorAlert.hidden = true;
    setSending(true);
    try {
      await send(buildPayload());
      form.reset();
      formBody.hidden = true;
      success.hidden = false;
      success.focus();
    } catch (error) {
      console.error('RWAXI form:', error);
      setSending(false);
      errorAlert.hidden = false;
    }
  });
}

const revealItems = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    observer.unobserve(entry.target);
  });
}, { threshold: 0.12 });

revealItems.forEach((item) => revealObserver.observe(item));

// FLOATING WHATSAPP BUTTON - the number lives in the href of .wa-float in index.html and en/index.html.
// It steps aside only while the form's buttons pass underneath it, so it never covers them.
const waFloat = document.querySelector('[data-wa-float]');
const waGuarded = document.querySelectorAll('.form-submit, .form-alert');

if (waFloat && waGuarded.length && 'IntersectionObserver' in window) {
  const covered = new Set();
  const overlapsFloat = (rect) => {
    const float = waFloat.getBoundingClientRect();
    return rect.right > float.left - 12 && rect.left < float.right + 12;
  };
  // The observer root is the bottom 22 % of the screen, where the floating button sits.
  const waObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && overlapsFloat(entry.boundingClientRect)) covered.add(entry.target);
      else covered.delete(entry.target);
    });
    waFloat.classList.toggle('is-tucked', covered.size > 0);
  }, { rootMargin: '-78% 0px 0px 0px' });
  waGuarded.forEach((item) => waObserver.observe(item));
}
