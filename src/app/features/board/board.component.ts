import { Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/data.service';
import { BOARD_ROLES, composeBoard, validBoardYear, validateBoardAssignment } from '../../core/board';
import { BoardAssignment } from '../../core/models';
import { IconComponent } from '../../icon';

@Component({ selector:'app-board', standalone:true, imports:[FormsModule,IconComponent], templateUrl:'./board.component.html' })
export class BoardComponent {
  readonly data = inject(DataService);
  readonly initialMemberId = input<string|null>(null);
  readonly savingChange = output<boolean>();
  readonly returnToMembers = output<void>();
  readonly roles = BOARD_ROLES;
  readonly entries = computed(() => composeBoard(this.data.boardAssignments(),this.data.members()));
  readonly members = computed(() => [...this.data.members()].sort((a,b) => a.name.localeCompare(b.name,'pt-BR')));
  readonly saving = signal(false);
  readonly formOpen = signal(false);
  readonly editing = signal(false);
  readonly errors = signal<Record<string,string>>({});
  readonly message = signal('');
  readonly failure = signal('');
  readonly yearError = signal('');
  readonly removing = signal<BoardAssignment|null>(null);
  yearInput = this.data.boardYear();
  memberId = '';
  role = '';
  @ViewChild('removeDialog') private removeDialog?: ElementRef<HTMLDialogElement>;
  private previousFocus: HTMLElement|null = null;
  private context = '';
  private presetHandled = '';
  private destroyed = false;

  constructor() {
    effect(() => {
      const context = `${this.data.user()?.uid ?? ''}/${this.data.selected()?.id ?? ''}/${this.data.boardYear()}`;
      if (context !== this.context) {
        this.context = context;
        this.yearInput = this.data.boardYear();
        this.formOpen.set(false); this.editing.set(false);
        this.memberId = ''; this.role = '';
        this.errors.set({}); this.message.set(''); this.failure.set(''); this.yearError.set('');
        this.closeRemoval(true);
      }
      const preset = this.initialMemberId();
      const key = `${this.data.user()?.uid ?? ''}/${this.data.selected()?.id ?? ''}/${preset ?? ''}`;
      if (preset && key !== this.presetHandled && !this.data.boardLoading() && !this.data.boardError()) {
        if (this.data.members().some(member => member.id === preset)) {
          this.presetHandled = key;
          const existing = this.data.boardAssignments().find(entry => entry.memberId === preset);
          this.openForm(existing);
          this.memberId = preset;
        }
      }
    });
    inject(DestroyRef).onDestroy(() => { this.savingChange.emit(false); this.destroyed = true; this.removeDialog?.nativeElement.close(); });
  }

  viewYear(): void {
    if (this.saving()) return;
    const year = Number(this.yearInput);
    if (!validBoardYear(year)) { this.yearError.set('Informe um ano entre 1900 e 2100.'); return; }
    this.yearError.set('');
    if (year !== this.data.boardYear()) this.data.loadBoard(year);
  }

  openForm(entry?: BoardAssignment): void {
    if (this.saving()) return;
    this.editing.set(!!entry); this.memberId = entry?.memberId ?? ''; this.role = entry?.role ?? '';
    this.errors.set({}); this.failure.set(''); this.message.set(''); this.formOpen.set(true);
    setTimeout(() => document.getElementById(entry ? 'board-role' : 'board-member')?.focus());
  }

  cancelForm(): void {
    if (this.saving()) return;
    this.formOpen.set(false); this.errors.set({}); this.failure.set('');
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    const year = this.data.boardYear();
    const errors = validateBoardAssignment(year,this.memberId,this.role,this.data.members());
    this.errors.set(errors); this.failure.set(''); this.message.set('');
    if (Object.keys(errors).length) {
      setTimeout(() => document.getElementById(errors['memberId'] ? 'board-member' : 'board-role')?.focus()); return;
    }
    const context = this.context;
    this.setSaving(true);
    try {
      await this.data.saveBoardAssignment(year,this.memberId,this.role);
      if (this.current(context)) { this.formOpen.set(false); this.message.set('Participação salva.'); }
    } catch {
      if (this.current(context)) this.failure.set('Não foi possível salvar a participação. Os dados continuam no formulário. Tente novamente.');
    } finally { this.setSaving(false); }
  }

  requestRemoval(entry: BoardAssignment): void {
    if (this.saving()) return;
    this.previousFocus = document.activeElement as HTMLElement;
    this.failure.set(''); this.removing.set(entry);
    this.removeDialog?.nativeElement.showModal();
    setTimeout(() => this.removeDialog?.nativeElement.querySelector<HTMLButtonElement>('button')?.focus());
  }

  closeRemoval(force = false): void {
    if (!force && this.saving()) return;
    this.removeDialog?.nativeElement.close(); this.removing.set(null);
    this.previousFocus?.focus();
  }

  cancelRemoval(event: Event): void { event.preventDefault(); this.closeRemoval(); }
  removalName(): string { return this.data.members().find(member => member.id === this.removing()?.memberId)?.name ?? 'Este membro'; }

  async remove(): Promise<void> {
    const entry = this.removing();
    if (!entry || this.saving()) return;
    const context = this.context;
    this.setSaving(true); this.failure.set('');
    try {
      await this.data.removeBoardAssignment(entry);
      if (this.current(context)) {
        this.closeRemoval(true);
        if (this.memberId === entry.memberId) this.formOpen.set(false);
        this.message.set('Participação removida da diretoria.');
      }
    } catch { if (this.current(context)) this.failure.set('Não foi possível remover a participação. Tente novamente.'); }
    finally { this.setSaving(false); }
  }

  private current(context: string): boolean {
    return !this.destroyed && context === `${this.data.user()?.uid ?? ''}/${this.data.selected()?.id ?? ''}/${this.data.boardYear()}`;
  }
  private setSaving(value: boolean): void { this.saving.set(value); if (!this.destroyed) this.savingChange.emit(value); }
}
