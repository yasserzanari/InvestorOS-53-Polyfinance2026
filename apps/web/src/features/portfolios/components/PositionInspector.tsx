import { X } from 'lucide-react';
import type { PortfolioPosition } from '../model/portfolio-model';
import { pct, usd } from '../utils/format';

export function PositionInspector({ position, onClose }: { position: PortfolioPosition; onClose: () => void }) {
  return (
    <aside className="position-inspector" aria-label={`Détails de ${position.name}`}>
      <div><span className="position-inspector-symbol" style={{ color: position.color }}>{position.symbol}</span><div><strong>{position.name}</strong><small>Position du modèle · données fictives</small></div></div>
      <dl>
        <div><dt>Valeur simulée</dt><dd>{usd(position.value)}</dd></div>
        <div><dt>Poids / cible</dt><dd>{position.weight.toFixed(1)} % / {position.target} %</dd></div>
        <div><dt>Variation du modèle</dt><dd className={position.returnPct >= 0 ? 'portfolio-positive' : 'portfolio-negative'}>{pct(position.returnPct)}</dd></div>
      </dl>
      <button type="button" onClick={onClose} aria-label="Fermer les détails"><X size={16} /></button>
    </aside>
  );
}
