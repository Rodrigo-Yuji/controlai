import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_SITE_URL,parseAuthReturn} from './recovery.ts';
import {SupabaseClient} from './client.ts';
const config={url:'https://project.supabase.co',key:'sb_publishable_test'};
test('recovery return is distinct from signup and expired links',()=>{
 assert.deepEqual(parseAuthReturn('#type=recovery&access_token=synthetic'),{kind:'recovery',accessToken:'synthetic'});
 assert.equal(parseAuthReturn('#type=signup&access_token=synthetic'),null);
 assert.deepEqual(parseAuthReturn('#type=recovery'),{kind:'error'});
 assert.deepEqual(parseAuthReturn('#error_code=otp_expired'),{kind:'error'});
 assert.equal(parseAuthReturn('#section'),null);
});
test('recovery e-mail uses the published site, never localhost or a stored user session',async()=>{
 const original=globalThis.fetch;let request:{url:string;options?:RequestInit}|undefined;
 globalThis.fetch=async(input,options)=>{request={url:String(input),options};return Response.json({});};
 try{let persisted=false;const client=new SupabaseClient(config,null,async()=>{persisted=true;});await client.requestPasswordRecovery('person@example.com');assert.equal(new URL(request!.url).searchParams.get('redirect_to'),APP_SITE_URL);assert.equal(request!.options!.method,'POST');assert.deepEqual(JSON.parse(String(request!.options!.body)),{email:'person@example.com'});assert.equal((request!.options!.headers as Record<string,string>).Authorization,undefined);assert.equal(persisted,false);await assert.rejects(client.requestPasswordRecovery('invalid'),/e-mail/);}finally{globalThis.fetch=original;}
});
test('new password uses verified recovery token and does not recreate the user',async()=>{
 const original=globalThis.fetch;const calls:{url:string;options?:RequestInit}[]=[];
 globalThis.fetch=async(input,options)=>{calls.push({url:String(input),options});return Response.json({id:'user1',email:'person@example.com'});};
 try{const client=new SupabaseClient(config,null,async()=>{throw Error('Must not replace sync login');});assert.equal((await client.recoveryUser('synthetic')).id,'user1');await client.updatePassword('synthetic','New-test-password1');assert.equal(calls[0].options!.method,'GET');assert.equal(calls[1].options!.method,'PUT');assert.equal(new URL(calls[1].url).pathname,'/auth/v1/user');assert.equal((calls[1].options!.headers as Record<string,string>).Authorization,'Bearer synthetic');assert.deepEqual(JSON.parse(String(calls[1].options!.body)),{password:'New-test-password1'});await assert.rejects(client.updatePassword('synthetic','short'),/8 caracteres/);}finally{globalThis.fetch=original;}
});
