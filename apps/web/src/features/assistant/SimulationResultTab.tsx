import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, GitBranch, ShieldCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { parseSimulationProjection, simulationEventOffset, simulationHorizon, simulationPointOffset, type SimulationProjection, type SimulationProjectionInput } from '../../shared/api';
import type { ExploreHandler, ExplorationTarget } from '../analysis-interactions/types';
import { safeSourceUrl } from '../profiles/profile-api';
import { ScenarioMarketChart } from './ScenarioMarketChart';
import { ProjectionParameters } from './ProjectionParameters';
import { scenarioEventTarget, scenarioMoney as number, scenarioOffsetLabel as offsetLabel, scenarioPointTarget, scenarioSourceTarget } from './scenario-exploration';
import './simulation-result-tab.css';

function readProjection(content: string) { try { return parseSimulationProjection(JSON.parse(content)); } catch { return null; } }
const colors = ['#2866dc', '#278b7e', '#be862b', '#8960c1'];
export function SimulationResultTab({ content, onExplore, onProjectionChange, onTargets, controlled = false, onProjectionRequest, onParametersDirty }: { content: string; onExplore?: ExploreHandler; onProjectionChange?: (content: string) => void; onTargets?: (targets: ExplorationTarget[]) => void; controlled?: boolean; onProjectionRequest?: (input: SimulationProjectionInput, signal: AbortSignal) => Promise<SimulationProjection>; onParametersDirty?: (dirty: boolean) => void }) {
  const [localResult, setLocalResult] = useState<{ input: string; result: SimulationProjection } | null>(null);
  const fromContent = useMemo(() => readProjection(content), [content]);
  const projection = !controlled && localResult?.input === content ? localResult.result : fromContent;
  const [localTarget, setLocalTarget] = useState<ExplorationTarget | null>(null);
  const [dirty, setDirty] = useState(false);
  const explore: ExploreHandler = target => { if (onExplore) onExplore(target); else setLocalTarget(target); };
  const targets = useMemo(() => {
    if (!projection || dirty) return [];
    const candidates = projection.branches.flatMap(branch => [
      ...branch.path.map(point => scenarioPointTarget(projection, branch, point)),
      scenarioEventTarget(projection, branch),
      ...(branch.sourceUrl && safeSourceUrl(branch.sourceUrl) !== '#' ? [scenarioSourceTarget(projection, 'Source de l’hypothèse', safeSourceUrl(branch.sourceUrl), true)] : []),
    ]);
    const url = projection.provenance?.sourceUrl || projection.sourceUrl;
    if (url && safeSourceUrl(url) !== '#') candidates.push(scenarioSourceTarget(projection, projection.source, safeSourceUrl(url)));
    return candidates.filter((target, index) => candidates.findIndex(other => other.id === target.id) === index);
  }, [projection, dirty]);
  useEffect(() => { onTargets?.(targets); }, [targets, onTargets]);
  useEffect(() => { setDirty(false); setLocalTarget(null); }, [content]);

  if (!projection) return <p className="assistant-scenario-invalid" role="status">Le résultat de simulation enregistré est illisible ou ses unités sont incohérentes. Relancez le calcul depuis l’Assistant.</p>;
  const moduleUrl = typeof projection.provenance?.moduleUrl === 'string' ? projection.provenance.moduleUrl : `/app/scenarios?ticker=${encodeURIComponent(projection.ticker)}`;
  const sourceUrl = typeof projection.provenance?.sourceUrl === 'string' ? projection.provenance.sourceUrl : typeof projection.sourceUrl === 'string' ? projection.sourceUrl : undefined;
  const classification = projection.sourceClassification === 'illustrative' ? 'Jeu historique illustratif / fictif' : projection.sourceClassification === 'observations' ? 'Observations historiques' : 'Classification du jeu non confirmée';
  const resultKey = `${projection.ticker}:${projection.asOf}:${projection.timeUnit || 'observations'}:${simulationHorizon(projection)}:${JSON.stringify(projection.branches)}`;
  return <section className="assistant-scenario-result" aria-label={`Trajectoires conditionnelles pour ${projection.ticker}`}>
    <header className="assistant-scenario-summary"><span className="assistant-scenario-icon"><GitBranch size={18} aria-hidden="true"/></span><div><h2>{projection.ticker} · {projection.branches.length === 1 ? 'hypothèse conditionnelle' : 'hypothèses comparées'}</h2><p>Dernier cours du jeu : <strong>{number(projection.startingPrice, projection.currency)}</strong> au {projection.asOf} · horizon {offsetLabel(projection, simulationHorizon(projection))}</p><p>{classification} · cours de départ historique, pas une cotation en temps réel.</p></div></header>
    <ProjectionParameters key={resultKey} projection={projection} onRequest={onProjectionRequest} onDirtyChange={value => { setDirty(value); onParametersDirty?.(value); }} onApply={result => { if (!controlled) setLocalResult({ input: content, result }); setDirty(false); setLocalTarget(null); onProjectionChange?.(JSON.stringify(result)); }}/>
    {dirty ? <div className="assistant-scenario-stale" role="status"><GitBranch size={20}/><strong>Recalcul nécessaire</strong><p>Les paramètres ont changé. Les anciennes courbes sont masquées jusqu’au résultat du calcul; utilisez « Rétablir » pour les retrouver.</p></div> : <>
      <div className="assistant-scenario-branches">{projection.branches.map((branch, index) => {
        const end = branch.path[branch.path.length - 1];
        const branchSource = typeof branch.sourceUrl === 'string' ? safeSourceUrl(branch.sourceUrl) : undefined;
        return <article className="assistant-scenario-branch" key={`${resultKey}:${branch.id}`} data-branch-index={index} style={{ borderTopColor: colors[index] }}><div className="assistant-scenario-branch-title"><div><h3>{branch.title}</h3><button type="button" className="assistant-scenario-event-button" onClick={() => explore(scenarioEventTarget(projection, branch))}><span className="assistant-scenario-event-tag">Hypothèse</span>{branch.event}<ExternalLink size={12}/></button><p>Choc explicite <strong>{branch.shockPct > 0 ? '+' : ''}{branch.shockPct.toLocaleString('fr-CA')} %</strong> après {offsetLabel(projection, simulationEventOffset(branch))}</p>{branchSource && branchSource !== '#' && <div className="assistant-scenario-branch-source"><button type="button" onClick={() => explore(scenarioSourceTarget(projection, 'Source de l’hypothèse', branchSource, true))}>Examiner la source</button><a href={branchSource} target="_blank" rel="noreferrer" aria-label={`Ouvrir la source de ${branch.title}`}><ExternalLink size={12}/></a></div>}</div></div>
          <ScenarioMarketChart branch={branch} projection={projection} color={colors[index]} onExplore={explore}/>
          <dl className="assistant-scenario-quantiles">{[{ label: '10e percentile', value: end.lowerPrice }, { label: 'Médiane', value: end.medianPrice }, { label: '90e percentile', value: end.upperPrice }].map(item => <div key={item.label}><dt>{item.label} · horizon final</dt><dd><button type="button" onClick={() => explore(scenarioPointTarget(projection, branch, end))}>{number(item.value, projection.currency)}<ExternalLink size={11}/></button></dd></div>)}</dl>
          <details className="assistant-scenario-values"><summary>Valeurs exactes et jalons du calcul</summary><div><table><caption>Quantiles marginaux conditionnels · {projection.currency}</caption><thead><tr><th>Jalon</th><th>Choc</th><th>10e</th><th>Médiane</th><th>90e</th></tr></thead><tbody>{branch.path.map(point => <tr key={simulationPointOffset(point)}><th><button type="button" onClick={() => explore(scenarioPointTarget(projection, branch, point))}>+{offsetLabel(projection, simulationPointOffset(point))}<ExternalLink size={10}/></button></th><td>{point.eventApplied ? 'Appliqué' : 'Non appliqué'}</td><td>{number(point.lowerPrice, projection.currency)}</td><td>{number(point.medianPrice, projection.currency)}</td><td>{number(point.upperPrice, projection.currency)}</td></tr>)}</tbody></table></div></details>
        </article>;
      })}</div>
      {localTarget && <section className="assistant-scenario-local-detail" aria-label="Fiche du jalon sélectionné"><div><h3>{localTarget.title}</h3><button type="button" aria-label="Fermer la fiche" onClick={() => setLocalTarget(null)}><X size={14}/></button></div><p>{localTarget.summary}</p><dl>{localTarget.metrics?.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>{localTarget.source && <a href={safeSourceUrl(localTarget.source.url)} target="_blank" rel="noreferrer">{localTarget.source.title} ↗</a>}</section>}
      <details className="assistant-scenario-method"><summary><ShieldCheck size={15}/>Méthode, sources et limites</summary><p>{projection.method}</p>{projection.validation&&<p>Validation chronologique : {projection.validation.trainingReturns} rendements d’ajustement · {projection.validation.holdoutWindows} fenêtres de contrôle · couverture empirique p10–p90 : {projection.validation.empiricalCoveragePct??"indisponible"} %. Ce diagnostic ne garantit pas la couverture future.</p>}<ul>{projection.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul><p className="assistant-scenario-source">Source : {projection.source} · {classification}</p>{projection.sourceDescription && <p>{projection.sourceDescription}</p>}</details>
      <nav className="assistant-scenario-links" aria-label="Ouvrir les données de la simulation">{moduleUrl && safeSourceUrl(moduleUrl) !== '#' && <Link to={safeSourceUrl(moduleUrl)}><ExternalLink size={13}/>Ouvrir {projection.ticker} dans Simulation</Link>}{sourceUrl && safeSourceUrl(sourceUrl) !== '#' && <><button type="button" onClick={() => explore(scenarioSourceTarget(projection, projection.source, safeSourceUrl(sourceUrl)))}>Examiner la source du jeu</button><a href={safeSourceUrl(sourceUrl)} target="_blank" rel="noreferrer"><ExternalLink size={13}/>Historique du fournisseur</a></>}</nav>
    </>}
  </section>;
}
