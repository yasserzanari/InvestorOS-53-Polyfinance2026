// Real memory HTTP and browser UI; only the model reply is intercepted for deterministic action checks.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const {capture}=require('./browser-capture.cjs');
(async()=>{
 const base=process.env.PROFILE_WEB_URL||'http://127.0.0.1:5175', endpoint=base+'/profile-api/v1/profiles/memory/mateo';
 const baseline=await(await fetch(endpoint)).json();
 assert.ok(baseline.profile);
 const fixtureId='alignment-browser-'+Date.now(),sourceId=fixtureId+'-source';
 const insight={type:'insight',title:'Concentration à examiner · essai navigateur',question:'Cette idée modifie-t-elle mon projet ?',status:'tension',summary:'Une interprétation contextualisée à discuter, distincte des règles de champs.',fields:['horizon','objective'],evidenceIds:[sourceId],alternatives:['Distinguer le capital de ce projet','Comparer une autre hypothèse'],nextQuestion:'Quelle part du capital est concernée ?',limits:['La composition sous-jacente reste inconnue.'],profileSnapshot:baseline.profile,createdAt:new Date().toISOString(),fixtureId};
 const tab={id:'profile-alignment',title:'Alignement',kind:'decision',content:JSON.stringify(insight)};
 const seeded=await fetch(endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:baseline.revision,profile:baseline.profile,tabs:[...baseline.tabs.filter(t=>t.id!==tab.id),tab],sources:[...(baseline.sources||[]).slice(-79),{id:sourceId,index:80,title:'Source de test liée au constat',url:'https://example.org/'+fixtureId,snippet:'Fixture de vérification d’interface, sans donnée financière.'}]})});
 assert.equal(seeded.status,200);
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 const p=await browser.newPage({viewport:{width:1440,height:950},reducedMotion:'reduce'}),errors=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>localStorage.setItem('investoros.demo.active-account.v1','mateo'));
 await p.route('**/v1/profiles/chat',async route=>{
  const request=route.request().postDataJSON();requests.push(request);
  const note={id:fixtureId+'-note',title:'Piste à reprendre · essai navigateur',kind:'note',content:'La piste sélectionnée est conservée pour la discussion.'};
  const events=[{type:'workspace',profile:request.profile,tabs:[...request.tabs,note]},{type:'profile_view',view:'documents',documentId:note.id},{type:'done'}];
  await route.fulfill({status:200,contentType:'application/x-ndjson',body:events.map(e=>JSON.stringify(e)).join('\n')+'\n'});
 });
 try{
  await p.goto(base+'/app/profiles');await p.waitForFunction(()=>document.querySelector('.pb-footer')?.textContent.includes('restaurée'));
  await p.getByRole('tab',{name:'Alignement',exact:true}).click();
  await p.getByRole('heading',{name:insight.question,exact:true}).waitFor();
  assert.match(await p.locator('.pb-finding-detail').innerText(),/TENSION À DISCUTER/);
  await p.getByText('Limites de ce constat (1)',{exact:true}).click();
  await p.getByText(insight.limits[0],{exact:true}).waitFor();
  await p.getByRole('button',{name:insight.alternatives[0],exact:true}).click();
  await p.waitForFunction(()=>document.querySelector('.pw-user-message')?.textContent?.includes('Examinons cette piste'));
  assert.match(requests[0].message,/Distinguer le capital de ce projet/);
  assert.equal(requests[0].workspaceMode,'profiles');
  await p.getByRole('heading',{name:'Piste à reprendre · essai navigateur',exact:true}).waitFor();
  assert.equal(await p.getByRole('tab',{name:'Documents',exact:true}).getAttribute('aria-selected'),'true');
  assert.equal(await p.getByRole('textbox',{name:'Contenu du document',exact:true}).inputValue(),'La piste sélectionnée est conservée pour la discussion.');
  await p.getByRole('tab',{name:'Alignement',exact:true}).click();
  await p.getByRole('button',{name:'Voir les preuves',exact:true}).click();
  assert.equal(await p.getByRole('tab',{name:'Preuves',exact:true}).getAttribute('aria-selected'),'true');
  assert.equal(await p.locator('.pb-evidence-list>a').count(),1);
  await p.getByRole('link',{name:/Source de test liée/}).waitFor();
  await p.getByRole('tab',{name:'Alignement',exact:true}).click();
  await p.locator('.pb-insight-fields button').filter({hasText:'Horizon'}).click();
  const horizon=p.getByRole('textbox',{name:'Horizon',exact:true});
  const testHorizon='18 mois — essai de lien profil';
  await horizon.fill(testHorizon);await p.waitForTimeout(1400);
  await p.getByRole('tab',{name:'Alignement',exact:true}).click();
  await p.getByText('Le profil a changé depuis cette analyse.',{exact:false}).waitFor();
  assert.equal(await p.getByRole('button',{name:insight.alternatives[0],exact:true}).isDisabled(),true);
  const geometry=await p.locator('.pb-body').evaluate(e=>({panelOverflow:e.scrollHeight-e.clientHeight,documentOverflow:document.documentElement.scrollHeight-innerHeight,horizontal:document.documentElement.scrollWidth-innerWidth}));
  assert.equal(geometry.documentOverflow,0);assert.equal(geometry.horizontal,0);
  const screenshot=await capture(p,'profile-alignment-discussion-verified',{fullPage:false});
  fs.copyFileSync(screenshot,'docs/prep/profile-workbench-evidence/alignement-interactif.png');
  console.log(JSON.stringify({status:'PASS',geometry,screenshot,checks:['constat IA distinct des règles','limites consultables','piste transmise au chat','document créé sélectionné par événement','preuve liée filtrée','lien vers champ','péremption et pistes désactivées'],model:'réponse interceptée, aucun appel Bedrock dans cet essai'},null,2));
  assert.deepEqual(errors,[]);
 }finally{
  await browser.close();
  const latest=await(await fetch(endpoint)).json();
  const current=latest.tabs.find(t=>t.id===tab.id),owned=current?.content.includes(fixtureId);
  const original=baseline.tabs.find(t=>t.id===tab.id);
  const tabs=(owned?[...latest.tabs.filter(t=>t.id!==tab.id),...(original?[original]:[])]:latest.tabs).filter(t=>t.id!==fixtureId+'-note');
  const profile={...latest.profile,origins:{...latest.profile.origins}};
  if(profile.horizon==='18 mois — essai de lien profil'){
   const changedOnlyHere=Object.keys(baseline.profile).filter(k=>!['horizon','origins','confirmed','updatedAt','version'].includes(k)).every(k=>JSON.stringify(baseline.profile[k])===JSON.stringify(profile[k]));
   profile.horizon=baseline.profile.horizon;profile.origins.horizon=baseline.profile.origins.horizon;
   if(changedOnlyHere){profile.confirmed=baseline.profile.confirmed;profile.version=baseline.profile.version;profile.updatedAt=baseline.profile.updatedAt;}
  }
  const restored=await fetch(endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:latest.revision,profile,tabs,sources:(latest.sources||[]).filter(s=>s.id!==sourceId)})});
  assert.equal(restored.status,200,'Restaurer les fixtures sans écraser une révision concurrente');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
