import type { FieldKey } from './profile-model';

export type ProfileIssueSeverity = 'warning' | 'missing';
export interface ProfileIssue {
  id: string;
  title: string;
  description: string;
  fields: FieldKey[];
  severity: ProfileIssueSeverity;
}
export interface ProfileAssessment {
  issues: ProfileIssue[];
  completed: number;
}

const labels: Record<FieldKey, string> = {
  objective: 'Objectif', horizon: 'Horizon', riskTolerance: 'Tolérance aux fluctuations',
  lossCapacity: 'Capacité à absorber une perte', liquidity: 'Liquidités et retraits',
  constraints: 'Contraintes', preferences: 'Préférences', knowledge: 'Connaissances financières',
};
const fields = Object.keys(labels) as FieldKey[];
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’‘]/g, "'");

/** A partially specified answer remains incomplete; an example is not a verified fact. */
export function isProfileFieldMissing(value: string | undefined): boolean {
  const text = normalize(value ?? '').trim();
  return !text || /\ba preciser\b|\binconnu(?:e|es|s)?\b|\ba definir\b|\ba confirmer\b|\bnon (?:renseigne|defini|connu|precise)|\bje ne sais pas\b/.test(text);
}

function horizonYears(text: string): { min: number; max: number } | null {
  const normalized = normalize(text);
  const range = normalized.match(/\b(\d{1,2})\s*(?:a|[-–])\s*(\d{1,2})\s*ans?\b/);
  if (range) {
    const min = Number(range[1]); const max = Number(range[2]);
    return min <= max ? { min, max } : null;
  }
  const single = normalized.match(/\b(\d{1,2})\s*ans?\b/);
  if (single) {
    const n = Number(single[1]);
    if (/\b(?:plus de|au dela de)\s+\d/.test(normalized) || /ans?\s+(?:et plus|ou plus)/.test(normalized)) return { min: n, max: Infinity };
    if (/\bmoins de\s+\d/.test(normalized)) return { min: 0, max: n };
    return { min: n, max: n };
  }
  const monthRange = normalized.match(/\b(\d{1,3})\s*(?:a|[-–])\s*(\d{1,3})\s*mois\b/);
  if (monthRange) {
    const min = Number(monthRange[1]) / 12; const max = Number(monthRange[2]) / 12;
    return min <= max ? { min, max } : null;
  }
  const months = normalized.match(/\b(\d{1,3})\s*mois\b/);
  if (months) {
    const n = Number(months[1]) / 12;
    if (/\b(?:plus de|au dela de)\s+\d/.test(normalized) || /mois\s+(?:et plus|ou plus)/.test(normalized)) return { min: n, max: Infinity };
    if (/\bmoins de\s+\d/.test(normalized)) return { min: 0, max: n };
    return { min: n, max: n };
  }
  if (/\b(?:court terme|moins d'un an)\b/.test(normalized)) return { min: 0, max: 3 };
  if (/\blong terme\b/.test(normalized)) return { min: 8, max: Infinity };
  return null;
}

function strongRiskTolerance(text: string): boolean {
  const value = normalize(text);
  if (/\b(?:faibles?|modere(?:e|s|es)?|limiter|eviter)\b|\bne\b.{0,35}\b(?:pas|jamais)\b|\bpas de\b/.test(value)) return false;
  return /\belevee?(?:s)?\b|\bfluctuations? elevees?\b|\bfortes? (?:variations|fluctuations|baisses)\b|\brisque (?:eleve|important)\b/.test(value);
}

function shortTermWithdrawal(text: string): boolean {
  const value = normalize(text);
  // Negated plans cannot establish a positive withdrawal need.
  if (/\baucun|\bpas (?:de|besoin de) retrait|\bsans retrait|\bne\b.{0,45}\bpas\b/.test(value)) return false;
  const numericDeadline = value.match(/\b(?:dans|d'ici)\s+(\d{1,3})\s*(mois|ans?)\b/);
  const nearDeadline = numericDeadline && Number(numericDeadline[1]) > 0 && Number(numericDeadline[1]) <= (numericDeadline[2] === 'mois' ? 36 : 3);
  return /\b(?:retrait|retirer|besoin|necessaire|liquidite)\b/.test(value)
    && (Boolean(nearDeadline) || /\bcourt terme\b|\b(?:dans|d'ici)\s+(?:[123]|un|une|deux|trois)\s*(?:an|ans|mois)\b|\bprochains? mois\b/.test(value));
}

function severeLossConsequences(text: string): boolean {
  const value = normalize(text);
  if (/\b(?:aucune?|faibles?|peu de|sans) consequences?\b|\bsans impact\b|\bpas d'impact\b/.test(value)) return false;
  return /\b(?:ne peux pas|ne peut pas|ne pourrais pas|ne pourrait pas|incapable de)\b.{0,35}\b(?:absorber|supporter|perdre)\b|\b(?:projet|depenses?|besoins?)\b.{0,25}\b(?:important|essentiel|vital)|\b(?:compromet|mettrait en peril|fortes consequences|consequences importantes)\b/.test(value);
}

/** Conservative review prompts, not a suitability score or an investment recommendation. */
export function assessProfile(profile: Record<FieldKey, string>): ProfileAssessment {
  const issues: ProfileIssue[] = [];
  const missing = new Set(fields.filter(key => isProfileFieldMissing(profile[key])));
  for (const key of missing) issues.push({
    id: `missing-${key}`, title: `${labels[key]} à préciser`, severity: 'missing', fields: [key],
    description: profile[key]?.trim()
      ? `La réponse « ${profile[key]} » contient une information encore à préciser.`
      : 'Cette information n’a pas encore été renseignée.',
  });
  const known = (...keys: FieldKey[]) => keys.every(key => !missing.has(key));
  const quote = (key: FieldKey) => `${labels[key]} : « ${profile[key]} »`;
  const years = horizonYears(profile.horizon ?? '');
  if (known('horizon', 'riskTolerance') && years && years.max <= 3 && strongRiskTolerance(profile.riskTolerance)) {
    issues.push({ id: 'short-horizon-high-risk', title: 'Horizon court et fortes fluctuations', severity: 'warning', fields: ['horizon', 'riskTolerance'],
      description: `${quote('horizon')}. ${quote('riskTolerance')}. Confirmez que ces deux réponses décrivent le même capital : une baisse peut survenir avant le retrait prévu.` });
  }
  if (known('horizon', 'liquidity') && years && years.min >= 8 && shortTermWithdrawal(profile.liquidity)) {
    issues.push({ id: 'long-horizon-short-liquidity', title: 'Un retrait proche dans un projet à long terme', severity: 'warning', fields: ['horizon', 'liquidity'],
      description: `${quote('horizon')}. ${quote('liquidity')}. Précisez si le retrait concerne une réserve séparée ou le capital associé à cet horizon.` });
  }
  if (known('riskTolerance', 'lossCapacity') && strongRiskTolerance(profile.riskTolerance) && severeLossConsequences(profile.lossCapacity)) {
    issues.push({ id: 'tolerance-loss-capacity', title: 'Tolérance et conséquences financières à rapprocher', severity: 'warning', fields: ['riskTolerance', 'lossCapacity'],
      description: `${quote('riskTolerance')}. ${quote('lossCapacity')}. Accepter des fluctuations et pouvoir absorber une perte sont deux informations distinctes à clarifier.` });
  }
  return { issues, completed: fields.length - missing.size };
}
