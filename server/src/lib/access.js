import { one, many } from '../db.js';
import { config } from '../config.js';
import { forbidden, HttpError } from './util.js';

export async function loadUser(req, _res, next) {
  try {
    const id = req.session?.userId;
    if (id) {
      const u = await one(`SELECT id, email, full_name, role, auth_provider, must_change_password, totp_enabled, active FROM users WHERE id = $1`, [id]);
      if (u && u.active) {
        u.struttura_ids = (await many('SELECT struttura_id FROM user_strutture WHERE user_id=$1', [id])).map((r) => r.struttura_id);
        req.user = u;
      } else {
        req.session.userId = null;
      }
    }
    next();
  } catch (e) { next(e); }
}

const ONBOARDING_PATHS = ['/api/auth/me', '/api/auth/logout', '/api/auth/change-password', '/api/auth/totp/setup', '/api/auth/totp/enable'];

export function onboardingState(req) {
  const u = req.user;
  if (!u) return null;
  const local = req.session.authMethod === 'LOCAL';
  if (local && u.must_change_password) return 'PASSWORD_CHANGE_REQUIRED';
  if (local && config.requireTotpForAdmins && u.role === 'ADMIN' && !u.totp_enabled) return 'TOTP_SETUP_REQUIRED';
  return null;
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Sessione scaduta o non autenticata'));
  const st = onboardingState(req);
  if (st && !ONBOARDING_PATHS.includes(req.originalUrl.split('?')[0])) {
    const e = new HttpError(403, st === 'PASSWORD_CHANGE_REQUIRED' ? 'Cambio password obbligatorio' : 'Attivazione verifica in due passaggi obbligatoria');
    e.code = st;
    return next(e);
  }
  next();
}

export const requireRole = (...roles) => (req, _res, next) => (roles.includes(req.user?.role) ? next() : next(forbidden()));
export const isAdmin = (u) => u?.role === 'ADMIN';
export const canEdit = (u) => u?.role === 'ADMIN' || u?.role === 'PLANNER';
// Perimetro: ADMIN tutte; PLANNER/VIEWER tutte se nessuna assegnazione, altrimenti solo le sedi assegnate
export const canSeeStruttura = (u, id) => isAdmin(u) || !(u.struttura_ids || []).length || u.struttura_ids.includes(id);
export const canEditStruttura = (u, id) => canEdit(u) && canSeeStruttura(u, id);
