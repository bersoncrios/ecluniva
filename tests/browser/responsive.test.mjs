import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, doc, addDoc, setDoc, updateDoc, writeBatch, serverTimestamp, Timestamp, terminate } from 'firebase/firestore';
const baseUrl=process.env.QUADREI_BASE_URL||'http://127.0.0.1:4200';
const sizes=[[320,740],[360,800],[390,844],[430,932],[600,960],[767,900],[768,1024],[820,1180],[844,390],[1023,768],[1024,768],[1101,768],[1280,720],[1440,900],[1920,1080]];
const civilDate=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Araguaina',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(key=>parts.find(part=>part.type===key).value).join('-');};
const longName='José Antônio de Albuquerque e Vasconcelos da Silva e Oliveira';
const churchName='Igreja Presbiteriana da Comunidade de Comunhão e Serviço do Jardim das Palmeiras';
const societyName='Sociedade da Comunidade de Comunhão e Serviço do Jardim das Palmeiras';
const unique=`responsive-${Date.now()}`;
const artifacts='artifacts/responsive';

test('all screens adapt to phone, tablet and desktop widths, including long records and dialogs',{timeout:360000},async t=>{
 assert.ok(['localhost','127.0.0.1'].includes(new URL(baseUrl).hostname));
 const email=`${unique}@example.test`,password='ResponsiveTest123!';
 const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
 const signup=await response.json();assert.equal(response.ok,true);
 const app=initializeApp({apiKey:'demo-key',projectId:'demo-societas',authDomain:'demo-societas.firebaseapp.com'},unique);
 const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
 const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8080);
 t.after(async()=>{await terminate(db);await deleteApp(app);});
 await signInWithEmailAndPassword(auth,email,password);
 const society=await addDoc(collection(db,'societies'),{ownerId:signup.localId,churchName,type:'UPH',name:societyName,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 await addDoc(collection(db,'societies'),{ownerId:signup.localId,churchName,type:'SAF',name:'Sociedade sem cadastros',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 const today=civilDate(),year=Number(today.slice(0,4));
 const memberInput={birthDate:'1970'+today.slice(4),receivedDate:'2020-01-01',office:'Diácono',address:{postalCode:'77000000',street:'Rua da Comunhão e Serviço',number:'123',complement:'Casa dos fundos',neighborhood:'Jardim das Palmeiras',city:'Palmas',state:'TO'},phone:'63999999999',email:'membro.com.nome.extenso@example.test',notes:'Informações de contato e observações para testar a leitura completa do cadastro. '.repeat(12),status:'active',createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
 const president=await addDoc(collection(db,'societies',society.id,'members'),{...memberInput,name:longName});
 const secretary=await addDoc(collection(db,'societies',society.id,'members'),{...memberInput,name:'Guilherme Taveira de Albuquerque Berson'});
 await addDoc(collection(db,'societies',society.id,'members'),{...memberInput,name:'SócioComNomeSemEspaços'.repeat(5)});
 await setDoc(doc(db,'societies',society.id,'boardAssignments',`${year}_${president.id}`),{year,memberId:president.id,role:'Presidente',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 await setDoc(doc(db,'societies',society.id,'boardAssignments',`${year}_${secretary.id}`),{year,memberId:secretary.id,role:'Secretário de atividades e acompanhamento dos membros da comunidade local',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 const minuteId=`${year}_1`,minuteRef=doc(db,'societies',society.id,'minutes',minuteId),dayStart=Timestamp.fromDate(new Date(today+'T03:00:00Z'));
 const batch=writeBatch(db);batch.set(doc(db,'societies',society.id,'minuteCounters',String(year)),{year,value:1,minuteId,updatedAt:serverTimestamp()});
 batch.set(minuteRef,{number:1,year,type:'Ordinária',date:today,timeZone:'America/Araguaina',logoDataUrl:'',newMembers:'',hymn:'',attendance:[],presidentId:'',secretaryId:'',status:'scheduled',churchName,societyName:'UPH '+societyName,meetingLocation:'Casa do irmão João',templeAddress:'Rua da Comunhão e Serviço, 123, Jardim das Palmeiras, Palmas — TO',convocation:'segunda',startTime:'19:00',devotionalTime:'19:05',endTime:'20:00',preacher:longName,openingPrayer:longName,closingPrayer:longName,scripture:'Salmo 133',deliberations:'Foi aprovado o planejamento das visitas e das atividades da sociedade.',revision:0,dayStart,dayEnd:Timestamp.fromMillis(dayStart.toMillis()+86400000),createdAt:serverTimestamp(),updatedAt:serverTimestamp(),concludedAt:null,finalText:''});await batch.commit();
 await updateDoc(minuteRef,{attendance:[{memberId:president.id,name:longName,role:'Presidente',office:'Diácono'},{memberId:secretary.id,name:'Guilherme Taveira de Albuquerque Berson',role:'Secretário',office:''}],presidentId:president.id,secretaryId:secretary.id,status:'in_progress',revision:1,updatedAt:serverTimestamp()});
 await addDoc(collection(db,'societies',society.id,'notices'),{meetingType:'plenary',issueDate:today,meetingDate:today,meetingPurpose:'reunião plenária',legalBasis:'',presidentRole:'Presidente da UPH',secretaryRole:'1º Secretário da UPH',churchName,societyName:'União Presbiteriana de Homens — '+societyName,issueCity:'Palmas, Tocantins',timeDescription:'após a Escola Bíblica Dominical',meetingLocation:'na casa do irmão João',address:'Rua da Comunhão e Serviço, 123, Jardim das Palmeiras, Palmas — TO',presidentName:longName,secretaryName:'Guilherme Taveira de Albuquerque Berson',agenda:'Planejamento das atividades de visitação aos sócios da comunidade\nRelatório financeiro',revision:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 const browser=await chromium.launch({executablePath:process.env.QUADREI_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1440,height:900}});const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
 await mkdir(artifacts,{recursive:true});const findings=[];const inspected=[];
 async function audit(name,{dialog=false,screenshot=false}={}){
  for(const [width,height] of sizes){
   await page.setViewportSize({width,height});
   const result=await page.evaluate(({dialog})=>{
    const visible=el=>{const rect=el.getBoundingClientRect(),style=getComputedStyle(el);return rect.width>0&&rect.height>0&&style.visibility!=='hidden'&&style.display!=='none';};
    const root=dialog?document.querySelector('dialog[open]'):document.querySelector('main')||document.body;
    const problems=[];
    if(document.documentElement.scrollWidth>innerWidth+1)problems.push({kind:'page-overflow',width:document.documentElement.scrollWidth});
    if(root)for(const el of root.querySelectorAll('button,input,select,textarea,.panel,.field-grid,.minute-paper,.notice-paper,.member-details-grid,.attendance-list')){
     if(!visible(el))continue;const rect=el.getBoundingClientRect();
     if(rect.left< -1||rect.right>innerWidth+1)problems.push({kind:'outside-width',element:el.id||el.className||el.tagName,left:Math.round(rect.left),right:Math.round(rect.right)});
     if(innerWidth<=1023&&el.matches('input:not([type=checkbox]):not([type=radio]),select,textarea')&&parseFloat(getComputedStyle(el).fontSize)<16)problems.push({kind:'small-input-font',element:el.id||el.tagName});
     if(el.matches('.attendance-list')&&el.scrollWidth>el.clientWidth+1)problems.push({kind:'attendance-horizontal-scroll'});
     if(el.matches('button')){
      const parent=el.closest('.table-action,.member-card,.panel,dialog');
      if(parent){const bounds=parent.getBoundingClientRect();if(rect.left<bounds.left-1||rect.right>bounds.right+1)problems.push({kind:'clipped-action',element:el.textContent.trim()});}
     }
    }
    if(dialog){const el=document.querySelector('dialog[open]');if(el){const rect=el.getBoundingClientRect();if(rect.top< -1||rect.bottom>innerHeight+1)problems.push({kind:'dialog-outside-height'});if(el.scrollWidth>el.clientWidth+1)problems.push({kind:'dialog-overflow'});}}
    return problems;
   },{dialog});
   findings.push(...result.map(problem=>({screen:name,viewport:`${width}x${height}`,...problem})));
   if(screenshot&&[320,768,1101,1440].includes(width))await page.screenshot({path:`${artifacts}/${name}-${width}.png`,fullPage:true});
  }
  inspected.push(name);
 }
 async function desktop(){await page.setViewportSize({width:1440,height:900});}
 async function go(name){await desktop();await page.locator('.sidebar').getByRole('button',{name,exact:true}).click();}
 await page.goto(baseUrl);await page.locator('.login-card').waitFor();await audit('login',{screenshot:true});
 await desktop();await page.getByText('Acesso de testes locais',{exact:true}).click();await page.getByLabel('E-mail da conta de teste',{exact:true}).fill(email);await page.getByLabel('Senha da conta de teste',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar na conta de teste',exact:true}).click();
 await page.getByRole('heading',{name:'Suas sociedades',exact:true}).waitFor();await audit('societies');await desktop();
 await page.locator('.create-choice').click();await page.getByLabel('Igreja obrigatório',{exact:true}).waitFor();await audit('society-form');await desktop();await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('button').filter({has:page.getByText(societyName,{exact:true})}).click();await page.getByRole('heading',{name:'Visão geral',exact:true}).waitFor();await audit('overview',{screenshot:true});
 await go('Membros');await page.getByRole('heading',{name:'Rol de membros',exact:true}).waitFor();await audit('members',{screenshot:true});
 await desktop();await page.locator('.members-table').getByRole('button',{name:`Ver detalhes de ${longName}`,exact:true}).click();await page.getByRole('dialog').waitFor();await audit('member-details',{dialog:true,screenshot:true});await page.keyboard.press('Escape');
 await desktop();await page.getByRole('button',{name:'Exportar rol',exact:true}).click();await page.getByRole('dialog').waitFor();await audit('export-dialog',{dialog:true});await page.keyboard.press('Escape');
 await desktop();await page.locator('.members-table').getByRole('button',{name:`Editar ${longName}`,exact:true}).click();await page.getByRole('heading',{name:'Editar cadastro',exact:true}).waitFor();await audit('member-form',{screenshot:true});
 await desktop();await page.getByRole('button',{name:'Inativar membro',exact:true}).click();await page.getByRole('dialog').waitFor();await audit('status-dialog',{dialog:true});await page.keyboard.press('Escape');
 await go('Aniversariantes');await page.getByRole('heading',{name:'Aniversariantes',exact:true}).waitFor();await audit('birthdays',{screenshot:true});
 await go('Diretoria');await page.locator('.board-card').first().waitFor();await audit('board',{screenshot:true});
 await desktop();await page.getByRole('button',{name:`Editar cargo de ${longName}`,exact:true}).click();await page.locator('.board-assignment-form').waitFor();await audit('board-form');
 await desktop();await page.getByRole('button',{name:`Remover ${longName} da diretoria`,exact:true}).click();await page.getByRole('dialog').waitFor();await audit('board-dialog',{dialog:true});await page.keyboard.press('Escape');
 await go('Atas e plenárias');await page.getByRole('button',{name:'Abrir plenária',exact:true}).click();await page.locator('.minute-form').waitFor();await audit('minutes',{screenshot:true});
 await desktop();await page.getByRole('button',{name:'Agendar plenária',exact:true}).click();await page.locator('.schedule-form').waitFor();await audit('minute-schedule');
 await desktop();await page.locator('.schedule-form').getByRole('button',{name:'Cancelar',exact:true}).click();await page.getByRole('button',{name:'Lavrar e concluir ata',exact:true}).click();await page.getByRole('dialog').waitFor();await audit('minute-dialog',{dialog:true});await page.keyboard.press('Escape');
 await go('Convocações');await page.getByRole('button',{name:/Abrir convocação de/}).click();await page.locator('.notice-form').waitFor();await audit('notices',{screenshot:true});
 await desktop();await page.locator('.account-menu summary').click();await audit('account-menu');await desktop();await page.locator('.account-menu summary').click();
 // Short desktop heights must allow scrolling to the last sidebar action.
 for(const height of [568,600,720]){await page.setViewportSize({width:1280,height});const sidebar=page.locator('.sidebar');const exit=sidebar.getByRole('button',{name:/Sair da conta/});await exit.scrollIntoViewIfNeeded();const bounds=await exit.boundingBox();if(bounds.y<0||bounds.y+bounds.height>height+1)findings.push({screen:'sidebar',viewport:`1280x${height}`,kind:'unreachable-logout',bottom:bounds.y+bounds.height});}
 // Exercise actual coarse-pointer layouts and focus with a reduced viewport height.
 for(const [width,height] of [[390,844],[820,1180],[1366,1024]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const touch=await context.newPage();
  await touch.goto(baseUrl);await touch.getByText('Acesso de testes locais',{exact:true}).click();
  await touch.getByLabel('E-mail da conta de teste',{exact:true}).fill(email);await touch.getByLabel('Senha da conta de teste',{exact:true}).fill(password);await touch.getByRole('button',{name:'Entrar na conta de teste',exact:true}).click();
  await touch.getByRole('button').filter({has:touch.getByText(societyName,{exact:true})}).click();
  const nav=touch.locator(width<1024?'.mobile-nav':'.sidebar nav');
  for(const [name,heading] of [['Membros','Rol de membros'],['Aniversariantes','Aniversariantes'],['Diretoria',`Diretoria ${year}`],['Atas','Atas e plenárias'],['Convocações','Convocações']]){
   const button=nav.getByRole('button',{name:name==='Atas'&&width>=1024?'Atas e plenárias':name,exact:true});await button.click();await touch.getByRole('heading',{name:heading,exact:true}).waitFor();
   const box=await button.boundingBox();if(box.width<44||box.height<44)findings.push({screen:'touch-navigation',viewport:`${width}x${height}`,kind:'small-target',name});
  }
  await nav.getByRole('button',{name:'Membros',exact:true}).click();
  const search=touch.getByLabel('Buscar por nome',{exact:true});await search.fill('José');
  if(await search.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))<16)findings.push({screen:'touch-search',viewport:`${width}x${height}`,kind:'small-input-font'});
  const roster=width<768?touch.locator('.mobile-members'):touch.locator('.members-table');
  await roster.getByRole('button',{name:`Ver detalhes de ${longName}`,exact:true}).click();
  const detail=touch.getByRole('dialog');await detail.getByRole('button',{name:'Editar cadastro',exact:true}).click();
  const summaryBox=await touch.locator('.account-menu summary').boundingBox();if(summaryBox.width<44||summaryBox.height<44)findings.push({screen:'touch-account',viewport:`${width}x${height}`,kind:'small-target'});
  const mail=touch.getByLabel(/^E-mail \(/);
  await touch.setViewportSize({width,height:360});await mail.focus();await mail.scrollIntoViewIfNeeded();
  const field=await mail.boundingBox(),navBox=await nav.boundingBox();
  if(field.y<0||field.y+field.height>(width<1024?navBox.y:360))findings.push({screen:'touch-keyboard',viewport:`${width}x360`,kind:'focused-input-covered'});
  if(await mail.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))<16)findings.push({screen:'touch-member-form',viewport:`${width}x360`,kind:'small-input-font'});
  await touch.setViewportSize({width,height});
  await touch.getByRole('button',{name:'Salvar membro',exact:true}).click({trial:true});
  await context.close();
 }
 await desktop();await page.locator('.sidebar').getByRole('button',{name:'Trocar sociedade',exact:true}).click();
 await page.getByRole('button').filter({has:page.getByText('Sociedade sem cadastros',{exact:true})}).click();
 await page.locator('.stats-grid').waitFor();await audit('empty-overview');
 for(const [name,selector] of [['Membros','.roster-panel .empty-state'],['Aniversariantes','.birthday-columns'],['Diretoria','.board-intro + .panel'],['Atas e plenárias','app-minutes .empty-state'],['Convocações','app-notices .empty-state']]){
  await go(name);
  await page.locator(name==='Diretoria'?'app-board .empty-state':selector).waitFor();await audit('empty-'+name.toLowerCase().replaceAll(' ','-'));
 }
 await writeFile(`${artifacts}/audit.json`,JSON.stringify({inspected,viewports:sizes,findings,pageErrors},null,2));
 console.log(JSON.stringify({screens:inspected.length,viewports:sizes.length,findings:findings.slice(0,12),total:findings.length}));
 assert.deepEqual(pageErrors,[]);assert.equal(findings.length,0,'Responsive findings are saved in artifacts/responsive/audit.json');
});
