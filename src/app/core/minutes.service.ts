import { Injectable, Injector, effect, inject, runInInjectionContext, signal } from '@angular/core';
import { Firestore, Timestamp, collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where, type Transaction, type Unsubscribe } from '@angular/fire/firestore';
import { DataService } from './data.service';
import { sharedBirthday } from './communication';
import { emptyMember } from './domain';
import { attendanceAvailable, civilDate, minuteText, validateMinute, validMinuteDeletion, type AttendanceSnapshot, type Minute, type MinuteInput } from './minutes';

const ZONES: Record<string, number> = {'America/Araguaina':3,'America/Sao_Paulo':3,'America/Recife':3,'America/Fortaleza':3,'America/Bahia':3,'America/Belem':3,'America/Noronha':2,'America/Manaus':4,'America/Rio_Branco':5};
@Injectable({providedIn:'root'})
export class MinutesService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);
  private readonly data = inject(DataService);
  readonly minutes = signal<Minute[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  private readonly nextNumbers = signal<Record<number,number>>({});
  nextNumber(year: number): number { return this.nextNumbers()[year] ?? 1; }
  private unsubscribe?: Unsubscribe;
  private context = '';
  private readonly reload = signal(0);
  retry(): void { this.reload.update(value=>value+1); }
  constructor() {
    effect(onCleanup => {
      this.reload();
      const society = this.data.selected();
      const uid = this.data.user()?.uid;
      this.unsubscribe?.(); this.minutes.set([]); this.nextNumbers.set({}); this.error.set(''); this.loading.set(false);
      this.context = `${uid ?? ''}/${society?.id ?? ''}`;
      if (!society || society.ownerId !== uid) return;
      const context = this.context;
      this.loading.set(true);
      this.unsubscribe = runInInjectionContext(this.injector, () => onSnapshot(collection(this.firestore,`societies/${society.id}/minutes`), snapshot => {
        if (context !== this.context) return;
        const items=snapshot.docs.map(item => ({meetingLocation:'',...item.data(),id:item.id}) as Minute);
        const used:Record<number,Set<number>>={};
        for(const item of items)if(!item.deletedAt){(used[item.year]??=new Set()).add(item.number);}
        const numbers:Record<number,number>={};
        for(const year of new Set(items.map(item=>item.year))){let number=1;while(used[year]?.has(number))number++;numbers[year]=number;}
        this.nextNumbers.set(numbers);
        this.minutes.set(items.filter(item=>!item.deletedAt).sort((a,b)=>b.date.localeCompare(a.date)||b.number-a.number));
        this.loading.set(false);
      }, () => { if (context === this.context) { this.loading.set(false); this.error.set('Não foi possível carregar as atas.'); } }));
      onCleanup(() => this.unsubscribe?.());
    });
  }
  private society(): string {
    const society = this.data.selected();
    if (!society || society.ownerId !== this.data.user()?.uid) throw new Error('Sociedade indisponível.');
    return society.id;
  }
  private assertContext(context: string): void {
    if (context !== `${this.data.user()?.uid ?? ''}/${this.data.selected()?.id ?? ''}`) throw new Error('A sociedade ou a sessão foi alterada.');
  }
  async schedule(input: MinuteInput): Promise<string> {
    const societyId = this.society(); const context = this.context;
    const errors = validateMinute(input);
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    if (!(input.timeZone in ZONES)) throw new Error('Escolha um dos fusos brasileiros disponíveis.');
    if (input.date < civilDate(new Date(), input.timeZone)) throw new Error('Agende a plenária para hoje ou uma data futura.');
    return runInInjectionContext(this.injector, () => runTransaction(this.firestore, async transaction => {
      this.assertContext(context);
      const number = input.number;
      const numberId = `${input.year}_${number}`;
      const numberRef = doc(this.firestore,`societies/${societyId}/minuteNumbers/${numberId}`);
      const matching = await transaction.get(query(collection(this.firestore,`societies/${societyId}/minutes`),where('year','==',input.year),where('number','==',number)));
      const reservation = await transaction.get(numberRef);
      const staleReservation=reservation.exists()&&matching.docs.some(item=>item.id===reservation.data()['minuteId']&&!!item.data()['deletedAt']);
      if((reservation.exists()&&!staleReservation)||matching.docs.some(item=>!item.data()['deletedAt']))throw new Error('Já existe uma ata ativa com este número neste ano.');
      const baseId = `${input.year}_${number}`;
      const baseRef = doc(this.firestore,`societies/${societyId}/minutes/${baseId}`);
      const base = matching.docs.find(item=>item.id===baseId);
      const id = base ? doc(collection(this.firestore,`societies/${societyId}/minutes`)).id : baseId;
      const ref = doc(this.firestore,`societies/${societyId}/minutes/${id}`);
      if(base && !base.data()['deletedAt'])throw new Error('Já existe uma ata ativa com este número neste ano.');
      if(!base && (await transaction.get(baseRef)).exists())throw new Error('Não foi possível reservar este número. Atualize a lista e tente novamente.');
      this.assertContext(context);
      const dayStart = Timestamp.fromDate(new Date(`${input.date}T${String(ZONES[input.timeZone]).padStart(2,'0')}:00:00.000Z`));
      transaction.set(numberRef,{year:input.year,number,minuteId:id,updatedAt:serverTimestamp()});
      transaction.set(ref,{...input,number,status:'scheduled',attendance:[],presidentId:'',secretaryId:'',revision:0,dayStart,dayEnd:Timestamp.fromMillis(dayStart.toMillis()+86400000),createdAt:serverTimestamp(),updatedAt:serverTimestamp(),concludedAt:null,finalText:''});
      return id;
    }));
  }
  async save(minute: Minute): Promise<void> { await this.write(minute,false); }
  async conclude(minute: Minute): Promise<void> { await this.write(minute,true); }
  async remove(minute: Minute, phrase: string, reason: string): Promise<void> {
    const societyId=this.society(),context=this.context,uid=this.data.user()!.uid;
    if(!validMinuteDeletion(minute.number,phrase,reason))throw new Error('Digite a confirmação exatamente como indicada e informe um motivo entre 10 e 500 caracteres.');
    await runInInjectionContext(this.injector,()=>runTransaction(this.firestore,async transaction=>{
      this.assertContext(context);
      const ref=doc(this.firestore,`societies/${societyId}/minutes/${minute.id}`);
      const numberRef=doc(this.firestore,`societies/${societyId}/minuteNumbers/${minute.year}_${minute.number}`);
      const [stored,session,reservation]=await Promise.all([transaction.get(ref),transaction.get(doc(this.firestore,`societies/${societyId}/attendanceSessions/${minute.id}`)),transaction.get(numberRef)]);
      if(!stored.exists()||stored.data()['deletedAt'])throw new Error('Esta ata já foi excluída ou está indisponível.');
      const previous=stored.data() as Minute;
      if(previous.revision!==minute.revision||previous.number!==minute.number||previous.year!==minute.year)throw new Error('A ata foi atualizada em outra sessão. Reabra-a e confira antes de excluir.');
      this.assertContext(context);
      if(session.exists())transaction.update(doc(this.firestore,`plenaryAttendance/${session.data()['token']}`),{open:false});
      if(reservation.exists()&&reservation.data()['minuteId']===minute.id)transaction.delete(numberRef);
      transaction.update(ref,{deletedAt:serverTimestamp(),deletedBy:uid,deletionReason:reason.trim(),deletionConfirmation:phrase,revision:previous.revision+1,updatedAt:serverTimestamp()});
    }));
    this.assertContext(context);
    this.minutes.update(items=>items.filter(item=>item.id!==minute.id));
  }
  private async snapshot(transaction: Transaction, societyId: string, minute: Minute): Promise<AttendanceSnapshot[]> {
    const ids = [...new Set(minute.attendance.map(person=>person.memberId))];
    const result: AttendanceSnapshot[] = [];
    for (const id of ids) {
      if (!id || id.includes('/')) throw new Error('Presença inválida.');
      const member = await transaction.get(doc(this.firestore,`societies/${societyId}/members/${id}`));
      const board = await transaction.get(doc(this.firestore,`societies/${societyId}/boardAssignments/${minute.year}_${id}`));
      if (!member.exists() || member.data()['status'] !== 'active') throw new Error('A chamada contém um sócio inativo ou indisponível. Atualize a lista.');
      result.push({memberId:id,name:String(member.data()['name']),office:String(member.data()['office'] || ''),role:board.exists() ? String(board.data()['role']) : ''});
    }
    return result.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  }
  private async write(minute: Minute, conclude: boolean): Promise<void> {
    const societyId = this.society(); const context = this.context;
    const errors = validateMinute(minute,conclude);
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    const result = await runInInjectionContext(this.injector, () => runTransaction(this.firestore, async transaction => {
      this.assertContext(context);
      const ref = doc(this.firestore,`societies/${societyId}/minutes/${minute.id}`);
      const stored = await transaction.get(ref);
      if (!stored.exists() || stored.data()['deletedAt']) throw new Error('Ata indisponível ou excluída.');
      const previous = stored.data() as Minute;
      if (minute.number !== previous.number || minute.year !== previous.year || minute.date !== previous.date || minute.timeZone !== previous.timeZone) throw new Error('A identificação da ata não pode ser alterada.');
      if (previous.status === 'concluded') throw new Error('A ata lavrada não pode ser alterada.');
      if (previous.revision !== minute.revision) throw new Error('A ata foi atualizada em outra sessão. Reabra-a antes de salvar.');
      const presenceSession=conclude?await transaction.get(doc(this.firestore,`societies/${societyId}/attendanceSessions/${minute.id}`)):null;
      const today = attendanceAvailable(previous);
      if (!today && JSON.stringify(minute.attendance) !== JSON.stringify(previous.attendance)) throw new Error('A chamada só pode ser alterada no dia da plenária.');
      const future = previous.date > civilDate(new Date(),previous.timeZone);
      if (future && conclude) throw new Error('A ata só pode ser lavrada a partir do dia da plenária.');
      const attendance = today ? await this.snapshot(transaction,societyId,minute) : previous.attendance;
      const content = {...minute,attendance,status:conclude ? 'concluded' as const : future ? 'scheduled' as const : 'in_progress' as const};
      const finalErrors = validateMinute(content,conclude);
      if (Object.keys(finalErrors).length) throw new Error(Object.values(finalErrors)[0]);
      this.assertContext(context);
      const editable = ['type','startTime','endTime','churchName','societyName','meetingLocation','templeAddress','logoDataUrl','convocation','scripture','preacher','openingPrayer','devotionalTime','deliberations','newMembers','hymn','closingPrayer','presidentId','secretaryId','attendance','status'] as const;
      const payload = Object.fromEntries(editable.map(key=>[key,content[key]]));
      if(presenceSession?.exists())transaction.update(doc(this.firestore,`plenaryAttendance/${presenceSession.data()['token']}`),{open:false});
      transaction.update(ref,{...payload,revision:previous.revision+1,updatedAt:serverTimestamp(),concludedAt:conclude ? serverTimestamp() : null,finalText:conclude ? minuteText(content) : ''});
      return {...content,revision:previous.revision+1};
    }));
    this.assertContext(context);
    this.minutes.update(items=>items.map(item=>item.id===result.id && item.revision <= result.revision ? {...item,...result} : item));
  }
  async admit(minute: Minute, name: string): Promise<void> {
    const societyId = this.society(); const context = this.context;
    if (name.trim().length < 2 || name.trim().length > 120) throw new Error('Informe o nome completo do novo sócio.');
    if (!attendanceAvailable(minute)) throw new Error('Novos sócios só podem ser recebidos no dia da plenária.');
    const result = await runInInjectionContext(this.injector, () => runTransaction(this.firestore, async transaction => {
      this.assertContext(context);
      const ref = doc(this.firestore,`societies/${societyId}/minutes/${minute.id}`);
      const stored = await transaction.get(ref);
      if (!stored.exists() || stored.data()['deletedAt']) throw new Error('Ata indisponível ou excluída.');
      const previous = stored.data() as Minute;
      if (minute.number !== previous.number || minute.year !== previous.year || minute.date !== previous.date || minute.timeZone !== previous.timeZone) throw new Error('A identificação da ata não pode ser alterada.');
      if (previous.revision !== minute.revision || !attendanceAvailable(previous)) throw new Error('Atualize a ata antes de receber o novo sócio.');
      const memberRef = doc(collection(this.firestore,`societies/${societyId}/members`));
      const attendance = await this.snapshot(transaction,societyId,minute);
      attendance.push({memberId:memberRef.id,name:name.trim(),office:'',role:''});
      this.assertContext(context);
      transaction.set(memberRef,{...emptyMember(),name:name.trim(),receivedDate:previous.date,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      transaction.set(doc(this.firestore,`societies/${societyId}/communicationBirthdays/${memberRef.id}`),sharedBirthday({...emptyMember(),name:name.trim()}));
      const editable = ['type','startTime','endTime','churchName','societyName','meetingLocation','templeAddress','logoDataUrl','convocation','scripture','preacher','openingPrayer','devotionalTime','deliberations','hymn','closingPrayer','presidentId','secretaryId'] as const;
      const draft = Object.fromEntries(editable.map(key=>[key,minute[key]]));
      const result = {...previous,...draft,attendance,newMembers:[minute.newMembers.trim(),name.trim()].filter(Boolean).join('; '),revision:previous.revision+1,status:'in_progress' as const,id:minute.id};
      transaction.update(ref,{...draft,attendance:result.attendance,newMembers:result.newMembers,revision:result.revision,status:result.status,updatedAt:serverTimestamp()});
      return result;
    }));
    this.assertContext(context);
    this.minutes.update(items=>items.map(item=>item.id===result.id && item.revision <= result.revision ? {...item,...result} : item));
  }
}
