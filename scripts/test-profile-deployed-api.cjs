// Deployed development API smoke check. Never writes or prints Cognito tokens/passwords.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin=process.env.INVESTOROS_DEPLOYED_ORIGIN||'https://d10hypspu2l2nc.cloudfront.net';
const api=process.env.INVESTOROS_DEPLOYED_API||'https://2u00myl9n1.execute-api.us-east-1.amazonaws.com';
(async()=>{
 const secrets=Object.fromEntries(fs.readFileSync('apps/api/.env.codex-test.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^(['"])(.*)\1$/,'$2')]}));
 assert.ok(secrets.COGNITO_TEST_USERNAME&&secrets.COGNITO_TEST_PASSWORD);
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const p=await browser.newPage({viewport:{width:1440,height:950}});p.setDefaultTimeout(90000);
 p.on('requestfailed',request=>{if(request.url().startsWith(api))console.log('API request failed',request.method(),new URL(request.url()).pathname,request.failure()?.errorText)});
 try{
  await p.goto(origin+'/login');
  await p.getByLabel('Nom d’utilisateur',{exact:true}).fill(secrets.COGNITO_TEST_USERNAME);
  await p.getByLabel('Mot de passe',{exact:true}).fill(secrets.COGNITO_TEST_PASSWORD);
  await p.getByRole('button',{name:'Se connecter',exact:true}).click();
  await p.waitForURL('**/app**');
  const result=await p.evaluate(async api=>{
   const entry=Object.entries(sessionStorage).find(([k])=>k.endsWith('.accessToken'));
   if(!entry)throw Error('Session de test absente');
   const token=entry[1],claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
   const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'},probes=[];
   for(const path of ['/health','/v1/profiles/status','/v1/simulation/assets','/v1/profiles/memory/robert','/v1/profiles/research/analyses?accountId=mateo&limit=1']){
    try{
     const r=await fetch(api+path,{headers});const body=await r.json();
     probes.push({path,status:r.status,detail:body.detail,skillsVersion:body.skillsVersion,storage:body.storage,assetCount:body.assets?.length,researchCount:body.analyses?.length});
    }catch(error){probes.push({path,status:null,error:error.message})}
   }
   if(probes.some(probe=>probe.status!==200))return{at:new Date().toISOString(),tokenUse:claims.token_use,groups:claims['cognito:groups'],probes};
   const unauthenticated=await fetch(api+'/v1/profiles/status');
   const memoryResponse=await fetch(api+'/v1/profiles/memory/robert',{headers});const memory=await memoryResponse.json();
   let memoryWriteStatus,memoryConflictStatus,chat;
   if(memoryResponse.ok){
    const payload={expectedRevision:memory.revision,profile:memory.profile,tabs:memory.tabs,sources:memory.sources||[]};
    memoryWriteStatus=(await fetch(api+'/v1/profiles/memory/robert',{method:'PUT',headers,body:JSON.stringify(payload)})).status;
    memoryConflictStatus=(await fetch(api+'/v1/profiles/memory/robert',{method:'PUT',headers,body:JSON.stringify(payload)})).status;
    const fields=['objective','horizon','riskTolerance','lossCapacity','liquidity','constraints','preferences','knowledge'];
    const request={accountId:'robert',workspaceMode:'profiles',profile:Object.fromEntries(fields.map(k=>[k,memory.profile[k]])),tabs:memory.tabs,message:'Compare historiquement AAPL et MSFT du 1 janvier 2025 au 12 novembre 2026, avec les mêmes dates et la même devise. Ouvre Comparer. Cette demande porte seulement sur les historiques.'};
    const config=await(await fetch(api+'/v1/profiles/status',{headers})).json();
    const started=performance.now();let events=[],status;
    if(config.chatTransport==='async'){
     const launched=await fetch(api+'/v1/profiles/chat/jobs',{method:'POST',headers,body:JSON.stringify(request)});status=launched.status;
     const job=await launched.json();let cursor=0;
     if(!launched.ok)throw Error('Async job launch '+status);
     while(performance.now()-started<190000){
      const response=await fetch(api+'/v1/profiles/chat/jobs/'+job.jobId+'?accountId=robert&after='+cursor,{headers});
      if(!response.ok)throw Error('Async job read '+response.status);
      const state=await response.json();events.push(...state.events);cursor=state.nextCursor;
      if(['done','failed','cancelled'].includes(state.status))break;
      await new Promise(resolve=>setTimeout(resolve,800));
     }
    }else{
     const response=await fetch(api+'/v1/profiles/chat',{method:'POST',headers,body:JSON.stringify(request)});status=response.status;
     const text=await response.text();try{events=text.trim().split('\n').filter(Boolean).map(l=>JSON.parse(l))}catch{events=[]}
    }
    chat={transport:config.chatTransport,status,durationMs:Math.round(performance.now()-started),error:events.find(e=>e.type==='error')?.message,done:events.some(e=>e.type==='done'),tools:events.filter(e=>e.type==='tool'&&e.status==='done').map(e=>e.name),navigation:events.filter(e=>e.type==='profile_view').map(e=>e.view)};
   }
   return{at:new Date().toISOString(),tokenUse:claims.token_use,groups:claims['cognito:groups'],probes,unauthenticatedStatus:unauthenticated.status,memoryWriteStatus,memoryConflictStatus,chat};
  },api);
  fs.writeFileSync('docs/prep/profile-workbench-evidence/aws-renewed/deployed-authorization-after.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  assert.ok(result.probes.every(p=>p.status===200));
  assert.equal(result.unauthenticatedStatus,401);
  assert.equal(result.memoryWriteStatus,200);assert.equal(result.memoryConflictStatus,409);
  assert.ok(result.chat?.done);assert.ok(result.chat.tools.includes('compare_profile_instruments'));assert.ok(result.chat.navigation.includes('comparison'));
 }finally{await browser.close()}
})().catch(error=>{console.error(error.message);process.exitCode=1});

