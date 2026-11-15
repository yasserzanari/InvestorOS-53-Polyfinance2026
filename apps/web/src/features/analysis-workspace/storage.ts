import { canonicalResultJSON, MAX_RESULT_BYTES, parseAnalysisResult } from './schema';
import type { AnalysisResult, AnalysisView } from './types';

const legacyKey = (account: string) => `investoros.analysis-results.v1.${account}`;
const recordPrefix = (account: string) => `investoros.analysis-result.v2.${encodeURIComponent(account).replace(/\./g,'%2E')}.`;
const identity = (result: AnalysisResult) => JSON.stringify([result.analysisId, result.resultVersion]);
export const RESULTS_CHANGED_EVENT = 'investoros:analysis-results';
export type ResultStorageIssue = { kind: 'unavailable' | 'invalid' | 'conflict'; message: string };
type StoredResult = { key: string; result: AnalysisResult; canonical: string; savedAt: number };

function collect(account: string): { records: StoredResult[]; issues: ResultStorageIssue[] } {
  const records: StoredResult[] = [];
  const issues: ResultStorageIssue[] = [];
  const append = (item: unknown, key: string, savedAt = 0) => {
    try {
      const result = parseAnalysisResult(item);
      if (result.accountId !== account) throw new Error('Compte incohérent.');
      records.push({ key, result, canonical: canonicalResultJSON(result), savedAt });
    } catch { issues.push({kind:'invalid',message:'Un résultat local invalide a été ignoré; les autres résultats sont conservés.'}); }
  };
  try {
    const storage = window.localStorage;
    const legacy = storage.getItem(legacyKey(account));
    if (legacy) {
      try {
        const raw: unknown = JSON.parse(legacy);
        if (!Array.isArray(raw)) throw new Error('Collection invalide.');
        raw.forEach((item,index) => append(item, `${legacyKey(account)}#${index}`));
      } catch { issues.push({kind:'invalid',message:'L’ancien historique local ne peut pas être lu.'}); }
    }
    // Each result is an independent, append-only entry. Concurrent writes of
    // unrelated analyses cannot replace each other's collection snapshots.
    const keys = Array.from({length:storage.length},(_,index)=>storage.key(index)).filter((key):key is string=>Boolean(key?.startsWith(recordPrefix(account))));
    for (const key of keys) {
      try {
        const encoded = storage.getItem(key);
        if (encoded === null) continue;
        if (new TextEncoder().encode(encoded).length > MAX_RESULT_BYTES + 1024) throw new Error('Résultat trop volumineux.');
        const envelope: unknown = JSON.parse(encoded);
        if (!envelope || typeof envelope !== 'object') throw new Error('Enveloppe invalide.');
        const record = envelope as {result?:unknown;savedAt?:unknown};
        if (typeof record.savedAt !== 'number' || !Number.isSafeInteger(record.savedAt) || record.savedAt < 0) throw new Error('Date invalide.');
        append(record.result,key,record.savedAt);
      } catch { issues.push({kind:'invalid',message:'Un résultat local invalide a été ignoré; les autres résultats sont conservés.'}); }
    }
  } catch { issues.push({kind:'unavailable',message:'Le stockage du navigateur est indisponible.'}); }
  return {records,issues};
}

function resolve(records: StoredResult[]): { results: AnalysisResult[]; issues: ResultStorageIssue[] } {
  const grouped = new Map<string,StoredResult[]>();
  for (const record of records) {
    const id = identity(record.result);
    grouped.set(id,[...(grouped.get(id) ?? []),record]);
  }
  const issues: ResultStorageIssue[] = [];
  const retained: StoredResult[] = [];
  for (const entries of grouped.values()) {
    entries.sort((left,right)=>left.savedAt-right.savedAt || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
    const previous = entries[0];
    retained.push(previous);
    if (entries.some(entry=>entry.canonical !== previous.canonical)) issues.push({kind:'conflict',message:`Plusieurs contenus existent pour ${previous.result.analysisId} v${previous.result.resultVersion}. La première version conservée reste affichée; publiez une nouvelle version.`});
  }
  retained.sort((left,right)=>right.savedAt-left.savedAt || Date.parse(right.result.asOf)-Date.parse(left.result.asOf));
  return {results:retained.map(record=>record.result),issues};
}

export function readResults(account: string): AnalysisResult[] {
  return resolve(collect(account).records).results;
}

/** Report recoverable corruption/conflicts without crashing workspace rendering. */
export function resultStorageIssues(account: string): ResultStorageIssue[] {
  const stored = collect(account);
  return [...stored.issues,...resolve(stored.records).issues];
}

export function saveResult(account: string, input: unknown): AnalysisResult {
  const result = parseAnalysisResult(input);
  if (result.accountId !== account) throw new Error('Cette analyse appartient à un autre compte.');
  const stored = collect(account);
  if (stored.issues.some(issue=>issue.kind === 'unavailable')) throw new Error('Le stockage du navigateur est indisponible.');
  const canonical = canonicalResultJSON(result);
  const matches = stored.records.filter(record=>identity(record.result) === identity(result));
  if (matches.some(previous=>previous.canonical !== canonical)) throw new Error('Cette version existe déjà. Publiez une nouvelle version pour conserver le résultat précédent.');
  if (matches.length) return matches[0].result;
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const key = `${recordPrefix(account)}${encodeURIComponent(result.analysisId)}.${result.resultVersion}.${suffix}`;
  try {
    window.localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),result}));
    // Unique record keys preserve even simultaneous writes. Check for a
    // competing immutable version without overwriting or deleting its data.
    const concurrent = collect(account).records.filter(record=>identity(record.result) === identity(result));
    if (concurrent.some(previous=>previous.canonical !== canonical)) {
      window.localStorage.removeItem(key);
      throw new Error('Une autre fenêtre a enregistré un contenu différent pour cette version. Publiez une nouvelle version.');
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Une autre fenêtre')) throw error;
    throw new Error('Le stockage du navigateur est plein ou indisponible. Exportez vos résultats avant de réessayer; aucun résultat existant n’a été supprimé.');
  }
  window.dispatchEvent(new CustomEvent(RESULTS_CHANGED_EVENT,{detail:{accountId:account}}));
  return result;
}

export function resultFromTool(output: unknown): AnalysisResult | null {
  if (!output || typeof output !== 'object') return null;
  const envelope = output as Record<string,unknown>;
  for (const candidate of [envelope.visualization,envelope.analysisResult,envelope.result,envelope]) {
    try { return parseAnalysisResult(candidate); } catch { /* Only an explicit validated contract can open a view. */ }
  }
  return null;
}

export type AnalysisTabRef = { analysisId?: string; resultVersion?: number; view?: AnalysisView };
export function downloadResult(result: AnalysisResult) {
  const validated = parseAnalysisResult(result);
  const url = URL.createObjectURL(new Blob([JSON.stringify(validated,null,2)],{type:'application/json'}));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `analyse-${validated.analysisId}-v${validated.resultVersion}.json`;
  anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
