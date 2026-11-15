import type { FieldKey } from '../../profile-model';

export type AlignmentIssue = {
  id: string;
  title: string;
  description: string;
  fields: FieldKey[];
  kind: 'conflict' | 'clarification' | 'missing';
  sourceIds: string[];
  question: string;
};

export type FinancialReference = { id: string; title: string; url: string; principle: string };

export const FINANCIAL_REFERENCES: Record<string, FinancialReference> = {
  'ciro-risk': {
    id: 'ciro-risk',
    title: 'OCRI · Comprendre le risque',
    url: 'https://www.ciro.ca/office-investor/understanding-risk',
    principle: 'La tolérance émotionnelle et la capacité financière de perte sont distinctes ; la capacité peut limiter le risque supportable.',
  },
  'amf-profile': {
    id: 'amf-profile',
    title: 'AMF · Votre profil d’investisseur',
    url: 'https://lautorite.qc.ca/grand-public/outils-et-calculateurs/calculateurs/votre-profil-dinvestisseur',
    principle: 'Les objectifs, l’horizon, les besoins de liquidité et les moyens financiers s’examinent séparément ; différents comptes peuvent avoir des horizons différents.',
  },
  'ciro-kyc': {
    id: 'ciro-kyc',
    title: 'ACVM et OCRI · Avis 31-368, section A.1',
    url: 'https://www.ciro.ca/media/15051/download',
    principle: 'La tolérance et la capacité de perte peuvent différer. Les informations incompatibles doivent être clarifiées dans leur contexte, en documentant leur résolution.',
  },
};

const LABELS: Record<FieldKey, string> = {
  objective: 'Objectif', horizon: 'Horizon', riskTolerance: 'Tolérance aux fluctuations',
  lossCapacity: 'Capacité à absorber une perte', liquidity: 'Liquidités et retraits',
  constraints: 'Contraintes', preferences: 'Préférences', knowledge: 'Connaissances financières',
};
const FIELDS = Object.keys(LABELS) as FieldKey[];
const normalize = (value: string | undefined) => (typeof value === 'string' ? value : '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[’‘]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();

export function isAlignmentFieldMissing(value: string | undefined): boolean {
  // Missing means no usable declaration, not a qualitative answer lacking a number.
  const text = normalize(value).replace(/[.!?:;]+$/g, '').trim();
  return !text || /^(?:(?:objectif|horizon|tolerance(?: aux fluctuations| au risque)?|capacite(?: de perte| a absorber une perte)?|liquidites(?: et retraits)?|besoins de liquidite|contraintes|preferences|connaissances(?: financieres)?)\s*:?\s*)?(?:a preciser|a definir|a confirmer|a renseigner|inconnu(?:e)?|non (?:renseigne|defini|connu|precise)(?:e)?|je ne sais pas|oui|non)$/.test(text);
}

const WORD_NUMBERS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6,
  sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20,
};
const NUMBER = '(?:\\d+(?:[.,]\\d+)?|' + Object.keys(WORD_NUMBERS).join('|') + ')';
const UNIT = '(?:mois|ans?|annees?)';
type Duration = { months: number; label: string; index: number };

function singleDuration(text: string): Duration | null {
  // This parser deliberately abstains on ranges and multiple projects. No first-number
  // shortcut, assumed "short/long" duration or statutory risk threshold is used.
  if (new RegExp(`\\b${NUMBER}\\s*(?:a|-|et)\\s*${NUMBER}\\s*${UNIT}\\b`).test(text)) return null;
  const matches = [...text.matchAll(new RegExp(`\\b(${NUMBER})\\s*(${UNIT})\\b`, 'g'))];
  if (matches.length !== 1) return null;
  const match = matches[0];
  const number = WORD_NUMBERS[match[1]] ?? Number(match[1].replace(',', '.'));
  const months = number * (match[2] === 'mois' ? 1 : 12);
  return Number.isFinite(months) && months > 0
    ? { months, label: match[0], index: match.index! }
    : null;
}

const UNCERTAIN = /\b(?:si|peut-?etre|peut etre|environ|vers|probablement|possiblement|potentiellement|possible(?:s)?|eventuel(?:le|s|les)?|hypothese|hypothetique|supposons|envisage|envisageons|pourrais|pourrait|pourraient|aurais|aurait|auraient|serait|seraient|devrais|devrait|souhaiterais|souhaiterait|incertain(?:e)?|sauf|except(?:e|ion)?|a moins|a preciser|a confirmer|je ne sais pas)\b/;
const SEPARATE = /\b(?:separe(?:e|s|es)?|distinct(?:e|s|es)?|different(?:e|s|es)?|autre(?:s)?)\b/;
const NEGATIVE = /\b(?:pas|jamais|aucun(?:e)?|sans|non|ni)\b|\bn[' ]/;
const SAME_MONEY = '(?:(?:ce|cet|cette|ces)\\s+(?:meme(?:s)?\\s+)?|(?:le|la|les)\\s+meme(?:s)?\\s+)(?:capital|fonds|argent|somme|epargne|portefeuille|compte)';
const WHOLE_SAME_MONEY = new RegExp(`(?:\\b(?:tout|toute|tous|toutes|(?:la )?totalite|100\\s*%)|(?:l'|la )integralite)\\s+(?:(?:de|du|des)\\s+)?${SAME_MONEY}\\b`);

function explicitTimingConflict(horizon: string, liquidity: string): { lock: Duration; need: Duration } | null {
  if (horizon.length > 4_000 || liquidity.length > 4_000) return null;
  const h = normalize(horizon), l = normalize(liquidity);
  const horizonWithoutLockQualifier = h.replace(/\b(aucun retrait|pas de retrait|sans retrait)s? possible\b/g, '$1');
  if (UNCERTAIN.test(horizonWithoutLockQualifier) || UNCERTAIN.test(l) || SEPARATE.test(h) || SEPARATE.test(l)) return null;
  // These negative phrases state the lock itself; other negations may reverse it.
  const restOfHorizon = h.replace(/\b(?:aucun retrait|pas de retrait|sans retrait)s?\b/g, '');
  if (NEGATIVE.test(restOfHorizon) || NEGATIVE.test(l)) return null;
  const lock = singleDuration(h), need = singleDuration(l);
  if (!lock || !need || need.months >= lock.months) return null;
  const lockPrefix = h.slice(0, lock.index).trim();
  const noWithdrawal = /\b(?:aucun retrait|pas de retrait|sans retrait)s?\s+(?:possible\s+)?(?:avant|pendant|durant)\s*$/.test(lockPrefix);
  const capitalLocked = /\b(?:capital|fonds|argent|epargne|compte|portefeuille|somme)\b.{0,60}\b(?:bloque(?:e|s|es)?|immobilise(?:e|s|es)?)\s*(?:(?:pendant|durant|pour)\s*)?$/.test(lockPrefix);
  const needPrefix = l.slice(0, need.index).trim();
  if (!(noWithdrawal || capitalLocked) || !WHOLE_SAME_MONEY.test(l)) return null;
  if (!/\b(?:besoin|necessaire|indispensable|dois|doit|doivent|devrai|devra|requis|requise|obligatoire)\b/.test(l)) return null;
  if (!/(?:\bdans|\bd'ici|\bsous|\bavant)\s*$/.test(needPrefix)) return null;
  return { lock, need };
}

function highTolerance(value: string): boolean {
  const text = normalize(value);
  if (text.length > 4_000 || UNCERTAIN.test(text) || NEGATIVE.test(text) || /\b(?:faible|modere)(?:e|s|es)?\b/.test(text)) return false;
  return /^(?:tres )?eleve(?:e)?[.!]?$/.test(text)
    || /\b(?:tolerance|risque|fluctuations?|variations?|baisses?)\s+(?:tres\s+)?(?:eleve|fort)(?:e|s|es)?\b/.test(text)
    || /\b(?:fortes|importantes)\s+(?:baisses|variations|fluctuations)\b/.test(text);
}

function limitedLossCapacity(value: string): boolean {
  const text = normalize(value);
  if (text.length > 4_000 || /\b(?:je ne sais pas|a preciser|a confirmer|hypothese|supposons)\b/.test(text)) return false;
  if (/\b(?:aucun(?:e)?|faibles?|sans)\s+(?:consequence|impact)(?:s)?\b|\bsans compromettre\b/.test(text)) return false;
  return /\b(?:ne (?:peux|peut|pourrais|pourrait) pas|incapable de|impossible de)\b.{0,60}\b(?:absorber|supporter|perdre)\b/.test(text)
    || /\b(?:aucune capacite|aucune marge)\b.{0,40}\b(?:perte|baisse)\b/.test(text)
    || /\b(?:perte|baisse)\b.{0,60}\b(?:compromettrait|compromet|empecherait|mettrait en peril|met en peril)\b/.test(text);
}

/** Educational review of explicit declarations, not a suitability or compliance verdict.
 * Only a narrowly parsed, same-capital time contradiction can be a conflict. Other
 * phrasing can remain unclassified; no issue does not mean a profile is validated. */
export function assessAlignment(profile: Record<FieldKey, string>): AlignmentIssue[] {
  const issues: AlignmentIssue[] = [];
  const missingFields = new Set(FIELDS.filter(key => isAlignmentFieldMissing(profile[key])));
  for (const key of missingFields) {
    issues.push({
      id: `missing-${key}`, title: `${LABELS[key]} à préciser`, kind: 'missing', fields: [key],
      description: 'Cette information ne contient pas encore de réponse exploitable.',
      sourceIds: [key === 'riskTolerance' || key === 'lossCapacity' ? 'ciro-risk' : 'amf-profile'],
      question: `Que souhaitez-vous préciser concernant « ${LABELS[key]} » ?`,
    });
  }
  if (!missingFields.has('horizon') && !missingFields.has('liquidity')) {
    const timing = explicitTimingConflict(profile.horizon, profile.liquidity);
    if (timing) issues.push({
      id: 'same-capital-timing', title: 'Deux échéances incompatibles pour le même capital',
      kind: 'conflict', fields: ['horizon', 'liquidity'], sourceIds: ['amf-profile', 'ciro-kyc'],
      description: `Vous indiquez une absence de retrait ou un blocage pendant ${timing.lock.label}, mais la totalité du même capital est nécessaire dans ${timing.need.label}.`,
      question: 'Quelle échéance faut-il retenir pour la totalité de ce même capital ?',
    });
  }
  if (!missingFields.has('riskTolerance') && !missingFields.has('lossCapacity')
      && highTolerance(profile.riskTolerance) && limitedLossCapacity(profile.lossCapacity)) {
    issues.push({
      id: 'tolerance-loss-capacity', title: 'Tolérance et capacité de perte à distinguer',
      kind: 'clarification', fields: ['riskTolerance', 'lossCapacity'], sourceIds: ['ciro-risk', 'ciro-kyc'],
      description: 'Accepter des fluctuations et pouvoir absorber une perte sont deux choses distinctes. Ces réponses appellent une précision sur le capital concerné, sans établir une contradiction.',
      question: 'Comment distinguez-vous votre aisance face aux fluctuations du capital nécessaire à votre projet ?',
    });
  }
  return issues;
}
