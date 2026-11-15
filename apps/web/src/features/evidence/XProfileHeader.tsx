import { CalendarDays, Link2, MapPin } from 'lucide-react';
import type { PublicXProfile } from '../../shared/api';

export function XVerificationBadge({profile}:{profile:PublicXProfile}) {
  const type=profile.verifiedType?.toLowerCase();
  if(!profile.verified&&type!=='government'&&type!=='business') return null;
  const variant=type==='government'?'government':type==='business'?'business':'blue';
  const label=variant==='government'?'Badge gris X · compte gouvernemental ou multilatéral':variant==='business'?'Badge doré X · organisation vérifiée':'Badge bleu X';
  return <span className={`x-verification-badge is-${variant}`} role="img" aria-label={label} title={label}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 1 2.7 2.3 3.5-.1.6 3.5 2.8 2.1-1.6 3.2.7 3.4-3.2 1.5-1.4 3.2-3.5-.6L7.4 22l-2-2.8-3.5-.6.1-3.5L0 12.4l2.3-2.7-.1-3.5 3.5-.6 2.1-2.8 3.2 1.6Z"/><path fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="m7.2 12.2 3 3 6.6-6.7"/></svg></span>;
}
export function XProfileHeader({profile}:{profile:PublicXProfile}) {
  const joined=profile.joinedAt?new Date(profile.joinedAt):undefined;
  const website=profile.website&&/^https?:\/\//i.test(profile.website)?profile.website:undefined;
  const count=(value:number)=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value);
  return <section className="x-profile-header" aria-label="Informations du profil X">
    <div className="x-profile-identity">{profile.image&&<img src={profile.image} alt="" referrerPolicy="no-referrer"/>}<div><div className="x-profile-title"><a href={`https://x.com/${profile.username}`} target="_blank" rel="noreferrer">{profile.name}</a><XVerificationBadge profile={profile}/></div><a className="x-profile-username" href={`https://x.com/${profile.username}`} target="_blank" rel="noreferrer">@{profile.username}</a></div></div>
    {profile.bio&&<p className="x-profile-bio">{profile.bio}</p>}
    <div className="x-profile-metadata">{profile.location&&<span><MapPin size={16}/>{profile.location}</span>}{website&&<a href={website} target="_blank" rel="noreferrer"><Link2 size={16}/>{new URL(website).hostname.replace(/^www\./,'')}</a>}{joined&&!Number.isNaN(joined.getTime())&&<span><CalendarDays size={16}/>Inscrit en {joined.toLocaleDateString('fr-CA',{month:'long',year:'numeric',timeZone:'UTC'})}</span>}</div>
    <div className="x-profile-counters">{profile.following!==undefined&&<span title={profile.following.toLocaleString('fr-CA')}><strong>{count(profile.following)}</strong> abonnements</span>}{profile.followers!==undefined&&<span title={profile.followers.toLocaleString('fr-CA')}><strong>{count(profile.followers)}</strong> abonnés</span>}</div>
  </section>;
}
