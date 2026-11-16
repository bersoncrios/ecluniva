import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AttendanceService, type PresenceSession, type PublicPresenceSession } from '../../core/attendance.service';
import { DataService } from '../../core/data.service';
import { attendanceAvailable, civilDate, type Minute } from '../../core/minutes';
import { presenceMatches, type PresenceRequest } from '../../core/attendance';

@Component({selector:'app-attendance-panel',standalone:true,imports:[FormsModule],template:`
  <section class="presence-panel" aria-label="Presença por QR Code"><h3>Presença por link e QR Code</h3>
  <p class="help">O participante informa o nome completo e o código da reunião. Mantenha esta plenária aberta para conferir os nomes e atualizar a chamada automaticamente.</p>
  @if(loading()){<p role="status">Carregando link de presença…</p>}
  @else if(!session()){<button class="button secondary" type="button" (click)="open()" [disabled]="busy()||!canGenerate()||disabled()">Gerar link e QR Code</button>}
  @else{
    <p><strong>{{publicSession()?.open&&available()?'Recebendo confirmações':'Recebimento encerrado'}}</strong></p>
    <div class="presence-sharing">@if(qr()){<img [src]="qr()" alt="QR Code para confirmar presença nesta plenária" width="240" height="240">}
    <div class="presence-link"><label for="presence-share-link">Link da plenária</label><input id="presence-share-link" readonly [value]="link()" (focus)="$any($event.target).select()">
    <p class="presence-code">Código da reunião: <strong>{{session()!.code}}</strong></p>
    <div class="presence-actions"><button class="button secondary" type="button" (click)="copy()">Copiar link</button>@if(qr()){<a class="button secondary" [href]="qr()" download="presenca-plenaria.png">Baixar QR Code</a>}</div>
    <p class="help">Exiba o código no local da reunião. O link, sozinho, não permite enviar uma confirmação.</p></div></div>
    <button class="button secondary" type="button" (click)="publicSession()?.open?close():open()" [disabled]="busy()||disabled()||!available()">{{publicSession()?.open?'Encerrar confirmações':'Reabrir confirmações'}}</button>
    <p class="help">{{confirmed()}} confirmações conferidas · {{pending().length}} pendentes</p>
    @for(request of pending();track request.id){<article class="presence-request"><strong>{{request.name}}</strong><p class="help">{{matches(request).length>1?'Há mais de um membro com este nome. Selecione o correto.':'Confira o nome e vincule a um membro ativo. Nomes aproximados exigem revisão.'}}</p>
    <label [for]="'match-'+request.id">Membro para {{request.name}}</label><select [id]="'match-'+request.id" [(ngModel)]="choices[request.id]" [disabled]="busy()||!available()||disabled()"><option value="">Selecione um membro</option>@for(member of members();track member.id){<option [value]="member.id">{{member.name}}{{member.office?' · '+member.office:''}}{{member.phone?' · '+member.phone:member.email?' · '+member.email:''}}{{member.address.city?' · '+member.address.city:''}}</option>}</select>
    <div class="presence-actions"><button class="button secondary" type="button" (click)="resolve(request,choices[request.id])" [disabled]="busy()||!choices[request.id]||!available()||disabled()">Confirmar membro na chamada</button><button class="button secondary" type="button" (click)="resolve(request,null)" [disabled]="busy()||!available()||disabled()">Desconsiderar</button></div></article>}
    @if(rejected()){<p class="help">{{rejected()}} solicitações desconsideradas.</p>}
  }
  @if(message()){<p role="status">{{message()}}</p>}@if(error()){<div class="alert error" role="alert">{{error()}}</div>}
  </section>`,styles:[`
    .presence-panel{margin:24px 0;padding:20px;border:1px solid var(--border,#deded7);border-radius:12px;min-width:0}.presence-sharing{display:flex;flex-wrap:wrap;gap:20px;align-items:center;margin:16px 0}.presence-sharing img{max-width:100%;height:auto;background:white}.presence-link{flex:1;min-width:min(240px,100%)}input,select{width:100%;min-width:0}.presence-code{font-size:1.15rem}.presence-code strong{letter-spacing:.12em}.presence-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.button{white-space:normal;text-align:center}.presence-request{border-top:1px solid var(--border,#deded7);padding-top:16px;margin-top:16px;overflow-wrap:anywhere}@media(max-width:480px){.presence-panel{padding:14px}.presence-sharing{justify-content:center}.presence-actions>*{width:100%}}
  `]})
export class AttendancePanelComponent {
  readonly minute=input.required<Minute>();readonly disabled=input(false);
  private readonly service=inject(AttendanceService);readonly data=inject(DataService);
  readonly session=signal<PresenceSession|null>(null);readonly publicSession=signal<PublicPresenceSession|null>(null);
  readonly requests=signal<PresenceRequest[]>([]);readonly loading=signal(true);readonly busy=signal(false);
  readonly error=signal('');readonly message=signal('');readonly qr=signal('');
  readonly members=computed(()=>this.data.members().filter(member=>member.status==='active'));
  readonly pending=computed(()=>this.requests().filter(request=>request.status==='pending'));
  readonly confirmed=computed(()=>this.requests().filter(request=>['confirmed','duplicate'].includes(request.status)).length);
  readonly rejected=computed(()=>this.requests().filter(request=>request.status==='rejected').length);
  readonly link=computed(()=>this.session()?this.service.url(this.session()!.token):'');
  private readonly clock=signal(new Date());
  readonly canGenerate=computed(()=>this.minute().status!=='concluded'&&this.minute().date>=civilDate(this.clock(),this.minute().timeZone));
  readonly available=computed(()=>attendanceAvailable(this.minute(),this.clock()));
  private readonly meetingKey=computed(()=>`${this.data.selected()?.id||''}/${this.minute().id}`);
  choices:Record<string,string>={};
  constructor(){
    const timer=window.setInterval(()=>this.clock.set(new Date()),30000);
    inject(DestroyRef).onDestroy(()=>window.clearInterval(timer));
    effect(cleanup=>{
      const [sid,mid]=this.meetingKey().split('/');
      this.session.set(null);this.loading.set(true);this.error.set('');this.message.set('');this.choices={};
      if(!sid)return;
      const stop=this.service.watchSession(sid,mid,session=>{this.session.set(session);this.loading.set(false);},()=>{this.loading.set(false);this.error.set('Não foi possível carregar a chamada por link.');});cleanup(stop);
    });
    effect(cleanup=>{
      const session=this.session();this.publicSession.set(null);this.requests.set([]);this.qr.set('');if(!session)return;
      let alive=true;
      const stop=this.service.watchPublic(session.token,item=>this.publicSession.set(item),()=>this.error.set('Não foi possível acompanhar o link.'));
      const requests=this.service.watchRequests(session.token,items=>this.requests.set(items),()=>this.error.set('Não foi possível carregar as confirmações.'));
      import('qrcode').then(({default:qrCode})=>qrCode.toDataURL(this.service.url(session.token),{width:360,margin:4,errorCorrectionLevel:'M'})).then(url=>{if(alive)this.qr.set(url);}).catch(()=>{if(alive)this.error.set('Não foi possível gerar o QR Code. O link continua disponível.');});
      cleanup(()=>{alive=false;stop();requests();});
    });
    effect(()=>{
      if(this.error()||this.busy()||this.disabled()||!this.available()||this.data.membersLoading()||this.data.membersError())return;
      const request=this.pending().find(item=>this.matches(item).length===1);
      if(request)void this.resolve(request,this.matches(request)[0]);
    });
  }
  matches(request:PresenceRequest):string[]{return presenceMatches(request.name,this.members());}
  async open():Promise<void>{await this.perform(async()=>{const sid=this.data.selected()!.id;await this.service.open(sid,this.minute());this.message.set(this.available()?'Link aberto. Compartilhe o QR Code e exiba o código na reunião.':'Link gerado. Abra as confirmações no dia da plenária e exiba o código no local.');});}
  async close():Promise<void>{await this.perform(async()=>{await this.service.close(this.session()!.token);this.message.set('Novos envios encerrados. As solicitações recebidas continuam disponíveis para conferência.');});}
  async copy():Promise<void>{try{await navigator.clipboard.writeText(this.link());this.message.set('Link copiado.');}catch{this.message.set('Selecione e copie o endereço no campo Link da plenária.');}}
  async resolve(request:PresenceRequest,memberId:string|null):Promise<void>{if(memberId==='')return;await this.perform(()=>this.service.resolve(this.data.selected()!.id,this.minute().id,this.session()!.token,request.id,memberId));}
  private async perform(action:()=>Promise<void>):Promise<void>{if(this.busy())return;this.busy.set(true);this.error.set('');try{await action();}catch(error){this.error.set((error as {code?:string}).code?'Não foi possível atualizar a presença. Confira sua conexão e reabra a plenária.':error instanceof Error?error.message:'Não foi possível atualizar.');}finally{this.busy.set(false);}}
}
