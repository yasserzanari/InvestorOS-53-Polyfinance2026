import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { productModules } from '../app/modules';
import './app-shell.css';

const groups = ['Décider', 'Explorer'] as const;

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

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
          <span className="sidebar-brand-copy"><strong>InvestorOS</strong><small>Polyfinance 2026</small></span>
        </Link>
        <div className="sidebar-workspace"><span className="workspace-avatar">P</span><span className="workspace-copy"><strong>Polyfinance</strong><small>Espace de travail</small></span><ChevronDown size={15} aria-hidden="true" /></div>
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
          <div className="sidebar-demo-note">Données fictives de démonstration</div>
          <Link className="sidebar-profile" to="/app/profiles">
            <span className="profile-avatar">Y</span>
            <span className="sidebar-profile-copy"><strong>Yasser</strong><small>Profil de travail</small></span>
          </Link>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="topbar-context"><span>InvestorOS</span><span className="context-slash">/</span><strong>{productModules.find((module) => module.href === location.pathname)?.shortLabel ?? 'Espace'}</strong></div>
          <div className="topbar-actions"><span className="topbar-simulation">Espace de démonstration</span><Link to="/" className="topbar-public-link">Site public</Link></div>
        </header>
        <main className={`workspace-content${location.pathname === '/app' ? ' is-dashboard-content' : ''}`}><Outlet /></main>
      </div>
    </div>
  );
}
