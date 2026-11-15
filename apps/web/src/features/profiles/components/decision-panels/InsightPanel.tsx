import { useRef } from 'react';
import { ArrowUpRight, BookOpen, CircleHelp, MessageSquare, RefreshCw, Scale } from 'lucide-react';
import { fieldLabels, type FieldKey, type Profile } from '../../profile-model';
import { safeSourceUrl, type Citation } from '../../profile-api';
import type { InsightData } from './decision-data';
import { AlignmentProfile } from './AlignmentProfile';
import { assessAlignment, FINANCIAL_REFERENCES } from './alignment-review';
import './insight-panel.css';

const statuses = { tension: 'Point à discuter', clarification: 'À préciser', information: 'Interprétation', partial: 'Analyse partielle' };

export function InsightPanel({ data, profile, sources, onDiscuss, onChange, disabled, saveStatus }: {
  data: InsightData; profile: Profile; sources: Citation[]; onDiscuss: (prompt: string) => void;
  onChange: (field: FieldKey, value: string) => void; disabled: boolean; saveStatus?: string;
}) {
  const snapshot = data.profileSnapshot;
  const root = useRef<HTMLElement>(null);
  const stale = snapshot && Object.entries(snapshot).some(([key, value]) => profile[key as keyof Profile] !== value);
  const linked = data.evidenceIds.map(id => ({ id, source: sources.find(source => source.id === id) }));
  const issues = assessAlignment(profile);
  const conflicts = issues.filter(issue => issue.kind === 'conflict');
  const discussion = `Examinons ce constat : ${data.question}. Relis mon profil actuel, distingue les déclarations, les interprétations et les inconnues, puis actualise Alignement sans supposer mes réponses.`;
  const summary = <><p>{data.summary}</p><button type="button" disabled={disabled} className="di-discuss" onClick={() => onDiscuss(discussion)}><MessageSquare size={13}/>Discuter ce constat</button></>;
  return <article ref={root} className="decision-insight" aria-labelledby="insight-heading">
    <header className="di-heading"><span className="di-symbol"><Scale size={20}/></span><h2 id="insight-heading">{data.title}</h2></header>
    <div className="di-meta"><span className={`di-status di-status-${data.status}`}><span>{statuses[data.status]}</span></span>{conflicts.length > 0 && <button type="button" className="di-conflict-count" onClick={() => { const trigger = root.current?.querySelector<HTMLButtonElement>('.di-profile-row .di-issue-trigger.is-conflict'); trigger?.scrollIntoView({ block: 'nearest' }); trigger?.focus(); trigger?.click(); }}>{conflicts.length} incohérence{conflicts.length > 1 ? 's' : ''} à clarifier</button>}</div>
    {stale || conflicts.length > 0 ? <details className="di-previous-summary"><summary>{stale ? 'Synthèse précédente' : 'Synthèse à examiner après clarification'}</summary>{summary}</details> : <section className="di-summary" aria-label="Synthèse">{summary}</section>}
    {stale && <div className="di-stale" role="status"><RefreshCw size={15}/><span>Votre profil a changé depuis cette synthèse.</span><button type="button" disabled={disabled} onClick={() => onDiscuss('Actualise la carte Alignement avec mon profil actuel et les preuves disponibles, en conservant les inconnues.')}>Actualiser</button></div>}
    <AlignmentProfile profile={profile} fields={data.fields} issues={issues} onChange={onChange} onDiscuss={onDiscuss} disabled={disabled} saveStatus={saveStatus}/>
    {data.portfolioBasis && <section className="di-basis"><div className="di-section-heading"><h3>{data.portfolioBasis.portfolioName}</h3><span>{data.portfolioBasis.currency}</span></div><ul>{data.portfolioBasis.positions.map((position, i) => <li key={`${position.label}-${i}`}><button type="button" disabled={disabled} onClick={() => onDiscuss(`Explique la catégorie « ${position.label} » affichée à ${position.weightPct} % dans cette carte Alignement. Vérifie les expositions actuelles du portefeuille avant de conclure et distingue les catégories déclarées de leur composition sous-jacente inconnue.`)}><span>{position.label}</span><strong>{position.weightPct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %</strong><MessageSquare size={12}/></button></li>)}</ul><p className="di-footnote">Catégories déclarées, sans composition sous-jacente.</p></section>}
    {data.limits.length > 0 && <details className="di-limits"><summary><CircleHelp size={15}/>Limites de ce constat<span>{data.limits.length}</span></summary><ul>{data.limits.map((limit, index) => <li key={index}>{limit}</li>)}</ul><button type="button" className="di-discuss" disabled={disabled} onClick={() => onDiscuss(`Explique ces limites de la carte Alignement et ce qu’elles changent pour mon projet : ${data.limits.join('; ')}. Vérifie le profil actuel avant de répondre.`)}><MessageSquare size={13}/>Comprendre les limites</button></details>}
    {data.alternatives.length > 0 && <section className="di-options" aria-labelledby="di-options-heading"><div className="di-section-heading"><h3 id="di-options-heading">Pistes à explorer</h3><span>Continuer dans le chat</span></div>{data.alternatives.map((option, index) => <button type="button" key={index} disabled={disabled || Boolean(stale)} onClick={() => onDiscuss(`Examinons cette piste : ${option}. Contexte : ${data.question}. Explique les compromis, les preuves et les inconnues, puis actualise la carte Alignement.`)}><span className="di-option-number">{String(index + 1).padStart(2, '0')}</span><span>{option}</span><ArrowUpRight size={16}/></button>)}</section>}
    {data.nextQuestion && <section className="di-question"><CircleHelp size={19}/><div><h3>Pour préciser votre analyse</h3><p>{data.nextQuestion}</p><button type="button" disabled={disabled} onClick={() => onDiscuss(`Aide-moi à préciser cette question dans le chat, sans supposer ma réponse : ${data.nextQuestion}`)}>Répondre dans le chat</button></div></section>}
    <details className="di-evidence"><summary><BookOpen size={15}/>Sources & contexte<span>{data.evidenceIds.length ? `${data.evidenceIds.length} référence${data.evidenceIds.length > 1 ? 's' : ''}` : 'Profil uniquement'}</span></summary><p className="di-original-question">{data.question}</p>{linked.length ? <ul>{linked.map(({ id, source }) => <li key={id}>{source && safeSourceUrl(source.url) !== '#' ? <a href={safeSourceUrl(source.url)} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={13}/></a> : <span>Référence indisponible dans cette conversation : {id}</span>}</li>)}</ul> : <p>Aucune preuve de marché liée à ce constat. Les références ci-dessous expliquent la méthode de lecture du profil; elles ne corroborent pas vos déclarations.</p>}<h4>Fondements de la revue</h4><ul>{Object.values(FINANCIAL_REFERENCES).map(reference => <li key={reference.id}><a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.title}<ArrowUpRight size={12}/></a></li>)}</ul><p>Revue éducative de déclarations, sans évaluation exhaustive de convenance.</p>{snapshot ? <details className="di-snapshot"><summary>Réponses utilisées lors de la synthèse</summary><dl>{data.fields.map(field => <div key={field}><dt>{fieldLabels[field]}</dt><dd>{snapshot[field] || 'À préciser'}</dd></div>)}</dl></details> : <p>Le profil au moment de la synthèse n’a pas été conservé.</p>}</details>
  </article>;
}
