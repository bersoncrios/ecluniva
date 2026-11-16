import type { BoardAssignment, Member } from './models.js';

export type MinuteStatus = 'scheduled' | 'in_progress' | 'concluded';
export interface AttendanceSnapshot { memberId: string; name: string; role: string; }
export interface MinuteInput {
  number: number; year: number; type: string; date: string; timeZone: string;
  startTime: string; endTime: string; churchName: string; societyName: string;
  meetingLocation: string; templeAddress: string; logoDataUrl: string; convocation: string;
  scripture: string; preacher: string; openingPrayer: string; devotionalTime: string;
  deliberations: string; newMembers: string; hymn: string; closingPrayer: string;
  presidentId: string; secretaryId: string; attendance: AttendanceSnapshot[];
  status: MinuteStatus;
}
export interface Minute extends MinuteInput { id: string; revision: number; }
export interface MinuteSegment { text: string; bold?: boolean; }

export function civilDate(now = new Date(), timeZone = 'America/Araguaina'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone, year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  return ['year','month','day'].map(key => parts.find(part => part.type === key)!.value).join('-');
}
/** Attendance is available only on the meeting's civil day, never retrospectively. */
export function attendanceAvailable(minute: Pick<MinuteInput,'date'|'timeZone'|'status'>, now = new Date()): boolean {
  return minute.status !== 'concluded' && minute.date === civilDate(now, minute.timeZone);
}
export function minuteStatus(minute: Pick<MinuteInput,'date'|'timeZone'|'status'>, now = new Date()): MinuteStatus {
  if (minute.status === 'concluded') return 'concluded';
  return minute.date <= civilDate(now, minute.timeZone) ? 'in_progress' : 'scheduled';
}
export function snapshotAttendance(members: readonly Member[], assignments: readonly BoardAssignment[], ids: readonly string[], year: number): AttendanceSnapshot[] {
  const selected = new Set(ids);
  return members.filter(member => member.status === 'active' && selected.has(member.id)).map(member => ({
    memberId:member.id, name:member.name,
    role:assignments.filter(assignment => assignment.year === year && assignment.memberId === member.id).map(assignment => assignment.role).join(', ')
  })).sort((a,b) => a.name.localeCompare(b.name,'pt-BR'));
}
export function suggestedOfficers(attendance: readonly AttendanceSnapshot[]): {presidentId:string; secretaryId:string} {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return {
    presidentId:attendance.find(person => normalize(person.role) === 'presidente')?.memberId ?? '',
    secretaryId:attendance.find(person => /^(1[ºo°]?\s*)?secretari[oa]$/.test(normalize(person.role)))?.memberId ?? ''
  };
}
export function emptyMinute(date = civilDate()): MinuteInput {
  return {number:1,year:Number(date.slice(0,4)),type:'Ordinária',date,timeZone:'America/Araguaina',startTime:'',endTime:'',churchName:'',societyName:'',meetingLocation:'',templeAddress:'',logoDataUrl:'',convocation:'',scripture:'',preacher:'',openingPrayer:'',devotionalTime:'',deliberations:'',newMembers:'',hymn:'',closingPrayer:'',presidentId:'',secretaryId:'',attendance:[],status:'scheduled'};
}
const prose = (value: string): string => value.trim().replace(/\s+/g,' ');
const sentence = (value: string): string => { const text = prose(value); return text && /[.!?]$/.test(text) ? text : text + '.'; };
export function minuteSegments(minute: MinuteInput): MinuteSegment[] {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(minute.date) ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'long',timeZone:'UTC'}).format(new Date(minute.date+'T12:00:00Z')) : '[data]';
  const name = (id: string, fallback: string) => minute.attendance.find(person => person.memberId === id)?.name || fallback;
  const segments: MinuteSegment[] = [];
  const add = (text: string, bold = false) => segments.push({text,bold});
  add(`ATA Nº ${String(minute.number).padStart(3,'0')}`,true);
  add(`. Aos ${date}, às `); add(minute.startTime || '[horário inicial]',true);
  add(`, reuniu-se em plenária ${prose(minute.type).toLowerCase()} a `); add(prose(minute.societyName) || '[sociedade]',true);
  const location = prose(minute.meetingLocation || '');
  const feminine = /^(casa|residência|igreja|sede|chácara|congregação)\b/i.test(location);
  const masculine = /^(templo|salão|auditório)\b/i.test(location);
  const withPreposition = /^(na|no|nas|nos|em|ao|aos|à|às)\s/i.test(location);
  const place = withPreposition ? location.charAt(0).toLocaleLowerCase('pt-BR') + location.slice(1) : feminine || masculine ? `${feminine ? 'na' : 'no'} ${location.charAt(0).toLocaleLowerCase('pt-BR') + location.slice(1)}` : `em ${location || '[local da reunião]'}`;
  const venue = minute.status === 'concluded' && !location ? 'no templo situado à' : `${place}, no endereço`;
  add(`, da ${prose(minute.churchName) || '[igreja]'}, ${venue} ${prose(minute.templeAddress) || '[endereço completo]'}. `);
  add(['primeira','segunda'].includes(minute.convocation) ? `Em ${minute.convocation} chamada, ` : minute.status === 'concluded' && minute.convocation ? sentence(minute.convocation)+' ' : 'Em [chamada]. ');
  add(['primeira','segunda'].includes(minute.convocation) ? 'sob a presidência de ' : 'Sob a presidência de '); add(name(minute.presidentId,'[presidente da sessão]'),true);
  add(', com a presença de '); add(`${minute.attendance.length} sócios`,true);
  add(minute.attendance.length ? `: ${minute.attendance.map(person => `${person.name}${person.role ? ` (${person.role})` : ''}`).join('; ')}. ` : '. ');
  add(`O momento devocional teve início às ${minute.devotionalTime || '[horário devocional]'}, com oração inicial por ${prose(minute.openingPrayer) || '[responsável]'}, leitura de ${prose(minute.scripture) || '[passagem bíblica]'} e exposição por ${prose(minute.preacher) || '[pregador]'}. `);
  if (prose(minute.newMembers)) add(`Foram recebidos os seguintes novos sócios: ${sentence(minute.newMembers)} `);
  add(sentence(minute.deliberations || '[deliberações]')+' ');
  add(`Foi entoado o hino oficial ${prose(minute.hymn) || '[hino]'}. Não havendo mais nada para ser tratado, encerrou-se a presente às `);
  add(minute.endTime ? minute.endTime.replace(':','h') + 'min' : '[horário final]',true);
  const prayer = prose(minute.closingPrayer) || '[responsável]';
  const prayerTitle = /^irmã\s/i.test(prayer) ? `pela ${prayer}` : `pelo ${/^irmão\s/i.test(prayer) ? prayer : 'Irmão ' + prayer}`;
  add(` com uma oração ${prayerTitle}. E eu `);
  add(name(minute.secretaryId,'[secretário redator]'),true);
  const society = /^UPH(?:\s|$)/i.test(prose(minute.societyName)) ? 'União Presbiteriana de Homens' : prose(minute.societyName) || '[sociedade]';
  add(`, Secretário da ${society} da ${prose(minute.churchName) || '[igreja]'}, a tudo presente, lavrei e após lida e aprovada, assino a presente ata.`);
  return segments;
}
export function minuteText(minute: MinuteInput): string { return minuteSegments(minute).map(segment => segment.text).join(''); }
export function validateMinute(minute: MinuteInput, concluding = false): Record<string,string> {
  const errors: Record<string,string> = {};
  if (!Number.isInteger(minute.number) || minute.number < 1) errors['number']='Informe um número inteiro positivo.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(minute.date) || !Number.isFinite(Date.parse(minute.date+'T12:00:00Z')) || new Date(minute.date+'T12:00:00Z').toISOString().slice(0,10) !== minute.date) errors['date']='Informe uma data civil válida.';
  if (minute.year !== Number(minute.date.slice(0,4))) errors['year']='O ano deve corresponder à data da plenária.';
  try { civilDate(new Date(),minute.timeZone); } catch { errors['timeZone']='Fuso horário inválido.'; }
  for (const key of ['type','churchName','societyName','templeAddress'] as const) if (!prose(minute[key])) errors[key]='Preencha este campo.';
  if (!prose(minute.meetingLocation || '') || minute.meetingLocation.length > 160) errors['meetingLocation']='Informe o local da reunião com até 160 caracteres.';
  if (new Set(minute.attendance.map(person=>person.memberId)).size !== minute.attendance.length) errors['attendance']='Há presenças duplicadas.';
  if (minute.attendance.length > 500) errors['attendance']='A ata admite até 500 sócios presentes.';
  if (concluding) {
    if (!['primeira','segunda'].includes(minute.convocation)) errors['convocation']='Selecione primeira ou segunda chamada.';
    for (const key of ['startTime','endTime','devotionalTime'] as const) if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(minute[key])) errors[key]='Informe um horário válido.';
    if (!errors['startTime'] && !errors['endTime'] && minute.endTime < minute.startTime) errors['endTime']='O encerramento deve ocorrer após a abertura, na mesma data civil.';
    if (!errors['startTime'] && !errors['devotionalTime'] && !errors['endTime'] && (minute.devotionalTime < minute.startTime || minute.devotionalTime > minute.endTime)) errors['devotionalTime']='O devocional deve ocorrer entre a abertura e o encerramento.';
    for (const key of ['scripture','preacher','openingPrayer','deliberations','hymn','closingPrayer'] as const) if (!prose(minute[key])) errors[key]='Preencha este campo antes de lavrar.';
    for (const key of ['presidentId','secretaryId'] as const) if (!minute.attendance.some(person => person.memberId === minute[key])) errors[key]='Escolha um membro presente.';
    if (minute.presidentId && minute.presidentId === minute.secretaryId) errors['secretaryId']='Presidente e secretário devem ser pessoas distintas.';
    if (!minute.attendance.length) errors['attendance']='Registre os presentes antes de lavrar.';
  }
  return errors;
}
