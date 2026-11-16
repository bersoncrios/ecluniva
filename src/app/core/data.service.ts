import { Injectable, Injector, computed, inject, runInInjectionContext, signal } from '@angular/core';
import { Auth, GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';
import { Firestore, collection, query, where, onSnapshot, addDoc, doc, serverTimestamp, Unsubscribe, runTransaction, deleteDoc, writeBatch } from '@angular/fire/firestore';
import { BoardAssignment, Member, MemberInput, Society, SocietyType } from './models';
import { normalizeMember, todayISO } from './domain';
import { boardAssignmentId, validBoardYear, validateBoardAssignment } from './board';
import { sharedBirthday, CommunicationInvite } from './communication';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);
  readonly ready = signal(false);
  readonly user = signal<User | null>(null);
  readonly societies = signal<Society[]>([]);
  readonly selected = signal<Society | null>(null);
  readonly members = signal<Member[]>([]);
  readonly isOwner = computed(()=>!!this.selected()&&this.selected()!.ownerId===this.user()?.uid);
  readonly incomingInvites = signal<CommunicationInvite[]>([]);
  private ownedSocieties:Society[]=[];
  private unsubscribeInvites?:Unsubscribe;
  private unsubscribeSharedAccess?:Unsubscribe;
  readonly societiesLoading = signal(false);
  readonly membersLoading = signal(false);
  readonly societiesError = signal('');
  readonly membersError = signal('');
  readonly boardYear = signal(Number(todayISO().slice(0,4)));
  readonly boardAssignments = signal<BoardAssignment[]>([]);
  readonly boardLoading = signal(false);
  readonly boardError = signal('');
  private unsubscribeBoard?: Unsubscribe;
  private boardVersion = 0;
  private unsubscribeSocieties?: Unsubscribe;
  private unsubscribeMembers?: Unsubscribe;
  private authVersion = 0;
  private memberVersion = 0;

  constructor() {
    runInInjectionContext(this.injector, () => onAuthStateChanged(this.auth, user => {
      this.authVersion++;
      this.clearAll();
      this.user.set(user);
      this.ready.set(true);
      if (user) this.loadSocieties();
    }, () => {
      this.clearAll();
      this.user.set(null);
      this.ready.set(true);
    }));
  }

  async login(): Promise<void> {
    await runInInjectionContext(this.injector, () => signInWithPopup(this.auth, new GoogleAuthProvider()));
  }

  async emulatorLogin(email: string, password: string): Promise<void> {
    if (!environment.useEmulators) throw new Error('Acesso de testes indisponível.');
    await runInInjectionContext(this.injector, () => signInWithEmailAndPassword(this.auth, email, password));
  }

  async logout(): Promise<void> {
    this.authVersion++;
    this.clearAll();
    try { await runInInjectionContext(this.injector, () => signOut(this.auth)); }
    catch (error) {
      if (this.user()) this.loadSocieties();
      throw error;
    }
  }

  loadSocieties(): void {
    const user=this.user();if(!user)return;
    this.unsubscribeSocieties?.();this.unsubscribeInvites?.();
    this.ownedSocieties=[];this.societies.set([]);this.incomingInvites.set([]);this.societiesError.set('');this.societiesLoading.set(true);
    const version=this.authVersion;let ownedLoaded=false,invitesLoaded=!user.emailVerified||!user.email;
    const publish=()=>{if(version!==this.authVersion)return;this.publishSocieties();this.societiesLoading.set(!ownedLoaded||!invitesLoaded);};
    runInInjectionContext(this.injector,()=>{
      this.unsubscribeSocieties=onSnapshot(query(collection(this.firestore,'societies'),where('ownerId','==',user.uid)),snapshot=>{
        if(version!==this.authVersion)return;
        this.ownedSocieties=snapshot.docs.map(item=>({...item.data(),id:item.id}) as Society);ownedLoaded=true;publish();
      },()=>{if(version===this.authVersion){this.ownedSocieties=[];ownedLoaded=true;this.societiesError.set('Não foi possível carregar suas sociedades.');publish();}});
      if(!invitesLoaded)this.unsubscribeInvites=onSnapshot(query(collection(this.firestore,'communicationInvites'),where('email','==',user.email!.toLowerCase())),snapshot=>{
        if(version!==this.authVersion)return;
        this.incomingInvites.set(snapshot.docs.map(item=>({...item.data(),id:item.id}) as CommunicationInvite));invitesLoaded=true;publish();
      },()=>{if(version===this.authVersion){this.incomingInvites.set([]);invitesLoaded=true;this.societiesError.set('Não foi possível carregar os convites de Comunicação.');publish();}});
    });
  }

  private publishSocieties():void{
    const uid=this.user()?.uid;
    const shared=this.incomingInvites().filter(invite=>invite.status==='accepted'&&invite.acceptedBy===uid).map(invite=>({id:invite.societyId,ownerId:invite.ownerId,churchName:invite.churchName,type:invite.societyType,name:invite.societyName}));
    const merged=new Map([...shared,...this.ownedSocieties].map(society=>[society.id,society]));
    this.societies.set([...merged.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')));
    const current=this.selected();if(current&&!merged.has(current.id))this.clearSelection();
  }

  select(society: Society): void {
    const allowed=this.societies().find(item=>item.id===society.id);if(!allowed)return;
    this.clearSelection();this.selected.set(allowed);
    if(this.isOwner()){this.loadMembers();this.loadBoard(this.boardYear());}
    else{
      const uid=this.user()!.uid;
      this.unsubscribeSharedAccess=runInInjectionContext(this.injector,()=>onSnapshot(doc(this.firestore,`societies/${allowed.id}/communicationTeam/${uid}`),snapshot=>{
        if(this.selected()?.id===allowed.id&&(!snapshot.exists()||snapshot.data()['active']!==true))this.clearSelection();
      },()=>{if(this.selected()?.id===allowed.id)this.clearSelection();}));
    }
  }

  async acceptCommunicationInvite(invite:CommunicationInvite):Promise<void>{
    const user=this.user();if(!user?.emailVerified||user.email?.toLowerCase()!==invite.email)throw new Error('Entre com o e-mail confirmado que recebeu o convite.');
    const version=this.authVersion;
    await runInInjectionContext(this.injector,()=>runTransaction(this.firestore,async transaction=>{
      const ref=doc(this.firestore,'communicationInvites',invite.id),teamRef=doc(this.firestore,`societies/${invite.societyId}/communicationTeam/${user.uid}`);
      const stored=await transaction.get(ref),team=await transaction.get(teamRef);
      if(version!==this.authVersion||!stored.exists()||stored.data()['status']!=='pending')throw new Error('Este convite não está mais disponível.');
      transaction.update(ref,{status:'accepted',acceptedBy:user.uid,acceptedAt:serverTimestamp(),updatedAt:serverTimestamp()});
      transaction.set(teamRef,{userId:user.uid,email:invite.email,inviteId:invite.id,active:true,createdAt:team.exists()?team.data()['createdAt']:serverTimestamp(),updatedAt:serverTimestamp()});
    }));
    if(version!==this.authVersion)return;
    this.incomingInvites.update(items=>items.map(item=>item.id===invite.id?{...item,status:'accepted',acceptedBy:user.uid}:item));this.publishSocieties();
  }

  clearSelection(): void {
    this.unsubscribeSharedAccess?.();this.unsubscribeSharedAccess=undefined;
    this.boardVersion++;
    this.unsubscribeBoard?.();
    this.unsubscribeBoard = undefined;
    this.boardAssignments.set([]);
    this.boardError.set('');
    this.boardLoading.set(false);
    this.boardYear.set(Number(todayISO().slice(0,4)));
    this.memberVersion++;
    this.unsubscribeMembers?.();
    this.unsubscribeMembers = undefined;
    this.selected.set(null);
    this.members.set([]);
    this.membersError.set('');
    this.membersLoading.set(false);
  }

  loadMembers(): void {
    const society = this.selected();
    if (!society || society.ownerId !== this.user()?.uid) return;
    this.unsubscribeMembers?.();
    this.memberVersion++;
    const version = this.memberVersion;
    this.members.set([]);
    this.membersLoading.set(true);
    this.membersError.set('');
    runInInjectionContext(this.injector, () => {
      this.unsubscribeMembers = onSnapshot(collection(this.firestore, `societies/${society.id}/members`), snapshot => {
        if (version !== this.memberVersion) return;
        this.members.set(snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as Member));
        this.membersLoading.set(false);
      }, () => {
        if (version !== this.memberVersion) return;
        this.members.set([]);
        this.membersLoading.set(false);
        this.membersError.set('Não foi possível carregar os membros.');
      });
    });
  }

  async createSociety(churchName: string, type: SocietyType, name: string): Promise<void> {
    const user = this.user();
    if (!user) throw new Error('Sessão encerrada.');
    const version = this.authVersion;
    const data = { ownerId: user.uid, churchName: churchName.trim(), type, name: name.trim() };
    const ref = await runInInjectionContext(this.injector, () => addDoc(collection(this.firestore, 'societies'), {
      ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    if (version !== this.authVersion) return;
    const society: Society = { ...data, id: ref.id };
    if(!this.ownedSocieties.some(item=>item.id===ref.id))this.ownedSocieties.push(society);
    this.publishSocieties();
    this.select(society);
  }

  async saveMember(input: MemberInput, id: string | null): Promise<void> {
    const society = this.authorizedSociety();
    const data = normalizeMember(input);
    await runInInjectionContext(this.injector,async()=>{
      const ref=id?doc(this.firestore,`societies/${society.id}/members/${id}`):doc(collection(this.firestore,`societies/${society.id}/members`));
      const batch=writeBatch(this.firestore);
      if(id)batch.update(ref,{...data,updatedAt:serverTimestamp()});
      else batch.set(ref,{...data,status:'active',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      batch.set(doc(this.firestore,`societies/${society.id}/communicationBirthdays/${ref.id}`),sharedBirthday({...data,status:id?data.status:'active'}));
      await batch.commit();
    });
  }

  async setStatus(member: Member, status: 'active' | 'inactive'): Promise<void> {
    const society = this.authorizedSociety();
    if (!this.members().some(item => item.id === member.id)) throw new Error('Cadastro indisponível.');
    await runInInjectionContext(this.injector,()=>runTransaction(this.firestore,async transaction=>{
      const ref=doc(this.firestore,`societies/${society.id}/members/${member.id}`),stored=await transaction.get(ref);
      if(!stored.exists())throw new Error('Cadastro indisponível.');
      transaction.update(ref,{status,updatedAt:serverTimestamp()});
      transaction.set(doc(this.firestore,`societies/${society.id}/communicationBirthdays/${member.id}`),sharedBirthday({...stored.data(),status} as Member));
    }));
  }

  loadBoard(year: number): void {
    this.boardVersion++;
    this.unsubscribeBoard?.();
    this.unsubscribeBoard = undefined;
    this.boardAssignments.set([]);
    this.boardError.set('');
    this.boardLoading.set(false);
    if (!validBoardYear(year)) {
      this.boardError.set('Informe um ano entre 1900 e 2100.');
      return;
    }
    this.boardYear.set(year);
    const society = this.selected();
    const uid = this.user()?.uid;
    if (!society || society.ownerId !== uid) return;
    const version = this.boardVersion;
    this.boardLoading.set(true);
    runInInjectionContext(this.injector, () => {
      const ref = query(collection(this.firestore, `societies/${society.id}/boardAssignments`), where('year', '==', year));
      this.unsubscribeBoard = onSnapshot(ref, snapshot => {
        if (version !== this.boardVersion || society.id !== this.selected()?.id || uid !== this.user()?.uid) return;
        this.boardAssignments.set(snapshot.docs.map(item => ({...item.data(),id:item.id}) as BoardAssignment));
        this.boardLoading.set(false);
      }, () => {
        if (version !== this.boardVersion || society.id !== this.selected()?.id || uid !== this.user()?.uid) return;
        this.boardAssignments.set([]);
        this.boardLoading.set(false);
        this.boardError.set('Não foi possível carregar a diretoria deste ano.');
      });
    });
  }

  async saveBoardAssignment(year: number, memberId: string, role: string): Promise<void> {
    const society = this.authorizedSociety();
    const uid = this.user()?.uid;
    const version = this.authVersion;
    const errors = validateBoardAssignment(year, memberId, role, this.members());
    if (this.membersLoading() || this.membersError()) throw new Error('Aguarde o carregamento dos membros.');
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    const id = boardAssignmentId(year, memberId);
    const assertContext = (): void => {
      if (version !== this.authVersion || society.id !== this.selected()?.id || uid !== this.user()?.uid) throw new Error('A sociedade ou a sessão foi alterada.');
    };
    await runInInjectionContext(this.injector, () => {
      const ref = doc(this.firestore, `societies/${society.id}/boardAssignments/${id}`);
      const timestamp = serverTimestamp();
      return runTransaction(this.firestore, async transaction => {
        assertContext();
        const existing = await transaction.get(ref);
        assertContext();
        if (existing.exists()) transaction.update(ref, {role:role.trim(), updatedAt:timestamp});
        else transaction.set(ref, {year,memberId,role:role.trim(),createdAt:timestamp,updatedAt:timestamp});
      });
    });
    assertContext();
  }

  async removeBoardAssignment(entry: BoardAssignment): Promise<void> {
    const society = this.authorizedSociety();
    const uid = this.user()?.uid;
    const version = this.authVersion;
    const id = boardAssignmentId(entry.year, entry.memberId);
    if (entry.id !== id) throw new Error('Participação inválida.');
    await runInInjectionContext(this.injector, () => deleteDoc(doc(this.firestore, `societies/${society.id}/boardAssignments/${id}`)));
    if (version !== this.authVersion || society.id !== this.selected()?.id || uid !== this.user()?.uid) throw new Error('A sociedade ou a sessão foi alterada.');
  }

  private authorizedSociety(): Society {
    const society = this.selected();
    if (!society || society.ownerId !== this.user()?.uid) throw new Error('Sociedade indisponível.');
    return society;
  }

  private clearAll(): void {
    this.unsubscribeSocieties?.();
    this.unsubscribeSocieties = undefined;
    this.unsubscribeInvites?.();this.unsubscribeInvites=undefined;this.incomingInvites.set([]);this.ownedSocieties=[];
    this.clearSelection();
    this.societies.set([]);
    this.societiesLoading.set(false);
    this.societiesError.set('');
  }
}
