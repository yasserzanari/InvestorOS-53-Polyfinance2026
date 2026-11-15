import './x-post-card.css';
import { useState } from 'react';
import { Bookmark, ChartNoAxesColumnIncreasing, Check, Ellipsis, Heart, MessageCircle, Repeat2, Upload } from 'lucide-react';
import { XVerificationBadge } from './XProfileHeader';
import type { PublicXPost, PublicXProfile } from '../../shared/api';

const compact = (value?: number) => value === undefined ? undefined : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

export function XPostCard({ post, profile }: {post:PublicXPost; profile:PublicXProfile}) {
  const [expanded,setExpanded]=useState(false);
  const [copied,setCopied]=useState(false);
  const [shareError,setShareError]=useState(false);
  const url=post.url || `https://x.com/${profile.username}/status/${post.id}`;
  const isLong=post.text.length>340 || post.text.split('\n').length>7;
  const date=post.created_at ? new Date(post.created_at) : undefined;
  const validDate=date&&!Number.isNaN(date.getTime());
  const stats=[{Icon:MessageCircle,value:post.metrics?.replies,label:'réponses',tone:'reply'}, {Icon:Repeat2,value:post.metrics?.reposts,label:'republications',tone:'repost'}, {Icon:Heart,value:post.metrics?.likes,label:'mentions J’aime',tone:'like'}, {Icon:ChartNoAxesColumnIncreasing,value:post.metrics?.views,label:'vues',tone:'views'}];
  async function share(){try{await navigator.clipboard.writeText(url);setCopied(true);setShareError(false);window.setTimeout(()=>setCopied(false),2000);}catch{setShareError(true);}}
  return <article className="x-post-card">
    <a className="x-post-avatar" href={`https://x.com/${profile.username}`} target="_blank" rel="noreferrer" aria-label={`Profil de ${profile.name}`}>{profile.image?<img src={profile.image} alt="" referrerPolicy="no-referrer"/>:<span>{profile.name.slice(0,1)}</span>}</a>
    <div className="x-post-main">
      <header className="x-post-header"><a href={`https://x.com/${profile.username}`} target="_blank" rel="noreferrer" className="x-post-name">{profile.name}</a><XVerificationBadge profile={profile}/><span className="x-post-handle">@{profile.username}</span><span className="x-post-dot">·</span><a className="x-post-date" href={url} target="_blank" rel="noreferrer" title={validDate?date.toLocaleString('fr-CA'):undefined}><time dateTime={post.created_at}>{validDate?date.toLocaleDateString('fr-CA',{month:'short',day:'numeric'}):'Voir'}</time></a><a className="x-post-more" href={url} target="_blank" rel="noreferrer" aria-label="Ouvrir la publication sur X"><Ellipsis size={18}/></a></header>
      <p className={`x-post-text${isLong&&!expanded?' is-collapsed':''}`}>{post.text || 'Publication avec média'}</p>
      {isLong&&<button className="x-post-expand" type="button" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded}>{expanded?'Voir moins':'Voir plus'}</button>}
      {post.images?.length ? <div className={`x-post-media${post.images.length>1?' is-grid':''}`}>{post.images.map(image=><a key={image} href={url} target="_blank" rel="noreferrer"><img src={image} alt="Média joint à la publication" loading="lazy" referrerPolicy="no-referrer"/></a>)}</div>:null}
      <footer className="x-post-stats">{stats.map(({Icon,value,label,tone})=><a className={`x-post-stat is-${tone}`} key={tone} href={url} target="_blank" rel="noreferrer" aria-label={value===undefined?`${label} : indisponible · ouvrir sur X`:`${value.toLocaleString('fr-CA')} ${label} · ouvrir sur X`} title={value===undefined?'Non communiqué par X':`${value.toLocaleString('fr-CA')} ${label}`}><Icon size={17}/>{value!==undefined&&<span>{compact(value)}</span>}</a>)}<a className="x-post-save" href={url} target="_blank" rel="noreferrer" aria-label="Ouvrir sur X pour enregistrer"><Bookmark size={17}/></a><button type="button" className="x-post-share" onClick={()=>void share()} aria-label={copied?'Lien copié':'Copier le lien'} title={copied?'Lien copié':'Copier le lien'}>{copied?<Check size={17}/>:<Upload size={17}/>}</button></footer>
      {shareError&&<a className="x-post-share-fallback" href={url} target="_blank" rel="noreferrer">Ouvrir le lien pour le partager ↗</a>}
    </div>
  </article>;
}
