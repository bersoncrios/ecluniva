import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.SOCIETAS_BASE_URL || 'http://127.0.0.1:4200';
const chromePath = process.env.SOCIETAS_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const waitFor = async (predicate,message,timeout=15000) => {
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline) { if(await predicate()) return; await new Promise(resolve=>setTimeout(resolve,50)); }
  assert.fail(message);
};
const valueIs = async (page,id,value) => waitFor(async()=>await page.locator(`#address-${id}`).inputValue()===value,`${id} must equal ${value}`);
const found = (code,street,neighborhood,city,state) => ({cep:code,logradouro:street,bairro:neighborhood,localidade:city,uf:state,complemento:'Complemento do serviço, não residencial'});

// No public ViaCEP request is sent: every lookup is fulfilled or delayed locally.
test('ViaCEP fills new/edited members, preserves manual data and ignores obsolete requests', {timeout:180000}, async t => {
  assert.ok(['localhost','127.0.0.1'].includes(new URL(baseUrl).hostname));
  const unique=`cep-${Date.now()}-${process.pid}`;
  const email=`${unique}@example.test`;
  const password='ViaCEPTest123!';
  const signup=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
  assert.equal(signup.ok,true,'Start the Auth/Firestore emulators before browser tests.');
  const browser=await chromium.launch({executablePath:chromePath,headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const failures=[];
  page.on('pageerror',error=>failures.push(error.message));
  const requests=[];
  const waiting=new Map();
  const delayed=new Set(['01310930','20040002','04538132','64000000']);
  const returned=new Set();
  let missingCalls=0;
  const releases=[];
  t.after(async()=>{for(const release of releases) release();await context.close();await browser.close();});
  await context.route('https://viacep.com.br/**',async route=>{
    const code=new URL(route.request().url()).pathname.split('/')[2];
    requests.push(code);
    if(delayed.has(code)) await new Promise(resolve=>{waiting.set(code,resolve);releases.push(resolve);});
    let status=200;
    let body;
    switch(code) {
      case '01001000': body=found('01001-000','Praça da Sé','Sé','São Paulo','SP');break;
      case '01310930': body=found('01310-930','Avenida Paulista','Bela Vista','São Paulo','SP');break;
      case '20040002': body=found('20040-002','Rua antiga','Centro antigo','Rio de Janeiro','RJ');break;
      case '30140071': body=found('30140-071','Avenida atual','Funcionários','Belo Horizonte','MG');break;
      case '99999999': body=missingCalls++ === 0 ? {erro:true}:found('99999-999','Rua da nova tentativa','Centro','Palmas','TO');break;
      case '88010000': status=503;body={error:'offline'};break;
      case '04538132': body=found('04538-132','Resposta após timeout','Teste','São Paulo','SP');break;
      case '64000000': body=found('64000-000','Resposta do formulário antigo','Teste','Teresina','PI');break;
      default: body={erro:true};
    }
    try { await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)}); }
    catch { /* Requests canceled by AbortController need no response. */ }
    finally { returned.add(code); }
  });
  await page.goto(baseUrl,{waitUntil:'domcontentloaded'});
  await page.getByText('Ambiente local de testes',{exact:true}).waitFor();
  await page.getByText('Acesso de testes locais',{exact:true}).click();
  await page.getByLabel('E-mail da conta de teste',{exact:true}).fill(email);
  await page.getByLabel('Senha da conta de teste',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Entrar na conta de teste',exact:true}).click();
  await page.getByRole('heading',{name:'Vamos começar pela sua sociedade',exact:true}).waitFor();
  await page.getByLabel(/^Igreja/).fill('Igreja Presbiteriana Teste CEP');
  await page.getByLabel(/^Tipo de sociedade/).selectOption('UPH');
  await page.getByLabel(/^Nome da unidade local/).fill(unique);
  await page.getByRole('button',{name:'Criar e continuar',exact:true}).click();
  await page.getByRole('heading',{name:'Visão geral',exact:true}).waitFor();
  await page.getByRole('button',{name:'Cadastrar membro',exact:true}).click();
  const cep=page.locator('#address-postalCode');
  await cep.fill('01001-00');
  await cep.fill('abc');
  await page.locator('#name').fill('Membro ViaCEP');
  assert.deepEqual(requests,[],'Incomplete or invalid CEP must not trigger lookup');
  await page.locator('#address-number').fill('42');
  await page.locator('#address-complement').fill('Casa dos fundos');
  await cep.fill('01001-000');
  await valueIs(page,'street','Praça da Sé');
  await valueIs(page,'neighborhood','Sé');
  await valueIs(page,'city','São Paulo');
  await valueIs(page,'state','SP');
  await valueIs(page,'number','42');
  await valueIs(page,'complement','Casa dos fundos');
  assert.match(await page.locator('#postal-status').textContent(),/Endereço encontrado/);
  const lookupCount=requests.length;
  await cep.fill('01001000');
  await page.locator('#address-number').focus();
  assert.equal(requests.length,lookupCount,'Formatting the same CEP must not repeat lookup');

  await cep.fill('01310930');
  await waitFor(()=>waiting.has('01310930'),'Delayed lookup did not start');
  await page.locator('#address-street').fill('Rua preenchida manualmente');
  await page.locator('#address-number').fill('77');
  await page.locator('#address-complement').fill('Apartamento 2');
  waiting.get('01310930')();
  await valueIs(page,'neighborhood','Bela Vista');
  await valueIs(page,'street','Rua preenchida manualmente');
  await valueIs(page,'number','77');
  await valueIs(page,'complement','Apartamento 2');

  await cep.fill('20040002');
  await waitFor(()=>waiting.has('20040002'),'First overlapping lookup did not start');
  await cep.fill('30140071');
  await valueIs(page,'city','Belo Horizonte');
  await valueIs(page,'street','Avenida atual');
  waiting.get('20040002')();
  await waitFor(()=>returned.has('20040002'),'Obsolete response did not finish');
  await valueIs(page,'city','Belo Horizonte');
  await valueIs(page,'state','MG');
  await valueIs(page,'street','Avenida atual');

  await cep.fill('99999999');
  await waitFor(async()=>/CEP não encontrado/.test(await page.locator('#postal-status').textContent()),'Missing CEP feedback not shown');
  await valueIs(page,'city','Belo Horizonte');
  await page.getByRole('button',{name:'Buscar endereço novamente',exact:true}).click();
  await valueIs(page,'city','Palmas');
  assert.equal(missingCalls,2,'Retry should issue a new lookup');

  await cep.fill('04538132');
  await waitFor(()=>waiting.has('04538132'),'Timeout lookup did not start');
  await waitFor(async()=>/Não foi possível consultar/.test(await page.locator('#postal-status').textContent()),'Timeout did not provide manual fallback',12000);
  waiting.get('04538132')();
  await waitFor(()=>returned.has('04538132'),'Timed-out route did not finish');
  await valueIs(page,'city','Palmas');

  await cep.fill('88010000');
  await waitFor(async()=>/Não foi possível consultar/.test(await page.locator('#postal-status').textContent()),'HTTP error did not provide manual fallback');
  await page.locator('#address-street').fill('Rua manual após falha');
  await page.locator('#address-city').fill('Cidade manual');
  await page.locator('#address-state').selectOption('TO');
  await page.getByRole('button',{name:'Salvar membro',exact:true}).click();
  await page.getByRole('heading',{name:'Rol de membros',exact:true}).waitFor();
  const beforeEdit=requests.length;
  await page.locator('.members-table').getByRole('button',{name:'Editar Membro ViaCEP',exact:true}).click();
  await valueIs(page,'street','Rua manual após falha');
  await valueIs(page,'city','Cidade manual');
  await page.waitForLoadState('networkidle');
  assert.equal(requests.length,beforeEdit,'Opening an existing member must not look up the stored CEP');
  await cep.fill('01001000');
  await valueIs(page,'street','Praça da Sé');
  await valueIs(page,'number','77');
  await valueIs(page,'complement','Apartamento 2');

  await cep.fill('64000000');
  await waitFor(()=>waiting.has('64000000'),'Navigation lookup did not start');
  await page.getByRole('button',{name:'Voltar ao rol',exact:true}).click();
  await page.getByRole('button',{name:'Cadastrar membro',exact:true}).click();
  waiting.get('64000000')();
  await waitFor(()=>returned.has('64000000'),'Old-form route did not finish');
  await valueIs(page,'street','');
  await valueIs(page,'city','');
  await valueIs(page,'state','');
  await valueIs(page,'postalCode','');
  assert.equal(await page.locator('#postal-status').textContent(),'');
  assert.deepEqual(failures,[],'Uncaught exceptions during CEP lookup');
});
