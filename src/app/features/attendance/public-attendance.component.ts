import { Component, DestroyRef, inject, signal } from '@angular/core';
import { civilDate } from '../../core/minutes';
import { FormsModule } from '@angular/forms';
import { AttendanceService, type PublicPresenceSession } from '../../core/attendance.service';
import { presenceToken, type PresenceRequest } from '../../core/attendance';

@Component({selector:'app-public-attendance',standalone:true,imports:[FormsModule],template:`
  <main class="presence-public" id="main"><a class="brand" href="#"><span class="brand-mark">Q</span>quadrei</a>
  <section class="panel"><div class="eyebrow">PRESENÇA NA PLENÁRIA</div>
  @if(loading()){<p role="status">Carregando plenária…</p>}
  @else if(!session()){<h1>Link indisponível</h1><p>Confira o QR Code ou peça o link ao secretário.</p><button class="button secondary" (click)="reload()">Tentar novamente</button>}
  @else{<h1>{{session()!.title}}</h1><p>{{session()!.date.split('-').reverse().join('/')}}</p>
    @if(receipt();as item){
      @if(item.status==='confirmed'||item.status==='duplicate'){<div class="alert success" role="status"><h2>Presença confirmada</h2><p>{{item.name}}, sua presença já está registrada na chamada desta plenária.</p></div>}
      @else if(item.status==='rejected'){<div class="alert" role="status">Sua confirmação foi revisada. Procure o secretário para conferir o registro.</div>}
      @else{<div class="alert" role="status"><h2>Confirmação recebida</h2><p>{{item.name}}, aguarde a conferência com o cadastro da sociedade. O secretário acompanhará sua solicitação.</p></div>}
    }@else if(!session()!.open||expired()){<div class="alert" role="status">{{session()!.date>today()?'O recebimento será liberado pelo secretário no dia da plenária.':'O recebimento de confirmações está encerrado. Procure o secretário.'}}</div>}
    @else{<p>Informe seu nome completo e o código exibido na reunião. Não é necessário criar uma conta.</p>
    <form (ngSubmit)="submit()"><fieldset [disabled]="busy()"><div class="field"><label for="presence-name">Seu nome completo</label><input id="presence-name" name="name" [(ngModel)]="name" autocomplete="name" maxlength="120" required></div>
    <div class="field"><label for="presence-code">Código da reunião</label><input id="presence-code" name="code" [(ngModel)]="code" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off" required></div>
    <button class="button" type="submit">{{busy()?'Enviando…':'Confirmar minha presença'}}</button></fieldset></form>
    <p class="help">Seu nome será usado somente para registrar e conferir a presença nesta plenária.</p>}
  }
  @if(error()){<div class="alert error" role="alert">{{error()}}</div>}
  </section></main>`,styles:[`
    .presence-public{max-width:620px;margin:auto;padding:32px 20px;min-height:100dvh}.brand{margin-bottom:32px;display:inline-flex}.panel{padding:clamp(20px,5vw,40px)}h1{font-size:clamp(1.5rem,6vw,2rem);overflow-wrap:anywhere}h2{font-size:1.2rem}.field{margin:20px 0}input{width:100%;min-width:0}fieldset{border:0;padding:0;min-width:0}.button{white-space:normal}.help{margin-top:20px}
  `]})
export class PublicAttendanceComponent {
  private readonly service=inject(AttendanceService);
  readonly loading=signal(true);readonly busy=signal(false);readonly error=signal('');
  readonly session=signal<PublicPresenceSession|null>(null);readonly receipt=signal<PresenceRequest|null>(null);
  today():string{const session=this.session();return civilDate(new Date(),session?.timeZone);}
  expired():boolean{const session=this.session();return !!session&&session.date!==civilDate(new Date(),session.timeZone);}
  name='';code='';private readonly token=location.hash.slice('#presenca/'.length);
  private id='';private stopReceipt?:()=>void;
  constructor(){
    if(!/^[a-f0-9]{48}$/.test(this.token)){this.loading.set(false);return;}
    try{this.id=localStorage.getItem(`quadrei-presence-${this.token}`)||presenceToken();localStorage.setItem(`quadrei-presence-${this.token}`,this.id);}catch{this.id=presenceToken();}
    const stop=this.service.watchPublic(this.token,session=>{this.session.set(session);this.loading.set(false);},()=>{this.loading.set(false);this.error.set('Não foi possível carregar a plenária. Confira sua conexão.');});
    this.watchReceipt();
    const timer=window.setInterval(()=>this.session.update(value=>value?{...value}:null),30000);
    inject(DestroyRef).onDestroy(()=>{stop();this.stopReceipt?.();window.clearInterval(timer);});
  }
  reload():void{location.reload();}
  private watchReceipt():void{
    this.stopReceipt?.();this.stopReceipt=this.service.watchReceipt(this.token,this.id,item=>{this.receipt.set(item);},()=>this.error.set('Não foi possível acompanhar sua confirmação. Atualize a página para conferir.'));
  }
  async submit():Promise<void>{
    if(this.busy())return;this.busy.set(true);this.error.set('');
    try{if(await this.service.existing(this.token,this.id)){this.watchReceipt();return;}await this.service.submit(this.token,this.id,this.name,this.code.trim());this.watchReceipt();}
    catch(error){const code=(error as {code?:string}).code;this.error.set(code==='permission-denied'?'Não foi possível confirmar. Confira o código com o secretário e se a chamada continua aberta.':code?'Não foi possível enviar. Confira sua conexão e tente novamente.':error instanceof Error?error.message:'Não foi possível enviar.');}
    finally{this.busy.set(false);}
  }
}
