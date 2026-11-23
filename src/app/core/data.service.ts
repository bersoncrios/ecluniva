import { Injectable, Injector, computed, inject, runInInjectionContext, signal } from '@angular/core';
import { Auth, GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';
import { Firestore, collection, query, where, onSnapshot, addDoc, doc, getDoc, getDocs, serverTimestamp, Unsubscribe, runTransaction, deleteDoc, writeBatch, updateDoc, setDoc } from '@angular/fire/firestore';
import { BoardAssignment, Member, MemberInput, Society, SocietyAdmin, SocietyAdminInvite, SocietyType } from './models';
import { EmailService } from './email.service';
import { normalizeMember, todayISO } from './domain';
import { boardAssignmentId, validBoardYear, validateBoardAssignment } from './board';
import { sharedBirthday, CommunicationInvite } from './communication';
import { environment } from '../../environments/environment';
import { PLAN_LIMITS, planFromStatus } from './plans';
import { LEGAL_VERSION } from './legal';

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly email=inject(EmailService);
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);
  readonly ready = signal(false);
  readonly legalReady = signal(false);
  readonly legalAccepted = signal(false);
  readonly user = signal<User | null>(null);
  readonly isAdmin = signal(false);
  readonly societies = signal<Society[]>([]);
  readonly selected = signal<Society | null>(null);
  readonly members = signal<Member[]>([]);
  readonly isOwner = computed(()=>!!this.selected()&&this.selected()!.ownerId===this.user()?.uid);
  readonly isSocietyAdmin = computed(()=>!!this.selected()&&!!this.user()&&!this.isOwner()&&this.adminSocietyIds.has(this.selected()!.id));
  readonly hasSocietyAccess = computed(()=>this.isOwner()||this.isSocietyAdmin());
  isSocietyAdminFor(societyId: string): boolean { return this.adminSocietyIds.has(societyId); }
  readonly incomingInvites = signal<CommunicationInvite[]>([]);
  readonly incomingAdminInvites = signal<SocietyAdminInvite[]>([]);
  readonly societyAdmins = signal<SocietyAdmin[]>([]);
  readonly societyAdminInvites = signal<SocietyAdminInvite[]>([]);
  private ownedSocieties:Society[]=[];
  private adminSocieties:Society[]=[];
  private adminSocietyIds = new Set<string>();
  private unsubscribeInvites?:Unsubscribe;
  private unsubscribeAdminInvites?:Unsubscribe;
  private unsubscribeSharedAccess?:Unsubscribe;
  private unsubscribeSocietyAdmins?:Unsubscribe;
  private unsubscribeSocietyAdminInvites?:Unsubscribe;
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
      if (user) {
        this.loadSocieties();
        void this.loadLegalAcceptance(user);
        void runInInjectionContext(this.injector, () => getDoc(doc(this.firestore, `users/${user.uid}`)))
          .then(profile => { if (this.user()?.uid === user.uid) this.isAdmin.set(profile.exists() && profile.data()?.['role'] === 'admin'); })
          .catch(() => { if (this.user()?.uid === user.uid) this.isAdmin.set(false); });
      }
    }, () => {
      this.clearAll();
      this.user.set(null);
      this.isAdmin.set(false);
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

  async acceptLegal(): Promise<void> {
    const user=this.user();if(!user)throw new Error('Sessão encerrada.');
    await runInInjectionContext(this.injector,()=>setDoc(doc(this.firestore,`legalAcceptances/${user.uid}`),{uid:user.uid,email:user.email?.toLowerCase()||'',termsVersion:LEGAL_VERSION,privacyVersion:LEGAL_VERSION,acceptedAt:serverTimestamp(),updatedAt:serverTimestamp()}));
    this.legalAccepted.set(true);
  }

  private async loadLegalAcceptance(user:User):Promise<void>{
    this.legalReady.set(false);this.legalAccepted.set(false);
    try{const snapshot=await runInInjectionContext(this.injector,()=>getDoc(doc(this.firestore,`legalAcceptances/${user.uid}`)));const data=snapshot.data();this.legalAccepted.set(snapshot.exists()&&data?.['termsVersion']===LEGAL_VERSION&&data?.['privacyVersion']===LEGAL_VERSION);}catch{this.legalAccepted.set(false);}finally{if(this.user()?.uid===user.uid)this.legalReady.set(true);}
  }

  loadSocieties(): void {
    const user=this.user();if(!user)return;
    this.unsubscribeSocieties?.();this.unsubscribeInvites?.();this.unsubscribeAdminInvites?.();
    this.ownedSocieties=[];this.adminSocieties=[];this.adminSocietyIds.clear();this.societies.set([]);this.incomingInvites.set([]);this.incomingAdminInvites.set([]);this.societiesError.set('');this.societiesLoading.set(true);
    const version=this.authVersion;let ownedLoaded=false,invitesLoaded=!user.emailVerified||!user.email,adminInvitesLoaded=!user.emailVerified||!user.email;
    const publish=()=>{if(version!==this.authVersion)return;this.publishSocieties();this.societiesLoading.set(!ownedLoaded||!invitesLoaded||!adminInvitesLoaded);};
    runInInjectionContext(this.injector,()=>{
      this.unsubscribeSocieties=onSnapshot(query(collection(this.firestore,'societies'),where('ownerId','==',user.uid)),snapshot=>{
        if(version!==this.authVersion)return;
        this.ownedSocieties=snapshot.docs.map(item=>({...item.data(),id:item.id}) as Society);ownedLoaded=true;publish();
      },()=>{if(version===this.authVersion){this.ownedSocieties=[];ownedLoaded=true;this.societiesError.set('Não foi possível carregar suas sociedades.');publish();}});
      if(!invitesLoaded)this.unsubscribeInvites=onSnapshot(query(collection(this.firestore,'communicationInvites'),where('email','==',user.email!.toLowerCase())),snapshot=>{
        if(version!==this.authVersion)return;
        this.incomingInvites.set(snapshot.docs.map(item=>({...item.data(),id:item.id}) as CommunicationInvite));invitesLoaded=true;publish();
      },()=>{if(version===this.authVersion){this.incomingInvites.set([]);invitesLoaded=true;this.societiesError.set('Não foi possível carregar os convites de Comunicação.');publish();}});
      if(!adminInvitesLoaded)this.unsubscribeAdminInvites=onSnapshot(query(collection(this.firestore,'societyAdminInvites'),where('email','==',user.email!.toLowerCase())),snapshot=>{
        if(version!==this.authVersion)return;
        this.incomingAdminInvites.set(snapshot.docs.map(item=>({...item.data(),id:item.id}) as SocietyAdminInvite));adminInvitesLoaded=true;publish();
      },()=>{if(version===this.authVersion){this.incomingAdminInvites.set([]);adminInvitesLoaded=true;this.societiesError.set('Não foi possível carregar os convites de administração.');publish();}});
    });
  }

  private publishSocieties():void{
    const uid=this.user()?.uid;
    const acceptedAdmins=this.incomingAdminInvites().filter(invite=>invite.status==='accepted'&&invite.acceptedBy===uid);
    this.adminSocietyIds.clear();
    acceptedAdmins.forEach(invite=>this.adminSocietyIds.add(invite.societyId));
    this.adminSocieties=acceptedAdmins.map(invite=>({id:invite.societyId,ownerId:invite.ownerId,churchName:invite.churchName,type:invite.societyType,name:invite.societyName}));
    const shared=[...this.adminSocieties,...this.ownedSocieties];
    const merged=new Map([...shared,...this.ownedSocieties].map(society=>[society.id,society]));
    this.societies.set([...merged.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')));
    const current=this.selected();if(current&&!merged.has(current.id))this.clearSelection();
  }

  select(society: Society): void {
    const allowed=this.societies().find(item=>item.id===society.id);if(!allowed)return;
    this.clearSelection();this.selected.set(allowed);
    if(this.isOwner()||this.adminSocietyIds.has(allowed.id)){this.loadMembers();this.loadBoard(this.boardYear());if(this.isOwner()){this.loadSocietyAdmins();this.loadSocietyAdminInvites();}}
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

  async acceptSocietyAdminInvite(invite:SocietyAdminInvite):Promise<void>{
    const user=this.user();if(!user?.emailVerified||user.email?.toLowerCase()!==invite.email)throw new Error('Entre com o e-mail confirmado que recebeu o convite.');
    const version=this.authVersion;
    await runInInjectionContext(this.injector,()=>runTransaction(this.firestore,async transaction=>{
      const ref=doc(this.firestore,'societyAdminInvites',invite.id),adminRef=doc(this.firestore,`societies/${invite.societyId}/admins/${user.uid}`);
      const stored=await transaction.get(ref),admin=await transaction.get(adminRef);
      if(version!==this.authVersion||!stored.exists()||stored.data()['status']!=='pending')throw new Error('Este convite não está mais disponível.');
      transaction.update(ref,{status:'accepted',acceptedBy:user.uid,acceptedAt:serverTimestamp(),updatedAt:serverTimestamp()});
      transaction.set(adminRef,{userId:user.uid,email:invite.email,inviteId:invite.id,active:true,createdAt:admin.exists()?admin.data()['createdAt']:serverTimestamp(),updatedAt:serverTimestamp()});
    }));
    if(version!==this.authVersion)return;
    this.incomingAdminInvites.update(items=>items.map(item=>item.id===invite.id?{...item,status:'accepted',acceptedBy:user.uid}:item));
    this.adminSocietyIds.add(invite.societyId);
    const society={id:invite.societyId,ownerId:invite.ownerId,churchName:invite.churchName,type:invite.societyType,name:invite.societyName};
    if(!this.adminSocieties.some(item=>item.id===society.id))this.adminSocieties.push(society);
    this.publishSocieties();
  }

  async inviteSocietyAdmin(member: Member):Promise<void>{
    const society=this.authorizedOwnerSociety();
    const email=member.email.trim().toLowerCase();
    if(!email)throw new Error('Este membro não possui e-mail cadastrado.');
    this.email.assertConfigured();
    const id=`${society.id}__${email}`;
    await runInInjectionContext(this.injector,()=>runTransaction(this.firestore,async transaction=>{
      const ref=doc(this.firestore,`societyAdminInvites/${id}`),stored=await transaction.get(ref);
      const data={societyId:society.id,ownerId:society.ownerId,email,societyName:society.name,churchName:society.churchName,societyType:society.type,status:'pending',acceptedBy:'',acceptedAt:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
      if(stored.exists()&&stored.data()['status']==='accepted')throw new Error('Este membro já possui acesso à sociedade.');
      if(stored.exists())transaction.update(ref,{...data,createdAt:stored.data()['createdAt']});else transaction.set(ref,data);
    }));
    try {
      await this.email.sendAdminInvite({email,memberName:member.name,societyName:society.name,churchName:society.churchName,societyType:society.type,inviterEmail:this.user()?.email||''});
    } catch(error) {
      throw error instanceof Error?error:new Error('O convite foi criado, mas não foi possível enviar o e-mail.');
    }
  }

  loadSocietyAdmins():void{
    const society=this.selected();
    this.unsubscribeSocietyAdmins?.();this.unsubscribeSocietyAdmins=undefined;this.societyAdmins.set([]);
    if(!society||!this.isOwner())return;
    this.unsubscribeSocietyAdmins=runInInjectionContext(this.injector,()=>onSnapshot(collection(this.firestore,`societies/${society.id}/admins`),snapshot=>{
      if(this.selected()?.id!==society.id||!this.isOwner())return;
      this.societyAdmins.set(snapshot.docs.map(item=>({...item.data(),userId:item.id}) as SocietyAdmin).filter(item=>item.active));
    },()=>{if(this.selected()?.id===society.id)this.societyAdmins.set([]);}));
  }

  loadSocietyAdminInvites():void{
    const society=this.selected();
    this.unsubscribeSocietyAdminInvites?.();this.unsubscribeSocietyAdminInvites=undefined;this.societyAdminInvites.set([]);
    if(!society||!this.isOwner())return;
    this.unsubscribeSocietyAdminInvites=runInInjectionContext(this.injector,()=>onSnapshot(query(collection(this.firestore,'societyAdminInvites'),where('societyId','==',society.id)),snapshot=>{
      if(this.selected()?.id===society.id&&this.isOwner())this.societyAdminInvites.set(snapshot.docs.map(item=>({...item.data(),id:item.id}) as SocietyAdminInvite));
    },()=>{if(this.selected()?.id===society.id)this.societyAdminInvites.set([]);}));
  }

  societyAdminForMember(member:Member):SocietyAdmin|null{
    const email=member.email.trim().toLowerCase();
    if(!email)return null;
    const active=this.societyAdmins().find(admin=>admin.active&&admin.email===email);
    if(active)return active;
    const accepted=this.societyAdminInvites().find(invite=>invite.status==='accepted'&&invite.email===email&&invite.acceptedBy);
    return accepted?{userId:accepted.acceptedBy,email:accepted.email,inviteId:accepted.id,active:true}:null;
  }

  societyAdminInviteForMember(member:Member):SocietyAdminInvite|null{const email=member.email.trim().toLowerCase();return email?this.societyAdminInvites().find(invite=>invite.email===email&&invite.status==='pending')||null:null;}

  async removeSocietyAdmin(admin:SocietyAdmin):Promise<void>{
    const society=this.authorizedOwnerSociety();
    const adminRef=doc(this.firestore,`societies/${society.id}/admins/${admin.userId}`);
    const inviteRef=doc(this.firestore,`societyAdminInvites/${admin.inviteId}`);
    await runInInjectionContext(this.injector,()=>runTransaction(this.firestore,async transaction=>{
      const stored=await transaction.get(adminRef);
      const invite=await transaction.get(inviteRef);
      if(!stored.exists()||stored.data()['active']!==true)throw new Error('Este administrador já foi removido.');
      transaction.update(adminRef,{active:false,updatedAt:serverTimestamp()});
      if(invite.exists()&&invite.data()['status']==='accepted')transaction.update(inviteRef,{status:'revoked',updatedAt:serverTimestamp()});
    }));
    this.societyAdmins.update(items=>items.filter(item=>item.userId!==admin.userId));
  }

  clearSelection(): void {
    this.unsubscribeSharedAccess?.();this.unsubscribeSharedAccess=undefined;
    this.unsubscribeSocietyAdmins?.();this.unsubscribeSocietyAdmins=undefined;this.unsubscribeSocietyAdminInvites?.();this.unsubscribeSocietyAdminInvites=undefined;this.societyAdmins.set([]);this.societyAdminInvites.set([]);
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
    if (!society || !this.hasSocietyAccess()) return;
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

  async createSociety(churchName: string, type: SocietyType, name: string, churchAddress = ''): Promise<void> {
    const user = this.user();
    if (!user) throw new Error('Sessão encerrada.');
    const billing = await runInInjectionContext(this.injector, () => getDocs(collection(this.firestore, `users/${user.uid}/billing`)));
    const accountPlan = billing.docs.reduce((current, item) => {
      const data = item.data();
      if (data['status'] !== 'authorized') return current;
      const candidate = planFromStatus(data['plan']);
      return PLAN_LIMITS[candidate].societies === null || (PLAN_LIMITS[current].societies !== null && PLAN_LIMITS[candidate].societies! > PLAN_LIMITS[current].societies!) ? candidate : current;
    }, 'free' as keyof typeof PLAN_LIMITS);
    const societyLimit = PLAN_LIMITS[accountPlan].societies;
    if (societyLimit !== null && this.ownedSocieties.length >= societyLimit) throw new Error(`Seu plano permite até ${societyLimit} sociedade${societyLimit === 1 ? '' : 's'}. Faça upgrade para continuar.`);
    const version = this.authVersion;
    const data = { ownerId: user.uid, churchName: churchName.trim(), churchAddress: {postalCode:'',street:churchAddress.trim(),number:'',complement:'',neighborhood:'',city:'',state:''}, type, name: name.trim() };
    const ref = await runInInjectionContext(this.injector, () => addDoc(collection(this.firestore, 'societies'), {
      ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    if (version !== this.authVersion) return;
    const society: Society = { ...data, id: ref.id };
    if(!this.ownedSocieties.some(item=>item.id===ref.id))this.ownedSocieties.push(society);
    this.publishSocieties();
    this.select(society);
  }

  async updateSociety(current: Society, input: {churchName:string;type:SocietyType;name:string;churchAddress:string}): Promise<void> {
    const user=this.user();if(!user||current.ownerId!==user.uid||this.selected()?.id!==current.id)throw new Error('Sociedade indisponível.');
    const address={postalCode:'',street:input.churchAddress,number:'',complement:'',neighborhood:'',city:'',state:''};
    const updated={...current,churchName:input.churchName,type:input.type,name:input.name,churchAddress:address};
    await runInInjectionContext(this.injector,()=>updateDoc(doc(this.firestore,`societies/${current.id}`),{churchName:updated.churchName,type:updated.type,name:updated.name,churchAddress:address,updatedAt:serverTimestamp()}));
    if(this.user()?.uid!==user.uid||this.selected()?.id!==current.id)return;
    this.ownedSocieties=this.ownedSocieties.map(item=>item.id===current.id?updated:item);this.selected.set(updated);this.publishSocieties();
  }

  async saveMember(input: MemberInput, id: string | null): Promise<void> {
    const society = this.authorizedSociety();
    const data = normalizeMember(input);
    if (data.status === 'active' && (!id || this.members().find(item=>item.id===id)?.status !== 'active')) {
      const billing = await runInInjectionContext(this.injector, () => getDoc(doc(this.firestore, `users/${this.user()!.uid}/billing/${society.id}`)));
      const plan = billing.exists() && billing.data()['status']==='authorized' ? planFromStatus(billing.data()['plan']) : 'free';
      const limit = PLAN_LIMITS[plan].members;
      if (limit !== null && this.members().filter(item=>item.status==='active').length >= limit) throw new Error(`Seu plano permite até ${limit} membros ativos nesta sociedade. Faça upgrade para continuar.`);
    }
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
    if (!society || !this.hasSocietyAccess()) return;
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
    if (!society || !this.hasSocietyAccess()) throw new Error('Sociedade indisponível.');
    return society;
  }

  private authorizedOwnerSociety(): Society {
    const society=this.selected();if(!society||!this.isOwner())throw new Error('Somente o responsável pode convidar administradores.');return society;
  }

  private clearAll(): void {
    this.isAdmin.set(false);
    this.legalReady.set(false);this.legalAccepted.set(false);
    this.unsubscribeSocieties?.();
    this.unsubscribeSocieties = undefined;
    this.unsubscribeInvites?.();this.unsubscribeInvites=undefined;this.unsubscribeAdminInvites?.();this.unsubscribeAdminInvites=undefined;this.incomingInvites.set([]);this.incomingAdminInvites.set([]);this.societyAdmins.set([]);this.societyAdminInvites.set([]);this.ownedSocieties=[];this.adminSocieties=[];this.adminSocietyIds.clear();
    this.clearSelection();
    this.societies.set([]);
    this.societiesLoading.set(false);
    this.societiesError.set('');
  }
}
