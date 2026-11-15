import type { ExploreHandler, ExplorationTarget } from '../analysis-interactions/types';
export const viewNames = { chronology: 'Chronologie', propagation: 'Propagation', scenarios: 'Scénarios', dependencies: 'Dépendances', simulator: 'Simulateur' } as const;
export type AnalysisView = keyof typeof viewNames;
export type Risk = 'unknown' | 'low' | 'medium' | 'high';
export type Evidence = { id: string; title: string; url: string; publisher: string; publishedAt: string; excerpt?: string };
export type Entity = { id: string; label: string; kind: 'supplier' | 'component' | 'site' | 'port' | 'product' | 'policy'; country?: string; longitude?: number; latitude?: number; tier?: number; risk: Risk; share?: number; detail: string; evidenceIds: string[] };
export type Relation = { id: string; source: string; target: string; kind: 'supply' | 'transport' | 'impact' | 'alternative'; label: string; risk: Risk; share?: number; delayDays?: number; evidenceIds: string[] };
export type AnalysisEvent = { id: string; title: string; date: string; entityIds: string[]; severity: Risk; detail: string; evidenceIds: string[]; endDate?: string };
export type SeriesPoint = { day: number; value: number; lower?: number; upper?: number };
export type Scenario = { id: string; label: string; kind: 'base' | 'adverse' | 'mitigation'; description: string; cost: number; delayDays: number; servicePct: number; evidenceIds: string[]; assumptions: string[]; series: SeriesPoint[]; edgeIds: string[] };
export type SimulationModel = { method: 'linear-sensitivity-v1'; baselineCost: number; baselineDelayDays: number; baselineServicePct: number; closureCostPerDay: number; closureDelayPerDay: number; tariffExposurePct: number; alternateCostPct: number; alternateDelayDays: number; serviceLossPerDelayDay: number; maxClosureDays: number; maxTariffPct: number; assumptions: string[]; evidenceIds: string[] };
export type AnalysisResult = { schemaVersion: '1.0'; analysisId: string; resultVersion: number; accountId: string; title: string; company: string; question: string; asOf: string; horizonDays: number; currency: string; costUnit: string; provenance: 'illustrative' | 'research'; status: 'completed' | 'partial'; summary: string; limitations: string[]; entities: Entity[]; relations: Relation[]; events: AnalysisEvent[]; scenarios: Scenario[]; evidence: Evidence[]; simulation?: SimulationModel };
export type SimulationInputs = { entityId:string; closureDays:number; tariffPct:number; alternate:boolean; alternateDelayDays:number };
export type ViewContext = { simulationInputs?:SimulationInputs };
export type ViewProps = { result: AnalysisResult; onContextChange?:(context:ViewContext)=>void; onExplore?:ExploreHandler };

const riskNames: Record<Risk,string> = { unknown:'Non évalué', low:'Faible', medium:'Modéré', high:'Élevé' };
const displayNumber = (value:number) => new Intl.NumberFormat('fr-CA',{maximumFractionDigits:2}).format(value);
const firstEvidence = (result:AnalysisResult,ids:string[]) => result.evidence.find(item=>ids.includes(item.id));
export function evidenceTarget(result:AnalysisResult,evidence:Evidence):ExplorationTarget {
 return {id:`${result.analysisId}:v${result.resultVersion}:source:${evidence.id}`,kind:'source',title:evidence.title,summary:evidence.excerpt??`Document fourni par ${evidence.publisher}, publié le ${evidence.publishedAt}.`,date:evidence.publishedAt,source:{title:evidence.title,url:evidence.url,excerpt:evidence.excerpt,publisher:evidence.publisher},classification:result.provenance,analysisId:result.analysisId};
}
export function entityTarget(result:AnalysisResult,entity:Entity):ExplorationTarget {
 const source=firstEvidence(result,entity.evidenceIds);
 return {id:`${result.analysisId}:v${result.resultVersion}:entity:${entity.id}`,kind:'point',title:entity.label,summary:entity.detail,date:result.asOf,classification:result.provenance,analysisId:result.analysisId,source:source?evidenceTarget(result,source).source:undefined,metrics:[{label:'Risque déclaré',value:riskNames[entity.risk]},...(entity.country?[{label:'Pays',value:entity.country}]:[]),...(entity.share!==undefined?[{label:'Part déclarée',value:`${displayNumber(entity.share)} %`}]:[]),...(entity.tier!==undefined?[{label:'Rang fournisseur',value:String(entity.tier)}]:[])]};
}
export function relationTarget(result:AnalysisResult,relation:Relation):ExplorationTarget {
 const source=firstEvidence(result,relation.evidenceIds);
 const from=result.entities.find(item=>item.id===relation.source)?.label??relation.source;
 const to=result.entities.find(item=>item.id===relation.target)?.label??relation.target;
 return {id:`${result.analysisId}:v${result.resultVersion}:relation:${relation.id}`,kind:'point',title:relation.label,summary:`${from} → ${to}.`,date:result.asOf,classification:result.provenance,analysisId:result.analysisId,source:source?evidenceTarget(result,source).source:undefined,metrics:[{label:'Risque déclaré',value:riskNames[relation.risk]},...(relation.share!==undefined?[{label:'Part déclarée',value:`${displayNumber(relation.share)} %`}]:[]),...(relation.delayDays!==undefined?[{label:'Délai déclaré',value:`${displayNumber(relation.delayDays)} jours`}]:[])]};
}
export function eventTarget(result:AnalysisResult,event:AnalysisEvent):ExplorationTarget {
 const source=firstEvidence(result,event.evidenceIds);
 return {id:`${result.analysisId}:v${result.resultVersion}:event:${event.id}`,kind:'event',title:event.title,summary:event.detail,date:event.date,classification:result.provenance,analysisId:result.analysisId,source:source?evidenceTarget(result,source).source:undefined,metrics:[{label:'Sévérité déclarée',value:riskNames[event.severity]},...(event.endDate?[{label:'Fin déclarée',value:event.endDate}]:[])]};
}
export function scenarioTarget(result:AnalysisResult,scenario:Scenario):ExplorationTarget {
 const source=firstEvidence(result,scenario.evidenceIds);
 return {id:`${result.analysisId}:v${result.resultVersion}:scenario:${scenario.id}`,kind:'conclusion',title:scenario.label,summary:[scenario.description,...scenario.assumptions].join('\n'),date:result.asOf,classification:result.provenance==='illustrative'?'illustrative':'conditional',analysisId:result.analysisId,source:source?evidenceTarget(result,source).source:undefined,metrics:[{label:`Coût (${result.costUnit})`,value:displayNumber(scenario.cost)},{label:'Délai moyen',value:`${displayNumber(scenario.delayDays)} jours`},{label:'Niveau de service',value:`${displayNumber(scenario.servicePct)} %`} ]};
}

export function seriesPointTarget(base:ExplorationTarget,label:string,point:SeriesPoint,unit:string):ExplorationTarget {
 return {...base,id:`${base.id}:day:${point.day}`,kind:'point',title:`${label} · +${point.day} jours`,metrics:[{label:'Horizon',value:`+${point.day} jours`},{label:`Valeur (${unit})`,value:displayNumber(point.value)},...(point.lower!==undefined?[{label:'Borne basse',value:`${displayNumber(point.lower)} ${unit}`}]:[]),...(point.upper!==undefined?[{label:'Borne haute',value:`${displayNumber(point.upper)} ${unit}`}]:[])]};
}
