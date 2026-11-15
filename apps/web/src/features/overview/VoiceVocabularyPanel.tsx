import { useEffect, useState } from 'react';
import { BookOpen, Check, Plus, RefreshCw, Search, X } from 'lucide-react';

export type VoiceVocabulary = {
  name: string;
  languageCode: string;
  state: string;
  phrases: string[];
  recommendedPhrases: string[];
  lastModifiedAt: string | null;
  failureReason?: string | null;
};

const termGroups: Array<{ label: string; terms: string[] }> = [
  { label: 'Actions et symboles', terms: ['NVIDIA', 'NVDA', 'TSMC', 'ASML', 'Micron', 'Broadcom', 'AMD', 'Intel', 'Samsung', 'Hynix', 'Nasdaq', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO', 'MU', 'QCOM', 'ETF', 'FNB'] },
  { label: 'Marchés et instruments', terms: ['actions', 'obligations', 'options', 'indice', 'bourse', 'cotation', 'spread', 'volume', 'cours', 'coupon', 'duration'] },
  { label: 'Analyse financière', terms: ['PER', 'PBR', 'BPA', 'ROE', 'ROIC', 'EBITDA', 'capitalisation', 'benefice', 'revenus', 'marge', 'consensus', 'guidance', 'analyste'] },
  { label: 'Risque et portefeuille', terms: ['rendement', 'rendements', 'volatilite', 'volatilites', 'portefeuille', 'liquidite', 'allocation', 'diversification', 'risque', 'croissance', 'plus-value', 'moins-value', 'surperformance', 'sousperformance'] },
  { label: 'Économie et secteurs', terms: ['taux', 'inflation', 'recession', 'capital', 'materiaux', 'semiconducteurs', 'semi-conducteurs', 'dividende'] },
];

function termCategory(term: string) {
  return termGroups.find((group) => group.terms.some((item) => item.toLowerCase() === term.toLowerCase()))?.label ?? 'Terme personnalisé';
}

function dateTime(value: string) {
  return new Date(value).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' });
}

export function VoiceVocabularyPanel({ vocabulary, onSave, onError }: {
  vocabulary: VoiceVocabulary | null;
  onSave: (phrases: string[]) => Promise<void>;
  onError: (error: string) => void;
}) {
  const [phrases, setPhrases] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const source = vocabulary?.phrases.join('\u0000') ?? '';

  useEffect(() => { if (vocabulary) setPhrases(vocabulary.phrases); }, [source]);

  const normalized = phrases.map((phrase) => phrase.trim()).filter(Boolean);
  const dirty = vocabulary != null && (normalized.length !== vocabulary.phrases.length || normalized.some((phrase, index) => phrase !== vocabulary.phrases[index]));
  const visible = normalized.filter((phrase) => `${phrase} ${termCategory(phrase)}`.toLocaleLowerCase('fr-CA').includes(search.trim().toLocaleLowerCase('fr-CA')));

  const addTerms = () => {
    const incoming = newTerm.split(',').map((term) => term.trim()).filter(Boolean);
    if (!incoming.length) return;
    setPhrases((current) => [...current, ...incoming].filter((term, index, all) => all.findIndex((item) => item.toLocaleLowerCase('fr-CA') === term.toLocaleLowerCase('fr-CA')) === index).slice(0, 256));
    setNewTerm('');
  };

  const save = async () => {
    setSaving(true); onError('');
    try { await onSave(normalized); }
    catch (reason) { onError(reason instanceof Error ? reason.message : 'La mise à jour du vocabulaire AWS a échoué.'); }
    finally { setSaving(false); }
  };

  const stateLabel = vocabulary?.state === 'READY' ? 'Prêt pour la dictée' : vocabulary?.state === 'PENDING' ? 'Mise à jour AWS en cours' : vocabulary?.state === 'FAILED' ? 'Mise à jour échouée' : vocabulary ? vocabulary.state : 'Chargement du vocabulaire…';
  return <div className="admin-content-panel voice-vocabulary-panel">
    <div className="admin-section-heading"><div><h2>Vocabulaire de la dictée</h2><p>Ajoute les noms de sociétés, symboles et termes financiers que Transcribe doit mieux reconnaître.</p></div><span className={`voice-vocab-state ${vocabulary?.state === 'READY' ? 'ready' : vocabulary?.state === 'FAILED' ? 'failed' : ''}`}><i />{stateLabel}</span></div>
    <article className="admin-card voice-vocab-explainer"><div className="voice-vocab-mark"><BookOpen size={18} /></div><div><strong>Ce vocabulaire aide AWS Transcribe à reconnaître les termes rares.</strong><p>Il est utilisé pendant la transcription en français canadien ({vocabulary?.languageCode ?? 'fr-CA'}). Les termes ajoutés sont envoyés à Amazon Transcribe; ils ne changent pas la langue ni les données de marché. La reconnaissance dépend aussi de la prononciation et du contexte.</p><small>{vocabulary?.name ?? 'Vocabulaire AWS'} · {vocabulary?.lastModifiedAt ? `Modifié ${dateTime(vocabulary.lastModifiedAt)}` : 'Source AWS'}</small></div></article>
    {vocabulary?.failureReason && <div className="admin-inline-error" role="alert">AWS : {vocabulary.failureReason}</div>}
    <div className="admin-card voice-vocab-manager">
      <div className="voice-vocab-toolbar"><div><h3>Termes reconnus <span>{normalized.length}/256</span></h3><p>Les modifications prennent effet après le traitement par AWS.</p></div><button className="admin-text-button" type="button" onClick={() => vocabulary && setPhrases(vocabulary.recommendedPhrases)} disabled={!vocabulary || saving}>Restaurer la sélection recommandée</button></div>
      <div className="voice-vocab-add"><label className="voice-vocab-input"><span>Ajouter un ou plusieurs termes</span><div><input value={newTerm} onChange={(event) => setNewTerm(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTerms(); } }} placeholder="Ex. : volatilite, S&P…" maxLength={256} /><button type="button" onClick={addTerms} disabled={!newTerm.trim() || normalized.length >= 256}><Plus size={15} />Ajouter</button></div></label><label className="voice-vocab-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher dans les termes…" aria-label="Rechercher un terme" /><span>{visible.length} résultat{visible.length === 1 ? '' : 's'}</span></label></div>
      <div className="voice-vocab-list" role="list" aria-label="Termes du vocabulaire vocal">{visible.map((phrase) => <div className="voice-vocab-row" role="listitem" key={phrase}><span className="voice-vocab-term">{phrase}</span><span className="voice-vocab-category">{termCategory(phrase)}</span><button type="button" onClick={() => setPhrases((current) => current.filter((term) => term !== phrase))} aria-label={`Retirer ${phrase}`} title={`Retirer ${phrase}`}><X size={15} /></button></div>)}{!visible.length && <div className="voice-vocab-empty">{search ? 'Aucun terme ne correspond à cette recherche.' : 'Le vocabulaire AWS ne contient pas encore de terme.'}</div>}</div>
      <div className="voice-vocab-footer"><span>{dirty ? 'Modifications non enregistrées' : 'Liste synchronisée avec AWS'}{vocabulary?.state === 'PENDING' ? ' · traitement AWS en cours' : ''}</span><button className="voice-vocab-save" type="button" onClick={() => void save()} disabled={!dirty || saving || !vocabulary || (vocabulary.state !== 'READY' && vocabulary.state !== 'FAILED')}>{saving ? <RefreshCw size={15} className="is-spinning" /> : <Check size={15} />}{saving ? 'Enregistrement…' : 'Enregistrer dans AWS'}</button></div>
    </div>
  </div>;
}
