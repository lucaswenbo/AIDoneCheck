import test from 'node:test';
import assert from 'node:assert/strict';
import {runBrowser,parseConfig} from '../.build/core.js';
for(const kind of ['response','requestfailed'])for(const same of [true,false])test(`bounded Browser evidence retains ${kind} policy for ${same?'final':'other'} origin`,async()=>{
  const listeners={};let traceSaved=false;
  const page={on:(type,f)=>{listeners[type]=f;},setDefaultTimeout(){},setDefaultNavigationTimeout(){},url:()=> 'http://final.test/',title:async()=> 'Fixture',evaluate:async()=> 'Ready',screenshot:async()=>{},goto:async()=>{
    for(let i=0;i<200;i++)listeners.response({status:()=>404,url:()=>`http://peer.test/missing.js?${i}`,request:()=>({resourceType:()=> 'script'})});
    const url=`http://${same?'final':'peer'}.test/late.js`;
    if(kind==='response')listeners.response({status:()=>404,url:()=>url,request:()=>({resourceType:()=> 'script'})});
    else listeners.requestfailed({url:()=>url,resourceType:()=> 'script',failure:()=>({errorText:'net::ERR_CONNECTION_RESET'})});
    return {status:()=>200};
  }};
  const context={newPage:async()=>page,close:async()=>{},tracing:{start:async()=>{},stop:async options=>{traceSaved=Boolean(options?.path);}}};
  const checks=await runBrowser({newContext:async()=>context},parseConfig({version:1,browser:{enabled:true,url:'http://initial.test/',trace:'on-failure'}}).browser,'unused-by-fake-browser');
  assert.equal(checks[0].status,same?'fail':'warn');assert.equal(checks[0].blocking,same);
  assert.equal(checks[0].data.resources.length,200);assert.equal(checks[0].data.omittedCriticalFailureEvents,same?1:0);assert.equal(traceSaved,same);
});
