import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LegalDocument } from '../../core/legal';

@Component({selector:'app-legal-document',standalone:true,imports:[CommonModule],templateUrl:'./legal-document.component.html',styleUrl:'./legal-document.component.css'})
export class LegalDocumentComponent { @Input() kind:LegalDocument='terms'; }
