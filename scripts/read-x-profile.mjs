import {call,loadSite,saveSite,closeBrowser} from 'api-anything';
const username=process.argv[2];
if(!/^[A-Za-z0-9_]{1,15}$/.test(username)) throw new Error('Invalid username');
const operation=structuredClone(loadSite('x').site.operations.find(op=>op.name==='getUser'));
operation.name='getUserDetails';
operation.response.pick.push('profile_bio.entities.url.urls','legacy.url','verification.verified');
const fields=operation.response.pick;
delete operation.response.pick;
delete operation.response.schema;
saveSite({name:'x-public-profile',baseUrl:'https://x.com',operations:[operation]});
try{
 const result=await call('x-public-profile','getUserDetails',{screen_name:username},{callOnly:true,maxTier:1,view:{maxChars:100000},maxAgeMs:60000});
 if(result.ok&&result.data&&typeof result.data==='object') result.data=Object.fromEntries(fields.map(path=>[path,path.split('.').reduce((value,key)=>value?.[key],result.data)]).filter(([,value])=>value!==undefined));
 console.log(JSON.stringify(result));
}finally{await closeBrowser();}
