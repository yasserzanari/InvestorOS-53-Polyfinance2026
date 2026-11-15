import { z } from 'zod';
import type { AnalysisResult, AnalysisView } from './types';

const text = z.string().trim().min(1).max(2400);
const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$(?![\s\S])/, 'Identifiant invalide');
const finite = z.number().finite();
const nonnegative = finite.min(0);
const pct = nonnegative.max(100);
const risk = z.enum(['unknown', 'low', 'medium', 'high']);
// Validate calendar/time components before Date.parse: JS accepts 24:00 and Python
// normalizes some malformed UTC offsets unless they are checked explicitly.
function validIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2})))?$/.exec(value);
  if (!match || match[0].length !== value.length || Number(match[1]) < 1) return false;
  if (match[4] !== undefined && (Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59 || Number(match[8] || 0) > 23 || Number(match[9] || 0) > 59)) return false;
  const stamp = Date.parse(value);
  return Number.isFinite(stamp) && new Date(value.slice(0, 10)).toISOString().slice(0, 10) === value.slice(0, 10);
}
const date = z.string().max(40).refine(validIsoDate, 'Date ISO invalide');
export const MAX_RESULT_BYTES = 1_500_000;
const MAX_COST = 1_000_000_000_000_000;
const cost = nonnegative.max(MAX_COST);
export function canonicalResultJSON(value: unknown): string {
  const sort = (item: unknown): unknown => Array.isArray(item) ? item.map(sort) : item !== null && typeof item === 'object' ? Object.fromEntries(Object.entries(item).filter(([,v]) => v !== undefined).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([key,v]) => [key,sort(v)])) : item;
  return JSON.stringify(sort(value));
}
const references = z.array(id).max(100);
const evidenceSchema = z.object({ id, title: text, publisher: text, publishedAt: date, excerpt: z.string().max(10000).nullish().transform(value => value ?? undefined), url: z.string().max(2048).refine(value => {if (!/^https?:\/\//i.test(value) || /[\s\\\x00-\x20\x7f-\x9f]/.test(value)) return false; try {const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;} catch {return false;}}, 'URL HTTP(S) publique requise') }).strict();
const entitySchema = z.object({ id, label: text, kind: z.enum(['supplier','component','site','port','product','policy']), country: z.string().trim().min(1).max(80).nullish().transform(value => value ?? undefined), longitude: finite.min(-180).max(180).nullish().transform(value => value ?? undefined), latitude: finite.min(-90).max(90).nullish().transform(value => value ?? undefined), tier: z.number().int().min(0).max(10).nullish().transform(value => value ?? undefined), risk, share: pct.nullish().transform(value => value ?? undefined), detail: text, evidenceIds: references }).strict().refine(value => (value.longitude === undefined) === (value.latitude === undefined), 'Latitude et longitude doivent être fournies ensemble');
const relationSchema = z.object({ id, source: id, target: id, kind: z.enum(['supply','transport','impact','alternative']), label: text, risk, share: pct.nullish().transform(value => value ?? undefined), delayDays: nonnegative.max(3650).nullish().transform(value => value ?? undefined), evidenceIds: references }).strict();
const eventSchema = z.object({ id, title: text, date, endDate: date.nullish().transform(value => value ?? undefined), entityIds: references, severity: risk, detail: text, evidenceIds: references }).strict().refine(value => !value.endDate || Date.parse(value.endDate) >= Date.parse(value.date), 'La fin doit suivre le début');
const pointSchema = z.object({ day: z.number().int().min(0).max(3650), value: cost, lower: cost.nullish().transform(value => value ?? undefined), upper: cost.nullish().transform(value => value ?? undefined) }).strict().refine(value => (value.lower === undefined) === (value.upper === undefined) && (value.lower === undefined || (value.lower <= value.value && value.upper! >= value.value)), 'Fourchette incomplète ou incohérente');
const scenarioSchema = z.object({ id, label: text, kind: z.enum(['base','adverse','mitigation']), description: text, cost, delayDays: nonnegative.max(3650), servicePct: pct, evidenceIds: references, assumptions: z.array(text).max(50), series: z.array(pointSchema).max(1000), edgeIds: references }).strict().refine(value => value.series.every((point, index, all) => !index || point.day > all[index - 1].day), 'Les jours doivent être strictement croissants');
const simulationSchema = z.object({ method: z.literal('linear-sensitivity-v1'), baselineCost: finite.positive().max(MAX_COST), baselineDelayDays: nonnegative.max(3650), baselineServicePct: pct, closureCostPerDay: nonnegative.max(MAX_COST), closureDelayPerDay: nonnegative.max(10), tariffExposurePct: pct, alternateCostPct: nonnegative.max(1000), alternateDelayDays: nonnegative.max(3650), serviceLossPerDelayDay: nonnegative.max(100), maxClosureDays: z.number().int().min(1).max(365), maxTariffPct: nonnegative.max(1000), assumptions: z.array(text).min(1).max(50), evidenceIds: references }).strict();
export const analysisResultSchema = z.object({ schemaVersion: z.literal('1.0'), analysisId: id, resultVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), accountId: id, title: text, company: text, question: text, asOf: date, horizonDays: z.number().int().min(1).max(3650), currency: z.string().regex(/^[A-Z]{3}$(?![\s\S])/), costUnit: z.string().trim().min(1).max(120), provenance: z.enum(['illustrative','research']), status: z.enum(['completed','partial']), summary: text, limitations: z.array(text).max(100), entities: z.array(entitySchema).max(500), relations: z.array(relationSchema).max(1000), events: z.array(eventSchema).max(500), scenarios: z.array(scenarioSchema).max(20), evidence: z.array(evidenceSchema).max(500), simulation: simulationSchema.nullish().transform(value => value ?? undefined) }).strict().superRefine((value, ctx) => {
  const issue = (message: string, path: (string|number)[] = []) => ctx.addIssue({ code:'custom', message, path });
  for (const key of ['entities','relations','events','scenarios','evidence'] as const) {
    const ids = value[key].map(item => item.id);
    if (new Set(ids).size !== ids.length) issue('Identifiants répétés', [key]);
  }
  const entities = new Set(value.entities.map(item => item.id));
  const edges = new Set(value.relations.map(item => item.id));
  const proofs = new Set(value.evidence.map(item => item.id));
  const check = (ids: string[], set: Set<string>, path: (string|number)[]) => {
    if (new Set(ids).size !== ids.length) issue('Références répétées', path);
    ids.forEach((ref, index) => {if (!set.has(ref)) issue(`Référence inconnue : ${ref}`, [...path,index]);});
  };
  value.entities.forEach((item,index) => check(item.evidenceIds, proofs, ['entities',index,'evidenceIds']));
  value.relations.forEach((item,index) => {check([item.source,item.target], entities, ['relations',index]); check(item.evidenceIds,proofs,['relations',index,'evidenceIds']);});
  value.events.forEach((item,index) => {check(item.entityIds,entities,['events',index,'entityIds']);check(item.evidenceIds,proofs,['events',index,'evidenceIds']);});
  value.scenarios.forEach((item,index) => {check(item.edgeIds,edges,['scenarios',index,'edgeIds']); check(item.evidenceIds,proofs,['scenarios',index,'evidenceIds']); if(item.series.some(point => point.day > value.horizonDays)) issue('Point hors horizon', ['scenarios',index,'series']);});
  const close = (left: number, right: number) => Math.abs(left-right) <= Math.max(0.000001, Math.abs(left)*Number.EPSILON*2, Math.abs(right)*Number.EPSILON*2);
  const base = value.scenarios.filter(item => item.kind === 'base');
  if (base.length > 1 || (value.scenarios.length >= 2 && base.length !== 1)) issue('La comparaison exige un unique scénario de référence', ['scenarios']);
  value.scenarios.forEach((scenario,index) => {
    const final = scenario.series.find(point => point.day === value.horizonDays);
    if (final && !close(final.value, scenario.cost)) issue('Le coût doit correspondre à la valeur de série à l’horizon', ['scenarios',index,'cost']);
  });
  const starts = value.scenarios.flatMap(item => item.series[0]?.day === 0 ? [item.series[0].value] : []);
  if (starts.length > 1 && starts.some(start => !close(start,starts[0]))) issue('Les séries comparées doivent partager leur coût de départ', ['scenarios']);
  if(value.simulation) {
    check(value.simulation.evidenceIds,proofs,['simulation','evidenceIds']);
    if(value.simulation.maxClosureDays > value.horizonDays) issue('La fermeture maximale dépasse l’horizon de l’analyse', ['simulation','maxClosureDays']);
    if(base[0] && (!close(base[0].cost,value.simulation.baselineCost) || !close(base[0].delayDays,value.simulation.baselineDelayDays) || !close(base[0].servicePct,value.simulation.baselineServicePct))) issue('Les références du simulateur doivent correspondre au scénario de base', ['simulation']);
  }
  if(value.status === 'partial' && !value.limitations.length) issue('Un résultat partiel doit expliquer ses limites', ['limitations']);
  if(value.provenance === 'research') {
    if(value.status === 'completed' && !value.evidence.length) issue('Une recherche terminée doit fournir ses preuves', ['evidence']);
    [...value.entities,...value.relations,...value.events,...value.scenarios].forEach(item => {if (!item.evidenceIds.length) issue(`Preuve requise pour ${item.id}`);});
    if(value.simulation && !value.simulation.evidenceIds.length) issue('Le modèle doit citer ses entrées', ['simulation','evidenceIds']);
  }
});

export function parseAnalysisResult(value: unknown): AnalysisResult {
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('Objet JSON requis.');
    if (new TextEncoder().encode(encoded).length > MAX_RESULT_BYTES) throw new Error('Le résultat dépasse 1,5 Mo.');
  } catch (error) { throw new Error(error instanceof Error ? error.message : 'Objet JSON invalide.'); }
  const parsed = analysisResultSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Résultat de visualisation invalide : ${parsed.error.issues.slice(0,4).map(issue => `${issue.path.join('.')} — ${issue.message}`).join(' ; ')}`);
  return parsed.data;
}

export function getAvailableViews(result: AnalysisResult): AnalysisView[] {
  const views: AnalysisView[] = [];
  const mapped = new Set(result.entities.filter(entity => entity.latitude !== undefined && entity.longitude !== undefined).map(entity => entity.id));
  if (result.events.some(event => event.entityIds.some(entity => mapped.has(entity)))) views.push('chronology');
  if (result.relations.some(edge => edge.kind === 'impact')) views.push('propagation');
  if (result.scenarios.length >= 2) views.push('scenarios');
  if (result.relations.some(edge => edge.kind === 'supply' || edge.kind === 'alternative')) views.push('dependencies');
  if (result.simulation && result.entities.some(entity => entity.kind === 'port')) views.push('simulator');
  return views;
}
