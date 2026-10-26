const header = document.querySelector('[data-header]');
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#site-nav');
const navLinks = document.querySelectorAll('#site-nav a');

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

// PROJECT FORM - no backend: it prepares an email in the visitor's own mail program.
// Nothing is transmitted by the website, so no "received" confirmation is ever shown.
const form = document.querySelector('#project-form');

if (form) {
  const fallback = form.querySelector('#form-fallback');
  const preview = form.querySelector('#f-preview');
  const feedback = form.querySelector('.copy-feedback');

  const whatsapp = form.querySelector('#f-whatsapp');

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

  const labelText = (field) => field.labels[0].textContent.replace(/\(.*?\)|\*/g, '').trim();

  const buildMessage = () => {
    const lines = [];
    let message = '';
    let messageLabel = '';
    form.querySelectorAll('input, select, textarea').forEach((field) => {
      if (field === preview || field === whatsapp) return;
      if (field.type === 'checkbox') {
        if (field.checked) lines.push(`${field.name}: ${field.value}`);
        return;
      }
      const value = field.value.trim();
      if (!value) return;
      if (field.tagName === 'TEXTAREA') {
        message = value;
        messageLabel = labelText(field);
        return;
      }
      lines.push(`${labelText(field)}: ${value}`);
    });
    const note = message ? `\n\n${messageLabel}:\n${message}` : '';
    return `${form.dataset.whatsappLabel}: ${whatsapp.value.trim()}\n\n${lines.join('\n')}${note}\n\n-- \n${form.dataset.signature}`;
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    checkWhatsapp();
    if (!form.reportValidity()) return;
    const company = form.querySelector('#f-company').value.trim();
    const subject = `${form.dataset.subject} — ${company} — WhatsApp: ${whatsapp.value.trim()}`;
    const body = buildMessage();
    preview.value = `${subject}\n\n${body}`;
    fallback.hidden = false;
    feedback.textContent = '';
    window.location.href = `mailto:${form.dataset.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, '\r\n'))}`;
  });

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      return copied;
    }
  };

  form.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const text = button.dataset.copy === 'address' ? form.dataset.to : preview.value;
      const copied = await copyText(text);
      feedback.textContent = copied ? form.dataset.msgCopied : form.dataset.msgCopyFailed;
      if (!copied && button.dataset.copy === 'message') preview.select();
    });
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
