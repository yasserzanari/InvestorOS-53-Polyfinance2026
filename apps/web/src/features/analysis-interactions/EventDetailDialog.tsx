import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, Check, ChevronRight, Clock3, Compass, ExternalLink, FileText, GitBranch, Globe2, Info, Landmark, Network, Newspaper, Search, Sparkles, X } from 'lucide-react';
import type { ResearchRun } from '../profiles/research-workspace';
import { fullDate, preciseDate, sourceUrl } from './presentation';
import { EventVisual, eventCategory } from './EventVisual';
import { MovementEvidence } from './MarketMoves';
import type { MovementInvestigation } from './movement-investigation-api';
import { buildEventDetail, type EventDetailSource } from './event-detail-model';
import type { ExplorationTarget } from './types';
import './event-detail-dialog.css';

function PublisherMark({ source }: { source: EventDetailSource }) {
  const [failed, setFailed] = useState(false);
  const Icon = source.official ? Landmark : Globe2;
  return <span className={`ed-publisher-mark${source.logoKey === 'nvidia' ? ' is-nvidia' : ''}`} aria-hidden="true">
    {source.logoKey === 'nvidia' && !failed ? <img src="/publishers/nvidia.ico" alt="" onError={() => setFailed(true)} /> : <Icon size={21} />}
  </span>;
}

function EventSourceCard({ source, compact = false }: { source: EventDetailSource; compact?: boolean }) {
  const url = sourceUrl(source.url);
  return <article className={`ed-source-card${compact ? ' is-compact' : ''}`}>
    <div className="ed-source-identity"><PublisherMark source={source} /><div><strong>{source.publisher}</strong><span>{source.typeLabel}</span></div>{source.official && <span className="ed-source-type">Source officielle</span>}</div>
    <h4>{source.title}</h4>
    {source.excerpt && <p className="ed-source-excerpt">{source.excerpt}</p>}
    <dl className="ed-source-dates">{source.publishedAt && <div><dt>Publication</dt><dd>{preciseDate(source.publishedAt)}</dd></div>}{!compact && source.collectedAt && <div><dt>Consultation</dt><dd>{preciseDate(source.collectedAt)}</dd></div>}</dl>
    {url ? <a className="ed-read-source" href={url} target="_blank" rel="noreferrer"><ExternalLink size={15} />Lire la source</a> : <p className="ed-source-missing">Lien d’origine non fourni.</p>}
    {!compact && source.text && <details className="ed-source-text"><summary>Consulter l’extrait reçu</summary><p>{source.text}</p></details>}
  </article>;
}

const cardIcons = { calendar: CalendarDays, clock: Clock3, published: Newspaper, value: FileText };
type DetailTab = 'summary' | 'text' | 'sources';

export function EventDetailDialog({ target, events, run, ticker, onClose, onSelectTarget, onSimulate, onDependencies }: {
  target: ExplorationTarget | null; events: ExplorationTarget[]; run: ResearchRun; ticker?: string;
  onClose: () => void; onSelectTarget: (target: ExplorationTarget) => void; onSimulate: (target: ExplorationTarget) => void; onDependencies: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const [tab, setTab] = useState<DetailTab>('summary');
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [failedImage, setFailedImage] = useState<string>();
  const [investigation, setInvestigation] = useState<{ targetId: string; result: MovementInvestigation }>();
  const id = useId();
  const open = Boolean(target);
  const detail = useMemo(() => {
    if (!target) return null;
    const base = buildEventDetail(target, events, run);
    if (!target.movement || investigation?.targetId !== target.id) return base;
    const extra: EventDetailSource[] = investigation.result.documents.map(document => ({ id: document.id, title: document.title, publisher: document.sourceName, url: document.url, excerpt: document.excerpt, text: document.excerpt, publishedAt: document.publishedAt, official: ['nvidia-investor-relations', 'sec-edgar', 'sec-companyfacts', 'fed-calendar', 'bls-calendar'].includes(document.sourceId), typeLabel: document.documentRole === 'calendar_only' ? 'Annonce de calendrier · contexte' : 'Document lu · contexte', ...(document.sourceId === 'nvidia-investor-relations' ? { logoKey: 'nvidia' as const } : {}) }));
    const sources = [...extra, ...base.sources].filter((source, index, list) => list.findIndex(item => item.url === source.url) === index);
    return { ...base, sources, facts: [], text: sources.map(source => `${source.title}\n${source.text || source.excerpt || ''}`).join('\n\n') };
  }, [target, events, run, investigation]);
  useEffect(() => {
    if (!open) return;
    origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); if (origin.current?.isConnected) origin.current.focus({ preventScroll: true }); };
  }, [open]);
  useEffect(() => {
    setTab('summary'); setExpanded(false); setQuery('');
    body.current?.scrollTo({ top: 0 });
  }, [target?.id]);
  const showTab = (next: DetailTab) => { setTab(next); };
  const moveTab = (event: React.KeyboardEvent<HTMLButtonElement>, current: DetailTab) => {
    const tabs: DetailTab[] = ['summary', 'text', 'sources'];
    const index = tabs.indexOf(current);
    const next = event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length] : event.key === 'ArrowLeft' ? tabs[(index + 2) % tabs.length] : event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[2] : null;
    if (next) { event.preventDefault(); setTab(next); document.getElementById(`${id}-tab-${next}`)?.focus(); }
  };
  const related = detail?.related.filter(item => `${item.title} ${item.source?.publisher || ''} ${fullDate(item.date)}`.toLocaleLowerCase('fr-CA').includes(query.toLocaleLowerCase('fr-CA'))) || [];
  const image = sourceUrl(target?.imageUrl);
  return <dialog ref={dialog} className="aj-dialog event-detail-dialog" aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
  }}>
    {target && detail && <>
      <header className="ed-header"><div className="ed-category"><EventVisual target={{ ...target, imageUrl: undefined }} /><span>{eventCategory(target).label}</span>{(target.ticker || ticker) && <span className="ed-ticker">{target.ticker || ticker}</span>}</div><button type="button" className="ed-close" aria-label="Fermer la fiche" onClick={onClose}><X size={22} /></button></header>
      <div ref={body} className="ed-body">
        <div className="ed-hero"><h2 id={`${id}-title`} ref={heading} tabIndex={-1}>{detail.title}</h2>{detail.subtitle && <p>{detail.subtitle}</p>}</div>
        {!!detail.cards.length && <dl className="ed-cards">{detail.cards.slice(0, 3).map(card => { const Icon = cardIcons[card.kind]; return <div key={card.id}><Icon size={23} /><div><dt>{card.label}</dt><dd>{card.value}</dd>{card.detail && <small>{card.detail}</small>}</div></div>; })}</dl>}
        <div className="ed-layout">
          <main className="ed-main">
            <div className="ed-tabs" role="tablist" aria-label="Détails de l’événement">{([{ id: 'summary', label: 'À retenir' }, { id: 'text', label: 'Texte reçu' }, { id: 'sources', label: 'Sources associées' }] as const).map(item => <button type="button" id={`${id}-tab-${item.id}`} role="tab" key={item.id} aria-selected={tab === item.id} aria-controls={`${id}-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onKeyDown={event => moveTab(event, item.id)} onClick={() => showTab(item.id)}>{item.label}{item.id === 'sources' && <span>{detail.sources.length}</span>}</button>)}</div>
            <section id={`${id}-panel-summary`} role="tabpanel" aria-labelledby={`${id}-tab-summary`} hidden={tab !== 'summary'} tabIndex={0} className="ed-panel">
              {image && failedImage !== image && <img className="ed-event-image" src={image} alt="Visuel fourni avec l’événement" referrerPolicy="no-referrer" onError={() => setFailedImage(image)} />}
              <h3><FileText size={21} />{target.kind === 'movement' ? 'Pourquoi ce mouvement ?' : target.kind === 'point' ? 'Lire ce point du graphique' : target.kind === 'conclusion' ? 'Ce que dit l’analyse' : 'Ce que dit la source'}</h3>
              {target.movement && <MovementEvidence target={target} onExplore={onSelectTarget} onInvestigation={result => setInvestigation({ targetId: target.id, result })} />}
              {!!detail.facts.length && <ul className="ed-facts">{detail.facts.slice(0, 3).map((fact, index) => <li key={index}><span className="ed-fact-icon"><Check size={12} /></span><p>{fact.text}</p></li>)}</ul>}
              {detail.facts.length > 3 && <details className="ed-extra-facts"><summary>{detail.facts.length - 3} précision{detail.facts.length > 4 ? 's' : ''} supplémentaire{detail.facts.length > 4 ? 's' : ''}</summary><ul className="ed-facts">{detail.facts.slice(3).map((fact, index) => <li key={index}><span className="ed-fact-icon"><Check size={12} /></span><p>{fact.text}</p></li>)}</ul></details>}
              {detail.cards.length > 3 && <dl className="ed-additional-metrics">{detail.cards.slice(3).map(card => { const Icon = cardIcons[card.kind]; return <div key={card.id}><Icon size={17} /><div><dt>{card.label}</dt><dd>{card.value}</dd>{card.detail && <small>{card.detail}</small>}</div></div>; })}</dl>}
              <div className="ed-note"><Info size={19} /><div><strong>À distinguer</strong><p>{detail.note}</p></div></div>
              {!!detail.related.length && <section className="ed-related"><h3><CalendarDays size={21} />Autres événements de l’analyse <span className="ed-count">{detail.related.length}</span></h3>
                {expanded && <label className="ed-search"><Search size={15} /><input aria-label="Rechercher dans les événements" placeholder="Rechercher un événement, une source…" value={query} onChange={event => setQuery(event.target.value)} /></label>}
                <div className="ed-related-list">{related.slice(0, expanded ? related.length : 3).map(item => <button type="button" key={item.id} onClick={() => { onSelectTarget(item); requestAnimationFrame(() => heading.current?.focus({ preventScroll: true })); }}><EventVisual target={item} /><span><strong>{item.title}</strong><small>{item.dateLabel || fullDate(item.date)}{item.source?.publisher ? ` · ${item.source.publisher}` : ''}</small></span><ChevronRight size={17} /></button>)}</div>
                {!related.length && <p className="ed-empty">Aucun événement ne correspond à cette recherche.</p>}
                {detail.related.length > 3 && <button type="button" className="ed-more" onClick={() => { setExpanded(value => !value); setQuery(''); }}>{expanded ? 'Réduire la liste' : `Voir les ${detail.related.length} événements de l’analyse`}<ArrowRight size={14} /></button>}
              </section>}
            </section>
            <section id={`${id}-panel-text`} role="tabpanel" aria-labelledby={`${id}-tab-text`} hidden={tab !== 'text'} tabIndex={0} className="ed-panel"><h3><FileText size={21} />Texte reçu de la source</h3><p className="ed-text-label">Extrait reçu, dans sa langue d’origine. Il peut être tronqué ou contenir des répétitions de collecte.</p><div className="ed-raw-text">{detail.text || 'Aucun extrait de texte n’a été fourni pour cet élément.'}</div></section>
            <section id={`${id}-panel-sources`} role="tabpanel" aria-labelledby={`${id}-tab-sources`} hidden={tab !== 'sources'} tabIndex={0} className="ed-panel"><h3><BookOpen size={21} />Documents associés <span className="ed-count">{detail.sources.length}</span></h3><div className="ed-all-sources">{detail.sources.map(source => <EventSourceCard source={source} key={source.id} />)}</div>{!detail.sources.length && <p className="ed-empty">Aucune source liée n’a été fournie avec cet élément.</p>}</section>
          </main>
          <aside className="ed-sidebar" aria-label="Sources et exploration"><section className="ed-sidebar-sources"><h3><BookOpen size={21} />Sources de {target.kind === 'event' ? 'l’événement' : 'cet élément'} <span className="ed-count">{detail.sources.length}</span></h3>{detail.sources.slice(0, 1).map(source => <EventSourceCard key={source.id} source={source} compact />)}{detail.sources.length > 1 && <button type="button" className="ed-all-source-button" onClick={() => { setTab('sources'); document.getElementById(`${id}-tab-sources`)?.focus(); }}><BookOpen size={15} />Voir les {detail.sources.length} sources<ChevronRight size={15} /></button>}{!detail.sources.length && <p className="ed-empty">Source non fournie.</p>}</section>
            <section className="ed-explore"><h3><Compass size={21} />Explorer</h3><button type="button" onClick={onDependencies}><Network size={18} /><span>Voir les dépendances</span><ChevronRight size={16} /></button><Link to="/app/assistant" state={{ initialPrompt: `Approfondis ce point de l’analyse ${run.analysis_id} (${ticker || target.ticker || ''}) : ${target.title}. ${target.movement ? `Intervalle observé du ${target.movement.previousDate} au ${target.movement.date}. ` : target.dateLabel ? `Date de la source : ${target.dateLabel}. ` : target.date ? `Date : ${target.date}. ` : ''}${target.summary.slice(0, 600)}. Source : ${target.source?.url || 'preuve de l’analyse'}. Lis les documents autorisés disponibles et leurs horaires. Explique les faits, les mécanismes possibles et les contre-arguments, sans attribuer une cause certaine. Reste dans ce dossier existant et ne relance pas une nouvelle analyse pour cette lecture.` }} onClick={onClose}><Sparkles size={18} /><span>Approfondir avec l’Assistant</span><ChevronRight size={16} /></Link></section>
          </aside>
        </div>
      </div>
      <footer className="ed-footer"><p>Dates et informations attribuées à leur source</p><div><button type="button" className="ed-dismiss" onClick={onClose}>Fermer</button><button type="button" className="ed-simulate" onClick={() => onSimulate(target)}><GitBranch size={17} />Tester un scénario</button></div></footer>
    </>}
  </dialog>;
}
