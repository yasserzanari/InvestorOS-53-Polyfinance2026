import { authenticatedFetch } from '../../shared/auth';
import { profileApiBase } from '../profiles/profile-api';
import type { MarketMovementCandidate } from '../../shared/api';

export type MovementInvestigation = {
  analysisId: string; ticker: string; previousDate: string; date: string; checkedAt: string;
  status: 'partial'; conclusion: string; observations: string[]; synthesisStatus: string;
  benchmarks: { ticker: string; available: boolean; changePct?: number; url?: string; reason?: string }[];
  factors: { category: string; title: string; interpretation: string; counterpoint: string; quote: string; sourceId: string; status: 'hypothesis' }[];
  documents: (Omit<MarketMovementCandidate, 'timing'> & { temporalStatus: string; context: string; documentRole?: string; timing?: string })[];
  news: { status: string; message: string; queryUrl: string; leads: { title: string; url: string; indexedAt: string; publisher: string }[] };
  limitations: string[]; coverage: Record<string, string>; inputDigest: string;
};

export async function investigateMovement(input: { analysisId: string; ticker: string; accountId: string; previousDate: string; date: string }, signal: AbortSignal): Promise<MovementInvestigation> {
  const { analysisId, ...body } = input;
  const response = await authenticatedFetch(`${profileApiBase}/v1/profiles/research/${encodeURIComponent(analysisId)}/movement-investigation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!response.ok) throw new Error(`L’analyse du mouvement est indisponible (${response.status}).`);
  const result = await response.json() as MovementInvestigation;
  if (!result || result.analysisId !== analysisId || result.ticker !== input.ticker || result.previousDate !== input.previousDate || result.date !== input.date || typeof result.conclusion !== 'string' || !Array.isArray(result.observations) || !Array.isArray(result.benchmarks) || !Array.isArray(result.factors) || !Array.isArray(result.documents) || !Array.isArray(result.limitations) || !Array.isArray(result.news?.leads)) throw new Error('Le résultat ne correspond pas à la variation sélectionnée.');
  return result;
}
