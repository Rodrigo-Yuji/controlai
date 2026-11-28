import test from 'node:test';
import assert from 'node:assert/strict';
import {toReceipt} from './grocery-receipts.ts';
test('only purchases marked for ControlAI are listed',()=>{
 assert.deepEqual(toReceipt('1',{market:'Mercado X',date:'2026-11-26',total:52.3,controlAIEligible:true,lines:[{name:'Arroz',quantity:1,unit:'un',total:20}]}),{id:'1',market:'Mercado X',date:'2026-11-26',total:52.3,lines:[{name:'Arroz',quantity:1,unit:'un',total:20}]});
 assert.equal(toReceipt('2',{market:'Y',date:'2026-11-26',total:10,controlAIEligible:true})?.id,'2');
 assert.equal(toReceipt('8',{market:'Y',date:'2026-11-26',total:10}),null);
});
test('excluded or malformed purchases are skipped',()=>{
 assert.equal(toReceipt('3',{market:'Y',date:'2026-11-26',total:10,controlAIEligible:false}),null);
 assert.equal(toReceipt('4',{market:'Y',total:10,controlAIEligible:true}),null);
 assert.equal(toReceipt('5',{market:'Y',date:'2026-11-26',total:0,controlAIEligible:true}),null);
 assert.equal(toReceipt('6',null),null);
 assert.equal(toReceipt('7',{date:'2026-11-26T10:00:00',total:'12.5',controlAIEligible:true})?.market,'Mercado');
});
