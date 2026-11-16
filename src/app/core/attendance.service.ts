import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, type Unsubscribe } from '@angular/fire/firestore';
import { DataService } from './data.service';
import { attendanceAvailable, civilDate, suggestedOfficers, type Minute, type AttendanceSnapshot } from './minutes';
import { presenceToken, type PresenceRequest } from './attendance';

export interface PresenceSession { token:string; code:string; }
export interface PublicPresenceSession { societyId:string; minuteId:string; title:string; date:string; timeZone:string; open:boolean; }

@Injectable({providedIn:'root'})
export class AttendanceService {
  private readonly db=inject(Firestore);
  private readonly injector=inject(Injector);
  private readonly data=inject(DataService);
  private call<T>(action:()=>T):T{return runInInjectionContext(this.injector,action);}
  private owner(sid:string):void {if(this.data.selected()?.id!==sid || !this.data.isOwner())throw new Error('Sociedade indisponível.');}
  url(token:string):string{return `${location.origin}${location.pathname}#presenca/${token}`;}
  watchSession(sid:string,mid:string,next:(session:PresenceSession|null)=>void,error:()=>void):Unsubscribe {
    return this.call(()=>onSnapshot(doc(this.db,`societies/${sid}/attendanceSessions/${mid}`),snapshot=>next(snapshot.exists()?snapshot.data() as PresenceSession:null),error));
  }
  watchPublic(token:string,next:(session:PublicPresenceSession|null)=>void,error:()=>void):Unsubscribe {
    return this.call(()=>onSnapshot(doc(this.db,`plenaryAttendance/${token}`),snapshot=>next(snapshot.exists()?snapshot.data() as PublicPresenceSession:null),error));
  }
  watchRequests(token:string,next:(requests:PresenceRequest[])=>void,error:()=>void):Unsubscribe {
    return this.call(()=>onSnapshot(collection(this.db,`plenaryAttendance/${token}/requests`),snapshot=>next(snapshot.docs.map(item=>({...item.data(),id:item.id}) as PresenceRequest)),error));
  }
  watchReceipt(token:string,id:string,next:(request:PresenceRequest|null)=>void,error:()=>void):Unsubscribe {
    return this.call(()=>onSnapshot(doc(this.db,`plenaryAttendance/${token}/requests/${id}`),snapshot=>next(snapshot.exists()?snapshot.data() as PresenceRequest:null),error));
  }
  async open(sid:string,minute:Minute):Promise<void> {
    this.owner(sid);
    const token=presenceToken();
    const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
    await this.call(()=>runTransaction(this.db,async tx=>{
      const privateRef=doc(this.db,`societies/${sid}/attendanceSessions/${minute.id}`);
      const minuteRef=doc(this.db,`societies/${sid}/minutes/${minute.id}`);
      const [stored,session]=await Promise.all([tx.get(minuteRef),tx.get(privateRef)]);
      if(!stored.exists()||stored.data()['deletedAt']||stored.data()['status']==='concluded'||stored.data()['date']<civilDate(new Date(),stored.data()['timeZone']))throw new Error('Gere o link para uma plenária de hoje ou futura, antes de concluir ou excluir a ata.');
      if(session.exists()&&!attendanceAvailable(stored.data() as Minute))throw new Error('Abra as confirmações somente no dia da plenária.');
      this.owner(sid);
      const actualToken=session.exists()?String(session.data()['token']):token;
      tx.set(privateRef,{token:actualToken,code:session.exists()?session.data()['code']:code});
      const current=stored.data();
      const publicRef=doc(this.db,`plenaryAttendance/${actualToken}`);
      if(session.exists())tx.update(publicRef,{open:true});
      else tx.set(publicRef,{societyId:sid,minuteId:minute.id,title:`${current['societyName']} · Plenária ${current['number']}`,date:current['date'],timeZone:current['timeZone'],open:attendanceAvailable(current as Minute)});
    }));
  }
  async close(token:string):Promise<void> {
    await this.call(()=>runTransaction(this.db,async tx=>{
      const ref=doc(this.db,`plenaryAttendance/${token}`);const snapshot=await tx.get(ref);
      if(!snapshot.exists())throw new Error('Link indisponível.');
      this.owner(snapshot.data()['societyId']);tx.update(ref,{open:false});
    }));
  }
  async submit(token:string,id:string,name:string,code:string):Promise<void> {
    if(name.trim().length<3||name.trim().length>120||!name.trim().includes(' ')||!/^\d{6}$/.test(code))throw new Error('Informe seu nome completo e o código de seis dígitos exibido na reunião.');
    await this.call(()=>setDoc(doc(this.db,`plenaryAttendance/${token}/requests/${id}`),{name:name.trim(),code,status:'pending',memberId:'',createdAt:serverTimestamp(),processedAt:null}));
  }
  async existing(token:string,id:string):Promise<boolean> {return this.call(async()=>(await getDoc(doc(this.db,`plenaryAttendance/${token}/requests/${id}`))).exists());}
  async resolve(sid:string,mid:string,token:string,requestId:string,memberId:string|null):Promise<void> {
    this.owner(sid);
    await this.call(()=>runTransaction(this.db,async tx=>{
      const ref=doc(this.db,`societies/${sid}/minutes/${mid}`);
      const requestRef=doc(this.db,`plenaryAttendance/${token}/requests/${requestId}`);
      const [stored,request,session]=await Promise.all([tx.get(ref),tx.get(requestRef),tx.get(doc(this.db,`societies/${sid}/attendanceSessions/${mid}`))]);
      if(!stored.exists()||!request.exists()||!session.exists()||session.data()['token']!==token)throw new Error('Confirmação indisponível.');
      if(request.data()['status']!=='pending')return;
      const minute=stored.data() as Minute;
      if(!attendanceAvailable(minute))throw new Error('A chamada está encerrada.');
      if(memberId===null){this.owner(sid);tx.update(requestRef,{status:'rejected',memberId:'',processedAt:serverTimestamp()});return;}
      const [member,board]=await Promise.all([tx.get(doc(this.db,`societies/${sid}/members/${memberId}`)),tx.get(doc(this.db,`societies/${sid}/boardAssignments/${minute.year}_${memberId}`))]);
      if(!member.exists()||member.data()['status']!=='active')throw new Error('Escolha um membro ativo.');
      const duplicate=minute.attendance.some(person=>person.memberId===memberId);
      this.owner(sid);
      if(!duplicate){
        const person:AttendanceSnapshot={memberId,name:member.data()['name'],office:member.data()['office']||'',role:board.exists()?board.data()['role']:''};
        const attendance=[...minute.attendance,person].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
        if(attendance.length>500)throw new Error('A ata admite até 500 presentes.');
        const suggestions=suggestedOfficers(attendance);
        tx.update(ref,{attendance,revision:minute.revision+1,status:'in_progress',presidentId:minute.presidentId||suggestions.presidentId,secretaryId:minute.secretaryId||suggestions.secretaryId,updatedAt:serverTimestamp()});
      }
      tx.update(requestRef,{status:duplicate?'duplicate':'confirmed',memberId,processedAt:serverTimestamp()});
    }));
  }
}
