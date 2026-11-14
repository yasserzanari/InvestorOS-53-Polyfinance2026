import { ExternalLink, GitBranch, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SimulationProjection } from '../../shared/api';
import { safeSourceUrl } from '../profiles/profile-api';
import './simulation-result-tab.css';

type ProjectionWithProvenance = SimulationProjection & {
  provenance?: { sourceUrl?: string; moduleUrl?: string };
};

function parseProjection(content: string): ProjectionWithProvenance | null {
  try {
    const value: unknown = JSON.parse(content);
    if (!value || typeof value !== 'object') return null;
    const projection = value as Partial<ProjectionWithProvenance>;
    const validBranches = Array.isArray(projection.branches) && projection.branches.every((branch) =>
      Boolean(branch && typeof branch.id === 'string' && typeof branch.title === 'string' &&
        typeof branch.event === 'string' && typeof branch.shockPct === 'number' &&
        typeof branch.eventAfterObservations === 'number' && Array.isArray(branch.path) &&
        branch.path.every((point) => Boolean(point && typeof point.observations === 'number' &&
          typeof point.eventApplied === 'boolean' && typeof point.lowerPrice === 'number' &&
          typeof point.medianPrice === 'number' && typeof point.upperPrice === 'number')))
    );
    if (
      typeof projection.ticker !== 'string' ||
      typeof projection.asOf !== 'string' ||
      typeof projection.startingPrice !== 'number' ||
      typeof projection.currency !== 'string' ||
      typeof projection.horizonObservations !== 'number' ||
      !validBranches ||
      typeof projection.method !== 'string' ||
      !Array.isArray(projection.limitations) ||
      !projection.limitations.every((item) => typeof item === 'string')
    ) return null;
    return projection as ProjectionWithProvenance;
  } catch {
    return null;
  }
}

const number = (value: number, currency: string) => new Intl.NumberFormat('fr-CA', {
  style: 'currency', currency, maximumFractionDigits: 2,
}).format(value);

function BranchChart({ branch, currency }: {
  branch: ProjectionWithProvenance['branches'][number];
  currency: string;
}) {
  const points = branch.path;
  const all = points.flatMap((point) => [point.lowerPrice, point.medianPrice, point.upperPrice]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const x = (index: number) => points.length < 2 ? 8 : 8 + index / (points.length - 1) * 284;
  const y = (value: number) => 68 - (value - min) / span * 56;
  const median = points.map((point, index) => `${index ? 'L' : 'M'}${x(index)},${y(point.medianPrice)}`).join(' ');
  const area = [
    ...points.map((point, index) => `${index ? 'L' : 'M'}${x(index)},${y(point.upperPrice)}`),
    ...points.slice().reverse().map((point, reverseIndex) => {
      const index = points.length - reverseIndex - 1;
      return `L${x(index)},${y(point.lowerPrice)}`;
    }),
    'Z',
  ].join(' ');

  return (
    <figure className="assistant-scenario-chart">
      <svg viewBox="0 0 300 82" role="img" aria-label={`Fourchette historique marginale pour ${branch.title}`}>
        <path d={area} className="assistant-scenario-band" />
        <path d={median} className="assistant-scenario-median" />
      </svg>
      <figcaption>
        <span>{points[0]?.observations ?? 0} séance</span>
        <span>{points.at(-1)?.observations ?? 0} séances</span>
        <span>{number(points.at(-1)?.medianPrice ?? 0, currency)} médiane</span>
      </figcaption>
    </figure>
  );
}

export function SimulationResultTab({ content }: { content: string }) {
  const projection = parseProjection(content);
  if (!projection) return <p className="assistant-scenario-invalid" role="status">Le résultat de simulation enregistré est illisible. Relancez le calcul depuis l’Assistant.</p>;
  const moduleUrl = projection.provenance?.moduleUrl;
  const sourceUrl = projection.provenance?.sourceUrl;

  return (
    <section className="assistant-scenario-result" aria-label={`Trajectoires conditionnelles pour ${projection.ticker}`}>
      <header className="assistant-scenario-summary">
        <span className="assistant-scenario-icon"><GitBranch size={16} aria-hidden="true" /></span>
        <div>
          <h2>{projection.ticker} · hypothèses comparées</h2>
          <p>Départ {number(projection.startingPrice, projection.currency)} au {projection.asOf} · horizon {projection.horizonObservations} séances</p>
        </div>
      </header>

      <div className="assistant-scenario-branches">
        {projection.branches.map((branch, index) => {
          const end = branch.path.at(-1);
          return (
            <article className="assistant-scenario-branch" key={branch.id} data-branch-index={index}>
              <div className="assistant-scenario-branch-title">
                <span aria-hidden="true" />
                <div><h3>{branch.title}</h3><p>{branch.event} · choc {branch.shockPct > 0 ? '+' : ''}{branch.shockPct} % après {branch.eventAfterObservations} séances</p></div>
              </div>
              <BranchChart branch={branch} currency={projection.currency} />
              <dl className="assistant-scenario-quantiles">
                <div><dt>10e percentile</dt><dd>{end ? number(end.lowerPrice, projection.currency) : '—'}</dd></div>
                <div><dt>Médiane</dt><dd>{end ? number(end.medianPrice, projection.currency) : '—'}</dd></div>
                <div><dt>90e percentile</dt><dd>{end ? number(end.upperPrice, projection.currency) : '—'}</dd></div>
              </dl>
            </article>
          );
        })}
      </div>

      <section className="assistant-scenario-method" aria-label="Méthode et limites">
        <h3><ShieldCheck size={14} aria-hidden="true" /> Méthode et limites</h3>
        <p>{projection.method}</p>
        <ul>{projection.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
        <p className="assistant-scenario-source">Source : {projection.source}</p>
      </section>

      <nav className="assistant-scenario-links" aria-label="Ouvrir les données de la simulation">
        {moduleUrl && <Link to={safeSourceUrl(moduleUrl)}><ExternalLink size={13} aria-hidden="true" /> Ouvrir {projection.ticker} dans Simulation</Link>}
        {sourceUrl && <a href={safeSourceUrl(sourceUrl)} target="_blank" rel="noreferrer"><ExternalLink size={13} aria-hidden="true" /> Historique du fournisseur</a>}
      </nav>
    </section>
  );
}
