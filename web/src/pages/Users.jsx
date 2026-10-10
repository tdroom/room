import React, { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi, Field, Loading, ErrorBox, Empty, Badge, Modal, useToast } from '../components/ui.jsx';
import { itDateTime, ROLE, ROLE_HELP, PROVIDER } from '../format.js';
import { sedeLabel } from './Sedi.jsx';

const empty = { email: '', full_name: '', role: 'VIEWER', auth_provider: 'ENTRA', struttura_ids: [], active: true };

export default function Users() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, reload } = useApi('/users');
  const sedi = useApi('/strutture');
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState(null);
  const [cred, setCred] = useState(null);

  const save = async () => {
    setErr(null);
    const b = { email: edit.email, full_name: edit.full_name, role: edit.role, auth_provider: edit.auth_provider, struttura_ids: edit.role === 'ADMIN' ? [] : edit.struttura_ids, active: !!edit.active };
    try {
      const r = edit.id ? await api.put(`/users/${edit.id}`, b) : await api.post('/users', b);
      toast('Utente salvato'); setEdit(null); reload();
      if (r.temporaryPassword) setCred({ email: b.email, pwd: r.temporaryPassword });
    } catch (e) { setErr(e); }
  };
  const reset = async (u, what) => {
    if (!window.confirm(what === 'pwd' ? `Generare una nuova password temporanea per ${u.email}?` : `Disattivare la verifica in due passaggi di ${u.email}?`)) return;
    try {
      const r = await api.post(`/users/${u.id}/${what === 'pwd' ? 'reset-password' : 'reset-totp'}`);
      if (r.temporaryPassword) setCred({ email: u.email, pwd: r.temporaryPassword }); else toast('2FA azzerata'); reload();
    } catch (e) { setErr(e); }
  };
  const nameOf = (id) => { const s = (sedi.data || []).find((x) => x.id === id); return s ? sedeLabel(s) : id; };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Utenti</h1><div className="sub">Chi accede, con quale ruolo e su quali sedi</div></div>
        <button className="btn" onClick={() => setEdit({ ...empty })}>+ Nuovo utente</button>
      </div>
      <ErrorBox error={err} />
      <div className="alert info" style={{ marginBottom: 14 }}>Chi entra con un account Microsoft 365 di Toscana Diagnostica viene registrato da solo al primo accesso con il profilo <b>Consultazione</b>: da qui lo promuovi a Pianificatore o Amministratore. Senza sedi assegnate un utente vede tutte le sedi; assegnandone alcune vede e modifica solo quelle.</div>
      {!data ? <Loading /> : !data.length ? <div className="card"><Empty>Nessun utente</Empty></div> : (
        <div className="card"><div className="table-wrap"><table className="t">
          <thead><tr><th>Nome</th><th>Email</th><th>Ruolo</th><th>Sedi</th><th>Accesso</th><th>Ultimo accesso</th><th>Stato</th><th /></tr></thead>
          <tbody>{data.map((u) => (
            <tr key={u.id}>
              <td className="strong">{u.full_name}</td><td>{u.email}</td><td>{ROLE[u.role]}</td>
              <td>{u.role !== 'ADMIN' && (u.struttura_ids || []).length ? u.struttura_ids.map((id) => <span key={id} className="chip">{nameOf(id)}</span>) : <span className="muted small">tutte</span>}</td>
              <td className="small">{PROVIDER[u.auth_provider]}{u.auth_provider !== 'ENTRA' && <div>{u.totp_enabled ? <Badge tone="green">2FA attiva</Badge> : <Badge>2FA no</Badge>} {u.must_change_password && <Badge tone="mauve">password temporanea</Badge>}</div>}</td>
              <td className="small muted">{u.last_login_at ? itDateTime(u.last_login_at) : 'mai'}{u.locked_until && new Date(u.locked_until) > new Date() && <div className="red">bloccato</div>}</td>
              <td>{u.active ? <Badge tone="green">Attivo</Badge> : <Badge tone="red">Disattivo</Badge>}</td>
              <td className="num" style={{ whiteSpace: 'nowrap' }}>
                <button className="btn sm ghost" onClick={() => setEdit({ ...u, struttura_ids: u.struttura_ids || [] })}>Modifica</button>
                {u.auth_provider !== 'ENTRA' && <>{' '}<button className="btn sm ghost" onClick={() => reset(u, 'pwd')}>Reset pwd</button></>}
                {u.totp_enabled && <>{' '}<button className="btn sm ghost" onClick={() => reset(u, 'totp')}>Reset 2FA</button></>}
              </td>
            </tr>))}</tbody>
        </table></div></div>
      )}
      {edit && (
        <Modal title={edit.id ? `Modifica ${edit.full_name}` : 'Nuovo utente'} onClose={() => setEdit(null)} footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Annulla</button><button className="btn" disabled={!edit.email || !edit.full_name} onClick={save}>Salva</button></>}>
          <ErrorBox error={err} />
          <div className="form-grid">
            <Field label="Nome e cognome"><input value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} /></Field>
            <Field label="Email" help="Per l'accesso Microsoft deve coincidere con l'account Office 365"><input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Ruolo"><select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><span className="help">{ROLE_HELP[edit.role]}</span></Field>
            <Field label="Metodo di accesso"><select value={edit.auth_provider} onChange={(e) => setEdit({ ...edit, auth_provider: e.target.value })}>{Object.entries(PROVIDER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          </div>
          {edit.role !== 'ADMIN' && (
            <div style={{ marginTop: 12 }}>
              <div className="small strong muted" style={{ marginBottom: 6 }}>Sedi su cui può operare (nessuna selezione = tutte)</div>
              <div className="row">{(sedi.data || []).map((s) => <label key={s.id} className="f inline"><input type="checkbox" checked={edit.struttura_ids.includes(s.id)} onChange={(e) => setEdit({ ...edit, struttura_ids: e.target.checked ? [...edit.struttura_ids, s.id] : edit.struttura_ids.filter((x) => x !== s.id) })} />{sedeLabel(s)}</label>)}</div>
            </div>
          )}
          {edit.id && edit.id !== user.id && <label className="f inline" style={{ marginTop: 12 }}><input type="checkbox" checked={!!edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />Utente attivo</label>}
          {!edit.id && edit.auth_provider !== 'ENTRA' && <div className="small muted" style={{ marginTop: 12 }}>Alla creazione viene generata una password temporanea da consegnare all'utente, che dovrà cambiarla al primo accesso.</div>}
        </Modal>
      )}
      {cred && (
        <Modal title="Password temporanea" onClose={() => setCred(null)} footer={<button className="btn" onClick={() => setCred(null)}>Ho copiato la password</button>}>
          <p>Comunica queste credenziali a <b>{cred.email}</b> per un canale sicuro. La password non sarà più visibile.</p>
          <div className="mono" style={{ fontSize: 22, padding: 14, background: 'var(--silk)', borderRadius: 10, textAlign: 'center', userSelect: 'all' }}>{cred.pwd}</div>
        </Modal>
      )}
    </div>
  );
}
