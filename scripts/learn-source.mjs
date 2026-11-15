import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { PNG } from 'pngjs';
import { lookup } from 'node:dns/promises';
import { BlockList } from 'node:net';
const blocked = new BlockList();
for(const [net,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['100.64.0.0',10],['224.0.0.0',4],['240.0.0.0',4]]) blocked.addSubnet(net,prefix,'ipv4');
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('api-anything'));
const { openBrowser, closeBrowser } = await import(pathToFileURL(join(root, 'browser.js')));
const { profileDir } = await import(pathToFileURL(join(root, 'heal.js')));
const { learnSite } = await import(pathToFileURL(join(root, 'learnsite.js')));
const [url, output] = process.argv.slice(2);
mkdirSync(output, { recursive: true });
const state = { status: 'running', events: [], url, frame: 0 };
function publish() { writeFileSync(join(output,'state.tmp'), JSON.stringify(state)); renameSync(join(output,'state.tmp'),join(output,'state.json')); }
function event(message) { state.events.push({ message, at: new Date().toISOString() }); publish(); }
let timer;
let capturing = false;
try {
  event('Démarrage du navigateur de lecture.');
  const ctx = await openBrowser({ profileDir: profileDir(), headless: true });
  await ctx.route('**/*', async route => {
    try {
      const u = new URL(route.request().url());
      if(!['https:','http:'].includes(u.protocol) || u.username || u.password) return route.abort();
      const ips = await lookup(u.hostname, { all:true, family:4 });
      if(!ips.length || ips.some(ip => blocked.check(ip.address,'ipv4'))) return route.abort();
      return route.continue();
    } catch { return route.abort(); }
  });
  timer = setInterval(async () => {
    if(capturing) return; capturing = true;
    try {
      const page = ctx.pages().filter(p => p.url().startsWith('http')).at(-1);
      if(page) {
        const bytes = await page.screenshot({ type:'png', timeout:2500 });
        PNG.sync.read(bytes, { checkCRC: true });
        const id = state.frame + 1;
        writeFileSync(join(output, `frame-${id}.tmp`), bytes);
        renameSync(join(output, `frame-${id}.tmp`), join(output, `frame-${id}.png`));
        state.frame = id; state.url = page.url(); publish();
      }
    } catch { /* Keep the last completely decoded frame. */ }
    finally { capturing = false; }
  }, 1000);
  const page = await ctx.newPage();
  await page.setViewportSize({width:1100,height:720});
  event('Ouverture de la page et inspection des liens publics.');
  await page.goto(url, { waitUntil:'domcontentloaded', timeout:30000 });
  const origin = new URL(url).origin;
  const links = await page.locator('a[href]').evaluateAll(els => els.map(el => el.href));
  const groups = new Map();
  for(const link of [...new Set(links)]) {
    try {
      const u = new URL(link);
      if(u.origin!==origin || u.hash || u.search || /login|logout|delete|checkout|cart|signout/i.test(u.pathname)) continue;
      const pieces=u.pathname.split('/').filter(Boolean); const value=pieces.pop();
      if(!value || value.length<3) continue;
      const prefix='/'+(pieces.length?pieces.join('/')+'/':'');
      const group=groups.get(prefix)||[]; group.push({value,url:u.href}); groups.set(prefix,group);
    } catch {}
  }
  const choices=[...groups.entries()].filter(([,items])=>items.length>=3).slice(0,15);
  let choice=0;
  if(choices.length && process.env.SOURCE_PYTHON) {
    event('Consultation du planificateur IA pour choisir les pages de vérification.');
    try {
      const plan=JSON.parse(execFileSync(process.env.SOURCE_PYTHON,[new URL('./plan-source.py',import.meta.url).pathname],{input:JSON.stringify({groups:choices.map(([prefix,items])=>({prefix,examples:items.slice(0,3)}))}),encoding:'utf8',timeout:35000}));
      if(plan.available && Number.isInteger(plan.index)&&plan.index>=0&&plan.index<choices.length) {choice=plan.index;event('Plan Bedrock : '+plan.summary);}
      else event('Planificateur IA indisponible. Poursuite avec la sélection automatique API Anything.');
    } catch {event('Planificateur IA indisponible. Poursuite avec la sélection automatique API Anything.');}
  }
  const group=choices[choice];
  if(!group) throw new Error('Trois pages publiques comparables du même site sont nécessaires pour vérifier l’API. Aucun groupe suffisant n’a été trouvé.');
  const candidates=group[1].slice(0,3).map(item=>item.value);
  await page.goto(group[1][0].url,{waitUntil:'domcontentloaded',timeout:30000});
  const canonical=new URL(page.url());
  const trigger=canonical.origin+group[0]+'{path}'+(canonical.pathname.endsWith('/')?'/':'');
  event('Trois pages identifiées. Analyse des requêtes et extraction des champs.');
  const site = 'custom-' + new URL(url).hostname.replace(/[^a-z0-9-]/g,'-').slice(0,38);
  const input = { site, op:'readPage', trigger, args:{path:candidates[0]}, args2:{path:candidates[1]}, args3:{path:candidates[2]}, intent:'Lire le titre et le contenu public de la page', fresh:true };
  let result = await learnSite(input, { consent: async()=>false });
  if(!result.ok && result.captures?.length===2 && result.alternatives?.some(a=>a.method==='GET'&&a.type?.includes('html'))) {
    const candidate = result.alternatives.find(a=>a.method==='GET'&&a.type?.includes('html'));
    event('L’extraction automatique est insuffisante. Vérification d’une recette HTML de lecture sur les captures.');
    result = await learnSite({...input, captures:result.captures, pickRequest:candidate.request, html:{items:'html',fields:{title:'title',content:'body'}}}, { consent:async()=>false });
  }
  state.result = result;
  if(!result.ok || result.proof?.holdout?.ok !== true || result.proof?.cleanReplay !== 'ok') {
    throw new Error(result.error || result.next || 'La vérification indépendante de l’opération n’a pas abouti.');
  }
  state.site = result.site || site;
  event('Opération créée et vérifiée sur une troisième page.');
  state.status = 'complete'; publish();
} catch(e) { state.status='error'; event(e.message || 'Apprentissage indisponible.'); }
finally { clearInterval(timer); await closeBrowser(); }
