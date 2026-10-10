// Client API: sessione via cookie httpOnly, header anti-CSRF su ogni richiesta
export class ApiError extends Error {
  constructor(status, message, code, details) { super(message); this.status = status; this.code = code; this.details = details; }
}
let pending = 0;
const setBusy = (delta) => {
  pending = Math.max(0, pending + delta);
  document.documentElement.classList.toggle('is-busy', pending > 0);
  window.dispatchEvent(new CustomEvent('td:busy', { detail: pending }));
};
async function request(method, url, body, opts = {}) {
  if (!opts.silent) setBusy(1);
  try { return await doRequest(method, url, body); } finally { if (!opts.silent) setBusy(-1); }
}
async function doRequest(method, url, body) {
  const res = await fetch(`/api${url}`, {
    method, credentials: 'same-origin',
    headers: { 'X-Requested-With': 'td-room', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const err = new ApiError(res.status, data?.error || `Errore ${res.status}`, data?.code, data?.details);
    if (res.status === 401 && !url.startsWith('/auth/')) window.dispatchEvent(new Event('td:unauthorized'));
    if (err.code === 'PASSWORD_CHANGE_REQUIRED' || err.code === 'TOTP_SETUP_REQUIRED') window.dispatchEvent(new Event('td:onboarding'));
    throw err;
  }
  return data;
}
export const api = {
  get: (u, o) => request('GET', u, undefined, o),
  post: (u, b, o) => request('POST', u, b || {}, o),
  put: (u, b, o) => request('PUT', u, b, o),
  del: (u, b) => request('DELETE', u, b),
};
export const qs = (o) => {
  const p = Object.entries(o).filter(([, v]) => v !== '' && v != null);
  return p.length ? `?${new URLSearchParams(p).toString()}` : '';
};
