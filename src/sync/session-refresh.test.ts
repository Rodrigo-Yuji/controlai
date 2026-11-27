import test from 'node:test';
import assert from 'node:assert/strict';
import {SupabaseClient,forgetSharedSessions,type Session} from './client.ts';
const config={url:'https://exemplo.supabase.co',key:'sb_publishable_teste'};
const expired:Session={access_token:'a0',refresh_token:'r0',expires_at:Math.floor(Date.now()/1000)-10,user:{id:'u1'}};
const token=(client:SupabaseClient)=>(client as unknown as {token():Promise<string>}).token();
test('clients sharing an expired session refresh it only once',async()=>{
 forgetSharedSessions();let calls=0;const used=new Set<string>();
 globalThis.fetch=(async(_url:string,init:{body:string})=>{
  calls++;const {refresh_token}=JSON.parse(init.body);
  if(used.has(refresh_token))return new Response(JSON.stringify({code:'refresh_token_already_used'}),{status:400});
  used.add(refresh_token);await new Promise(r=>setTimeout(r,20));
  return new Response(JSON.stringify({access_token:'a1',refresh_token:'r1',expires_in:3600,user:{id:'u1'}}),{status:200});
 }) as unknown as typeof fetch;
 const saved:string[]=[];
 const a=new SupabaseClient(config,{...expired},async s=>{saved.push('a:'+s.refresh_token);}),b=new SupabaseClient(config,{...expired},async s=>{saved.push('b:'+s.refresh_token);});
 const [ta,tb]=await Promise.all([token(a),token(b)]);
 assert.equal(calls,1);assert.equal(ta,'a1');assert.equal(tb,'a1');
 // A client created later with the old session reuses the fresh one instead of sending r0 again.
 const c=new SupabaseClient(config,{...expired},async()=>{});assert.equal(await token(c),'a1');assert.equal(calls,1);
 assert.deepEqual(saved.sort(),['a:r1','b:r1']);
});
test('a rejected refresh explains that the person must log in again',async()=>{
 forgetSharedSessions();
 globalThis.fetch=(async()=>new Response(JSON.stringify({code:'refresh_token_already_used'}),{status:400})) as unknown as typeof fetch;
 await assert.rejects(()=>token(new SupabaseClient(config,{...expired,refresh_token:'rx'},async()=>{})),/Sair do login e entre novamente/);
});
