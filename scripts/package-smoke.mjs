import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fixture, write, project } from '../test/helpers.mjs';
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'aidonecheck-package-'));
let root;
try {
  const pkg=JSON.parse(await fs.readFile(path.join(project,'package.json'),'utf8'));
  const tarball=process.argv[2]?path.resolve(process.argv[2]):path.join(tmp,JSON.parse(execFileSync('npm',['pack','--ignore-scripts','--json','--pack-destination',tmp],{cwd:project,encoding:'utf8'}))[0].filename);
  execFileSync('npm',['install','--prefix',tmp,'--ignore-scripts','--omit=dev','--no-audit','--no-fund',tarball],{encoding:'utf8'});
  const cli=path.join(tmp,'node_modules/aidonecheck/bin/aidonecheck.mjs');
  assert.equal(execFileSync(process.execPath,[cli,'--version'],{encoding:'utf8'}).trim(),pkg.version);
  const f=await fixture(null,{test:'node --test check.mjs',typecheck:'node --check app.mjs',build:'node build.mjs'});root=f.root;
  await write(root,'.aidonecheck.json',{version:1,checks:{lint:false}});
  await write(root,'check.mjs','import assert from "node:assert/strict"; assert.equal(2+2,4);');
  await write(root,'app.mjs','export const value = 4;');
  await write(root,'build.mjs','import fs from "node:fs"; fs.copyFileSync("app.mjs","build.mjs.out");');
  const env={...process.env,GITHUB_ACTIONS:'false'};delete env.NODE_TEST_CONTEXT;
  const args=[cli,'check','--base','origin/main','--json'];
  const pass=JSON.parse(execFileSync(process.execPath,args,{cwd:root,env,encoding:'utf8'}));
  assert.equal(pass.verdict,'PASS');assert.equal(pass.version,pkg.version);
  await write(root,'check.mjs','import assert from "node:assert/strict"; assert.equal(2+2,5);');
  let failure;
  try{execFileSync(process.execPath,args,{cwd:root,env,encoding:'utf8',stdio:['ignore','pipe','pipe']});}catch(e){failure=e;}
  assert.equal(failure?.status,1);assert.equal(JSON.parse(failure.stdout).verdict,'BLOCK');
  for(const name of ['report.json','report.md','agent-feedback.md'])assert((await fs.stat(path.join(root,'.aidonecheck/latest',name))).size>0);
  console.log(`Packaged CLI ${pkg.version}: isolated install, PASS, real test BLOCK and evidence verified`);
}finally{if(root)await fs.rm(root,{recursive:true,force:true});await fs.rm(tmp,{recursive:true,force:true});}
