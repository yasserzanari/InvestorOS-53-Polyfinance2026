import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Calculator, CircleHelp, RotateCcw, Save, Trash2 } from 'lucide-react';
import { ForecastChart } from './ForecastChart';
import { SupplyRouteMap } from './ScenariosView';
import { evidenceTarget, scenarioTarget, type AnalysisResult, type SimulationModel, type ViewProps } from './types';
import './scenario.css';

type Inputs = { entityId: string; closureDays: number; tariffPct: number; alternate: boolean; alternateDelayDays: number };
type SavedScenario = { id: string; name: string; savedAt: string; inputs: Inputs };
const number = (value: number) => new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 2 }).format(value);
const MAX_ALTERNATE_DELAY_DAYS = 3650;
const bounded = (value: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
const defaults = (result: AnalysisResult): Inputs => ({ entityId: result.entities.find(entity => entity.kind === 'port')?.id ?? '', closureDays: 0, tariffPct: 0, alternate: false, alternateDelayDays: result.simulation?.alternateDelayDays ?? 0 });
export function calculateSensitivity(model: SimulationModel, inputs: Inputs) {
  const closureDays = bounded(inputs.closureDays, model.maxClosureDays);
  const tariffPct = bounded(inputs.tariffPct, model.maxTariffPct);
  const closureDelay = closureDays * model.closureDelayPerDay;
  const addedDelay = inputs.alternate ? Math.min(closureDelay, bounded(inputs.alternateDelayDays, MAX_ALTERNATE_DELAY_DAYS)) : closureDelay;
  const cost = model.baselineCost + closureDays * model.closureCostPerDay + model.baselineCost * (model.tariffExposurePct / 100) * (tariffPct / 100) + (inputs.alternate ? model.baselineCost * model.alternateCostPct / 100 : 0);
  return { cost, delayDays: model.baselineDelayDays + addedDelay, servicePct: Math.max(0, Math.min(100, model.baselineServicePct - addedDelay * model.serviceLossPerDelayDay)) };
}
function Parameter({ label, value, max, unit, onChange, step = 1 }: { label: string; value: number; max: number; unit: string; onChange: (value: number) => void; step?: number }) {
  return <div className="av-simulator-parameter"><label><span>{label}</span><span className="av-number-control"><input aria-label={label} type="number" min={0} max={max} step={step} value={value} onChange={event => onChange(bounded(event.currentTarget.valueAsNumber, max))} /><span>{unit}</span></span></label><input aria-label={`${label} · curseur`} type="range" min={0} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /><div className="av-slider-bounds"><span>0 {unit}</span><span>{number(max)} {unit}</span></div></div>;
}
export function SimulatorView({ result, onContextChange, onExplore }: ViewProps) {
  const [inputs, setInputs] = useState<Inputs>(() => defaults(result));
  const [name, setName] = useState('Mon scénario');
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [saveMessage, setSaveMessage] = useState('');
  const key = `investoros.scenarios.v1.${result.accountId}.${result.analysisId}.${result.resultVersion}`;
  useEffect(() => {
    setInputs(defaults(result)); setSaveMessage(''); setSaved([]);
    try {
      const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      if (Array.isArray(data)) setSaved(data.filter((item): item is SavedScenario => !!item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.savedAt === 'string' && Number.isFinite(Date.parse(item.savedAt)) && item.inputs && typeof item.inputs.entityId === 'string' && typeof item.inputs.alternate === 'boolean' && ['closureDays', 'tariffPct', 'alternateDelayDays'].every(k => typeof item.inputs[k] === 'number' && Number.isFinite(item.inputs[k]))).slice(0, 20));
    } catch { setSaveMessage('Les scénarios locaux ne peuvent pas être lus dans ce navigateur.'); }
  }, [key]);
  useEffect(()=>onContextChange?.({simulationInputs:inputs}),[inputs,onContextChange]);
  const model = result.simulation;
  const computed = useMemo(() => model ? calculateSensitivity(model, inputs) : null, [model, inputs]);
  if (!model || !computed) return <div className="av-view-empty"><Calculator size={30} /><h3>Modèle de simulation à fournir</h3><p>L’agent doit renseigner les valeurs de référence, les coefficients de sensibilité, les bornes des paramètres et les hypothèses avant de calculer un scénario.</p></div>;
  const selectedEntity = result.entities.find(entity => entity.id === inputs.entityId);
  const entities = result.entities.filter(entity => entity.kind === 'port' || entity.kind === 'site');
  const change = (patch: Partial<Inputs>) => { setInputs(previous => ({ ...previous, ...patch })); setSaveMessage(''); };
  const persist = (items: SavedScenario[]) => {
    try { localStorage.setItem(key, JSON.stringify(items)); setSaved(items); return true; }
    catch { setSaveMessage('Enregistrement impossible : stockage local indisponible ou plein.'); return false; }
  };
  const save = () => {
    if (!name.trim()) { setSaveMessage('Donnez un nom au scénario.'); return; }
    const next = [{ id: globalThis.crypto?.randomUUID?.() ?? `scenario-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, name: name.trim().slice(0, 100), savedAt: new Date().toISOString(), inputs }, ...saved].slice(0, 20);
    if (persist(next)) setSaveMessage('Scénario enregistré dans ce navigateur.');
  };
  const metrics = [
    { label: `Coût (${result.costUnit})`, baseline: model.baselineCost, value: computed.cost, unit: '' },
    { label: 'Délai moyen (jours)', baseline: model.baselineDelayDays, value: computed.delayDays, unit: ' j' },
    { label: 'Niveau de service (%)', baseline: model.baselineServicePct, value: computed.servicePct, unit: ' pts' },
  ];
  const evidenceIds = new Set(model.evidenceIds);
  return <div className="av-simulator-view">
    <div className="av-view-toolbar"><p>Modèle de sensibilité · <strong>hypothèses modifiables</strong></p><button type="button" className="av-secondary-button" onClick={() => { setInputs(defaults(result)); setSaveMessage('Paramètres réinitialisés.'); }}><RotateCcw size={14} /> Réinitialiser</button></div>
    <div className="av-simulator-main"><section className="av-panel av-simulator-controls"><h3><Calculator size={17} /> Et si… ?</h3>
      <label className="av-scope-label">Site concerné (contexte)<select value={inputs.entityId} onChange={event => change({ entityId: event.target.value })}><option value="">Périmètre de l’analyse</option>{entities.map(entity => <option value={entity.id} key={entity.id}>{entity.label}{entity.country ? ` (${entity.country})` : ''}</option>)}</select></label>
      <Parameter label="Durée de fermeture" value={inputs.closureDays} max={model.maxClosureDays} unit="j" onChange={closureDays => change({ closureDays })} />
      <Parameter label="Tarif additionnel" value={inputs.tariffPct} max={model.maxTariffPct} unit="%" step={0.5} onChange={tariffPct => change({ tariffPct })} />
      <label className="av-alternate-switch"><span>Activer l’itinéraire alternatif</span><input role="switch" type="checkbox" checked={inputs.alternate} onChange={event => change({ alternate: event.target.checked })} /></label>
      {inputs.alternate && <Parameter label="Délai de l’alternative" value={inputs.alternateDelayDays} max={MAX_ALTERNATE_DELAY_DAYS} step={0.1} unit="j" onChange={alternateDelayDays => change({ alternateDelayDays })} />}
      <p className="av-parameter-help">Le choix du site précise le contexte; les coefficients ci-dessous s’appliquent au périmètre complet fourni par l’analyse.</p>
      <div className="av-save-scenario"><label>Nom du scénario<input maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label><button type="button" className="av-primary-button" onClick={save}><Save size={15} /> Enregistrer le scénario</button><p aria-live="polite">{saveMessage || 'Enregistrement local, associé à cette analyse et à sa version.'}</p></div>
    </section>
    <div className="av-simulator-output"><section className="av-panel av-simulator-map"><h3>Réseau et itinéraires documentés</h3><SupplyRouteMap result={result} selectedEntityId={inputs.entityId} disrupted={inputs.closureDays > 0} showAlternatives={inputs.alternate} onExplore={onExplore} detailed /><div className="av-simulator-map-legend"><span>Bleu : flux fourni</span><span>Rouge : liaison du site fermé</span><span>Vert : alternative fournie</span></div><p className="av-panel-copy">La carte met en évidence les liaisons du site choisi; le modèle de sensibilité ne recalcule pas leur itinéraire.</p></section><section className="av-panel"><h3>Résultats conditionnels{selectedEntity ? ` · ${selectedEntity.label}` : ''}</h3>{onExplore&&<button type="button" className="av-explore-result" onClick={()=>onExplore({id:`${result.analysisId}:v${result.resultVersion}:sensitivity:${JSON.stringify(inputs)}`,kind:'conclusion',title:'Résultat conditionnel du simulateur',summary:[`Fermeture : ${inputs.closureDays} jours. Tarif additionnel : ${inputs.tariffPct} %. Alternative : ${inputs.alternate?`activée, délai ${inputs.alternateDelayDays} jours`:'désactivée'}.`,...model.assumptions].join('\n'),date:result.asOf,classification:result.provenance==='illustrative'?'illustrative':'conditional',analysisId:result.analysisId,source:result.evidence.find(item=>evidenceIds.has(item.id))?evidenceTarget(result,result.evidence.find(item=>evidenceIds.has(item.id))!).source:undefined,metrics:metrics.map(metric=>({label:metric.label,value:number(metric.value)}))})}>Explorer ce résultat conditionnel</button>}<p className="av-panel-copy">Effets calculés avec les hypothèses affichées. Aucune probabilité de réalisation n’est estimée.</p><div className="av-table-scroll"><table><caption>Référence et hypothèses modifiées</caption><thead><tr><th>Indicateur</th><th>Référence</th><th>Scénario</th><th>Écart</th></tr></thead><tbody>{metrics.map((metric, index) => { const delta = metric.value - metric.baseline; const improves = index === 2 ? delta > 0 : delta < 0; return <tr key={metric.label}><th>{metric.label}</th><td>{number(metric.baseline)}</td><td><strong>{number(metric.value)}</strong></td><td className={delta === 0 ? 'av-neutral' : improves ? 'av-positive' : 'av-negative'}>{delta > 0 ? '+' : ''}{number(delta)}{metric.unit}</td></tr>; })}</tbody></table></div><div className="av-outcome-bars">{metrics.map((metric, index) => { const largest = Math.max(metric.baseline, metric.value, 1); return <div key={metric.label}><strong>{metric.label}</strong><div><label>Référence <b>{number(metric.baseline)}</b></label><span style={{ width: `${metric.baseline / largest * 100}%`, background: '#d7e5ff' }} /><label>Scénario <b>{number(metric.value)}</b></label><span style={{ width: `${metric.value / largest * 100}%`, background: index === 2 ? '#16a06b' : '#2563eb' }} /></div></div>; })}<p>Barre claire : référence · barre pleine : scénario</p></div></section>
      <section className="av-panel"><h3>Séries publiées dans l’analyse</h3><p className="av-panel-copy">Ces courbes proviennent du résultat enregistré. Les paramètres du simulateur modifient les indicateurs ci-dessus; ils ne recalculent pas ces courbes.</p><ForecastChart height={185} unit={result.costUnit} onExplore={onExplore} series={result.scenarios.map(scenario => ({ target:scenarioTarget(result,scenario), id: scenario.id, label: scenario.label, color: scenario.kind === 'base' ? '#2563eb' : scenario.kind === 'adverse' ? '#e54d5d' : '#16a06b', points: scenario.series, dashed: scenario.kind !== 'base' }))} /></section>
    </div></div>
    <div className="av-simulator-bottom"><section className="av-panel"><h3><CircleHelp size={16} /> Hypothèses et coefficients</h3><ul className="av-assumption-list">{model.assumptions.map((item, i) => <li key={i}>{item}</li>)}</ul><details className="av-formula"><summary>Voir la méthode et les coefficients</summary><p>Coût = coût de référence + jours de fermeture × coût par jour + coût de référence × part exposée × tarif + surcoût alternatif.</p><p>Délai additionnel = jours de fermeture × coefficient délai. Avec alternative : minimum entre ce délai et le délai alternatif.</p><p>Service = service de référence − délai additionnel × perte de service par jour, borné entre 0 et 100 %.</p><dl><div><dt>Coût par jour de fermeture</dt><dd>{number(model.closureCostPerDay)} {result.costUnit}/jour</dd></div><div><dt>Délai par jour de fermeture</dt><dd>{number(model.closureDelayPerDay)} j/jour</dd></div><div><dt>Part exposée au tarif</dt><dd>{number(model.tariffExposurePct)} %</dd></div><div><dt>Surcoût alternatif</dt><dd>{number(model.alternateCostPct)} %</dd></div><div><dt>Perte de service</dt><dd>{number(model.serviceLossPerDelayDay)} pts/jour de retard</dd></div></dl></details></section><section className="av-panel"><h3>Scénarios enregistrés ici</h3>{saved.length ? <ul className="av-saved-scenarios">{saved.map(item => <li key={item.id}><button type="button" onClick={() => { setInputs({ ...item.inputs, closureDays: bounded(item.inputs.closureDays, model.maxClosureDays), tariffPct: bounded(item.inputs.tariffPct, model.maxTariffPct), alternateDelayDays: bounded(item.inputs.alternateDelayDays, MAX_ALTERNATE_DELAY_DAYS) }); setName(item.name); setSaveMessage('Paramètres du scénario restaurés.'); }}><span><strong>{item.name}</strong><small>{new Intl.DateTimeFormat('fr-CA', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Toronto' }).format(new Date(item.savedAt))}</small></span><ArrowRight size={14} /></button><button type="button" aria-label={`Supprimer ${item.name}`} onClick={() => persist(saved.filter(scenario => scenario.id !== item.id))}><Trash2 size={14} /></button></li>)}</ul> : <p className="av-panel-copy">Enregistrez un premier jeu d’hypothèses pour le retrouver dans ce navigateur.</p>}<div className="av-model-sources">{result.evidence.filter(item => evidenceIds.has(item.id)).map(item => onExplore?<button type="button" className="av-source-explore" onClick={()=>onExplore(evidenceTarget(result,item))} key={item.id}>{item.title} · {item.publisher}</button>:<a href={/^https?:\/\//i.test(item.url) ? item.url : undefined} target="_blank" rel="noreferrer" key={item.id}>{item.title} · {item.publisher}</a>)}</div></section></div>
  </div>;
}
