export const SOCIETY_TYPES = ['UPH', 'SAF', 'UMP', 'UCP', 'UPA'] as const;
export type SocietyType = typeof SOCIETY_TYPES[number];
export const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] as const;
export type MemberStatus = 'active' | 'inactive';
export interface Society { id: string; ownerId: string; churchName: string; churchAddress?: Address; type: SocietyType; name: string; }
export interface Address { postalCode: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string; }
export interface MemberInput { name: string; birthDate: string | null; receivedDate: string | null; office: string; address: Address; phone: string; email: string; status: MemberStatus; notes: string; }
export interface Member extends MemberInput { id: string; }
export interface BirthdayEvent { member: Member; date: string; daysAway: number; adapted: boolean; }
export interface BoardAssignment { id: string; year: number; memberId: string; role: string; }
export interface BoardEntry extends BoardAssignment { member: Member | null; }
