import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const folder=new URL('./node_modules/lucide/dist/esm/icons/',import.meta.url);
const metadata=JSON.parse(await fs.readFile(new URL('./node_modules/lucide/package.json',import.meta.url),'utf8'));
const files=(await fs.readdir(folder)).filter(name=>name.endsWith('.mjs')).sort();
const icons={};
for(const file of files){const name=file.slice(0,-4),module=await import(new URL(file,folder));if(!Array.isArray(module.default))throw new Error(`Invalid Lucide icon: ${file}`);icons[name]=module.default;}
const output=new URL('./dist/lucide-catalog.mjs',import.meta.url);
await fs.writeFile(output,`// Generated from Lucide ${metadata.version}. ISC license; see bundled notices.\nexport const lucideVersion=${JSON.stringify(metadata.version)};\nexport const lucideIcons=${JSON.stringify(icons)};\n`);
console.log(`Bundled all ${files.length} Lucide icons (${metadata.version}) in ${fileURLToPath(output)}.`);
