import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface MemberUpdateForm {
  name:string;
  birthDate:string|null;
  phone:string;
  email:string;
  address:{postalCode:string;street:string;number:string;complement:string;neighborhood:string;city:string;state:string};
}
interface UpdateLinkData { member:MemberUpdateForm; society:{name:string;type:string;churchName:string}; }

const emptyForm = ():MemberUpdateForm => ({name:'',birthDate:null,phone:'',email:'',address:{postalCode:'',street:'',number:'',complement:'',neighborhood:'',city:'',state:''}});

@Component({
  selector:'app-public-member-update',
  standalone:true,
  imports:[FormsModule],
  template:`
    <main class="member-update-page" id="main">
      <a class="brand" href="/" aria-label="Ecluniva, página inicial"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="22" cy="23" r="5"/><circle cx="42" cy="23" r="5"/><circle cx="32" cy="18" r="6"/><path d="M12 45c0-7 4-11 10-11 3 0 5 1 7 3M52 45c0-7-4-11-10-11-3 0-5 1-7 3M19 48c0-10 5-15 13-15s13 5 13 15"/></svg></span>Ecluniva</a>
      <section class="member-update-card panel">
        @if(loading()){<div class="eyebrow">ATUALIZAÇÃO CADASTRAL</div><h1>Preparando seu formulário…</h1><p role="status">Validando o link.</p>}
        @else if(done()){<div class="update-check" aria-hidden="true">✓</div><div class="eyebrow">CADASTRO ATUALIZADO</div><h1>Obrigado, {{savedName()}}!</h1><p>Suas informações foram atualizadas com segurança no cadastro da sociedade.</p><p class="help">Você já pode fechar esta página.</p>}
        @else if(!member()){<div class="eyebrow">ATUALIZAÇÃO CADASTRAL</div><h1>Link indisponível</h1><p>Este link expirou, já foi usado ou foi substituído. Peça um novo à pessoa responsável pelo cadastro.</p>}
        @else{
          <div class="eyebrow">{{society()?.type}} · {{society()?.name}}</div><h1>Atualize seus dados</h1><p class="muted">{{society()?.churchName}}</p>
          <p>Confira e atualize suas informações. Este formulário altera somente seus dados pessoais neste cadastro.</p>
          @if(error()){<div class="alert error" role="alert">{{error()}}</div>}
          <form (ngSubmit)="submit()" novalidate>
            <fieldset [disabled]="busy()">
              <div class="field"><label for="update-name">Nome completo <span class="required-label">obrigatório</span></label><input id="update-name" name="name" [(ngModel)]="form.name" autocomplete="name" maxlength="120" required></div>
              <div class="field"><label for="update-birth">Data de nascimento</label><input id="update-birth" name="birthDate" type="date" [(ngModel)]="form.birthDate" autocomplete="bday"></div>
              <div class="field"><label for="update-phone">Telefone com DDD</label><input id="update-phone" name="phone" type="tel" [(ngModel)]="form.phone" autocomplete="tel" inputmode="tel" maxlength="24" placeholder="(00) 00000-0000"></div>
              <div class="field"><label for="update-email">E-mail</label><input id="update-email" name="email" type="email" [(ngModel)]="form.email" autocomplete="email" maxlength="254"></div>
              <h2>Endereço</h2>
              <div class="address-grid">
                <div class="field"><label for="update-cep">CEP</label><input id="update-cep" name="postalCode" [(ngModel)]="form.address.postalCode" inputmode="numeric" autocomplete="postal-code" maxlength="10"></div>
                <div class="field"><label for="update-state">UF</label><input id="update-state" name="state" [(ngModel)]="form.address.state" autocomplete="address-level1" maxlength="2"></div>
                <div class="field address-wide"><label for="update-street">Logradouro</label><input id="update-street" name="street" [(ngModel)]="form.address.street" autocomplete="address-line1" maxlength="160"></div>
                <div class="field"><label for="update-number">Número</label><input id="update-number" name="number" [(ngModel)]="form.address.number" maxlength="20"></div>
                <div class="field"><label for="update-complement">Complemento</label><input id="update-complement" name="complement" [(ngModel)]="form.address.complement" autocomplete="address-line2" maxlength="100"></div>
                <div class="field"><label for="update-neighborhood">Bairro</label><input id="update-neighborhood" name="neighborhood" [(ngModel)]="form.address.neighborhood" maxlength="100"></div>
                <div class="field"><label for="update-city">Cidade</label><input id="update-city" name="city" [(ngModel)]="form.address.city" autocomplete="address-level2" maxlength="100"></div>
              </div>
              <p class="help">Ofício, situação no rol, data de recebimento e observações internas só podem ser alterados pela administração da sociedade.</p>
              <button class="button" type="submit">{{busy()?'Salvando…':'Salvar meus dados'}}</button>
            </fieldset>
          </form>
        }
      </section>
      <footer class="public-footer"><span>Ecluniva</span><p>Organização para cuidar melhor da vida em comunidade.</p></footer>
    </main>`,
  styles:[`
    .member-update-page{max-width:760px;min-height:100dvh;margin:auto;padding:28px 20px;display:flex;flex-direction:column}.brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;font-weight:750;margin-bottom:24px}.brand-mark{width:38px;height:38px;border-radius:12px;background:var(--green);display:grid;place-items:center}.brand-mark svg{width:28px;fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round}.member-update-card{padding:clamp(22px,5vw,42px);flex:1}.member-update-card h1{font-size:clamp(1.7rem,5vw,2.3rem);margin:8px 0 12px}.member-update-card h2{font-size:1.15rem;margin:26px 0 14px}.member-update-card>p{line-height:1.65}.field{margin:16px 0}.field input{width:100%;min-width:0}.address-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.address-wide{grid-column:1/-1}fieldset{border:0;padding:0;margin:0;min-width:0}fieldset .button{width:100%;margin-top:8px}.help{line-height:1.55}.update-check{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:#e8f4ed;color:#1e7b42;font-size:28px;font-weight:800;margin-bottom:18px}.public-footer{text-align:center;margin-top:24px;color:var(--muted);font-size:.9rem}.public-footer p{margin:6px 0}@media(max-width:520px){.member-update-page{padding:18px 14px}.address-grid{grid-template-columns:1fr}.address-wide{grid-column:auto}}
  `],
})
export class PublicMemberUpdateComponent {
  readonly loading=signal(true);readonly busy=signal(false);readonly done=signal(false);readonly error=signal('');readonly member=signal<MemberUpdateForm|null>(null);readonly society=signal<UpdateLinkData['society']|null>(null);readonly savedName=signal('');
  form=emptyForm();
  private readonly token=location.hash.slice('#atualizar-cadastro/'.length).split('?')[0];

  constructor(){void this.load();}

  private async request(payload:Record<string,unknown>):Promise<Record<string,any>>{
    const response=await fetch('/api/member-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||'Não foi possível processar a solicitação.');
    return result;
  }

  private async load():Promise<void>{
    if(!/^[A-Za-z0-9_-]{43}$/.test(this.token)){this.loading.set(false);return;}
    try{const result=await this.request({action:'load',token:this.token}) as unknown as UpdateLinkData;this.member.set(result.member);this.society.set(result.society);this.form=structuredClone(result.member);}
    catch{this.member.set(null);}
    finally{this.loading.set(false);}
  }

  async submit():Promise<void>{
    if(this.busy()||!this.member())return;
    this.busy.set(true);this.error.set('');
    try{await this.request({action:'submit',token:this.token,member:this.form});this.savedName.set(this.form.name.trim());this.done.set(true);this.member.set(null);}
    catch(error){this.error.set(error instanceof Error?error.message:'Não foi possível salvar. Tente novamente.');}
    finally{this.busy.set(false);}
  }
}
