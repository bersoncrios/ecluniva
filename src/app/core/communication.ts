import type { MemberInput, SocietyType } from './models.js';
import { todayISO, validDate } from './domain.js';

export interface SharedBirthday { name:string; month:number; day:number; active:boolean; }
export interface BirthdayContact extends SharedBirthday { id:string; }
export interface CommunicationEvent { person:BirthdayContact; date:string; daysAway:number; adapted:boolean; }
export type PublicationStatus='pending'|'prepared'|'published';
export interface BirthdayPublication { id:string; memberId:string; date:string; status:PublicationStatus; revision:number; updatedBy:string; }
export interface CommunicationInvite { id:string; societyId:string; ownerId:string; email:string; societyName:string; churchName:string; societyType:SocietyType; status:'pending'|'accepted'|'revoked'; acceptedBy:string; }
export interface CardIdentity { primaryColor:string; accentColor:string; logoDataUrl:string; messageTemplate:string; }
export const DEFAULT_IDENTITY:CardIdentity={primaryColor:'#145443',accentColor:'#d5b46b',logoDataUrl:'',messageTemplate:'Feliz aniversário, {nome}! Que Deus abençoe sua vida com saúde, alegria e paz. Receba o carinho da {sociedade}!'};
export function sharedBirthday(member:Pick<MemberInput,'name'|'birthDate'|'status'>):SharedBirthday{
  return {name:member.name,month:member.birthDate?Number(member.birthDate.slice(5,7)):0,day:member.birthDate?Number(member.birthDate.slice(8,10)):0,active:member.status==='active'&&!!member.birthDate};
}
export function communicationEvents(people:readonly BirthdayContact[],today=todayISO()):{month:CommunicationEvent[];upcoming:CommunicationEvent[]}{
  if(!validDate(today))throw new Error('Data de referência inválida.');
  const year=Number(today.slice(0,4));
  const occurrence=(person:BirthdayContact,year:number):CommunicationEvent=>{
    const source=`${year}-${String(person.month).padStart(2,'0')}-${String(person.day).padStart(2,'0')}`;
    const adapted=person.month===2&&person.day===29&&!validDate(source);
    const date=adapted?`${year}-02-28`:source;
    return {person,date,adapted,daysAway:Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000)};
  };
  const active=people.filter(person=>person.active&&validDate(`2000-${String(person.month).padStart(2,'0')}-${String(person.day).padStart(2,'0')}`));
  const sort=(a:CommunicationEvent,b:CommunicationEvent)=>a.date.localeCompare(b.date)||a.person.name.localeCompare(b.person.name,'pt-BR')||a.person.id.localeCompare(b.person.id);
  return {month:active.map(person=>occurrence(person,year)).filter(event=>event.date.slice(5,7)===today.slice(5,7)).sort(sort),upcoming:active.map(person=>{const event=occurrence(person,year);return event.date<today?occurrence(person,year+1):event;}).filter(event=>event.daysAway>=0&&event.daysAway<30).sort(sort)};
}
export function inviteEmail(value:string):string{return value.trim().toLowerCase();}
export function validInviteEmail(value:string):boolean{return value.length<=254&&/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(value);}
export function publicationId(memberId:string,date:string):string{return `${memberId}_${date}`;}
export function birthdayMessage(template:string,name:string,society:string,date:string):string{
  return template.replace(/\{(nome|sociedade|data)\}/g,(_,key:string)=>({nome:name,sociedade:society,data:date.split('-').slice(1).reverse().join('/')}[key]!));
}
export function validIdentity(identity:CardIdentity):boolean{
  return /^#[0-9a-f]{6}$/i.test(identity.primaryColor)&&/^#[0-9a-f]{6}$/i.test(identity.accentColor)&&identity.messageTemplate.trim().length>=10&&identity.messageTemplate.length<=1000&&identity.logoDataUrl.length<=250000&&(!identity.logoDataUrl||/^data:image\/(png|jpeg);base64,[a-z0-9+/=]+$/i.test(identity.logoDataUrl));
}
