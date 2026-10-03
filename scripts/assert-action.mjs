import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const directory=process.env.EVIDENCE_DIR;
assert(directory,'Missing evidence_dir');assert(process.env.EVIDENCE_NAME,'Missing evidence_name');assert(process.env.ARTIFACT_ID,'Missing artifact_id');
assert.equal(process.env.ACTION_OUTCOME,process.env.EXPECTED_VERDICT==='BLOCK'?'failure':'success');
const report=JSON.parse(await fs.readFile(path.join(directory,'report.json'),'utf8'));
assert.equal(report.verdict,process.env.EXPECTED_VERDICT);
for(const name of ['report.json','report.md','agent-feedback.md','summary.md',...(process.env.BROWSER==='true'?['browser.png','trace.zip']:[])])assert((await fs.stat(path.join(directory,name))).size>0,`Missing ${name}`);
const summary=await fs.readFile(path.join(directory,'summary.md'),'utf8');
const chinese=process.env.EXPECTED_LANGUAGE==='zh';
assert(summary.includes(report.verdict));assert(summary.includes(chinese?'| 检查项 | 结果 | 说明 |':'| Check | Result | Details |'));
for(const name of ['report.md','agent-feedback.md'])assert((await fs.readFile(path.join(directory,name),'utf8')).includes(chinese?'结论：':'Verdict:'));
if(process.env.FIRST_DIR){assert.notEqual(directory,process.env.FIRST_DIR);assert.notEqual(process.env.EVIDENCE_NAME,process.env.FIRST_NAME);assert((await fs.stat(path.join(process.env.FIRST_DIR,'report.json'))).size>0);}
console.log('Action outcome, summary, outputs and preserved evidence verified');
