// Gera logo, ícones PWA/Android e splash a partir do desenho abaixo.
// Uso: instale @resvg/resvg-js numa pasta temporária, copie este arquivo para lá e rode
// `node generate-icons.mjs <pasta-do-controlai>`.
import {Resvg} from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
const repo=process.argv[2];
// Mark drawn in a 512 box: open "C" ring in mint + three rising bars, tallest with an arrow tip.
const defs=`<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#173b5c"/><stop offset="1" stop-color="#0a1828"/></linearGradient>
<linearGradient id="ring" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0fa376"/><stop offset="1" stop-color="#5ee6b0"/></linearGradient>
<radialGradient id="glow" cx=".78" cy=".2" r=".7"><stop offset="0" stop-color="#2fd39a" stop-opacity=".28"/><stop offset="1" stop-color="#2fd39a" stop-opacity="0"/></radialGradient>
</defs>`;
const mark=`<path d="M357.1 171.2A132 132 0 1 0 357.1 340.8" fill="none" stroke="url(#ring)" stroke-width="54" stroke-linecap="round"/>
<rect x="196" y="262" width="34" height="62" rx="11" fill="#e9f6ef"/>
<rect x="244" y="226" width="34" height="98" rx="11" fill="#e9f6ef"/>
<path d="M292 214h34v99a11 11 0 0 1-11 11h-12a11 11 0 0 1-11-11z" fill="#5ee6b0"/>
<path d="M276 220l33-46 33 46z" fill="#5ee6b0" stroke="#5ee6b0" stroke-width="10" stroke-linejoin="round"/>`;
const icon=(round=false)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}${round?'<circle cx="256" cy="256" r="256" fill="url(#bg)"/><circle cx="256" cy="256" r="256" fill="url(#glow)"/>':'<rect width="512" height="512" rx="116" fill="url(#bg)"/><rect width="512" height="512" rx="116" fill="url(#glow)"/>'}${mark}</svg>`;
// Adaptive foreground: 108dp canvas, the mark must stay inside the 66dp safe zone.
const foreground=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<g transform="translate(256 256) scale(.6) translate(-256 -256)">${mark}</g></svg>`;
const splash=(w,h)=>{const s=Math.min(w,h)*.32,x=(w-s)/2,y=(h-s)/2;return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}<rect width="${w}" height="${h}" fill="#0b1a2c"/><circle cx="${w/2}" cy="${h/2}" r="${s*.9}" fill="url(#glow)"/><g transform="translate(${x} ${y}) scale(${s/512})">${mark}</g></svg>`;};
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
