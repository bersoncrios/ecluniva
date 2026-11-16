import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { unzipSync, strFromU8 } from 'fflate';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, doc, addDoc, setDoc, getDoc, getDocs, serverTimestamp, terminate } from 'firebase/firestore';
const baseUrl=process.env.QUADREI_BASE_URL||'http://127.0.0.1:4200';
const waitFor=async(check,message)=>{for(let attempt=0;attempt<200;attempt++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,100));}assert.fail(message);};
test('notices create, persist, edit all meeting types and download PDF/DOCX with responsive navigation',{timeout:240000},async t=>{
 assert.ok(['localhost','127.0.0.1'].includes(new URL(baseUrl).hostname));
 const unique=`notices-${Date.now()}`,email=`${unique}@example.test`,password='NoticesTest123!';
 const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
 const signup=await response.json();assert.equal(response.ok,true);
 const app=initializeApp({apiKey:'demo-key',projectId:'demo-societas',authDomain:'demo-societas.firebaseapp.com'},unique);
 const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
 const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8080);
 t.after(async()=>{await terminate(db);await deleteApp(app);});
 await signInWithEmailAndPassword(auth,email,password);
 const society=await addDoc(collection(db,'societies'),{ownerId:signup.localId,churchName:'Igreja Presbiteriana Teste',type:'UPH',name:unique,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 const other=await addDoc(collection(db,'societies'),{ownerId:signup.localId,churchName:'Outra Igreja',type:'SAF',name:`Outra ${unique}`,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 for(const [name,role] of [['Wilson Presidente','Presidente'],['Guilherme Secretário','1º Secretário']]){
  const member=await addDoc(collection(db,'societies',society.id,'members'),{name,birthDate:null,receivedDate:null,office:'',address:{postalCode:'',street:'',number:'',complement:'',neighborhood:'',city:'',state:''},phone:'',email:'',notes:'',status:'active',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  await setDoc(doc(db,'societies',society.id,'boardAssignments',`${new Date().getFullYear()}_${member.id}`),{year:new Date().getFullYear(),memberId:member.id,role,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 }
 const browser=await chromium.launch({executablePath:process.env.QUADREI_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(baseUrl);await page.getByText('Acesso de testes locais',{exact:true}).click();
 await page.getByLabel('E-mail da conta de teste',{exact:true}).fill(email);await page.getByLabel('Senha da conta de teste',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Entrar na conta de teste',exact:true}).click();
 const select=async name=>{await page.getByRole('heading',{name:'Suas sociedades',exact:true}).waitFor();await page.getByRole('button').filter({has:page.getByText(name,{exact:true})}).click();};
 await select(unique);
 await page.locator('.sidebar').getByRole('button',{name:'Diretoria',exact:true}).click();
 await page.locator('.board-composition').getByRole('heading',{name:'Wilson Presidente',exact:true}).waitFor();
 await page.locator('.sidebar').getByRole('button',{name:'Convocações',exact:true}).click();
 await page.getByRole('heading',{name:'Convocações',exact:true}).waitFor();
 await page.getByRole('button',{name:'Nova convocação',exact:true}).click();
 const form=page.getByRole('form',{name:'Dados da convocação'});
 assert.equal(await form.getByLabel('Nome do presidente',{exact:true}).inputValue(),'Wilson Presidente');
 assert.equal(await form.getByLabel('Nome do secretário',{exact:true}).inputValue(),'Guilherme Secretário');
 for(const [key,value] of Object.entries({issueCity:'Palmas, Tocantins',issueDate:'2026-10-10',meetingDate:'2026-10-18',timeDescription:'Após a Escola Bíblica Dominical',meetingLocation:'no templo da igreja',address:'Quadra 604 Norte, Alameda 22, Palmas — TO'}))await form.locator(`#notice-${key}`).fill(value);
 const preview=page.locator('.notice-paper');
 assert.ok(await preview.locator('.signature-name').first().evaluate(el=>parseFloat(getComputedStyle(el).marginTop)>=40),'Signature spacing is preserved');assert.ok((await preview.textContent()).includes('todos os sócios'));
 assert.ok((await preview.textContent()).includes('após a Escola Bíblica Dominical'));
 await form.getByRole('button',{name:'Salvar convocação',exact:true}).click();await page.getByText('Convocação salva.',{exact:true}).waitFor();
 let stored=(await getDocs(collection(db,'societies',society.id,'notices'))).docs;assert.equal(stored.length,1);assert.equal(stored[0].data().meetingType,'plenary');
 await form.getByLabel('Tipo de reunião',{exact:true}).selectOption('executive');
 await form.locator('#notice-timeDescription').fill('18:00');await form.locator('#notice-meetingLocation').fill('na casa do irmão Reginaldo');
 await form.getByLabel('Pauta (opcional)',{exact:true}).fill('Planejamento do mês de abril\nRelatório financeiro');
 assert.ok((await preview.textContent()).includes('os membros da Comissão Executiva (CE)'));
 assert.ok((await preview.textContent()).includes('1. Planejamento do mês de abril'));
 await form.getByRole('button',{name:'Salvar convocação',exact:true}).click();await page.getByText('Convocação salva.',{exact:true}).waitFor();
 assert.equal((await getDoc(stored[0].ref)).data().revision,1);
 await mkdir('artifacts/browser',{recursive:true});
 for(const format of ['PDF','DOCX']){
  const promise=page.waitForEvent('download',{timeout:60000});await form.getByRole('button',{name:`Baixar ${format}`,exact:true}).click();const download=await promise;
  assert.equal(await download.failure(),null);assert.ok(download.suggestedFilename().endsWith('.'+format.toLowerCase()));
  const file=path.resolve('artifacts/browser',`${unique}-${download.suggestedFilename()}`);await download.saveAs(file);
  const buffer=await readFile(file);
  if(format==='PDF')assert.equal(buffer.subarray(0,5).toString(),'%PDF-');
  else {const files=unzipSync(new Uint8Array(buffer));const xml=strFromU8(files['word/document.xml']);for(const phrase of ['Comissão Executiva (CE)','na casa do irmão Reginaldo','Planejamento do mês de abril','Wilson Presidente','Guilherme Secretário'])assert.ok(xml.includes(phrase),phrase);}
 }
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`Overflow at ${width}`);
  await page.screenshot({path:`artifacts/browser/${unique}-${width}.png`,fullPage:true});
 }
 await form.getByLabel('Tipo de reunião',{exact:true}).selectOption('board');assert.ok((await preview.textContent()).includes('os membros da diretoria'));
 await form.getByRole('button',{name:'Salvar convocação',exact:true}).click();await page.getByText('Convocação salva.',{exact:true}).waitFor();
 await page.reload();await select(unique);await page.locator('.sidebar').getByRole('button',{name:'Convocações',exact:true}).click();
 await page.getByRole('button',{name:/Abrir convocação de Diretoria/}).click();
 assert.equal(await form.locator('#notice-type').inputValue(),'board');
 assert.equal(await form.getByLabel('Pauta (opcional)',{exact:true}).inputValue(),'Planejamento do mês de abril\nRelatório financeiro');
 await page.setViewportSize({width:320,height:900});
 await page.locator('.mobile-nav').getByRole('button',{name:'Membros',exact:true}).click();
 await page.locator('.mobile-nav').getByRole('button',{name:'Convocações',exact:true}).click();
 await page.getByRole('heading',{name:'Convocações',exact:true}).waitFor();
 await page.setViewportSize({width:1440,height:1000});await page.locator('.sidebar').getByRole('button',{name:'Trocar sociedade',exact:true}).click();await select(`Outra ${unique}`);
 await page.locator('.sidebar').getByRole('button',{name:'Convocações',exact:true}).click();
 await page.getByRole('heading',{name:'Prepare o próximo encontro',exact:true}).waitFor();
 assert.equal(await page.locator('.notice-form').count(),0);assert.equal((await getDocs(collection(db,'societies',other.id,'notices'))).size,0);
 assert.deepEqual(errors,[]);
});
