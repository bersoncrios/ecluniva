import { Component, inject, signal } from '@angular/core';
import { DataService } from '../../core/data.service';

@Component({selector:'app-legal-consent',standalone:true,templateUrl:'./legal-consent.component.html',styleUrl:'./legal-consent.component.css'})
export class LegalConsentComponent { readonly data=inject(DataService); readonly terms=signal(false);readonly privacy=signal(false);readonly error=signal('');readonly busy=signal(false);async accept():Promise<void>{if(!this.terms()||!this.privacy())return;this.busy.set(true);this.error.set('');try{await this.data.acceptLegal();}catch(error){this.error.set(error instanceof Error?error.message:'Não foi possível registrar o aceite. Tente novamente.');}finally{this.busy.set(false);}}}
