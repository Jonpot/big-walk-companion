import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','companion');
const destination=process.argv[2];
if(!destination) throw new Error('Pass the output license text filename.');
const lock=JSON.parse(await fs.readFile(path.join(root,'package-lock.json'),'utf8'));
const notices=['Bundled browser dependency license notices\n'];
let count=0;
for(const [relative,record] of Object.entries(lock.packages)) {
  if(!relative || record.dev) continue;
  const folder=path.join(root,relative);
  const metadata=JSON.parse(await fs.readFile(path.join(folder,'package.json'),'utf8'));
  const files=(await fs.readdir(folder)).filter(name=>/^(license|copying|notice)([.-]|$)/i.test(name));
  if(!files.length) throw new Error(`Missing license text for ${metadata.name}`);
  notices.push(`\n${'='.repeat(72)}\n${metadata.name} ${metadata.version}\nLicense: ${metadata.license||record.license||'See text below'}\n`);
  for(const name of files) notices.push(`\n--- ${name} ---\n${await fs.readFile(path.join(folder,name),'utf8')}\n`);
  count++;
}
await fs.mkdir(path.dirname(path.resolve(destination)),{recursive:true});
await fs.writeFile(destination,notices.join(''));
console.log(`Collected license notices for ${count} production packages.`);
