import type { ReactNode } from 'react';
import {
  ArrowRight, BadgeAlert, BookOpenCheck, BriefcaseBusiness, ChartNoAxesCombined,
  CircleHelp, Compass, FileSearch, GitBranch, Layers3, ShieldCheck, UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { productModules } from '../../app/modules';
import type { DemoApiConnection } from '../../shared/api';

const moduleIcons = {
  profiles: UsersRound,
  portfolios: Layers3,
  analyses: FileSearch,
  network: GitBranch,
  scenarios: Compass,
  evidence: ShieldCheck,
};

const actionItems = [
  { title: 'Compléter votre profil', detail: 'Objectifs, horizon et préférences', href: '/app/profiles', label: 'Ouvrir les profils', Icon: UsersRound },
  { title: 'Ajouter un portefeuille', detail: 'Connecter ou saisir vos positions', href: '/app/portfolios', label: 'Ouvrir les portefeuilles', Icon: Layers3 },
  { title: 'Relier des sources', detail: 'Vérifier les données utilisées', href: '/app/evidence', label: 'Ouvrir les sources', Icon: ShieldCheck },
];

export function DashboardOverview({ api, onStartChat, children }: { api: DemoApiConnection; onStartChat: (question: string) => void; children: ReactNode }) {
  const modules = productModules.filter(({ id }) => id !== 'overview');
  const connected = api.status === 'connected';
  const currency = connected ? api.overview.portfolio.currency : 'CAD';
  const portfolioValue = connected
    ? new Intl.NumberFormat('fr-CA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(api.overview.portfolio.total_value)
    : 'À connecter';
  const profileValue = connected
    ? api.overview.profile.status === 'confirmed' ? 'Confirmé' : 'À revoir'
    : api.status === 'not_configured' ? 'À compléter' : 'Indisponible';
  const statusCards = [
    { label: 'Portefeuille', value: portfolioValue, note: connected ? `${api.overview.portfolio.positions.length} positions · données fictives AWS` : 'Ajoutez vos positions', Icon: BriefcaseBusiness, href: '/app/portfolios', tone: 'blue' },
    { label: 'Profil investisseur', value: profileValue, note: connected ? api.overview.profile.display_name : 'Définissez vos objectifs', Icon: UsersRound, href: '/app/profiles', tone: 'teal' },
    { label: 'Analyses', value: connected ? String(api.overview.analyses.length) : 'Aucune', note: connected ? 'Analyses enregistrées dans la démo' : 'Les résultats seront ici', Icon: ChartNoAxesCombined, href: '/app/analyses', tone: 'violet' },
    { label: 'Sources', value: 'À relier', note: 'Aucune source vérifiée', Icon: BookOpenCheck, href: '/app/evidence', tone: 'amber' },
  ];

  const apiMessage = api.status === 'connected'
    ? `API AWS connectée · ${api.overview.account.display_name} · source DynamoDB fictive`
    : api.status === 'rate_limited'
      ? 'API temporairement limitée (429). Réessayez dans quelques instants.'
      : api.status === 'unavailable'
        ? 'API AWS indisponible; les modules affichés restent en mode démonstration.'
        : 'Mode démonstration · API AWS non configurée pour cet environnement.';

  return (
    <section className="dashboard-overview-view" aria-label="Vue d’ensemble InvestorOS">
      <header className="dashboard-heading">
        <div>
          <h1>Votre espace de décision</h1>
          <p>Un aperçu clair des données disponibles et des prochaines étapes.</p>
          <p className="dashboard-api-notice" role="status" aria-live="polite">{apiMessage}</p>
        </div>
        <Link className="dashboard-primary-action" to="/app/profiles"><UsersRound size={16} /> Créer un profil <ArrowRight size={15} /></Link>
      </header>

      <section className="dashboard-status-grid" aria-label="État de votre espace">
        {statusCards.map(({ label, value, note, Icon, href, tone }) => (
          <Link className={`dashboard-status-card tone-${tone}`} to={href} key={label}>
            <span className="dashboard-status-icon"><Icon size={19} aria-hidden="true" /></span>
            <span className="dashboard-status-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></span>
            <ArrowRight className="dashboard-status-arrow" size={15} aria-hidden="true" />
          </Link>
        ))}
      </section>

      <div className="dashboard-overview-grid">
        <div className="dashboard-main-column">
          <section className="dashboard-panel module-panel" aria-labelledby="dashboard-modules-title">
            <div className="dashboard-panel-heading">
              <div><h2 id="dashboard-modules-title">Modules</h2><p>Ouvrez un espace pour avancer dans votre analyse.</p></div>
              <span className="module-count">{modules.length} espaces</span>
            </div>
            <div className="dashboard-module-grid">
              {modules.map((module) => {
                const Icon = moduleIcons[module.id as keyof typeof moduleIcons] ?? module.icon;
                return (
                  <Link className="dashboard-module-card" to={module.href} key={module.id}>
                    <span className={`dashboard-module-icon module-tone-${module.id}`}><Icon size={18} aria-hidden="true" /></span>
                    <span className="dashboard-module-copy"><strong>{module.shortLabel}</strong><small>{module.description}</small></span>
                    <ArrowRight className="dashboard-module-arrow" size={15} aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="dashboard-panel analysis-empty-panel" aria-labelledby="analysis-empty-title">
            <span className="analysis-empty-icon"><ChartNoAxesCombined size={19} /></span>
            <div><h2 id="analysis-empty-title">Aucune analyse enregistrée</h2><p>Formulez une question pour préparer votre première analyse.</p></div>
            <button type="button" className="text-action" onClick={() => onStartChat('Aidez-moi à préparer une première analyse.')}>Préparer une analyse <ArrowRight size={15} /></button>
          </section>
          {children}
        </div>

        <div className="dashboard-side-column">
          <section className="dashboard-panel portfolio-state-panel" aria-labelledby="portfolio-state-title">
            <div className="dashboard-panel-heading">
              <div><h2 id="portfolio-state-title">Portefeuille</h2><p>{connected ? 'Résumé AWS · données fictives' : 'Résumé et points d’attention'}</p></div>
              <span className="portfolio-state-icon"><Layers3 size={18} /></span>
            </div>
            {connected ? (
              <div className="portfolio-empty-content portfolio-connected-content">
                <div className="portfolio-demo-value">{portfolioValue}</div>
                <h3>{api.overview.portfolio.display_name}</h3>
                <div className="portfolio-demo-positions">
                  {api.overview.portfolio.positions.map((position) => (
                    <div key={position.id}>
                      <span>{position.label}</span><strong>{position.weight_pct}%</strong>
                    </div>
                  ))}
                </div>
                <Link className="dashboard-secondary-action" to="/app/portfolios">Ouvrir la simulation locale <ArrowRight size={14} /></Link>
              </div>
            ) : (
              <div className="portfolio-empty-content">
                <div className="empty-ring"><BriefcaseBusiness size={20} /></div>
                <h3>{api.status === 'unavailable' || api.status === 'rate_limited' ? 'Données indisponibles' : 'Aucune donnée de portefeuille'}</h3>
                <p>{api.status === 'unavailable' || api.status === 'rate_limited' ? 'Les données AWS ne sont pas accessibles pour le moment.' : 'Connectez vos positions pour afficher les expositions et calculer les risques.'}</p>
                <Link className="dashboard-secondary-action" to="/app/portfolios">Ouvrir les portefeuilles <ArrowRight size={14} /></Link>
              </div>
            )}
            <div className="portfolio-state-note"><CircleHelp size={14} /><span>{connected ? 'Données fictives lues depuis DynamoDB; aucun rendement historique ni risque n’est calculé ici.' : 'Aucune alerte n’est calculée tant que les positions ne sont pas disponibles.'}</span></div>
          </section>

          <section className="dashboard-panel next-actions-panel" aria-labelledby="attention-title">
            <div className="dashboard-panel-heading">
              <div><h2 id="attention-title">À faire ensuite</h2><p>Trois étapes pour commencer</p></div>
              <BadgeAlert size={18} className="next-actions-icon" aria-hidden="true" />
            </div>
            <div className="next-action-list">
              {actionItems.map(({ title, detail, href, label, Icon }, index) => (
                <Link to={href} className="next-action-row" key={title} aria-label={`${label}: ${title}`}>
                  <span className="next-action-number">0{index + 1}</span>
                  <span className="next-action-icon"><Icon size={17} aria-hidden="true" /></span>
                  <span className="next-action-copy"><strong>{title}</strong><small>{detail}</small></span>
                  <ArrowRight className="next-action-arrow" size={15} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
