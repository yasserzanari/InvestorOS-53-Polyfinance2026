import { ArrowRight, BadgeAlert, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import type { PortfolioPosition, PortfolioSnapshot, getRebalancePreview } from '../model/portfolio-model';
import { pct, usd } from '../utils/format';
import { HoldingSparkline } from './HoldingSparkline';
import { PositionInspector } from './PositionInspector';

type RebalancePreview = ReturnType<typeof getRebalancePreview>;

type PositionsPanelProps = {
  snapshot: PortfolioSnapshot;
  positions: PortfolioPosition[];
  selectedSymbol: string | null;
  selectedPosition?: PortfolioPosition;
  preview: RebalancePreview;
  previewingRebalance: boolean;
  onApplyRebalance: () => void;
  onSelect: (symbol: string | null) => void;
  onToggleRebalance: () => void;
};

export function PositionsPanel({ snapshot, positions, selectedSymbol, selectedPosition, preview, previewingRebalance, onApplyRebalance, onSelect, onToggleRebalance }: PositionsPanelProps) {
  const rebalanceAlreadyApplied = snapshot.rebalances.some((event) => event.step === snapshot.step);
  return (
    <section className="portfolio-panel portfolio-positions-panel" aria-labelledby="positions-heading">
      <header className="portfolio-panel-heading">
        <div><h2 id="positions-heading">Positions</h2><p>{positions.length} actifs · cours et poids du modèle</p></div>
        <button type="button" className={`portfolio-rebalance-toggle ${previewingRebalance ? 'is-open' : ''}`} aria-pressed={previewingRebalance} onClick={onToggleRebalance}><SlidersHorizontal size={14} />Rééquilibrer<ChevronRight size={13} /></button>
      </header>
      {previewingRebalance ? <div className="rebalance-preview">
        <div className="rebalance-preview-heading"><div><BadgeAlert size={17} /><div><strong>Aperçu du rééquilibrage</strong><small>Écart par rapport aux pondérations cibles</small></div></div><button type="button" onClick={onToggleRebalance} aria-label="Fermer l’aperçu"><X size={16} /></button></div>
        <div className="rebalance-preview-list">{preview.map((trade) => <div key={trade.symbol}>
          <span className="rebalance-symbol" style={{ color: trade.color }}>{trade.symbol}</span>
          <span>{trade.weight.toFixed(1)} % → {trade.target} %</span>
          <strong className={trade.amount >= 0 ? 'portfolio-positive' : 'portfolio-negative'}>{trade.side} {usd(Math.abs(trade.amount))}</strong>
        </div>)}</div>
        <button type="button" className="rebalance-apply-button" onClick={onApplyRebalance} disabled={snapshot.step === 0 || rebalanceAlreadyApplied}>Appliquer dans cette simulation <ArrowRight size={14} /></button>
      </div> : <>
        {selectedPosition && <PositionInspector position={selectedPosition} onClose={() => onSelect(null)} />}
        <div className="portfolio-table-scroll holdings-table-scroll">
          <table className="portfolio-table holdings-table">
            <caption className="sr-only">Positions simulées, cours, rendements, volatilité, repli, allocation et valeur.</caption>
            <thead><tr>{['Actif', 'Cours', 'Rendement', 'Tendance', 'Jour', 'Volatilité', 'Repli', 'Poids / cible', 'P&L', 'Valeur'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{positions.map((position) => <tr key={position.symbol} className={selectedSymbol === position.symbol ? 'is-selected' : ''}>
              <th scope="row"><button className="holding-name-button" onClick={() => onSelect(selectedSymbol === position.symbol ? null : position.symbol)} aria-pressed={selectedSymbol === position.symbol}><i style={{ background: position.color }} /><span><strong>{position.symbol}</strong><small>{position.name}</small></span></button></th>
              <td>{usd(position.price, 2)}</td>
              <td className={position.returnPct >= 0 ? 'portfolio-positive' : 'portfolio-negative'}>{pct(position.returnPct)}</td>
              <td><HoldingSparkline values={position.sparkline} color={position.color} /></td>
              <td className={position.dayChange >= 0 ? 'portfolio-positive' : 'portfolio-negative'}>{pct(position.dayChange * 100, 2)}</td>
              <td>{position.volatility.toFixed(1)} %</td>
              <td className="portfolio-negative">{pct(position.maxDrawdown)}</td>
              <td><div className="portfolio-weight"><span>{position.weight.toFixed(1)} %</span><div><i style={{ width: `${Math.min(100, position.weight / 30 * 100)}%`, background: position.color }} /><b style={{ left: `${position.target / 30 * 100}%` }} /></div></div></td>
              <td className={position.pnl >= 0 ? 'portfolio-positive' : 'portfolio-negative'}>{position.pnl >= 0 ? '+' : '−'}{usd(Math.abs(position.pnl))}</td>
              <td>{usd(position.value)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </section>
  );
}
