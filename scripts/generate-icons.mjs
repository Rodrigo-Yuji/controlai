// Gera logo, ícones PWA/Android e splash a partir do desenho abaixo.
// Uso: instale @resvg/resvg-js numa pasta temporária, copie este arquivo para lá e rode
// `node generate-icons.mjs <pasta-do-controlai>`.
import {Resvg} from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
const repo=process.argv[2];
// Mark drawn in a 512 box: a pie chart on white, three quarters in brand green and the
// last quarter in mint, pulled out a little. Flat colors, no gradients.
const BRAND='#0d7a5f',MINT='#5ee6b0',PAPER='#ffffff';
const defs='';
const mark=`<path d="M268 268V134A134 134 0 1 1 134 268z" fill="${BRAND}"/><path d="M244 244V110A134 134 0 0 0 110 244z" fill="${MINT}"/>`;
const icon=(round=false)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}${round?`<circle cx="256" cy="256" r="256" fill="${PAPER}"/>`:`<rect width="512" height="512" rx="116" fill="${PAPER}"/>`}${mark}</svg>`;
// Adaptive foreground: 108dp canvas, the mark must stay inside the 66dp safe zone.
const foreground=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<g transform="translate(256 256) scale(.74) translate(-256 -256)">${mark}</g></svg>`;
const splash=(w,h)=>{const s=Math.min(w,h)*.32,x=(w-s)/2,y=(h-s)/2;return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}<rect width="${w}" height="${h}" fill="${PAPER}"/><g transform="translate(${x} ${y}) scale(${s/512})">${mark}</g></svg>`;};
const png=(svg,w)=>new Resvg(svg,{fitTo:{mode:'width',value:w}}).render().asPng();
const out=(rel,buf)=>{const f=path.join(repo,rel);fs.writeFileSync(f,buf);console.log(rel,buf.length);};
out('public/icons/logo.svg',Buffer.from(icon()));
out('public/icons/icon-512.png',png(icon(),512));
out('public/icons/icon-192.png',png(icon(),192));
out('public/icons/brand-mark.png',png(icon(),192));
const res='android/app/src/main/res';
for(const [d,n] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]){
 out(`${res}/mipmap-${d}/ic_launcher.png`,png(icon(),n));
 out(`${res}/mipmap-${d}/ic_launcher_round.png`,png(icon(true),n));
 out(`${res}/mipmap-${d}/ic_launcher_foreground.png`,png(foreground,Math.round(n*2.25)));
}
for(const dir of fs.readdirSync(path.join(repo,res)).filter(d=>d.startsWith('drawable'))){
 const f=path.join(repo,res,dir,'splash.png');if(!fs.existsSync(f))continue;
 const b=fs.readFileSync(f),w=b.readUInt32BE(16),h=b.readUInt32BE(20);
 out(`${res}/${dir}/splash.png`,new Resvg(splash(w,h)).render().asPng());
}
