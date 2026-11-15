import test from 'node:test';
import assert from 'node:assert/strict';
import { postalCodeDigits, lookupPostalCode, PostalCodeNotFoundError } from '../.test-dist/viacep.js';

const payload = {cep:'01001-000',logradouro:'Praça da Sé',bairro:'Sé',localidade:'São Paulo',uf:'SP',complemento:'lado ímpar',ibge:'3550308'};
const response = value => new Response(JSON.stringify(value), {status:200,headers:{'Content-Type':'application/json'}});

test('ViaCEP accepts only eight digits or canonical formatted CEP', () => {
  for(const value of ['01001000','01001-000',' 01001-000 ']) assert.equal(postalCodeDigits(value),'01001000');
  for(const value of ['', '0100100', '010010000', '0100a000', '01001 000', '01.001-000', '123-45678']) assert.equal(postalCodeDigits(value),null,value);
});

test('invalid CEP is rejected before making a network request', async () => {
  let called = false;
  await assert.rejects(lookupPostalCode('123',new AbortController().signal,async()=>{called=true;return response(payload);}));
  assert.equal(called,false);
});

test('lookup sends only CEP in HTTPS URL and maps residential address fields', async () => {
  const controller = new AbortController();
  let calls=0;
  const actual = await lookupPostalCode('01001-000',controller.signal,async(url,options)=>{
    calls++;
    assert.equal(String(url),'https://viacep.com.br/ws/01001000/json/');
    assert.equal(options.signal,controller.signal);
    assert.equal(options.credentials,'omit');
    assert.equal(options.body,undefined);
    return response(payload);
  });
  assert.equal(calls,1);
  assert.deepEqual(actual,{street:'Praça da Sé',neighborhood:'Sé',city:'São Paulo',state:'SP'});
  assert.equal('complement' in actual,false,'API complement must not replace residential complement');
});

test('municipal CEP may omit street and neighborhood while retaining city and UF', async () => {
  assert.deepEqual(await lookupPostalCode('01001000',new AbortController().signal,async()=>response({...payload,logradouro:'',bairro:''})),{street:'',neighborhood:'',city:'São Paulo',state:'SP'});
});

test('not-found boolean and string flags become a typed not-found error', async () => {
  for(const erro of [true,'true']) {
    await assert.rejects(lookupPostalCode('99999999',new AbortController().signal,async()=>response({erro})),PostalCodeNotFoundError);
  }
});

test('unexpected address JSON, UF and oversized fields are rejected', async () => {
  for(const value of [null,[],{}, {...payload,logradouro:12}, {...payload,bairro:null}, {...payload,localidade:[]}, {...payload,uf:'XX'}, {...payload,logradouro:'x'.repeat(161)}, {...payload,bairro:'x'.repeat(101)}, {...payload,localidade:'x'.repeat(101)}]) {
    await assert.rejects(lookupPostalCode('01001000',new AbortController().signal,async()=>response(value)),JSON.stringify(value));
  }
});

test('HTTP failures, invalid JSON and network errors do not return partial addresses', async () => {
  await assert.rejects(lookupPostalCode('01001000',new AbortController().signal,async()=>new Response('unavailable',{status:503})));
  await assert.rejects(lookupPostalCode('01001000',new AbortController().signal,async()=>new Response('{invalid',{status:200})));
  const networkError = new TypeError('offline');
  await assert.rejects(lookupPostalCode('01001000',new AbortController().signal,async()=>{throw networkError;}),error=>error===networkError);
});

test('caller cancellation is forwarded to fetch without converting it into a result', async () => {
  const controller=new AbortController();
  const pending=lookupPostalCode('01001000',controller.signal,async(_url,options)=>await new Promise((_resolve,reject)=>{
    options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});
  }));
  controller.abort();
  await assert.rejects(pending,error=>error.name==='AbortError');
});
