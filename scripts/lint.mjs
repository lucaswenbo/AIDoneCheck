import fs from 'node:fs/promises';
const files=[];
async function walk(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=`${dir}/${item.name}`;if(item.isDirectory())await walk(file);else if(/\.(ts|mjs|yml)$/.test(file))files.push(file);}}
for(const dir of ['src','scripts','bin','test','.github'])await walk(dir);
for(const file of files){const text=await fs.readFile(file,'utf8');if(/[ \t]+$/m.test(text)||!text.endsWith('\n'))throw new Error(`Whitespace error: ${file}`);if(/^([<]{7}|[=]{7}|[>]{7})/m.test(text))throw new Error(`Conflict marker: ${file}`);}
console.log(`Source hygiene passed (${files.length} files); TypeScript semantic checks run separately.`);
