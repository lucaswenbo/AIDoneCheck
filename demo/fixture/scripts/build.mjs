import fs from 'node:fs/promises';
await fs.mkdir('dist', {recursive: true});
await fs.copyFile('src/sum.js', 'dist/sum.js');
console.log('Built dist/sum.js');
