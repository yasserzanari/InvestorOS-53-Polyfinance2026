import { useEffect, useMemo, useRef, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import { ChevronRight, LocateFixed, Minus, PanelRightClose, PanelRightOpen, Pause, Play, Plus, Ship } from 'lucide-react';
import { EvidenceLinks } from './NetworkView';
import { ForecastChart } from './ForecastChart';
import { entityTarget, relationTarget, eventTarget, scenarioTarget, type AnalysisEvent, type Entity, type Risk, type ViewProps } from './types';
import './network.css';

const countries = feature(world as unknown as Topology, world.objects.countries as GeometryCollection);
const mappedCountries = { ...countries, features: countries.features.filter(item => String(item.id) !== '010') };
const projection = geoNaturalEarth1().fitExtent([[18, 24], [882, 442]], mappedCountries).clipExtent([[18, 24], [882, 442]]);
const path = geoPath(projection);
const colors: Record<Risk, string> = { unknown: '#718096', low: '#2875e8', medium: '#e99a23', high: '#e44e5a' };
const labels: Record<Risk, string> = { unknown: 'Non évalué', low: 'Faible', medium: 'Modéré', high: 'Élevé' };
const DAY = 86400000;
const timestamp = (date: string) => Date.parse(date.length === 10 ? date + 'T00:00:00Z' : date);
const formatDate = (value: number) => new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(value);
function coordinates(entity: Entity): [number, number] | undefined {
  return Number.isFinite(entity.longitude) && Number.isFinite(entity.latitude) ? [entity.longitude!, entity.latitude!] : undefined;
}

export function ChronologyView({ result, onExplore }: ViewProps) {
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<string | null>(null);
  const [inspector, setInspector] = useState(true);
  const [risk, setRisk] = useState('all');
  const [country, setCountry] = useState('all');
  const [tier, setTier] = useState('all');
  const [alternatives, setAlternatives] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const baseTime = new Date(timestamp(result.asOf)).setUTCHours(0, 0, 0, 0);
  const currentTime = baseTime + day * DAY;
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (!playing || reducedMotion) return;
    const timer = window.setInterval(() => setDay(value => {
      const next = Math.min(result.horizonDays, value + 1);
      if (next === result.horizonDays) setPlaying(false);
      return next;
    }), 250);
    return () => window.clearInterval(timer);
  }, [playing, reducedMotion, result.horizonDays]);
  useEffect(() => { setDay(0); setSelected(null); setSelectedEvent(null); setSelectedRelation(null); setPlaying(false); }, [result.analysisId]);
  const activeEvents = useMemo(() => result.events.filter(event => timestamp(event.date) < currentTime + DAY && (!event.endDate || timestamp(event.endDate) + (event.endDate.length === 10 ? DAY - 1 : 0) >= currentTime)), [result.events, currentTime]);
  const riskAt = (entity: Entity): Risk => {
    const severity = activeEvents.filter(event => event.entityIds.includes(entity.id)).map(event => event.severity);
    return severity.includes('high') ? 'high' : severity.includes('medium') && entity.risk !== 'high' ? 'medium' : entity.risk;
  };
  const entities = result.entities.filter(entity => coordinates(entity) && (risk === 'all' || riskAt(entity) === risk) && (country === 'all' || entity.country === country) && (tier === 'all' || entity.kind !== 'supplier' || entity.tier === Number(tier)));
  const visibleIds = new Set(entities.map(entity => entity.id));
  const relations = result.relations.filter(edge => edge.kind !== 'impact' && visibleIds.has(edge.source) && visibleIds.has(edge.target) && (alternatives || edge.kind !== 'alternative'));
  const entity = result.entities.find(item => item.id === selected);
  const event = result.events.find(item => item.id === selectedEvent);
  const relation = result.relations.find(item => item.id === selectedRelation);
  const countriesInData = [...new Set(result.entities.flatMap(item => item.country ? [item.country] : []))].sort();
  const tiers = [...new Set(result.entities.flatMap(item => item.tier === undefined ? [] : [item.tier]))].sort();
  function pickEvent(item: AnalysisEvent) {
    onExplore?.(eventTarget(result,item));
    setSelectedEvent(item.id); setSelected(null); setSelectedRelation(null); setInspector(true); setPlaying(false);
    setDay(Math.max(0, Math.min(result.horizonDays, Math.round((timestamp(item.date) - baseTime) / DAY))));
  }
  return <section className="av-chronology" aria-label="Carte et chronologie des risques">
    <div className="av-network-controls">
      <label>Pays <select aria-label="Pays" value={country} onChange={event => setCountry(event.target.value)}><option value="all">Tous les pays</option>{countriesInData.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      <label>Risque <select aria-label="Risque" value={risk} onChange={event => setRisk(event.target.value)}><option value="all">Tous</option>{Object.entries(labels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>Rang fournisseurs <select aria-label="Rang fournisseurs" value={tier} onChange={event => setTier(event.target.value)}><option value="all">Tous</option>{tiers.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="av-check"><input type="checkbox" checked={alternatives} onChange={event => setAlternatives(event.target.checked)}/>Routes alternatives</label>
      <button type="button" className="av-icon-button" aria-label={inspector ? 'Replier les détails' : 'Ouvrir les détails'} aria-expanded={inspector} onClick={() => setInspector(!inspector)}>{inspector ? <PanelRightClose size={17}/> : <PanelRightOpen size={17}/>}</button>
    </div>
    <div className={`av-canvas-layout av-map-layout${inspector ? ' has-inspector' : ''}`}>
      <div className="av-world-canvas">
        <div className="av-map-heading"><strong>Réseau & événements</strong><time dateTime={new Date(currentTime).toISOString()}>{formatDate(currentTime)}</time></div>
        <svg viewBox="0 0 900 470" role="group" aria-label="Carte mondiale des sites et flux. Glisser pour déplacer; utiliser les boutons pour zoomer." className="av-world-map" tabIndex={0}
          onPointerDown={event => { if (event.button !== 0 || (event.target as Element).closest('[data-entity]')) return; const svg = event.currentTarget; svg.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y, moved: false }; }}
          onPointerMove={event => { if (!drag.current) return; const rect = event.currentTarget.getBoundingClientRect(); const dx = (event.clientX - drag.current.x) * 900 / rect.width; const dy = (event.clientY - drag.current.y) * 470 / rect.height; if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true; setPan({ x: drag.current.panX + dx, y: drag.current.panY + dy }); }}
          onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
          onKeyDown={event => { if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(value => Math.min(5, value + .25)); } else if (event.key === '-') { event.preventDefault(); setZoom(value => Math.max(.7, value - .25)); } else if (event.key === '0') { setZoom(1); setPan({ x: 0, y: 0 }); } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && event.target === event.currentTarget) { event.preventDefault(); setPan(value => ({ x: value.x + (event.key === 'ArrowLeft' ? 25 : event.key === 'ArrowRight' ? -25 : 0), y: value.y + (event.key === 'ArrowUp' ? 25 : event.key === 'ArrowDown' ? -25 : 0) })); } }}>
          <defs><pattern id="av-ocean-grid" width="45" height="45" patternUnits="userSpaceOnUse"><path d="M45 0H0V45" fill="none" stroke="#c7ddee" strokeWidth=".5"/></pattern></defs>
          <rect width="900" height="470" fill="#edf6fc"/><rect width="900" height="470" fill="url(#av-ocean-grid)"/>
          <g transform={`translate(${450 + pan.x} ${235 + pan.y}) scale(${zoom}) translate(-450 -235)`}>
            <g className="av-countries">{mappedCountries.features.map((item, index) => <path key={item.id || index} d={path(item) || ''}/>)}</g>
            {relations.map(edge => { const source = result.entities.find(item => item.id === edge.source)!; const target = result.entities.find(item => item.id === edge.target)!; const route = path({ type: 'LineString', coordinates: [coordinates(source)!, coordinates(target)!] }); const color = edge.kind === 'alternative' ? '#25a36f' : colors[edge.risk]; return <g key={edge.id} data-entity="" role="button" tabIndex={0} aria-label={`${source.label} vers ${target.label} : ${edge.label}`} onClick={() => { setSelectedRelation(edge.id); setSelected(null); setSelectedEvent(null); setInspector(true);onExplore?.(relationTarget(result,edge)); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedRelation(edge.id); setSelected(null); setSelectedEvent(null); setInspector(true);onExplore?.(relationTarget(result,edge)); } }} className="av-map-route"><path d={route || ''} fill="none" stroke="transparent" strokeWidth="12"/><path d={route || ''} fill="none" stroke={color} strokeWidth={selectedRelation === edge.id ? 3.5 : edge.kind === 'alternative' ? 2 : 1.7} strokeDasharray={edge.kind === 'alternative' ? '6 4' : undefined} opacity={selected && edge.source !== selected && edge.target !== selected ? .2 : .85}><title>{source.label} → {target.label} : {edge.label}</title></path></g>; })}
            {entities.map(item => { const point = projection(coordinates(item)!); if (!point) return null; const labelIndex=entities.filter(other=>other.longitude===item.longitude&&other.latitude===item.latitude).findIndex(other=>other.id===item.id); const labelY=(item.country==='Taïwan'?17+labelIndex*17:-7-labelIndex*19); const active = selected === item.id || event?.entityIds.includes(item.id); const severity = riskAt(item); const count = activeEvents.filter(event => event.entityIds.includes(item.id)).length; return <g key={item.id} data-entity="" transform={`translate(${point[0]} ${point[1]})`} role="button" tabIndex={0} aria-label={`${item.label}, risque ${labels[severity]}${count ? `, ${count} événement actif` : ''}`} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setSelectedEvent(null); setSelectedRelation(null); setInspector(true);onExplore?.(entityTarget(result,item)); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(item.id); setSelectedEvent(null); setSelectedRelation(null); setInspector(true);onExplore?.(entityTarget(result,item)); } }} className="av-map-point">
              {active && <circle r="15" fill={colors[severity]} opacity=".15"/>}{count > 0 && <circle className="av-event-ring" r="11" fill="none" stroke={colors[severity]} strokeWidth="1.6"/>}<circle r={active ? 6 : 4.5} fill={item.kind === 'port' ? '#fff' : colors[severity]} stroke={colors[severity]} strokeWidth="2"/>
              <line x1="2" y1="0" x2="7" y2={labelY+3} stroke="#94a3b8" strokeWidth=".6"/><text x="9" y={labelY} className="av-map-label">{item.label}</text>{count > 0 && <text x="9" y="6" className="av-map-risk-label" fill={colors[severity]}>{count} événement{count > 1 ? 's' : ''}</text>}
            </g>; })}
          </g>
        </svg>
        {!entities.length && <div className="av-map-no-data">Aucun site géolocalisé ne correspond aux filtres. Les coordonnées sont nécessaires pour placer un élément.</div>}
        <div className="av-map-buttons"><button type="button" aria-label="Zoom avant" onClick={() => setZoom(value => Math.min(5, value + .25))}><Plus size={16}/></button><button type="button" aria-label="Zoom arrière" onClick={() => setZoom(value => Math.max(.7, value - .25))}><Minus size={16}/></button><button type="button" aria-label="Recentrer la carte" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><LocateFixed size={16}/></button></div>
        <div className="av-map-legend" role="group" aria-label="Filtres de la légende">{[...new Set(result.entities.map(item=>item.risk))].map(value=><button type="button" key={value} aria-pressed={risk===value} onClick={()=>setRisk(risk===value?'all':value)}><i style={{background:colors[value]}}/>{labels[value]}</button>)}{result.relations.some(item=>item.kind==='alternative')&&<button type="button" aria-pressed={alternatives} onClick={()=>setAlternatives(!alternatives)}><i style={{background:'#25a36f'}}/>Alternative</button>}</div>
      </div>
      {inspector && <aside className="av-network-inspector" aria-label="Détails de la carte">{entity ? <><div className="av-inspector-heading"><strong>{entity.label}</strong><span className={`av-risk is-${riskAt(entity)}`}>{labels[riskAt(entity)]}</span></div><p>{entity.detail}</p>{onExplore&&<button type="button" className="av-explore-result" onClick={()=>onExplore(entityTarget(result,entity))}>Explorer cet élément</button>}<dl>{entity.country && <div><dt>Pays</dt><dd>{entity.country}</dd></div>}{entity.share !== undefined && <div><dt>Part déclarée</dt><dd>{entity.share} %</dd></div>}<div><dt>Événements actifs</dt><dd>{activeEvents.filter(item => item.entityIds.includes(entity.id)).length}</dd></div></dl><EvidenceLinks result={result} onExplore={onExplore} evidence={result.evidence} ids={entity.evidenceIds}/></> : event ? <><div className="av-inspector-heading"><strong>{event.title}</strong><span className={`av-risk is-${event.severity}`}>{labels[event.severity]}</span></div><time>{formatDate(timestamp(event.date))}</time><p>{event.detail}</p>{onExplore&&<button type="button" className="av-explore-result" onClick={()=>onExplore(eventTarget(result,event))}>Explorer cet événement</button>}<h4>Éléments concernés</h4><div className="av-related-list">{event.entityIds.map(id => { const item = result.entities.find(entity => entity.id === id); return item && <button type="button" key={id} onClick={() => { setSelected(id); setSelectedEvent(null); setSelectedRelation(null);onExplore?.(entityTarget(result,item)); }}><span>{item.label}</span><ChevronRight size={14}/></button>; })}</div><EvidenceLinks result={result} onExplore={onExplore} evidence={result.evidence} ids={event.evidenceIds}/></> : relation ? <><div className="av-inspector-heading"><strong>{relation.label}</strong><span className={`av-risk is-${relation.risk}`}>{labels[relation.risk]}</span></div><dl><div><dt>Départ</dt><dd>{result.entities.find(item => item.id === relation.source)?.label}</dd></div><div><dt>Destination</dt><dd>{result.entities.find(item => item.id === relation.target)?.label}</dd></div>{relation.share !== undefined && <div><dt>Part déclarée</dt><dd>{relation.share} %</dd></div>}{relation.delayDays !== undefined && <div><dt>Délai déclaré</dt><dd>{relation.delayDays} jours</dd></div>}</dl>{onExplore&&<button type="button" className="av-explore-result" onClick={()=>onExplore(relationTarget(result,relation))}>Explorer cette relation</button>}<EvidenceLinks result={result} onExplore={onExplore} evidence={result.evidence} ids={relation.evidenceIds}/></> : <div className="av-inspector-empty"><Ship size={24}/><strong>Sites, flux et événements</strong><p>Sélectionnez un site sur la carte ou un événement dans la chronologie pour consulter ses détails et ses sources.</p><p>{activeEvents.length} événement{activeEvents.length !== 1 ? 's' : ''} actif{activeEvents.length !== 1 ? 's' : ''} à la date choisie.</p></div>}</aside>}
    </div>
    <div className="av-time-control"><button type="button" className="av-play" disabled={reducedMotion || !result.events.length} aria-label={playing ? 'Mettre la chronologie en pause' : 'Lire la chronologie'} title={reducedMotion ? 'Lecture automatique désactivée : préférence de mouvement réduit' : undefined} onClick={() => { if (day >= result.horizonDays) setDay(0); setPlaying(!playing); }}>{playing ? <Pause size={17}/> : <Play size={17}/>}</button><label>Période d’analyse <input type="range" min="0" max={result.horizonDays} value={day} onChange={event => { setPlaying(false); setDay(Number(event.target.value)); }} aria-label="Jour de la chronologie" aria-valuetext={`${day === 0 ? 'Début de période' : `Plus ${day} jours`}, ${formatDate(currentTime)}`}/><span className="av-time-labels"><span>Début de période</span><strong>+{day} j</strong><span>+{result.horizonDays} j</span></span></label>{[0, 30, 60, 90].filter(value => value <= result.horizonDays).map(value => <button type="button" key={value} className={day === value ? 'is-active' : ''} onClick={() => { setDay(value); setPlaying(false); }}>{value === 0 ? 'Début de période' : `+${value} j`}</button>)}</div>
    <div className="av-chronology-bottom"><section className="av-event-list"><h3>Chronologie des événements</h3>{result.events.length ? [...result.events].sort((a, b) => timestamp(a.date) - timestamp(b.date)).map(item => <button type="button" key={item.id} className={`${selectedEvent === item.id ? 'is-selected' : ''}${timestamp(item.date) < currentTime + DAY ? ' is-reached' : ''}`} onClick={() => pickEvent(item)}><i style={{ background: colors[item.severity] }}/><time>{formatDate(timestamp(item.date))}</time><span><strong>{item.title}</strong><small>{item.detail}</small></span><ChevronRight size={14}/></button>) : <p className="av-muted">Aucun événement daté fourni par l’analyse.</p>}</section><section className="av-chronology-chart"><h3>Prévision du coût · {result.costUnit}</h3>{result.scenarios.some(item => item.series.length) ? <ForecastChart compact onExplore={onExplore} series={result.scenarios.filter(item => item.series.length).map(item => ({ target:scenarioTarget(result,item), id: item.id, label: item.label, color: item.kind === 'base' ? '#2875e8' : item.kind === 'adverse' ? '#e44e5a' : '#25a36f', points: item.series, dashed: item.kind !== 'base' }))} unit={result.costUnit} height={190}/> : <p className="av-muted">Aucune série prévisionnelle disponible. Les événements datés restent consultables.</p>}</section></div>
  </section>;
}
