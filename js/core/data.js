/* ==========================================================================
   Núcleo · acesso aos dados
   - put / upd / del : gravam, atualizam e apagam documentos ("coleção/id").
   - safe(fn)        : executa uma gravação e mostra uma mensagem clara se falhar.
   - syncAll()       : assina todas as coleções; a cada mudança atualiza RH.S e a tela.
   ========================================================================== */
(()=>{
const RH=window.RH,{S,st,COLS,byId}=RH;

RH.put=(c,id,d)=>st.db.doc(`${c}/${id}`).set(d);
RH.upd=(c,id,d)=>st.db.doc(`${c}/${id}`).update(d);
RH.del=(c,id)=>st.db.doc(`${c}/${id}`).delete();

RH.safe=async fn=>{
  try{return await fn()}
  catch(e){console.error(e);const c=e&&e.code;
    RH.toast(c==='not_found'?'Este registro não existe mais (foi excluído em outro aparelho). Atualize a tela.':c==='quota_exceeded'?'Limite de armazenamento atingido.':'Não foi possível salvar. Verifique a conexão e tente novamente.','bad');
    return undefined}};

const ready={};
function sync(col){
  let q=st.db.collection(col);if(col==='rondas'||col==='ncs')q=q.orderBy('ts','desc').limit(1000);
  q.onSnapshot(s=>{const rows=s.docs.map(d=>({id:d.id,...d.data()}));
    if(col==='config')S.cfg=rows.find(r=>r.id==='main')||{};else S[col]=rows;
    ready[col]=true;onData()},e=>{console.error(col,e);ready[col]=true;onData()});
}
function onData(){
  if(!st.booted){
    if(COLS.every(c=>ready[c])){st.booted=true;
      try{const id=sessionStorage.getItem('rh_uid');const u=id&&byId(S.users,id);if(u&&u.ativo!==false)st.me=u}catch(e){}
      RH.renderRoot()}
    return}
  if(st.me){const u=byId(S.users,st.me.id);if(!u||u.ativo===false){RH.logout();return}st.me=u}
  clearTimeout(onData.t);onData.t=setTimeout(()=>RH.renderRoot(true),200);
}
RH.syncAll=()=>COLS.forEach(sync);
})();
