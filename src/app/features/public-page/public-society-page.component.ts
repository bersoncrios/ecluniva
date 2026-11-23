import { Component, Injector, OnInit, inject, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore } from '@angular/fire/firestore';
import { PublicPage, PublicPost } from '../../core/public-page';
import { PublicPageService } from '../../core/public-page.service';

@Component({selector:'app-public-society-page',standalone:true,imports:[CommonModule],templateUrl:'./public-society-page.component.html',styleUrl:'./public-society-page.component.css'})
export class PublicSocietyPageComponent implements OnInit {
  readonly firestore=inject(Firestore); readonly injector=inject(Injector); readonly page=signal<PublicPage|null>(null); readonly posts=signal<PublicPost[]>([]); readonly loading=signal(true); readonly error=signal('');
  @Input() slug='';
  themeClass(theme:string|undefined):string{return `public-society theme-${['forest','ocean','terracotta','plum'].includes(theme||'')?theme:'forest'}`;}
  instagramLabel(value:string):string{const input=value.trim();const match=input.match(/instagram\.com\/([^/?#]+)/i);return match?`@${match[1].replace(/^@/,'')}`:`@${input.replace(/^@/,'').replace(/^\/+/, '').split(/[/?#]/,1)[0]}`;}
  instagramUrl(value:string):string{const input=value.trim();if(/^https?:\/\/([\w-]+\.)?instagram\.com\//i.test(input))return input;return `https://www.instagram.com/${this.instagramLabel(input).slice(1)}/`;}
  ngOnInit():void{void this.load();}
  async load():Promise<void>{try{const page=await PublicPageService.findBySlug(this.firestore,this.injector,this.slug);if(!page){this.error.set('Esta página não está disponível.');return;}this.page.set(page);this.posts.set(await PublicPageService.postsFor(this.firestore,this.injector,page.id));}catch{this.error.set('Não foi possível carregar esta página.');}finally{this.loading.set(false);}}
}
