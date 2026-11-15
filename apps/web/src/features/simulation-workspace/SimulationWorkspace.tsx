import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronRight, GitBranch, LoaderCircle, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { runAnalysisForecast, simulationHorizon, simulationPointOffset, type ObservationBranchInput, type SimulationProjection } from '../../shared/api';
import { EventVisual } from '../analysis-interactions/EventVisual';
import { SourceDetailsButton } from '../analysis-interactions/SourceDetailsButton';
import { fullDate, sourceUrl } from '../analysis-interactions/presentation';
import type { ExplorationTarget } from '../analysis-interactions/types';
import { scenarioEventTarget, scenarioMoney, scenarioPointTarget } from '../assistant/scenario-exploration';
import { branchColors, SimulationComparisonChart } from './SimulationComparisonChart';
import './simulation-workspace.css';

const reference: ObservationBranchInput = { id: 'reference', title: 'Référence historique', event: 'Aucun choc ajouté', shockPct: 0, eventAfterObservations: 0 };
const percent = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('fr-CA', { maximumFractionDigits: 2 })} %`;
function initialBranches(projection: SimulationProjection | null): ObservationBranchInput[] {
  if (!projection || projection.timeUnit === 'calendar_days') return [reference];
  return [reference, ...projection.branches.filter(branch => branch.id !== 'reference').slice(0, 3).map(branch => ({ id: branch.id, title: branch.title, event: branch.event, shockPct: branch.shockPct, sourceUrl: branch.sourceUrl, eventAfterObservations: branch.eventAfterObservations }))];
}

export function SimulationWorkspace({ ticker, projection, events, seed, onProjectionChange, onExplore }: {
  ticker: string; projection: SimulationProjection | null; events: ExplorationTarget[]; seed: ExplorationTarget | null;
  onProjectionChange: (result: SimulationProjection) => void; onExplore: (target: ExplorationTarget) => void;
}) {
  const [horizon, setHorizon] = useState(projection && projection.timeUnit !== 'calendar_days' ? simulationHorizon(projection) : 5);
  const [branches, setBranches] = useState(() => initialBranches(projection));
  const [selectedId, setSelectedId] = useState('reference');
  const [result, setResult] = useState<SimulationProjection | null>(projection?.timeUnit === 'calendar_days' ? null : projection);
  const [completed, setCompleted] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const latestSave = useRef(onProjectionChange);
  latestSave.current = onProjectionChange;
  const appliedSeed = useRef<string | null>(null);
  const serial = useRef(0);
  const request = useMemo(() => ({ ticker, horizonObservations: horizon, branches: branches.map(branch => ({ ...branch, title: branch.title.trim(), event: branch.event.trim() })) }), [ticker, horizon, branches]);
  const signature = JSON.stringify(request);
  const pending = signature !== completed;
  const selected = branches.find(branch => branch.id === selectedId) ?? branches[0];
  const selectedEvent = events.find(event => event.title.slice(0, 160) === selected.event && (!selected.sourceUrl || event.source?.url === selected.sourceUrl));
  const update = (change: Partial<ObservationBranchInput>) => setBranches(items => items.map(branch => branch.id === selected.id ? { ...branch, ...change } : branch));

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    if (branches.some(branch => !branch.title.trim())) { setError('Donne un nom à chaque scénario pour actualiser les courbes.'); return; }
    const timer = setTimeout(() => {
      void runAnalysisForecast(request, controller.signal).then(value => {
        if (controller.signal.aborted) return;
        setResult(value); setCompleted(signature); latestSave.current(value);
      }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Calcul indisponible.'); });
    }, 450);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [request, signature, revision]);

  useEffect(() => {
    if (!seed || appliedSeed.current === seed.id) return;
    appliedSeed.current = seed.id;
    const existing = branches.find(branch => branch.event === seed.title.slice(0, 160) && (!seed.source?.url || branch.sourceUrl === sourceUrl(seed.source.url)));
    if (existing) { setSelectedId(existing.id); return; }
    const id = `scenario-${Date.now()}-${++serial.current}`;
    if (branches.length >= 4) { setNotice('Trois hypothèses sont déjà ouvertes. Supprime un scénario pour tester cet événement.'); return; }
    setNotice('');
    setBranches(items => [...items, { id, title: 'Événement à tester', event: seed.title.slice(0, 160), shockPct: 0, eventAfterObservations: Math.min(1, horizon), sourceUrl: sourceUrl(seed.source?.url) }]);
    setSelectedId(id);
  }, [seed, branches, horizon]);

  function addBranch() {
    if (branches.length >= 4) return;
    setNotice('');
    const id = `scenario-${Date.now()}-${++serial.current}`;
    setBranches(items => [...items, { id, title: `Scénario ${items.length}`, event: 'Variation hypothétique choisie par l’utilisateur', shockPct: 0, eventAfterObservations: 1 }]);
    setSelectedId(id);
  }
  function changeHorizon(value: number) {
    setHorizon(value);
    setBranches(items => items.map(branch => ({ ...branch, eventAfterObservations: Math.min(value, branch.eventAfterObservations) })));
  }
  const selectedResult = result?.branches.find(branch => branch.id === selected.id);
  return <section className="sw-root" aria-label={`Simulations de ${ticker}`}>
    <header className="sw-heading"><div><span className="sw-eyebrow"><GitBranch size={14} /> LABORATOIRE DE SCÉNARIOS</span><h3>Et si le cours de {ticker} changeait ?</h3><p>Compare une référence historique à tes propres hypothèses.</p></div><div className="sw-horizon" role="group" aria-label="Horizon de simulation">{[...new Set([5, 20, 60, horizon])].sort((a, b) => a - b).map(value => <button type="button" key={value} aria-pressed={horizon === value} onClick={() => changeHorizon(value)}>{value} séances</button>)}</div></header>
    <div className="sw-board" aria-busy={pending && !error}>
      <div className="sw-board-heading"><div><span>Point de départ du calcul</span><strong>{result ? scenarioMoney(result.startingPrice, result.currency) : 'Chargement…'}</strong><small>{result ? `Dernière clôture du jeu · ${fullDate(result.asOf)}` : 'Lecture de l’historique disponible'}</small></div><span className={`sw-calculation ${error ? 'is-error' : ''}`} role="status">{error ? 'Calcul non actualisé' : pending ? <><LoaderCircle size={13} className="sw-spin" />Recalcul des trajectoires…</> : 'Trajectoires actualisées'}</span></div>
      {error && <div className="sw-error" role="alert"><span>{error} {result ? 'Les courbes affichent le dernier calcul réussi.' : ''}</span><button type="button" onClick={() => setRevision(value => value + 1)}><RotateCcw size={14} />Réessayer</button></div>}
      {result ? <div className={pending ? 'sw-output is-stale' : 'sw-output'}><SimulationComparisonChart projection={result} selectedId={selected.id} disabled={pending} onExplore={onExplore} /></div> : <div className="sw-chart-skeleton" role="status"><GitBranch size={28} /><p>{error ? 'Les trajectoires apparaîtront après un calcul réussi.' : 'Calcul de la référence à partir des cours historiques…'}</p></div>}
      <div className={`sw-cards${branches.length > 1 ? ' has-comparisons' : ''}${pending ? ' is-stale' : ''}`} style={{ '--scenario-count': branches.length } as React.CSSProperties}>{branches.map((branch, index) => {
        const calculated = result?.branches.find(item => item.id === branch.id);
        const end = calculated?.path.at(-1);
        const baseline = result?.branches.find(item => item.id === 'reference')?.path.at(-1);
        const change = end && result ? 100 * (end.medianPrice / result.startingPrice - 1) : null;
        return <button key={branch.id} type="button" className={`sw-scenario ${selected.id === branch.id ? 'is-selected' : ''}`} aria-pressed={selected.id === branch.id} onClick={() => setSelectedId(branch.id)} style={{ '--scenario-color': branchColors[index] } as React.CSSProperties}>
          <span className="sw-scenario-title"><i />{branch.title}</span><strong>{end && result ? scenarioMoney(end.medianPrice, result.currency) : 'À calculer'}</strong><span className="sw-scenario-change">{change !== null && (change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />)}{change === null ? 'Médiane à l’horizon choisi' : `${percent(change)} depuis le départ`}</span>
          <small>{end && result ? `p10–p90 : ${scenarioMoney(end.lowerPrice, result.currency)} – ${scenarioMoney(end.upperPrice, result.currency)}` : 'Fourchette disponible après calcul'}</small>
          <span className="sw-scenario-difference">{index === 0 ? 'Sans variation ajoutée' : end && baseline ? `${percent(100 * (end.medianPrice / baseline.medianPrice - 1))} vs référence` : `Hypothèse : ${percent(branch.shockPct)}`}</span>
        </button>;
      })}<button type="button" className="sw-add" onClick={addBranch} disabled={branches.length >= 4}><Plus size={21} /><strong>Ajouter un scénario</strong><span>{branches.length >= 4 ? '3 hypothèses maximum' : 'Choisis une variation à comparer'}</span></button></div>
    </div>
    {notice && <p className="sw-editor-note" role="status">{notice}</p>}
    <div className="sw-editor">
      <header><div><GitBranch size={16} /><h4>{selected.id === 'reference' ? 'Une base commune pour comparer' : 'Ajuster cette hypothèse'}</h4></div>{selected.id !== 'reference' && <button type="button" className="sw-remove" aria-label={`Supprimer ${selected.title}`} onClick={() => { setBranches(items => items.filter(branch => branch.id !== selected.id)); setSelectedId('reference'); }}><Trash2 size={14} />Supprimer</button>}</header>
      {selected.id === 'reference' ? <div className="sw-reference"><p>La référence rééchantillonne les variations historiques du titre. Ajoute un scénario pour voir l’effet d’une variation choisie, au moment de ton choix.</p><button type="button" className="sw-primary" onClick={addBranch} disabled={branches.length >= 4}><Plus size={15} />Tester une hypothèse</button></div> : <>
        <div className="sw-inputs"><label>Nom du scénario<input value={selected.title} maxLength={80} onChange={event => update({ title: event.target.value })} /></label><label>Événement associé<select value={selectedEvent?.id ?? ''} onChange={event => { const item = events.find(value => value.id === event.target.value); update({ event: item?.title.slice(0, 160) ?? 'Variation hypothétique choisie par l’utilisateur', sourceUrl: sourceUrl(item?.source?.url) }); }}><option value="">Hypothèse libre</option>{events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label></div>
        {selectedEvent ? <button type="button" className="sw-event" onClick={() => onExplore(selectedEvent)}><EventVisual target={selectedEvent} /><span><strong>{selectedEvent.title}</strong><small>{selectedEvent.dateLabel || fullDate(selectedEvent.date)} · {selectedEvent.source?.publisher}</small></span><ChevronRight size={17} /></button> : selected.sourceUrl ? <p className="sw-event-label">Événement : {selected.event}</p> : null}
        <div className="sw-sliders"><label><span>Variation testée <span className="sw-number"><input aria-label="Variation testée (%)" type="number" min={-80} max={100} step={0.5} value={selected.shockPct} onChange={event => { if (event.target.value && Number.isFinite(event.target.valueAsNumber)) update({ shockPct: Math.max(-80, Math.min(100, event.target.valueAsNumber)) }); }} />%</span></span><input aria-label="Ajuster la variation" type="range" min={-80} max={100} step={0.5} value={selected.shockPct} onChange={event => update({ shockPct: Number(event.target.value) })} /><span className="sw-range-labels"><small>−80 %</small><small>Hypothèse utilisateur</small><small>+100 %</small></span></label><label><span>Moment d’application <strong>Après {selected.eventAfterObservations} séance{selected.eventAfterObservations === 1 ? '' : 's'}</strong></span><input aria-label="Moment d’application" type="range" min={0} max={horizon} step={1} value={selected.eventAfterObservations} onChange={event => update({ eventAfterObservations: Number(event.target.value) })} /><span className="sw-range-labels"><small>Au départ</small><small>+{horizon} séances</small></span></label></div>
        <p className="sw-editor-note">{selected.shockPct === 0 ? 'Variation à 0 % : ce scénario suit la référence. Ajuste le curseur pour tester un effet.' : `Tu testes une variation de ${percent(selected.shockPct)}. Le modèle ne prédit pas cette variation.`} Le moment choisi est un paramètre de simulation, pas la date annoncée de l’événement.</p>
        {selectedResult && result && <button type="button" className="sw-text-button" disabled={pending} onClick={() => onExplore(scenarioEventTarget(result, selectedResult))}>Voir l’hypothèse calculée <ChevronRight size={14} /></button>}
      </>}
    </div>
    {result && <div className="sw-method"><SourceDetailsButton label="Données et méthode" sources={[{ id: 'simulation-history', title: result.source, url: result.sourceUrl, dateLabel: `Dernière clôture : ${fullDate(result.asOf)}`, excerpt: result.method, limits: result.limitations.join('\n') }, ...(selectedResult?.sourceUrl ? [{ id: 'simulation-event', title: selectedResult.event, url: selectedResult.sourceUrl, excerpt: 'Source associée à l’hypothèse. Son contenu ne détermine pas la variation testée.' }] : [])]} /><span>Historique → rééchantillonnage → comparaison des hypothèses</span></div>}
    {result?.validation && <details className="sw-details"><summary>Contrôle du modèle sur l’historique</summary><p>Ajustement sur {result.validation.trainingReturns} rendements, puis contrôle sur {result.validation.holdoutWindows} fenêtres distinctes de {result.validation.horizonObservations} séances.{result.validation.empiricalCoveragePct !== null ? ` La fourchette p10–p90 contient ${result.validation.empiricalCoveragePct.toLocaleString('fr-CA')} % des résultats de ces fenêtres historiques.` : ' Aucun taux de couverture disponible.'} Ce contrôle ne donne pas la probabilité d’une trajectoire future.</p>{result.limitations.map(limit => <p key={limit}>{limit}</p>)}</details>}
    {result && selectedResult && <details className="sw-details"><summary>Valeurs du dernier calcul · {selectedResult.title}</summary><div className="sw-table-wrap"><table><thead><tr><th>Séances après le départ</th><th>p10</th><th>Médiane</th><th>p90</th><th>Détail</th></tr></thead><tbody>{selectedResult.path.map(point => <tr key={simulationPointOffset(point)}><th>+{simulationPointOffset(point)}</th><td>{scenarioMoney(point.lowerPrice, result.currency)}</td><td>{scenarioMoney(point.medianPrice, result.currency)}</td><td>{scenarioMoney(point.upperPrice, result.currency)}</td><td><button type="button" disabled={pending} aria-label={`Explorer le jalon ${simulationPointOffset(point)}`} onClick={() => onExplore(scenarioPointTarget(result, selectedResult, point))}><ChevronRight size={14} /></button></td></tr>)}</tbody></table></div></details>}
  </section>;
}
