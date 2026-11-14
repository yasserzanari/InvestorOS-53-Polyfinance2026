import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpenText, ChartNoAxesCombined, CircleHelp, Database, FileText, Globe2, Landmark, MessageCircle, Newspaper, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { loadSimulationAssets, type SimulationAssetList } from '../../shared/api';
import { profileApiBase } from '../profiles/profile-api';
import './evidence.css';

type AssetState = { kind: 'loading' } | { kind: 'ready'; data: SimulationAssetList } | { kind: 'error'; message: string };

const sources = [
  {
    title: 'Dépôts des émetteurs', category: 'Source primaire', Icon: FileText,
    description: 'Formulaires publiés par les entreprises dans EDGAR. Ils rapportent des déclarations; ils ne constituent pas une vérification indépendante ni une preuve de causalité boursière.',
    provider: 'SEC EDGAR', href: 'https://www.sec.gov/search-filings/edgar-application-programming-interfaces', availability: 'Selon l’émetteur et la configuration du serveur',
  },
  {
    title: 'Textes et avis réglementaires', category: 'Source primaire', Icon: Landmark,
    description: 'Documents du Federal Register avec dates de publication et, quand disponible, d’entrée en vigueur. La présence d’un texte ne prouve pas qu’il s’applique à un titre.',
    provider: 'Federal Register API', href: 'https://www.federalregister.gov/developers/documentation/api/v1', availability: 'Recherche par thème et période depuis Simulation',
  },
  {
    title: 'Couverture médiatique récente', category: 'Piste secondaire', Icon: Newspaper,
    description: 'GDELT repère des articles susceptibles de parler de l’émetteur. L’indexation peut différer de la publication; vérifier le texte de l’article et ses sources originales.',
    provider: 'GDELT DOC 2.0', href: 'https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/', availability: 'Recherche récente depuis Simulation',
  },
  {
    title: 'Publications publiques', category: 'Déclarations à vérifier', Icon: MessageCircle,
    description: 'X Recent Search est optionnel et désactivé par défaut. Les publications et leurs médias ne sont pas vérifiés, ne prouvent pas l’identité ou le rôle d’un auteur et n’alimentent pas les calculs.',
    provider: 'X API v2 · Recent Search', href: 'https://docs.x.com/x-api/posts/search/introduction', availability: 'Optionnel; sept derniers jours; peut être facturé',
  },
];

const methods = [
  { title: 'Mouvements après une date', description: 'Les rendements sont mesurés aux séances disponibles après une date d’événement ou de publication. Ils décrivent une succession temporelle, pas un effet attribuable à cette information.' },
  { title: 'Trajectoires conditionnelles', description: 'Le backend applique les chocs et jalons explicitement saisis aux quantiles de fenêtres historiques du même titre. Les quantiles marginaux ne sont ni probabilités, ni prévisions, ni trajectoires conjointes.' },
  { title: 'Comptes de démonstration', description: 'Amira, Mateo et Robert sont fictifs. Leurs portefeuilles ne sont pas reliés à des tickers de Simulation sans correspondance documentée; aucune position réelle n’est connectée.' },
];

export function EvidencePage() {
  const [assetState, setAssetState] = useState<AssetState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    loadSimulationAssets(controller.signal)
      .then((data) => setAssetState({ kind: 'ready', data }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setAssetState({ kind: 'error', message: error instanceof Error ? error.message : 'La source de Simulation est indisponible.' });
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="evidence-page" aria-labelledby="evidence-title">
      <header className="evidence-header">
        <div>
          <span className="evidence-eyebrow"><ShieldCheck size={14} /> PROVENANCE ET MÉTHODES</span>
          <h1 id="evidence-title">Sources et méthode</h1>
          <p>Vérifiez d’où viennent les observations, ce qu’elles permettent de dire et où leur portée s’arrête.</p>
        </div>
        <Link className="evidence-open-simulation" to="/app/scenarios"><ChartNoAxesCombined size={15} /> Ouvrir Simulation</Link>
      </header>

      <section className="evidence-market-status" aria-labelledby="evidence-market-title">
        <span className="evidence-status-icon"><Database size={17} /></span>
        <div className="evidence-status-copy">
          <h2 id="evidence-market-title">Historique de marché configuré</h2>
          {assetState.kind === 'loading' && <p role="status">Lecture de la source de données…</p>}
          {assetState.kind === 'error' && <p role="status">{assetState.message} Les métadonnées des autres fournisseurs restent consultables ci-dessous.</p>}
          {assetState.kind === 'ready' && <p>{assetState.data.source} · {assetState.data.assets.length} titres · extraction du {assetState.data.sourceAsOf}</p>}
          {assetState.kind === 'ready' && assetState.data.limitations.map((limitation) => <small key={limitation}>{limitation}</small>)}
        </div>
        <span className={`evidence-state-pill is-${assetState.kind}`}>{assetState.kind === 'ready' ? 'Connecté' : assetState.kind === 'loading' ? 'Chargement' : 'Indisponible'}</span>
      </section>

      {assetState.kind === 'ready' && (
        <section className="evidence-universe" aria-label="Titres présents dans l’historique configuré">
          <span>{assetState.data.assets.length} titres dans le jeu local</span>
          <div>{assetState.data.assets.map((asset) => <span key={asset.ticker} title={`${asset.name} · ${asset.currency}`}><strong>{asset.ticker}</strong><small>{asset.name}</small></span>)}</div>
        </section>
      )}

      <div className="evidence-section-heading"><div><span>FOURNISSEURS</span><h2>Documents et observations</h2></div><p>Les liens ouvrent la documentation ou la source primaire du fournisseur.</p></div>
      <div className="evidence-source-grid">
        <article className="evidence-source-card is-data-source">
          <span className="evidence-card-icon"><ChartNoAxesCombined size={17} /></span>
          <div className="evidence-card-copy"><span className="evidence-card-category">Jeu de données</span><h3>Prix ajustés et événements d’entreprise</h3><p>Paquet local configuré pour Simulation. Les prix peuvent être différés ou révisés; les rendements après événement ne démontrent pas de causalité.</p><span className="evidence-card-availability">{assetState.kind === 'ready' ? assetState.data.source : 'Disponibilité indiquée dans Simulation'}</span></div>
          <a href={assetState.kind === 'ready' && assetState.data.assets[0] ? `https://finance.yahoo.com/quote/${encodeURIComponent(assetState.data.assets[0].ticker)}/history/` : 'https://finance.yahoo.com/'} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir l’historique du premier titre chez Yahoo Finance"><ArrowUpRight size={15} /></a>
        </article>
        {sources.map(({ title, category, Icon, description, provider, href, availability }) => (
          <article className="evidence-source-card" key={provider}>
            <span className="evidence-card-icon"><Icon size={17} /></span>
            <div className="evidence-card-copy"><span className="evidence-card-category">{category}</span><h3>{title}</h3><p>{description}</p><span className="evidence-card-availability">{availability}</span><a className="evidence-provider-link" href={href} target="_blank" rel="noopener noreferrer">Documentation {provider}<ArrowUpRight size={12} /></a></div>
          </article>
        ))}
      </div>

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
