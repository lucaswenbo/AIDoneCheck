import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { check,parseConfig,prepareBrowser,runBrowser } from '../.build/core.js';
import {fixture,quietConfig,runCli,write} from './helpers.mjs';
import {startFixtures} from '../scripts/fixture-server.mjs';
const cases=[
  ['PASS','/pass','PASS',{expect:'Rendered evidence'}],
  ['pageerror','/pageerror','BLOCK',{}],
  ['script-fail','/script-fail','BLOCK',{}],
  ['style-fail','/style-fail','BLOCK',{}],
  ['http-error','/http-error','BLOCK',{}],
  ['cross-fail','/cross-fail','WARN',{}],
  ['resource-overflow','/resource-overflow','BLOCK',{}],
  ['console-warn','/console','WARN',{}],
  ['console-block','/console','BLOCK',{failConsole:true}],
  ['expect-missing','/pass','BLOCK',{expect:'absent substring'}],
  ['expect-case-sensitive','/pass','BLOCK',{expect:'ready'}],
  ['hidden-expect','/hidden','BLOCK',{expect:'SECRET_EXPECT'}],
  ['empty','/empty','WARN',{}],
  ['hidden-body','/hidden-body','WARN',{}],
  ['image-fail','/image-fail','WARN',{}],
  ['redirect-final-origin','/redirect','BLOCK',{}],
  ['redirect-pass','/pass-redirect','PASS',{}],
  ['always-trace','/pass','PASS',{trace:'always',profile:'mobile'}],
  ['trace-off','/pageerror','BLOCK',{trace:'off'}]
];
for(const [name,route,expected,extra] of cases)test(`Browser ${name}: ${expected}`,async t=>{
  const {root}=await fixture(t,{}),server=await startFixtures();t.after(server.close);
  const config=parseConfig(quietConfig({browser:{enabled:true,url:server.url+route,trace:'on-failure',...extra}}));
  const r=await check({event:{name:'fixture',payload:{}},cwd:root,config});assert.equal(r.verdict,expected,JSON.stringify(r.checks));
  const dir=path.join(root,'.aidonecheck/latest');
  for(const f of ['browser.png','report.json','report.md','agent-feedback.md'])assert((await fs.stat(path.join(dir,f))).size>0);
  const png=await fs.readFile(path.join(dir,'browser.png'));assert.equal(png.subarray(1,4).toString(),'PNG');
  const keep=extra.trace!=='off'&&(extra.trace==='always'||expected==='BLOCK');
  assert.equal(r.evidence.files.includes('trace.zip'),keep);
  if(keep){const trace=await fs.readFile(path.join(dir,'trace.zip'));assert.equal(trace.subarray(0,2).toString(),'PK');const entries=execFileSync('unzip',['-Z1',path.join(dir,'trace.zip')],{encoding:'utf8'});assert(entries.includes('.trace'));assert(entries.includes('.network'));}
  if(name==='pageerror'){assert((await fs.readFile(path.join(dir,'agent-feedback.md'),'utf8')).includes('fixture pageerror'));}
  if(name==='resource-overflow'){const data=r.checks.find(c=>c.id==='browser').data;assert.equal(data.resources.length,200);assert(data.omittedCriticalFailureEvents>0);assert(data.failures.some(s=>s.includes('omitted from detailed evidence')));}
  if(process.env.AIDONECHECK_SMOKE_EVIDENCE)await fs.cp(await fs.realpath(dir),path.join(process.env.AIDONECHECK_SMOKE_EVIDENCE,name),{recursive:true});
});
test('Browser unreachable URL BLOCK with screenshot and trace',async t=>{const {root}=await fixture(t,{});const r=await check({event:{name:'fixture',payload:{}},cwd:root,config:parseConfig(quietConfig({browser:{enabled:true,url:'http://127.0.0.1:1',trace:'on-failure'}}))});assert.equal(r.verdict,'BLOCK');assert(r.evidence.files.includes('browser.png'));assert(r.evidence.files.includes('trace.zip'));});
test('Browser screenshot failure warns; WARN alone does not retain on-failure trace',async t=>{const {root}=await fixture(t,{});const server=await startFixtures();t.after(server.close);const browser=await prepareBrowser(root);t.after(()=>browser.close());const wrapped={newContext:async options=>{const context=await browser.newContext(options);const newPage=context.newPage.bind(context);context.newPage=async()=>{const p=await newPage();p.screenshot=async()=>{throw new Error('fixture screenshot failure');};return p;};return context;}};const checks=await runBrowser(wrapped,parseConfig({version:1,browser:{enabled:true,url:server.url,trace:'on-failure'}}).browser,root);assert.equal(checks[0].status,'warn');assert.equal(checks[0].data.trace,false);});
test('Chromium missing is startup exit 2, doctor does not navigate',async t=>{const {root}=await fixture(t,{});await write(root,'.aidonecheck.json',quietConfig({browser:{enabled:true,url:'http://127.0.0.1:1'}}));const result=runCli(root,['check','--json'],{PLAYWRIGHT_BROWSERS_PATH:path.join(root,'missing-browsers')});assert.equal(result.status,2,result.stdout);assert.equal(JSON.parse(result.stdout).error.kind,'startup');const d=runCli(root,['doctor']);assert.equal(d.status,0,d.stderr);assert(d.stdout.includes('未启动'));});
test('test BLOCK with Browser PASS does not keep on-failure trace',async t=>{const {root}=await fixture(t,{test:'node -e "process.exit(1)"'});const server=await startFixtures();t.after(server.close);const config=parseConfig({version:1,checks:{lint:false,typecheck:false,build:false},browser:{enabled:true,url:server.url,trace:'on-failure'}});const r=await check({event:{name:'fixture',payload:{}},cwd:root,config});assert.equal(r.verdict,'BLOCK');assert.equal(r.checks.find(c=>c.id==='browser').status,'pass');assert(!r.evidence.files.includes('trace.zip'));assert(r.evidence.files.includes('browser.png'));});
