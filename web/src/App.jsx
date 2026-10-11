import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';
import { ToastProvider, Icon, Loading, BusyBar } from './components/ui.jsx';
import { ROLE } from './format.js';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Sedi from './pages/Sedi.jsx';
import Specialisti from './pages/Specialisti.jsx';
import Calendario from './pages/Calendario.jsx';
import SedePage from './pages/SedePage.jsx';
import Users from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';
import Audit from './pages/Audit.jsx';
import Profile from './pages/Profile.jsx';
import Professionisti from './pages/Professionisti.jsx';
import Turni from './pages/Turni.jsx';
import Presenze from './pages/Presenze.jsx';
import Rendiconti from './pages/Rendiconti.jsx';
import Fabbisogno from './pages/Fabbisogno.jsx';
import Bacheca from './pages/Bacheca.jsx';
import Statistiche from './pages/Statistiche.jsx';
import { PortaleHome, PortaleDisponibilita, PortaleTurni, PortaleRendiconti, Invito } from './pages/Portale.jsx';

function Shell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  React.useEffect(() => setOpen(false), [loc.pathname]);
  const admin = user.role === 'ADMIN';
  const gest = admin || user.role === 'RESP_SAN';
  const prof = user.role === 'PROF';
  const L = ({ to, icon, children, end }) => (<NavLink to={to} end={end}><Icon name={icon} />{children}</NavLink>);
  return (
    <div className="shell">
      <aside className={`side ${open ? 'open' : ''}`}>
        <div className="brand"><img src="/logo-light.svg" alt="Toscana Diagnostica" /><div className="app">Room Planning</div></div>
        <nav>
          {prof ? <>
            <div className="group">Il mio portale</div>
            <L to="/" icon="home" end>Riepilogo</L>
            <L to="/disponibilita" icon="list">Le mie disponibilità</L>
            <L to="/turni" icon="pin">Turni e presenze</L>
            <L to="/rendiconti" icon="cash">Rendiconti</L>
            <L to="/bacheca" icon="alert">Bacheca</L>
          </> : <>
            <div className="group">Network</div>
            <L to="/" icon="home" end>Cruscotto</L>
            <L to="/specialisti" icon="users">Specialisti</L>
            <L to="/calendario" icon="list">Calendario</L>
            <div className="group">Pianificazione</div>
            <L to="/sedi" icon="pin">Sedi e ambulatori</L>
            <div className="group">Personale sanitario</div>
            {gest && <L to="/professionisti" icon="user">Professionisti</L>}
            <L to="/turni" icon="list">Turni</L>
            <L to="/presenze" icon="check">Presenze</L>
            {gest && <L to="/rendiconti" icon="cash">Rendiconti</L>}
            <L to="/fabbisogno" icon="alert">Fabbisogno</L>
            <L to="/bacheca" icon="building">Bacheca</L>
            {gest && <L to="/statistiche" icon="chart">Statistiche</L>}
          </>}
          {admin && <>
            <div className="group">Amministrazione</div>
            <L to="/utenti" icon="users">Utenti</L>
            <L to="/impostazioni" icon="gear">Impostazioni e backup</L>
            <L to="/audit" icon="shield">Registro attività</L>
          </>}
        </nav>
        <div className="me">
          <div className="name">{user.full_name}</div>
          <div>{ROLE[user.role]}</div>
          <div className="row" style={{ marginTop: 8 }}>
            <NavLink to="/profilo" className="btn sm ghost" style={{ color: 'var(--teal)' }}>Profilo</NavLink>
            <button className="btn sm dark" onClick={logout}>Esci</button>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="topbar"><button onClick={() => setOpen(!open)} aria-label="Menu">☰</button><img src="/logo-light.svg" alt="" /></div>
        <Routes>
          {prof ? <>
            <Route path="/" element={<PortaleHome />} />
            <Route path="/disponibilita" element={<PortaleDisponibilita />} />
            <Route path="/turni" element={<PortaleTurni />} />
            <Route path="/rendiconti" element={<PortaleRendiconti />} />
            <Route path="/bacheca" element={<Bacheca portale />} />
          </> : <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/specialisti" element={<Specialisti />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/sedi" element={<Sedi />} />
            <Route path="/sedi/:id" element={<SedePage />} />
            {gest && <Route path="/professionisti" element={<Professionisti />} />}
            <Route path="/turni" element={<Turni />} />
            <Route path="/presenze" element={<Presenze />} />
            {gest && <Route path="/rendiconti" element={<Rendiconti />} />}
            <Route path="/fabbisogno" element={<Fabbisogno />} />
            <Route path="/bacheca" element={<Bacheca />} />
            {gest && <Route path="/statistiche" element={<Statistiche />} />}
          </>}
          {admin && <Route path="/utenti" element={<Users />} />}
          {admin && <Route path="/impostazioni" element={<Settings />} />}
          {admin && <Route path="/audit" element={<Audit />} />}
          <Route path="/profilo" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Gate() {
  const { loading, user, onboarding } = useAuth();
  const inv = window.location.pathname.match(/^\/invito\/([A-Za-z0-9_-]+)/);
  if (loading) return <Loading />;
  if (!user) return inv ? <Invito token={inv[1]} /> : <Login />;
  if (onboarding) return <Onboarding />;
  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider><ToastProvider><BusyBar /><Gate /></ToastProvider></AuthProvider>
  );
}
