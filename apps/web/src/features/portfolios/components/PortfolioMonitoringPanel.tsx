import { useEffect, useMemo, useState } from 'react';
import { Eye, Plus, X } from 'lucide-react';
import {
  addPortfolioWatch, loadPortfolioWatchlist, loadSimulationAssets, removePortfolioWatch,
  type DemoOverview, type PortfolioWatchItem, type SimulationAsset,
} from '../../../shared/api';
import { useDemoAccount } from '../../../shared/DemoAccountContext';

export function PortfolioMonitoringPanel({ portfolio }: { portfolio: DemoOverview['portfolio'] }) {
  const { activeAccount } = useDemoAccount();
  const [watchlist, setWatchlist] = useState<PortfolioWatchItem[]>([]);
  const [assets, setAssets] = useState<SimulationAsset[]>([]);
  const [positionId, setPositionId] = useState(portfolio.positions[0]?.id ?? '');
  const [ticker, setTicker] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setReady(false);
    Promise.all([loadPortfolioWatchlist(activeAccount.id, controller.signal), loadSimulationAssets(controller.signal)])
      .then(([saved, universe]) => {
        if (controller.signal.aborted) return;
        setWatchlist(saved.items);
        setAssets(universe.assets);
        setTicker(universe.assets.find(asset => !saved.items.some(item => item.ticker === asset.ticker))?.ticker ?? '');
        setMessage('');
        setReady(true);
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setMessage(error instanceof Error ? error.message : 'Impossible de charger la veille.');
          setReady(true);
        }
      });
    return () => controller.abort();
  }, [activeAccount.id]);

  const availableAssets = useMemo(() => assets.filter(asset => !watchlist.some(item => item.ticker === asset.ticker)), [assets, watchlist]);

  async function add() {
    if (!ticker || !positionId) return;
    setBusy(true); setMessage('');
    try {
      const item = await addPortfolioWatch({ persona: activeAccount.id, positionId, ticker });
      setWatchlist(current => [...current.filter(row => row.ticker !== item.ticker), item]);
      setTicker(assets.find(asset => asset.ticker !== item.ticker && !watchlist.some(row => row.ticker === asset.ticker))?.ticker ?? '');
      setMessage(`${item.ticker} sera vérifié toutes les 6 heures.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible d’ajouter ce titre.');
    } finally { setBusy(false); }
  }

  async function remove(symbol: string) {
    setBusy(true); setMessage('');
    try {
      await removePortfolioWatch(activeAccount.id, symbol);
      setWatchlist(current => current.filter(row => row.ticker !== symbol));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de retirer ce titre.');
    } finally { setBusy(false); }
  }

  return (
    <section className="portfolio-monitor-panel" aria-labelledby="portfolio-monitor-heading">
      <header><span><Eye size={17} /></span><div><h2 id="portfolio-monitor-heading">Veille des titres</h2><p>Nouvelles récentes vérifiées toutes les 6 heures · alertes dans le Dashboard</p></div></header>
      {watchlist.length > 0 ? <ul aria-label="Titres surveillés">{watchlist.map(item => <li key={item.ticker}>
        <span><strong>{item.ticker}</strong><small>{item.company} · {item.positionLabel}</small></span>
        <button type="button" aria-label={`Retirer ${item.ticker} de la veille`} disabled={busy} onClick={() => void remove(item.ticker)}><X size={15} /></button>
      </li>)}</ul> : <p className="portfolio-monitor-empty">Aucun titre lié. Ajoute explicitement les tickers : les catégories fictives ne permettent pas de déduire les sociétés détenues.</p>}
      <div className="portfolio-monitor-form">
        <label>Position<select value={positionId} onChange={event => setPositionId(event.target.value)} disabled={!ready || busy}>
          {portfolio.positions.map(position => <option key={position.id} value={position.id}>{position.label}</option>)}
        </select></label>
        <label>Titre<select value={ticker} onChange={event => setTicker(event.target.value)} disabled={!ready || busy || availableAssets.length === 0}>
          {availableAssets.map(asset => <option key={asset.ticker} value={asset.ticker}>{asset.ticker} · {asset.name}</option>)}
        </select></label>
        <button type="button" onClick={() => void add()} disabled={!ready || busy || !ticker || !positionId || availableAssets.length === 0}><Plus size={15} /> Ajouter</button>
      </div>
      <p className="portfolio-monitor-note" role="status">{message || 'Une alerte ouvre un dossier avec le résumé, la source, l’extrait retenu et la prochaine vérification humaine.'}</p>
    </section>
  );
}
