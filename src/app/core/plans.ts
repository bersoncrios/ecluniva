export type PlanKey = 'free' | 'essential' | 'professional' | 'institutional';
export type QuotaKey = 'societies' | 'members' | 'minutes' | 'notices';
export const PLAN_LIMITS: Record<PlanKey, Record<QuotaKey, number | null>> = {
  free: { societies: 1, members: 15, minutes: 6, notices: 6 },
  essential: { societies: 1, members: 35, minutes: 24, notices: 24 },
  professional: { societies: 3, members: 150, minutes: null, notices: null },
  institutional: { societies: null, members: null, minutes: null, notices: null },
};
export function planFromStatus(value: unknown): PlanKey { return value === 'essential' || value === 'professional' || value === 'institutional' ? value : 'free'; }
export function quotaMessage(quota: QuotaKey, limit: number): string {
  return quota === 'societies' ? `Seu plano permite até ${limit} sociedade${limit === 1 ? '' : 's'}. Faça upgrade para continuar.`
    : quota === 'members' ? `Seu plano permite até ${limit} membros ativos nesta sociedade. Faça upgrade para continuar.`
      : `Seu plano permite ${limit} ${quota === 'minutes' ? 'atas' : 'convocações'} por ano. Faça upgrade para continuar.`;
}
