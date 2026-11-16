import { Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommunicationService } from '../../core/communication.service';
import { DataService } from '../../core/data.service';
import { CardIdentity, CommunicationEvent, CommunicationInvite, DEFAULT_IDENTITY, PublicationStatus, birthdayMessage, communicationEvents, publicationId } from '../../core/communication';
import { BirthdayCardInput, CardFormat, CardStyle, downloadBirthdayCard, renderBirthdayCard } from '../../core/birthday-card';
import { todayISO } from '../../core/domain';

@Component({selector:'app-communication',standalone:true,imports:[FormsModule],templateUrl:'./communication.component.html',styleUrl:'./communication.component.css'})
export class CommunicationComponent {
  readonly data=inject(DataService);
  readonly service=inject(CommunicationService);
  readonly savingChange=output<boolean>();
  readonly back=output<void>();
  readonly busy=signal(false);
  readonly failure=signal('');
  readonly message=signal('');
  readonly tab=signal<'birthdays'|'team'|'identity'>('birthdays');
  readonly period=signal<'month'|'upcoming'>('month');
  readonly today=signal(todayISO());
  readonly search=signal('');
  readonly statusFilter=signal<'all'|PublicationStatus>('all');
  readonly events=computed(()=>communicationEvents(this.service.people(),this.today()));
  readonly displayed=computed(()=>this.events()[this.period()].filter(event=>this.searchKey(event.person.name).includes(this.searchKey(this.search()))&&(this.statusFilter()==='all'||this.publicationStatus(event)===this.statusFilter())));
  readonly selected=signal<CommunicationEvent|null>(null);
  readonly format=signal<CardFormat>('square');
  readonly style=signal<CardStyle>('classic');
  readonly customMessage=signal<string|null>(null);
  readonly fallbackCopy=signal('');
  readonly cardText=computed(()=>{const event=this.selected();return event?this.customMessage()??this.greeting(event):'';});
  readonly cardInput=computed<BirthdayCardInput|null>(()=>{const event=this.selected(),society=this.data.selected();return event&&society?{name:event.person.name,date:event.date,society:`${society.type} ${society.name}`,church:society.churchName,identity:this.service.identity(),format:this.format(),style:this.style(),message:this.cardText()}:null;});
  readonly canvas=signal<HTMLCanvasElement|null>(null);
  readonly rendering=signal(false);
  identityDraft:CardIdentity={...DEFAULT_IDENTITY};
  email='';
  private context='';
  private preparedContext='';
  private destroyed=false;
  private cardVersion=0;
  private logoVersion=0;
  private searchKey(value:string):string{return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');}
  @ViewChild('cardCanvas')set cardCanvas(ref:ElementRef<HTMLCanvasElement>|undefined){this.canvas.set(ref?.nativeElement||null);}
  constructor(){
    effect(()=>{
      const context=`${this.data.user()?.uid||''}/${this.data.selected()?.id||''}`;
      if(context!==this.context){this.context=context;this.preparedContext='';this.selected.set(null);this.tab.set('birthdays');this.failure.set('');this.message.set('');this.fallbackCopy.set('');this.email='';}
      if(this.data.isOwner()&&!this.data.membersLoading()&&!this.data.membersError()&&this.preparedContext!==context){this.preparedContext=context;void this.prepare();}
    });
    effect(()=>{const identity=this.service.identity();this.identityDraft={...identity};});
    effect(()=>{const event=this.selected(),people=this.service.people();if(event&&!this.service.loading()){const current=people.find(person=>person.id===event.person.id);if(!current)this.selected.set(null);else if(current.name!==event.person.name)this.selected.set({...event,person:current});}});
    effect(()=>{
      const canvas=this.canvas(),input=this.cardInput();const version=++this.cardVersion;
      if(!canvas||!input)return;this.rendering.set(true);
      const draft=document.createElement('canvas');
      void renderBirthdayCard(draft,input).then(()=>{if(version===this.cardVersion&&!this.destroyed){canvas.width=draft.width;canvas.height=draft.height;canvas.getContext('2d')?.drawImage(draft,0,0);}}).catch(()=>{if(version===this.cardVersion)this.failure.set('Não foi possível preparar a prévia do cartão. Confira o logotipo.');}).finally(()=>{if(version===this.cardVersion)this.rendering.set(false);});
    });
    const timer=setInterval(()=>this.today.set(todayISO()),30000);
    inject(DestroyRef).onDestroy(()=>{clearInterval(timer);this.destroyed=true;this.cardVersion++;this.savingChange.emit(false);});
  }
  async prepare():Promise<void>{await this.perform(async()=>{await this.service.prepareSharing();});}
  publicationStatus(event:CommunicationEvent):PublicationStatus{return this.service.publications().find(item=>item.id===publicationId(event.person.id,event.date))?.status||'pending';}
  statusLabel(status:PublicationStatus):string{return {pending:'Pendente',prepared:'Publicação preparada',published:'Parabéns publicados'}[status];}
  day(date:string):string{return date.split('-').slice(1).reverse().join('/');}
  when(event:CommunicationEvent):string{return event.daysAway===0?'Hoje':event.daysAway===1?'Amanhã':event.daysAway>0?`Em ${event.daysAway} dias`:'Neste mês';}
  greeting(event:CommunicationEvent):string{const society=this.data.selected();return birthdayMessage(this.service.identity().messageTemplate,event.person.name,society?`${society.type} ${society.name}`:'sociedade',event.date);}
  openCard(event:CommunicationEvent):void{this.customMessage.set(null);this.selected.set(event);setTimeout(()=>document.getElementById('birthday-card-heading')?.focus());}
  async copy(text:string):Promise<void>{try{await navigator.clipboard.writeText(text);this.message.set('Texto copiado.');this.fallbackCopy.set('');}catch{this.fallbackCopy.set(text);this.message.set('Selecione e copie o texto abaixo.');}}
  async mark(event:CommunicationEvent,status:PublicationStatus):Promise<void>{await this.perform(async()=>{await this.service.setPublication(event.person.id,event.date,status);this.message.set('Acompanhamento atualizado.');});}
  async invite():Promise<void>{await this.perform(async()=>{await this.service.invite(this.email);this.email='';this.message.set('Convite criado. Copie o link ou abra o e-mail para enviar.');});}
  async revoke(invite:CommunicationInvite):Promise<void>{await this.perform(async()=>{await this.service.revoke(invite);this.message.set('Acesso revogado.');});}
  async saveIdentity():Promise<void>{await this.perform(async()=>{await this.service.saveIdentity({...this.identityDraft});this.message.set('Identidade dos cartões salva.');});}
  async logo(event:Event):Promise<void>{
    const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;
    if(!['image/png','image/jpeg'].includes(file.type)||file.size>180000){this.failure.set('Escolha um PNG ou JPEG de até 180 KB.');return;}
    const context=this.context,version=++this.logoVersion;
    try{const value=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error());reader.readAsDataURL(file);});const image=new Image();image.src=value;await image.decode();if(context===this.context&&version===this.logoVersion)this.identityDraft={...this.identityDraft,logoDataUrl:value};}catch{if(context===this.context)this.failure.set('Não foi possível ler esse logotipo.');}
  }
  async download():Promise<void>{const input=this.cardInput();if(!input)return;if(!input.message.trim()||input.message.length>1000){this.failure.set('Escreva uma mensagem com até 1.000 caracteres.');return;}await this.perform(async()=>{await downloadBirthdayCard(input);this.message.set('Cartão PNG gerado. Confira os downloads.');});}
  private async perform(action:()=>Promise<void>):Promise<void>{if(this.busy())return;const context=this.context;this.busy.set(true);this.savingChange.emit(true);this.failure.set('');this.message.set('');try{await action();}catch(error){if(!this.destroyed&&context===this.context)this.failure.set((error as {code?:string})?.code?'Não foi possível concluir a operação. Confira a conexão e seu acesso, e tente novamente.':error instanceof Error?error.message:'Não foi possível concluir. Tente novamente.');}finally{this.busy.set(false);if(!this.destroyed)this.savingChange.emit(false);}}
}
