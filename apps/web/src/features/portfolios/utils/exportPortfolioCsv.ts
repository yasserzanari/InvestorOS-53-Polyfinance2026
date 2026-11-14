import type { getPortfolioSnapshot } from '../model/portfolio-model';
import { shortDate } from './format';

type PortfolioSnapshot = ReturnType<typeof getPortfolioSnapshot>;

export function downloadPortfolioCsv(snapshot: PortfolioSnapshot, accountName: string) {
  const columns = ['Actif', 'Cours USD', 'Quantité', 'Poids %', 'Cible %', 'Rendement %', 'P&L USD', 'Valeur USD'];
  const positions = snapshot.positions.map((position) => [
    position.symbol,
    position.price.toFixed(2),
    position.quantity.toFixed(4),
    position.weight.toFixed(2),
    String(position.target),
    position.returnPct.toFixed(2),
    position.pnl.toFixed(2),
    position.value.toFixed(2),
  ]);
  const content = [
    `Données fictives InvestorOS;${shortDate(snapshot.date)};compte ${accountName}`,
    columns.join(';'),
    ...positions.map((row) => row.join(';')),
  ].join('\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `investoros-portefeuille-modele-${snapshot.date.slice(0, 10)}.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
