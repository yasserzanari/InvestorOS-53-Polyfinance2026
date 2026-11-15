import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink } from 'lucide-react';
import { XPostCard } from '../../evidence/XPostCard';
import { XVerificationBadge } from '../../evidence/XProfileHeader';
import type { Citation } from './StreamingAnswer';
import './tweet-source.css';

export function TweetSource({source}:{source:Citation}) {
  const [position,setPosition]=useState<{left:number;top:number}>();
  const anchor=useRef<HTMLAnchorElement>(null);
  const popup=useRef<HTMLDivElement>(null);
  const timer=useRef<number|undefined>(undefined);
  const id=useId();
  function closeSoon(){window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>setPosition(undefined),150);}
  function open(){window.clearTimeout(timer.current);const box=anchor.current?.getBoundingClientRect();if(!box)return;const width=Math.min(560,window.innerWidth-24);const height=Math.min(470,window.innerHeight-24);const below=box.bottom+8;setPosition({left:Math.max(12,Math.min(box.left,window.innerWidth-width-12)),top:below+height<=window.innerHeight-12?below:Math.max(12,box.top-height-8)});}
  useEffect(()=>{if(!position)return;const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setPosition(undefined);};const scroll=(e:Event)=>{if(e.target instanceof Node&&popup.current?.contains(e.target))return;setPosition(undefined);};window.addEventListener('keydown',escape);window.addEventListener('scroll',scroll,true);window.addEventListener('resize',scroll);return()=>{window.removeEventListener('keydown',escape);window.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',scroll);};},[position]);
  useEffect(()=>()=>window.clearTimeout(timer.current),[]);
  const post=source.xPost;const profile=source.xProfile;
  if(!post||!profile||!/^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/.test(source.url))return null;
  return <><a ref={anchor} className="tweet-source-row" href={source.url} target="_blank" rel="noopener noreferrer" onMouseEnter={open} onMouseLeave={closeSoon} onFocus={open} onBlur={e=>{if(!popup.current?.contains(e.relatedTarget))closeSoon();}} aria-expanded={Boolean(position)} aria-controls={position?id:undefined}>
    {profile.image?<img src={profile.image} alt="" referrerPolicy="no-referrer"/>:<span className="tweet-source-fallback">𝕏</span>}<span className="tweet-source-summary"><span><strong>{profile.name}</strong><XVerificationBadge profile={profile}/><small>@{profile.username}</small></span><span className="tweet-source-excerpt">{post.text}</span></span><ExternalLink size={14}/>
  </a>{position&&createPortal(<div ref={popup} id={id} className="tweet-source-overlay" role="region" aria-label={`Aperçu du tweet de ${profile.name}`} style={position} onMouseEnter={()=>window.clearTimeout(timer.current)} onMouseLeave={closeSoon} onFocus={()=>window.clearTimeout(timer.current)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))closeSoon();}}><div className="source-recent-posts" onClick={e=>{if(!(e.target as HTMLElement).closest('a,button'))window.open(source.url,'_blank','noopener,noreferrer');}}><XPostCard post={post} profile={profile}/></div><a className="tweet-source-open" href={source.url} target="_blank" rel="noopener noreferrer">Ouvrir la publication sur X <ExternalLink size={13}/></a></div>,document.body)}</>;
}
