import type { DemoOverview } from '../../../shared/api';
import type { Profile } from '../../profiles/profile-model';
import { portfolioDisplayLabel } from '../utils/portfolio-label';

export type PortfolioObservation = {
  id: string;
  label: string;
  weightPct: number;
  value: number;
  ticker?: string;
};

export type PortfolioRiskFact = {
  label: string;
  value: string | number;
  format?: 'percent' | 'money' | 'number';
};

export type PortfolioRiskInsight = {
  id: 'concentration' | 'sensitivity' | 'profile' | 'coverage';
  category: string;
  title: string;
  metric: string;
  summary: string;
  explanation: string;
  facts: PortfolioRiskFact[];
  limitations: string[];
};

export type PortfolioFacts = {
  positions: PortfolioObservation[];
  largest: PortfolioObservation | null;
  leading: PortfolioObservation[];
  topThreeWeightPct: number;
  concentrationIndex: number;
  identifiedTickers: PortfolioObservation[];
  positionsWithoutTicker: PortfolioObservation[];
};

/** Pure, reproducible measurements over the portfolio positions that were actually loaded. */
export function summarizePortfolio(portfolio: DemoOverview['portfolio']): PortfolioFacts {
  const positions = portfolio.positions
    .filter((position) => Number.isFinite(position.weight_pct) && Number.isFinite(position.value))
    .map((position) => ({
      id: position.id,
      label: portfolioDisplayLabel(position.label),
      weightPct: position.weight_pct,
      value: position.value,
      ...(position.ticker?.trim() ? { ticker: position.ticker.trim() } : {}),
    }))
    .sort((left, right) => right.weightPct - left.weightPct || left.label.localeCompare(right.label, 'fr-CA'));

  return {
    positions,
    largest: positions[0] ?? null,
    leading: positions.slice(0, 3),
    topThreeWeightPct: positions.slice(0, 3).reduce((total, position) => total + position.weightPct, 0),
    concentrationIndex: positions.reduce((total, position) => total + (position.weightPct / 100) ** 2, 0),
    identifiedTickers: positions.filter((position) => Boolean(position.ticker)),
    positionsWithoutTicker: positions.filter((position) => !position.ticker),
  };
}

function fieldIsUnknown(value: string) {
  const normalized = value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-CA').replace(/[.!?…]+$/, '').trim();
  return !normalized || ['a preciser', 'non renseignee', 'non renseigne', 'inconnue', 'inconnu', 'a determiner'].includes(normalized);
}

/** Produces the four clickable, evidence-backed portfolio observations shown by the page. */
export function buildPortfolioRiskInsights(
  portfolio: DemoOverview['portfolio'],
  profile: Profile,
): { facts: PortfolioFacts; insights: PortfolioRiskInsight[] } {
  const facts = summarizePortfolio(portfolio);
  const currency = portfolio.currency;
  const topFacts: PortfolioRiskFact[] = facts.leading.map((position) => ({
    label: position.label,
    value: position.weightPct,
    format: 'percent',
  }));
  topFacts.push({ label: 'Indice de concentration · somme des poids au carré', value: facts.concentrationIndex });

  const largest = facts.largest;
  const onePercentImpact = largest ? largest.weightPct * 0.01 : 0;
  const onePercentValue = largest ? largest.value * 0.01 : 0;
  const capacityUnknown = fieldIsUnknown(profile.lossCapacity);
  const unidentifiedNames = facts.positionsWithoutTicker.map((position) => position.label).join(', ');

  const insights: PortfolioRiskInsight[] = [
    {
      id: 'concentration',
      category: 'Répartition',
      title: 'Poids des principales positions',
      metric: `${facts.topThreeWeightPct.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %`,
      summary: 'Part du portefeuille portée par ses trois plus grandes positions.',
      explanation: 'Une plus grande pondération donne à une ligne un effet arithmétique plus important sur la valeur totale quand son prix varie. Cet indicateur décrit la répartition des montants déclarés; il ne classe pas la concentration comme faible ou élevée.',
      facts: topFacts,
      limitations: [
        'Aucun seuil de concentration n’est fourni pour qualifier ce résultat.',
        'Le poids ne mesure pas la volatilité, la probabilité de perte ni la corrélation entre positions.',
        'Les positions sans détail interne ne permettent pas de calculer les expositions sous-jacentes.',
      ],
    },
    {
      id: 'sensitivity',
      category: 'Scénario arithmétique',
      title: 'Sensibilité de la ligne dominante',
      metric: largest ? `±${onePercentImpact.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` : '—',
      summary: largest
        ? `Effet sur le portefeuille si « ${largest.label} » variait de ±1 %, toutes les autres lignes restant inchangées.`
        : 'Aucune position exploitable n’est disponible pour illustrer une sensibilité.',
      explanation: 'C’est une multiplication du poids par un choc hypothétique de 1 %. Elle aide à comprendre le poids de cette ligne dans le total, mais ne prédit ni son mouvement ni une perte future.',
      facts: largest ? [
        { label: 'Position dominante', value: largest.label },
        { label: 'Poids déclaré', value: largest.weightPct, format: 'percent' },
        { label: 'Valeur déclarée', value: largest.value, format: 'money' },
        { label: 'Hypothèse illustrative', value: '±1 % sur cette position; autres lignes inchangées' },
        { label: 'Variation arithmétique de la position', value: onePercentValue, format: 'money' },
        { label: 'Variation arithmétique du portefeuille', value: onePercentImpact, format: 'percent' },
      ] : [],
      limitations: [
        'Le choc de ±1 % est une hypothèse illustrative, pas une observation de marché.',
        'Aucun historique de prix, rendement ou perte maximale n’est utilisé.',
        `Devise des montants : ${currency}.`,
      ],
    },
    {
      id: 'profile',
      category: 'Profil investisseur',
      title: 'Capacité à absorber une perte',
      metric: capacityUnknown ? 'À préciser' : profile.lossCapacity,
      summary: capacityUnknown
        ? `Tolérance déclarée : ${profile.riskTolerance.toLocaleLowerCase('fr-CA')}; la capacité de perte n’est pas renseignée.`
        : `Tolérance déclarée : ${profile.riskTolerance.toLocaleLowerCase('fr-CA')}; capacité de perte : ${profile.lossCapacity.toLocaleLowerCase('fr-CA')}.`,
      explanation: 'Le profil donne un horizon, une tolérance aux fluctuations et des besoins de liquidité. Sans montant de perte que la personne peut absorber ni scénario de baisse mesuré, l’adéquation entre les expositions et sa situation ne peut pas être conclue.',
      facts: [
        { label: 'Objectif', value: profile.objective },
        { label: 'Horizon', value: profile.horizon },
        { label: 'Tolérance aux fluctuations', value: profile.riskTolerance },
        { label: 'Capacité à absorber une perte', value: fieldIsUnknown(profile.lossCapacity) ? 'À préciser' : profile.lossCapacity },
        { label: 'Liquidités et retraits', value: profile.liquidity },
        { label: 'Contraintes', value: profile.constraints },
      ],
      limitations: [
        'La capacité de perte n’est pas convertie en seuil monétaire par la page.',
        'Aucun verdict d’adéquation ou recommandation d’achat, de vente ou de réallocation n’est calculé.',
        'Le profil et les positions sont ceux du compte de démonstration actif.',
      ],
    },
    {
      id: 'coverage',
      category: 'Couverture des données',
      title: 'Historique et composition manquants',
      metric: `${facts.identifiedTickers.length} / ${facts.positions.length} tickers`,
      summary: 'Les pondérations sont disponibles, mais les cours historiques et le détail complet des actifs ne le sont pas.',
      explanation: 'Le ticker identifie une ligne sans fournir à lui seul une série historique ou la composition complète d’un fonds. Ces éléments sont nécessaires pour mesurer les variations passées, les pertes maximales et les chevauchements entre expositions.',
      facts: [
        { label: 'Lignes du portefeuille', value: facts.positions.length, format: 'number' },
        { label: 'Lignes avec ticker', value: facts.identifiedTickers.length, format: 'number' },
        { label: 'Lignes sans ticker', value: unidentifiedNames || 'Aucune' },
        { label: 'Cours historiques fournis', value: 'Non' },
        { label: 'Composition interne détaillée', value: 'Non fournie' },
      ],
      limitations: [
        'Volatilité, baisse maximale, corrélations et rendements historiques : non calculables avec ces données.',
        'Les libellés de catégories ne révèlent pas les actifs détenus à l’intérieur d’un fonds.',
        'La présence d’un ticker ne prouve pas que son historique est chargé dans cette analyse.',
      ],
    },
  ];

  return { facts, insights };
}
