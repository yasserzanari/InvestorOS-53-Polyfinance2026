import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, LoaderCircle, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { createLocalId } from '../profiles/profile-api';
import { runSimulationProjection, simulationEventOffset, simulationHorizon, type SimulationProjection, type SimulationProjectionInput } from '../../shared/api';

type DraftBranch = { id: string; title: string; event: string; shock: string; offset: string; source: string };
const initialBranches = (projection: SimulationProjection): DraftBranch[] => projection.branches.map(branch => ({ id: branch.id, title: branch.title, event: branch.event, shock: String(branch.shockPct), offset: String(simulationEventOffset(branch)), source: branch.sourceUrl || '' }));
export function ProjectionParameters({ projection, onDirtyChange, onApply, onRequest, defaultOpen=false, compact=false }: { defaultOpen?:boolean;compact?:boolean;projection: SimulationProjection; onDirtyChange: (dirty: boolean) => void; onApply: (projection: SimulationProjection) => void | Promise<void>; onRequest?: (input: SimulationProjectionInput, signal: AbortSignal) => Promise<SimulationProjection> }) {
  const [activeBranch,setActiveBranch]=useState(0);
  const [ticker, setTicker] = useState(projection.ticker);
  const [unit, setUnit] = useState<'calendar_days' | 'observations'>(projection.timeUnit === 'calendar_days' ? 'calendar_days' : 'observations');
  const [horizon, setHorizon] = useState(String(simulationHorizon(projection)));
  const [branches, setBranches] = useState(() => initialBranches(projection));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const changed = () => { setDirty(true); onDirtyChange(true); setError(''); };
  const updateBranch = (id: string, patch: Partial<DraftBranch>) => { changed(); setBranches(current => current.map(branch => branch.id === id ? { ...branch, ...patch } : branch)); };
  const reset = () => {
    abort.current?.abort(); abort.current = null; setBusy(false); setTicker(projection.ticker);
    setUnit(projection.timeUnit === 'calendar_days' ? 'calendar_days' : 'observations'); setHorizon(String(simulationHorizon(projection))); setBranches(initialBranches(projection)); setDirty(false); onDirtyChange(false); setError('');
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy) return;
    const horizonValue = Number(horizon);
    if (!/^\d+$/.test(horizon) || horizonValue < 1 || horizonValue > 120 || branches.some(branch => !/^\d+$/.test(branch.offset) || Number(branch.offset) > horizonValue || !branch.shock.trim() || !Number.isFinite(Number(branch.shock)) || Number(branch.shock) < -80 || Number(branch.shock) > 100)) { setError('Indiquez un horizon entier de 1 à 120, un jalon entier dans cet horizon et un choc de −80 à +100 %.'); return; }
    const base = branches.map(branch => ({ id: branch.id, title: branch.title.trim(), event: branch.event.trim(), shockPct: Number(branch.shock), ...(branch.source.trim() ? { sourceUrl: branch.source.trim() } : {}) }));
    const input: SimulationProjectionInput = unit === 'calendar_days'
      ? { ticker: ticker.trim().toUpperCase(), horizonDays: horizonValue, branches: base.map((branch, index) => ({ ...branch, eventAfterDays: Number(branches[index].offset) })) }
      : { ticker: ticker.trim().toUpperCase(), horizonObservations: horizonValue, branches: base.map((branch, index) => ({ ...branch, eventAfterObservations: Number(branches[index].offset) })) };
    const controller = new AbortController(); abort.current = controller; setBusy(true); setError(''); setDirty(true); onDirtyChange(true);
    try { const result = await (onRequest ? onRequest(input, controller.signal) : runSimulationProjection(input, controller.signal)); if (!controller.signal.aborted) await onApply(result); }
    catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Le calcul n’a pas abouti. Aucun nouveau résultat n’est affiché.'); }
    finally { if (abort.current === controller) { setBusy(false); abort.current = null; } }
  };
  return <details open={defaultOpen||undefined} className={`assistant-projection-parameters${compact?' is-compact':''}`}><summary><ChevronDown size={14}/>Paramètres du calcul <span>{dirty ? 'Modifiés · recalcul nécessaire' : `${branches.length} hypothèse${branches.length > 1 ? 's' : ''} · ${horizon} ${unit === 'calendar_days' ? 'jours' : 'séances'}`}</span></summary><form onSubmit={submit}>
    <fieldset disabled={busy}><div className="assistant-projection-fields"><label>Titre<input aria-label="Titre à simuler" required maxLength={16} value={ticker} onChange={event => { changed(); setTicker(event.target.value); }}/></label><label>Unité<select aria-label="Unité de l’horizon" value={unit} onChange={event => { changed(); setUnit(event.target.value as typeof unit); }}><option value="calendar_days">Jours calendaires</option><option value="observations">Séances / observations</option></select></label><label>Horizon<input aria-label="Horizon du calcul" type="number" min="1" max="120" step="1" required value={horizon} onChange={event => { changed(); setHorizon(event.target.value); }}/></label></div>
    <p className="assistant-projection-unit-note">Le changement d’unité conserve vos nombres saisis et les interprète dans l’unité choisie. Le serveur vérifie la disponibilité historique sans modifier vos paramètres. Vérifiez aussi le nom et l’événement si vous changez le choc.</p>
    <div className="assistant-projection-compact-tabs">{compact&&branches.map((branch,index)=><button type="button" key={branch.id} aria-pressed={Math.min(activeBranch,branches.length-1)===index} onClick={()=>setActiveBranch(index)}>Hypothèse {index+1}</button>)}</div><div className="assistant-projection-branch-fields">{branches.map((branch, index) => (!compact||index===Math.min(activeBranch,branches.length-1))&&<section key={branch.id}><div><strong>Hypothèse {index + 1}</strong><button type="button" aria-label={`Supprimer l’hypothèse ${index + 1}`} disabled={branches.length === 1} onClick={() => { changed(); setBranches(current => current.filter(item => item.id !== branch.id)); }}><Trash2 size={13}/></button></div><div className="assistant-projection-branch-grid"><label>Nom<input required maxLength={80} value={branch.title} onChange={event => updateBranch(branch.id, { title: event.target.value })}/></label><label>Choc (%)<input aria-label={`Choc de l’hypothèse ${index + 1}`} type="number" min="-80" max="100" step="any" required value={branch.shock} onChange={event => updateBranch(branch.id, { shock: event.target.value })}/></label><label>Après ({unit === 'calendar_days' ? 'jours' : 'séances'})<input aria-label={`Jalon de l’hypothèse ${index + 1}`} type="number" min="0" max={Number(horizon) || 120} step="1" required value={branch.offset} onChange={event => updateBranch(branch.id, { offset: event.target.value })}/></label><label className="is-wide">Événement conditionnel<input required maxLength={160} value={branch.event} onChange={event => updateBranch(branch.id, { event: event.target.value })}/></label><label className="is-wide">Source de l’hypothèse (facultatif)<input type="url" pattern="https://.*" placeholder="https://…" maxLength={1000} value={branch.source} onChange={event => updateBranch(branch.id, { source: event.target.value })}/></label></div></section>)}</div>
    <button type="button" className="assistant-projection-add" disabled={branches.length >= 4} onClick={() => { changed(); setBranches(current => [...current, { id: createLocalId(), title: '', event: '', shock: '', offset: '', source: '' }]); }}><Plus size={13}/>Ajouter une hypothèse</button></fieldset>
    {error && <p className="assistant-projection-error" role="alert">{error}</p>}<div className="assistant-projection-form-actions"><button type="submit" className="is-primary" disabled={busy}>{busy && <LoaderCircle size={14} className="is-spinning"/>}{busy ? 'Calcul historique en cours…' : 'Recalculer avec ces paramètres'}</button><button type="button" onClick={reset}><RotateCcw size={13}/>{busy ? 'Annuler' : 'Rétablir'}</button></div>
  </form></details>;
}
