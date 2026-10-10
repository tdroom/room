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
test('calendario: eventi CRUD', async () => {
  const c = await call('POST', '/calendario/eventi', { kind: 'ASSENZA', persona_key: 'azas leonidas', persona_nome: 'Leonidas Azas', dal: '2026-11-02', al: '2026-11-06', sost_nome: 'Somigli Lorenzo', nota: 'test' });
  assert.equal(c.status, 201, JSON.stringify(c.data));
  const l = await call('GET', '/calendario/eventi?dal=2026-11-01&al=2026-11-30'); assert.ok(l.data.some((e) => e.id === c.data.id));
  const bad = await call('POST', '/calendario/eventi', { kind: 'CHIUSURA', dal: '2026-11-02', al: '2026-11-01' }); assert.equal(bad.status, 400);
  assert.equal((await call('PUT', `/calendario/eventi/${c.data.id}`, { kind: 'ASSENZA', persona_key: 'azas leonidas', persona_nome: 'Leonidas Azas', dal: '2026-11-02', al: '2026-11-07' })).status, 200);
  assert.equal((await call('DELETE', `/calendario/eventi/${c.data.id}`)).status, 200);
});
test('comunicazioni: registro invii anche senza email configurata', async () => {
  const r = await call('POST', '/comms/invia', { kind: 'LIBERA', to: ['test@esempio.it'], subject: 'Prova', body: 'Testo di prova' });
  assert.equal(r.status, 200); assert.ok(['INVIATA', 'NON_CONFIGURATA', 'FALLITA'].includes(r.data.status));
  const log = await call('GET', '/comms/log'); assert.ok(log.data.some((x) => x.subject === 'Prova'));
});
test('comunicazioni: piano disponibilità con allegato', async () => {
  const r = await call('POST', '/comms/invia', { kind: 'PIANO_DISPONIBILITA', to: ['test@esempio.it'], subject: 'Piano', body: 'Testo', attachment: { filename: 'Piano.pdf', base64: Buffer.from('%PDF-1.4 test').toString('base64') } });
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.ok(['INVIATA', 'NON_CONFIGURATA', 'FALLITA'].includes(r.data.status));
  const log = await call('GET', '/comms/log'); assert.ok(log.data.some((x) => x.kind === 'PIANO_DISPONIBILITA' && x.attachment_name === 'Piano.pdf'));
});
test('criticità e soglia', async () => {
  const r = await call('GET', '/criticita'); assert.equal(r.status, 200); assert.ok(r.data.sedi.length >= 7); assert.ok(r.data.soglia > 0);
  assert.equal((await call('PUT', '/settings', { crit_soglia: '8' })).status, 200);
  assert.equal((await call('GET', '/criticita')).data.soglia, 8);
});

// ---------- v2.0 · Personale sanitario ----------
let profId, profCookie = '';
async function callAs(ck, method, path, body) {
  const r = await fetch(BASE + '/api' + path, { method, headers: { ...H, cookie: ck }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
  const sc = r.headers.get('set-cookie'); const ct = r.headers.get('content-type') || '';
  return { status: r.status, cookie: sc ? sc.split(';')[0] : ck, data: ct.includes('json') ? await r.json() : await r.text() };
}
test('personale: import dalle sedi, anagrafica completa e compenso', async () => {
  const imp = await call('POST', '/personale/professionisti/importa-da-sedi'); assert.equal(imp.status, 200);
  const list = (await call('GET', '/personale/professionisti')).data; assert.ok(list.length >= 60);
  const nome = 'Test Infermiera ' + Date.now().toString(36);
  const c = await call('POST', '/personale/professionisti', { nome, tipo: 'sanitario', profilo: 'Infermiere', email: `inf.${Date.now().toString(36)}@esempio.it`, dati: { anagrafica: { codiceFiscale: 'TSTNFR80A41H501Z' }, compenso: { tipo: 'ORARIO', tariffaOraria: 25, cassaPrevidenziale: 4, regime: 'FORFETTARIO' } } });
  assert.equal(c.status, 201, JSON.stringify(c.data)); profId = c.data.id;
  const g = await call('GET', `/personale/professionisti/${profId}`); assert.equal(g.data.dati.compenso.tariffaOraria, 25);
  const doc = await call('POST', `/personale/professionisti/${profId}/docs`, { tipo: 'CV', nome: 'cv.pdf', mime: 'application/pdf', base64: Buffer.from('%PDF-1.4 t').toString('base64') }); assert.equal(doc.status, 201);
});
test('personale: invito, accesso del professionista e perimetro del portale', async () => {
  const inv = await call('POST', `/personale/professionisti/${profId}/invita`, {}); assert.equal(inv.status, 200); assert.ok(inv.data.link.includes('/invito/'));
  const token = inv.data.link.split('/invito/')[1];
  assert.equal((await callAs('', 'GET', `/auth/invito/${token}`)).status, 200);
  const acc = await callAs('', 'POST', `/auth/invito/${token}`, { password: 'PasswordProf-2026x' }); assert.equal(acc.status, 200, JSON.stringify(acc.data)); profCookie = acc.cookie;
  assert.equal((await callAs(profCookie, 'GET', '/portale/me')).status, 200);
  assert.equal((await callAs(profCookie, 'GET', '/strutture')).status, 403);
  assert.equal((await callAs(profCookie, 'POST', '/portale/disponibilita', { kind: 'SETTIMANALE', giorno: 1, ora_da: '08:00', ora_a: '14:00', sedi: [] })).status, 201);
  assert.equal((await callAs(profCookie, 'POST', '/portale/disponibilita', { kind: 'SETTIMANALE', giorno: 1, ora_da: '14:00', ora_a: '10:00' })).status, 400);
});
test('personale: turni, conferma mese, presenze, rendiconto approvato e bacheca', async () => {
  const list = (await call('GET', '/strutture')).data; const sede = list[0].id;
  const mese = '2027-03';
  const t = await call('POST', '/personale/turni', { sede_id: sede, data: `${mese}-02`, ora_da: '08:00', ora_a: '12:00', prof_id: profId, attivita: 'Prelievi' }); assert.equal(t.status, 201);
  assert.equal((await call('POST', '/personale/turni', { sede_id: sede, data: `${mese}-02`, ora_da: '10:00', ora_a: '13:00', prof_id: profId })).status, 400, 'sovrapposizione rifiutata');
  const sc = await call('POST', '/personale/turni', { sede_id: sede, data: `${mese}-02`, ora_da: '14:00', ora_a: '18:00', profilo: 'Infermiere' }); assert.equal(sc.status, 201);
  assert.equal((await callAs(profCookie, 'GET', `/portale/turni?mese=${mese}`)).data.confermato, false);
  assert.equal((await call('POST', `/personale/turni/mesi/${mese}/conferma`, { notifica: false })).status, 200);
  assert.equal((await callAs(profCookie, 'GET', `/portale/turni?mese=${mese}`)).data.turni.length, 1);
  const fb = await call('GET', `/personale/fabbisogno?mese=${mese}`); assert.ok(fb.data.turniScoperti.some((x) => x.turnoId === sc.data.id));
  const pr = await call('POST', '/personale/presenze/conferma', { sede_id: sede, data: `${mese}-02`, items: [{ prof_id: profId, ora_da: '08:00', ora_a: '12:30', turno_id: t.data.id, origine: 'TURNO' }] }); assert.equal(pr.status, 200, JSON.stringify(pr.data));
  const gen = await call('POST', '/personale/rendiconti/genera', { mese, prof_ids: [profId] }); assert.equal(gen.data.created + gen.data.updated, 1);
  const rl = (await call('GET', `/personale/rendiconti?mese=${mese}`)).data.find((x) => x.prof_id === profId); assert.equal(Number(rl.ore), 4.5); assert.equal(Number(rl.importo), 112.5);
  assert.equal((await callAs(profCookie, 'GET', '/portale/rendiconti')).data.some((x) => x.id === rl.id), false, 'bozza non visibile al professionista');
  const ap = await call('POST', `/personale/rendiconti/${rl.id}/approva`, { attachment: { filename: 'R.pdf', base64: Buffer.from('%PDF-1.4').toString('base64') } }); assert.equal(ap.status, 200);
  assert.ok((await callAs(profCookie, 'GET', '/portale/rendiconti')).data.some((x) => x.id === rl.id));
  assert.equal((await call('POST', '/personale/presenze/conferma', { sede_id: sede, data: `${mese}-02`, items: [{ id: pr.data.ids[0], prof_id: profId, ora_da: '08:00', ora_a: '12:00' }] })).status, 400, 'presenza bloccata dal rendiconto');
  const po = await call('POST', '/personale/posizioni', { titolo: 'Test posizione', sede_id: sede, profilo: 'Infermiere', turno_id: sc.data.id }); assert.equal(po.status, 201);
  assert.equal((await callAs(profCookie, 'POST', `/portale/posizioni/${po.data.id}/candidati`, { nota: 'ok' })).status, 201);
  const cands = (await call('GET', `/personale/posizioni/${po.data.id}/candidature`)).data; assert.equal(cands.length, 1);
  assert.equal((await call('POST', `/personale/candidature/${cands[0].id}/accetta`)).status, 200);
  const turni = (await call('GET', `/personale/turni?mese=${mese}`)).data.turni; assert.equal(turni.find((x) => x.id === sc.data.id).prof_id, profId, 'turno assegnato dalla candidatura');
  const st = await call('GET', `/personale/statistiche?dal=${mese}-01&al=${mese}-31`); assert.equal(st.status, 200); assert.ok(st.data.totali.orePresenze >= 4.5);
});
