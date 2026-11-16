import { todayISO } from './domain.js';

export const NOTICE_TYPES = [
  {value:'plenary',label:'Reunião plenária'},
  {value:'executive',label:'Comissão Executiva (CE)'},
  {value:'board',label:'Diretoria'}
] as const;
export type NoticeType = typeof NOTICE_TYPES[number]['value'];
export interface NoticeInput {
  meetingType: NoticeType; churchName: string; societyName: string;
  issueCity: string; issueDate: string; meetingDate: string; timeDescription: string;
  meetingPurpose: string; meetingLocation: string; address: string;
  legalBasis: string; agenda: string; presidentName: string; secretaryName: string;
  presidentRole: string; secretaryRole: string;
}
export interface Notice extends NoticeInput { id: string; revision: number; }
export interface NoticeParagraph { text: string; kind:'heading'|'title'|'date'|'body'|'agenda'|'closing'|'signature'; }
const clean = (value: string): string => value.trim().replace(/\s+/g,' ');
export const noticePurpose = (type: NoticeType): string => ({plenary:'reunião plenária',executive:'reunião de planejamento',board:'reunião da diretoria'})[type];
export function emptyNotice(date=todayISO()): NoticeInput {
  return {meetingType:'plenary',churchName:'',societyName:'',issueCity:'',issueDate:date,meetingDate:date,timeDescription:'',meetingPurpose:noticePurpose('plenary'),meetingLocation:'',address:'',legalBasis:'',agenda:'',presidentName:'',secretaryName:'',presidentRole:'Presidente',secretaryRole:'1º Secretário'};
}
function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0,4))>=1900 && Number(value.slice(0,4))<=2100 && Number.isFinite(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
}
export function noticeDate(value: string,weekday=false): string {
  if(!validDate(value))return '[data]';
  const date=new Date(value+'T12:00:00Z');
  const label=new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date);
  return weekday ? `${label}, ${new Intl.DateTimeFormat('pt-BR',{weekday:'long',timeZone:'UTC'}).format(date)}` : label;
}
export function noticeParagraphs(notice: NoticeInput): NoticeParagraph[] {
  const paragraphs: NoticeParagraph[]=[];
  const add=(text:string,kind:NoticeParagraph['kind'])=>paragraphs.push({text,kind});
  add(clean(notice.churchName)||'[igreja]','heading');
  add(clean(notice.societyName)||'[sociedade]','heading');
  add('CONVOCAÇÃO','title');
  add(`${clean(notice.issueCity)||'[cidade e UF]'}, ${noticeDate(notice.issueDate)}.`,'date');
  const society=clean(notice.societyName)||'[sociedade]';
  const audience=notice.meetingType==='plenary' ? `todos os sócios da ${society} da ${clean(notice.churchName)||'[igreja]'}` : notice.meetingType==='executive' ? 'os membros da Comissão Executiva (CE)' : 'os membros da diretoria';
  const time=clean(notice.timeDescription);
  const hour=/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? `às ${time.replace(':','h')}` : time ? time.charAt(0).toLocaleLowerCase('pt-BR')+time.slice(1) : '[horário]';
  const agenda=notice.agenda.split(/\r?\n/).map(line=>clean(line)).filter(Boolean);
  add(`A ${society}, por meio de seu presidente, ${clean(notice.presidentName)||'[presidente]'}, ${clean(notice.legalBasis)?`conforme ${clean(notice.legalBasis)}, `:''}convoca ${audience} para a ${clean(notice.meetingPurpose)||'[reunião]'} a ser realizada no dia ${noticeDate(notice.meetingDate,true)}, ${hour}, ${clean(notice.meetingLocation)||'[local da reunião]'}, no endereço ${clean(notice.address)||'[endereço completo]'}${agenda.length?', para tratar da seguinte pauta:':'.'}`,'body');
  agenda.forEach((item,index)=>add(`${index+1}. ${item}`,'agenda'));
  add('Atenciosamente,','closing');
  add(clean(notice.presidentName)||'[presidente]','signature');
  add(clean(notice.presidentRole)||'Presidente','signature');
  add(clean(notice.secretaryName)||'[secretário]','signature');
  add(clean(notice.secretaryRole)||'1º Secretário','signature');
  return paragraphs;
}
export function normalizeNotice(input: NoticeInput): NoticeInput {
  return Object.fromEntries(Object.keys(emptyNotice()).map(key=>[key,key==='agenda'?input.agenda.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).join('\n'):clean(input[key as keyof NoticeInput])])) as unknown as NoticeInput;
}
export function validateNotice(notice: NoticeInput): Record<string,string> {
  const errors: Record<string,string>={};
  if(!NOTICE_TYPES.some(type=>type.value===notice.meetingType))errors['meetingType']='Escolha o tipo de reunião.';
  for(const key of ['churchName','societyName','issueCity','timeDescription','meetingPurpose','meetingLocation','address','presidentName','secretaryName','presidentRole','secretaryRole'] as const)if(!clean(notice[key]))errors[key]='Preencha este campo.';
  for(const key of ['issueDate','meetingDate'] as const)if(!validDate(notice[key]))errors[key]='Informe uma data válida.';
  if(!errors['issueDate']&&!errors['meetingDate']&&notice.issueDate>notice.meetingDate)errors['meetingDate']='A reunião deve ocorrer na data de emissão ou depois dela.';
  const limits={churchName:160,societyName:240,issueCity:160,timeDescription:160,meetingPurpose:160,meetingLocation:240,address:500,legalBasis:1000,agenda:10000,presidentName:240,secretaryName:240,presidentRole:160,secretaryRole:160};
  for(const [key,max] of Object.entries(limits))if(notice[key as keyof typeof limits].length>max)errors[key]=`Use até ${max} caracteres.`;
  if(notice.agenda.split(/\r?\n/).filter(line=>line.trim()).length>50)errors['agenda']='Informe até 50 itens de pauta.';
  return errors;
}
