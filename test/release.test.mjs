import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseGate,nextVersion} from '../scripts/release-policy.mjs';
const sha='a'.repeat(40),repo='lucaswenbo/AIDoneCheck';
const valid=['Test','Browser smoke','Action smoke','AIDoneCheck 可复现演示'].map((name,i)=>({name,id:i+1,head_sha:sha,head_branch:'main',event:'push',head_repository:{full_name:repo},status:'completed',conclusion:'success'}));
test('release requires all four successful exact-main workflows',()=>{assert(releaseGate(valid,sha,repo).every(g=>g.ok));assert(releaseGate(valid.slice(0,2),sha,repo).some(g=>!g.ok));});
for(const [field,value] of [['head_sha','b'.repeat(40)],['head_branch','feature'],['event','pull_request'],['head_repository',{full_name:'other/fork'}],['status','in_progress'],['conclusion','failure']])test(`release refuses mismatched ${field}`,()=>assert(releaseGate(valid.map(r=>({...r,[field]:value})),sha,repo).every(g=>!g.ok)));
test('newer failed or pending run cannot inherit an old green result',()=>{assert(!releaseGate([...valid,{...valid[0],id:999,conclusion:'failure'}],sha,repo)[0].ok);assert(!releaseGate([...valid,{...valid[0],id:999,status:'in_progress',conclusion:null}],sha,repo)[0].ok);});
test('release version only advances one chosen semantic level',()=>{for(const v of ['1.0.1','1.1.0','2.0.0'])assert(nextVersion('1.0.0',v));for(const v of ['1.0.0','0.9.9','1.0.2','1.2.0','2.0.1'])assert(!nextVersion('1.0.0',v));assert(nextVersion(null,'1.0.0'));assert(!nextVersion(null,'2.0.0'));});
