import { STATES, type BirthdayEvent, type Member, type MemberInput } from './models.js';

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });
export function emptyMember(): MemberInput {
  return { name:'', birthDate:null, receivedDate:null, office:'', address:{postalCode:'',street:'',number:'',complement:'',neighborhood:'',city:'',state:''}, phone:'',email:'',status:'active',notes:'' };
}
export function todayISO(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone:'America/Araguaina', year:'numeric', month:'2-digit',day:'2-digit' }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year,month,day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31,leap ? 29:28,31,30,31,30,31,31,30,31,30,31][month-1];
}
export function normalizeMember(input: MemberInput): MemberInput {
  return { name:input.name.trim(), birthDate:input.birthDate?.trim() || null, receivedDate:input.receivedDate?.trim() || null,
    office:input.office.trim(), phone:input.phone.replace(/\D/g,''), email:input.email.trim(), notes:input.notes.trim(), status:input.status,
    address:{postalCode:input.address.postalCode.replace(/\D/g,''),street:input.address.street.trim(),number:input.address.number.trim(),complement:input.address.complement.trim(),neighborhood:input.address.neighborhood.trim(),city:input.address.city.trim(),state:input.address.state.trim().toUpperCase()}
  };
}
export function validateMember(input: MemberInput, today = todayISO()): Record<string,string> {
  const value = normalizeMember(input);
  const errors: Record<string,string> = {};
  if (value.name.length < 2 || value.name.length > 120) errors['name'] = 'Informe o nome com 2 a 120 caracteres.';
  for (const field of ['birthDate','receivedDate'] as const) {
    const date = value[field];
    if (date && !validDate(date)) errors[field] = 'Informe uma data válida com dia, mês e ano.';
    else if (date && date > today) errors[field] = 'A data não pode estar no futuro.';
  }
  if (value.birthDate && value.receivedDate && validDate(value.birthDate) && validDate(value.receivedDate) && value.receivedDate < value.birthDate) errors['receivedDate'] = 'O recebimento não pode ser anterior ao nascimento.';
  if (input.phone && !/^[\d\s()+.\-]+$/.test(input.phone)) errors['phone'] = 'Informe um telefone com DDD e 10 ou 11 dígitos.';
  else if (value.phone && !/^\d{10,11}$/.test(value.phone)) errors['phone'] = 'Informe um telefone com DDD e 10 ou 11 dígitos.';
  if (value.email && (value.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))) errors['email'] = 'Confira o e-mail. Exemplo: nome@dominio.com.br.';
  if (input.address.postalCode && !/^[\d\s.\-]+$/.test(input.address.postalCode)) errors['address.postalCode'] = 'Informe os 8 dígitos do CEP.';
  else if (value.address.postalCode && !/^\d{8}$/.test(value.address.postalCode)) errors['address.postalCode'] = 'Informe os 8 dígitos do CEP.';
  if (value.address.state && !(STATES as readonly string[]).includes(value.address.state)) errors['address.state'] = 'Selecione uma UF válida.';
  for (const [field, limit] of [['office',100],['notes',2000]] as const) {
    if (value[field].length > limit) errors[field] = `Use até ${limit} caracteres.`;
  }
  const limits = {street:160,number:20,complement:100,neighborhood:100,city:100};
  for (const field of Object.keys(limits) as (keyof typeof limits)[]) {
    if (value.address[field].length > limits[field]) errors['address.' + field] = `Use até ${limits[field]} caracteres.`;
  }
  if (!['active','inactive'].includes(value.status)) errors['status'] = 'Selecione um status válido.';
  return errors;
}
export function normalizedSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
}
export function filterMembers(members: readonly Member[], search: string, status: 'all'|'active'|'inactive'): Member[] {
  const term = normalizedSearch(search);
  return members.filter(m => (status === 'all' || m.status === status) && normalizedSearch(m.name).includes(term)).sort((a,b) => collator.compare(a.name,b.name) || a.id.localeCompare(b.id));
}
export function summarize(members: readonly Member[]): {total:number;active:number;inactive:number} {
  const active = members.filter(m => m.status === 'active').length;
  return {total:members.length,active,inactive:members.length-active};
}
export function displayDate(value: string | null): string {
  if (!value || !validDate(value)) return '—';
  return value.split('-').reverse().join('/');
}
// UTC is used only as a neutral calendar for arithmetic. Input days use Araguaina.
function calendar(value: string): Date { const date = new Date(0); const [y,m,d] = value.split('-').map(Number); date.setUTCHours(0,0,0,0); date.setUTCFullYear(y,m-1,d); return date; }
function occurrence(member: Member, year: number, today: string): BirthdayEvent {
  const source = member.birthDate!;
  const feb29 = source.slice(5) === '02-29';
  const adapted = feb29 && !validDate(`${year}-02-29`);
  const date = String(year).padStart(4,'0') + '-' + (adapted ? '02-28' : source.slice(5));
  return {member,date,adapted,daysAway:Math.round((calendar(date).getTime()-calendar(today).getTime())/86400000)};
}
export function birthdayEvents(members: readonly Member[], today = todayISO()): {month:BirthdayEvent[];upcoming:BirthdayEvent[];next:BirthdayEvent|null} {
  if (!validDate(today)) throw new Error('Dia de referência inválido.');
  const year = Number(today.slice(0,4));
  const active = members.filter(m => m.status === 'active' && m.birthDate && validDate(m.birthDate) && m.birthDate <= today);
  const sort = (a:BirthdayEvent,b:BirthdayEvent):number => a.date.localeCompare(b.date) || collator.compare(a.member.name,b.member.name) || a.member.id.localeCompare(b.member.id);
  const month = active.map(m => occurrence(m,year,today)).filter(e => e.date.slice(5,7) === today.slice(5,7)).sort(sort);
  const future = active.map(m => { const event = occurrence(m,year,today); return event.date < today ? occurrence(m,year+1,today) : event; }).sort(sort);
  return {month,upcoming:future.filter(e => e.daysAway >= 0 && e.daysAway < 30),next:future[0] ?? null};
}
export const EXPORT_HEADERS = ['Nome','Nascimento','Recebimento','Ofício','Telefone','E-mail','Status','CEP','Logradouro','Número','Complemento','Bairro','Cidade','UF'];
export function exportRows(members: readonly Member[]): string[][] {
  return members.map(m => [m.name,m.birthDate ? displayDate(m.birthDate):'',m.receivedDate ? displayDate(m.receivedDate):'',m.office,m.phone,m.email,m.status === 'active' ? 'Ativo':'Inativo',m.address.postalCode,m.address.street,m.address.number,m.address.complement,m.address.neighborhood,m.address.city,m.address.state]);
}
