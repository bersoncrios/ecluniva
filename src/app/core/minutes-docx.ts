import { minuteSegments, type MinuteInput } from './minutes.js';

/** Editable A4 document using the same text and emphasis as the PDF. */
export async function minuteDocxBlob(minute: MinuteInput): Promise<Blob> {
  const {Document, Packer, Paragraph, TextRun, ImageRun, Footer, AlignmentType, BorderStyle} = await import('docx');
  const children = [];
  if (minute.logoDataUrl) {
    const image = new Image();
    image.src = minute.logoDataUrl;
    await image.decode();
    const width = Math.min(106,106*image.naturalWidth/image.naturalHeight);
    const height = width*image.naturalHeight/image.naturalWidth;
    const data = Uint8Array.from(atob(minute.logoDataUrl.split(',')[1]),character=>character.charCodeAt(0));
    children.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:200},children:[new ImageRun({
      type:minute.logoDataUrl.startsWith('data:image/png') ? 'png' : 'jpg',data,transformation:{width,height}
    })]}));
  }
  for (const heading of [minute.societyName,minute.churchName]) {
    children.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:120},children:[new TextRun({text:heading,bold:true})]}));
  }
  children.push(new Paragraph({
    alignment:AlignmentType.JUSTIFIED,spacing:{before:240,after:0,line:312},
    children:minuteSegments(minute).map(segment=>new TextRun({text:segment.text,bold:!!segment.bold}))
  }));
  for (let line=0;line<3;line++) children.push(new Paragraph({
    spacing:{before:0,after:0,line:312},
    border:{bottom:{style:BorderStyle.DASHED,size:2,color:'666666'}},children:[new TextRun(' ')]
  }));
  const document = new Document({
    creator:minute.societyName,title:`Ata ${String(minute.number).padStart(3,'0')} — ${minute.societyName}`,
    styles:{default:{document:{run:{font:'Times New Roman',size:24,color:'000000'}}}},
    sections:[{
      properties:{page:{size:{width:11906,height:16838},margin:{top:1417,bottom:1417,left:1417,right:1417}}},
      footers:minute.status==='concluded' ? undefined : {default:new Footer({children:[new Paragraph({
        alignment:AlignmentType.CENTER,children:[new TextRun({text:'PRÉVIA — ATA AINDA NÃO LAVRADA',size:16})]
      })]})},
      children
    }]
  });
  return Packer.toBlob(document);
}

export async function exportMinuteDocx(minute: MinuteInput): Promise<void> {
  const blob = await minuteDocxBlob(minute);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ata-${String(minute.number).padStart(3,'0')}-${minute.year}.docx`;
  document.body.append(link);
  try { link.click(); }
  finally { link.remove(); window.setTimeout(()=>URL.revokeObjectURL(url),1000); }
}
