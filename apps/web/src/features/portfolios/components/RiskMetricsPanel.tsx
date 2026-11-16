import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Database, PieChart, RefreshCw, UserRound, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { authenticatedFetch } from '../../../shared/auth';
import type { DemoOverview } from '../../../shared/api';
import { profileApiBase } from '../../profiles/profile-api';
import { initialProfiles, type Profile } from '../../profiles/profile-model';
import { buildPortfolioRiskInsights, type PortfolioRiskInsight } from '../model/portfolio-observations';

type ProfileState = 'loading' | 'saved' | 'demo-default' | 'unavailable';

const insightIcons: Record<PortfolioRiskInsight['id'], LucideIcon> = {
  concentration: PieChart,
  sensitivity: ArrowUpRight,
  profile: UserRound,
  coverage: Database,
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function formatFact(value: string | number, format: 'percent' | 'money' | 'number' | undefined, currency: string) {
  if (typeof value !== 'number') return value;
  if (format === 'money') return formatMoney(value, currency);
  if (format === 'percent') return `${value.toLocaleString('fr-CA', { maximumFractionDigits: 2 })} %`;
  return value.toLocaleString('fr-CA');
}

function isProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<Profile>;
  return typeof profile.objective === 'string'
    && typeof profile.horizon === 'string'
    && typeof profile.riskTolerance === 'string'
    && typeof profile.lossCapacity === 'string'
    && typeof profile.liquidity === 'string'
    && typeof profile.constraints === 'string';
}

export function RiskMetricsPanel({ accountId, accountName, portfolio }: {
  accountId: DemoOverview['persona'];
  accountName: string;
  portfolio: DemoOverview['portfolio'];
}) {
  const defaultProfile = initialProfiles[accountId];
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [profileState, setProfileState] = useState<ProfileState>('loading');
  const [profileError, setProfileError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedInsightId, setSelectedInsightId] = useState<PortfolioRiskInsight['id'] | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const loadProfile = useCallback(async (signal: AbortSignal) => {
    setProfileState('loading');
    setProfileError('');
    try {
      const response = await authenticatedFetch(`${profileApiBase}/v1/profiles/memory/${accountId}`, { signal });
      if (!response.ok) throw new Error(`Lecture du profil impossible (${response.status}).`);
      const payload: unknown = await response.json();
      const savedProfile = payload && typeof payload === 'object' ? (payload as { profile?: unknown }).profile : undefined;
      if (isProfile(savedProfile)) {
        setProfile(savedProfile);
        setProfileState('saved');
      } else {
        setProfile(defaultProfile);
        setProfileState('demo-default');
      }
    } catch (error) {
      if (signal.aborted) return;
      setProfile(defaultProfile);
      setProfileState('unavailable');
      setProfileError(error instanceof Error ? error.message : 'Lecture du profil mémorisé impossible.');
    }
  }, [accountId, defaultProfile]);

  useEffect(() => {
    const controller = new AbortController();
    void loadProfile(controller.signal);
    return () => controller.abort();
  }, [loadProfile, refreshKey]);

  const analysis = useMemo(() => buildPortfolioRiskInsights(portfolio, profile), [portfolio, profile]);
  const selectedInsight = analysis.insights.find((insight) => insight.id === selectedInsightId) ?? null;
  const profileSource = profileState === 'saved'
    ? 'le profil mémorisé du compte'
    : profileState === 'unavailable'
      ? 'les valeurs initiales du profil de démonstration (mémoire indisponible)'
      : 'les valeurs initiales du profil de démonstration';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selectedInsight && dialog && !dialog.open) dialog.showModal();
    if (!selectedInsight && dialog?.open) dialog.close();
  }, [selectedInsight]);

  return (
    <section className="portfolio-panel portfolio-risk-panel" aria-labelledby="portfolio-risk-heading" aria-busy={profileState === 'loading'}>
      <header className="portfolio-panel-heading">
        <div>
          <span className="portfolio-section-icon is-risk"><PieChart size={16} aria-hidden="true" /></span>
          <div>
            <h2 id="portfolio-risk-heading">Risques à examiner</h2>
            <p>Lectures calculées depuis les positions et le profil de {accountName}</p>
          </div>
        </div>
        <div className="portfolio-risk-header-actions">
          <span className={`portfolio-profile-source is-${profileState}`}>
            {profileState === 'saved' ? 'Profil mémorisé' : profileState === 'loading' ? 'Lecture du profil…' : 'Valeurs démo'}
          </span>
          <button className="portfolio-refresh-button" type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={profileState === 'loading'} aria-label="Actualiser le profil mémorisé" title="Actualiser le profil mémorisé">
            <RefreshCw size={15} aria-hidden="true" className={profileState === 'loading' ? 'is-spinning' : undefined} />
          </button>
        </div>
      </header>

      {profileState === 'unavailable' && <p className="portfolio-risk-profile-warning" role="status">
        <AlertTriangle size={14} aria-hidden="true" />
        {profileError} Les cartes utilisent les valeurs initiales du profil de démonstration.
      </p>}

      <div className="portfolio-risk-research-grid" aria-label="Observations de risque du portefeuille">
        {analysis.insights.map((insight) => {
          const Icon = insightIcons[insight.id];
          return <article className={`portfolio-risk-research-item is-${insight.id}`} key={insight.id}>
            <button type="button" className="portfolio-risk-research-card" onClick={() => setSelectedInsightId(insight.id)} aria-haspopup="dialog" aria-label={`Ouvrir le détail : ${insight.title}`}>
              <span className="portfolio-risk-research-topline">
                <span className="portfolio-risk-research-icon"><Icon size={17} aria-hidden="true" /></span>
                <span className="portfolio-risk-research-category">{insight.category}</span>
              </span>
              <strong className="portfolio-risk-research-metric">{insight.metric}</strong>
              <span className="portfolio-risk-research-title">{insight.title}</span>
              <span className="portfolio-risk-research-summary">{insight.summary}</span>
              <span className="portfolio-risk-research-link">Lire l’analyse <ArrowUpRight size={13} aria-hidden="true" /></span>
            </button>
          </article>;
        })}
      </div>

      <p className="portfolio-risk-method-note">
        Les cartes distinguent les pondérations observées, les hypothèses arithmétiques et les données manquantes. Aucun seuil de risque ni verdict d’adéquation n’est inventé.
      </p>

      <dialog ref={dialogRef} className="portfolio-risk-dialog" aria-labelledby="portfolio-risk-dialog-title" onClose={() => setSelectedInsightId(null)} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
        {selectedInsight && <>
          <header className="portfolio-risk-dialog-header">
            <div>
              <span className="portfolio-risk-dialog-category">{selectedInsight.category}</span>
              <h2 id="portfolio-risk-dialog-title">{selectedInsight.title}</h2>
            </div>
            <button type="button" className="portfolio-risk-dialog-close" onClick={() => dialogRef.current?.close()} aria-label="Fermer le détail"><X size={18} /></button>
          </header>
          <div className="portfolio-risk-dialog-body">
            <div className="portfolio-risk-dialog-summary">
              <strong>{selectedInsight.metric}</strong>
              <p>{selectedInsight.summary}</p>
            </div>
            <div className="portfolio-risk-dialog-columns">
              <section>
                <h3>Données prises en compte</h3>
                <dl>
                  {selectedInsight.facts.map((fact) => <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{formatFact(fact.value, fact.format, portfolio.currency)}</dd>
                  </div>)}
                </dl>
              </section>
              <section>
                <h3>Comment lire ce résultat</h3>
                <p>{selectedInsight.explanation}</p>
                <h3 className="portfolio-risk-dialog-limit-heading">Limites</h3>
                <ul>{selectedInsight.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
              </section>
            </div>
            <div className="portfolio-risk-dialog-source">
              <Database size={14} aria-hidden="true" />
              <p>Base de cette lecture : les positions et pondérations du portefeuille chargé, et {profileSource}. Ces données de démonstration ne sont pas des positions de courtage.</p>
            </div>
          </div>
        </>}
      </dialog>
    </section>
  );
}
