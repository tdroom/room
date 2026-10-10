// Test end-to-end delle API: server avviato (npm start) su un database con i dati iniziali e l'amministratore di seed.
// Variabili: BASE (default http://localhost:3000), ADMIN_EMAIL, ADMIN_PASSWORD (password attuale dell'amministratore)
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://localhost:3000';
const H = { 'Content-Type': 'application/json', 'X-Requested-With': 'td-room' };
let cookie = '';
async function call(method, path, body) {
  const r = await fetch(BASE + '/api' + path, { method, headers: { ...H, cookie }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, data: ct.includes('json') ? await r.json() : await r.text() };
}

test('health', async () => { const r = await call('GET', '/health'); assert.equal(r.status, 200); assert.equal(r.data.ok, true); });
test('CSRF: POST senza header rifiutato', async () => {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 403);
});
test('login amministratore', async () => {
  const r = await call('POST', '/auth/login', { email: process.env.ADMIN_EMAIL || 'francesco.epifani@toscanadiagnostica.it', password: process.env.ADMIN_PASSWORD || 'NuovaPassword-2026-Ok' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
});
test('elenco sedi in ordine alfabetico', async () => {
  const r = await call('GET', '/strutture'); assert.equal(r.status, 200);
  const names = r.data.map((s) => `${s.denominazione}\u0001${s.nomeSede || ''}\u0001${s.indirizzo}`.toLowerCase());
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'it')));
});
test('salvataggio con controllo di versione', async () => {
  const list = (await call('GET', '/strutture')).data; const id = list[0].id;
  const g = await call('GET', `/strutture/${id}`); assert.equal(g.status, 200);
  const lite = { ...g.data.struttura }; delete lite.logo; lite.plan = { markers: g.data.struttura.plan.markers };
  const ok = await call('PUT', `/strutture/${id}`, { data: lite, version: g.data.version }); assert.equal(ok.status, 200); assert.equal(ok.data.version, g.data.version + 1);
  const stale = await call('PUT', `/strutture/${id}`, { data: lite, version: g.data.version }); assert.equal(stale.status, 409); assert.equal(stale.data.code, 'VERSION_CONFLICT');
  const h = await call('GET', `/strutture/${id}/history`); assert.ok(h.data.length >= 2);
});
test('cestino e ripristino', async () => {
  const id = 'test' + Date.now().toString(36);
  const c = await call('POST', '/strutture', { data: { id, denominazione: 'Zz prova', indirizzo: '', hours: {}, ambulatori: [], personale: [], plan: { markers: {} } }, blobs: {} }); assert.equal(c.status, 201);
  assert.equal((await call('DELETE', `/strutture/${id}`)).status, 200);
  assert.ok(!(await call('GET', '/strutture')).data.some((s) => s.id === id));
  assert.ok((await call('GET', '/strutture?deleted=1')).data.some((s) => s.id === id));
  assert.equal((await call('POST', `/strutture/${id}/restore`)).status, 200);
  assert.equal((await call('DELETE', `/strutture/${id}`)).status, 200);
  assert.equal((await call('DELETE', `/strutture/${id}?confirm=DEFINITIVO`)).status, 200);
});
test('backup completo', async () => {
  const r = await call('GET', '/backup'); assert.equal(r.status, 200); assert.ok(Array.isArray(r.data.data.strutture)); assert.ok(r.data.data.strutture.length >= 7);
});
