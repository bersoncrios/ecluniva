import { noticeParagraphs, type NoticeInput } from './notices.js';

export async function exportNoticePdf(notice: NoticeInput):Promise<void>{
  const {jsPDF}=await import('jspdf');
  const pdf=new jsPDF({unit:'mm',format:'a4',compress:true});
  pdf.setProperties({title:`Convocação — ${notice.societyName}`,author:notice.societyName});
  const left=25,right=185,bottom=272,lineHeight=6;
  let y=25;
  const ensure=(height:number)=>{if(y+height>bottom){pdf.addPage();y=25;}};
  function lines(text:string,center=false,bold=false,size=12,justify=false):void{
    pdf.setFont('times',bold?'bold':'normal');pdf.setFontSize(size);
    const rows:string[]=pdf.splitTextToSize(text,right-left);
    for(let index=0;index<rows.length;index++){
      ensure(lineHeight);
      const row=rows[index];
      if(center)pdf.text(row,105,y,{align:'center'});
      else if(justify&&index<rows.length-1){
        const words=row.trim().split(/\s+/),width=words.reduce((total,word)=>total+pdf.getTextWidth(word),0);
        const space=(right-left-width)/Math.max(1,words.length-1);
        let x=left;for(const word of words){pdf.text(word,x,y);x+=pdf.getTextWidth(word)+space;}
      }else pdf.text(row,left,y);
      y+=lineHeight;
    }
  }
  const paragraphs=noticeParagraphs(notice);
  for(let index=0;index<paragraphs.length;index++){
    const item=paragraphs[index];
    switch(item.kind){
      case 'heading':lines(item.text,true,true);break;
      case 'title':y+=15;ensure(22);lines(item.text,true,true,22);y+=10;break;
      case 'date':lines(item.text);y+=8;break;
      case 'body':lines(item.text,false,false,12,true);y+=4;break;
      case 'agenda':lines(item.text);y+=2;break;
      case 'closing':y+=5;lines(item.text,true);break;
      case 'signature':{
        const role=paragraphs[++index];
        pdf.setFont('times','bold');pdf.setFontSize(12);
        const nameRows:string[]=pdf.splitTextToSize(item.text,160);
        pdf.setFont('times','normal');
        const roleRows:string[]=pdf.splitTextToSize(role.text,160);
        ensure(25+lineHeight*(nameRows.length+roleRows.length));y+=25;
        pdf.setLineWidth(.2);pdf.line(65,y-3,145,y-3);
        lines(item.text,true,true);lines(role.text,true);break;
      }
    }
  }
  pdf.save(noticeFilename(notice,'pdf'));
}
export async function noticeDocxBlob(notice:NoticeInput):Promise<Blob>{
  const {Document,Packer,Paragraph,TextRun,AlignmentType,BorderStyle}=await import('docx');
  const paragraphs=noticeParagraphs(notice);
  const signatureStart=paragraphs.findIndex(item=>item.kind==='signature');
  const children=paragraphs.map((item,index)=>{
    const isSignatureName=item.kind==='signature'&&(index-signatureStart)%2===0;
    const center=['heading','title','closing','signature'].includes(item.kind);
    return new Paragraph({
      alignment:center?AlignmentType.CENTER:item.kind==='body'?AlignmentType.JUSTIFIED:AlignmentType.LEFT,
      keepNext:item.kind==='heading'||item.kind==='title'||!!isSignatureName,
      spacing:{before:item.kind==='title'?600:isSignatureName?840:item.kind==='body'?240:0,after:item.kind==='title'?400:item.kind==='agenda'?100:120,line:280},
      border:isSignatureName?{top:{style:BorderStyle.SINGLE,size:4,color:'000000',space:4}}:undefined,
      children:[new TextRun({text:item.text,bold:item.kind==='heading'||item.kind==='title'||!!isSignatureName,size:item.kind==='title'?40:24})]
    });
  });
  const document=new Document({creator:notice.societyName,title:`Convocação — ${notice.societyName}`,styles:{default:{document:{run:{font:'Times New Roman',size:24}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1417,bottom:1417,left:1417,right:1417}}},children}]});
  return Packer.toBlob(document);
}
export function noticeFilename(notice:NoticeInput,extension:'pdf'|'docx'):string{
  return `convocacao-${({plenary:'plenaria',executive:'ce',board:'diretoria'})[notice.meetingType]}-${notice.meetingDate}.${extension}`;
}
export async function exportNoticeDocx(notice:NoticeInput):Promise<void>{
  const url=URL.createObjectURL(await noticeDocxBlob(notice));
  const link=document.createElement('a');link.href=url;link.download=noticeFilename(notice,'docx');document.body.append(link);
  try{link.click();}finally{link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
