import { Component, DestroyRef, computed, effect, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/data.service';
import { NoticesService } from '../../core/notices.service';
import { Notice, NoticeInput, NoticeType, NOTICE_TYPES, emptyNotice, noticeParagraphs, noticePurpose, validateNotice } from '../../core/notices';
import { minutePersonName } from '../../core/minutes';
import { exportNoticeDocx, exportNoticePdf } from '../../core/notices-export';

@Component({selector:'app-notices',standalone:true,imports:[FormsModule],templateUrl:'./notices.component.html',styleUrl:'./notices.component.css'})
export class NoticesComponent {
  readonly data=inject(DataService);
  readonly service=inject(NoticesService);
  readonly savingChange=output<boolean>();
  readonly types=NOTICE_TYPES;
  readonly busy=signal(false);
  readonly formOpen=signal(false);
  readonly current=signal<Notice|null>(null);
  readonly draft=signal<NoticeInput>(emptyNotice());
  readonly paragraphs=computed(()=>noticeParagraphs(this.draft()));
  readonly errors=signal<Record<string,string>>({});
  readonly message=signal('');
  readonly failure=signal('');
  readonly search=signal('');
  readonly filtered=computed(()=>this.service.notices().filter(item=>`${item.meetingPurpose} ${item.meetingDate} ${this.date(item.meetingDate)} ${this.label(item.meetingType)}`.toLocaleLowerCase('pt-BR').includes(this.search().toLocaleLowerCase('pt-BR'))));
  readonly fields:{key:Exclude<keyof NoticeInput,'meetingType'|'agenda'>;label:string;type?:string;max:number;wide?:boolean;placeholder?:string}[]=[
    {key:'churchName',label:'Igreja',max:160},{key:'societyName',label:'Nome completo da sociedade',max:240},
    {key:'issueCity',label:'Cidade e UF de emissão',max:160,placeholder:'Ex.: Palmas, Tocantins'},{key:'issueDate',label:'Data de emissão',type:'date',max:10},
    {key:'meetingDate',label:'Data da reunião',type:'date',max:10},{key:'timeDescription',label:'Horário ou referência de horário',max:160,placeholder:'Ex.: 18:00 ou após a Escola Bíblica Dominical'},
    {key:'meetingPurpose',label:'Finalidade da reunião',max:160,wide:true,placeholder:'Ex.: reunião de planejamento'},
    {key:'meetingLocation',label:'Local da reunião',max:240,wide:true,placeholder:'Ex.: no templo da igreja ou na casa do irmão João'},
    {key:'address',label:'Endereço completo',max:500,wide:true},
    {key:'legalBasis',label:'Referência ao estatuto ou GTSI (opcional)',max:1000,wide:true,placeholder:'Ex.: determina o Artigo 19, alínea a, do GTSI da UPH'},
    {key:'presidentName',label:'Nome do presidente',max:240},{key:'presidentRole',label:'Cargo na assinatura do presidente',max:160},
    {key:'secretaryName',label:'Nome do secretário',max:240},{key:'secretaryRole',label:'Cargo na assinatura do secretário',max:160}
  ];
  private context='';
  private destroyed=false;
  constructor(){
    effect(()=>{
      const context=`${this.data.user()?.uid||''}/${this.data.selected()?.id||''}`;
      if(context!==this.context){this.context=context;this.formOpen.set(false);this.current.set(null);this.draft.set(emptyNotice());this.errors.set({});this.failure.set('');this.message.set('');this.search.set('');}
    });
    inject(DestroyRef).onDestroy(()=>{this.destroyed=true;this.savingChange.emit(false);});
  }
  label(type:NoticeType):string{return this.types.find(item=>item.value===type)?.label||type;}
  date(value:string):string{return value.split('-').reverse().join('/');}
  newNotice():void{
    const society=this.data.selected();if(!society||this.busy())return;
    const names={UPH:'União Presbiteriana de Homens',SAF:'Sociedade Auxiliadora Feminina',UMP:'União de Mocidade Presbiteriana',UCP:'União de Crianças Presbiterianas',UPA:'União Presbiteriana de Adolescentes'};
    const memberName=(pattern:RegExp)=>{const assignment=this.data.boardAssignments().find(item=>pattern.test(item.role.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()));const member=this.data.members().find(item=>item.id===assignment?.memberId);return member?minutePersonName({memberId:member.id,name:member.name,office:member.office,role:assignment?.role||''}):'';};
    const hasBoard=this.data.boardYear()===Number(new Date().getFullYear())&&!this.data.boardLoading()&&!this.data.boardError();
    this.draft.set({...emptyNotice(),churchName:society.churchName,societyName:`${names[society.type]} — ${society.name.startsWith(society.type)?society.name:society.type+' '+society.name}`,presidentName:hasBoard?memberName(/^presidente$/):'',secretaryName:hasBoard?memberName(/^(1[ºo°]?\s*)?secretari[oa]$/):'',presidentRole:`Presidente da ${society.type}`,secretaryRole:`1º Secretário da ${society.type}`});
    this.current.set(null);this.formOpen.set(true);this.errors.set({});this.failure.set('');this.message.set('');
  }
  open(notice:Notice):void{if(this.busy())return;this.current.set(notice);this.draft.set({...notice});this.formOpen.set(true);this.errors.set({});this.failure.set('');this.message.set('');}
  update(key:keyof NoticeInput,value:string):void{this.draft.update(draft=>({...draft,[key]:value}));}
  changeType(type:NoticeType):void{this.draft.update(draft=>({...draft,meetingType:type,meetingPurpose:this.types.some(item=>noticePurpose(item.value)===draft.meetingPurpose)?noticePurpose(type):draft.meetingPurpose}));}
  close():void{if(!this.busy())this.formOpen.set(false);}
  private valid(context:string):boolean{return !this.destroyed&&this.context===context;}
  async save():Promise<void>{
    if(!this.validate())return;
    const current=this.current();
    // Persist only form fields; stored IDs and timestamps never enter the payload.
    const input=Object.fromEntries(Object.keys(emptyNotice()).map(key=>[key,this.draft()[key as keyof NoticeInput]])) as unknown as NoticeInput;
    await this.perform(async context=>{const saved=await this.service.save(input,current||undefined);if(this.valid(context)){this.current.set(saved);this.draft.set(saved);this.message.set('Convocação salva.');}});
  }
  async download(format:'pdf'|'docx'):Promise<void>{if(!this.validate())return;const input={...this.draft()};await this.perform(async context=>{await (format==='pdf'?exportNoticePdf(input):exportNoticeDocx(input));if(this.valid(context))this.message.set(`${format.toUpperCase()} gerado. Confira os downloads do navegador.`);});}
  private validate():boolean{this.errors.set(validateNotice(this.draft()));if(Object.keys(this.errors()).length){this.failure.set('Revise os campos indicados.');return false;}return true;}
  private async perform(action:(context:string)=>Promise<void>):Promise<void>{if(this.busy())return;const context=this.context;this.busy.set(true);this.savingChange.emit(true);this.failure.set('');this.message.set('');try{await action(context);}catch(error){if(this.valid(context))this.failure.set(error instanceof Error?error.message:'Não foi possível concluir a operação. Tente novamente.');}finally{this.busy.set(false);if(!this.destroyed)this.savingChange.emit(false);}}
}
