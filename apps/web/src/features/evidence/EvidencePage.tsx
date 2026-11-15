import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpenText, ChartNoAxesCombined, Check, CircleHelp, Clock3, LoaderCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { loadSimulationAssets, loadSimulationHistory, type SimulationAssetList, type SimulationHistory } from '../../shared/api';
import { profileApiBase } from '../profiles/profile-api';
import './evidence.css';
import { SourceExplorer } from './SourceExplorer';

type AssetState = { kind: 'loading' } | { kind: 'ready'; data: SimulationAssetList } | { kind: 'error'; message: string };
type HistoryTestState = { kind: 'idle' | 'loading' } | { kind: 'ready'; data: SimulationHistory } | { kind: 'error'; message: string };

const methods = [
  { title: 'Mouvements après une date', description: 'Les rendements sont mesurés aux séances disponibles après une date d’événement ou de publication. Ils décrivent une succession temporelle, pas un effet attribuable à cette information.' },
  { title: 'Trajectoires conditionnelles', description: 'Le backend applique les chocs et jalons explicitement saisis aux quantiles de fenêtres historiques du même titre. Les quantiles marginaux ne sont ni probabilités, ni prévisions, ni trajectoires conjointes.' },
  { title: 'Comptes de démonstration', description: 'Amira, Mateo et Robert sont fictifs. Leurs portefeuilles ne sont pas reliés à des tickers de Simulation sans correspondance documentée; aucune position réelle n’est connectée.' },
];

export function EvidencePage() {
  const [assetState, setAssetState] = useState<AssetState>({ kind: 'loading' });
  const [selectedTicker, setSelectedTicker] = useState('');
  const [historyTest, setHistoryTest] = useState<HistoryTestState>({ kind: 'idle' });

  useEffect(() => {
    const controller = new AbortController();
    loadSimulationAssets(controller.signal)
      .then((data) => setAssetState({ kind: 'ready', data }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setAssetState({ kind: 'error', message: error instanceof Error ? error.message : 'La source de Simulation est indisponible.' });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (assetState.kind === 'ready' && !assetState.data.assets.some((asset) => asset.ticker === selectedTicker)) {
      setSelectedTicker(assetState.data.assets[0]?.ticker ?? '');
      setHistoryTest({ kind: 'idle' });
    }
  }, [assetState, selectedTicker]);

  const selectedAsset = assetState.kind === 'ready'
    ? assetState.data.assets.find((asset) => asset.ticker === selectedTicker)
    : undefined;

  const testSelectedHistory = async () => {
    if (!selectedAsset) return;
    setHistoryTest({ kind: 'loading' });
    try {
      const data = await loadSimulationHistory(selectedAsset.ticker);
      setHistoryTest({ kind: 'ready', data });
    } catch (error) {
      setHistoryTest({ kind: 'error', message: error instanceof Error ? error.message : 'La requête de vérification a échoué.' });
    }
  };

  return (
    <section className="evidence-page" aria-labelledby="evidence-title">
      <header className="evidence-header">
        <div>
          <h1 id="evidence-title">Sources et méthode</h1>
          <p>Vérifiez d’où viennent les observations, ce qu’elles permettent de dire et où leur portée s’arrête.</p>
        </div>
        <Link className="evidence-open-simulation" to="/app/scenarios"><ChartNoAxesCombined size={15} /> Ouvrir Simulation</Link>
      </header>

      {assetState.kind === 'loading' && <p role="status">Chargement des titres…</p>}
      {assetState.kind === 'error' && <p role="alert">{assetState.message}</p>}


      {assetState.kind === 'ready' && (
        <section className="evidence-assets-workspace" aria-label="Titres présents dans l’historique configuré">
          <div className="evidence-asset-list-panel">
            <header><div><span>UNIVERS CONFIGURÉ</span><h2>{assetState.data.assets.length} titres disponibles</h2></div><span className="evidence-list-hint">Sélectionnez un titre</span></header>
            <div className="evidence-asset-list" role="listbox" aria-label="Titres disponibles dans Simulation">
              {assetState.data.assets.map((asset) => (
                <button type="button" role="option" aria-selected={selectedTicker === asset.ticker} className={`evidence-asset-option${selectedTicker === asset.ticker ? ' is-selected' : ''}`} key={asset.ticker} onClick={() => { setSelectedTicker(asset.ticker); setHistoryTest({ kind: 'idle' }); }}>
                  <span className="evidence-asset-symbol">{asset.ticker}</span>
                  <span className="evidence-asset-description"><strong>{asset.name}</strong><small>{asset.market} · {asset.currency} · {asset.asset_class}</small></span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <aside className="evidence-asset-details" aria-live="polite" aria-label="Détails et vérification du titre">
            {selectedAsset ? <>
              <header><span className="evidence-detail-symbol"><ChartNoAxesCombined size={18} /></span><div><span>DÉTAILS DU TITRE</span><h2>{selectedAsset.ticker}</h2><p>{selectedAsset.name}</p></div></header>
              <dl className="evidence-asset-facts">
                <div><dt>Marché</dt><dd>{selectedAsset.market}</dd></div><div><dt>Devise</dt><dd>{selectedAsset.currency}</dd></div><div><dt>Secteur</dt><dd>{selectedAsset.sector}</dd></div><div><dt>Type</dt><dd>{selectedAsset.asset_class}</dd></div>
              </dl>
              <div className="evidence-link-details"><span className="evidence-card-category">LIENS DE DONNÉES</span>
                <a href={`https://finance.yahoo.com/quote/${encodeURIComponent(selectedAsset.ticker)}/history/`} target="_blank" rel="noopener noreferrer"><span><strong>Historique Yahoo Finance</strong><small>Source externe · prix ajustés</small></span><ArrowUpRight size={15} /></a>
                <div><span><strong>Simulation · API locale</strong><small>Historique configuré dans le jeu de données</small></span><code>/history/{selectedAsset.ticker}</code></div>
              </div>
              <button className="evidence-test-button" type="button" onClick={() => void testSelectedHistory()} disabled={historyTest.kind === 'loading'}>
                {historyTest.kind === 'loading' ? <LoaderCircle size={15} className="evidence-test-spinner" /> : <Check size={15} />}
                {historyTest.kind === 'loading' ? 'Vérification en cours…' : 'Tester les données reçues'}
              </button>
              {historyTest.kind === 'ready' && <div className="evidence-test-result is-success" role="status"><span><Check size={14} /> Réponse reçue</span><p>{historyTest.data.prices.length} observations · {historyTest.data.events.length} événements · {historyTest.data.source}</p><small>Extraction : {historyTest.data.sourceAsOf} · {historyTest.data.currency}</small></div>}
              {historyTest.kind === 'error' && <div className="evidence-test-result is-error" role="alert"><span><X size={14} /> Échec de la vérification</span><p>{historyTest.message}</p><small>Vérifiez que l’API Simulation est démarrée et que ce titre est bien configuré.</small></div>}
              {historyTest.kind === 'idle' && <p className="evidence-test-idle"><Clock3 size={13} />Le test interroge l’API réelle au clic; aucun résultat n’est simulé.</p>}
            </> : <p className="evidence-details-empty">Aucun titre disponible dans l’univers configuré.</p>}
          </aside>
        </section>
      )}

      <SourceExplorer />

      <div className="evidence-section-heading"><div><span>INTERPRÉTATION</span><h2>Ce que les résultats signifient</h2></div></div>
      <div className="evidence-method-grid">
        {methods.map((method) => <article key={method.title}><CircleHelp size={16} /><h3>{method.title}</h3><p>{method.description}</p></article>)}
      </div>

      <footer className="evidence-notes">
        <BookOpenText size={15} />
        <p>Les notes de méthode lues par l’Assistant restent ouvrables dans le chat. Les comptes fictifs et les données de travail du navigateur ne sont pas une archive persistante.</p>
        <a href={`${profileApiBase}/v1/profiles/sources/demo-boundaries`} target="_blank" rel="noopener noreferrer">Lire les limites de la démo<ArrowUpRight size={12} /></a>
      </footer>
    </section>
  );
}

export default EvidencePage;
