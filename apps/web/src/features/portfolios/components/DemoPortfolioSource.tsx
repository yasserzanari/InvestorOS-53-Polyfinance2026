import { Database, ExternalLink, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DemoApiConnection } from '../../../shared/api';

type DemoPortfolioSourceProps = {
  accountName: string;
  connection: DemoApiConnection | { status: 'loading' };
};

export function DemoPortfolioSource({ accountName, connection }: DemoPortfolioSourceProps) {
  if (connection.status === 'loading') {
    return (
      <section className="portfolio-live-source" aria-live="polite">
        <Database size={17} aria-hidden="true" />
        <div className="portfolio-live-copy"><strong>Portefeuille du compte démo</strong><span>Lecture de la fixture AWS…</span></div>
        <span className="portfolio-source-state">Chargement</span>
      </section>
    );
  }

  if (connection.status !== 'connected') {
    const message = connection.status === 'not_configured'
      ? 'La connexion à l’API de démonstration n’est pas configurée.'
      : connection.status === 'rate_limited'
        ? 'Trop de lectures rapprochées. Réessayez dans un instant.'
        : 'Les données du portefeuille AWS sont temporairement indisponibles.';
    return (
      <section className="portfolio-live-source is-unavailable" role="status">
        <Database size={17} aria-hidden="true" />
        <div className="portfolio-live-copy"><strong>Portefeuille du compte démo</strong><span>{message}</span></div>
      </section>
    );
  }

  const { overview } = connection;
  const { portfolio } = overview;
  return (
    <section className="portfolio-live-source" aria-label={`Données AWS du portefeuille de ${accountName}`}>
      <div className="portfolio-live-identity">
        <span className="portfolio-live-icon"><Database size={16} aria-hidden="true" /></span>
        <div className="portfolio-live-copy">
          <strong>{portfolio.display_name}</strong>
          <span>{overview.account.display_name} · données fictives de la fixture AWS</span>
        </div>
      </div>
      <div className="portfolio-live-value"><small>Valeur déclarée</small><strong>{new Intl.NumberFormat('fr-CA', { style: 'currency', currency: portfolio.currency, maximumFractionDigits: 0 }).format(portfolio.total_value)}</strong></div>
      <div className="portfolio-live-meta"><ShieldCheck size={14} aria-hidden="true" /><span>Lecture seule · {portfolio.positions.length} positions</span></div>
      <details className="portfolio-live-details">
        <summary>Consulter les positions</summary>
        <div className="portfolio-live-position-list">
          {portfolio.positions.map((position) => (
            <div key={position.id}>
              <span>{position.label}</span>
              <strong>{position.weight_pct.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %</strong>
              <span>{new Intl.NumberFormat('fr-CA', { style: 'currency', currency: portfolio.currency, maximumFractionDigits: 0 }).format(position.value)}</span>
            </div>
          ))}
        </div>
        <p>Montants et pondérations proviennent du portefeuille fictif configuré. Aucun historique de cours n’est fourni par cette fixture.</p>
      </details>
      <Link className="portfolio-live-assistant-link" to="/app/assistant" state={{ initialPrompt: `Analyse les positions du portefeuille fictif de ${overview.account.display_name}. Distingue les données de la fixture de toute hypothèse et explique les limites.` }}>
        Demander une analyse à l’assistant <ExternalLink size={13} aria-hidden="true" />
      </Link>
    </section>
  );
}
