import { ArrowUpRight, BookOpen, CircleHelp, RefreshCw, Scale, TriangleAlert } from 'lucide-react';
import { fieldLabels, type Profile } from '../../profile-model';
import { safeSourceUrl, type Citation } from '../../profile-api';
import type { InsightData } from './decision-data';
import './insight-panel.css';

const statuses = { tension: 'Point à discuter', clarification: 'À préciser', information: 'Interprétation', partial: 'Analyse partielle' };

export function InsightPanel({ data, profile, sources, onDiscuss, disabled }: {
  data: InsightData; profile: Profile; sources: Citation[]; onDiscuss: (prompt: string) => void; disabled: boolean;
}) {
  const snapshot = data.profileSnapshot;
  const stale = snapshot && Object.entries(snapshot).some(([key, value]) => profile[key as keyof Profile] !== value);
  const linked = data.evidenceIds.map(id => ({ id, source: sources.find(source => source.id === id) }));
  return <article className="decision-insight" aria-labelledby="insight-heading">
    <header className="di-heading"><span className="di-symbol"><Scale size={23}/></span><div><p>Votre profil & cette question</p><h2 id="insight-heading">{data.title}</h2></div></header>
    <div className="di-meta"><span className={`di-status di-status-${data.status}`}><span>{statuses[data.status]}</span></span><span>Lecture du contexte</span></div>
    <section className="di-summary" aria-label="Synthèse"><p>{data.summary}</p></section>
    {stale && <div className="di-stale" role="status"><RefreshCw size={15}/><span>Votre profil a changé depuis cette synthèse.</span><button type="button" disabled={disabled} onClick={() => onDiscuss('Actualise la carte Alignement avec mon profil actuel et les preuves disponibles, en conservant les inconnues.')}>Actualiser</button></div>}
    <section className="di-context" aria-labelledby="di-context-heading"><div className="di-section-heading"><h3 id="di-context-heading">Les repères de votre profil</h3><span>{snapshot ? 'Lors de l’analyse' : 'Profil actuel'}</span></div>
      <dl className="di-facts">{data.fields.map(key => <div key={key}><dt>{fieldLabels[key]}</dt><dd>{(snapshot ? snapshot[key] : profile[key])?.trim() || 'À préciser'}</dd></div>)}</dl>
      {!snapshot && <p className="di-footnote">Le profil au moment de l’analyse n’a pas été conservé.</p>}
    </section>
    {data.portfolioBasis && <section className="di-basis"><div className="di-section-heading"><h3>{data.portfolioBasis.portfolioName}</h3><span>{data.portfolioBasis.currency}</span></div><dl>{data.portfolioBasis.positions.map((position, i) => <div key={`${position.label}-${i}`}><dt>{position.label}</dt><dd>{position.weightPct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %</dd></div>)}</dl><p className="di-footnote">Catégories déclarées, sans composition sous-jacente.</p></section>}
    {data.limits.length > 0 && <section className="di-limits" aria-labelledby="di-limits-heading"><h3 id="di-limits-heading"><TriangleAlert size={16}/>Points à vérifier</h3><ul>{data.limits.map((limit, index) => <li key={index}>{limit}</li>)}</ul></section>}
    {data.alternatives.length > 0 && <section className="di-options" aria-labelledby="di-options-heading"><div className="di-section-heading"><h3 id="di-options-heading">Pistes à explorer</h3><span>Continuer dans le chat</span></div>{data.alternatives.map((option, index) => <button type="button" key={index} disabled={disabled || Boolean(stale)} onClick={() => onDiscuss(`Examinons cette piste : ${option}. Contexte : ${data.question}. Explique les compromis, les preuves et les inconnues, puis actualise la carte Alignement.`)}><span className="di-option-number">{String(index + 1).padStart(2, '0')}</span><span>{option}</span><ArrowUpRight size={16}/></button>)}</section>}
    {data.nextQuestion && <section className="di-question"><CircleHelp size={19}/><div><h3>Pour préciser votre analyse</h3><p>{data.nextQuestion}</p><button type="button" disabled={disabled} onClick={() => onDiscuss(`Aide-moi à préciser cette question dans le chat, sans supposer ma réponse : ${data.nextQuestion}`)}>Répondre dans le chat</button></div></section>}
    <details className="di-evidence"><summary><BookOpen size={15}/>Sources & contexte<span>{data.evidenceIds.length ? `${data.evidenceIds.length} référence${data.evidenceIds.length > 1 ? 's' : ''}` : 'Profil uniquement'}</span></summary><p className="di-original-question">{data.question}</p>{linked.length ? <ul>{linked.map(({ id, source }) => <li key={id}>{source && safeSourceUrl(source.url) !== '#' ? <a href={safeSourceUrl(source.url)} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={13}/></a> : <span>Référence indisponible dans cette conversation : {id}</span>}</li>)}</ul> : <p>Aucune preuve externe liée à ce constat. Cette interprétation ne confirme pas la convenance d’un placement.</p>}</details>
  </article>;
}
