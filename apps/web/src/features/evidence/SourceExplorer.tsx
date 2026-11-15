import { useEffect, useRef, useState } from 'react';
import { loadSourceCatalog, loadSourceOperations, loadPublicXProfile, loadPublicXPosts, loadSourceWorkspace, saveSourceWorkspace, type SourceWorkspace, type AnythingSite, type PublicXProfile } from '../../shared/api';
import { Plus, Search, Trash2, ChevronRight, Globe2, ArrowUpRight } from 'lucide-react';
import { XVerificationBadge } from './XProfileHeader';
import { XProfileDetails } from './XProfileDetails';
import { AddProfileDialog } from './AddProfileDialog';
import { AddSourceDialog } from './AddSourceDialog';
import { useDemoAccount } from '../../shared/DemoAccountContext';

export function SourceExplorer() {
  const { activeAccount } = useDemoAccount();
  return <AccountSourceExplorer key={activeAccount.id} account={activeAccount.id} />;
}

function AccountSourceExplorer({ account }: { account: string }) {
  const [hiddenSources,setHiddenSources] = useState<string[]>([]);
  const [sourceSearch,setSourceSearch] = useState('');
  const [showAdd,setShowAdd] = useState(false);
  const [job,setJob] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [searches, setSearches] = useState<SourceWorkspace['searches']>([]);
  const saveQueue = useRef(Promise.resolve());
  const [sites, setSites] = useState<AnythingSite[]>([]);
  const [selected, setSelected] = useState('x');
  const [operations, setOperations] = useState<Awaited<ReturnType<typeof loadSourceOperations>>>();
  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState<PublicXProfile>();
  const [authorized, setAuthorized] = useState<PublicXProfile[]>([]);
  const [showProfileSearch,setShowProfileSearch] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  useEffect(() => {
    const c = new AbortController();
    loadSourceWorkspace(account, c.signal).then(state => {
      setSelected(state.selected); setQuery(state.query); setProfile(state.authorized.find(item=>item.id===state.profile?.id) ? state.profile ?? undefined : state.authorized[0]);
      setHiddenSources(state.hidden_sources ?? []); setJob(state.learning_job ?? null); setAuthorized(state.authorized); setSearches(state.searches); setLoaded(true);
    }).catch(e => { if (!c.signal.aborted) setSaveError(e.message); });
    return () => c.abort();
  }, [account]);
  useEffect(() => {
    if (!loaded) return;
    setSaving(true);
    const timer = window.setTimeout(() => {
      const state = { hidden_sources: hiddenSources, learning_job: job, selected, query, profile: profile ?? null, authorized, searches };
      saveQueue.current = saveQueue.current.then(async () => {
        try { await saveSourceWorkspace(account, state); setSaveError(''); }
        catch(e) { setSaveError(e instanceof Error ? e.message : 'Enregistrement impossible.'); }
        finally { setSaving(false); }
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loaded, selected, query, profile, authorized, searches, account, hiddenSources, job]);

  useEffect(() => { const c = new AbortController(); loadSourceCatalog(c.signal).then(r => {
    setSites(r.sites);
    setSelected(current => r.sites.some(site => site.name === current) ? current : r.sites.find(site => site.name === 'x')?.name ?? r.sites[0]?.name ?? 'x');
  }).catch(e => { if (!c.signal.aborted) setCatalogError(e.message); }); return () => c.abort(); }, []);
  useEffect(() => { const c = new AbortController(); setOperations(undefined); setCatalogError(''); loadSourceOperations(selected, c.signal).then(setOperations).catch(e => { if (!c.signal.aborted) setCatalogError(e.message); }); return () => c.abort(); }, [selected]);
  useEffect(() => {
    if (!profile || (profile.recentPosts !== undefined && profile.recentPosts.every(post => post.metrics !== undefined))) return;
    const controller = new AbortController();
    const id = profile.id;
    loadPublicXPosts(profile.username, controller.signal).then(result => setProfile(current => current?.id === id ? {...current, recentPosts: result.posts, latestPost: result.posts[0] ?? null, latestPostReason: result.reason, postsObservedAt: result.observedAt, postsSource: result.source} : current)).catch(() => undefined);
    return () => controller.abort();
  }, [profile?.id, profile?.recentPosts]);
  useEffect(() => {
    if (!profile || profile.detailsVersion === 1) return;
    const c = new AbortController();
    const id = profile.id;
    loadPublicXProfile(profile.username, c.signal).then(result => setProfile(current => current?.id === id ? result : current)).catch(() => undefined);
    return () => c.abort();
  }, [profile?.id, profile?.detailsVersion]);
  let website: URL | undefined;
  try {
    const parsed = new URL(operations?.baseUrl ?? '');
    if (['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password) website = parsed;
  } catch { /* Only display valid website links supplied by the source. */ }
  function save(next: PublicXProfile[]) { setAuthorized(next); }
  if (!loaded) return <section className="source-explorer"><p role={saveError ? 'alert' : 'status'}>{saveError || 'Chargement des sources enregistrées…'}</p></section>;
  return <section className="source-explorer">
    <header><span className="evidence-eyebrow">API ANYTHING</span><h2>Explorer les sources documentées</h2><p>Opérations disponibles et profils X autorisés pour ce compte de démonstration.</p></header>
    <p role={saveError ? "alert" : "status"} className="source-local-note">{saveError || (saving ? "Enregistrement en cours…" : "Modifications enregistrées sur le serveur")}</p>
    <div className="source-explorer-grid">
      <div className="source-catalog source-picker">
        <header><div><h3>Mes sources</h3><small>{sites.filter(site=>!hiddenSources.includes(site.name)).length} sources disponibles</small></div><button type="button" className="source-add-button" onClick={()=>{setJob(null);setShowAdd(true);}}><Plus size={15}/>Ajouter</button></header>
        <label className="source-search"><Search size={15}/><input aria-label="Filtrer les sources" placeholder="Rechercher une source…" value={sourceSearch} onChange={e=>setSourceSearch(e.target.value)}/></label>
        <div className="source-picker-list">{sites.filter(site=>!hiddenSources.includes(site.name)&&`${site.name} ${site.description}`.toLowerCase().includes(sourceSearch.toLowerCase())).map(site=><div key={site.name} className={`source-picker-row${selected===site.name?' is-active':''}`}><button type="button" onClick={()=>setSelected(site.name)} aria-pressed={selected===site.name}><span className="source-site-icon"><Globe2 size={17}/></span><span><strong>{site.name}</strong><small>{site.operations} API disponibles</small></span><ChevronRight size={15}/></button><button type="button" className="source-remove" aria-label={`Supprimer ${site.name}`} title="Supprimer de mes sources" onClick={()=>{setHiddenSources(previous=>[...previous,site.name]);if(selected===site.name)setSelected(sites.find(item=>item.name!==site.name&&!hiddenSources.includes(item.name))?.name??'x');}}><Trash2 size={15}/></button></div>)}</div>
        {hiddenSources.length>0&&<button type="button" className="source-restore" onClick={()=>setHiddenSources([])}>Restaurer les sources supprimées ({hiddenSources.length})</button>}
        {job&&<button type="button" className="source-restore" onClick={()=>setShowAdd(true)}>Ouvrir le dernier apprentissage</button>}
      </div>
      <aside className="source-catalog source-api-details"><header className="source-website-heading"><div><span>API DISPONIBLES</span><h3>{selected}</h3>{website&&<a className="source-website-url" href={website.href} target="_blank" rel="noopener noreferrer">{website.href}</a>}</div>{website&&<a className="source-website-button" href={website.href} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir le site ${selected} dans un nouvel onglet`}><Globe2 size={14}/>Ouvrir le site<ArrowUpRight size={14}/></a>}</header>
        {catalogError && <p role="alert">{catalogError}</p>}
        <div className="source-operation-list">{!operations && !catalogError && <p role="status">Lecture de la documentation…</p>}{operations?.operations.map(op => <article key={op.name}><strong>{op.name}</strong><small>{op.readOnly === false ? 'Écriture' : 'Lecture'}</small><p>{op.description}</p><code>{op.params.join(', ')}</code>{op.returns && <details><summary>Champs retournés</summary><p>{op.returns.join(' · ')}</p></details>}</article>)}</div>
        {operations?.notes && <details><summary>Limites documentées</summary><p>{operations.notes}</p></details>}
      </aside>
    </div>
      <section className="source-x-panel profiles-x-workspace" aria-label="Profils X autorisés">
        <div className="profiles-x-list-panel"><header><div><h3>Profils autorisés</h3><small>{authorized.length} profil{authorized.length===1?'':'s'}</small></div><button type="button" className="source-add-button" onClick={()=>setShowProfileSearch(true)}><Plus size={15}/>Ajouter un profil</button></header>
          <div className="profiles-x-list">{authorized.map(item=><div key={item.id} className={`profiles-x-row${profile?.id===item.id?' is-selected':''}`}><button type="button" className="profiles-x-select" aria-label={`Afficher ${item.name}`} aria-pressed={profile?.id===item.id} onClick={()=>setProfile(item)}>{item.image&&<img src={item.image} alt="" referrerPolicy="no-referrer"/>}<span><span className="profiles-x-row-name"><strong>{item.name}</strong><XVerificationBadge profile={item}/></span><small>@{item.username}</small></span><ChevronRight size={15}/></button><button type="button" className="source-remove" aria-label={`Retirer ${item.username}`} title="Retirer le profil" onClick={()=>{const remaining=authorized.filter(other=>other.id!==item.id);save(remaining);if(profile?.id===item.id)setProfile(remaining[0]);}}><Trash2 size={15}/></button></div>)}</div>
          {!authorized.length&&<p className="profile-search-empty">Ajoutez un profil pour retrouver ici ses informations et ses publications.</p>}
          <p className="source-local-note">Profils enregistrés sur le serveur pour le compte actif.</p>
          {searches.length>0&&<details className="profiles-search-history"><summary>Historique des recherches · {searches.length}</summary><ul className="source-authorized">{searches.slice().reverse().map((item,index)=><li key={`${item.at}-${index}`}><button type="button" onClick={()=>{setQuery(item.query);setShowProfileSearch(true);}}>{item.query}</button><small>{new Date(item.at).toLocaleString('fr-CA')}{item.error?' · Échec':''}</small></li>)}</ul></details>}
        </div>
        <aside className="profiles-x-details" aria-label="Profil sélectionné et publications">
          {profile&&authorized.some(item=>item.id===profile.id)?<XProfileDetails key={profile.id} profile={profile} onRefresh={()=>setProfile(current=>current?{...current,recentPosts:undefined}:current)}/>:<div className="profiles-x-placeholder"><Globe2 size={28}/><h3>Sélectionnez un profil</h3><p>Ses informations et ses dernières publications s’afficheront ici.</p></div>}
        </aside>
      </section>
      {showProfileSearch&&<AddProfileDialog query={query} onQuery={setQuery} authorized={authorized} onClose={()=>setShowProfileSearch(false)} onSearch={(value,error)=>setSearches(previous=>[...previous,{query:value,at:new Date().toISOString(),...(error?{error}:{})}])} onAdd={item=>{save([...authorized.filter(other=>other.id!==item.id),item]);setProfile(item);setShowProfileSearch(false);}}/>}
      {showAdd&&<AddSourceDialog account={account} job={job} onJob={id=>setJob(id||null)} onClose={()=>setShowAdd(false)} onComplete={site=>{setHiddenSources(previous=>previous.filter(name=>name!==site));setSelected(site);void loadSourceCatalog().then(result=>setSites(result.sites));}}/>}
  </section>;
}
