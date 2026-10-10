import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';
import { ToastProvider, Icon, Loading, BusyBar } from './components/ui.jsx';
import { ROLE } from './format.js';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Sedi from './pages/Sedi.jsx';
import SedePage from './pages/SedePage.jsx';
import Users from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';
import Audit from './pages/Audit.jsx';
import Profile from './pages/Profile.jsx';

function Shell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  React.useEffect(() => setOpen(false), [loc.pathname]);
  const admin = user.role === 'ADMIN';
  const L = ({ to, icon, children, end }) => (<NavLink to={to} end={end}><Icon name={icon} />{children}</NavLink>);
  return (
    <div className="shell">
      <aside className={`side ${open ? 'open' : ''}`}>
        <div className="brand"><img src="/logo-light.svg" alt="Toscana Diagnostica" /><div className="app">Room Planning</div></div>
        <nav>
          <L to="/" icon="home" end>Cruscotto</L>
          <div className="group">Pianificazione</div>
          <L to="/sedi" icon="pin">Sedi e ambulatori</L>
          {admin && <>
            <div className="group">Amministrazione</div>
            <L to="/utenti" icon="users">Utenti</L>
            <L to="/impostazioni" icon="gear">Backup e cestino</L>
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
          <Route path="/" element={<Dashboard />} />
          <Route path="/sedi" element={<Sedi />} />
          <Route path="/sedi/:id" element={<SedePage />} />
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
  if (loading) return <Loading />;
  if (!user) return <Login />;
  if (onboarding) return <Onboarding />;
  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider><ToastProvider><BusyBar /><Gate /></ToastProvider></AuthProvider>
  );
}
