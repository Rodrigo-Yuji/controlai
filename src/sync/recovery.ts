export const APP_SITE_URL='https://rodrigo-yuji.github.io/controlai/';
export type AuthReturn={kind:'recovery';accessToken:string}|{kind:'error'}|null;
export function parseAuthReturn(hash:string):AuthReturn{
 const values=new URLSearchParams(hash.replace(/^#/,''));
 if(values.get('type')==='recovery')return values.get('access_token')?{kind:'recovery',accessToken:values.get('access_token')!}:{kind:'error'};
 if(values.has('error')||values.has('error_code'))return {kind:'error'};
 return null;
}
export function consumeAuthReturn():AuthReturn{
 const hash=window.location.hash,values=new URLSearchParams(hash.replace(/^#/,''));
 const result=parseAuthReturn(hash);
 if(values.has('access_token')||values.has('refresh_token')||result)window.history.replaceState(null,'',window.location.pathname+window.location.search);
 return result;
}
