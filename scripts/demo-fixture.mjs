import fs from 'node:fs/promises';
import path from 'node:path';
import {git,write} from '../test/helpers.mjs';
import {demoCase} from './demo-cases.mjs';
const name=process.env.DEMO_SCENARIO;
const selected=demoCase(name);
const root=path.resolve('.demo');
if(await fs.lstat(root).catch(()=>null))throw new Error('Refusing to overwrite existing .demo directory');
await fs.cp('demo/fixture',root,{recursive:true,force:false,errorOnExist:true});
git(root,'init','-b','main');git(root,'config','user.name','AIDoneCheck public demo');git(root,'config','user.email','demo@example.invalid');
git(root,'add','.');git(root,'commit','-m','demo baseline: unfinished addition');
const source=await fs.readFile(path.join(root,'src/sum.js'),'utf8');
await write(root,'src/sum.js',source.replace('return 0;',name==='test-failure'?'return a - b;':'return a + b;'));
const config={version:1,checks:{lint:false},requirements:{changedFiles:['src/sum.js'],requiredFiles:['src/sum.js','dist/sum.js']}};
if(name==='no-tests'){
  const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
  pkg.scripts.test='echo "Error: no test specified" && exit 1';await write(root,'package.json',pkg);
}
if(name==='pageerror'||name==='resource-overflow'){
  const file=path.join(process.env.RUNNER_TEMP,'aidonecheck-demo-url');
  let url;
  for(let i=0;i<100;i++){try{url=(await fs.readFile(file,'utf8')).trim();if((await fetch(url+'/pass')).ok)break;}catch{}url=undefined;await new Promise(r=>setTimeout(r,100));}
  if(!url)throw new Error('Local demo fixture server did not become ready');
  config.browser={enabled:true,url:url+'/'+name,expect:'Ready',trace:'on-failure'};
}
if(name==='unsafe-path'){
  config.requirements.changedFiles=['escape'];
  await write(root,'tests/escape.test.js',"import fs from 'node:fs';import os from 'node:os';fs.symlinkSync(os.tmpdir(),'escape','dir');\n");
}
await write(root,'.aidonecheck.json',config);
console.log(`已准备 ${selected.title}（${name}）；预期 ${selected.expected}`);
