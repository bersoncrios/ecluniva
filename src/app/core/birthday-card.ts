import type { CardIdentity } from './communication.js';
export type CardFormat='square'|'portrait'|'story';
export type CardStyle='classic'|'celebration';
export interface BirthdayCardInput { name:string; date:string; society:string; church:string; identity:CardIdentity; format:CardFormat; style:CardStyle; message:string; }
export function cardSize(format:CardFormat):{width:number;height:number}{return {width:1080,height:format==='story'?1920:format==='portrait'?1350:1080};}
function textLines(context:CanvasRenderingContext2D,text:string,width:number):string[]{
  const lines:string[]=[];let line='';
  for(const word of text.trim().split(/\s+/)){
    if(context.measureText(word).width>width){
      if(line){lines.push(line);line='';}
      for(const character of word){if(line&&context.measureText(line+character).width>width){lines.push(line);line='';}line+=character;}
    }else if(line&&context.measureText(line+' '+word).width>width){lines.push(line);line=word;}else line=line?line+' '+word:word;
  }
  if(line)lines.push(line);return lines;
}
function luminance(color:string):number{
  const channels=[1,3,5].map(start=>parseInt(color.slice(start,start+2),16)/255).map(value=>value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4));
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
}
function contrast(a:string,b:string):number{const first=luminance(a),second=luminance(b);return (Math.max(first,second)+.05)/(Math.min(first,second)+.05);}
export async function renderBirthdayCard(canvas:HTMLCanvasElement,input:BirthdayCardInput):Promise<void>{
  const {width,height}=cardSize(input.format);canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Seu navegador não conseguiu preparar o cartão.');
  const {primaryColor,accentColor}=input.identity;
  const background=input.style==='classic'?'#f9f7ef':primaryColor;
  ctx.fillStyle=background;ctx.fillRect(0,0,width,height);
  ctx.save();ctx.globalAlpha=.15;ctx.fillStyle=input.style==='classic'?primaryColor:'#ffffff';ctx.beginPath();ctx.arc(0,height,400,0,2*Math.PI);ctx.fill();ctx.beginPath();ctx.arc(width,0,340,0,2*Math.PI);ctx.fill();ctx.restore();
  ctx.strokeStyle=accentColor;ctx.lineWidth=3;ctx.strokeRect(44,44,width-88,height-88);
  if(input.style==='celebration')for(let i=0;i<36;i++){ctx.save();ctx.translate(80+(i*137)%(width-160),80+(i*173)%(height-160));ctx.rotate(i*.7);ctx.fillStyle=i%2?accentColor:'#ffffff';ctx.globalAlpha=.35;ctx.fillRect(-5,-12,10,24);ctx.restore();}
  const ink=contrast(primaryColor,background)>=4.5?primaryColor:contrast('#ffffff',background)>=4.5?'#ffffff':'#172d25';ctx.textAlign='center';ctx.textBaseline='middle';
  let top=input.format==='story'?160:100;
  if(input.identity.logoDataUrl){const logo=new Image();logo.src=input.identity.logoDataUrl;await logo.decode();const scale=Math.min(140/logo.naturalWidth,90/logo.naturalHeight);ctx.fillStyle='#ffffff';ctx.fillRect((width-logo.naturalWidth*scale)/2-12,top-62,logo.naturalWidth*scale+24,logo.naturalHeight*scale+24);ctx.drawImage(logo,(width-logo.naturalWidth*scale)/2,top-50,logo.naturalWidth*scale,logo.naturalHeight*scale);top+=100;}
  ctx.fillStyle=ink;let societySize=28,societyLines:string[]=[];do{ctx.font=`600 ${societySize}px system-ui`;societyLines=textLines(ctx,input.society,870);if(societyLines.length*societySize*1.3<=80)break;societySize--;}while(societySize>16);
  societyLines.forEach((line,index)=>ctx.fillText(line,width/2,top+index*societySize*1.3));top+=societyLines.length*societySize*1.3;
  ctx.fillStyle=contrast(accentColor,background)>=3?accentColor:ink;ctx.font='600 76px Georgia';ctx.fillText('Feliz aniversário!',width/2,Math.max(top+70,height*.32));
  ctx.fillStyle=ink;let nameSize=64,nameLines:string[]=[];
  do{ctx.font=`600 ${nameSize}px system-ui`;nameLines=textLines(ctx,input.name,860);if(nameLines.length<=3)break;nameSize-=2;}while(nameSize>34);
  const nameY=height*.48;
  nameLines.forEach((line,index)=>ctx.fillText(line,width/2,nameY+(index-(nameLines.length-1)/2)*(nameSize*1.3)));
  ctx.font='500 34px system-ui';ctx.fillText(input.date.split('-').slice(1).reverse().join('/'),width/2,nameY+(nameLines.length-1)*nameSize*.65+nameSize+30);
  let messageSize=32,messageLines:string[]=[];
  do{ctx.font=`${messageSize}px Georgia`;messageLines=textLines(ctx,input.message,830);if(messageLines.length*messageSize*1.45<=height*.15)break;messageSize--;}while(messageSize>12);
  messageLines.forEach((line,index)=>ctx.fillText(line,width/2,height*.68+index*messageSize*1.45));
  ctx.font='24px system-ui';ctx.globalAlpha=.85;const churchLines=textLines(ctx,input.church,850);churchLines.forEach((line,index)=>ctx.fillText(line,width/2,height-100-(churchLines.length-index-1)*30));ctx.globalAlpha=1;
}
export async function downloadBirthdayCard(input:BirthdayCardInput):Promise<void>{
  const canvas=document.createElement('canvas');await renderBirthdayCard(canvas,input);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Não foi possível gerar o PNG.')),'image/png'));
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`aniversario-${input.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${input.date}-${input.format}.png`;document.body.append(link);try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
