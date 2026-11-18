import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';

interface AdminSubscription {
  id: string; societyId: string; societyName: string; churchName: string; ownerId: string;
  plan: string; planName: string; status: string; subscriptionId: string; updatedAt: string | null;
}

@Component({
  selector: 'app-admin', standalone: true, imports: [CommonModule],
  template: `
    <section class="admin-page">
      <div class="page-heading"><div><div class="eyebrow">ADMINISTRAÇÃO DA PLATAFORMA</div><h1 tabindex="-1">Painel administrativo</h1><p>Visão geral das assinaturas registradas no Ecluniva.</p></div><button class="button secondary" type="button" (click)="load()" [disabled]="loading()">{{ loading() ? 'Atualizando…' : 'Atualizar' }}</button></div>
      @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
      @if (loading() && !subscriptions().length) { <div class="panel loading" role="status">Carregando assinaturas…</div> }
      @else {
        <div class="stats-grid admin-stats">
          <article class="panel stat-card"><div class="stat-top"><span>Assinaturas ativas</span></div><strong class="stat-number">{{ activeCount() }}</strong><p>Status autorizado pelo provedor</p></article>
          <article class="panel stat-card"><div class="stat-top"><span>Pagamentos pendentes</span></div><strong class="stat-number">{{ pendingCount() }}</strong><p>Aguardando confirmação</p></article>
          <article class="panel stat-card"><div class="stat-top"><span>Registros de assinatura</span></div><strong class="stat-number">{{ subscriptions().length }}</strong><p>Inclui estados ativos e encerrados</p></article>
        </div>
        <section class="panel admin-table-panel"><div class="admin-table-heading"><div><h2>Assinaturas</h2><p>Sociedade, responsável, plano e situação</p></div><label>Filtrar <select [value]="filter()" (change)="filter.set($any($event.target).value)"><option value="all">Todas</option><option value="authorized">Ativas</option><option value="pending">Pendentes</option><option value="cancelled">Canceladas</option></select></label></div>
          @if (visible().length) { <div class="table-scroll"><table><thead><tr><th>Sociedade</th><th>Responsável (UID)</th><th>Plano</th><th>Status</th><th>Atualizada</th></tr></thead><tbody>@for (item of visible(); track item.id) {<tr><td><strong>{{ item.societyName }}</strong><small>{{ item.churchName }}</small></td><td class="uid-cell">{{ item.ownerId }}</td><td>{{ item.planName }}</td><td><span class="admin-status" [class.status-active]="item.status === 'authorized'">{{ statusLabel(item.status) }}</span></td><td>{{ item.updatedAt ? (item.updatedAt | date:'dd/MM/yyyy HH:mm') : '—' }}</td></tr>}</tbody></table></div> }
          @else { <p class="empty-state">Nenhuma assinatura corresponde a este filtro.</p> }
        </section>
      }
    </section>
  `,
  styles: [`
    .admin-page{display:grid;gap:24px}.admin-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.admin-table-panel{padding:24px;overflow:hidden}.admin-table-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px}.admin-table-heading h2{margin:0}.admin-table-heading p{margin:6px 0 0;color:var(--muted,#52645b)}.admin-table-heading label{display:flex;align-items:center;gap:8px}.admin-table-heading select{padding:10px;border:1px solid #75867c;border-radius:8px;background:white;color:#172d25}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:14px 12px;border-bottom:1px solid #dce4de;white-space:nowrap}th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#52645b}td strong,td small{display:block}td small{margin-top:4px;color:#52645b}.uid-cell{font-family:ui-monospace,monospace;font-size:12px}.admin-status{display:inline-block;padding:5px 9px;border-radius:20px;background:#f2eee4;color:#55431c;font-size:12px;font-weight:600}.admin-status.status-active{background:#eaf3ee;color:#103b31}.empty-state{padding:24px;text-align:center;color:#52645b}
    @media(max-width:760px){.admin-stats{grid-template-columns:1fr}.admin-table-panel{padding:16px}.admin-table-heading{align-items:flex-start;flex-direction:column}.table-scroll{margin:0 -16px;padding:0 16px}}
  `]
})
export class AdminComponent {
  private readonly auth = inject(Auth);
  readonly subscriptions = signal<AdminSubscription[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly filter = signal('all');
  readonly visible = () => this.subscriptions().filter(item => this.filter() === 'all' || item.status === this.filter());
  readonly activeCount = () => this.subscriptions().filter(item => item.status === 'authorized').length;
  readonly pendingCount = () => this.subscriptions().filter(item => item.status === 'pending').length;

  constructor() { void this.load(); }

  async load(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || this.loading()) return;
    this.loading.set(true); this.error.set('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/subscriptions', { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json() as { subscriptions?: AdminSubscription[]; error?: string };
      if (!response.ok) throw new Error(body.error || 'Não foi possível carregar as assinaturas.');
      this.subscriptions.set(body.subscriptions || []);
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Não foi possível carregar as assinaturas.'); }
    finally { this.loading.set(false); }
  }

  statusLabel(status: string): string {
    return ({ authorized: 'Ativa', pending: 'Pendente', paused: 'Pausada', cancelled: 'Cancelada', cancelled_by_user: 'Cancelada', rejected: 'Recusada' } as Record<string, string>)[status] || status;
  }
}
