/* Real local API + browser checks. Uses demo fixtures; restores edited profile fields. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {capture}=require('./browser-capture.cjs');
const base=process.env.PROFILE_WEB_URL||'http://127.0.0.1:5175';
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const context=await b.newContext({viewport:{width:1440,height:950},reducedMotion:'reduce'});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 let original;
 try{
  await p.goto(base+'/app/profiles');await p.waitForFunction(()=>document.querySelector('.pb-footer')?.textContent?.includes('serveur')||document.querySelector('.pb-footer')?.textContent?.includes('restaurée'));
  for(const name of ['Profil','Alignement','Comparer','Scénarios','Preuves','Mémoire'])assert.equal(await p.getByRole('tab',{name,exact:true}).count(),1);
  original=await p.getByRole('textbox',{name:'Horizon',exact:true}).inputValue();
  await p.getByRole('textbox',{name:'Horizon',exact:true}).fill('12 ans — vérification de mémoire');
  await p.waitForTimeout(1300);
  const fresh=await b.newContext({viewport:{width:1440,height:950}});const second=await fresh.newPage();await second.goto(base+'/app/profiles');
  await second.waitForFunction(()=>document.querySelector('.pb-footer')?.textContent?.includes('restaurée'));
  assert.equal(await second.getByRole('textbox',{name:'Horizon',exact:true}).inputValue(),'12 ans — vérification de mémoire');
  await fresh.close();
  await p.getByRole('textbox',{name:'Horizon',exact:true}).fill(original);await p.waitForTimeout(1300);
  for(const name of ['Alignement','Comparer','Scénarios','Preuves','Mémoire','Profil']){
   await p.getByRole('tab',{name,exact:true}).click();
   const geometry=await p.locator('.pb-body').evaluate(e=>({overflow:e.scrollHeight-e.clientHeight,page:document.documentElement.scrollWidth-innerWidth}));
   assert.equal(geometry.page,0,`${name}: overflow horizontal`);console.log(name,geometry);
  }
  await p.getByRole('tab',{name:'Comparer',exact:true}).click();await p.getByRole('button',{name:'Comparer',exact:true}).click();await p.getByRole('cell',{name:'1,87 %',exact:true}).waitFor();
  await p.getByRole('textbox',{name:'Symboles à comparer'}).fill('AAPL, RY.TO');await p.getByRole('button',{name:'Comparer',exact:true}).click();await p.getByRole('alert').waitFor();assert.match(await p.getByRole('alert').innerText(),/Devises différentes/);
  await p.getByRole('button',{name:'Agrandir le panneau',exact:true}).click();assert.equal(await p.locator('.pw-chat').isVisible(),false);await p.getByRole('button',{name:'Afficher le chat',exact:true}).click();
  console.log('capture',await capture(p,'profile-workbench-verified',{fullPage:false}));
  await p.setViewportSize({width:390,height:844});await p.getByRole('tab',{name:'Profil',exact:true}).click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);
  assert.deepEqual(errors,[]);console.log('PASS: 6 vues, sauvegarde/restauration nouvelle session, refus FX, agrandissement et mobile');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
