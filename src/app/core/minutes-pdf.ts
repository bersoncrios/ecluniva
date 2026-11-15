import { minuteSegments, type MinuteInput } from './minutes.js';

/** Searchable vector text, with deterministic A4 pagination and security ruling. */
export async function exportMinutePdf(minute: MinuteInput): Promise<void> {
  const {jsPDF} = await import('jspdf');
  const pdf = new jsPDF({unit:'mm',format:'a4',compress:true});
  const left=25, right=185, bottom=272, lineHeight=5.5;
  let y=25;
  pdf.setProperties({title:`Ata ${String(minute.number).padStart(3,'0')}/${minute.year} — ${minute.societyName}`,author:minute.societyName,subject:'Ata de plenária'});
  if (minute.logoDataUrl) {
    const image = pdf.getImageProperties(minute.logoDataUrl);
    const width = Math.min(28,28*image.width/image.height);
    const height = width*image.height/image.width;
    pdf.addImage(minute.logoDataUrl,image.fileType,(210-width)/2,y,width,height);
    y+=height+5;
  }
  pdf.setFont('times','bold'); pdf.setFontSize(12);
  for (const heading of [minute.societyName,minute.churchName]) {
    const lines: string[] = pdf.splitTextToSize(heading,160);
    for (const line of lines) { pdf.text(line,105,y,{align:'center'}); y+=lineHeight; }
  }
  y+=5;
  pdf.setFontSize(12);
  type Word = {text:string;bold:boolean;width:number};
  const words:Word[]=[];
  // Preserve style changes within a word (punctuation and adjoining runs).
  for (const segment of minuteSegments(minute)) {
    const tokens=segment.text.match(/\s+|\S+/g) ?? [];
    for (const token of tokens) {
      pdf.setFont('times',segment.bold?'bold':'normal');
      if (/^\s+$/.test(token)) words.push({text:' ',bold:false,width:pdf.getTextWidth(' ')});
      else {
        // Split pathological long identifiers instead of drawing outside the page.
        let part='';
        for (const character of token) {
          if (part && pdf.getTextWidth(part+character)>right-left) {
            words.push({text:part,bold:!!segment.bold,width:pdf.getTextWidth(part)}); part='';
          }
          part+=character;
        }
        if (part) words.push({text:part,bold:!!segment.bold,width:pdf.getTextWidth(part)});
      }
    }
  }
  function pageBreak():void { pdf.addPage(); y=25; }
  function drawLine(line:Word[],justify:boolean):void {
    if(y>bottom) pageBreak();
    while(line.at(-1)?.text===' ')line.pop();
    const width=line.reduce((total,word)=>total+word.width,0);
    const gaps=line.filter(word=>word.text===' ').length;
    const extra=justify&&gaps ? Math.max(0,(right-left-width)/gaps):0;
    let x=left;
    for(const word of line) {
      pdf.setFont('times',word.bold?'bold':'normal');
      if(word.text!==' ')pdf.text(word.text,x,y);
      x+=word.width+(word.text===' '?extra:0);
    }
    if(!justify) {
      pdf.setLineWidth(.12);pdf.setLineDashPattern([1.2,1],0);
      if(x<right-2)pdf.line(x+1,y,right,y);
      pdf.setLineDashPattern([],0);
    }
    y+=lineHeight;
  }
  let line:Word[]=[];let width=0;
  for(let index=0;index<words.length;index++) {
    const word=words[index];
    if(!line.length&&word.text===' ')continue;
    // A style boundary does not create a legal line break: keep punctuation
    // attached to the bold field and keep adjoining styled fragments together.
    let unbrokenWidth=word.width;
    if(word.text!==' ')for(let next=index+1;next<words.length&&words[next].text!==' ';next++)unbrokenWidth+=words[next].width;
    const needed=unbrokenWidth<=right-left?unbrokenWidth:word.width;
    if(width+needed>right-left&&line.length) {drawLine(line,true);line=[];width=0;}
    if(!line.length&&word.text===' ')continue;
    line.push(word);width+=word.width;
  }
  if(line.length)drawLine(line,false);
  pdf.setLineWidth(.12);pdf.setLineDashPattern([1.2,1],0);
  while(y<=bottom) {pdf.line(left,y,right,y);y+=lineHeight;}
  pdf.setLineDashPattern([],0);
  const pages=pdf.getNumberOfPages();
  for(let page=1;page<=pages;page++) {
    pdf.setPage(page);pdf.setFont('times','normal');pdf.setFontSize(10);
    pdf.text(`${page} / ${pages}`,105,285,{align:'center'});
    if(minute.status!=='concluded') {
      pdf.setFontSize(8);pdf.text('PRÉVIA — ATA AINDA NÃO LAVRADA',105,291,{align:'center'});
    }
  }
  pdf.save(`ata-${String(minute.number).padStart(3,'0')}-${minute.year}.pdf`);
}
