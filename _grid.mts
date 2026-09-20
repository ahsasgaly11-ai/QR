import { LETTERS } from './src/lib/handshapes';
import { writeFileSync } from 'node:fs';
const SKIN='#e9b892', LINE='#c98a5c';
const FINGERS=[{x:40,len:50},{x:58,len:58},{x:76,len:52},{x:93,len:40}];const BY=66;
const c=(v:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
function hand(p:any){const t=c(p.thumb??0);const tr=-40-t*55;let f='';FINGERS.forEach((fg,i)=>{const v=c(p.fingers[i]??0);const s=0.16+v*0.84;f+=`<g style="transform-origin:${fg.x}px ${BY}px;transform:scaleY(${s})"><rect x="${fg.x-8}" y="${BY-fg.len}" width="16" height="${fg.len+10}" rx="8" fill="${SKIN}" stroke="${LINE}" stroke-width="2"/></g>`;});return `<svg viewBox="0 0 130 170" style="width:86px;height:112px"><g style="transform-origin:65px 130px;transform:rotate(${p.rot??0}deg)"><rect x="48" y="120" width="34" height="42" rx="16" fill="${SKIN}" stroke="${LINE}" stroke-width="2"/>${f}<g style="transform-origin:44px 108px;transform:rotate(${tr}deg)"><rect x="30" y="78" width="16" height="40" rx="8" fill="${SKIN}" stroke="${LINE}" stroke-width="2"/></g><rect x="34" y="60" width="62" height="66" rx="20" fill="${SKIN}" stroke="${LINE}" stroke-width="2"/></g></svg>`;}
let cells='';for(const [k,e] of Object.entries(LETTERS)){cells+=`<div style="text-align:center"><div style="background:#000;border-radius:10px;padding:4px;display:flex;align-items:center;justify-content:center;gap:2px"><div>${hand((e as any).pose)}</div><span style="font:900 30px sans-serif;color:#fff">${k}</span></div></div>`;}
writeFileSync(process.env.SP+'/grid.html',`<!doctype html><html dir="rtl"><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(7,1fr);gap:8px;padding:14px">${cells}</body></html>`);
console.log('count', Object.keys(LETTERS).length);
