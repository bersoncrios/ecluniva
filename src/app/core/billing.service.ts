import { Injectable, Injector, effect, inject, runInInjectionContext, signal } from '@angular/core';
import { Firestore, collection, doc, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { DataService } from './data.service';
import { PLAN_LIMITS, PlanKey, QuotaKey, planFromStatus, quotaMessage } from './plans';
@Injectable({providedIn:'root'})
export class BillingService {
  private readonly firestore=inject(Firestore); private readonly injector=inject(Injector); private readonly data=inject(DataService); private unsubscribe?:Unsubscribe;
  readonly plan=signal<PlanKey>('free');
  constructor(){effect(onCleanup=>{const user=this.data.user(),society=this.data.selected();this.unsubscribe?.();this.plan.set('free');if(!user||!society||society.ownerId!==user.uid)return;let paidPlan:PlanKey='free',promoPlan:PlanKey='free';const apply=()=>{this.plan.set(promoPlan!=='free'?promoPlan:paidPlan);};const paidUnsubscribe=runInInjectionContext(this.injector,()=>onSnapshot(doc(this.firestore,`users/${user.uid}/billing/${society.id}`),snap=>{const data=snap.exists()?snap.data():null;paidPlan=data?.['status']==='authorized'?planFromStatus(data['plan']):'free';apply();},()=>{paidPlan='free';apply();}));const promoUnsubscribe=runInInjectionContext(this.injector,()=>onSnapshot(collection(this.firestore,`users/${user.uid}/promotionalAccess`),snap=>{const now=Date.now();const valid=snap.docs.map(item=>item.data()).filter(item=>item['societyId']===society.id&&item['active']===true).filter(item=>(item['expiresAt']?.toDate?.()?.getTime?.()||0)>now).sort((a,b)=>(b['expiresAt']?.toDate?.()?.getTime?.()||0)-(a['expiresAt']?.toDate?.()?.getTime?.()||0))[0];promoPlan=valid?planFromStatus(valid['plan']):'free';apply();},()=>{promoPlan='free';apply();}));this.unsubscribe=()=>{paidUnsubscribe();promoUnsubscribe();};onCleanup(()=>this.unsubscribe?.());});}
  limit(quota:QuotaKey):number|null{return PLAN_LIMITS[this.plan()][quota];}
  assert(quota:QuotaKey,used:number):void{const limit=this.limit(quota);if(limit!==null&&used>=limit)throw new Error(quotaMessage(quota,limit));}
}
