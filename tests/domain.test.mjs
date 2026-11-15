import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  emptyMember, normalizeMember, validateMember, validDate, todayISO, displayDate,
  filterMembers, summarize, birthdayEvents, exportRows, EXPORT_HEADERS,
} from '../.test-dist/domain.js';

const member = (id, name, values = {}) => ({ ...emptyMember(), id, name, ...values });
const ids = values => values.map(value => value.id);

test('calendar validates actual dates, leap centuries and civil formatting', () => {
  for (const value of ['2000-02-29','2024-02-29','2026-04-30','0001-01-01']) assert.equal(validDate(value), true, value);
  for (const value of ['1900-02-29','2026-02-29','2026-04-31','2026-00-10','2026-13-10','2026-01-00','0000-01-01','26-01-01','2026-1-01','not-a-date']) assert.equal(validDate(value), false, value);
  assert.equal(displayDate('2000-02-29'), '29/02/2000');
  assert.equal(displayDate(null), '—');
  assert.equal(displayDate('2026-02-30'), '—');
});

test('today uses America/Araguaina independently of host timezone', () => {
  assert.equal(todayISO(new Date('2026-01-01T02:59:59.999Z')), '2025-12-31');
  assert.equal(todayISO(new Date('2026-01-01T03:00:00.000Z')), '2026-01-01');
});

test('minimal member is valid, independent and initially active', () => {
  const first = emptyMember();
  assert.equal(first.status, 'active');
  assert.equal(first.birthDate, null);
  assert.ok(validateMember(first, '2026-11-15').name);
  first.name = 'Ana';
  assert.deepEqual(validateMember(first, '2026-11-15'), {});
  first.address.city = 'Palmas';
  assert.equal(emptyMember().address.city, '');
});

test('normalization trims but preserves names and converts contact to canonical values', () => {
  const input = member('1','  José da Conceição  ', { birthDate:'', receivedDate:' ', phone:'(63) 99999-1234', email:' ana@example.com ', notes:' observação ', office:' Diácono ' });
  input.address = {postalCode:'77000-000',street:' Rua A ',number:' s/n ',complement:' ',neighborhood:' Centro ',city:' Palmas ',state:' to '};
  const normalized = normalizeMember(input);
  assert.equal(normalized.name, 'José da Conceição');
  assert.equal(normalized.phone, '63999991234');
  assert.equal(normalized.email, 'ana@example.com');
  assert.equal(normalized.birthDate, null);
  assert.equal(normalized.receivedDate, null);
  assert.equal(normalized.address.postalCode, '77000000');
  assert.equal(normalized.address.state, 'TO');
  assert.equal(normalized.address.number, 's/n');
  assert.equal('id' in normalized, false);
  assert.equal(input.name, '  José da Conceição  ');
});

test('member validation accepts today and rejects future, invalid calendar and inverted receipt', () => {
  assert.deepEqual(validateMember(member('1','Ana',{birthDate:'2026-11-15',receivedDate:'2026-11-15'}),'2026-11-15'), {});
  assert.ok(validateMember(member('1','Ana',{birthDate:'2026-11-16'}),'2026-11-15').birthDate);
  assert.ok(validateMember(member('1','Ana',{receivedDate:'2026-11-16'}),'2026-11-15').receivedDate);
  assert.ok(validateMember(member('1','Ana',{birthDate:'1900-02-29'}),'2026-11-15').birthDate);
  assert.ok(validateMember(member('1','Ana',{birthDate:'2000-02-29',receivedDate:'1999-12-31'}),'2026-11-15').receivedDate);
  assert.deepEqual(validateMember(member('1','Ana',{birthDate:'2000-02-29',receivedDate:'2000-02-29'}),'2026-11-15'), {});
});

test('member validates limits, status, contact and partial address', () => {
  const input = member('1','A',{office:'x'.repeat(101),notes:'x'.repeat(2001),phone:'abc63999991234',email:'sem-arroba',status:'deleted'});
  input.address = {...input.address,postalCode:'12',state:'XX',street:'x'.repeat(161),number:'x'.repeat(21),complement:'x'.repeat(101),neighborhood:'x'.repeat(101),city:'x'.repeat(101)};
  const errors = validateMember(input,'2026-11-15');
  for (const key of ['name','office','notes','phone','email','status','address.postalCode','address.state','address.street','address.number','address.complement','address.neighborhood','address.city']) assert.ok(errors[key], key);
  const valid = member('1','x'.repeat(120),{office:'x'.repeat(100),notes:'x'.repeat(2000),phone:'(63) 3333-4444',email:'ana+sociedade@example.com'});
  valid.address.city='Palmas';
  assert.deepEqual(validateMember(valid,'2026-11-15'), {});
  assert.ok(validateMember({...valid,name:'x'.repeat(121)},'2026-11-15').name);
  assert.ok(validateMember({...valid,phone:'123'},'2026-11-15').phone);
  valid.address.postalCode='abc77000000';
  assert.ok(validateMember(valid,'2026-11-15')['address.postalCode']);
});

test('search combines normalized substring and status, sorts without mutating input', () => {
  const source = [member('3','Zélia'),member('2','José Ávila'),member('1','Ana'),member('4','JOSE SILVA',{status:'inactive'})];
  assert.deepEqual(ids(filterMembers(source,'  JOSE  ','all')), ['2','4']);
  assert.deepEqual(ids(filterMembers(source,'avI','active')), ['2']);
  assert.deepEqual(ids(filterMembers(source,'jose','inactive')), ['4']);
  assert.deepEqual(ids(filterMembers(source,'','active')), ['1','2','3']);
  assert.deepEqual(ids(filterMembers(source,'inexistente','all')), []);
  assert.deepEqual(ids(source), ['3','2','1','4']);
  assert.deepEqual(summarize(source), {total:4,active:3,inactive:1});
  assert.deepEqual(summarize([]), {total:0,active:0,inactive:0});
});

test('birthday month includes past dates while upcoming includes today and +29 but not +30', () => {
  const source = [
    member('past','Passado',{birthDate:'1980-11-01'}),
    member('today','Hoje',{birthDate:'1980-11-15'}),
    member('29','Limite',{birthDate:'1980-12-14'}),
    member('30','Fora',{birthDate:'1980-12-15'}),
    member('inactive','Inativo',{birthDate:'1980-11-16',status:'inactive'}),
    member('missing','Sem data'),
  ];
  const events = birthdayEvents(source,'2026-11-15');
  assert.deepEqual(events.month.map(e => e.member.id), ['past','today']);
  assert.deepEqual(events.upcoming.map(e => e.member.id), ['today','29']);
  assert.deepEqual(events.upcoming.map(e => e.daysAway), [0,29]);
  assert.equal(events.next.member.id, 'today');
  assert.equal(events.next.date, '2026-11-15');
});

test('birthdays cross year and preserve same-day ties sorted by Portuguese name', () => {
  const source = [member('j','José',{birthDate:'1980-01-01'}),member('a','Ana',{birthDate:'1980-01-01'}),member('d','Dezembro',{birthDate:'1980-12-31'})];
  const events = birthdayEvents(source,'2026-12-31');
  assert.deepEqual(events.upcoming.map(e => e.member.id), ['d','a','j']);
  assert.deepEqual(events.upcoming.map(e => e.date), ['2026-12-31','2027-01-01','2027-01-01']);
  assert.deepEqual(events.upcoming.map(e => e.daysAway), [0,1,1]);
  assert.deepEqual(birthdayEvents(source,'2027-01-02').upcoming, []);
  assert.equal(birthdayEvents(source,'2027-01-02').next.member.id, 'd');
});

test('February 29 birthday adapts only in common years, with next occurrence after February', () => {
  const source=[member('leap','Lia',{birthDate:'2000-02-29'})];
  const common=birthdayEvents(source,'2026-02-01');
  assert.equal(common.month[0].date,'2026-02-28');
  assert.equal(common.month[0].adapted,true);
  assert.equal(common.upcoming[0].daysAway,27);
  const leap=birthdayEvents(source,'2028-02-28');
  assert.equal(leap.next.date,'2028-02-29');
  assert.equal(leap.next.daysAway,1);
  assert.equal(leap.next.adapted,false);
  assert.equal(birthdayEvents(source,'2027-03-01').next.date,'2028-02-29');
});

test('birthday empty, invalid and future source dates do not create candidates', () => {
  assert.deepEqual(birthdayEvents([],'2026-11-15'), {month:[],upcoming:[],next:null});
  assert.equal(birthdayEvents([member('1','Inválida',{birthDate:'1900-02-29'}),member('2','Futura',{birthDate:'2027-01-01'})],'2026-11-15').next, null);
  assert.throws(() => birthdayEvents([],'2026-02-30'),/referência/);
});

test('export preserves civil dates, accents, address and formula-like text, excludes notes', () => {
  const input=member('1','=José Ávila',{birthDate:'2000-02-29',receivedDate:null,office:'+Diácono',notes:'NÃO EXPORTAR',status:'inactive'});
  input.address = {...input.address,street:'@Rua A',number:'-10',city:'Palmas',state:'TO'};
  const rows=exportRows([input]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].length,EXPORT_HEADERS.length);
  assert.deepEqual(rows[0].slice(0,7),['=José Ávila','29/02/2000','','+Diácono','','','Inativo']);
  assert.equal(rows[0][8],'@Rua A');
  assert.equal(rows[0][9],'-10');
  assert.equal(rows.flat().includes('NÃO EXPORTAR'),false);
  assert.deepEqual(exportRows([]),[]);
});

test('1,000 members remain consistent across search, summary, birthdays and export', () => {
  const source=Array.from({length:1000},(_,index) => member(String(index),`Membro ${String(index).padStart(4,'0')}`,{birthDate:'1980-11-15',status:index%5===0 ? 'inactive':'active'}));
  const start=performance.now();
  const filtered=filterMembers(source,'membro','all');
  assert.equal(filtered.length,1000);
  assert.equal(exportRows(filtered).length,1000);
  assert.deepEqual(summarize(source),{total:1000,active:800,inactive:200});
  assert.equal(birthdayEvents(source,'2026-11-15').upcoming.length,800);
  assert.ok(performance.now()-start<10000,'functional capacity test exceeded 10s');
});
