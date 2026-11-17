import { Component, inject, signal } from '@angular/core';
import { DataService } from '../../core/data.service';
import { environment } from '../../../environments/environment';

type PlanKey = 'essential' | 'professional' | 'institutional';
const configuredUrls = (environment as unknown as { mercadoPago?: { essentialUrl?: string; professionalUrl?: string; institutionalUrl?: string } }).mercadoPago || {};
const urls = {
  essentialUrl: configuredUrls.essentialUrl || 'https://mpago.la/1S1w9Vz',
  professionalUrl: configuredUrls.professionalUrl || 'https://mpago.la/1QLPTdn',
  institutionalUrl: configuredUrls.institutionalUrl || 'https://mpago.la/2iN97Au',
};
const PLANS: { key: PlanKey; name: string; price: string; description: string; url: string; featured?: boolean }[] = [
  { key: 'essential', name: 'Essencial', price: 'R$ 9,90/mês', description: '1 sociedade, até 50 membros, 24 atas e 24 convocações por ano.', url: urls.essentialUrl || '' },
  { key: 'professional', name: 'Profissional', price: 'R$ 29,90/mês', description: 'Até 3 sociedades, 150 membros por sociedade e uso ilimitado.', url: urls.professionalUrl || '', featured: true },
  { key: 'institutional', name: 'Institucional', price: 'R$ 79,90/mês', description: 'Para organizações que administram várias sociedades.', url: urls.institutionalUrl || '' },
];
@Component({ selector: 'app-billing', standalone: true, templateUrl: './billing.component.html', styleUrl: './billing.component.css' })
export class BillingComponent {
  readonly data = inject(DataService); readonly plans = PLANS;
  readonly busy = signal<PlanKey | ''>(''); readonly error = signal('');
  async subscribe(plan: PlanKey): Promise<void> {
    const selected = this.plans.find(item=>item.key===plan); if (!this.data.selected() || !selected?.url || this.busy()) { this.error.set('O link deste plano ainda não foi configurado.'); return; }
    this.busy.set(plan); this.error.set('');
    try {
      window.location.assign(selected.url);
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Não foi possível iniciar a assinatura.'); }
    finally { this.busy.set(''); }
  }
}
