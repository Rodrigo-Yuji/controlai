import type {CSSProperties} from 'react';

export function accountHeaderStyle(color?:string):CSSProperties|undefined {
 if(!color||!/^#[\da-f]{6}$/i.test(color))return;
 const channels=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const luminance=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
 return {'--account-color':color,'--account-ink':luminance>.179?'#000000':'#ffffff'} as CSSProperties;
}
