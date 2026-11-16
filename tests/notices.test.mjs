import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { emptyNotice, normalizeNotice, noticeParagraphs, validateNotice } from '../.test-dist/notices.js';
import { noticeDocxBlob } from '../.test-dist/notices-export.js';
const sample=()=>({...emptyNotice('2026-10-10'),churchName:'Igreja Presbiteriana Palmas Norte',societyName:'União Presbiteriana de Homens — UPH Palmas Norte',issueCity:'Palmas, Tocantins',meetingDate:'2026-10-18',timeDescription:'Após a Escola Bíblica Dominical',meetingLocation:'no templo da igreja',address:'Quadra 604 Norte, Alameda 22, Palmas — TO',presidentName:'Wilson Santos de Oliveira',secretaryName:'Guilherme Taveira Berson',presidentRole:'Presidente da UPH',secretaryRole:'1º Secretário da UPH'});
test('plenary follows supplied model with civil date, flexible time and two signatures',()=>{
 const notice=sample();assert.deepEqual(validateNotice(notice),{});
 const paragraphs=noticeParagraphs(notice),text=paragraphs.map(item=>item.text).join('\n');
 for(const value of ['CONVOCAÇÃO','Palmas, Tocantins, 10 de outubro de 2026.','todos os sócios','18 de outubro de 2026, domingo','após a Escola Bíblica Dominical','no templo da igreja','Wilson Santos de Oliveira','1º Secretário da UPH'])assert.ok(text.includes(value),value);
 assert.equal(paragraphs.filter(item=>item.kind==='signature').length,4);
 assert.equal(paragraphs.filter(item=>item.kind==='agenda').length,0);
 assert.ok(!text.includes('GTSI'));
});
test('CE and board select proper audience and number optional agenda lines',()=>{
 for(const [meetingType,audience] of [['executive','os membros da Comissão Executiva (CE)'],['board','os membros da diretoria']]){
  const paragraphs=noticeParagraphs({...sample(),meetingType,meetingPurpose:'reunião de planejamento',meetingLocation:'na residência do secretário de cultura',timeDescription:'18:00',agenda:'Planejamento do mês de abril\n\nRelatório financeiro',legalBasis:'determina o Artigo 19, alínea a, do GTSI da UPH'});
  const text=paragraphs.map(item=>item.text).join('\n');
  assert.ok(text.includes(audience));assert.ok(!text.includes('todos os sócios'));
  assert.ok(text.includes('às 18h00'));assert.ok(text.includes('conforme determina o Artigo 19'));
  assert.deepEqual(paragraphs.filter(item=>item.kind==='agenda').map(item=>item.text),['1. Planejamento do mês de abril','2. Relatório financeiro']);
 }
});
test('notice validation rejects impossible dates, missing signatories, chronology and oversized agendas',()=>{
 const notice=sample();
 for(const field of ['churchName','societyName','issueCity','timeDescription','meetingLocation','address','presidentName','secretaryName'])assert.ok(validateNotice({...notice,[field]:''})[field],field);
 assert.ok(validateNotice({...notice,meetingType:'invalid'}).meetingType);
 assert.ok(validateNotice({...notice,meetingDate:'2026-02-30'}).meetingDate);
 assert.ok(validateNotice({...notice,issueDate:'2026-10-19'}).meetingDate);
 assert.ok(validateNotice({...notice,agenda:'a\n'.repeat(51)}).agenda);
 assert.ok(validateNotice({...notice,address:'a'.repeat(501)}).address);
 const normalized=normalizeNotice({...notice,issueCity:'  Palmas  ',agenda:'  Um assunto  \r\n\n  Outro assunto ',id:'not-a-field'});
 assert.equal(normalized.issueCity,'Palmas');assert.equal(normalized.agenda,'Um assunto\nOutro assunto');assert.equal(normalized.id,undefined);
});
test('DOCX preserves special characters, agenda, signatures and editable text without page numbers',async()=>{
 const blob=await noticeDocxBlob({...sample(),agenda:'Plano A < B & C\nAssuntos gerais'});
 const files=unzipSync(new Uint8Array(await blob.arrayBuffer()));
 const xml=strFromU8(files['word/document.xml']);
 for(const phrase of ['CONVOCAÇÃO','Wilson Santos de Oliveira','Guilherme Taveira Berson','1. Plano A &lt; B &amp; C','2. Assuntos gerais'])assert.ok(xml.includes(phrase),phrase);
 assert.match(xml,/w:val="both"/);assert.match(xml,/w:w="11906"/);
 assert.ok(!Object.keys(files).some(name=>/^word\/footer/.test(name)));
});
