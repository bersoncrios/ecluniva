import { Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/data.service';
import { MinutesService } from '../../core/minutes.service';
import { Minute, MinuteInput, attendanceAvailable, civilDate, emptyMinute, minuteSegments, minuteStatus, snapshotAttendance, suggestedOfficers, validateMinute } from '../../core/minutes';
import { exportMinutePdf } from '../../core/minutes-pdf';

@Component({selector:'app-minutes',standalone:true,imports:[FormsModule],templateUrl:'./minutes.component.html',styleUrl:'./minutes.component.css'})
export class MinutesComponent {
  readonly data=inject(DataService);
  readonly service=inject(MinutesService);
  readonly savingChange=output<boolean>();
  readonly busy=signal(false);
  readonly failure=signal('');
  readonly message=signal('');
  readonly errors=signal<Record<string,string>>({});
  readonly scheduleOpen=signal(false);
  readonly current=signal<Minute|null>(null);
  readonly clock=signal(new Date());
  readonly search=signal('');
  readonly confirmationOpen=signal(false);
  readonly zones=[{value:'America/Araguaina',label:'Tocantins / Brasília (UTC−3)'},{value:'America/Manaus',label:'Amazonas (UTC−4)'},{value:'America/Rio_Branco',label:'Acre (UTC−5)'},{value:'America/Noronha',label:'Fernando de Noronha (UTC−2)'}];
  readonly members=computed(()=>this.data.members().filter(member=>member.status==='active').sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')));
  readonly filtered=computed(()=>this.members().filter(member=>member.name.toLocaleLowerCase('pt-BR').includes(this.search().toLocaleLowerCase('pt-BR'))));
  readonly available=computed(()=>{const minute=this.current();return !!minute && attendanceAvailable(minute,this.clock());});
  readonly canConclude=computed(()=>{const minute=this.current();return !!minute&&minute.status!=='concluded'&&minute.date<=civilDate(this.clock(),minute.timeZone);});
  readonly segments=computed(()=>{const minute=this.current();return minute ? minuteSegments(minute):[];});
  readonly fields: {key:TextKey;label:string;type?:string;wide?:boolean}[]=[
    {key:'churchName',label:'Igreja'},{key:'societyName',label:'Sociedade'},
    {key:'meetingLocation',label:'Local da reunião'},
    {key:'templeAddress',label:'Endereço completo do local da reunião (logradouro, número, complemento, bairro, cidade, UF e CEP)',wide:true},
    {key:'convocation',label:'Chamada'},{key:'startTime',label:'Horário de abertura',type:'time'},
    {key:'devotionalTime',label:'Horário do devocional',type:'time'},{key:'scripture',label:'Passagem bíblica'},
    {key:'preacher',label:'Pregador'},{key:'openingPrayer',label:'Responsável pela oração inicial'},
    {key:'hymn',label:'Hino oficial entoado'},{key:'newMembers',label:'Recepção de novos sócios (relato)',wide:true},
    {key:'deliberations',label:'Deliberações em prosa: eleições, contribuições e assuntos gerais',wide:true},
    {key:'endTime',label:'Horário de encerramento',type:'time'},{key:'closingPrayer',label:'Responsável pela oração final'}
  ];
  schedule:MinuteInput=emptyMinute();
  admissionName='';
  @ViewChild('concludeDialog') dialog?:ElementRef<HTMLDialogElement>;
  private context='';
  private destroyed=false;
  constructor(){
    effect(()=>{
      const context=`${this.data.user()?.uid??''}/${this.data.selected()?.id??''}`;
      if(context!==this.context){this.context=context;this.current.set(null);this.scheduleOpen.set(false);this.failure.set('');this.message.set('');this.errors.set({});this.search.set('');this.dialog?.nativeElement.close();}
    });
    const timer=window.setInterval(()=>this.clock.set(new Date()),1000);
    inject(DestroyRef).onDestroy(()=>{window.clearInterval(timer);this.destroyed=true;this.savingChange.emit(false);this.dialog?.nativeElement.close();});
  }
  status(minute:Minute):string{return ({scheduled:'Agendada',in_progress:'Em andamento',concluded:'Lavrada / concluída'})[minuteStatus(minute,this.clock())];}
  date(value:string):string{return value.split('-').reverse().join('/');}
  countdown(minute:Minute):string{const today=civilDate(this.clock(),minute.timeZone);if(minute.status==='concluded')return 'Documento e presenças congelados';if(minute.date===today)return 'Chamada liberada hoje';if(minute.date<today)return 'Dia da reunião encerrado · chamada indisponível';const days=Math.round((Date.parse(minute.date+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);return `Em ${days} ${days===1?'dia':'dias'} · chamada às 00h00 de ${this.date(minute.date)}`;}
  newSchedule():void{const society=this.data.selected();const draft=emptyMinute();this.schedule={...draft,number:Math.max(0,...this.service.minutes().filter(minute=>minute.year===draft.year).map(minute=>minute.number))+1,churchName:society?.churchName??'',societyName:society?`${society.type} ${society.name}`:''};this.errors.set({});this.failure.set('');this.scheduleOpen.set(true);}
  async create():Promise<void>{this.schedule.year=Number(this.schedule.date.slice(0,4));this.errors.set(validateMinute(this.schedule));if(Object.keys(this.errors()).length)return;await this.perform(async()=>{const context=this.context;const id=await this.service.schedule(this.schedule);if(!this.validContext(context))return;this.scheduleOpen.set(false);this.message.set('Plenária agendada com o número de ata informado.');const minute=this.service.minutes().find(item=>item.id===id);if(minute)this.open(minute);});}
  open(minute:Minute):void{if(this.busy())return;this.current.set(structuredClone(minute));this.errors.set({});this.failure.set('');this.message.set('');this.search.set('');this.admissionName='';if(minute.status!=='concluded'&&this.data.boardYear()!==minute.year)this.data.loadBoard(minute.year);}
  update(key:TextKey,value:string):void{this.current.update(minute=>minute?{...minute,[key]:value}:null);}
  officer(key:'presidentId'|'secretaryId',value:string):void{this.current.update(minute=>minute?{...minute,[key]:value}:null);}
  present(id:string):boolean{return this.current()?.attendance.some(person=>person.memberId===id)??false;}
  role(id:string):string{return this.data.boardAssignments().find(assignment=>assignment.year===this.current()?.year&&assignment.memberId===id)?.role??'';}
  toggle(id:string):void{const minute=this.current();if(!minute||!this.available()||this.busy()||this.data.boardLoading()||this.data.membersLoading())return;const ids=minute.attendance.map(person=>person.memberId);const attendance=snapshotAttendance(this.data.members(),this.data.boardAssignments(),ids.includes(id)?ids.filter(value=>value!==id):[...ids,id],minute.year);const suggestions=suggestedOfficers(attendance);this.current.set({...minute,attendance,presidentId:attendance.some(person=>person.memberId===minute.presidentId)?minute.presidentId:suggestions.presidentId,secretaryId:attendance.some(person=>person.memberId===minute.secretaryId)?minute.secretaryId:suggestions.secretaryId});}
  async save():Promise<void>{const minute=this.current();if(!minute)return;this.errors.set(validateMinute(minute));if(Object.keys(this.errors()).length)return;await this.perform(async()=>{const context=this.context;await this.service.save(minute);if(!this.validContext(context))return;this.refresh(minute.id);this.message.set('Rascunho e chamada salvos.');});}
  async admit():Promise<void>{const minute=this.current();if(!minute||!this.available())return;if(this.admissionName.trim().length<2){this.failure.set('Informe o nome completo do novo sócio.');return;}await this.perform(async()=>{const context=this.context;await this.service.admit(minute,this.admissionName.trim());if(!this.validContext(context))return;const latest=this.service.minutes().find(item=>item.id===minute.id);if(latest)this.current.set({...minute,revision:latest.revision,attendance:latest.attendance,newMembers:latest.newMembers,status:latest.status});this.admissionName='';this.message.set('Sócio recebido, cadastrado e incluído entre os presentes.');});}
  maxLength(key:TextKey):number{return key==='deliberations'?40000:key==='newMembers'?10000:key==='convocation'?4000:key==='scripture'?1000:['templeAddress','hymn'].includes(key)?500:['preacher','openingPrayer','closingPrayer'].includes(key)?120:160;}
  async pdf():Promise<void>{const minute=this.current();if(minute)await this.perform(async()=>{const context=this.context;await exportMinutePdf(minute);if(!this.validContext(context))return;this.message.set('PDF gerado. Confira os downloads do navegador.');});}
  requestConclude():void{const minute=this.current();if(!minute)return;this.errors.set(validateMinute(minute,true));if(Object.keys(this.errors()).length){this.failure.set('Revise os campos indicados antes de lavrar a ata.');return;}this.dialog?.nativeElement.showModal();}
  closeConfirmation(event?:Event):void{event?.preventDefault();if(!this.busy())this.dialog?.nativeElement.close();}
  async conclude():Promise<void>{const minute=this.current();if(!minute)return;await this.perform(async()=>{const context=this.context;await this.service.conclude(minute);if(!this.validContext(context))return;this.refresh(minute.id);this.dialog?.nativeElement.close();this.message.set('Ata lavrada. O documento e o histórico de presença foram congelados.');});}
  private validContext(context:string):boolean{return !this.destroyed&&this.context===context;}
  private refresh(id:string):void{const minute=this.service.minutes().find(item=>item.id===id);if(minute)this.current.set(structuredClone(minute));}
  private async perform(action:()=>Promise<void>):Promise<void>{if(this.busy())return;const context=this.context;this.busy.set(true);this.savingChange.emit(true);this.failure.set('');this.message.set('');try{await action();}catch(error){if(context===this.context&&!this.destroyed)this.failure.set(error instanceof Error?error.message:'Não foi possível concluir a operação. Tente novamente.');}finally{this.busy.set(false);if(!this.destroyed)this.savingChange.emit(false);}}
}
type TextKey={ [K in keyof MinuteInput]:MinuteInput[K] extends string?K:never }[keyof MinuteInput];
