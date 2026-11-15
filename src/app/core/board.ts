import type { BoardAssignment, BoardEntry, Member } from './models.js';

export const BOARD_ROLES = ['Presidente', 'Vice-presidente', '1º Secretário', '2º Secretário', 'Tesoureiro'] as const;
const collator = new Intl.Collator('pt-BR', {sensitivity:'base', numeric:true});
const validMemberId = (value: string): boolean => value.length > 0 && value.length <= 128 && !value.includes('/') && value !== '.' && value !== '..';
export function validBoardYear(value: number): boolean { return Number.isInteger(value) && value >= 1900 && value <= 2100; }
export function boardAssignmentId(year: number, memberId: string): string {
  if (!validBoardYear(year) || !validMemberId(memberId)) throw new Error('Ano ou membro inválido.');
  return `${year}_${memberId}`;
}
export function validateBoardAssignment(year: number, memberId: string, role: string, members: readonly Member[]): Record<string,string> {
  const errors: Record<string,string> = {};
  if (!validBoardYear(year)) errors['year'] = 'Informe um ano entre 1900 e 2100.';
  if (!validMemberId(memberId) || !members.some(member => member.id === memberId)) errors['memberId'] = 'Selecione um membro cadastrado nesta sociedade.';
  if (role.trim().length < 2 || role.trim().length > 100) errors['role'] = 'Informe o cargo com 2 a 100 caracteres.';
  return errors;
}
export function composeBoard(assignments: readonly BoardAssignment[], members: readonly Member[]): BoardEntry[] {
  const byId = new Map(members.map(member => [member.id, member]));
  const rank = (role: string): number => {
    const index = BOARD_ROLES.findIndex(suggestion => collator.compare(suggestion, role.trim()) === 0);
    return index < 0 ? BOARD_ROLES.length : index;
  };
  return assignments.map(assignment => ({...assignment,member:byId.get(assignment.memberId) ?? null})).sort((a,b) =>
    rank(a.role) - rank(b.role) || collator.compare(a.role,b.role) || collator.compare(a.member?.name ?? '',b.member?.name ?? '') || a.id.localeCompare(b.id));
}
