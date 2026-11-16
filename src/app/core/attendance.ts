import type { Member } from './models';

export interface PresenceRequest {
  id: string; name: string; status: 'pending'|'confirmed'|'duplicate'|'rejected'; memberId: string;
}
export function normalizedPresenceName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
}
/** Only an exact, unique full name is safe to associate automatically. */
export function presenceMatches(name: string, members: readonly Pick<Member,'id'|'name'|'status'>[]): string[] {
  const normalized = normalizedPresenceName(name);
  if (!normalized.includes(' ')) return [];
  return members.filter(member=>member.status==='active' && normalizedPresenceName(member.name)===normalized).map(member=>member.id);
}
export function presenceToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), byte=>byte.toString(16).padStart(2,'0')).join('');
}
