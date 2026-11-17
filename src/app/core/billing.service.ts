import { Injectable, Injector, effect, inject, runInInjectionContext, signal } from '@angular/core';
import { Firestore, doc, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { DataService } from './data.service';
import { PLAN_LIMITS, PlanKey, QuotaKey, planFromStatus, quotaMessage } from './plans';
@Injectable({providedIn:'root'})
export class BillingService {
  private readonly firestore=inject(Firestore); private readonly injector=inject(Injector); private readonly data=inject(DataService); private unsubscribe?:Unsubscribe;
  readonly plan=signal<PlanKey>('free');
  constructor(){effect(onCleanup=>{const user=this.data.user(),society=this.data.selected();this.unsubscribe?.();this.plan.set('free');if(!user||!society||society.ownerId!==user.uid)return;this.unsubscribe=runInInjectionContext(this.injector,()=>onSnapshot(doc(this.firestore,`users/${user.uid}/billing/${society.id}`),snap=>{const data=snap.exists()?snap.data():null;this.plan.set(data?.['status']==='authorized'?planFromStatus(data['plan']):'free');},()=>this.plan.set('free')));onCleanup(()=>this.unsubscribe?.());});}
  limit(quota:QuotaKey):number|null{return PLAN_LIMITS[this.plan()][quota];}
  assert(quota:QuotaKey,used:number):void{const limit=this.limit(quota);if(limit!==null&&used>=limit)throw new Error(quotaMessage(quota,limit));}
}
