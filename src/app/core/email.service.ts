import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface AdminInviteEmail {
  email:string;
  memberName:string;
  societyName:string;
  churchName:string;
  societyType:string;
  inviterEmail:string;
}

@Injectable({providedIn:'root'})
export class EmailService {
  assertConfigured():void{if(!environment.emailJs.templateId||!environment.emailJs.publicKey)throw new Error('Configure o template e a chave pública do EmailJS antes de enviar convites.');}
  async sendAdminInvite(input:AdminInviteEmail):Promise<void>{
    const config=environment.emailJs;
    this.assertConfigured();
    const response=await fetch('https://api.emailjs.com/api/v1.0/email/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({service_id:config.serviceId,template_id:config.templateId,user_id:config.publicKey,template_params:{to_email:input.email,to_name:input.memberName,society_name:input.societyName,church_name:input.churchName,society_type:input.societyType,inviter_email:input.inviterEmail}})});
    if(!response.ok)throw new Error('O convite foi criado, mas não foi possível enviar o e-mail. Verifique a configuração do EmailJS.');
  }
}
