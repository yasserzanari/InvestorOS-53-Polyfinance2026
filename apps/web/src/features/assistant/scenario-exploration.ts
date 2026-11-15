import { simulationEventOffset, simulationHorizon, simulationPointOffset, simulationTimeLabel, type SimulationPathPoint, type SimulationProjection } from '../../shared/api';
import type { ExplorationTarget } from '../analysis-interactions/types';
import { safeSourceUrl } from '../profiles/profile-api';

export const scenarioMoney = (value: number, currency: string) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
const exactMoney = (value: number, currency: string) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency, maximumFractionDigits: 12 }).format(value);
export const scenarioOffsetLabel = (projection: SimulationProjection, offset: number) => `${offset} ${simulationTimeLabel(projection, offset)}`;
const safeUrl = (url?: string) => url && safeSourceUrl(url) !== '#' ? safeSourceUrl(url) : undefined;
export function scenarioTargetDate(projection: SimulationProjection, offset: number) {
  if (projection.timeUnit !== 'calendar_days') return undefined;
  const origin = new Date(projection.asOf);
  origin.setUTCDate(origin.getUTCDate() + offset);
  return origin.toISOString().slice(0, 10);
}
export function scenarioPointTarget(projection: SimulationProjection, branch: SimulationProjection['branches'][number], point: SimulationPathPoint): ExplorationTarget {
  const offset = simulationPointOffset(point);
  const url = safeUrl(projection.sourceUrl || projection.provenance?.sourceUrl);
  return {
    id: `simulation:${projection.ticker}:${projection.asOf}:${projection.timeUnit || "observations"}:${simulationHorizon(projection)}:${branch.id}:point:${offset}`, kind: 'point',
    title: `${projection.ticker} · ${branch.title} · +${scenarioOffsetLabel(projection, offset)}`,
    ticker: projection.ticker, date: scenarioTargetDate(projection, offset), classification: 'conditional',
    summary: `Jalon conditionnel calculé, pas un cours futur observé. Hypothèse : ${branch.event}; choc ${branch.shockPct > 0 ? '+' : ''}${branch.shockPct} % après ${scenarioOffsetLabel(projection, simulationEventOffset(branch))}. Le choc est ${point.eventApplied ? 'appliqué' : 'non appliqué'} à ce jalon. Les quantiles sont marginaux et ne constituent pas une probabilité du scénario.`,
    metrics: [
      { label: 'Médiane conditionnelle (p50)', value: exactMoney(point.medianPrice, projection.currency) },
      { label: '10e percentile historique conditionné', value: exactMoney(point.lowerPrice, projection.currency) },
      { label: '90e percentile historique conditionné', value: exactMoney(point.upperPrice, projection.currency) },
      { label: 'Cours de départ du jeu', value: `${exactMoney(projection.startingPrice, projection.currency)} · ${projection.asOf}` },
      { label: 'Horizon du jalon', value: scenarioOffsetLabel(projection, offset) },
    ],
    ...(url ? { source: { title: projection.source, url } } : {}),
  };
}
export function scenarioEventTarget(projection: SimulationProjection, branch: SimulationProjection['branches'][number]): ExplorationTarget {
  const offset = simulationEventOffset(branch);
  const url = safeUrl(branch.sourceUrl);
  return {
    id: `simulation:${projection.ticker}:${projection.asOf}:${projection.timeUnit || "observations"}:${simulationHorizon(projection)}:${branch.id}:event`, kind: 'event',
    title: branch.event, ticker: projection.ticker, date: scenarioTargetDate(projection, offset), classification: 'conditional',
    summary: `Hypothèse de simulation fournie pour « ${branch.title} » : un choc de ${branch.shockPct > 0 ? '+' : ''}${branch.shockPct} % est appliqué après ${scenarioOffsetLabel(projection, offset)}. Le calcul ne vérifie ni la survenue de cet événement ni son effet causal sur le cours.`,
    metrics: [{ label: 'Choc demandé', value: `${branch.shockPct > 0 ? '+' : ''}${branch.shockPct} %` }, { label: 'Décalage demandé', value: scenarioOffsetLabel(projection, offset) }, { label: 'Point de départ du calcul', value: projection.asOf }],
    ...(url ? { source: { title: 'Source fournie pour l’hypothèse', url } } : {}),
  };
}
export function scenarioSourceTarget(projection: SimulationProjection, title: string, url: string, conditional = false): ExplorationTarget {
  return { id: `simulation:${projection.ticker}:source:${conditional ? "hypothesis" : "dataset"}:${url}`, kind: 'source', title, ticker: projection.ticker, summary: conditional ? 'Lien fourni pour une hypothèse conditionnelle; son contenu n’a pas été vérifié par le calcul.' : (projection.sourceDescription || projection.source), classification: conditional ? 'conditional' : projection.sourceClassification === 'illustrative' ? 'illustrative' : projection.sourceClassification === 'observations' ? 'historical' : 'research', source: { title, url }, metrics: [{ label: 'Date du dernier cours utilisé', value: projection.asOf }] };
}
