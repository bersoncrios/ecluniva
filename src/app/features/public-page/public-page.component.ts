import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/data.service';
import { PublicPageService } from '../../core/public-page.service';
import { PublicPostType } from '../../core/public-page';

@Component({selector:'app-public-page',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./public-page.component.html',styleUrl:'./public-page.component.css'})
export class PublicPageComponent implements OnInit {
  readonly data=inject(DataService); readonly service=inject(PublicPageService); readonly message=signal(''); readonly error=signal('');
  readonly postType=signal<PublicPostType>('event'); readonly postStatus=signal<'draft'|'published'>('published'); readonly postTitle=signal(''); readonly postBody=signal(''); readonly postDate=signal(''); readonly postTime=signal(''); readonly postLocation=signal('');
  ngOnInit():void{const society=this.data.selected();if(society)this.service.loadForSociety(society);}
  async save():Promise<void>{const page=this.service.page();if(!page)return;this.error.set('');this.message.set('');try{await this.service.savePage(page);this.message.set('Página salva.');}catch(e){this.error.set(e instanceof Error?e.message:'Não foi possível salvar a página.');}}
  async publish():Promise<void>{this.error.set('');try{await this.service.setPublished(!this.service.page()?.published);this.message.set(this.service.page()?.published?'Página publicada.':'Página retirada do ar.');}catch(e){this.error.set(e instanceof Error?e.message:'Não foi possível atualizar a publicação.');}}
  async addPost():Promise<void>{this.error.set('');try{await this.service.addPost({type:this.postType(),title:this.postTitle().trim(),body:this.postBody().trim(),date:this.postDate()||null,time:this.postTime().trim(),location:this.postLocation().trim(),status:this.postStatus()});this.postTitle.set('');this.postBody.set('');this.postDate.set('');this.postTime.set('');this.postLocation.set('');this.message.set(this.postStatus()==='draft'?'Rascunho salvo.':'Conteúdo publicado.');}catch(e){this.error.set(e instanceof Error?e.message:'Não foi possível publicar o conteúdo.');}}
}
