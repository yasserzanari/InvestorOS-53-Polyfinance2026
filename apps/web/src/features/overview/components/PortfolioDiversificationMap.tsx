import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Layers3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DemoOverview } from '../../../shared/api';

const MAP_WIDTH = 460;
const MAP_HEIGHT = 188;
const TILE_TONES = ['#2f8bff', '#22b8a6', '#8b75e8', '#f2a343', '#4d78d6', '#12a6bd', '#48a879', '#b56ed0'];

type Tile = {
  x: number;
  y: number;
  width: number;
  height: number;
  position: DemoOverview['portfolio']['positions'][number];
};

function worst(row: number[], side: number, area: number) {
  const max = Math.max(...row);
  const min = Math.min(...row);
  const sideSquared = side * side;
  const areaSquared = area * area;
  return Math.max((sideSquared * max) / areaSquared, areaSquared / (sideSquared * min));
}

function squarify(positions: DemoOverview['portfolio']['positions'], width: number, height: number): Tile[] {
  const total = positions.reduce((sum, position) => sum + position.weight_pct, 0);
  if (!total || width <= 0 || height <= 0) return [];

  const items = positions.map((position) => ({ area: (position.weight_pct / total) * width * height, position }));
  const tiles: Tile[] = [];
  let x = 0;
  let y = 0;
  let remainingWidth = width;
  let remainingHeight = height;
  let index = 0;

  while (index < items.length) {
    const side = Math.min(remainingWidth, remainingHeight);
    const row = [items[index].area];
    const rowPositions = [items[index].position];
    let rowArea = items[index].area;
    let nextIndex = index + 1;

    while (nextIndex < items.length) {
      const nextArea = rowArea + items[nextIndex].area;
      if (worst([...row, items[nextIndex].area], side, nextArea) > worst(row, side, rowArea)) break;
      row.push(items[nextIndex].area);
      rowPositions.push(items[nextIndex].position);
      rowArea = nextArea;
      nextIndex += 1;
    }

    if (remainingWidth >= remainingHeight) {
      const columnWidth = rowArea / remainingHeight;
      let tileY = y;
      row.forEach((area, rowIndex) => {
        const tileHeight = area / columnWidth;
        tiles.push({ x, y: tileY, width: columnWidth, height: tileHeight, position: rowPositions[rowIndex] });
        tileY += tileHeight;
      });
      x += columnWidth;
      remainingWidth -= columnWidth;
    } else {
      const rowHeight = rowArea / remainingWidth;
      let tileX = x;
      row.forEach((area, rowIndex) => {
        const tileWidth = area / rowHeight;
        tiles.push({ x: tileX, y, width: tileWidth, height: rowHeight, position: rowPositions[rowIndex] });
        tileX += tileWidth;
      });
      y += rowHeight;
      remainingHeight -= rowHeight;
    }
    index = nextIndex;
  }
  return tiles;
}

function currency(value: number, code: string) {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value);
}

export function PortfolioDiversificationMap({ portfolio }: { portfolio?: DemoOverview['portfolio'] }) {
  const positions = useMemo(
    () => (portfolio?.positions ?? []).filter((position) => Number.isFinite(position.weight_pct) && position.weight_pct > 0),
    [portfolio?.positions],
  );
  const [width, setWidth] = useState(MAP_WIDTH);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, Math.min(MAP_WIDTH, Math.round(entry.contentRect.width))));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!positions.some((position) => position.id === selectedId)) setSelectedId(positions[0]?.id ?? null);
  }, [positions, selectedId]);

  const height = Math.round((MAP_HEIGHT * width) / MAP_WIDTH);
  const tiles = useMemo(() => squarify(positions, width, height), [positions, width, height]);
  const selected = positions.find((position) => position.id === selectedId) ?? positions[0];

  if (!portfolio || positions.length === 0) {
    return (
      <div className="portfolio-map-empty" role="status">
        <span className="portfolio-map-empty-icon"><Layers3 size={18} /></span>
        <div>
          <strong>{portfolio ? 'Aucune position à répartir' : 'Portefeuille non chargé'}</strong>
          <p>{portfolio ? 'Ajoutez des positions pour afficher leur poids relatif.' : 'La carte se remplira avec les positions du compte actif lorsque l’API sera disponible.'}</p>
        </div>
        <Link to="/app/portfolios" aria-label="Ouvrir les portefeuilles"><ArrowRight size={16} /></Link>
      </div>
    );
  }

  const selectedIndex = Math.max(0, positions.findIndex((position) => position.id === selectedId));

  return (
    <div className="portfolio-map-content">
      <div className="portfolio-map-meta">
        <span>{positions.length} positions · {portfolio.is_demo ? 'données fictives' : 'compte actif'}</span>
        <span>Surface = poids</span>
      </div>
      <div
        ref={containerRef}
        className="portfolio-map-chart"
        role="group"
        tabIndex={0}
        aria-label="Diversification du portefeuille. Utilisez les flèches pour parcourir les positions."
        onKeyDown={(event) => {
          const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
          if (delta) {
            event.preventDefault();
            setSelectedId(positions[(selectedIndex + delta + positions.length) % positions.length].id);
          }
        }}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${positions.length} positions, réparties par pondération`}>
          {tiles.map((tile, index) => {
            const isSelected = tile.position.id === selectedId;
            const showLabel = tile.width >= 88 && tile.height >= 45;
            const tint = 16 + Math.min(16, tile.position.weight_pct * 0.22);
            const tone = TILE_TONES[index % TILE_TONES.length];
            return (
              <g
                key={tile.position.id}
                role="button"
                tabIndex={-1}
                aria-label={`${tile.position.label}, ${tile.position.weight_pct} pour cent, ${currency(tile.position.value, portfolio.currency)}`}
                onFocus={() => setSelectedId(tile.position.id)}
                onPointerEnter={() => setSelectedId(tile.position.id)}
                onClick={() => setSelectedId(tile.position.id)}
                className={isSelected ? 'portfolio-map-tile is-selected' : 'portfolio-map-tile'}
              >
                <rect
                  x={tile.x + 1}
                  y={tile.y + 1}
                  width={Math.max(0, tile.width - 2)}
                  height={Math.max(0, tile.height - 2)}
                  rx={7}
                  fill={`color-mix(in srgb, ${tone} ${tint}%, white)`}
                  stroke={isSelected ? tone : 'rgba(255,255,255,.92)'}
                  strokeWidth={isSelected ? 2 : 1.5}
                />
                {showLabel ? (
                  <text x={tile.x + 10} y={tile.y + 20} className="portfolio-map-label">
                    <tspan x={tile.x + 10}>{tile.position.label}</tspan>
                    <tspan x={tile.x + 10} dy="17" className="portfolio-map-weight">{tile.position.weight_pct}%</tspan>
                  </text>
                ) : (
                  <text x={tile.x + tile.width / 2} y={tile.y + tile.height / 2 + 4} textAnchor="middle" className="portfolio-map-weight">{tile.position.weight_pct}%</text>
                )}
                <title>{`${tile.position.label} · ${tile.position.weight_pct}%`}</title>
                <desc>{`Position ${index + 1} sur ${positions.length}`}</desc>
              </g>
            );
          })}
        </svg>
      </div>
      {selected && (
        <div className="portfolio-map-selected" aria-live="polite">
          <strong>{selected.label}</strong>
          <span>{selected.weight_pct}%</span>
          <span>{currency(selected.value, portfolio.currency)}</span>
        </div>
      )}
      <p className="portfolio-map-provenance">Répartition calculée à partir des pondérations déclarées. Aucune variation de marché n’est fournie par ces positions.</p>
    </div>
  );
}
