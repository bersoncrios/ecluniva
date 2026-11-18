import admin from 'firebase-admin';
import { db, json, verifyUser } from './billing/_shared.mjs';

const MAX_MESSAGE = 4000;

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Método não permitido.' });
  try {
    const user = await verifyUser(req), store = db();
    if (req.method === 'GET') {
      const snapshot = await store.collection('supportThreads').where('userId', '==', user.uid).get();
      const threads = snapshot.docs.map(doc => ({ id: doc.id, status: doc.data().status || 'open', messages: doc.data().messages || [], rating: doc.data().rating || null, feedback: doc.data().feedback || '', updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || null })).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
      return json(res, 200, { threads });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const threadId = typeof body.threadId === 'string' ? body.threadId : '';
    const ref = threadId ? store.doc(`supportThreads/${threadId}`) : null;
    const account = await admin.auth().getUser(user.uid);

    if (body.action === 'resolve' || body.action === 'rate') {
      if (!ref) return json(res, 400, { error: 'Selecione o atendimento.' });
      if (body.action === 'rate') {
        const rating=Number(body.rating),feedback=typeof body.feedback==='string'?body.feedback.trim():'';
        if(!Number.isInteger(rating)||rating<1||rating>5||feedback.length>1000)return json(res,400,{error:'Informe uma nota de 1 a 5 e um comentário de até 1.000 caracteres.'});
        await store.runTransaction(async transaction=>{const snapshot=await transaction.get(ref);if(!snapshot.exists||snapshot.data().userId!==user.uid||snapshot.data().status!=='resolved')throw new Error('Finalize o atendimento antes de avaliá-lo.');transaction.update(ref,{rating,feedback,ratedAt:new Date(),updatedAt:new Date()});transaction.set(store.collection('adminAuditEvents').doc(),{type:'support_rated',actorId:user.uid,target:threadId,summary:`Usuário avaliou o atendimento com ${rating}/5`,createdAt:new Date()});});
        return json(res,200,{ok:true,rating,feedback});
      }
      await store.runTransaction(async transaction=>{const snapshot=await transaction.get(ref);if(!snapshot.exists||snapshot.data().userId!==user.uid)throw new Error('Atendimento não encontrado.');transaction.update(ref,{status:'resolved',resolvedAt:new Date(),resolvedBy:user.uid,updatedAt:new Date()});transaction.set(store.collection('adminAuditEvents').doc(),{type:'support_resolved',actorId:user.uid,target:threadId,summary:'Usuário finalizou o atendimento',createdAt:new Date()});});
      return json(res,200,{ok:true,status:'resolved'});
    }

    const message=typeof body.message==='string'?body.message.trim():'';
    if(message.length<1||message.length>MAX_MESSAGE)return json(res,400,{error:`A mensagem deve ter de 1 a ${MAX_MESSAGE} caracteres.`});
    const item={id:store.collection('_ids').doc().id,senderId:user.uid,senderName:account.displayName||account.email||'Usuário',senderRole:'user',text:message,createdAt:new Date().toISOString()};
    let target=ref;
    if(!target)target=store.collection('supportThreads').doc();
    await store.runTransaction(async transaction=>{
      const snapshot=await transaction.get(target);
      if(snapshot.exists&&snapshot.data().userId!==user.uid)throw new Error('Atendimento não encontrado.');
      const previous=snapshot.data()||{};
      if(snapshot.exists&&previous.status==='resolved')throw new Error('Este atendimento foi finalizado. Abra um novo atendimento para continuar.');
      transaction.set(target,{userId:user.uid,userEmail:account.email||'',userName:account.displayName||'',status:'open',rating:null,feedback:'',ratedAt:null,messages:[...(previous.messages||[]),item].slice(-200),createdAt:previous.createdAt||new Date(),updatedAt:new Date(),unreadByAdmin:true},{merge:false});
      if(!snapshot.exists)transaction.set(store.collection('adminAuditEvents').doc(),{type:'support_opened',actorId:user.uid,target:account.email||'',threadId:target.id,summary:'Novo atendimento recebido',createdAt:new Date()});
    });
    return json(res,201,{threadId:target.id,message:item});
  } catch(error) {
    console.error('Falha no atendimento:',error);
    const message=error instanceof Error?error.message:'Não foi possível acessar o atendimento.';
    return json(res,message.includes('não encontrado')||message.includes('finalizado')?409:401,{error:message});
  }
}
