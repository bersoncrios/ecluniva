import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import XLSX from 'xlsx';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, getDocs, query, where, writeBatch, doc, serverTimestamp, terminate } from 'firebase/firestore';

const baseUrl=process.env.QUADREI_BASE_URL || process.env.SOCIETAS_BASE_URL || 'http://127.0.0.1:4200';
const chromePath=process.env.QUADREI_CHROME_PATH || process.env.SOCIETAS_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const artifacts=path.resolve('artifacts/browser');
const unique=String(Date.now());
const email=`qa-${unique}@example.test`;
const password='QuadreiQA123!';
const church=`Igreja Presbiteriana QA ${unique}`;
const societyName=`Unidade QA ${unique}`;

async function waitFor(check, message, timeout=15000) {
  const deadline=Date.now()+timeout;
  let error;
  while(Date.now()<deadline) {
    try { if(await check()) return; } catch(cause) { error=cause; }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(`${message}${error ? ': '+error.message:''}`);
}
async function visible(locator, timeout=15000) { await locator.waitFor({state:'visible',timeout}); }
async function noOverflow(page,width) {
  await page.setViewportSize({width,height:900});
  const values=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert.ok(values.scroll<=values.client+1,`Page overflow at ${width}px: ${values.scroll}/${values.client}`);
}
async function downloaded(page, action, extension) {
  const promised=page.waitForEvent('download',{timeout:60000});
  await action();
  const download=await promised;
  assert.equal(await download.failure(),null);
  assert.ok(download.suggestedFilename().endsWith(extension));
  const filename=path.join(artifacts,`${unique}-${download.suggestedFilename()}`);
  await download.saveAs(filename);
  return filename;
}

// This test intentionally fails when local services are unavailable. It never
// substitutes an in-memory app or accesses an HML/PROD project.
test('MVP browser journey, responsive layout and actual exports against local emulators', {timeout:240000}, async t => {
  assert.ok(['127.0.0.1','localhost'].includes(new URL(baseUrl).hostname),'UI tests require a local application URL.');
  let signup;
  try {
    const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
    signup=await response.json();
    assert.equal(response.ok,true,JSON.stringify(signup));
    await fetch(baseUrl);
  } catch(error) { throw new Error(`Start Auth/Firestore emulators and the Angular app with emulator configuration before npm run test:ui. ${error.message}`); }
  await mkdir(artifacts,{recursive:true});
  const firebase=initializeApp({apiKey:'demo-key',authDomain:'demo-societas.firebaseapp.com',projectId:'demo-societas'},`qa-${unique}`);
  const auth=getAuth(firebase);
  connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
  const database=getFirestore(firebase);
  connectFirestoreEmulator(database,'127.0.0.1',8080);
  await signInWithEmailAndPassword(auth,email,password);
  const browser=await chromium.launch({executablePath:chromePath,headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  await context.route('https://viacep.com.br/ws/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({cep:'77000-000',logradouro:'',bairro:'',localidade:'Palmas',uf:'TO'})}));
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  t.after(async()=>{await context.close();await browser.close();await signOut(auth);await terminate(database);await deleteApp(firebase);});
  await page.goto(baseUrl,{waitUntil:'domcontentloaded'});
  await visible(page.getByText('Ambiente local de testes',{exact:true}));
  await page.getByText('Acesso de testes locais',{exact:true}).click();
  await page.getByLabel('E-mail da conta de teste',{exact:true}).fill(email);
  await page.getByLabel('Senha da conta de teste',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Entrar na conta de teste',exact:true}).click();
  await visible(page.getByRole('heading',{name:'Vamos começar pela sua sociedade',exact:true}));
  await page.getByLabel(/^Igreja/).fill(church);
  await page.getByLabel(/^Tipo de sociedade/).selectOption('SAF');
  await page.getByLabel(/^Nome da unidade local/).fill(societyName);
  await page.getByRole('button',{name:'Criar e continuar',exact:true}).click();
  await visible(page.getByRole('heading',{name:'Visão geral',exact:true}));
  await page.screenshot({path:path.join(artifacts,`${unique}-overview-desktop.png`),fullPage:true});
  for(const width of [1440,390,320]) await noOverflow(page,width);
  await page.setViewportSize({width:1440,height:1000});

  await page.getByRole('button',{name:'Cadastrar membro',exact:true}).click();
  await page.getByRole('button',{name:'Salvar membro',exact:true}).click();
  await visible(page.locator('#form-errors'));
  assert.equal(await page.locator('#name').getAttribute('aria-invalid'),'true');
  await waitFor(()=>page.locator('#form-errors').evaluate(element=>document.activeElement===element),'Error summary did not receive focus');
  const dateParts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Araguaina',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const birthDay=dateParts.find(part=>part.type==='day').value;
  const birthMonth=dateParts.find(part=>part.type==='month').value;
  await page.getByLabel(/^Nome completo/).fill('José Ávila');
  await page.locator('#birth-day').fill(birthDay);
  await page.locator('#birth-month').fill(birthMonth);
  await page.locator('#birth-year').fill('2000');
  await page.locator('#received-day').fill('01');
  await page.locator('#received-month').fill('01');
  await page.locator('#received-year').fill('2020');
  await page.getByLabel(/^Ofício/).fill('Diácono');
  await page.getByLabel(/^Telefone/).fill('(63) 99999-1234');
  await page.getByLabel(/^E-mail \(/).fill('jose@example.com');
  await page.getByLabel(/^CEP/).fill('77000-000');
  await page.getByLabel(/^Logradouro/).fill('Rua da Comunidade');
  await page.getByLabel(/^Número/).fill('s/n');
  await page.getByLabel(/^Complemento/).fill('Casa');
  await page.getByLabel(/^Bairro/).fill('Centro');
  await page.getByLabel(/^Cidade/).fill('Palmas');
  await page.getByLabel(/^UF/).selectOption('TO');
  await page.getByLabel(/^Observações \(/).fill('OBSERVAÇÃO PRIVADA NÃO EXPORTAR');
  for(const width of [390,320]) await noOverflow(page,width);
  await page.screenshot({path:path.join(artifacts,`${unique}-form-mobile.png`),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Salvar membro',exact:true}).click();
  await visible(page.getByRole('heading',{name:'Rol de membros',exact:true}));
  await page.getByLabel('Buscar por nome',{exact:true}).fill('JOSE');
  await visible(page.locator('.members-table').getByRole('button',{name:'Editar José Ávila',exact:true}));
  assert.equal(await page.locator('.members-table tbody tr').count(),1);

  await page.locator('.members-table').getByRole('button',{name:'Editar José Ávila',exact:true}).click();
  assert.equal(await page.getByLabel(/^Cidade/).inputValue(),'Palmas');
  assert.equal(await page.getByLabel(/^Telefone/).inputValue(),'63999991234');
  await page.getByLabel(/^Nome completo/).fill('José da Silva Ávila');
  await page.getByLabel(/^E-mail \(/).fill('email inválido');
  await page.getByRole('button',{name:'Salvar membro',exact:true}).click();
  await visible(page.locator('#email-error'));
  assert.equal(await page.getByLabel(/^Nome completo/).inputValue(),'José da Silva Ávila','Invalid form lost edits');
  await page.getByLabel(/^E-mail \(/).fill('jose.silva@example.com');
  await page.getByRole('button',{name:'Salvar membro',exact:true}).click();
  await visible(page.getByRole('heading',{name:'Rol de membros',exact:true}));
  await page.locator('.members-table').getByRole('button',{name:'Editar José da Silva Ávila',exact:true}).click();

  const statusAction=page.getByRole('button',{name:'Inativar membro',exact:true});
  await statusAction.click();
  await visible(page.getByRole('dialog',{name:'Inativar membro?',exact:true}));
  await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal(await page.getByRole('dialog').count(),0);
  await statusAction.click();
  await page.keyboard.press('Escape');
  await waitFor(()=>statusAction.evaluate(element=>document.activeElement===element),'Dialog did not restore focus after Escape');
  await statusAction.click();
  await page.getByRole('dialog').getByRole('button',{name:'Inativar membro',exact:true}).click();
  await visible(page.getByText('Membro inativado.',{exact:true}));
  await page.getByRole('button',{name:'Voltar ao rol',exact:true}).click();
  await visible(page.getByRole('heading',{name:'Nenhum membro encontrado com estes filtros.',exact:true}));
  await page.getByLabel('Status',{exact:true}).selectOption('inactive');
  await visible(page.locator('.members-table').getByRole('button',{name:'Editar José da Silva Ávila',exact:true}));
  await page.locator('.members-table').getByRole('button',{name:'Editar José da Silva Ávila',exact:true}).click();
  await page.getByRole('button',{name:'Reativar membro',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Reativar membro',exact:true}).click();
  await visible(page.getByText('Membro reativado.',{exact:true}));
  await page.getByRole('button',{name:'Voltar ao rol',exact:true}).click();
  await page.getByLabel('Status',{exact:true}).selectOption('active');
  await visible(page.locator('.members-table').getByRole('button',{name:'Editar José da Silva Ávila',exact:true}));

  await page.locator('.sidebar').getByRole('button',{name:'Aniversariantes',exact:true}).click();
  await visible(page.getByRole('heading',{name:'Neste mês',exact:true}));
  assert.equal(await page.locator('.birthday-columns').getByText('José da Silva Ávila',{exact:true}).count(),2);
  await visible(page.locator('.birthday-columns').getByText('Hoje',{exact:true}).first());

  const societies=await getDocs(query(collection(database,'societies'),where('ownerId','==',signup.localId)));
  const selected=societies.docs.find(item=>item.data().name===societyName);
  assert.ok(selected,'UI-created society was not stored under the signed-in owner');
  const storedMembers=await getDocs(collection(database,'societies',selected.id,'members'));
  assert.equal(storedMembers.size,1);
  assert.equal(storedMembers.docs[0].data().name,'José da Silva Ávila');
  const batch=writeBatch(database);
  for(let index=0;index<45;index++) {
    batch.set(doc(collection(database,'societies',selected.id,'members')),{name:index===0 ? '=Membro fórmula QA':`Membro adicional ${String(index).padStart(3,'0')}`,birthDate:null,receivedDate:null,office:index===0?'+Ofício':'',phone:'',email:'',status:'active',notes:'NÃO EXPORTAR OBSERVAÇÕES',address:{postalCode:'',street:index===0?'@Rua da Paz':'',number:index===0?'-10':'',complement:'',neighborhood:'',city:'Palmas',state:'TO'},createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  }
  await batch.commit();
  await page.locator('.sidebar').getByRole('button',{name:'Membros',exact:true}).click();
  await page.getByLabel('Buscar por nome',{exact:true}).fill('');
  await page.getByLabel('Status',{exact:true}).selectOption('all');
  await waitFor(async()=>await page.locator('.members-table tbody tr').count()===46,'List did not include all emulator-seeded members');
  for(const width of [320,390,1440]) await noOverflow(page,width);
  await page.setViewportSize({width:390,height:900});
  await page.screenshot({path:path.join(artifacts,`${unique}-roster-mobile.png`),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});

  await page.getByRole('button',{name:'Exportar rol',exact:true}).click();
  await visible(page.getByRole('dialog',{name:'Exportar rol',exact:true}));
  await page.getByRole('dialog').getByRole('radio',{name:/Planilha/}).check();
  const xlsxFile=await downloaded(page,()=>page.getByRole('dialog').getByRole('button',{name:'Gerar arquivo',exact:true}).click(),'.xlsx');
  const workbook=XLSX.read(await readFile(xlsxFile),{type:'buffer',cellFormula:true});
  const sheet=workbook.Sheets[workbook.SheetNames[0]];
  for(const [key,cell] of Object.entries(sheet)) {
    if(key.startsWith('!')) continue;
    assert.equal(cell.f,undefined,`Formula found in ${key}`);
    assert.equal(cell.t,'s',`Non-string cell in ${key}`);
  }
  const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:''});
  assert.equal(rows[5][1],'46');
  assert.equal(rows.slice(8).length,46);
  assert.equal(rows.flat().includes('OBSERVAÇÃO PRIVADA NÃO EXPORTAR'),false);
  assert.equal(rows.flat().includes('NÃO EXPORTAR OBSERVAÇÕES'),false);
  assert.ok(rows.some(row=>row[0]==='=Membro fórmula QA' && row[3]==='+Ofício' && row[8]==='@Rua da Paz' && row[9]==='-10'));
  assert.ok(rows.some(row=>row[0]==='José da Silva Ávila' && row[1]===`${birthDay}/${birthMonth}/2000`));

  await visible(page.getByText('Arquivo gerado. Confira os downloads do seu navegador.',{exact:true}));
  await page.getByRole('button',{name:'Exportar rol',exact:true}).click();
  await page.getByRole('dialog').getByRole('radio',{name:/^PDF/}).check();
  const pdfFile=await downloaded(page,()=>page.getByRole('dialog').getByRole('button',{name:'Gerar arquivo',exact:true}).click(),'.pdf');
  const pdf=await readFile(pdfFile);
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
  assert.ok(pages>=2,`Expected multipage PDF, received ${pages} pages`);
  assert.ok(pdf.length>20000,'PDF unexpectedly small');
  await visible(page.getByText('Arquivo gerado. Confira os downloads do seu navegador.',{exact:true}));

  await page.getByLabel('Buscar por nome',{exact:true}).fill('nome inexistente de teste');
  await waitFor(()=>page.getByRole('button',{name:'Exportar rol',exact:true}).isDisabled(),'Export must be disabled for empty results');
  await page.locator('.sidebar').getByRole('button',{name:'Trocar sociedade',exact:true}).click();
  await visible(page.getByRole('heading',{name:'Suas sociedades',exact:true}));
  assert.equal(await page.getByRole('heading',{name:'Rol de membros',exact:true}).count(),0);
  await page.getByRole('button',{name:'Sair',exact:true}).click();
  await visible(page.getByRole('button',{name:'Entrar com Google',exact:true}));
  assert.equal(await page.getByText('José da Silva Ávila',{exact:true}).count(),0);
  await page.reload({waitUntil:'domcontentloaded'});
  await visible(page.getByRole('button',{name:'Entrar com Google',exact:true}));
  assert.deepEqual(pageErrors,[],'Uncaught browser exceptions');
});
