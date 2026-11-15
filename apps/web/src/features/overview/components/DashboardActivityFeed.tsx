import { ArrowRight, BookOpenCheck, Clock3, ExternalLink, Newspaper } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadPortfolioNewsCases, updatePortfolioNewsCase, type PortfolioNewsCase, type SimulationNewsArticle } from '../../../shared/api';
import type { DemoApiConnection } from '../../../shared/api';

type ActivityRecord = Record<string, unknown>;
type NewsItem = SimulationNewsArticle & { ticker: string };

function firstText(record: ActivityRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function formatDate(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return undefined;
  return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium' }).format(new Date(value));
}

function analysisStatus(record: ActivityRecord) {
  const value = firstText(record, ['status', 'state'])?.toLowerCase();
  if (!value) return 'Enregistrée';
  if (['completed', 'complete', 'done'].includes(value)) return 'Terminée';
  if (['running', 'active'].includes(value)) return 'En cours';
  if (['pending', 'queued'].includes(value)) return 'En attente';
  if (['failed', 'error'].includes(value)) return 'Échec';
  return value;
}

export function DashboardActivityFeed({
  api,
  news,
  newsStatus,
  hasLinkedTickers,
}: {
  api: DemoApiConnection;
  news: NewsItem[];
  newsStatus: 'idle' | 'loading' | 'ready' | 'unavailable';
  hasLinkedTickers: boolean;
}) {
  const [cleared, setCleared] = useState(false);
  const [readAll, setReadAll] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [cases, setCases] = useState<PortfolioNewsCase[]>([]);
  const [openCase, setOpenCase] = useState<string | null>(null);
  const connected = api.status === 'connected';
  const accountKey = connected ? api.overview.persona : api.status;
  useEffect(() => {
    setCleared(false);
    setReadAll(false);
    setDismissed(new Set());
    setOpenCase(null);
  }, [accountKey]);
  useEffect(() => {
    if (!connected) { setCases([]); return; }
    const controller = new AbortController();
    loadPortfolioNewsCases(api.overview.persona, controller.signal).then(({ cases: records }) => {
      if (!controller.signal.aborted) setCases(records);
    }).catch(() => { if (!controller.signal.aborted) setCases([]); });
    return () => controller.abort();
  }, [connected, accountKey]);
  const analyses = connected ? api.overview.analyses.slice(0, 4) : [];
  const rows = useMemo(() => [
    ...analyses.map((record, index) => {
      const title = firstText(record, ['title', 'name', 'question', 'analysis_name', 'display_name']) ?? `Analyse enregistrée ${index + 1}`;
      const summary = firstText(record, ['summary', 'result', 'answer', 'description', 'rationale']);
      const date = formatDate(firstText(record, ['created_at', 'createdAt', 'updated_at', 'date', 'as_of']));
      const status = analysisStatus(record);
      return {
        id: firstText(record, ['analysis_id', 'id']) ?? `analysis-${index}`,
        kind: 'analysis' as const,
        title,
        detail: summary ?? `${status} · compte de démonstration`,
        meta: date ? `${status} · ${date}` : status,
        href: '/app/analyses',
        caseRecord: undefined as PortfolioNewsCase | undefined,
      };
    }),
    ...news.slice(0, 4).map((article) => ({
      id: `news-${article.id}`,
      kind: 'news' as const,
      title: article.title,
      detail: `${article.domain} · ${article.ticker}`,
      meta: `Indexée ${formatDate(article.indexedAt) ?? 'récemment'}`,
      href: article.url,
      caseRecord: undefined as PortfolioNewsCase | undefined,
    })),
    ...cases.filter((record) => record.status !== 'resolved').map((record) => ({
      id: `case-${record.id}`, kind: 'case' as const, title: record.title,
      detail: `${record.company} (${record.ticker}) · ${record.summary}`,
      meta: `Dossier de veille · ${formatDate(record.createdAt) ?? 'récent'}`,
      href: record.source.url, caseRecord: record,
    })),
  ], [analyses, news, cases]);

  async function updateCase(record: PortfolioNewsCase, status: 'read' | 'resolved') {
    if (!connected) return;
    try {
      const updated = await updatePortfolioNewsCase(api.overview.persona, record.id, status);
      setCases((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch { /* Keep the case visible; the user can retry. */ }
  }

  return (
    <section className="dashboard-panel activity-panel" aria-labelledby="dashboard-activity-title">
      <div className="dashboard-panel-heading">
        <div>
          <h2 id="dashboard-activity-title">Notifications</h2>
          <p>Analyses du compte et nouvelles liées aux titres du portefeuille.</p>
        </div>
        <span className="activity-count" aria-label={`${cleared ? 0 : rows.length - dismissed.size} notifications`}>{cleared ? 0 : rows.length - dismissed.size}</span>
        <div className="activity-feed-actions">
          <button type="button" onClick={() => setReadAll(true)} disabled={readAll || rows.length === 0}>Tout lire</button>
          <button type="button" onClick={() => setCleared(true)} disabled={cleared || rows.length === 0}>Effacer</button>
        </div>
      </div>

      {!connected && (
        <div className="activity-empty-grid" role="status">
          <div className="activity-empty-item">
            <span className="activity-row-icon is-analysis"><BookOpenCheck size={16} /></span>
            <div><strong>Analyses indisponibles</strong><p>{api.status === 'not_configured' ? 'Configurez l’API du compte pour charger les analyses enregistrées.' : api.status === 'rate_limited' ? 'L’API limite temporairement les lectures.' : 'Impossible de lire l’historique du compte pour le moment.'}</p></div>
            <Link to="/app/analyses" aria-label="Ouvrir les analyses"><ArrowRight size={15} /></Link>
          </div>
          <div className="activity-empty-item">
            <span className="activity-row-icon is-news"><Newspaper size={16} /></span>
            <div><strong>Veille des titres indisponible</strong><p>{api.status === 'not_configured' ? 'Reliez l’API et des tickers explicites pour afficher les nouvelles du portefeuille.' : 'Les nouvelles seront relues lorsque les positions du compte seront accessibles.'}</p></div>
            <Link to="/app/portfolios" aria-label="Ouvrir les portefeuilles"><ArrowRight size={15} /></Link>
          </div>
        </div>
      )}

      {connected && !cleared && rows.some((row) => !dismissed.has(row.id)) && (
        <div className="activity-list" role="list" aria-label="Activité récente du compte">
          {rows.filter((row) => !dismissed.has(row.id)).map((row) => {
            const Icon = row.kind === 'analysis' ? BookOpenCheck : Newspaper;
            const external = row.href.startsWith('http');
            const content = (
              <>
              <span className={`activity-row-icon is-${row.kind}`}><Icon size={16} /></span>
                <span className="activity-row-copy">
                  <span className="activity-row-meta"><Clock3 size={12} />{row.meta}</span>
                  <strong>{row.title}</strong>
                  <small>{row.detail}</small>
                </span>
                <ArrowRight size={15} className="activity-row-arrow" />
              </>
            );
            return (
              <div key={row.id} className={`activity-card${readAll ? ' is-read' : ''}`} role="listitem">
                {external
                  ? <a className="activity-row" href={row.href} target="_blank" rel="noreferrer">{content}</a>
                  : <Link className="activity-row" to={row.href}>{content}</Link>}
                {row.caseRecord && <>
                  <button className="activity-case-toggle" type="button" onClick={() => { const record = row.caseRecord!; setOpenCase(openCase === record.id ? null : record.id); if (record.status === 'new') void updateCase(record, 'read'); }}>
                    {openCase === row.caseRecord.id ? 'Masquer les détails' : 'Voir les détails'}
                  </button>
                  {openCase === row.caseRecord.id && <div className="activity-case-details">
                    <p><strong>Événement :</strong> {row.caseRecord.eventType}</p>
                    <blockquote>« {row.caseRecord.evidenceQuote} »</blockquote>
                    <p><strong>Action suggérée :</strong> {row.caseRecord.nextAction}</p>
                    <p className="activity-case-limit">Source secondaire · {row.caseRecord.source.domain}. À vérifier avant toute décision. Aucune action sur le portefeuille n’est exécutée.</p>
                    <a href={row.caseRecord.source.url} target="_blank" rel="noreferrer">Ouvrir la source <ExternalLink size={12} /></a>
                    <button type="button" onClick={() => void updateCase(row.caseRecord!, 'resolved')}>Fermer le dossier</button>
                  </div>}
                </>}
                <button className="activity-dismiss" type="button" aria-label={`Masquer ${row.title}`} onClick={() => setDismissed((current) => new Set(current).add(row.id))}>×</button>
              </div>
            );
          })}
        </div>
      )}

      {connected && (rows.length === 0 || cleared || dismissed.size >= rows.length) && (
        <div className="activity-empty-grid">
          {rows.length > 0 && (cleared || dismissed.size >= rows.length)
            ? <div className="activity-caught-up"><span>✓</span><strong>Tout est à jour</strong><p>Les notifications ont été masquées. Les nouvelles activités apparaîtront ici.</p></div>
            : <>
              <div className="activity-empty-item">
                <span className="activity-row-icon is-analysis"><BookOpenCheck size={16} /></span>
                <div><strong>{analyses.length ? 'Aucune analyse terminée' : 'Aucune analyse enregistrée'}</strong><p>{analyses.length ? 'Les analyses en cours ou en attente ne sont pas signalées comme terminées.' : 'Les analyses enregistrées apparaîtront ici.'}</p></div>
                <Link to="/app/analyses" aria-label="Consulter les analyses"><ArrowRight size={15} /></Link>
              </div>
              <div className="activity-empty-item">
                <span className="activity-row-icon is-news"><Newspaper size={16} /></span>
                <div><strong>{newsStatus === 'loading' ? 'Lecture des nouvelles…' : hasLinkedTickers ? 'Aucune nouvelle trouvée' : 'Aucun titre coté relié'}</strong><p>{hasLinkedTickers ? newsStatus === 'unavailable' ? 'La source de nouvelles est indisponible pour le moment.' : 'Les positions actuelles n’ont pas de nouvelle disponible.' : 'Les positions de démonstration sont des catégories, sans ticker à surveiller.'}</p></div>
                <Link to="/app/portfolios" aria-label="Consulter le portefeuille"><ArrowRight size={15} /></Link>
              </div>
            </>}
        </div>
      )}

      {connected && rows.length > 0 && !hasLinkedTickers && (
        <div className="activity-market-note"><Newspaper size={14} /><span>La veille des titres s’activera quand le portefeuille contiendra des tickers explicites.</span></div>
      )}

      {connected && rows.length === 0 && newsStatus === 'idle' && (
        <p className="activity-source-note">Lecture des analyses du compte actif; aucune notification n’est fabriquée.</p>
      )}
      {connected && rows.length > 0 && <Link className="activity-more" to="/app/analyses">Voir l’activité <ArrowRight size={14} /></Link>}
    </section>
  );
}
