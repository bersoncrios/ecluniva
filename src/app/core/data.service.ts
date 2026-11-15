import { Injectable, Injector, inject, runInInjectionContext, signal } from '@angular/core';
import { Auth, GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';
import { Firestore, collection, query, where, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, Unsubscribe } from '@angular/fire/firestore';
import { Member, MemberInput, Society, SocietyType } from './models';
import { normalizeMember } from './domain';
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
  readonly societiesLoading = signal(false);
  readonly membersLoading = signal(false);
  readonly societiesError = signal('');
  readonly membersError = signal('');
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
    const user = this.user();
    if (!user) return;
    this.unsubscribeSocieties?.();
    this.societies.set([]);
    this.societiesError.set('');
    this.societiesLoading.set(true);
    const version = this.authVersion;
    runInInjectionContext(this.injector, () => {
      const ref = query(collection(this.firestore, 'societies'), where('ownerId', '==', user.uid));
      this.unsubscribeSocieties = onSnapshot(ref, snapshot => {
        if (version !== this.authVersion) return;
        const societies = snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as Society)
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        this.societies.set(societies);
        this.societiesLoading.set(false);
        const current = this.selected();
        if (current && !societies.some(society => society.id === current.id)) this.clearSelection();
      }, () => {
        if (version !== this.authVersion) return;
        this.societies.set([]);
        this.clearSelection();
        this.societiesLoading.set(false);
        this.societiesError.set('Não foi possível carregar suas sociedades.');
      });
    });
  }

  select(society: Society): void {
    if (society.ownerId !== this.user()?.uid || !this.societies().some(item => item.id === society.id)) return;
    this.clearSelection();
    this.selected.set(society);
    this.loadMembers();
  }

  clearSelection(): void {
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
    if (!this.societies().some(item => item.id === ref.id)) this.societies.update(items => [...items, society]);
    this.select(society);
  }

  async saveMember(input: MemberInput, id: string | null): Promise<void> {
    const society = this.authorizedSociety();
    const data = normalizeMember(input);
    await runInInjectionContext(this.injector, () => id
      ? updateDoc(doc(this.firestore, `societies/${society.id}/members/${id}`), { ...data, updatedAt: serverTimestamp() })
      : addDoc(collection(this.firestore, `societies/${society.id}/members`), { ...data, status: 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  }

  async setStatus(member: Member, status: 'active' | 'inactive'): Promise<void> {
    const society = this.authorizedSociety();
    if (!this.members().some(item => item.id === member.id)) throw new Error('Cadastro indisponível.');
    await runInInjectionContext(this.injector, () => updateDoc(doc(this.firestore, `societies/${society.id}/members/${member.id}`), { status, updatedAt: serverTimestamp() }));
  }

  private authorizedSociety(): Society {
    const society = this.selected();
    if (!society || society.ownerId !== this.user()?.uid) throw new Error('Sociedade indisponível.');
    return society;
  }

  private clearAll(): void {
    this.unsubscribeSocieties?.();
    this.unsubscribeSocieties = undefined;
    this.clearSelection();
    this.societies.set([]);
    this.societiesLoading.set(false);
    this.societiesError.set('');
  }
}
