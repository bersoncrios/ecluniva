import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword} from 'firebase/auth';
import {getFirestore,connectFirestoreEmulator,collection,addDoc,doc,getDoc,getDocs,query,where,terminate,serverTimestamp} from 'firebase/firestore';
const baseUrl=process.env.QUADREI_BASE_URL||'http://127.0.0.1:4200';
const waitFor=async(check,message,timeout=20000)=>{const until=Date.now()+timeout;while(Date.now()<until){if(await check())return;await new Promise(resolve=>setTimeout(resolve,100));}assert.fail(message);};
const civilDate=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Araguaina',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(key=>parts.find(part=>part.type===key).value).join('-');};
async function account(email,password){
 const endpoint='http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/';
 const post=async(action,body)=>{const response=await fetch(endpoint+action+'?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();assert.equal(response.ok,true,JSON.stringify(result));return result;};
 const signup=await post('accounts:signUp',{email,password,returnSecureToken:true});
 await post('accounts:sendOobCode',{requestType:'VERIFY_EMAIL',idToken:signup.idToken});
 const codes=await(await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-societas/oobCodes')).json();
 const code=codes.oobCodes.find(item=>item.email===email&&item.requestType==='VERIFY_EMAIL');assert.ok(code,'Local email verification code exists');
 await post('accounts:update',{oobCode:code.oobCode});return signup;
}
test('Communication invitations isolate private data, manage publications and produce all branded cards',{timeout:300000},async t=>{
 assert.ok(['127.0.0.1','localhost'].includes(new URL(baseUrl).hostname));
 const unique=`communication-${Date.now()}`,ownerEmail=`owner-${unique}@example.test`,mediaEmail=`media-${unique}@example.test`,password='CommunicationTest123!';
 const ownerAccount=await account(ownerEmail,password);await account(mediaEmail,password);
 const app=initializeApp({apiKey:'demo-key',projectId:'demo-societas',authDomain:'demo-societas.firebaseapp.com'},unique);
 const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8080);
 t.after(async()=>{await terminate(db);await deleteApp(app);});await signInWithEmailAndPassword(auth,ownerEmail,password);
 const societyName='Comunidade Esperança '+unique;
 const society=await addDoc(collection(db,'societies'),{ownerId:ownerAccount.localId,name:societyName,churchName:'Igreja Presbiteriana Teste',type:'UPH',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 const today=civilDate();
 const memberPayload=(name,birthDate,status='active')=>({name,birthDate,receivedDate:null,office:'Diácono',address:{postalCode:'',street:'ENDEREÇO PRIVADO',number:'1',complement:'',neighborhood:'',city:'',state:''},phone:'63912345678',email:'private-contact@example.test',notes:'OBSERVAÇÃO PRIVADA',status,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 const person=await addDoc(collection(db,'societies',society.id,'members'),memberPayload('João Antônio de Albuquerque e Vasconcelos','1980'+today.slice(4)));
 await addDoc(collection(db,'societies',society.id,'members'),memberPayload('Maria da Comunidade','1970'+today.slice(4)));
 const inactive=await addDoc(collection(db,'societies',society.id,'members'),memberPayload('Pessoa Inativa','1975'+today.slice(4)));
 // An owner edits the legacy record before enabling sharing.
 const {updateDoc}=await import('firebase/firestore');await updateDoc(inactive,{status:'inactive',updatedAt:serverTimestamp()});
 await addDoc(collection(db,'societies',society.id,'members'),memberPayload('Sem Aniversário',null));
 const browser=await chromium.launch({executablePath:process.env.QUADREI_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});t.after(()=>browser.close());
 const ownerContext=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']}),mediaContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['clipboard-read','clipboard-write']});
 const owner=await ownerContext.newPage(),media=await mediaContext.newPage();const errors=[];for(const page of [owner,media])page.on('pageerror',error=>errors.push(error.message));
 const login=async(page,email)=>{await page.goto(baseUrl+'/#convites');await page.getByText('Acesso de testes locais',{exact:true}).click();await page.getByLabel('E-mail da conta de teste',{exact:true}).fill(email);await page.getByLabel('Senha da conta de teste',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar na conta de teste',exact:true}).click();};
 await login(owner,ownerEmail);await owner.getByRole('button').filter({has:owner.getByText(societyName,{exact:true})}).click();
 await owner.locator('.sidebar').getByRole('button',{name:'Aniversariantes',exact:true}).click();await owner.getByRole('button',{name:'Comunicação e publicações',exact:true}).click();
 await owner.getByRole('heading',{name:'Comunicação',exact:true}).waitFor();await waitFor(async()=>await owner.locator('.publication-card').count()===2,'Only active birthdays are prepared');
 const summaries=await getDocs(collection(db,'societies',society.id,'communicationBirthdays'));assert.equal(summaries.size,4);for(const item of summaries.docs)assert.deepEqual(Object.keys(item.data()).sort(),['active','day','month','name']);
 await owner.getByRole('button',{name:'Identidade dos cartões',exact:true}).click();
 await owner.getByLabel('Cor principal',{exact:true}).fill('#20374d');await owner.getByLabel('Cor de destaque',{exact:true}).fill('#c49851');
 await owner.getByLabel('Logotipo da sociedade (opcional)',{exact:true}).setInputFiles('public/logo-512.png');await owner.locator('.identity-logo').waitFor();
 await owner.getByLabel('Mensagem padrão',{exact:true}).fill('Parabéns, {nome}! Receba o carinho da {sociedade}. Que seu dia seja cheio de paz e alegria.');
 await owner.getByRole('button',{name:'Salvar identidade',exact:true}).click();await owner.getByText('Identidade dos cartões salva.',{exact:true}).waitFor();
 await owner.getByRole('button',{name:'Equipe e convites',exact:true}).click();await owner.getByLabel('E-mail do convidado',{exact:true}).fill(mediaEmail.toUpperCase());await owner.getByRole('button',{name:'Criar convite',exact:true}).click();
 await owner.getByText('Convite criado. Copie o link ou abra o e-mail para enviar.',{exact:true}).waitFor();
 const mail=await owner.getByRole('link',{name:'Abrir e-mail do convite',exact:true}).getAttribute('href');assert.ok(decodeURIComponent(mail).startsWith('mailto:'+mediaEmail+'?subject='));
 await owner.getByRole('button',{name:'Copiar link',exact:true}).click();assert.equal(await owner.evaluate(()=>navigator.clipboard.readText()),baseUrl+'/#convites');
 for(const tab of ['Aniversariantes','Equipe e convites','Identidade dos cartões']){
  await owner.getByRole('navigation',{name:'Seções da Comunicação'}).getByRole('button',{name:tab,exact:true}).click();
  for(const width of [320,390,768,1440]){await owner.setViewportSize({width,height:900});assert.ok(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Owner communication overflow ${tab} ${width}`);}
  await owner.setViewportSize({width:1440,height:1000});
 }
 await owner.getByRole('button',{name:'Equipe e convites',exact:true}).click();
 await login(media,mediaEmail);await media.getByRole('heading',{name:'Convites de Comunicação',exact:true}).waitFor();
 await media.getByRole('button',{name:`Aceitar convite de ${societyName}`,exact:true}).click();
 await media.getByRole('button').filter({has:media.getByText(societyName,{exact:true})}).click();await media.getByRole('heading',{name:'Comunicação',exact:true}).waitFor();
 await waitFor(async()=>await media.locator('.publication-card').count()===2,'Communication profile loads two birthdays');
 const body=await media.locator('body').textContent();for(const forbidden of ['1980'+today.slice(4),'1970'+today.slice(4),'63912345678','ENDEREÇO PRIVADO','OBSERVAÇÃO PRIVADA','private-contact@example.test','Pessoa Inativa'])assert.ok(!body.includes(forbidden),forbidden);
 assert.equal(await media.getByRole('button',{name:'Equipe e convites',exact:true}).count(),0);assert.equal(await media.locator('.mobile-nav').getByRole('button').count(),1);
 await media.evaluate(()=>{location.hash='members';dispatchEvent(new PopStateEvent('popstate'));});await media.getByRole('heading',{name:'Comunicação',exact:true}).waitFor();assert.equal(await media.getByRole('heading',{name:'Rol de membros',exact:true}).count(),0);
 const publication=media.locator('.publication-card').filter({has:media.getByRole('heading',{name:'João Antônio de Albuquerque e Vasconcelos',exact:true})});
 await publication.getByRole('button',{name:'Copiar mensagem para João Antônio de Albuquerque e Vasconcelos',exact:true}).click();assert.ok((await media.evaluate(()=>navigator.clipboard.readText())).includes('Parabéns, João Antônio'));
 await publication.getByLabel('Acompanhamento da publicação',{exact:true}).selectOption('prepared');await waitFor(async()=>(await getDoc(doc(db,`societies/${society.id}/birthdayPublications/${person.id}_${today}`))).data()?.status==='prepared','Prepared status persists');
 await publication.getByLabel('Acompanhamento da publicação',{exact:true}).selectOption('published');await waitFor(async()=>(await getDoc(doc(db,`societies/${society.id}/birthdayPublications/${person.id}_${today}`))).data()?.status==='published','Published status persists');
 await media.getByLabel('Buscar aniversariante',{exact:true}).fill('joao');assert.equal(await media.locator('.publication-card').count(),1);await media.getByLabel('Buscar aniversariante',{exact:true}).fill('');
 await media.getByRole('button',{name:'Próximos 30 dias',exact:true}).click();assert.equal(await media.locator('.publication-card').count(),2);await media.getByRole('button',{name:'Neste mês',exact:true}).click();
 await publication.getByRole('button',{name:'Criar cartão para João Antônio de Albuquerque e Vasconcelos',exact:true}).click();
 await mkdir('artifacts/communication',{recursive:true});
 for(const style of ['classic','celebration'])for(const [format,height] of [['square',1080],['portrait',1350],['story',1920]]){
  await media.getByLabel('Modelo',{exact:true}).selectOption(style);await media.getByLabel('Formato',{exact:true}).selectOption(format);
  const downloadPromise=media.waitForEvent('download',{timeout:60000});await media.getByRole('button',{name:'Baixar cartão PNG',exact:true}).click();const download=await downloadPromise;assert.equal(await download.failure(),null);
  const filename=path.resolve('artifacts/communication',`${style}-${format}.png`);await download.saveAs(filename);const png=await readFile(filename);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),height);
 }
 for(const width of [320,390,768,1024,1440]){await media.setViewportSize({width,height:900});assert.ok(await media.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Communication overflow ${width}`);await media.screenshot({path:`artifacts/communication/media-${width}.png`,fullPage:true});}
 await media.reload();await media.getByRole('button').filter({has:media.getByText(societyName,{exact:true})}).click();await media.getByRole('heading',{name:'Comunicação',exact:true}).waitFor();await media.getByText('Parabéns publicados',{exact:true}).first().waitFor();
 await owner.locator('.sidebar').getByRole('button',{name:'Membros',exact:true}).click();
 await owner.locator('.members-table').getByRole('button',{name:'Editar João Antônio de Albuquerque e Vasconcelos',exact:true}).click();
 await owner.getByRole('button',{name:'Inativar membro',exact:true}).click();await owner.getByRole('dialog').getByRole('button',{name:'Inativar membro',exact:true}).click();await owner.getByText('Membro inativado.',{exact:true}).waitFor();
 await waitFor(async()=>await media.locator('.publication-card').count()===1,'Inactivated member disappears from Communication');
 await owner.getByRole('button',{name:'Reativar membro',exact:true}).click();await owner.getByRole('dialog').getByRole('button',{name:'Reativar membro',exact:true}).click();await owner.getByText('Membro reativado.',{exact:true}).waitFor();
 await waitFor(async()=>await media.locator('.publication-card').count()===2,'Reactivated birthday returns');
 await owner.locator('.sidebar').getByRole('button',{name:'Aniversariantes',exact:true}).click();await owner.getByRole('button',{name:'Comunicação e publicações',exact:true}).click();await owner.getByRole('button',{name:'Equipe e convites',exact:true}).click();
 await owner.getByText('Acesso ativo',{exact:true}).waitFor();await owner.getByRole('button',{name:'Revogar acesso',exact:true}).click();await owner.getByText('Acesso revogado.',{exact:true}).waitFor();
 await waitFor(async()=>await media.getByRole('heading',{name:'Comunicação',exact:true}).count()===0,'Revocation clears collaborator view');assert.equal(await media.locator('.publication-card').count(),0);
 // The SDK also denies private reads and shared reads after revocation.
 await signInWithEmailAndPassword(auth,mediaEmail,password);await assert.rejects(getDoc(person),/permission|denied/i);await assert.rejects(getDocs(query(collection(db,'societies',society.id,'communicationBirthdays'),where('active','==',true))),/permission|denied/i);
 assert.deepEqual(errors,[]);
});
