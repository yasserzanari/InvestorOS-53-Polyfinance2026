import type { PublicXProfile } from '../../shared/api';
import { XProfileHeader } from './XProfileHeader';
import { XPostCard } from './XPostCard';

export function XProfileDetails({profile,onRefresh,refreshing=false}:{profile:PublicXProfile;onRefresh:()=>void;refreshing?:boolean}) {
  return <article className="source-x-profile"><XProfileHeader profile={profile}/><div className="source-posts-heading"><h4>Publications récentes</h4><button type="button" disabled={refreshing} onClick={onRefresh}>{refreshing?'Actualisation…':'Actualiser'}</button></div>{profile.recentPosts?.length ? <div className="source-recent-posts">{profile.recentPosts.map(post=><XPostCard key={post.id} post={post} profile={profile}/>)}</div> : <p role="status">{profile.recentPosts===undefined?'Lecture des publications via API Anything…':profile.latestPostReason||'Aucune publication visible.'}</p>}<p className="source-posts-note">{profile.postsSource||'API Anything · X getRecentPosts'} · publications visibles sans connexion, triées par date. X peut limiter la liste publique.</p></article>;
}
