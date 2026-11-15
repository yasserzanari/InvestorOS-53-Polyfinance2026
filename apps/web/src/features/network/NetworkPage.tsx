import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, ExternalLink, GitBranch, Plus, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDemoAccount } from '../../shared/DemoAccountContext';
import './network.css';

type SourceClass = 'primary' | 'secondary' | 'hypothesis';
type RelationKind = 'supplier' | 'customer' | 'site' | 'logistics' | 'other';
type NetworkRelation = {
  id: string;
  organization: string;
  counterparty: string;
  relation: RelationKind;
  sourceClass: SourceClass;
  sourceTitle: string;
  sourceUrl: string;
  excerpt: string;
  sourceDate: string;
  createdAt: string;
};

const RELATION_LABELS: Record<RelationKind, string> = {
  supplier: 'Fournit', customer: 'Achète auprès de', site: 'Site de production / opération', logistics: 'Transport / logistique', other: 'Autre relation',
};
const SOURCE_LABELS: Record<SourceClass, string> = {
  primary: 'Source primaire fournie', secondary: 'Source secondaire fournie', hypothesis: 'Hypothèse à vérifier',
};
const sourceKey = (accountId: string) => `investoros.network.evidence.v1.${accountId}`;

function readRelations(accountId: string): NetworkRelation[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(sourceKey(accountId)) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is NetworkRelation => Boolean(item && typeof item === 'object'
      && typeof item.id === 'string' && typeof item.organization === 'string'
      && typeof item.counterparty === 'string' && ['supplier', 'customer', 'site', 'logistics', 'other'].includes(item.relation)
      && ['primary', 'secondary', 'hypothesis'].includes(item.sourceClass)
      && typeof item.sourceTitle === 'string' && typeof item.sourceUrl === 'string'
      && typeof item.excerpt === 'string' && typeof item.sourceDate === 'string' && typeof item.createdAt === 'string'));
  } catch {
    return [];
  }
}

function secureUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function NetworkPage() {
  const { activeAccount } = useDemoAccount();
  const navigate = useNavigate();
  const [relations, setRelations] = useState<NetworkRelation[]>([]);
  const [loadedAccount, setLoadedAccount] = useState<string>();
  const [organization, setOrganization] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [relation, setRelation] = useState<RelationKind>('supplier');
  const [sourceClass, setSourceClass] = useState<SourceClass>('primary');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceDate, setSourceDate] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setRelations(readRelations(activeAccount.id));
    setLoadedAccount(activeAccount.id);
  }, [activeAccount.id]);

  useEffect(() => {
    if (loadedAccount !== activeAccount.id) return;
    try { localStorage.setItem(sourceKey(activeAccount.id), JSON.stringify(relations)); } catch { /* Storage may be unavailable. */ }
  }, [activeAccount.id, loadedAccount, relations]);

  const addRelation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!organization.trim() || !counterparty.trim()) {
      setError('Indiquez l’organisation et la contrepartie.');
      return;
    }
    if (sourceClass !== 'hypothesis' && (!sourceTitle.trim() || !sourceUrl.trim() || !secureUrl(sourceUrl.trim()))) {
      setError('Ajoutez le titre et un lien HTTPS vers la source.');
      return;
    }
    if (sourceUrl.trim() && !secureUrl(sourceUrl.trim())) {
      setError('Le lien doit utiliser HTTPS et ne pas contenir d’identifiants.');
      return;
    }
    const item: NetworkRelation = {
      id: globalThis.crypto?.randomUUID?.() ?? `relation-${Date.now()}`,
      organization: organization.trim(), counterparty: counterparty.trim(), relation, sourceClass,
      sourceTitle: sourceTitle.trim(), sourceUrl: sourceUrl.trim(), excerpt: excerpt.trim(), sourceDate,
      createdAt: new Date().toISOString(),
    };
    setRelations((current) => [item, ...current]);
    setOrganization(''); setCounterparty(''); setSourceTitle(''); setSourceUrl(''); setSourceDate(''); setExcerpt('');
  };

  const askAssistant = (item: NetworkRelation) => {
    const evidence = item.sourceClass === 'hypothesis'
      ? 'Cette entrée est une hypothèse de l’utilisateur et ne possède pas de source fournie.'
      : `Source fournie : ${item.sourceTitle} (${item.sourceUrl})${item.sourceDate ? `, datée du ${item.sourceDate}` : ''}.`;
    navigate('/app/assistant', { state: { initialPrompt: `Aide-moi à examiner cette relation de chaîne d’approvisionnement sans la présenter comme vérifiée. Organisation : ${item.organization}. Contrepartie : ${item.counterparty}. Relation déclarée : ${RELATION_LABELS[item.relation]}. Classement choisi par l’utilisateur : ${SOURCE_LABELS[item.sourceClass]}. ${evidence} Extrait que l’utilisateur indique avoir vérifié : ${item.excerpt || '(aucun extrait fourni)'}. Tu ne peux pas ouvrir cette source avec les outils actuels. Analyse uniquement l’extrait fourni, dis ce qui reste à confirmer et propose des tâches de vérification. Ne déduis aucun impact financier.` } });
  };

  return (
    <section className="network-page" aria-labelledby="network-title">
      <header className="network-header">
        <div>
          <span className="network-eyebrow"><GitBranch size={14} /> RELATIONS DOCUMENTÉES</span>
          <h1 id="network-title">Réseaux d’entreprises</h1>
          <p>Consignez les relations que vous avez repérées avec leur preuve, puis demandez à l’Assistant de formuler les vérifications manquantes.</p>
        </div>
        <span className="network-account-tag">{activeAccount.name}</span>
      </header>

      <div className="network-limit-note" role="note"><TriangleAlert size={15} /><p>Aucun graphe fournisseur vérifié n’est livré avec les données actuelles. Les relations ci-dessous sont saisies manuellement, restent locales à ce navigateur et ne prouvent pas une exposition financière.</p></div>

      <div className="network-layout">
        <section className="network-relations-panel" aria-labelledby="network-relations-title">
          <div className="network-panel-heading"><div><span>ESPACE DE PREUVES</span><h2 id="network-relations-title">Relations saisies</h2></div><span className="network-count">{relations.length}</span></div>
          {!relations.length ? (
            <div className="network-empty"><span><GitBranch size={19} /></span><h3>Votre registre est vide</h3><p>Ajoutez une relation seulement après avoir choisi une source, ou enregistrez-la explicitement comme hypothèse à confirmer.</p></div>
          ) : (
            <div className="network-relation-list">
              {relations.map((item) => (
                <article className="network-relation-card" key={item.id}>
                  <div className="network-flow"><strong title={item.organization}>{item.organization}</strong><span><i />{RELATION_LABELS[item.relation]}<i /></span><strong title={item.counterparty}>{item.counterparty}</strong></div>
                  <div className="network-evidence-meta"><span className={`network-source-tag is-${item.sourceClass}`}>{item.sourceClass === 'primary' ? <ShieldCheck size={11} /> : item.sourceClass === 'hypothesis' ? <TriangleAlert size={11} /> : null}{SOURCE_LABELS[item.sourceClass]}</span>{item.sourceDate && <time>{item.sourceDate}</time>}</div>
                  {item.sourceTitle && <p className="network-source-title">{item.sourceTitle}</p>}
                  {item.excerpt && <blockquote>{item.excerpt}</blockquote>}
                  <div className="network-card-actions">
                    {item.sourceUrl && secureUrl(item.sourceUrl) && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Ouvrir la source <ExternalLink size={11} /></a>}
                    <button type="button" onClick={() => askAssistant(item)}>Examiner avec l’Assistant <ArrowRight size={11} /></button>
                    <button type="button" className="network-delete" aria-label={`Supprimer la relation entre ${item.organization} et ${item.counterparty}`} onClick={() => setRelations((current) => current.filter((relationItem) => relationItem.id !== item.id))}><Trash2 size={12} /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <form className="network-form" onSubmit={addRelation}>
          <div className="network-panel-heading"><div><span>NOUVELLE ENTRÉE</span><h2>Ajouter une relation</h2></div><span className="network-form-icon"><Plus size={15} /></span></div>
          <label>Organisation<input value={organization} onChange={(event) => setOrganization(event.target.value)} maxLength={120} placeholder="Nom de l’entreprise ou du site" required /></label>
          <label>Type de relation<select value={relation} onChange={(event) => setRelation(event.target.value as RelationKind)}>{Object.entries(RELATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Contrepartie<input value={counterparty} onChange={(event) => setCounterparty(event.target.value)} maxLength={120} placeholder="Fournisseur, client, site…" required /></label>
          <label>Type de preuve<select value={sourceClass} onChange={(event) => setSourceClass(event.target.value as SourceClass)}><option value="primary">Source primaire fournie</option><option value="secondary">Source secondaire fournie</option><option value="hypothesis">Hypothèse à vérifier</option></select></label>
          {sourceClass !== 'hypothesis' && <>
            <label>Titre de la source<input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} maxLength={180} placeholder="Titre du document ou de la déclaration" required /></label>
            <label>Lien HTTPS<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} maxLength={1000} placeholder="https://…" required /></label>
            <label>Date de la source <span className="network-optional">facultatif</span><input type="date" value={sourceDate} onChange={(event) => setSourceDate(event.target.value)} /></label>
          </>}
          <label>Extrait vérifié <span className="network-optional">facultatif</span><textarea value={excerpt} onChange={(event) => setExcerpt(event.target.value)} maxLength={3000} rows={4} placeholder="Collez un extrait que vous avez lu dans la source; l’Assistant ne peut pas ouvrir le lien." /></label>
          {error && <p className="network-form-error" role="alert">{error}</p>}
          <button className="network-submit" type="submit"><Plus size={14} /> Ajouter au registre</button>
          <p className="network-form-footnote">Les entrées sont enregistrées dans le navigateur pour le compte de démonstration actif. Elles ne sont pas envoyées à AWS.</p>
        </form>
      </div>
    </section>
  );
}

export default NetworkPage;
