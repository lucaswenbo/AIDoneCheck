import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {check,parseConfig,markdown,feedback,summary,checkDetails,displayMessage} from '../.build/core.js';
import {fixture,quietConfig,runCli,write} from './helpers.mjs';
test('Chinese WARN report translates placeholder and headings without changing canonical JSON',async t=>{
  const {root}=await fixture(t,{test:'echo "Error: no test specified" && exit 1'});
  const r=await check({cwd:root,base:'origin/main',config:parseConfig({version:1,checks:{lint:false,typecheck:false,build:false}})});
  const original=JSON.stringify(r);const text=markdown(r);
  assert.equal(r.verdict,'WARN');assert.match(text,/没有真实测试：发现 npm 默认占位脚本/);
  for(const phrase of ['## 检查结果','| 检查项 | 结果 | 说明 |','## 阻断问题','## 验证证据','目录：'])assert(text.includes(phrase));
  for(const phrase of ['Blocking failures','No real test:','Directory:','## Evidence'])assert(!text.includes(phrase));
  assert.match(summary(r),/WARN 测试：没有真实测试/);assert.equal(JSON.stringify(r),original);
  assert.equal(JSON.parse(await fs.readFile(path.join(root,'.aidonecheck/latest/report.json'),'utf8')).checks.find(c=>c.id==='test').details,'No real test: npm placeholder script discovered');
});
test('Chinese failure feedback preserves actual external log text and command',async t=>{
  const {root}=await fixture(t,{test:'node failure.mjs'});const raw='EXTERNAL_ERROR: Original English message';
  await write(root,'failure.mjs',`console.error(${JSON.stringify(raw)});process.exit(7);`);
  const r=await check({cwd:root,base:'origin/main',config:parseConfig({...quietConfig(),checks:{test:true,lint:false,typecheck:false,build:false}})});
  const text=feedback(r);assert.equal(r.verdict,'BLOCK');assert.match(text,/npm test 执行失败，退出码 7/);assert.match(text,/命令： npm test/);assert.match(text,/退出码： 7/);assert(text.includes(raw));assert.match(text,/不要为了.*关闭或削弱检查/);
});
test('Browser display localizes wrappers while retaining page errors and omitted event counts',()=>{
  const raw='ReferenceError: widget is not defined';
  const c={id:'browser',status:'fail',blocking:true,meaningful:true,details:'unused',data:{failures:['pageerror: '+raw,'Same-origin critical resource failure events omitted from detailed evidence: 2 (document/script/stylesheet)'],warnings:['Full-page screenshot could not be saved']}};
  assert.match(checkDetails(c),/页面未捕获错误（pageerror）：ReferenceError: widget is not defined/);
  assert.match(checkDetails(c),/详细记录之外仍检测到 2 条同源关键资源失败事件/);
  assert.equal(checkDetails({id:'browser-warnings',status:'warn',details:'unused'},[c]),'无法保存全页截图');
  assert.equal(displayMessage('console.error: '+raw),'控制台错误（console.error）：'+raw);
});
test('Chinese startup diagnostics keep machine-readable CLI error unchanged',async t=>{
  const {root}=await fixture(t);await write(root,'.aidonecheck.json',{version:8});
  const r=runCli(root,['check','--json']);assert.equal(r.status,2);assert.match(r.stderr,/启动错误：.*配置必须包含 version/);assert.equal(JSON.parse(r.stdout).error.kind,'startup');
  assert.equal(displayMessage('Symlink escapes repository: escape'),'符号链接指向仓库外部：escape');
});
