// RWAXI website Worker: serves the static site (env.ASSETS) and handles the demo form.
//
// POST /api/contact  -> validates the request and emails it to RWAXI through Resend.
// Everything else    -> static files from the repository (index.html, en/, assets/, ...).
//
// Secrets and settings (Cloudflare dashboard or wrangler.jsonc, never in this file):
//   RESEND_API_KEY  secret: npx wrangler secret put RESEND_API_KEY
//   CONTACT_FROM    var in wrangler.jsonc: RWAXI <contacto@notify.rwaxi.com>
//   CONTACT_TO      var in wrangler.jsonc: tokenizacion@rwaxi.com

const RESEND_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'RWAXI <contacto@notify.rwaxi.com>';
const DEFAULT_TO = 'tokenizacion@rwaxi.com';
const MAX_BODY_BYTES = 16 * 1024;
const RESEND_TIMEOUT_MS = 10000;

// Same limits as the form (maxlength in index.html). "required" mirrors the fields marked * there.
const FIELDS = {
  name: { label: 'Nombre completo', max: 100, required: true },
  company: { label: 'Empresa o proyecto', max: 120, required: true },
  role: { label: 'Cargo / Rol', max: 100, required: true },
  country: { label: 'País', max: 60, required: true },
  whatsapp: { label: 'WhatsApp', max: 25, required: true },
  email: { label: 'Correo electrónico', max: 120, required: true },
  focus: { label: 'Enfoque de la demo', max: 200, required: true },
  projectType: { label: 'Tipo de proyecto', max: 100, required: false },
  stage: { label: 'Etapa actual', max: 100, required: false },
  message: { label: 'Mensaje o preferencia de horario', max: 1200, required: false }
};

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

const json = (status, data, extraHeaders = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders }
});

const escapeHtml = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const oneLine = (value) => value.replace(/[\r\n\t]+/g, ' ').trim();

// Returns { data } with clean values, or { error } naming the first invalid field.
const validate = (input) => {
  const data = {};
  for (const [key, rule] of Object.entries(FIELDS)) {
    const raw = input[key];
    if (raw !== undefined && raw !== null && typeof raw !== 'string') return { error: `invalid:${key}` };
    const value = key === 'message' ? String(raw || '').replace(/\r\n?/g, '\n').trim() : oneLine(String(raw || ''));
    if (rule.required && !value) return { error: `missing:${key}` };
    if (value.length > rule.max) return { error: `too_long:${key}` };
    if (value) data[key] = value;
  }
  if (!EMAIL_RE.test(data.email)) return { error: 'invalid:email' };
  const digits = data.whatsapp.replace(/\D/g, '');
  if (!data.whatsapp.startsWith('+') || digits.length < 8 || digits.length > 15) return { error: 'invalid:whatsapp' };
  if (input.consent !== true) return { error: 'missing:consent' };
  data.lang = input.lang === 'en' ? 'en' : 'es';
  return { data };
};

const buildEmail = (data, request) => {
  const subjectPrefix = data.lang === 'en' ? 'RWAXI Demo Request' : 'Solicitud de Demo RWAXI';
  const subject = `${subjectPrefix} — ${data.company} — WhatsApp: ${data.whatsapp}`;
  const rows = Object.entries(FIELDS)
    .filter(([key]) => data[key] && key !== 'message')
    .map(([key, rule]) => [rule.label, data[key]]);
  rows.push(['Autorización de contacto por WhatsApp y correo', 'Sí']);
  rows.push(['Idioma de la página', data.lang === 'en' ? 'Inglés (en/index.html): responder en inglés' : 'Español (index.html)']);
  const country = request.cf && request.cf.country ? request.cf.country : '';
  if (country) rows.push(['País detectado por Cloudflare', country]);

  const text = [
    `${subjectPrefix}`,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    ...(data.message ? ['', `${FIELDS.message.label}:`, data.message] : []),
    '',
    '--',
    'Enviado desde el formulario de rwaxi.com. Responde a este correo para escribirle directamente a la persona.'
  ].join('\n');

  const cell = 'padding:8px 12px;border-bottom:1px solid #e6e1ee;vertical-align:top;font-size:14px;';
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f3ef;font-family:Arial,Helvetica,sans-serif;color:#21183f;">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;margin:0 auto;background:#ffffff;border-top:3px solid #B77A1E;">
<tr><td style="padding:24px 24px 8px;"><p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#B77A1E;">rwaxi.com · Formulario</p><h1 style="margin:0;font-size:22px;color:#21183f;">${escapeHtml(subjectPrefix)}</h1></td></tr>
<tr><td style="padding:8px 12px 16px;"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
${rows.map(([label, value]) => `<tr><td style="${cell}width:38%;color:#76717e;">${escapeHtml(label)}</td><td style="${cell}font-weight:bold;">${escapeHtml(value)}</td></tr>`).join('\n')}
</table></td></tr>
${data.message ? `<tr><td style="padding:0 24px 16px;"><p style="margin:0 0 6px;font-size:13px;color:#76717e;">${escapeHtml(FIELDS.message.label)}</p><p style="margin:0;padding:12px 14px;background:#f5f3ef;font-size:14px;line-height:1.55;white-space:pre-wrap;">${escapeHtml(data.message)}</p></td></tr>` : ''}
<tr><td style="padding:12px 24px 24px;font-size:12px;color:#76717e;">Responde a este correo para escribirle directamente a la persona.</td></tr>
</table></body></html>`;

  return { subject, text, html };
};

const handleContact = async (request, env) => {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' }, { Allow: 'POST' });

  // Only the site itself may post here (browsers always send Origin on a fetch POST).
  const origin = request.headers.get('Origin');
  if (origin) {
    let sameHost = false;
    try {
      sameHost = new URL(origin).host === new URL(request.url).host;
    } catch {
      sameHost = false;
    }
    if (!sameHost) return json(403, { ok: false, error: 'forbidden_origin' });
  }

  if (!(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
    return json(415, { ok: false, error: 'unsupported_media_type' });
  }
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_BODY_BYTES) return json(413, { ok: false, error: 'payload_too_large' });

  let input;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json(413, { ok: false, error: 'payload_too_large' });
    input = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, error: 'invalid_json' });
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return json(400, { ok: false, error: 'invalid_json' });

  // Honeypot: people never see the "website" field; bots fill it. Answer as if it worked.
  if (typeof input.website === 'string' && input.website.trim() !== '') return json(200, { ok: true });

  const { data, error } = validate(input);
  if (error) return json(422, { ok: false, error });

  if (!env.RESEND_API_KEY) {
    console.error('RWAXI contact: RESEND_API_KEY is not configured');
    return json(500, { ok: false, error: 'not_configured' });
  }

  const { subject, text, html } = buildEmail(data, request);
  let resend;
  try {
    resend = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.CONTACT_FROM || DEFAULT_FROM,
        to: [env.CONTACT_TO || DEFAULT_TO],
        reply_to: data.email,
        subject,
        text,
        html
      }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS)
    });
  } catch (err) {
    console.error('RWAXI contact: Resend request failed', err && err.message);
    return json(502, { ok: false, error: 'send_failed' });
  }

  if (!resend.ok) {
    const detail = await resend.text().catch(() => '');
    console.error('RWAXI contact: Resend answered', resend.status, detail.slice(0, 500));
    return json(502, { ok: false, error: 'send_failed' });
  }
  return json(200, { ok: true });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/contact') return handleContact(request, env);
    return env.ASSETS.fetch(request);
  }
};
