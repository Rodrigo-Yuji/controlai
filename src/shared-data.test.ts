import test from 'node:test';import assert from 'node:assert/strict';
import {validateSharedSnapshot} from './shared-data.ts';
const snapshot={contas:[{id:'G',nome:'Casa',tipo:'gestora',conjunta:false,padrao:true}],lancamentos:[],reservas:[],recorrencias:[],salarios:[],categorias:[],configuracoes:[],fechamentos:[]};
test('shared snapshot accepts exactly the selected eligible account',()=>{assert.equal(validateSharedSnapshot(snapshot,'G').contas.length,1);assert.throws(()=>validateSharedSnapshot(snapshot,'OTHER'));assert.throws(()=>validateSharedSnapshot({...snapshot,contas:[{...snapshot.contas[0],tipo:'solo'}]},'G'));});
test('shared snapshot rejects another account or records before rendering',()=>{assert.throws(()=>validateSharedSnapshot({...snapshot,contas:[...snapshot.contas,{...snapshot.contas[0],id:'PRIVATE'}]},'G'));assert.throws(()=>validateSharedSnapshot({...snapshot,lancamentos:[{id:1,contaId:'PRIVATE',descricao:'Private',valorCentavos:100}]},'G'));});
