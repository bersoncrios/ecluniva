import type { Society } from './models.js';

export type PublicPostType = 'event'|'notice';
export type PublicPostStatus = 'draft'|'published';
export interface PublicPage { id:string; societyId:string; slug:string; title:string; description:string; phone:string; email:string; instagram:string; whatsapp:string; address:string; published:boolean; }
export interface PublicPost { id:string; type:PublicPostType; title:string; body:string; date:string|null; time:string; location:string; status:PublicPostStatus; }
export function publicSlug(value:string):string{return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64);}
export function validPublicSlug(value:string):boolean{return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(value);}
export function emptyPublicPage(society:Society):PublicPage{return {id:society.id,societyId:society.id,slug:publicSlug(`${society.type}-${society.name}`)||society.id,title:`${society.type} · ${society.name}`,description:'',phone:'',email:'',instagram:'',whatsapp:'',address:society.churchAddress?.street||'',published:false};}
