import fs from 'node:fs';
import path from 'node:path';
const directory = process.argv[2] || 'C:/Program Files (x86)/Steam/steamapps/common/Big Walk/BepInEx/companion';
const filename = fs.readdirSync(directory).filter(n => /^session-.*\.jsonl$/.test(n))
  .sort((a,b) => fs.statSync(path.join(directory,b)).mtimeMs - fs.statSync(path.join(directory,a)).mtimeMs)[0];
if (!filename) throw new Error('No recordings found');
const frames = fs.readFileSync(path.join(directory, filename), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
const active = frames.filter(f => f.players.some(p => p.local));
const groups = new Map();
let maxKernalDifference = 0, maxMoverDifference = 0;
const distance = (a,b,axes=['x','y','z']) => Math.hypot(...axes.map(k => a[k]-b[k]));
for (const frame of active) {
  const player = frame.players.find(p => p.local);
  if(player.kernalPosition) maxKernalDifference = Math.max(maxKernalDifference,distance(player,player.kernalPosition));
  if(player.moverPosition) maxMoverDifference = Math.max(maxMoverDifference,distance(player,player.moverPosition));
  for (const train of frame.trains || []) {
    if(train.hasCable) continue;
    for(const car of train.cars) {
      const key = `${train.identity.path}/${car.index}`;
      if (!groups.has(key)) groups.set(key, {index:car.index, name:car.name, positions:new Set(), minHorizontal:Infinity, travel:0});
      const summary = groups.get(key), position = car.bodyPosition;
      if (!position) continue;
      summary.positions.add(JSON.stringify(position));
      if (summary.previous) summary.travel += distance(summary.previous,position);
      summary.previous = position;
      const horizontal = distance(player,position,['x','z']);
      if (horizontal < summary.minHorizontal) Object.assign(summary, {
        minHorizontal:horizontal, verticalOffset:position.y-player.y,
        seconds:(frame.timestamp-active[0].timestamp)/1000, player:{x:player.x,y:player.y,z:player.z}, position
      });
    }
  }
}
console.log(JSON.stringify({recording:filename,activeFrames:active.length,
  durationSeconds:active.length ? (active.at(-1).timestamp-active[0].timestamp)/1000 : 0,
  maxKernalDifference,maxMoverDifference,
  cars:[...groups.values()].map(({positions,previous,...s})=>({...s,uniquePositions:positions.size}))},null,2));
