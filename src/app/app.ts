import { Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from './core/data.service';
import { Member, MemberInput, Society, SocietyAdmin, SocietyAdminInvite, SocietyType, SOCIETY_TYPES, STATES } from './core/models';
import { emptyMember, validateMember, filterMembers, todayISO, displayDate, birthdayEvents, summarize } from './core/domain';
import { exportRoster } from './core/export';
import { environment } from '../environments/environment';
import { IconComponent } from './icon';
import { BoardComponent } from './features/board/board.component';
import { MinutesComponent } from './features/minutes/minutes.component';
import { CommunicationComponent } from './features/communication/communication.component';
import { CommunicationInvite } from './core/communication';
import { PublicAttendanceComponent } from './features/attendance/public-attendance.component';
import { NoticesComponent } from './features/notices/notices.component';
import { BillingComponent } from './features/billing/billing.component';
import { BillingService } from './core/billing.service';
import { PlanKey } from './core/plans';
import { lookupPostalCode, postalCodeDigits, PostalCodeNotFoundError } from './core/viacep';
import { PublicMemberUpdateComponent } from './features/members/public-member-update.component';
import { AdminComponent } from './features/admin/admin.component';
import { SupportComponent } from './features/support/support.component';
import { PublicPageComponent } from './features/public-page/public-page.component';
import { PublicSocietyPageComponent } from './features/public-page/public-society-page.component';
import { LegalDocumentComponent } from './features/legal/legal-document.component';
import { LegalConsentComponent } from './features/legal/legal-consent.component';
import type { LegalDocument } from './core/legal';

type Page = 'overview' | 'members' | 'birthdays' | 'member' | 'board' | 'minutes' | 'notices' | 'communication' | 'billing' | 'public' | 'admin' | 'support';
type DateParts = { day:string; month:string; year:string };
@Component({ selector:'app-root', standalone:true, imports:[CommonModule, FormsModule, IconComponent, BoardComponent, MinutesComponent, NoticesComponent, CommunicationComponent, PublicAttendanceComponent, BillingComponent, PublicMemberUpdateComponent, AdminComponent, SupportComponent, PublicPageComponent, PublicSocietyPageComponent, LegalDocumentComponent, LegalConsentComponent], templateUrl:'./app.html' })
export class AppComponent {
  readonly data = inject(DataService);
  readonly billing = inject(BillingService);
  private readonly planLabels: Record<PlanKey, string> = { free: 'Grátis', essential: 'Essencial', professional: 'Profissional', institutional: 'Institucional' };
  private readonly destroyRef = inject(DestroyRef);
  readonly isEmulator = environment.useEmulators;
  readonly isProduction = environment.production;
  readonly types = SOCIETY_TYPES;
  readonly states = STATES;
  readonly page = signal<Page>('overview');
  readonly pendingInvites=computed(()=>this.data.incomingInvites().filter(invite=>invite.status==='pending'));
  readonly pendingAdminInvites=computed(()=>this.data.incomingAdminInvites().filter(invite=>invite.status==='pending'));
  readonly presenceEntry=signal(location.hash.startsWith('#presenca/'));
  readonly memberUpdateEntry=signal(location.hash.startsWith('#atualizar-cadastro/'));
  readonly inviteEntry=location.hash==='#convites';
  readonly showGuide=signal(location.hash==='#como-usar');
  readonly showFaq=signal(location.hash==='#faq');
  readonly publicPageSlug=signal<string|null>(location.pathname.match(/^\/s\/([^/]+)\/?$/)?.[1] ? decodeURIComponent(location.pathname.match(/^\/s\/([^/]+)\/?$/)![1]) : null);
  readonly legalDocument=signal<LegalDocument|null>(location.hash==='#termos'?'terms':location.hash==='#privacidade'?'privacy':null);
  readonly boardMemberId = signal<string|null>(null);
  readonly query = signal('');
  readonly status = signal<'all'|'active'|'inactive'>('active');
  readonly memberSort = signal<'name'|'status'|'birthday'>('name');
  readonly memberPage = signal(1);
  readonly memberPageSize = 10;
  readonly selectedMemberIds = signal<Set<string>>(new Set());
  readonly memberDraftAvailable = signal(false);
  readonly selectedMembers = computed(() => this.data.members().filter(member => this.selectedMemberIds().has(member.id)));
  readonly today = signal(todayISO());
  readonly results = computed(() => {
    const members = filterMembers(this.data.members(), this.query(), this.status());
    const sort = this.memberSort();
    return [...members].sort((a,b) => sort === 'status'
      ? a.status.localeCompare(b.status) || a.name.localeCompare(b.name, 'pt-BR')
      : sort === 'birthday'
        ? (a.birthDate || '9999-99-99').slice(5).localeCompare((b.birthDate || '9999-99-99').slice(5)) || a.name.localeCompare(b.name, 'pt-BR')
        : a.name.localeCompare(b.name, 'pt-BR'));
  });
  readonly memberTotalPages = computed(() => Math.max(1, Math.ceil(this.results().length / this.memberPageSize)));
  readonly memberCurrentPage = computed(() => Math.min(this.memberPage(), this.memberTotalPages()));
  readonly pagedResults = computed(() => {
    const page = this.memberCurrentPage();
    const start = (page - 1) * this.memberPageSize;
    return this.results().slice(start, start + this.memberPageSize);
  });
  readonly memberRangeStart = computed(() => this.results().length ? (this.memberCurrentPage() - 1) * this.memberPageSize + 1 : 0);
  readonly memberRangeEnd = computed(() => Math.min(this.memberRangeStart() + this.memberPageSize - 1, this.results().length));
  readonly summary = computed(() => summarize(this.data.members()));
  readonly birthdays = computed(() => birthdayEvents(this.data.members(), this.today()));
  readonly notice = signal('');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly loginBusy = signal(false);
  readonly createMode = signal(false);
  readonly societyEditOpen = signal(false);
  readonly societyEditError = signal('');
  readonly societyEditBusy = signal(false);
  readonly fieldErrors = signal<Record<string,string>>({});
  readonly errorKeys = computed(() => Object.keys(this.fieldErrors()));
  readonly societyErrors = signal<Record<string,string>>({});
  readonly statusMember = signal<Member|null>(null);
  readonly exportFormat = signal<'pdf'|'xlsx'>('pdf');
  readonly exportBusy = signal(false);
  readonly dialogError = signal('');
  readonly dialogKind = signal<'status'|'export'|'details'|'member-link'|null>(null);
  readonly detailMemberId = signal<string|null>(null);
  readonly detailMember = computed(() => this.data.members().find(member => member.id === this.detailMemberId()) ?? null);
  readonly memberUpdateLink=signal('');
  readonly memberUpdateLinkName=signal('');
  readonly memberUpdateLinkBusy=signal(false);
  readonly memberUpdateLinkCopied=signal(false);
  readonly postalLoading = signal(false);
  readonly postalMessage = signal('');
  readonly postalRetry = signal(false);
  readonly date = displayDate;
  member: MemberInput = emptyMember();
  editingId: string|null = null;
  birth: DateParts = {day:'',month:'',year:''};
  received: DateParts = {day:'',month:'',year:''};
  churchName = '';
  churchAddress = '';
  editChurchName = '';
  editChurchAddress = '';
  editSocietyType: SocietyType = 'UPH';
  editSocietyName = '';
  societyType: SocietyType = 'UPH';
  societyName = '';
  emulatorEmail = '';
  emulatorPassword = '';
  @ViewChild('confirmation') private confirmation?: ElementRef<HTMLDialogElement>;
  private previousFocus: HTMLElement|null = null;
  private previousContext = '';
  private postalController: AbortController | null = null;
  private postalVersion = 0;
  private lastPostalCode: string | null = null;

  constructor() {
    effect(() => {
      const context = `${this.data.user()?.uid ?? ''}/${this.data.selected()?.id ?? ''}`;
      if (context !== this.previousContext) {
        this.cancelPostalLookup();
        this.previousContext = context;
        this.busy.set(false);
        this.boardMemberId.set(null);
        this.page.set(this.data.selected()&&!this.data.hasSocietyAccess()?'communication':'overview');
        this.query.set('');
        this.status.set('active');
        this.memberSort.set('name');
        this.memberPage.set(1);
        this.member = emptyMember();
        this.editingId = null;
        this.fieldErrors.set({});
        this.notice.set('');
        this.error.set('');
        this.closeDialog(true);
      }
    });
    const refreshDay = ():void => { this.today.set(todayISO()); };
    const timer = window.setInterval(refreshDay, 30000);
    const navigateBack = ():void => {
      this.presenceEntry.set(location.hash.startsWith('#presenca/'));
      this.memberUpdateEntry.set(location.hash.startsWith('#atualizar-cadastro/'));
      this.showGuide.set(location.hash==='#como-usar');
      this.showFaq.set(location.hash==='#faq');
      this.legalDocument.set(location.hash==='#termos'?'terms':location.hash==='#privacidade'?'privacy':null);
      if (this.busy() || this.exportBusy()) { history.pushState({}, '', `#${this.page()}`); return; }
      this.boardMemberId.set(null);
      this.cancelPostalLookup();
      const hash = location.hash.slice(1);
      const page = (['overview','members','birthdays','board','minutes','notices','communication','billing','public','admin','support'].includes(hash) ? hash : 'overview') as Page;
      this.page.set(this.data.selected()&&!this.data.hasSocietyAccess()&&!['admin','support'].includes(page)?'communication':page);
      refreshDay();
    };
    window.addEventListener('popstate', navigateBack);
    document.addEventListener('visibilitychange', refreshDay);
    this.destroyRef.onDestroy(() => {
      this.cancelPostalLookup();
      window.clearInterval(timer);
      window.removeEventListener('popstate', navigateBack);
      document.removeEventListener('visibilitychange', refreshDay);
    });
  }

  skipToMain(event:Event):void{if(!this.presenceEntry())return;event.preventDefault();const main=document.getElementById('main');main?.setAttribute('tabindex','-1');main?.focus();}
  reloadApp():void{location.reload();}
  currentPlanName():string{return this.planLabels[this.billing.plan()];}
  openGuide(event:Event):void{event.preventDefault();this.showFaq.set(false);this.showGuide.set(true);history.pushState({},'','#como-usar');window.scrollTo({top:0,behavior:'instant'});}
  openFaq(event:Event):void{event.preventDefault();this.showGuide.set(false);this.showFaq.set(true);history.pushState({},'','#faq');window.scrollTo({top:0,behavior:'instant'});}
  openLegal(kind:LegalDocument,event?:Event):void{event?.preventDefault();this.showGuide.set(false);this.showFaq.set(false);this.legalDocument.set(kind);history.pushState({},'',kind==='terms'?'#termos':'#privacidade');window.scrollTo({top:0,behavior:'instant'});}
  openLanding(event:Event):void{event.preventDefault();this.showGuide.set(false);this.showFaq.set(false);history.pushState({},'','/');window.scrollTo({top:0,behavior:'instant'});}

  async login(emulator = false): Promise<void> {
    if (this.loginBusy()) return;
    this.loginBusy.set(true);
    this.error.set('');
    try {
      if (emulator) await this.data.emulatorLogin(this.emulatorEmail.trim(), this.emulatorPassword);
      else await this.data.login();
    } catch (cause: unknown) {
      const code = (cause as {code?:string}).code;
      this.error.set(code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
        ? 'A entrada foi cancelada. Você pode tentar novamente quando quiser.'
        : code === 'auth/popup-blocked'
          ? 'Seu navegador bloqueou a janela de acesso. Permita a janela e tente novamente.'
          : 'Não foi possível entrar. Verifique sua conexão e tente novamente.');
    } finally { this.loginBusy.set(false); }
  }

  async logout(): Promise<void> {
    if (this.busy() || this.exportBusy()) return;
    this.cancelPostalLookup();
    this.error.set('');
    this.member = emptyMember();
    this.closeDialog(true);
    try { await this.data.logout(); }
    catch { this.error.set('Não foi possível sair. Tente novamente.'); }
  }

  select(society: Society): void {
    this.createMode.set(false);
    this.data.select(society);
    this.navigate(this.data.hasSocietyAccess()?'overview':'communication');
  }

  societyAccessLabel(society: Society): string {
    if (society.ownerId === this.data.user()?.uid) return 'Organizar sociedade';
    if (this.data.isSocietyAdminFor(society.id)) return 'Acessar organização';
    return 'Acessar Comunicação';
  }

  async acceptInvite(invite:CommunicationInvite):Promise<void>{
    if(this.busy())return;this.busy.set(true);this.error.set('');
    try{await this.data.acceptCommunicationInvite(invite);this.notice.set('Convite aceito. Abra a sociedade para acessar Comunicação.');}catch(error){this.error.set(error instanceof Error?error.message:'Não foi possível aceitar o convite.');}finally{this.busy.set(false);}
  }

  async acceptAdminInvite(invite:SocietyAdminInvite):Promise<void>{
    if(this.busy())return;this.busy.set(true);this.error.set('');
    try{await this.data.acceptSocietyAdminInvite(invite);this.notice.set('Convite aceito. A sociedade já está disponível para você.');}
    catch(error){this.error.set(error instanceof Error?error.message:'Não foi possível aceitar o convite de administração.');}
    finally{this.busy.set(false);}
  }

  async rejectAdminInvite(invite:SocietyAdminInvite):Promise<void>{
    if(this.busy())return;this.busy.set(true);this.error.set('');
    try{await this.data.rejectSocietyAdminInvite(invite);this.notice.set('Convite de administração recusado.');}
    catch(error){this.error.set(error instanceof Error?error.message:'Não foi possível recusar o convite.');}
    finally{this.busy.set(false);}
  }

  switchSociety(): void {
    if (this.busy() || this.exportBusy()) return;
    this.cancelPostalLookup();
    this.data.clearSelection();
    this.createMode.set(false);
    this.churchName = ''; this.churchAddress = ''; this.societyName = ''; this.societyErrors.set({});
  }

  async createSociety(): Promise<void> {
    if (this.busy()) return;
    const errors: Record<string,string> = {};
    if (this.churchName.trim().length < 2 || this.churchName.trim().length > 160) errors['churchName'] = 'Informe a igreja com 2 a 160 caracteres.';
    if (this.societyName.trim().length < 2 || this.societyName.trim().length > 120) errors['societyName'] = 'Informe o nome da unidade com 2 a 120 caracteres.';
    if (!(this.types as readonly string[]).includes(this.societyType)) errors['societyType'] = 'Escolha um tipo de sociedade.';
    this.societyErrors.set(errors);
    if (Object.keys(errors).length) { setTimeout(() => document.getElementById(Object.keys(errors)[0])?.focus()); return; }
    this.busy.set(true); this.error.set('');
    try {
      await this.data.createSociety(this.churchName, this.societyType, this.societyName, this.churchAddress);
      this.createMode.set(false);
      this.churchName = ''; this.churchAddress = ''; this.societyName = '';
      this.notice.set('Sociedade criada. Agora você pode cadastrar os membros.');
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Não foi possível criar a sociedade. Os dados continuam no formulário. Tente novamente.'); }
    finally { this.busy.set(false); }
  }

  beginSocietyEdit(): void {
    const society=this.data.selected();if(!society||!this.data.isOwner())return;
    this.editChurchName=society.churchName;this.editChurchAddress=society.churchAddress?.street??'';
    this.editSocietyType=society.type;this.editSocietyName=society.name;this.societyEditError.set('');this.societyEditOpen.set(true);
  }

  async saveSocietyEdit(): Promise<void> {
    const society=this.data.selected();if(!society||this.societyEditBusy())return;
    if(this.editChurchName.trim().length<2||this.editChurchName.trim().length>160||this.editSocietyName.trim().length<2||this.editSocietyName.trim().length>120){this.societyEditError.set('Informe nome válido para a igreja e para a sociedade.');return;}
    this.societyEditBusy.set(true);this.societyEditError.set('');
    try{await this.data.updateSociety(society,{churchName:this.editChurchName.trim(),type:this.editSocietyType,name:this.editSocietyName.trim(),churchAddress:this.editChurchAddress.trim()});this.societyEditOpen.set(false);this.notice.set('Dados da sociedade atualizados.');}
    catch(error){this.societyEditError.set(error instanceof Error?error.message:'Não foi possível salvar os dados da sociedade.');}
    finally{this.societyEditBusy.set(false);}
  }

  navigate(page: Page): void {
    if (this.busy() || this.exportBusy()) return;
    if (page === 'admin' && !this.data.isAdmin()) { this.page.set('overview'); return; }
    this.cancelPostalLookup();
    this.page.set(this.data.selected()&&!this.data.hasSocietyAccess()&&!['admin','support'].includes(page)?'communication':page);
    this.boardMemberId.set(null);
    this.today.set(todayISO());
    this.error.set('');
    history.pushState({}, '', `#${page}`);
    window.scrollTo({top:0,behavior:'instant'});
    setTimeout(() => document.querySelector<HTMLElement>('main h1')?.focus());
  }

  newMember(): void {
    this.cancelPostalLookup();
    this.member = emptyMember(); this.editingId = null;
    this.memberDraftAvailable.set(this.hasMemberDraft());
    this.birth = {day:'',month:'',year:''}; this.received = {day:'',month:'',year:''};
    this.fieldErrors.set({}); this.notice.set(''); this.memberDraftAvailable.set(false);
    this.navigate('member');
  }

  editMember(member: Member): void {
    this.cancelPostalLookup();
    this.member = { name:member.name, birthDate:member.birthDate, receivedDate:member.receivedDate,
      office:member.office,address:{...member.address},phone:member.phone,email:member.email,status:member.status,notes:member.notes };
    this.editingId = member.id;
    this.birth = this.parts(member.birthDate); this.received = this.parts(member.receivedDate);
    this.fieldErrors.set({}); this.notice.set('');
    this.navigate('member');
  }

  async saveMember(): Promise<void> {
    if (this.busy()) return;
    this.cancelPostalLookup();
    this.member.birthDate = this.iso(this.birth);
    this.member.receivedDate = this.iso(this.received);
    this.fieldErrors.set(validateMember(this.member, this.today()));
    this.error.set('');
    if (this.errorKeys().length) { setTimeout(() => document.getElementById('form-errors')?.focus()); return; }
    this.busy.set(true);
    const societyId = this.data.selected()?.id;
    const editing = this.editingId;
    try {
      await this.data.saveMember(this.member, editing);
      if (societyId !== this.data.selected()?.id) return;
      this.member = emptyMember(); this.editingId = null;
      this.clearMemberDraft();
      this.busy.set(false);
      this.navigate('members');
      this.notice.set(editing ? 'Cadastro atualizado.' : 'Membro cadastrado.');
    } catch (error) {
      if (societyId === this.data.selected()?.id) this.error.set(error instanceof Error ? error.message : 'Não foi possível salvar. Seus dados continuam no formulário. Tente novamente.');
    } finally { this.busy.set(false); }
  }

  openBoardForMember(): void {
    if (!this.editingId || this.busy() || this.exportBusy()) return;
    const id = this.editingId;
    const year = Number(todayISO().slice(0,4));
    if (this.data.boardYear() !== year) this.data.loadBoard(year);
    this.navigate('board');
    this.boardMemberId.set(id);
  }

  currentBoardRole(): string|null {
    if (this.data.boardYear() !== Number(this.today().slice(0,4)) || this.data.boardLoading() || this.data.boardError()) return null;
    return this.data.boardAssignments().find(entry => entry.memberId === this.editingId)?.role ?? null;
  }

  postalCodeChanged(value: string): void {
    this.member.address.postalCode = value;
    const code = postalCodeDigits(value);
    if (code && code === this.lastPostalCode) return;
    this.cancelPostalLookup();
    if (code && this.page() === 'member' && !this.busy()) void this.findPostalAddress(code);
  }

  retryPostalLookup(): void {
    const code = postalCodeDigits(this.member.address.postalCode);
    if (!code || this.busy() || this.postalLoading() || this.page() !== 'member') return;
    this.cancelPostalLookup();
    void this.findPostalAddress(code);
  }

  private async findPostalAddress(code: string): Promise<void> {
    const controller = new AbortController();
    this.postalController = controller;
    const version = ++this.postalVersion;
    const member = this.member;
    const before = {...member.address};
    const societyId = this.data.selected()?.id;
    const uid = this.data.user()?.uid;
    const current = (): boolean => version === this.postalVersion && this.member === member
      && this.page() === 'member' && this.data.selected()?.id === societyId && this.data.user()?.uid === uid
      && postalCodeDigits(this.member.address.postalCode) === code;
    this.lastPostalCode = code;
    this.postalLoading.set(true); this.postalRetry.set(false); this.postalMessage.set('Buscando endereço…');
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const address = await lookupPostalCode(code, controller.signal);
      if (!current()) return;
      if (controller.signal.aborted) throw new Error('Consulta de CEP cancelada por tempo limite.');
      for (const field of ['street', 'neighborhood', 'city', 'state'] as const) {
        if (member.address[field] === before[field]) member.address[field] = address[field];
      }
      this.postalMessage.set(!address.street || !address.neighborhood
        ? 'CEP encontrado. Complete o logradouro e o bairro, se necessário, e confira os demais dados.'
        : 'Endereço encontrado. Confira os dados e informe número e complemento, se houver.');
    } catch (error: unknown) {
      if (!current()) return;
      this.postalRetry.set(true);
      this.postalMessage.set(error instanceof PostalCodeNotFoundError
        ? 'CEP não encontrado. Confira o CEP ou preencha o endereço manualmente.'
        : 'Não foi possível consultar o CEP. Preencha o endereço manualmente ou tente novamente.');
    } finally {
      window.clearTimeout(timeout);
      if (current()) { this.postalLoading.set(false); this.postalController = null; }
    }
  }

  private cancelPostalLookup(): void {
    this.postalVersion++;
    this.postalController?.abort();
    this.postalController = null;
    this.lastPostalCode = null;
    this.postalLoading.set(false); this.postalMessage.set(''); this.postalRetry.set(false);
  }

  viewMember(member: Member): void {
    this.detailMemberId.set(member.id);
    this.openDialog('details');
  }

  async inviteMemberAsAdmin(member: Member): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true); this.dialogError.set('');
    try { await this.data.inviteSocietyAdmin(member); this.notice.set(`Convite de administrador enviado para ${member.email}.`); this.closeDialog(); }
    catch (error) { this.dialogError.set(error instanceof Error ? error.message : 'Não foi possível criar o convite.'); }
    finally { this.busy.set(false); }
  }

  async removeMemberAsAdmin(member:Member,admin:SocietyAdmin):Promise<void>{
    if(this.busy())return;
    this.busy.set(true);this.dialogError.set('');
    try{await this.data.removeSocietyAdmin(admin);this.notice.set(`Acesso de administrador removido de ${member.name}.`);this.closeDialog();}
    catch(error){this.dialogError.set(error instanceof Error?error.message:'Não foi possível remover o administrador.');}
    finally{this.busy.set(false);}
  }

  async cancelMemberAdminInvite(member:Member,invite:SocietyAdminInvite):Promise<void>{
    if(this.busy())return;
    this.busy.set(true);this.dialogError.set('');
    try{await this.data.cancelSocietyAdminInvite(invite);this.notice.set(`Convite de administrador de ${member.name} cancelado.`);this.closeDialog();}
    catch(error){this.dialogError.set(error instanceof Error?error.message:'Não foi possível cancelar o convite.');}
    finally{this.busy.set(false);}
  }

  async createMemberUpdateLink(member:Member):Promise<void>{
    const society=this.data.selected(),user=this.data.user();
    if(!society||!user||!this.data.isOwner()||this.memberUpdateLinkBusy())return;
    this.memberUpdateLinkBusy.set(true);this.dialogError.set('');this.memberUpdateLinkCopied.set(false);
    try{
      const token=await user.getIdToken();
      const response=await fetch('/api/member-update',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action:'create',societyId:society.id,memberId:member.id})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'Não foi possível gerar o link.');
      const url=new URL(location.pathname,location.origin);url.hash=`atualizar-cadastro/${result.token}`;
      this.memberUpdateLink.set(url.toString());this.memberUpdateLinkName.set(member.name);
      this.closeDialog(true);this.openDialog('member-link');
    }catch(error){this.dialogError.set(error instanceof Error?error.message:'Não foi possível gerar o link. Tente novamente.');}
    finally{this.memberUpdateLinkBusy.set(false);}
  }

  async copyMemberUpdateLink():Promise<void>{
    try{await navigator.clipboard.writeText(this.memberUpdateLink());this.memberUpdateLinkCopied.set(true);}
    catch{this.dialogError.set('Não foi possível copiar automaticamente. Selecione e copie o link exibido.');}
  }

  sendMemberUpdateLink():void{
    const name=this.memberUpdateLinkName()||'Olá';
    const message=`Olá, ${name}! Acesse este link seguro para conferir e atualizar seus dados cadastrais na Ecluniva: ${this.memberUpdateLink()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');
  }

  editDetailMember(): void {
    const member = this.detailMember();
    if (!member) return;
    this.closeDialog();
    this.editMember(member);
  }

  requestStatus(member: Member): void {
    this.statusMember.set(member); this.openDialog('status');
  }

  requestEditingStatus(): void {
    const member = this.data.members().find(item => item.id === this.editingId);
    if (member) this.requestStatus(member);
  }

  async updateStatus(): Promise<void> {
    const member = this.statusMember();
    const societyId = this.data.selected()?.id;
    if (!member || this.busy()) return;
    this.busy.set(true); this.dialogError.set('');
    const status = member.status === 'active' ? 'inactive' : 'active';
    try {
      await this.data.setStatus(member, status);
      if (societyId !== this.data.selected()?.id) return;
      if (this.editingId === member.id) this.member.status = status;
      this.busy.set(false); this.closeDialog();
      this.notice.set(status === 'active' ? 'Membro reativado.' : 'Membro inativado.');
    } catch { if (societyId === this.data.selected()?.id) this.dialogError.set('Não foi possível atualizar o status. Tente novamente.'); }
    finally { this.busy.set(false); }
  }

  openExport(): void {
    if (!this.results().length || this.data.membersLoading() || this.data.membersError()) return;
    this.exportFormat.set('pdf'); this.openDialog('export');
  }

  async generateExport(): Promise<void> {
    const society = this.data.selected();
    if (!society || !this.results().length || this.exportBusy()) return;
    const members = this.selectedMembers().length ? this.selectedMembers() : [...this.results()];
    this.exportBusy.set(true); this.dialogError.set('');
    try {
      await exportRoster(this.exportFormat(), society, members, this.filterDescription());
      if (society.id !== this.data.selected()?.id) return;
      this.exportBusy.set(false); this.closeDialog();
      this.notice.set('Arquivo gerado. Confira os downloads do seu navegador.');
    } catch { if (society.id === this.data.selected()?.id) this.dialogError.set('Não foi possível gerar o arquivo. Tente novamente.'); }
    finally { this.exportBusy.set(false); }
  }

  closeDialog(force = false): void {
    if (!force && (this.busy() || this.exportBusy())) return;
    this.confirmation?.nativeElement.close();
    this.dialogKind.set(null); this.dialogError.set('');
    this.detailMemberId.set(null);
    this.previousFocus?.focus();
  }

  cancelDialog(event: Event): void {
    event.preventDefault(); this.closeDialog();
  }

  private openDialog(kind: 'status'|'export'|'details'|'member-link'): void {
    this.dialogKind.set(kind); this.dialogError.set('');
    this.previousFocus = document.activeElement as HTMLElement;
    this.confirmation?.nativeElement.showModal();
    setTimeout(() => this.confirmation?.nativeElement.querySelector<HTMLElement>(kind === 'details' ? '#dialog-title' : 'button')?.focus());
  }

  clearFilters(): void { this.query.set(''); this.status.set('active'); this.memberSort.set('name'); this.memberPage.set(1); }
  goToMemberPage(page: number): void { this.memberPage.set(Math.max(1, Math.min(page, this.memberTotalPages()))); }
  toggleMemberSelection(id: string): void { const next = new Set(this.selectedMemberIds()); next.has(id) ? next.delete(id) : next.add(id); this.selectedMemberIds.set(next); }
  pageFullySelected(): boolean { return this.pagedResults().length > 0 && this.pagedResults().every(member => this.selectedMemberIds().has(member.id)); }
  togglePageSelection(): void { const next = new Set(this.selectedMemberIds()); if (this.pageFullySelected()) this.pagedResults().forEach(member => next.delete(member.id)); else this.pagedResults().forEach(member => next.add(member.id)); this.selectedMemberIds.set(next); }
  clearMemberSelection(): void { this.selectedMemberIds.set(new Set()); }
  async bulkSetStatus(status: 'active'|'inactive'): Promise<void> { const members = this.selectedMembers(); if (!members.length || this.busy()) return; this.busy.set(true); this.error.set(''); try { await Promise.all(members.filter(member => member.status !== status).map(member => this.data.setStatus(member, status))); this.notice.set(`${members.length} ${members.length === 1 ? 'membro atualizado' : 'membros atualizados'}.`); this.clearMemberSelection(); } catch { this.error.set('Não foi possível atualizar todos os membros selecionados. Tente novamente.'); } finally { this.busy.set(false); } }
  saveMemberDraft(): void { if (this.editingId || typeof localStorage === 'undefined' || !this.data.selected()?.id) return; try { localStorage.setItem(this.memberDraftKey(), JSON.stringify({member:this.member,birth:this.birth,received:this.received})); } catch { /* optional storage */ } }
  restoreMemberDraft(): void { try { const raw = localStorage.getItem(this.memberDraftKey()); if (!raw) return; const draft = JSON.parse(raw) as {member: MemberInput; birth: DateParts; received: DateParts}; const blank = emptyMember(); this.member = {...blank,...draft.member,address:{...blank.address,...draft.member.address}}; this.birth = draft.birth || this.parts(this.member.birthDate); this.received = draft.received || this.parts(this.member.receivedDate); this.memberDraftAvailable.set(false); } catch { this.clearMemberDraft(); } }
  discardMemberDraft(): void { this.clearMemberDraft(); this.memberDraftAvailable.set(false); }
  private hasMemberDraft(): boolean { try { return typeof localStorage !== 'undefined' && !!localStorage.getItem(this.memberDraftKey()); } catch { return false; } }
  private clearMemberDraft(): void { try { localStorage.removeItem(this.memberDraftKey()); } catch { /* optional storage */ } }
  private memberDraftKey(): string { return `ecluniva:member-draft:${this.data.selected()?.id || 'unknown'}`; }
  filterDescription(): string { return `Busca: ${this.query().trim() || 'todos os nomes'} · Status: ${this.statusLabel(this.status())}`; }
  statusLabel(status: string): string { return status === 'active' ? 'Ativos' : status === 'inactive' ? 'Inativos' : 'Todos'; }
  initials(name: string): string { return name.trim().split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase(); }
  shortDate(value: string): string { const parts = value.split('-'); return `${parts[2]}/${parts[1]}`; }
  birthdayWhen(days: number): string { return days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : `Em ${days} dias`; }
  monthName(): string { return new Intl.DateTimeFormat('pt-BR', {month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${this.today()}T12:00:00Z`)); }
  upcomingEnd(): string { const date = new Date(`${this.today()}T12:00:00Z`); date.setUTCDate(date.getUTCDate()+29); return this.date(date.toISOString().slice(0,10)); }
  errorId(key:string): string { return key.replaceAll('.', '-'); }
  private parts(value: string|null): DateParts { const [year='',month='',day=''] = (value || '').split('-'); return {year,month,day}; }
  private iso(parts: DateParts): string|null {
    if (!parts.day && !parts.month && !parts.year) return null;
    if (!/^\d{1,2}$/.test(parts.day) || !/^\d{1,2}$/.test(parts.month) || !/^\d{4}$/.test(parts.year)) return 'invalid';
    return `${parts.year}-${parts.month.padStart(2,'0')}-${parts.day.padStart(2,'0')}`;
  }
}
