import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/data.service';
import { PublicPageService } from '../../core/public-page.service';
import { PublicPageTheme, PublicPost, PublicPostType } from '../../core/public-page';

@Component({selector:'app-public-page',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./public-page.component.html',styleUrl:'./public-page.component.css'})
export class PublicPageComponent implements OnInit {
  readonly data=inject(DataService); readonly service=inject(PublicPageService); readonly message=signal(''); readonly error=signal('');
  readonly themes:{value:PublicPageTheme;label:string;description:string}[]=[{value:'forest',label:'Floresta',description:'Verde profundo e areia'},{value:'ocean',label:'Oceano',description:'Azul e azul-petróleo'},{value:'terracotta',label:'Terracota',description:'Quente e acolhedor'},{value:'plum',label:'Ameixa',description:'Vinho e lavanda'}];
  readonly postType=signal<PublicPostType>('event'); readonly postStatus=signal<'draft'|'published'>('published'); readonly postTitle=signal(''); readonly postBody=signal(''); readonly postDate=signal(''); readonly postTime=signal(''); readonly postLocation=signal(''); readonly editingPostId=signal<string|null>(null); readonly postBusy=signal(false);
  ngOnInit():void{const society=this.data.selected();if(society)this.service.loadForSociety(society);}
  async save():Promise<void>{const page=this.service.page();if(!page)return;this.error.set('');this.message.set('');try{await this.service.savePage(page);this.message.set('Página salva.');}catch(e){this.error.set(e instanceof Error?e.message:'Não foi possível salvar a página.');}}
  async publish():Promise<void>{this.error.set('');try{await this.service.setPublished(!this.service.page()?.published);this.message.set(this.service.page()?.published?'Página publicada.':'Página retirada do ar.');}catch(e){this.error.set(e instanceof Error?e.message:'Não foi possível atualizar a publicação.');}}
  private postInput():Omit<PublicPost,'id'>{return {type:this.postType(),title:this.postTitle().trim(),body:this.postBody().trim(),date:this.postDate()||null,time:this.postTime().trim(),location:this.postLocation().trim(),status:this.postStatus()};}
  async savePost():Promise<void>{this.error.set('');this.postBusy.set(true);try{const input=this.postInput();const id=this.editingPostId();if(id){await this.service.updatePost(id,input);this.message.set('Conteúdo atualizado.');}else{await this.service.addPost(input);this.message.set(input.status==='draft'?'Rascunho salvo.':'Conteúdo publicado.');}this.resetPostForm();}catch(e){this.error.set(e instanceof Error?e.message:'Não foi possível salvar o conteúdo.');}finally{this.postBusy.set(false);}}
  editPost(post:PublicPost):void{this.editingPostId.set(post.id);this.postType.set(post.type);this.postStatus.set(post.status);this.postTitle.set(post.title);this.postBody.set(post.body);this.postDate.set(post.date||'');this.postTime.set(post.time);this.postLocation.set(post.location);document.getElementById('public-post-title')?.focus();}
  cancelPostEdit():void{this.resetPostForm();}
  async deletePost(post:PublicPost):Promise<void>{if(!window.confirm(`Excluir ${post.type==='event'?'o evento':'o aviso'} “${post.title}”?`))return;this.error.set('');this.postBusy.set(true);try{await this.service.deletePost(post.id);if(this.editingPostId()===post.id)this.resetPostForm();this.message.set('Conteúdo excluído.');}catch(e){this.error.set(e instanceof Error?e.message:'Não foi possível excluir o conteúdo.');}finally{this.postBusy.set(false);}}
  private resetPostForm():void{this.editingPostId.set(null);this.postType.set('event');this.postStatus.set('published');this.postTitle.set('');this.postBody.set('');this.postDate.set('');this.postTime.set('');this.postLocation.set('');}
}
