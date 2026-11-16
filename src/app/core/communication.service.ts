import { DestroyRef, Injectable, Injector, effect, inject, runInInjectionContext, signal } from '@angular/core';
import { Firestore, collection, doc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, where, writeBatch } from '@angular/fire/firestore';
import { DataService } from './data.service';
import { todayISO } from './domain';
import { BirthdayContact, BirthdayPublication, CardIdentity, CommunicationInvite, DEFAULT_IDENTITY, PublicationStatus, inviteEmail, publicationId, sharedBirthday, validIdentity, validInviteEmail } from './communication';

@Injectable({providedIn:'root'})
export class CommunicationService {
  private readonly db=inject(Firestore);
  private readonly injector=inject(Injector);
  readonly data=inject(DataService);
  readonly people=signal<BirthdayContact[]>([]);
  readonly publications=signal<BirthdayPublication[]>([]);
  readonly identity=signal<CardIdentity>({...DEFAULT_IDENTITY});
  readonly invites=signal<CommunicationInvite[]>([]);
  readonly loading=signal(false);
  readonly error=signal('');
  readonly preparing=signal(false);
  readonly progress=signal('');
  readonly ready=signal(false);
  private context='';
  private readonly year=signal(Number(todayISO().slice(0,4)));
  private readonly reload=signal(0);
  retry():void{this.reload.update(value=>value+1);}
  constructor(){
    const timer=setInterval(()=>this.year.set(Number(todayISO().slice(0,4))),60000);inject(DestroyRef).onDestroy(()=>clearInterval(timer));
    effect(onCleanup=>{
      this.reload();const society=this.data.selected(),uid=this.data.user()?.uid,year=this.year();
      this.people.set([]);this.publications.set([]);this.invites.set([]);this.identity.set({...DEFAULT_IDENTITY});this.loading.set(false);this.error.set('');
      const context=`${uid||''}/${society?.id||''}`;if(context!==this.context){this.context=context;this.ready.set(false);}
      if(!society||!uid)return;
      let active=true,remaining=society.ownerId===uid?4:3;const received=new Set<string>();
      this.loading.set(true);
      const loaded=(key:string)=>{if(active&&!received.has(key)){received.add(key);remaining--;this.loading.set(remaining>0);}};
      const fail=()=>{if(active){this.people.set([]);this.publications.set([]);this.error.set('Não foi possível carregar a Comunicação. Confira o acesso e tente novamente.');this.loading.set(false);}};
      const listeners=runInInjectionContext(this.injector,()=>[
        onSnapshot(query(collection(this.db,`societies/${society.id}/communicationBirthdays`),where('active','==',true)),snapshot=>{if(active){this.people.set(snapshot.docs.map(item=>({...item.data(),id:item.id}) as BirthdayContact));}loaded('people');},fail),
        onSnapshot(query(collection(this.db,`societies/${society.id}/birthdayPublications`),where('date','>=',`${year}-01-01`),where('date','<=',`${year+1}-12-31`)),snapshot=>{if(active)this.publications.set(snapshot.docs.map(item=>({...item.data(),id:item.id}) as BirthdayPublication));loaded('publications');},fail),
        onSnapshot(doc(this.db,`societies/${society.id}/communicationSettings/identity`),snapshot=>{if(active&&snapshot.exists()){const value=snapshot.data();this.identity.set({primaryColor:value['primaryColor'],accentColor:value['accentColor'],logoDataUrl:value['logoDataUrl'],messageTemplate:value['messageTemplate']});}loaded('identity');},fail),
        ...(society.ownerId===uid?[onSnapshot(query(collection(this.db,'communicationInvites'),where('societyId','==',society.id)),snapshot=>{if(active)this.invites.set(snapshot.docs.map(item=>({...item.data(),id:item.id}) as CommunicationInvite));loaded('invites');},fail)]:[])
      ]);
      onCleanup(()=>{active=false;listeners.forEach(unsubscribe=>unsubscribe());});
    });
  }
  private owner(){const society=this.data.selected();if(!society||society.ownerId!==this.data.user()?.uid)throw new Error('Apenas o responsável pode administrar a Comunicação.');return society;}
  async prepareSharing():Promise<void>{
    if(this.preparing())return;
    const society=this.owner(),uid=this.data.user()!.uid;
    if(this.data.membersLoading()||this.data.membersError())throw new Error('Aguarde o carregamento completo dos membros.');
    const context=()=>this.data.selected()?.id===society.id&&this.data.user()?.uid===uid;
    const members=[...this.data.members()];this.preparing.set(true);this.ready.set(false);this.progress.set('Preparando aniversariantes…');
    try{
      await runInInjectionContext(this.injector,async()=>{
        const stored=await getDocs(collection(this.db,`societies/${society.id}/communicationBirthdays`));
        const existing=new Map(stored.docs.map(item=>[item.id,item.data()]));
        const changes=members.filter(member=>{const expected=sharedBirthday(member),value=existing.get(member.id);return !value||value['name']!==expected.name||value['month']!==expected.month||value['day']!==expected.day||value['active']!==expected.active;});
        // Small batches stay within the Rules cross-document access budget.
        for(let offset=0;offset<changes.length;offset+=8){
          if(!context())throw new Error('A sociedade ou sessão foi alterada.');
          const batch=writeBatch(this.db);for(const member of changes.slice(offset,offset+8))batch.set(doc(this.db,`societies/${society.id}/communicationBirthdays/${member.id}`),sharedBirthday(member));
          await batch.commit();this.progress.set(`Preparando aniversariantes: ${Math.min(offset+8,changes.length)} de ${changes.length}`);
        }
        if(!context())throw new Error('A sociedade ou sessão foi alterada.');
        await setDoc(doc(this.db,`societies/${society.id}/communicationSettings/access`),{enabled:true,updatedAt:serverTimestamp()});
      });
      if(context())this.ready.set(true);
    }finally{this.preparing.set(false);this.progress.set('');}
  }
  async invite(emailInput:string):Promise<void>{
    const society=this.owner(),email=inviteEmail(emailInput);
    if(!validInviteEmail(email))throw new Error('Informe um e-mail válido.');
    if(email===this.data.user()?.email?.toLowerCase())throw new Error('Você já administra esta sociedade. Convide outra pessoa.');
    if(!this.ready())await this.prepareSharing();
    const uid=this.data.user()!.uid;
    await runInInjectionContext(this.injector,()=>runTransaction(this.db,async transaction=>{
      const ref=doc(this.db,'communicationInvites',`${society.id}__${email}`),stored=await transaction.get(ref);
      if(stored.exists()&&stored.data()['status']!=='revoked')throw new Error('Este e-mail já tem um convite ou acesso ativo.');
      if(this.data.selected()?.id!==society.id||this.data.user()?.uid!==uid)throw new Error('A sociedade ou sessão foi alterada.');
      transaction.set(ref,{societyId:society.id,ownerId:uid,email,societyName:society.name,churchName:society.churchName,societyType:society.type,status:'pending',acceptedBy:'',acceptedAt:null,createdAt:stored.exists()?stored.data()['createdAt']:serverTimestamp(),updatedAt:serverTimestamp()});
    }));
  }
  async revoke(invite:CommunicationInvite):Promise<void>{
    const society=this.owner();if(invite.societyId!==society.id)throw new Error('Convite de outra sociedade.');
    await runInInjectionContext(this.injector,()=>runTransaction(this.db,async transaction=>{
      const ref=doc(this.db,'communicationInvites',invite.id),stored=await transaction.get(ref);
      if(!stored.exists())throw new Error('Convite indisponível.');
      if(this.data.selected()?.id!==society.id||!this.data.isOwner())throw new Error('A sociedade ou sessão foi alterada.');
      const acceptedBy=stored.data()['acceptedBy'];
      transaction.update(ref,{status:'revoked',updatedAt:serverTimestamp()});
      if(acceptedBy)transaction.update(doc(this.db,`societies/${society.id}/communicationTeam/${acceptedBy}`),{active:false,updatedAt:serverTimestamp()});
    }));
  }
  async saveIdentity(identity:CardIdentity):Promise<void>{
    const society=this.owner();if(!validIdentity(identity))throw new Error('Confira as cores, a mensagem e o logotipo.');
    await runInInjectionContext(this.injector,()=>setDoc(doc(this.db,`societies/${society.id}/communicationSettings/identity`),{...identity,messageTemplate:identity.messageTemplate.trim(),updatedBy:this.data.user()!.uid,updatedAt:serverTimestamp()}));
  }
  async setPublication(memberId:string,date:string,status:PublicationStatus):Promise<void>{
    const society=this.data.selected(),uid=this.data.user()?.uid;if(!society||!uid)throw new Error('Sociedade indisponível.');
    await runInInjectionContext(this.injector,()=>runTransaction(this.db,async transaction=>{
      const ref=doc(this.db,`societies/${society.id}/birthdayPublications/${publicationId(memberId,date)}`),stored=await transaction.get(ref);
      if(this.data.selected()?.id!==society.id||this.data.user()?.uid!==uid)throw new Error('A sociedade ou sessão foi alterada.');
      transaction.set(ref,{memberId,date,status,revision:stored.exists()?stored.data()['revision']+1:0,updatedBy:uid,updatedAt:serverTimestamp()});
    }));
  }
  invitationLink():string{return `${location.origin}${location.pathname}#convites`;}
  invitationMail(invite:CommunicationInvite):string{return `mailto:${encodeURIComponent(invite.email)}?subject=${encodeURIComponent('Convite para Comunicação — '+invite.societyName)}&body=${encodeURIComponent(`Você recebeu acesso à Comunicação da ${invite.societyType} ${invite.societyName}.\n\nEntre no Quadrei com Google usando ${invite.email} e aceite o convite. Você poderá consultar aniversariantes, preparar mensagens e baixar cartões.\n\n${this.invitationLink()}`)}`;}
}
