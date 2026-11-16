import { Injectable, Injector, effect, inject, runInInjectionContext, signal } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, runTransaction, serverTimestamp } from '@angular/fire/firestore';
import { DataService } from './data.service';
import { Notice, NoticeInput, normalizeNotice, validateNotice } from './notices';

@Injectable({providedIn:'root'})
export class NoticesService {
  private readonly firestore=inject(Firestore);
  private readonly injector=inject(Injector);
  private readonly data=inject(DataService);
  readonly notices=signal<Notice[]>([]);
  readonly loading=signal(false);
  readonly error=signal('');
  private readonly reload=signal(0);
  retry():void{this.reload.update(value=>value+1);}
  constructor(){
    effect(onCleanup=>{
      this.reload();
      const society=this.data.selected(),uid=this.data.user()?.uid;
      this.notices.set([]);this.error.set('');this.loading.set(false);
      if(!society||society.ownerId!==uid)return;
      let active=true;
      this.loading.set(true);
      const unsubscribe=runInInjectionContext(this.injector,()=>onSnapshot(collection(this.firestore,`societies/${society.id}/notices`),snapshot=>{
        if(!active)return;
        this.notices.set(snapshot.docs.map(item=>({...item.data(),id:item.id}) as Notice).sort((a,b)=>b.meetingDate.localeCompare(a.meetingDate)||b.issueDate.localeCompare(a.issueDate)));
        this.loading.set(false);
      },()=>{if(active){this.error.set('Não foi possível carregar as convocações.');this.loading.set(false);}}));
      onCleanup(()=>{active=false;unsubscribe();});
    });
  }
  async save(input: NoticeInput,current?: Notice):Promise<Notice>{
    const society=this.data.selected(),uid=this.data.user()?.uid;
    if(!society||society.ownerId!==uid)throw new Error('Sociedade indisponível.');
    const errors=validateNotice(input);if(Object.keys(errors).length)throw new Error(Object.values(errors)[0]);
    const validContext=()=>this.data.user()?.uid===uid&&this.data.selected()?.id===society.id;
    const ref=current?doc(this.firestore,`societies/${society.id}/notices/${current.id}`):doc(collection(this.firestore,`societies/${society.id}/notices`));
    const content=normalizeNotice(input);
    const revision=await runInInjectionContext(this.injector,()=>runTransaction(this.firestore,async transaction=>{
      if(!validContext())throw new Error('A sociedade ou sessão foi alterada.');
      const stored=await transaction.get(ref);
      if(current&&(!stored.exists()||stored.data()['revision']!==current.revision))throw new Error('A convocação foi alterada em outra sessão. Reabra-a antes de salvar.');
      const revision=current?current.revision+1:0;
      if(!validContext())throw new Error('A sociedade ou sessão foi alterada.');
      if(current)transaction.update(ref,{...content,revision,updatedAt:serverTimestamp()});
      else transaction.set(ref,{...content,revision,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      return revision;
    }));
    return {...content,id:ref.id,revision};
  }
}
