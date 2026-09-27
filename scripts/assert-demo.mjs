import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {demoCase} from './demo-cases.mjs';
const name=process.env.DEMO_SCENARIO,selected=demoCase(name);
const directory=process.env.EVIDENCE_DIR;
let actual='未取得报告',verified=false,problem='';
try{
  assert(directory,'Action did not provide evidence_dir');
  assert(process.env.EVIDENCE_NAME,'Action did not provide evidence_name');
  assert(process.env.ARTIFACT_ID,'Action did not upload an Artifact');
  assert.equal(process.env.ACTION_OUTCOME,['BLOCK','ERROR'].includes(selected.expected)?'failure':'success');
  const summary=await fs.readFile(path.join(directory,'summary.md'),'utf8');assert(summary.length>0);
  if(selected.expected==='ERROR'){
    const error=JSON.parse(await fs.readFile(path.join(directory,'startup-error.json'),'utf8'));
    actual='ERROR';assert.equal(error.exitCode,2);assert.match(error.error,/Symlink escapes repository/);
    assert(!process.env.VERDICT,'Startup error must not invent a verdict');
    await assert.rejects(fs.stat(path.join(directory,'report.json')));
  }else{
    const report=JSON.parse(await fs.readFile(path.join(directory,'report.json'),'utf8'));
    actual=report.verdict;assert.equal(actual,selected.expected);assert.equal(process.env.VERDICT,actual);
    assert.equal(report.version,JSON.parse(await fs.readFile('package.json','utf8')).version);
    assert.match(summary,/\| Check \| Result \| Details \|/);
    for(const file of ['report.json','report.md','agent-feedback.md'])assert((await fs.stat(path.join(directory,file))).size>0);
    const check=id=>report.checks.find(c=>c.id===id);
    for(const id of ['typecheck','build','changedFiles:src/sum.js','requiredFiles:dist/sum.js'])assert.equal(check(id)?.status,'pass',`${id} did not pass`);
    const text=await fs.readFile(path.join(directory,'agent-feedback.md'),'utf8');
    if(name==='test-failure'){assert.equal(check('test').result.exitCode,1);assert.match(text,/BLOCK: test/);assert.match(text,/addition returns the actual sum/);}
    else if(name==='no-tests'){assert.equal(check('test').status,'warn');assert.equal(check('test').result,undefined);}
    else assert.equal(check('test').status,'pass');
    if(name==='pageerror'||name==='resource-overflow'){
      const data=check('browser').data;
      assert.equal(check('browser').blocking,true);assert(data.screenshot&&data.trace);
      const png=await fs.readFile(path.join(directory,'browser.png'));assert.equal(png.subarray(1,4).toString(),'PNG');
      const entries=execFileSync('unzip',['-Z1',path.join(directory,'trace.zip')],{encoding:'utf8'});assert(entries.includes('.trace')&&entries.includes('.network'));
      if(name==='pageerror')assert.match(text,/fixture pageerror/);
      else {assert.equal(data.resources.length,200);assert(data.omittedCriticalFailureEvents>0);assert.match(text,/omitted from detailed evidence/);}
    }else for(const file of ['browser.png','trace.zip'])await assert.rejects(fs.stat(path.join(directory,file)));
  }
  verified=true;
  console.log(`${name}: expected ${selected.expected}, actual ${actual}; outcome, reports and Artifact verified`);
}catch(e){problem=e.message;throw e;}
finally{
  if(process.env.GITHUB_STEP_SUMMARY){
    const clean=s=>String(s).replace(/[|<>\r\n]/g,' ');
    const link=process.env.ARTIFACT_ID?`${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts/${process.env.ARTIFACT_ID}`:'';
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,`\n## 可复现演示：${selected.title}\n\n${selected.reason}\n\n| 预期 | 实际记录 | 演示断言 |\n|---|---|---|\n| ${selected.expected} | ${actual} | ${verified?'通过':'失败'} |\n\n${link?`[下载本场景 Evidence](${link})`:'未生成 Artifact'}\n\n${verified?'演示成功表示检查行为符合预期；BLOCK 场景中的故障仍然存在，没有被修复或隐藏。':`断言失败：${clean(problem)}`}\n`);
  }
}
