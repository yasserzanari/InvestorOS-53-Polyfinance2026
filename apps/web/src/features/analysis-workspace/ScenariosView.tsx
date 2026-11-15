import { useMemo, useState } from 'react';
import { ArrowDownUp, CircleHelp, Layers, Leaf, MapPinned, ShieldAlert } from 'lucide-react';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import { ForecastChart } from './ForecastChart';
import type { ExploreHandler } from '../analysis-interactions/types';
import { entityTarget, relationTarget, scenarioTarget, evidenceTarget, type AnalysisResult, type ViewProps } from './types';
import './scenario.css';

const palette = { base: '#2563eb', adverse: '#e54d5d', mitigation: '#16a06b' };
const fmt = (value: number) => new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 2 }).format(value);
function Delta({ value, baseline, unit = '', lowerIsBetter = true }: { value: number; baseline: number; unit?: string; lowerIsBetter?: boolean }) {
  const difference = value - baseline;
  return <small className={difference === 0 ? 'av-neutral' : (difference < 0) === lowerIsBetter ? 'av-positive' : 'av-negative'}>{difference > 0 ? '+' : ''}{fmt(difference)}{unit}</small>;
}
export function SupplyRouteMap({ result, edgeIds, color = '#2563eb', selectedEntityId, disrupted = false, showAlternatives = true, detailed = false, onExplore }: { onExplore?:ExploreHandler; result: AnalysisResult; edgeIds?: string[]; color?: string; selectedEntityId?: string; disrupted?: boolean; showAlternatives?: boolean; detailed?: boolean }) {
  const projection = useMemo(() => geoEqualEarth().scale(35).translate([120, 58]), []);
  const land = useMemo(() => geoPath(projection)(feature(world as never, world.objects.countries as never)), [projection]);
  const selected = result.relations.filter(edge => (edgeIds ? edgeIds.includes(edge.id) : edge.kind === 'transport' || edge.kind === 'alternative') && (showAlternatives || edge.kind !== 'alternative'));
  return <div className={`av-route-thumbnail${detailed ? " is-detailed" : ""}`}><svg viewBox="0 0 240 112" role={onExplore?'group':'img'} aria-label="Itinéraires documentés de l’analyse"><rect width="240" height="112" rx="7" fill="#f1f7fd" /><path d={land ?? ''} fill="#d9e7f4" stroke="#fff" strokeWidth=".4" />{selected.map(edge => {
    const source = result.entities.find(node => node.id === edge.source), target = result.entities.find(node => node.id === edge.target);
    if (source?.longitude === undefined || source.latitude === undefined || target?.longitude === undefined || target.latitude === undefined) return null;
    const p1 = projection([source.longitude, source.latitude]), p2 = projection([target.longitude, target.latitude]);
    if (!p1 || !p2) return null;
    const affected = disrupted && (edge.source === selectedEntityId || edge.target === selectedEntityId);
    const edgeColor = edge.kind === 'alternative' ? '#16a06b' : affected ? '#e54d5d' : color;
    return <g key={edge.id} role={onExplore?'button':undefined} tabIndex={onExplore?0:undefined} aria-label={onExplore?`Explorer la relation ${edge.label}`:undefined} onClick={()=>onExplore?.(relationTarget(result,edge))} onKeyDown={event=>{if(onExplore&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onExplore(relationTarget(result,edge));}}}><title>{edge.label}</title><path d={`M${p1[0]},${p1[1]} Q${(p1[0]+p2[0])/2},${Math.min(p1[1],p2[1])-15} ${p2[0]},${p2[1]}`} fill="none" stroke={edgeColor} strokeWidth="1.6" strokeDasharray={affected ? '3 2' : undefined} /><circle cx={p1[0]} cy={p1[1]} r="2.8" fill={edgeColor} stroke="white" /><circle cx={p2[0]} cy={p2[1]} r="2.8" fill={edgeColor} stroke="white" /></g>;
  })}{detailed && result.entities.filter(entity => entity.id === selectedEntityId || selected.some(edge => edge.source === entity.id || edge.target === entity.id)).map(entity => {
    if (entity.longitude === undefined || entity.latitude === undefined) return null;
    const point = projection([entity.longitude, entity.latitude]);
    return point ? <g key={entity.id} role={onExplore?'button':undefined} tabIndex={onExplore?0:undefined} aria-label={onExplore?`Explorer le site ${entity.label}`:undefined} onClick={()=>onExplore?.(entityTarget(result,entity))} onKeyDown={event=>{if(onExplore&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onExplore(entityTarget(result,entity));}}}><circle cx={point[0]} cy={point[1]} r={entity.id === selectedEntityId ? 3.5 : 2} fill={entity.id === selectedEntityId && disrupted ? '#e54d5d' : '#2563eb'} stroke="white" /><text x={point[0] + 4} y={point[1] - 4} fontSize="4.7" fill="#263e63" paintOrder="stroke" stroke="white" strokeWidth="1.4">{entity.label}</text></g> : null;
  })}</svg>{!selected.length && <span>Aucun itinéraire fourni</span>}</div>;
}
export function ScenariosView({ result, onExplore }: ViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [metric, setMetric] = useState<'cost' | 'delayDays' | 'servicePct'>('cost');
  const base = result.scenarios.find(scenario => scenario.kind === 'base');
  const sharedDomain = useMemo<[number, number]>(() => {
    const values = result.scenarios.flatMap(scenario => scenario.series.flatMap(point => [point.value, point.lower ?? point.value, point.upper ?? point.value]));
    if (!values.length) return [0, 1];
    const low = Math.min(...values), high = Math.max(...values);
    const padding = Math.max((high - low) * .06, Math.abs(high) * .005, 1);
    return [Math.floor(low - padding), Math.ceil(high + padding)];
  }, [result.scenarios]);
  const selected = result.scenarios.find(scenario => scenario.id === selectedId);
  const sourceIds = new Set(selected?.evidenceIds ?? result.scenarios.flatMap(scenario => scenario.evidenceIds));
  if (!result.scenarios.length) return <div className="av-view-empty"><Layers size={30} /><h3>Aucun scénario calculé</h3><p>L’agent doit fournir une référence, des hypothèses et les résultats comparables avant d’ouvrir cette vue.</p></div>;
  return <div className="av-scenarios-view">
    <div className="av-view-toolbar"><p>Horizon : <strong>{result.horizonDays} jours</strong> · {result.costUnit}</p><label>Mettre en évidence <select aria-label="Indicateur de comparaison" value={metric} onChange={event => setMetric(event.target.value as typeof metric)}><option value="cost">Coût</option><option value="delayDays">Délai</option><option value="servicePct">Niveau de service</option></select></label></div>
    <div className="av-scenario-columns">{result.scenarios.map(scenario => <article key={scenario.id} className={`av-scenario-card av-scenario-${scenario.kind}${selectedId === scenario.id ? ' is-selected' : ''}`}>
      <button type="button" className="av-scenario-select" onClick={() => {setSelectedId(selectedId === scenario.id ? null : scenario.id);onExplore?.(scenarioTarget(result,scenario));}} aria-pressed={selectedId === scenario.id}>{scenario.kind === 'base' ? <Layers size={19} /> : scenario.kind === 'adverse' ? <ShieldAlert size={19} /> : <Leaf size={19} />}<span><strong>{scenario.label}</strong><small>{scenario.kind === 'base' ? 'Référence' : scenario.kind === 'adverse' ? 'Perturbation' : 'Atténuation'}</small></span></button>
      <p className="av-scenario-description">{scenario.description}</p>
      <dl className="av-scenario-metrics"><div className={metric === 'cost' ? 'is-emphasized' : ''}><dt>Coût rendu</dt><dd>{fmt(scenario.cost)} {base && scenario.id !== base.id && <Delta value={scenario.cost} baseline={base.cost} />}</dd></div><div className={metric === 'delayDays' ? 'is-emphasized' : ''}><dt>Délai moyen</dt><dd>{fmt(scenario.delayDays)} j {base && scenario.id !== base.id && <Delta value={scenario.delayDays} baseline={base.delayDays} unit=" j" />}</dd></div><div className={metric === 'servicePct' ? 'is-emphasized' : ''}><dt>Niveau de service</dt><dd>{fmt(scenario.servicePct)} % {base && scenario.id !== base.id && <Delta value={scenario.servicePct} baseline={base.servicePct} unit=" pts" lowerIsBetter={false} />}</dd></div></dl>
      <div className="av-scenario-chart"><h4>Coût rendu · {result.costUnit}</h4><ForecastChart compact showUnit={false} height={104} yDomain={sharedDomain} horizonDays={result.horizonDays} unit={result.costUnit} onExplore={onExplore} series={[{ target:scenarioTarget(result,scenario), id: scenario.id, label: scenario.label, color: palette[scenario.kind], points: scenario.series, dashed: scenario.kind !== 'base' }]} /></div>
      <h4 className="av-map-title"><MapPinned size={14} /> Itinéraires retenus</h4><SupplyRouteMap result={result} edgeIds={scenario.edgeIds} color={palette[scenario.kind]} onExplore={onExplore} />
      <details className="av-scenario-assumptions" open={selectedId === scenario.id}><summary>Hypothèses ({scenario.assumptions.length})</summary>{scenario.assumptions.length ? <ul>{scenario.assumptions.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>Aucune hypothèse fournie.</p>}</details>
    </article>)}</div>
    <section className="av-panel av-comparison"><h3><ArrowDownUp size={16} /> Comparaison des scénarios</h3><p className="av-comparison-focus" aria-live="polite">{metric === 'cost' ? 'Coût rendu' : metric === 'delayDays' ? 'Délai moyen' : 'Niveau de service'} en évidence · axes de coût communs</p><div className="av-table-scroll"><table><caption>Référence commune : {base?.label ?? 'non fournie'} · horizon {result.horizonDays} jours</caption><thead><tr><th>Critère</th>{result.scenarios.map(scenario => <th key={scenario.id}>{onExplore?<button type="button" className="av-scenario-value-button" onClick={()=>onExplore(scenarioTarget(result,scenario))} aria-label={`Explorer le scénario ${scenario.label}`}>{scenario.label}</button>:scenario.label}</th>)}</tr></thead><tbody><tr className={metric === 'cost' ? 'av-comparison-highlight' : undefined}><th>Coût ({result.costUnit})</th>{result.scenarios.map(scenario => <td key={scenario.id}>{fmt(scenario.cost)}</td>)}</tr><tr className={metric === 'delayDays' ? 'av-comparison-highlight' : undefined}><th>Délai moyen (jours)</th>{result.scenarios.map(scenario => <td key={scenario.id}>{fmt(scenario.delayDays)}</td>)}</tr><tr className={metric === 'servicePct' ? 'av-comparison-highlight' : undefined}><th>Niveau de service (%)</th>{result.scenarios.map(scenario => <td key={scenario.id}>{fmt(scenario.servicePct)}</td>)}</tr><tr><th>Preuves disponibles</th>{result.scenarios.map(scenario => <td key={scenario.id}>{scenario.evidenceIds.length}</td>)}</tr></tbody></table></div></section>
    <section className="av-panel av-scenario-evidence"><h3><CircleHelp size={16} /> Sources et éléments de preuve{selected ? ` · ${selected.label}` : ''}</h3>{result.evidence.filter(item => sourceIds.has(item.id)).map(item => onExplore?<button type="button" className="av-source-explore" key={item.id} onClick={()=>onExplore(evidenceTarget(result,item))}><strong>{item.title}</strong><span>{item.publisher} · {item.publishedAt}</span></button>:<a key={item.id} href={/^https?:\/\//i.test(item.url) ? item.url : undefined} target="_blank" rel="noreferrer"><strong>{item.title}</strong><span>{item.publisher} · {item.publishedAt}</span></a>)}{!sourceIds.size && <p>Ce résultat ne fournit pas de preuve associée aux scénarios.</p>}</section>
  </div>;
}
