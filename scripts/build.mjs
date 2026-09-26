import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
const check=process.argv.includes('--check');
const shared={bundle:true,platform:'node',target:'node20',write:false,legalComments:'eof',logLevel:'silent',charset:'utf8'};
const outputs=[];
for(const [entry,outfile,format,target] of [['src/cli.ts','dist/cli/index.js','esm','node20'],['src/action.ts','dist/action/index.js','cjs','node24'],['src/index.ts','.build/core.js','esm','node20']]) {
  const result=await build({...shared,entryPoints:[entry],outfile,format,target,minify:outfile.startsWith('dist/action')});
  for(const file of result.outputFiles)outputs.push({name:path.relative(process.cwd(),file.path),text:file.text});
}
outputs.push({name:'dist/action/package.json',text:'{"type":"commonjs"}\n'});
for(const file of outputs) {
  if(check && file.name.startsWith('dist/')) {
    if(await fs.readFile(file.name,'utf8').catch(()=>null)!==file.text)throw new Error(`Stale dist: ${file.name}. Run npm run build.`);
  }else {await fs.mkdir(path.dirname(file.name),{recursive:true});await fs.writeFile(file.name,file.text);}
}
console.log(check?'dist is fresh':'Built CLI, self-contained Action and test module');
