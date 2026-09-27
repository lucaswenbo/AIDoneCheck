import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const {version}=JSON.parse(await fs.readFile('package.json','utf8'));
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Invalid release version');
const filename=`aidonecheck-${version}.tgz`;
const base=`https://github.com/lucaswenbo/AIDoneCheck/releases/download/v${version}`;
async function download(name){const r=await fetch(`${base}/${name}`);if(!r.ok)throw new Error(`Public download failed: HTTP ${r.status}`);return Buffer.from(await r.arrayBuffer());}
const [data,sum]=await Promise.all([download(filename),download('SHA256SUMS.txt')]);
assert.equal(sum.toString().trim(),`${createHash('sha256').update(data).digest('hex')}  ${filename}`);
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'aidonecheck-public-'));
try{const file=path.join(tmp,filename);await fs.writeFile(file,data);execFileSync(process.execPath,['scripts/package-smoke.mjs',file],{stdio:'inherit'});console.log('Public Release URL, checksum and installed CLI verified');}finally{await fs.rm(tmp,{recursive:true,force:true});}
