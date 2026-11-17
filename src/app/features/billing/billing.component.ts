import { Component, inject, signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { DataService } from '../../core/data.service';

type PlanKey = 'essential' | 'professional' | 'institutional';
const PLANS: { key: PlanKey; name: string; price: string; description: string; featured?: boolean }[] = [
  { key: 'essential', name: 'Essencial', price: 'R$ 9,90/mês', description: '1 sociedade, até 50 membros, 24 atas e 24 convocações por ano.' },
  { key: 'professional', name: 'Profissional', price: 'R$ 29,90/mês', description: 'Até 3 sociedades, 150 membros por sociedade e uso ilimitado.', featured: true },
  { key: 'institutional', name: 'Institucional', price: 'R$ 79,90/mês', description: 'Para organizações que administram várias sociedades.' },
];
@Component({ selector: 'app-billing', standalone: true, templateUrl: './billing.component.html', styleUrl: './billing.component.css' })
export class BillingComponent {
  readonly data = inject(DataService); private readonly auth = inject(Auth); readonly plans = PLANS;
  readonly busy = signal<PlanKey | ''>(''); readonly error = signal('');
  async subscribe(plan: PlanKey): Promise<void> {
    const society = this.data.selected(), user = this.auth.currentUser; if (!society || !user || this.busy()) return;
    this.busy.set(plan); this.error.set('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/billing/checkout', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ plan, societyId: society.id }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.checkoutUrl) throw new Error(body.error || 'Não foi possível abrir o pagamento.');
      window.location.assign(body.checkoutUrl);
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Não foi possível iniciar a assinatura.'); }
    finally { this.busy.set(''); }
  }
}
