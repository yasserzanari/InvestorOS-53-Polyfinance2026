import type { ResearchEvidence, ResearchRun } from '../profiles/research-workspace';
import { contentRecord } from '../analyses/research-presentation';
import { fullDate, preciseDate, sourceTime, sourceUrl } from './presentation';
import type { ExplorationTarget } from './types';

export type EventDetailSource = {
  id: string; title: string; publisher: string; url?: string; excerpt?: string;
  publishedAt?: string; collectedAt?: string; official: boolean; logoKey?: 'nvidia';
  typeLabel: string; method?: string; text?: string;
};
export type EventDetail = {
  title: string; subtitle?: string; facts: { text: string; url?: string }[];
  cards: { id: string; label: string; value: string; detail?: string; kind: 'calendar' | 'clock' | 'published' | 'value' }[];
  sources: EventDetailSource[]; related: ExplorationTarget[]; text: string; note: string;
};

type RecordValue = Record<string, unknown>;
type LocatedRecord = { item: RecordValue; proof: ResearchEvidence; content: RecordValue; scheduled: boolean };
const string = (value: unknown) => typeof value === 'string' ? value : undefined;
const records = (value: unknown): RecordValue[] => Array.isArray(value) ? value.filter((item): item is RecordValue => Boolean(item && typeof item === 'object' && !Array.isArray(item))) : [];
function normalizedUrl(value?: string) {
  const safe = sourceUrl(value);
  if (!safe) return undefined;
  const url = new URL(safe); url.hash = '';
  return url.href;
}
function host(value?: string) {
  const safe = sourceUrl(value);
  return safe ? new URL(safe).hostname.replace(/^www\./, '') : '';
}
const nvidiaHost = (value?: string) => /(^|\.)nvidia\.com$/.test(host(value));
const earningsTitle = (value: string) => /(?:financial results|résultats.*(?:trimestr|financi))/.test(value.toLowerCase());
const officialHost = (value?: string) => nvidiaHost(value) || /(^|\.)(sec\.gov|federalreserve\.gov|bls\.gov|stlouisfed\.org)$/.test(host(value));
function earningsPeriod(value: string) {
  const quarter = value.match(/\b(first|second|third|fourth|[1-4](?:st|nd|rd|th)?)\s+quarter\b/i)?.[1].toLowerCase();
  const year = value.match(/\b(?:fiscal year\s*|FY\s*)(\d{2,4})\b/i)?.[1];
  return { quarter: quarter ? ({ first: '1', second: '2', third: '3', fourth: '4' } as Record<string, string>)[quarter] || quarter[0] : undefined, year: year?.slice(-2) };
}

// Keep the calendar day written by the source, including RFC feed timestamps.
function sourceDay(value: string) {
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const rfc = value.match(/(?:^|\s)(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})(?:\s|$)/i);
  if (rfc) {
    const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(rfc[2].toLowerCase()) + 1;
    return `${rfc[3]}-${String(month).padStart(2, '0')}-${rfc[1].padStart(2, '0')}`;
  }
  return value;
}
function brief(value: string, max = 270) {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max).replace(/\s+\S*$/, '')}…`;
}
function excerptFacts(value: string, url?: string) {
  const seen = new Set<string>();
  return value.split(/\n+/).map(line => line.trim()).filter(line => {
    if (line.length < 45 || /^(?:about\s|for further information|copyright|©|source:|investor relations|corporate communications|\[email|\[?…)/i.test(line)) return false;
    const key = line.replace(/\W/g, '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 3).map(text => ({ text: brief(text), url }));
}
function sourceFromRecord(record: LocatedRecord): EventDetailSource {
  const { item, proof, scheduled } = record;
  const url = sourceUrl(string(item.url) || string(item.document_url) || proof.url);
  const publisher = nvidiaHost(url) ? 'NVIDIA' : proof.source_name || host(url) || 'Source reçue';
  const text = string(item.excerpt) || string(item.text);
  return {
    id: `${proof.evidence_id}:${url || string(item.title) || 'document'}`,
    title: string(item.title) || string(item.form) || proof.source_name || 'Document reçu',
    publisher, url, excerpt: text ? brief(text) : undefined, text,
    publishedAt: string(item.published_at) || string(item.filingDate), collectedAt: proof.collected_at,
    official: officialHost(url), ...(nvidiaHost(url) ? { logoKey: 'nvidia' as const } : {}),
    typeLabel: scheduled ? 'Calendrier de l’événement' : nvidiaHost(url) ? 'Relations investisseurs' : string(item.form) ? `Document ${String(item.form)}` : 'Document source',
    method: string(item.method) || proof.method,
  };
}

export function buildEventDetail(target: ExplorationTarget, events: ExplorationTarget[], run: ResearchRun): EventDetail {
  if (target.kind === 'movement' && target.movement) {
    const move = target.movement;
    const documents = [...move.candidates].sort((a,b)=>Number(/^(8-k|10-[kq]|6-k)$/i.test(a.title))-Number(/^(8-k|10-[kq]|6-k)$/i.test(b.title)));
    const sources: EventDetailSource[] = documents.map(item => ({
      id: item.id, title: item.title, publisher: nvidiaHost(item.url) ? 'NVIDIA' : item.sourceName,
      url: sourceUrl(item.url), excerpt: brief(item.excerpt), text: item.excerpt, publishedAt: item.publishedAt,
      official: officialHost(item.url), ...(nvidiaHost(item.url) ? { logoKey: 'nvidia' as const } : {}), typeLabel: 'Document lu · contexte du mouvement',
    }));
    if (target.source) sources.push({ id: `${target.id}:prices`, title: target.source.title, publisher: 'Source des cours', url: sourceUrl(target.source.url), excerpt: 'Cours ajustés utilisés pour calculer la variation entre les deux clôtures affichées.', official: false, typeLabel: 'Jeu historique' });
    return {
      title: target.title, subtitle: `${fullDate(move.previousDate)} → ${fullDate(move.date)} · cours ajustés du jeu historique`,
      facts: [], cards: (target.metrics || []).map((metric, index) => ({ id: `move:${index}`, label: metric.label, value: metric.value, kind: 'value' })),
      sources, related: events, text: [move.explanation, ...move.candidates.map(item => `${item.title}\n${item.publishedAt}\n${item.excerpt}`)].join('\n\n'),
      note: 'Un document publié dans le même intervalle constitue du contexte. Le rapprochement ne démontre pas qu’il a causé cette variation.',
    };
  }
  const targetUrl = normalizedUrl(target.source?.url);
  const conditional = target.classification === 'conditional';
  const isEarnings = !conditional && target.kind === 'event' && nvidiaHost(target.source?.url) && earningsTitle(target.title);
  const all: LocatedRecord[] = (run.evidence || []).flatMap(proof => {
    const content = contentRecord(proof.content);
    return [
      ...records(content.documents).map(item => ({ item, proof, content, scheduled: false })),
      ...records(content.dated_events).map(item => ({ item, proof, content, scheduled: true })),
    ];
  });
  const direct = all.filter(record => {
    const url = normalizedUrl(string(record.item.url) || string(record.item.document_url));
    const sameTitle = string(record.item.title) === target.title;
    const sameSource = Boolean(targetUrl && url === targetUrl);
    const sameProof = target.id.startsWith(record.proof.evidence_id);
    if (record.scheduled) return target.kind === 'event' && !conditional && sameTitle && (sameSource || sameProof) && (!target.date || !string(record.item.date) || string(record.item.date) === target.date.slice(0, 10));
    return sameSource || (sameTitle && sameProof);
  });
  const proofIds = new Set(direct.map(record => record.proof.evidence_id));
  const selectedPeriod = earningsPeriod(`${target.title} ${direct.map(record => string(record.item.excerpt) || '').join(' ')}`);
  const located = isEarnings ? all.filter(record => {
    if (direct.includes(record)) return true;
    if (!proofIds.has(record.proof.evidence_id) || !earningsTitle(string(record.item.title) || '') || !nvidiaHost(string(record.item.url))) return false;
    const period = earningsPeriod(`${string(record.item.title) || ''} ${string(record.item.excerpt) || ''}`);
    return !(selectedPeriod.quarter && period.quarter && selectedPeriod.quarter !== period.quarter) && !(selectedPeriod.year && period.year && selectedPeriod.year !== period.year);
  }) : direct;
  const primaryDocument = located.find(record => !record.scheduled && normalizedUrl(string(record.item.url) || string(record.item.document_url)) === targetUrl)
    || located.find(record => !record.scheduled);
  const calendar = conditional ? undefined : (located.find(record => record.scheduled && (string(record.item.date) === target.date || isEarnings)) || (target.dateKind === 'scheduled' ? located.find(record => record.scheduled) : undefined));
  const text = !conditional && primaryDocument ? string(primaryDocument.item.excerpt) || target.summary : target.summary;
  const sources = located.map(sourceFromRecord).filter((source, index, list) => list.findIndex(item => item.url ? item.url === source.url : item.id === source.id) === index);
  if (!sources.length && target.source) {
    const proof = (run.evidence || []).find(item => normalizedUrl(item.url) === targetUrl);
    const sourceText = target.source.excerpt || (proof ? string(contentRecord(proof.content).excerpt) : undefined);
    sources.push({
      id: proof?.evidence_id || `${target.id}:source`, title: target.source.title, publisher: nvidiaHost(targetUrl) ? 'NVIDIA' : target.source.publisher || host(targetUrl) || 'Source reçue',
      url: sourceUrl(target.source.url), excerpt: sourceText ? brief(sourceText) : undefined, text: sourceText,
      publishedAt: target.dateKind === 'published' ? target.date : undefined, collectedAt: proof?.collected_at,
      official: officialHost(targetUrl), ...(nvidiaHost(targetUrl) ? { logoKey: 'nvidia' as const } : {}),
      typeLabel: target.dateKind === 'indexed' ? 'Article indexé' : nvidiaHost(targetUrl) ? 'Relations investisseurs' : 'Source associée', method: proof?.method,
    });
  }
  const cards: EventDetail['cards'] = [];
  const scheduledAt = string(calendar?.item.date) || (target.dateKind === 'scheduled' ? target.date : undefined);
  const publication = string(primaryDocument?.item.published_at) || string(calendar?.item.published_at) || (target.dateKind === 'published' ? target.date : undefined);
  if (scheduledAt) cards.push({ id: 'scheduled', label: 'Événement annoncé', value: fullDate(sourceDay(scheduledAt)), kind: 'calendar' });
  const conference = string(calendar?.item.call_time_pt);
  const genericTime = string(calendar?.item.time);
  if (conference || genericTime) cards.push({ id: 'conference', label: conference ? 'Conférence' : 'Heure annoncée', value: sourceTime(conference || genericTime!, conference ? 'Pacifique' : string(calendar?.content.timezone) || 'heure de la source'), kind: 'clock' });
  if (publication) cards.push({ id: 'publication', label: 'Publication', value: fullDate(sourceDay(publication)), detail: /[T:]|\d{2}:\d{2}/.test(publication) ? preciseDate(publication) : undefined, kind: 'published' });
  if (target.date && !scheduledAt && !publication) cards.push({ id: 'date', label: target.dateKind === 'indexed' ? 'Indexation' : target.dateKind === 'observed' ? 'Observation' : conditional ? 'Date du scénario' : 'Date de la source', value: fullDate(sourceDay(target.date)), detail: target.dateLabel, kind: target.dateKind === 'indexed' ? 'published' : 'calendar' });
  const release = string(calendar?.item.release_time_pt);
  if (release) cards.push({ id: 'release', label: 'Publication des résultats', value: sourceTime(release, 'Pacifique'), detail: 'Heure annoncée par la source', kind: 'clock' });
  for (const [index, metric] of (target.metrics || []).entries()) {
    if (conference && /conférence annoncée/i.test(metric.label) || release && /publication des résultats annoncée/i.test(metric.label)) continue;
    cards.push({ id: `metric:${index}`, label: metric.label, value: metric.value, kind: 'value' });
  }
  const facts: EventDetail['facts'] = [];
  if (isEarnings) {
    const factUrl = primaryDocument ? sourceUrl(string(primaryDocument.item.url)) || targetUrl : targetUrl;
    const quarter = text.match(/third quarter of fiscal year\s+(\d{4})/i);
    if (quarter) facts.push({ text: `Résultats du troisième trimestre de l’exercice ${quarter[1]}.`, url: factUrl });
    if (/webcast live/i.test(text) && /investor\.nvidia\.com/i.test(text)) facts.push({ text: 'Conférence diffusée en direct sur le site investisseurs de NVIDIA.', url: factUrl });
    if (/provide written commentary/i.test(text) && /ahead of the call/i.test(text)) facts.push({ text: 'Commentaires écrits de la direction financière publiés avant la conférence.', url: factUrl });
    if (/Q&A session/i.test(text) && /financial analysts and institutional investors/i.test(text)) facts.push({ text: 'Questions réservées aux analystes financiers et aux investisseurs institutionnels.', url: factUrl });
  }
  if (!facts.length) facts.push(...excerptFacts(text, targetUrl));
  if (!facts.length && text.trim()) facts.push({ text: brief(text), url: targetUrl });
  const samePublisher = (event: ExplorationTarget) => {
    if (nvidiaHost(targetUrl)) return nvidiaHost(event.source?.url);
    return Boolean(host(targetUrl) && host(event.source?.url) === host(targetUrl));
  };
  const eventKey = (event: ExplorationTarget) => `${normalizedUrl(event.source?.url)}:${event.title}:${event.date || ''}:${event.dateKind || ''}`;
  const related = events.filter(event => event.id !== target.id && eventKey(event) !== eventKey(target)).filter((event, index, list) => list.findIndex(item => eventKey(item) === eventKey(event)) === index).sort((a, b) => Number(samePublisher(b)) - Number(samePublisher(a)) || (a.date || '').localeCompare(b.date || '') || a.title.localeCompare(b.title));
  const translated = isEarnings && /NVIDIA Sets Conference Call for Third-Quarter Financial Results/i.test(target.title);
  return {
    title: translated ? 'NVIDIA annonce ses résultats trimestriels' : target.title,
    subtitle: translated ? target.title : undefined, facts, cards, sources, related, text,
    note: conditional ? 'Les variations et leur moment d’application sont des hypothèses de simulation. Ils ne sont pas prédits par la source.' : target.kind === 'event' ? scheduledAt ? 'Une annonce précise le calendrier. Elle ne prédit pas la réaction du marché.' : 'Une publication rapporte une annonce. Elle ne démontre pas son effet sur le cours.' : target.kind === 'point' ? 'Les valeurs et leur période proviennent du jeu ou du calcul sélectionné.' : 'Les informations restent attribuées aux documents reçus et à leur période.',
  };
}
