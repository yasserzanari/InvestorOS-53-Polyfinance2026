import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu, Settings2, X } from 'lucide-react';
import { productModules } from '../app/modules';
import { demoAccounts, useDemoAccount } from './DemoAccountContext';
import { useAuth } from './auth';
import { MeshDriftBackground } from './MeshDriftBackground';
import './app-shell.css';

const groups = ['Décider', 'Explorer', 'Administration'] as const;

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { activeAccount, setActiveAccountId } = useDemoAccount();
  const auth = useAuth();

  useEffect(() => setDrawerOpen(false), [location.pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  return (
    <div className="workspace-frame">
      <MeshDriftBackground />
      <button
        className="mobile-menu-button"
        type="button"
        aria-label={drawerOpen ? 'Fermer la navigation' : 'Ouvrir la navigation'}
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen((open) => !open)}
      >
        {drawerOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      {drawerOpen && <button className="sidebar-scrim" aria-label="Fermer la navigation" onClick={() => setDrawerOpen(false)} />}
      <aside className={`glass-sidebar${drawerOpen ? ' is-open' : ''}`} aria-label="Navigation InvestorOS">
        <Link className="sidebar-brand" to="/app" aria-label="InvestorOS, vue d’ensemble" title="InvestorOS">
          <span className="sidebar-logo-crop"><img src="/brand/investoros-logo.png" alt="" /></span>
        </Link>
        <nav className="sidebar-navigation" aria-label="Modules">
          {groups.map((group) => (
            <section className="sidebar-group" key={group} aria-label={group}>
              <h2>{group}</h2>
              {productModules.filter((module) => module.group === group).map((module) => {
                const Icon = module.icon;
                return (
                  <NavLink
                    key={module.id}
                    to={module.href}
                    end={module.href === '/app'}
                    className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}
                    title={module.label}
                  >
                    <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                    <span className="sidebar-link-label">{module.shortLabel}</span>
                  </NavLink>
                );
              })}
            </section>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/app/settings" className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`} title="Paramètres">
            <Settings2 size={18} strokeWidth={1.8} aria-hidden="true" />
            <span className="sidebar-link-label">Paramètres</span>
          </NavLink>
          <div className="sidebar-demo-note">Données fictives de démonstration</div>
          <Link className="sidebar-profile" to="/app/profiles">
            <span className="profile-avatar">Y</span>
            <span className="sidebar-profile-copy"><strong>Yasser</strong><small>Profil de travail</small></span>
          </Link>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="topbar-context"><span>InvestorOS</span><span className="context-slash">/</span><strong>{location.pathname === '/app/profiles' ? 'Profil investisseur' : location.pathname === '/app/settings' ? 'Paramètres' : productModules.find((module) => module.href === location.pathname)?.shortLabel ?? 'Espace'}</strong></div>
          <div className="topbar-actions">
            <div id="assistant-topbar-actions" className="assistant-topbar-actions" />
            <label className="account-switcher-label" htmlFor="active-demo-account">Compte</label>
            <select id="active-demo-account" className="account-switcher" value={activeAccount.id} onChange={(event) => setActiveAccountId(event.target.value)} aria-label="Compte de démonstration actif">
              {demoAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
            {auth.enabled && <button className="topbar-logout" type="button" onClick={() => { void auth.signOut(); }}><LogOut size={14} aria-hidden="true" /> Déconnexion</button>}
          </div>
        </header>
        <main className={`workspace-content${location.pathname === '/app' ? ' is-dashboard-content' : ''}${['/app/profiles','/app/assistant'].includes(location.pathname) ? ' is-profiles-content' : ''}${location.pathname === '/app/admin' ? ' is-admin-content' : ''}`}><Outlet /></main>
      </div>
    </div>
  );
}
