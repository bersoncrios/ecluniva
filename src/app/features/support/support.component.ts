import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Auth } from '@angular/fire/auth';

interface SupportMessage { id: string; senderName: string; senderRole: 'admin' | 'user'; text: string; createdAt: string; }

@Component({
  selector: 'app-support', standalone: true, imports: [CommonModule, FormsModule],
  template: `
    <section class="support-page">
      <div class="page-heading"><div><div class="eyebrow">FALE COM A EQUIPE</div><h1 tabindex="-1">Atendimento</h1><p>Envie sua dúvida ou conte como podemos ajudar.</p></div><button class="button secondary" type="button" (click)="load()" [disabled]="loading()">Atualizar</button></div>
      @if(error()){<div class="alert error" role="alert">{{error()}}</div>}
      <section class="panel support-thread"><div class="support-messages" aria-live="polite">
        @if(loading() && !messages().length){<p role="status">Carregando mensagens…</p>}
        @else if(!messages().length){<p class="empty-state">Ainda não há mensagens. Escreva abaixo para iniciar um atendimento.</p>}
        @for(message of messages();track message.id){<article class="support-message" [class.from-admin]="message.senderRole==='admin'"><strong>{{message.senderRole==='admin'?'Equipe Ecluniva':message.senderName}}</strong><p>{{message.text}}</p><small>{{message.createdAt | date:'dd/MM/yyyy HH:mm'}}</small></article>}
      </div><form class="support-compose" (ngSubmit)="send()"><label for="support-message">Sua mensagem</label><textarea id="support-message" name="message" [(ngModel)]="draft" maxlength="4000" rows="4" placeholder="Digite sua mensagem…" required></textarea><div><small>{{draft.length}}/4000</small><button class="button" type="submit" [disabled]="sending() || !draft.trim()">{{sending()?'Enviando…':'Enviar mensagem'}}</button></div></form></section>
    </section>
  `,
  styles: [`
    .support-page{display:grid;gap:22px}.support-thread{padding:24px}.support-messages{display:grid;gap:14px;max-height:52vh;overflow:auto;padding:4px}.support-message{max-width:min(720px,90%);justify-self:start;border:1px solid #dce4de;background:#f5f7f4;border-radius:12px;padding:14px 16px}.support-message.from-admin{justify-self:end;background:#eaf3ee;border-color:#c8ded1}.support-message p{white-space:pre-wrap;margin:8px 0}.support-message small{color:#52645b}.support-compose{border-top:1px solid #dce4de;margin-top:20px;padding-top:20px;display:grid;gap:10px}.support-compose label{font-weight:600}.support-compose textarea{width:100%;padding:12px;border:1px solid #75867c;border-radius:8px;font:inherit;resize:vertical}.support-compose>div{display:flex;justify-content:space-between;align-items:center}.support-compose small{color:#52645b}.empty-state{padding:20px;text-align:center;color:#52645b}
    @media(max-width:600px){.support-thread{padding:16px}.support-message{max-width:96%}}
  `]
})
export class SupportComponent {
  private readonly auth = inject(Auth);
  readonly messages = signal<SupportMessage[]>([]);
  readonly loading = signal(false);
  readonly sending = signal(false);
  readonly error = signal('');
  draft = '';

  constructor(){void this.load();}

  private async request(method: 'GET'|'POST', body?: object): Promise<{messages?:SupportMessage[];message?:SupportMessage;error?:string}> {
    const user=this.auth.currentUser;if(!user)throw new Error('Entre novamente para enviar uma mensagem.');
    const token=await user.getIdToken();
    const response=await fetch('/api/support',{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json() as {messages?:SupportMessage[];message?:SupportMessage;error?:string};
    if(!response.ok)throw new Error(result.error||'Não foi possível acessar o atendimento.');
    return result;
  }

  async load():Promise<void>{if(this.loading())return;this.loading.set(true);this.error.set('');try{const result=await this.request('GET');this.messages.set(result.messages||[]);}catch(error){this.error.set(error instanceof Error?error.message:'Não foi possível carregar as mensagens.');}finally{this.loading.set(false);}}

  async send():Promise<void>{const text=this.draft.trim();if(!text||this.sending())return;this.sending.set(true);this.error.set('');try{await this.request('POST',{message:text});this.draft='';await this.load();}catch(error){this.error.set(error instanceof Error?error.message:'Não foi possível enviar a mensagem.');}finally{this.sending.set(false);}}
}
