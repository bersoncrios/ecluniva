import { Component, Injector, OnInit, inject, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore } from '@angular/fire/firestore';
import { PublicPage, PublicPost } from '../../core/public-page';
import { PublicPageService } from '../../core/public-page.service';

@Component({selector:'app-public-society-page',standalone:true,imports:[CommonModule],templateUrl:'./public-society-page.component.html',styleUrl:'./public-society-page.component.css'})
export class PublicSocietyPageComponent implements OnInit {
  readonly firestore=inject(Firestore); readonly injector=inject(Injector); readonly page=signal<PublicPage|null>(null); readonly posts=signal<PublicPost[]>([]); readonly loading=signal(true); readonly error=signal(''); readonly shareMessage=signal('');
  @Input() slug='';
  themeClass(theme:string|undefined):string{return `public-society theme-${['forest','ocean','terracotta','plum'].includes(theme||'')?theme:'forest'}`;}
  instagramLabel(value:string):string{const input=value.trim();const match=input.match(/instagram\.com\/([^/?#]+)/i);return match?`@${match[1].replace(/^@/,'')}`:`@${input.replace(/^@/,'').replace(/^\/+/, '').split(/[/?#]/,1)[0]}`;}
  instagramUrl(value:string):string{const input=value.trim();if(/^https?:\/\/([\w-]+\.)?instagram\.com\//i.test(input))return input;return `https://www.instagram.com/${this.instagramLabel(input).slice(1)}/`;}
  whatsappUrl(value:string):string{const digits=value.replace(/\D/g,'');return `https://wa.me/${digits}`;}
  postDate(value:string|null):string{return value?new Intl.DateTimeFormat('pt-BR',{dateStyle:'long',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`)):'Aviso';}
  mapUrl(value:string):string{return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;}
  async sharePage(page:PublicPage):Promise<void>{const url=location.href;const nav=navigator as Navigator & {share?:(data:ShareData)=>Promise<void>;clipboard?:Clipboard};try{if(typeof nav.share==='function')await nav.share({title:page.title,text:page.description||'Conheça esta sociedade.',url});else if(nav.clipboard)await nav.clipboard.writeText(url);this.shareMessage.set('Link da página copiado.');}catch{this.shareMessage.set('Você pode copiar o endereço desta página para compartilhar.');}}
  addToCalendar(post:PublicPost):void{if(!post.date)return;const start=post.date.replace(/-/g,'');const uid=`${post.id}@ecluniva`;const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Ecluniva//Public Page//PT-BR','BEGIN:VEVENT',`UID:${uid}`,`DTSTAMP:${start}T120000Z`,`DTSTART;VALUE=DATE:${start}`,`SUMMARY:${this.icsEscape(post.title)}`,`DESCRIPTION:${this.icsEscape(post.body)}`,`LOCATION:${this.icsEscape(post.location)}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`${post.title.toLowerCase().replace(/[^a-z0-9]+/gi,'-')||'evento'}.ics`;link.click();URL.revokeObjectURL(link.href);}
  private icsEscape(value:string):string{return value.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/[,;]/g,'\\$&');}
  ngOnInit():void{void this.load();}
  async load():Promise<void>{try{const page=await PublicPageService.findBySlug(this.firestore,this.injector,this.slug);if(!page){this.error.set('Esta página não está disponível.');return;}this.page.set(page);this.posts.set(await PublicPageService.postsFor(this.firestore,this.injector,page.id));}catch{this.error.set('Não foi possível carregar esta página.');}finally{this.loading.set(false);}}
}
