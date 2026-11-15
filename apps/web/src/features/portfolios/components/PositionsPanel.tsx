import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowDownWideNarrow, BriefcaseBusiness, ChevronDown, ChevronUp, Landmark, Layers3, TrendingUp, Wallet } from 'lucide-react';
import type { DemoOverview } from '../../../shared/api';
import { portfolioDisplayLabel } from '../utils/portfolio-label';

const positionColors = ['#247f78', '#4d6eb3', '#ad7440', '#8b6ab4', '#3984a3', '#b05d69'];

const categories = {
  equities: { label: 'Actions', Icon: TrendingUp },
  bonds: { label: 'Obligations', Icon: Landmark },
  cash: { label: 'Liquidités', Icon: Wallet },
  other: { label: 'Autres actifs', Icon: Layers3 },
} as const;

type CategoryId = keyof typeof categories;
type SortField = 'name' | 'weight' | 'value';

function categoryForLabel(label: string): CategoryId {
  const normalized = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-CA');
  if (/action|equity|stock/.test(normalized)) return 'equities';
  if (/obligation|bond|fixed income/.test(normalized)) return 'bonds';
  if (/liquidite|cash/.test(normalized)) return 'cash';
  return 'other';
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

export function PositionsPanel({ portfolio, selected, onSelect }: {
  portfolio: DemoOverview['portfolio'];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<CategoryId | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('weight');
  const [sortDescending, setSortDescending] = useState(true);

  const classified = useMemo(() => portfolio.positions.map((position, index) => ({
    position,
    index,
    category: categoryForLabel(position.label),
  })), [portfolio.positions]);

  const presentCategories = useMemo(() => (Object.keys(categories) as CategoryId[])
    .map((id) => ({ id, count: classified.filter((item) => item.category === id).length }))
    .filter((item) => item.count > 0), [classified]);

  const groups = useMemo(() => presentCategories
    .filter(({ id }) => activeCategory === 'all' || activeCategory === id)
    .map(({ id }) => ({
      id,
      ...categories[id],
      positions: classified.filter((item) => item.category === id).sort((a, b) => {
        const left = a.position;
        const right = b.position;
        const result = sortField === 'name'
          ? left.label.localeCompare(right.label, 'fr-CA')
          : sortField === 'weight' ? left.weight_pct - right.weight_pct : left.value - right.value;
        return sortDescending ? -result : result;
      }),
    })), [activeCategory, classified, presentCategories, sortDescending, sortField]);

  const setSort = (field: SortField) => {
    if (sortField === field) setSortDescending((descending) => !descending);
    else {
      setSortField(field);
      setSortDescending(field !== 'name');
    }
  };

  const sortIcon = (field: SortField) => sortField !== field
    ? <ArrowDownWideNarrow size={12} aria-hidden="true" />
    : sortDescending ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronUp size={12} aria-hidden="true" />;

  return (
    <section className="portfolio-panel portfolio-positions-panel" aria-labelledby="positions-heading">
      <header className="portfolio-panel-heading">
        <div><span className="portfolio-section-icon"><BriefcaseBusiness size={16} /></span><div><h2 id="positions-heading">Watchlist du portefeuille</h2><p>{portfolio.positions.length} expositions · données du compte démo</p></div></div>
        <strong className="portfolio-total-value">{money(portfolio.total_value, portfolio.currency)}</strong>
      </header>

      <div className="portfolio-watchlist-filters" role="group" aria-label="Filtrer par catégorie d’actif">
        <button type="button" className={activeCategory === 'all' ? 'is-active' : ''} aria-pressed={activeCategory === 'all'} onClick={() => setActiveCategory('all')}>
          Toutes <span>{portfolio.positions.length}</span>
        </button>
        {presentCategories.map(({ id, count }) => {
          const Icon = categories[id].Icon;
          return <button key={id} type="button" className={activeCategory === id ? 'is-active' : ''} aria-pressed={activeCategory === id} onClick={() => setActiveCategory(id)}>
            <Icon size={13} aria-hidden="true" /> {categories[id].label} <span>{count}</span>
          </button>;
        })}
      </div>

      <div className="portfolio-watchlist-columns">
        <button type="button" aria-label={`Trier par exposition${sortField === 'name' ? sortDescending ? ', décroissant' : ', croissant' : ''}`} onClick={() => setSort('name')}>Exposition {sortIcon('name')}</button>
        <button type="button" aria-label={`Trier par poids${sortField === 'weight' ? sortDescending ? ', décroissant' : ', croissant' : ''}`} onClick={() => setSort('weight')}>Poids {sortIcon('weight')}</button>
        <button type="button" aria-label={`Trier par valeur${sortField === 'value' ? sortDescending ? ', décroissant' : ', croissant' : ''}`} onClick={() => setSort('value')}>Valeur {sortIcon('value')}</button>
      </div>

      <div className="portfolio-position-list" aria-label="Positions du portefeuille">
        {groups.map(({ id, label, Icon, positions }) => <section className="portfolio-position-group" key={id} aria-label={label}>
          <h3><span><Icon size={14} aria-hidden="true" /> {label}</span><small>{positions.length} {positions.length === 1 ? 'position' : 'positions'}</small></h3>
          {positions.map(({ position, index }) => {
            const color = positionColors[index % positionColors.length];
            const active = selected === position.id;
            const displayLabel = portfolioDisplayLabel(position.label);
            return <button className={`portfolio-position-row${active ? ' is-selected' : ''}`} type="button" key={position.id} aria-pressed={active} aria-label={`${label} : ${displayLabel}, ${position.weight_pct.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %, ${money(position.value, portfolio.currency)}`} onClick={() => onSelect(active ? null : position.id)}>
              <span className="portfolio-position-identity">
                <i style={{ '--position-color': color } as CSSProperties} />
                <span><strong>{displayLabel}</strong><small>{position.ticker ? `Ticker ${position.ticker}` : 'Exposition déclarée'}</small></span>
              </span>
              <span className="portfolio-position-weight"><span>{position.weight_pct.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %</span><i><b style={{ width: `${Math.max(0, Math.min(100, position.weight_pct))}%`, background: color }} /></i></span>
              <strong className="portfolio-position-value">{money(position.value, portfolio.currency)}</strong>
            </button>;
          })}
        </section>)}
      </div>
    </section>
  );
}
