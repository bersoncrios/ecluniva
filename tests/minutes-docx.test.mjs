import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { emptyMinute, minuteText } from '../.test-dist/minutes.js';
import { minuteDocxBlob } from '../.test-dist/minutes-docx.js';

const unescapeXml = text => text.replace(/&(amp|lt|gt|quot|apos);/g,(_,key)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[key]);
for (const status of ['in_progress','concluded']) test(`DOCX ${status} preserves editable text, emphasis and A4 without page numbers`,async()=>{
  const minute={...emptyMinute(),status,number:25,societyName:'UPH Teste',churchName:'Igreja A&B',meetingLocation:'Casa do irmão João',templeAddress:'Rua da Paz, 25',attendance:[{memberId:'a',name:'João Silva',role:'Presidente',office:'Diácono'},{memberId:'b',name:'José Lima',role:'Secretário',office:'Presbítero'}],presidentId:'a',secretaryId:'b',closingPrayer:'João Silva',deliberations:'Foi aprovada a proposta A < B & C.'};
  const blob=await minuteDocxBlob(minute);
  assert.equal(blob.type,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const files=unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const document=strFromU8(files['word/document.xml']);
  const text=[...document.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(match=>unescapeXml(match[1])).join('');
  assert.ok(text.includes(minuteText(minute)));
  assert.match(document,/<w:b\/>/);
  assert.match(document,/w:w="11906"/);
  assert.match(document,/w:h="16838"/);
  assert.match(document,/w:val="both"/);
  assert.match(document,/A &lt; B &amp; C/);
  const footers=Object.keys(files).filter(name=>/^word\/footer\d+\.xml$/.test(name));
  assert.equal(footers.length,status==='concluded'?0:1);
  if(footers.length)assert.ok(strFromU8(files[footers[0]]).includes('PRÉVIA — ATA AINDA NÃO LAVRADA'));
  for(const [name,data] of Object.entries(files))if(name.endsWith('.xml'))assert.doesNotMatch(strFromU8(data),/<w:instrText[^>]*>\s*(?:PAGE|NUMPAGES)\b/);
});
