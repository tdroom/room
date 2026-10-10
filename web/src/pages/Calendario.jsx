import React, { useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi, Loading, ErrorBox, Modal, Badge, Field, useToast } from '../components/ui.jsx';
import { buildNetwork, datedWeek, suggestSubstitutes, mondayOf, addDays, itDate, isoDate, DAYS, DAYS_S, m2t, sedeLabel } from '../lib/network.js';
import { pdfCalendario } from '../lib/exports.js';

const KIND = { ASSENZA: 'Assenza', CHIUSURA: 'Chiusura sede', SESSIONE_EXTRA: 'Sessione extra' };
const STATO = { ok: null, assente: ['red', 'assente'], sostituita: ['mauve', 'sostituzione'], extra: ['green', 'extra'], chiusa: ['grey', 'sede chiusa'] };

export default function Calendario() {
  const { user } = useAuth();
  const toast = useToast();
  const today = isoDate(new Date());
  const [monday, setMonday] = useState(mondayOf(today));
  const [sedeId, setSedeId] = useState('');
  const [key, setKey] = useState('');
  const [modal, setModal] = useState(null); // {evento} per modifica/creazione, oppure {sess} per dettaglio
  const strutture = useApi('/strutture');
  const ev = useApi(`/calendario/eventi?dal=${addDays(monday, -60)}&al=${addDays(monday, 120)}`, [monday]);
  const net = useMemo(() => (strutture.data ? buildNetwork(strutture.data) : null), [strutture.data]);
  const eventi = ev.data || [];
  const week = useMemo(() => (net ? datedWeek(net, eventi, monday, { sedeId: sedeId || undefined, key: key || undefined }) : null), [net, eventi, monday, sedeId, key]);
  const canEdit = user.role !== 'VIEWER';
  const label = sedeId ? sedeLabel(strutture.data.find((s) => s.id === sedeId)) : key ? net?.byKey[key]?.nome || 'specialista' : 'tutte le sedi';
  const weekEvents = eventi.filter((e) => e.al >= monday && e.dal <= addDays(monday, 6) && (!sedeId || !e.sede_id || e.sede_id === sedeId) && (!key || !e.persona_key || e.persona_key === key));
  const del = async (e) => { if (!window.confirm(`Eliminare ${KIND[e.kind].toLowerCase()} ${e.persona_nome || ''} dal ${itDate(e.dal)} al ${itDate(e.al)}?`)) return; try { await api.del(`/calendario/eventi/${e.id}`); toast('Evento eliminato'); ev.reload(); } catch (e2) { toast(e2.message, 'err'); } };
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Calendario</h1><div className="sub">La settimana-tipo applicata alle date reali: assenze, sostituzioni, chiusure e sessioni extra. È il controllo operativo di ciò che accade davvero in ogni sede.</div></div>
        <div className="row">
          {week && <button className="btn ghost" onClick={() => { const { doc, filename } = pdfCalendario(week, label); doc.save(filename); }}>Scarica PDF settimana</button>}
          {canEdit && <button className="btn" onClick={() => setModal({ evento: { kind: 'ASSENZA', dal: monday, al: monday } })}>+ Assenza / chiusura / extra</button>}
        </div>
      </div>
      <ErrorBox error={strutture.error || ev.error} />
      <div className="card" style={{ marginBottom: 14 }}><div className="bd row">
        <button className="btn sm ghost" onClick={() => setMonday(addDays(monday, -7))}>‹ settimana</button>
        <input type="date" value={monday} onChange={(e) => e.target.value && setMonday(mondayOf(e.target.value))} style={{ width: 'auto' }} />
        <button className="btn sm ghost" onClick={() => setMonday(addDays(monday, 7))}>settimana ›</button>
        <button className="btn sm ghost" onClick={() => setMonday(mondayOf(today))}>Oggi</button>
        <b style={{ marginLeft: 8 }}>{itDate(monday)} – {itDate(addDays(monday, 6))}</b>
        <span className="spacer" />
        <select value={sedeId} onChange={(e) => setSedeId(e.target.value)} style={{ width: 'auto', minWidth: 200 }}><option value="">Tutte le sedi</option>{(strutture.data || []).map((s) => <option key={s.id} value={s.id}>{sedeLabel(s)}</option>)}</select>
        <select value={key} onChange={(e) => setKey(e.target.value)} style={{ width: 'auto', minWidth: 200 }}><option value="">Tutti gli specialisti</option>{(net?.specialisti || []).filter((x) => !x.attivita).map((x) => <option key={x.key} value={x.key}>{x.nome}</option>)}</select>
      </div></div>
      {!week ? <Loading /> : (
        <div className="cal-grid">{week.giorni.map((g) => (
          <div key={g.iso} className={`cal-day ${g.iso === today ? 'today' : ''}`}>
            <div className="agenda-day">{DAYS_S[g.d]} {itDate(g.iso).slice(0, 5)}</div>
            {g.chiusure.map((c, i) => <div key={i} className="cal-blk chiusa" style={{ textDecoration: 'none' }} onClick={() => canEdit && setModal({ evento: c.evento })}><b>{c.sede}</b> chiusa{c.evento.nota ? `: ${c.evento.nota}` : ''}</div>)}
            {g.sessioni.map((q, i) => (
              <div key={i} className={`cal-blk ${q.stato}`} onClick={() => setModal({ sess: q })}>
                <div><b>{m2t(q.s)}–{m2t(q.e)}</b> · {q.room}</div>
                <div>{q.stato === 'sostituita' ? <><s>{q.nome}</s> → <b>{q.sostituto}</b></> : q.nome}{q.disciplina ? <span className="muted"> · {q.disciplina}</span> : null}</div>
                {!sedeId && <div className="muted">{q.sede}</div>}
                {q.stato === 'assente' && <div className="red strong">assente{q.evento?.nota ? ` · ${q.evento.nota}` : ''} · da sostituire</div>}
                {q.stato === 'extra' && <div className="green strong">sessione extra</div>}
              </div>))}
            {!g.sessioni.length && !g.chiusure.length && <div className="agenda-free">nessuna sessione</div>}
          </div>))}</div>
      )}
      <div className="card" style={{ marginTop: 16 }}><div className="hd"><h2>Eventi della settimana</h2></div>
        {!weekEvents.length ? <div className="bd empty">Nessuna assenza, chiusura o sessione extra in questa settimana</div> : (
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Tipo</th><th>Chi / dove</th><th>Dal</th><th>Al</th><th>Sostituto / dettagli</th><th>Nota</th><th>Inserito da</th><th /></tr></thead>
            <tbody>{weekEvents.map((e) => (
              <tr key={e.id}><td><Badge tone={e.kind === 'ASSENZA' ? 'red' : e.kind === 'CHIUSURA' ? 'grey' : 'green'}>{KIND[e.kind]}</Badge></td>
                <td className="strong">{e.persona_nome || ''}{e.sede_id ? <div className="small muted">{sedeLabel(strutture.data.find((s) => s.id === e.sede_id) || {})}</div> : e.kind === 'ASSENZA' ? <div className="small muted">tutte le sedi</div> : null}</td>
                <td>{itDate(e.dal)}</td><td>{itDate(e.al)}</td><td>{e.sost_nome || (e.kind === 'SESSIONE_EXTRA' ? `${e.ora_da}–${e.ora_a}` : '')}</td><td className="small">{e.nota}</td><td className="small muted">{e.created_by_name}</td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>{canEdit && <><button className="btn sm ghost" onClick={() => setModal({ evento: e })}>Modifica</button> <button className="btn sm ghost" style={{ color: 'var(--red)' }} onClick={() => del(e)}>Elimina</button></>}</td></tr>))}</tbody>
          </table></div>)}
      </div>
      {modal?.sess && <SessModal sess={modal.sess} net={net} canEdit={canEdit} onClose={() => setModal(null)} onAssenza={() => setModal({ evento: { kind: 'ASSENZA', persona_key: modal.sess.key, persona_nome: modal.sess.nome, persona_id: modal.sess.medId, sede_id: '', dal: modal.sess.iso, al: modal.sess.iso }, sess: modal.sess, from: 'sess' })} />}
      {modal?.evento && <EventoModal evento={modal.evento} sess={modal.sess} net={net} strutture={strutture.data || []} onClose={() => setModal(null)} onSaved={() => { setModal(null); ev.reload(); }} toast={toast} />}
    </div>
  );
}

function SessModal({ sess, net, canEdit, onClose, onAssenza }) {
  const subs = useMemo(() => suggestSubstitutes(net, sess), [net, sess]);
  return (
    <Modal title={`${sess.nome} · ${DAYS[sess.d]} ${itDate(sess.iso)}`} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Chiudi</button>{canEdit && sess.stato !== 'extra' && <button className="btn" onClick={onAssenza}>Segna assenza / sostituzione</button>}</>}>
      <p><b>{sess.sede}</b> · {sess.room} · {m2t(sess.s)}–{m2t(sess.e)}{sess.disciplina ? ` · ${sess.disciplina}` : ''}{sess.san ? ` · supporto ${sess.san}` : ''}</p>
      {STATO[sess.stato] && <p><Badge tone={STATO[sess.stato][0]}>{STATO[sess.stato][1]}</Badge> {sess.sostituto ? `→ ${sess.sostituto}` : ''} {sess.evento?.nota}</p>}
      <h3 style={{ marginTop: 10 }}>Sostituti possibili in questa fascia</h3>
      {!subs.length ? <div className="muted small">Nessun altro medico della stessa disciplina libero in questa fascia.</div> : (
        <table className="t"><thead><tr><th>Medico</th><th>Discipline</th><th>Sede</th><th>Disponibilità dichiarata</th></tr></thead>
          <tbody>{subs.slice(0, 12).map((s) => <tr key={s.key}><td className="strong">{s.nome}</td><td className="small">{s.discipline.join(', ')}</td><td className="small">{s.inSede ? <Badge tone="green">stessa sede</Badge> : <span className="muted">{s.sedi.join('; ')}</span>}</td><td className="small">{s.disponibile ? <Badge tone="green">in orario</Badge> : <span className="muted">fuori dalla sua disponibilità</span>}</td></tr>)}</tbody></table>)}
    </Modal>
  );
}

function EventoModal({ evento, sess, net, strutture, onClose, onSaved, toast }) {
  const [e, setE] = useState({ persona_key: '', persona_nome: '', sede_id: '', persona_id: '', sost_persona_id: '', sost_nome: '', room_id: '', ora_da: '09:00', ora_a: '13:00', nota: '', ...evento });
  const [err, setErr] = useState(null);
  const subs = useMemo(() => (sess ? suggestSubstitutes(net, sess) : []), [net, sess]);
  const spec = net?.specialisti.filter((x) => !x.attivita) || [];
  const sedeRooms = (strutture.find((s) => s.id === e.sede_id) || {}).ambulatori || [];
  const set = (k, v) => setE((x) => ({ ...x, [k]: v }));
  const pickPersona = (k) => { const x = net.byKey[k]; set('persona_key', k); setE((z) => ({ ...z, persona_key: k, persona_nome: x ? x.nome : '', persona_id: x && x.sedi[0] ? x.sedi[0].persona.id : '' })); };
  const save = async () => {
    setErr(null);
    const body = { ...e }; for (const k of Object.keys(body)) if (body[k] === '') body[k] = null;
    delete body.id; delete body.created_by; delete body.created_at; delete body.created_by_name;
    try { if (e.id) await api.put(`/calendario/eventi/${e.id}`, body); else await api.post('/calendario/eventi', body); toast('Evento salvato'); onSaved(); } catch (e2) { setErr(e2); }
  };
  return (
    <Modal title={e.id ? 'Modifica evento' : 'Nuovo evento di calendario'} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Annulla</button><button className="btn" onClick={save}>Salva</button></>}>
      <ErrorBox error={err} />
      <div className="form-grid">
        <Field label="Tipo"><select value={e.kind} onChange={(ev) => set('kind', ev.target.value)}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        {e.kind !== 'CHIUSURA' && <Field label="Specialista"><select value={e.persona_key} onChange={(ev) => pickPersona(ev.target.value)}><option value="">— scegli —</option>{spec.map((x) => <option key={x.key} value={x.key}>{x.nome} · {x.discipline.join(', ') || x.profili.join(', ')}</option>)}</select></Field>}
        <Field label={e.kind === 'ASSENZA' ? 'Vale per la sede' : 'Sede'}><select value={e.sede_id || ''} onChange={(ev) => set('sede_id', ev.target.value)}>{e.kind === 'ASSENZA' && <option value="">Tutte le sedi</option>}{e.kind !== 'ASSENZA' && <option value="">— scegli —</option>}{strutture.map((s) => <option key={s.id} value={s.id}>{sedeLabel(s)}</option>)}</select></Field>
        <Field label="Dal"><input type="date" value={e.dal} onChange={(ev) => set('dal', ev.target.value)} /></Field>
        <Field label="Al"><input type="date" value={e.al} onChange={(ev) => set('al', ev.target.value)} /></Field>
        {e.kind === 'SESSIONE_EXTRA' && <>
          <Field label="Ambulatorio"><select value={e.room_id || ''} onChange={(ev) => set('room_id', ev.target.value)}><option value="">— scegli —</option>{sedeRooms.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></Field>
          <Field label="Dalle"><input type="time" value={e.ora_da || ''} onChange={(ev) => set('ora_da', ev.target.value)} /></Field>
          <Field label="Alle"><input type="time" value={e.ora_a || ''} onChange={(ev) => set('ora_a', ev.target.value)} /></Field>
        </>}
      </div>
      {e.kind === 'ASSENZA' && (
        <div style={{ marginTop: 12 }}>
          <Field label="Sostituto (facoltativo)" help="Chi copre le sessioni durante l'assenza. Scegli tra i suggeriti o scrivi un nome.">
            <input list="subs" value={e.sost_nome || ''} onChange={(ev) => set('sost_nome', ev.target.value)} placeholder="Nome del sostituto" />
            <datalist id="subs">{(subs.length ? subs : spec.filter((x) => x.key !== e.persona_key)).map((s) => <option key={s.key} value={s.nome}>{s.inSede ? 'stessa sede' : ''}</option>)}</datalist>
          </Field>
          {subs.length > 0 && <div className="small muted" style={{ marginTop: 4 }}>Suggeriti (stessa disciplina, liberi nella fascia): {subs.slice(0, 6).map((s) => <button key={s.key} type="button" className="chip" style={{ border: 0, cursor: 'pointer' }} onClick={() => set('sost_nome', s.nome)}>{s.nome}{s.inSede ? ' ✓' : ''}</button>)}</div>}
        </div>)}
      <Field label="Nota" className="" ><input value={e.nota || ''} onChange={(ev) => set('nota', ev.target.value)} placeholder="Es. ferie, congresso, lavori in corso…" style={{ marginTop: 8 }} /></Field>
    </Modal>
  );
}
