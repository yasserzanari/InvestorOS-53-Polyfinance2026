import { readFileSync } from 'node:fs';
import { call, loadSite, saveSite, closeBrowser } from 'api-anything';
const username=process.argv[2];
if(!/^[A-Za-z0-9_]{1,15}$/.test(username)) throw new Error('Invalid username');
const site='x-public-timeline';
if(!loadSite(site)) saveSite(JSON.parse(readFileSync(new URL('../apps/api/src/investoros_api/source_specs/x-public-timeline.json',import.meta.url))));
try {
  const response=await call(site,'getRecentPosts',{screen_name:username},{callOnly:true,maxAgeMs:60000,view:{maxChars:200000},timeoutMs:12000,maxTier:1});
  if(!response.ok || response.truncated) throw new Error(response.reason || 'Réponse de publications incomplète.');
  const data=typeof response.data==='string'?JSON.parse(response.data):response.data;
  const user=data?.data?.user_result_by_screen_name?.result;
  const instructions=user?.profile_user_originals_timeline?.timeline?.instructions;
  if(!Array.isArray(instructions)) throw new Error('Le profil public ne fournit pas de publications lisibles.');
  const posts=new Map();
  function walk(value) {
    if(!value || typeof value!=='object') return;
    const result=value.tweet_results?.result;
    const tweet=result?.tweet || result;
    const author=tweet?.core?.user_results?.result;
    const handle=author?.core?.screen_name || author?.legacy?.screen_name;
    const id=tweet?.rest_id;
    if(typeof id==='string' && /^\d+$/.test(id) && handle?.toLowerCase()===username.toLowerCase()) {
      const details=tweet.details || tweet.legacy || {};
      const text=tweet.note_tweet?.note_tweet_results?.result?.text || details.full_text || '';
      const timestamp=details.created_at_ms ?? Date.parse(details.created_at);
      if(Number.isFinite(timestamp)) {
        const media=tweet.legacy?.extended_entities?.media || [];
        const images=media.filter(m=>m.type==='photo').map(m=>m.media_url_https).filter(u=>typeof u==='string'&&u.startsWith('https://'));
        const counts=tweet.counts || tweet.legacy || {};
        const number=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):undefined;
        const metrics={replies:number(counts.reply_count),reposts:number(counts.retweet_count),likes:number(counts.favorite_count),views:number(tweet.views?.count),bookmarks:number(counts.bookmark_count)};
        posts.set(id,{id,text,metrics,created_at:new Date(timestamp).toISOString(),url:`https://x.com/${handle}/status/${id}`,images});
      }
      return; // Nested quoted posts are not posts from this timeline.
    }
    for(const child of Object.values(value)) if(child&&typeof child==='object') walk(child);
  }
  instructions.forEach(walk);
  console.log(JSON.stringify({available:true,posts:[...posts.values()].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,8),source:'API Anything · X getRecentPosts',observedAt:new Date().toISOString()}));
} catch(e) {console.log(JSON.stringify({available:false,posts:[],reason:e.message}));}
finally {await closeBrowser();}
