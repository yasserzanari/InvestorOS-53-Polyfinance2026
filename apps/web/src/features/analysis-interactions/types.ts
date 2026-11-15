import type { MarketMovement } from '../../shared/api';

export type ExplorationKind = 'point' | 'event' | 'conclusion' | 'source' | 'movement';

export type ExplorationTarget = {
  id: string;
  kind: ExplorationKind;
  title: string;
  summary: string;
  ticker?: string;
  date?: string;
  dateLabel?: string;
  dateKind?: 'published' | 'scheduled' | 'indexed' | 'observed';
  publishedAt?: string;
  imageUrl?: string;
  source?: { title: string; url: string; excerpt?: string; publisher?: string };
  metrics?: { label: string; value: string }[];
  classification?: 'historical' | 'conditional' | 'research' | 'illustrative';
  analysisId?: string;
  movement?: MarketMovement;
};

export type ExploreHandler = (target: ExplorationTarget) => void;
