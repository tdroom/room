// Configurazione da variabili d'ambiente
const env = process.env;

export const config = {
  port: Number(env.PORT || 3000),
  baseUrl: env.BASE_URL || 'http://localhost:3000',
  databaseUrl: env.DATABASE_URL || 'postgres://postgres@localhost:5432/roomplanning',
  sessionSecret: env.SESSION_SECRET || 'dev-only-change-me',
  secureCookies: env.NODE_ENV === 'production',
  sessionHours: Number(env.SESSION_HOURS || 10),
  requireTotpForAdmins: (env.REQUIRE_TOTP_FOR_ADMINS || 'true') === 'true',
  entra: {
    tenantId: env.ENTRA_TENANT_ID || '',
    clientId: env.ENTRA_CLIENT_ID || '',
    clientSecret: env.ENTRA_CLIENT_SECRET || '',
    // Ruolo assegnato a chi entra per la prima volta con un account Microsoft 365 del tenant (auto-registrazione).
    // VIEWER = consultazione; PLANNER = pianificatore; '' = nessuna auto-registrazione (solo utenti censiti).
    autoProvisionRole: env.ENTRA_AUTO_ROLE === undefined ? 'VIEWER' : env.ENTRA_AUTO_ROLE,
    // Domini email ammessi all'auto-registrazione (separati da virgola). Vuoto = qualunque account del tenant.
    allowedDomains: (env.ENTRA_ALLOWED_DOMAINS || 'toscanadiagnostica.it').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    get enabled() { return Boolean(this.tenantId && this.clientId && this.clientSecret); },
  },
  seed: {
    superadminEmail: env.SEED_SUPERADMIN_EMAIL || '',
    superadminName: env.SEED_SUPERADMIN_NAME || 'Super Amministratore',
    superadminPassword: env.SEED_SUPERADMIN_PASSWORD || '',
    // Carica i dati iniziali (le sedi migrate dalla versione artifact) se il database è vuoto
    loadInitialData: (env.SEED_INITIAL_DATA || 'true') === 'true',
  },
  appName: 'Toscana Diagnostica · Room Planning',
};

if (env.NODE_ENV === 'production' && config.sessionSecret === 'dev-only-change-me') {
  throw new Error('SESSION_SECRET obbligatorio in produzione');
}
