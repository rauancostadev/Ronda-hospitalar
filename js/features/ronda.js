/* ==========================================================================
   Nova ronda: lista as rondas cadastradas (Cadastros → Rondas) que o usuário pode
   realizar e conduz o preenchimento do checklist de TODAS as salas da ronda.

   Regras de acesso:
   - ronda com responsável  → só ele a vê e realiza;
   - ronda com responsável "Todos" → todos os usuários com acesso à tela (todos os inspetores).
   Ao finalizar, gera um documento em `rondas` por sala visitada (todos com o mesmo
   execId, modeloId e modeloNome) e uma não conformidade em `ncs` para cada item NC.
   ========================================================================== */
(()=>{
const RH=window.RH;
const {$,esc,S,st,byId,userName,pc,ago,fdt,fd,ic,empty,toast,SEV}=RH;

/* A ronda é percorrida na ordem definida no cadastro: cada sala ou equipamento é um bloco.
   Alvo = o que recebe um checklist: a própria sala (a:'s') ou um equipamento (a:'e'). */
function blocosDa(m){
  const o=[];
  RH.ordemDaRonda(m).forEach(k=>{
    const id=k.slice(2);
    if(k[0]==='s'){const s=byId(S.salas,id);if(s&&s.ativo!==false)o.push({id:s.id,tipo:'sala',salaId:s.id,setor:s.setor||'Sem setor'})}
    else{const e=byId(S.equipamentos,id);if(e&&e.ativo!==false)o.push({id:'eq:'+e.id,tipo:'eq',salaId:null,setor:RH.setorEq(e)||'Sem setor',eqIds:[e.id]})}});
  return o}
function alvos(bl){
  if(bl.tipo==='sala'){const s=byId(S.salas,bl.salaId);return s?[{a:'s',i:s.id,n:s.nome,cl:byId(S.checklists,s.checklistId)}]:[]}
  return bl.eqIds.map(id=>byId(S.equipamentos,id)).filter(Boolean).map(e=>({a:'e',i:e.id,n:e.nome,eq:e,cl:byId(S.checklists,e.checklistId)}))}
const tagTipo=a=>a==='e'?'<span class="tag tag-e">Equipamento</span>':'<span class="tag tag-s">Sala</span>';
const prefix=(sid,al)=>`${sid}:${al.a}:${al.i}:`;
const thumbEq=e=>e.thumb?`<img class="thumb" src="${e.thumb}" alt="${esc(e.nome)}">`:`<div class="thumb">${ic('dev',22)}</div>`;
RH.thumbEq=thumbEq;
RH.calBadge=d=>{const dias=Math.round((new Date(d+'T23:59:59')-Date.now())/864e5);
  return dias<0?`<span class="pill st-aberta cal">Calibração vencida em ${fd(new Date(d+'T12:00:00'))}</span>`:dias<=30?`<span class="pill late cal">Calibração vence em ${dias} d</span>`:`<small class="cal">Calibração até ${fd(new Date(d+'T12:00:00'))}</small>`};

/* ---------- lista de rondas ---------- */
const visiveis=()=>S.modelos.filter(m=>RH.access.rondaVisivel(m,st.me)).sort((a,b)=>a.nome.localeCompare(b.nome));
const lastExec=id=>{let l=null;S.rondas.forEach(r=>{if(r.modeloId===id&&(!l||r.ts>l.ts))l=r});return l};

RH.pages.ronda=()=>{
  const lista=visiveis();
  const vazio=!S.modelos.length
    ?empty('Nenhuma ronda cadastrada',st.me.role==='admin'?'Cadastre as rondas em Cadastros → Rondas (nome, salas e responsável).':'Peça ao administrador para cadastrar as rondas.')
    :empty('Nenhuma ronda disponível para você','As rondas são exibidas apenas ao responsável escolhido ou a todos os inspetores quando não há responsável. Fale com o administrador.');
  return `<div class="top"><div><h1>Nova ronda</h1><p>Escolha a ronda que você vai realizar.</p></div></div>
  ${st.R?`<div class="banner">Há uma ronda em andamento (${esc(st.R.nome)}). <button class="btn sm" data-act="resumeRonda">Continuar ronda</button></div>`:''}
  ${lista.length?`<div class="salas">${lista.map(m=>{
    const l=lastExec(m.id),late=RH.agenda.atrasada(m,l?l.ts:null),salas=RH.salasDaRonda(m),setores=[...new Set([...salas.map(s=>s.setor||'Sem setor'),...RH.equipsDaRonda(m).map(e=>RH.setorEq(e)||'Sem setor')])].sort((a,b)=>a.localeCompare(b)),prox=RH.agenda.proximo(m,Date.now());
    const ne=RH.equipsDaRonda(m).length;
    return `<button class="sala" data-act="pickRonda" data-id="${m.id}"><div class="h"><b>${esc(m.nome)}</b>${late?'<span class="pill late">Em atraso</span>':'<span class="pill okp">Em dia</span>'}</div>
    <div class="f"><span>${esc(setores.join(', ')||'—')}</span></div>
    <div class="f"><span>${salas.length} sala${salas.length===1?'':'s'}</span><span>${ne} equipamento${ne===1?'':'s'}</span></div>
    <div class="f"><span>Responsável: ${m.responsavelId?esc(userName(m.responsavelId)):'todos os inspetores'}</span></div>
    <small>${esc(RH.agenda.resumo(m))}${prox?` · próxima: ${RH.agenda.fmtSlot(prox)}`:''}</small>
    <small>${l?`Última realização ${ago(l.ts)}`:'Nunca realizada'}</small></button>`}).join('')}</div>`:vazio}`;
};

/* ---------- execução ---------- */
function startRonda(id){
  const m=byId(S.modelos,id);if(!m)return;
  if(!RH.access.rondaVisivel(m,st.me)){toast('Você não tem acesso a esta ronda.','bad');return}
  const blocos=blocosDa(m);
  if(!blocos.length){toast('Esta ronda não tem salas nem equipamentos ativos. Ajuste em Cadastros → Rondas.','bad');return}
  st.R={modeloId:m.id,nome:m.nome,resp:m.responsavelId||'',blocos,itens:itensDe(blocos),obs:'',started:Date.now()};
  saveDraft();
  RH.renderView(true);scrollTo(0,0);
}
function itensDe(blocos){
  const itens={};
  blocos.forEach(bl=>alvos(bl).forEach(al=>(al.cl?.itens||[]).forEach(it=>{itens[prefix(bl.id,al)+it.id]={sid:bl.id,a:al.a,i:al.i,n:al.n,t:it.t,r:''}})));
  return itens}

/* ---------- rascunho da ronda em andamento (auto-save) ----------
   A ronda ativa é gravada no localStorage (uma chave por usuário) a cada resposta/edição.
   Ao recarregar, fechar a aba ou voltar à tela, ela é restaurada; é apagada ao finalizar ou descartar. */
const DRAFT_PREFIX='rh_ronda_draft:';
const draftKey=()=>st.me?DRAFT_PREFIX+st.me.id:null;
const CAMPOS=['r','tipoId','sev','desc','just','thumb','full'];
function gravar(k,R,nivel){
  /* nivel 0 = tudo; 1 = sem a foto grande; 2 = sem nenhuma foto (se o armazenamento estiver cheio) */
  const itens={};
  Object.entries(R.itens).forEach(([ik,it])=>{
    if(!(it.r||it.desc||it.just||it.tipoId))return;
    const o={};CAMPOS.forEach(c=>{if(it[c]&&!(c==='full'&&nivel>=1)&&!(c==='thumb'&&nivel>=2))o[c]=it[c]});itens[ik]=o});
  localStorage.setItem(k,JSON.stringify({v:1,uid:st.me.id,modeloId:R.modeloId,nome:R.nome,resp:R.resp,obs:R.obs||'',started:R.started,sub:R.sub||null,foco:R.foco||null,itens,savedAt:Date.now()}))}
let draftT;
function saveDraft(){
  clearTimeout(draftT);
  const k=draftKey();if(!k||!st.R)return;
  st.draftErr=true;
  for(let n=0;n<3;n++){try{gravar(k,st.R,n);st.draftErr=false;return}catch(e){}}
}
const saveDraftSoon=()=>{clearTimeout(draftT);draftT=setTimeout(saveDraft,300)};
function clearDraft(){clearTimeout(draftT);st.draftErr=false;try{const k=draftKey();if(k)localStorage.removeItem(k)}catch(e){}}
function restoreDraft(){
  const k=draftKey();if(st.R||!k)return;
  let d;try{d=JSON.parse(localStorage.getItem(k)||'null')}catch(e){d=null}
  if(!d||d.uid!==st.me.id)return;
  const m=byId(S.modelos,d.modeloId);
  if(!m||!RH.access.rondaVisivel(m,st.me)){clearDraft();return}   /* ronda removida ou sem acesso: descarta */
  const blocos=blocosDa(m),itens=itensDe(blocos);
  if(!blocos.length){clearDraft();return}
  Object.entries(d.itens||{}).forEach(([ik,v])=>{if(itens[ik])CAMPOS.forEach(c=>{if(v[c]!=null)itens[ik][c]=v[c]})});
  st.R={modeloId:m.id,nome:m.nome,resp:m.responsavelId||'',blocos,itens,obs:d.obs||'',started:d.started||Date.now()};
  if(d.sub)st.R.sub=d.sub;
  const foco=d.foco&&itens[d.foco]?d.foco:null;
  if(foco){st.R.foco=foco;setTimeout(()=>document.getElementById('it-'+foco)?.scrollIntoView({block:'center'}),150)}
  /* celulares com pouca memória podem recarregar a página enquanto a câmera está aberta */
  toast(foco&&!itens[foco].thumb?'A página foi recarregada ao abrir a câmera. Sua ronda foi recuperada; anexe a foto novamente.':'Ronda em andamento recuperada do rascunho.');
}
RH.rondaDraft={save:saveDraft,clear:clearDraft,restore:restoreDraft};
/* ao tocar em "Anexar foto", guarda qual item era e salva já (a câmera pode descarregar a página) */
document.addEventListener('click',e=>{const f=e.target.closest&&e.target.closest('[data-nc-foto]');if(f&&st.R){st.R.foco=f.dataset.k;saveDraft();try{localStorage.setItem('rh_resume',JSON.stringify({uid:st.me.id,page:'ronda',ts:Date.now()}))}catch(x){}}},true);
addEventListener('pagehide',saveDraft);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveDraft()});

function itemHtml(k){
  const it=st.R.itens[k],nc=it.r==='NC',ina=it.r==='IN',tipo=nc?byId(S.tiposNC,it.tipoId):null;
  return `<div class="it" id="it-${k}"><div class="it-row"><div class="it-t">${esc(it.t)}</div>
  <div class="seg" role="group" aria-label="Resultado">${[['C','Conforme','c'],['NC','Não conforme','n'],['IN','Inacessível','a']].map(([v,l,c])=>`<button type="button" class="${c}" data-act="res" data-k="${k}" data-r="${v}" aria-pressed="${it.r===v}">${l}</button>`).join('')}</div></div>
  ${nc?`<div class="ncp"><label class="field"><span>Tipo de não conformidade</span><select data-nc="tipoId" data-k="${k}"><option value="">Selecione…</option>${S.tiposNC.map(t=>`<option value="${t.id}" ${it.tipoId===t.id?'selected':''}>${esc(t.nome)}</option>`).join('')}</select></label>
  <label class="field"><span>Severidade</span><select data-nc="sev" data-k="${k}">${[1,2,3,4].map(s=>`<option value="${s}" ${(it.sev||2)==s?'selected':''}>${s} · ${SEV[s]}</option>`).join('')}</select></label>
  ${tipo&&tipo.orient?`<div class="full">${RH.orientBox(tipo.orient)}</div>`:''}
  <label class="field full"><span>Descrição do problema</span><textarea data-nc="desc" data-k="${k}" placeholder="O que foi encontrado, onde e em que condição?">${esc(it.desc||'')}</textarea></label>
  <div class="full ph">${it.thumb?`<img src="${it.thumb}" alt="Foto da não conformidade"><button type="button" class="btn sm" data-act="rmFoto" data-k="${k}">Remover foto</button>`:''}
  <label class="btn sm" style="cursor:pointer">${ic('cam',16)} ${it.thumb?'Trocar foto':'Anexar foto'}<input class="sr" type="file" accept="image/*" data-nc-foto data-k="${k}"></label></div></div>`:''}
  ${ina?`<div class="ncp ina"><label class="field full"><span>Descrição (obrigatória) · por que o item está inacessível?</span><textarea data-ina="just" data-k="${k}" id="ina-${k}" required aria-required="true" placeholder="Explique o motivo (ex.: sala ocupada, equipamento em uso, acesso restrito)">${esc(it.just||'')}</textarea></label></div>`:''}</div>`;
}

function rondaForm(){
  const R=st.R,blocos=R.blocos;
  const hasItems=Object.keys(R.itens).length>0;
  const nSalas=blocos.filter(b=>b.tipo==='sala').length,nEq=blocos.reduce((n,b)=>n+(b.eqIds?b.eqIds.length:0),0);
  const bloco=bl=>{
    const sala=bl.tipo==='sala'?byId(S.salas,bl.salaId):null;
    const h=sala?`<div class="sala-h"><h2>${esc(sala.nome)}</h2><small>${esc(sala.setor||'')}${sala.andar?' · '+esc(sala.andar):''}</small></div>`
      :`<div class="sala-h"><h2>Equipamentos</h2><small>${esc(bl.setor)}</small></div>`;
    return h+alvos(bl).map(al=>{
    const ks=Object.keys(R.itens).filter(k=>k.startsWith(prefix(bl.id,al)));
    const ico=al.eq?thumbEq(al.eq):`<div class="thumb">${ic('shield',22)}</div>`;
    if(!ks.length)return `<div class="grp noitems"><div class="gh">${ico}<div class="t"><b>${tagTipo(al.a)}${esc(al.n)}</b><small>Sem checklist vinculado${st.me.role==='admin'?' · vincule em Cadastros':''}</small></div></div></div>`;
    const cal=al.eq?.calibracao?RH.calBadge(al.eq.calibracao):'';
    return `<div class="grp"><div class="gh">${ico}<div class="t"><b>${tagTipo(al.a)}${esc(al.n)}</b><small>${al.eq?`<span class="mono">${esc(al.eq.patrimonio||'sem patrimônio')}</span> · ${esc(al.eq.categoria||'')}`:esc(al.cl?.nome||'')}</small> ${cal}</div></div><div class="items">${ks.map(itemHtml).join('')}</div></div>`}).join('')};
  return `<div class="top"><div><h1>${esc(R.nome)}</h1><p>${nSalas} sala${nSalas===1?'':'s'} · ${nEq} equipamento${nEq===1?'':'s'} · Início às ${new Date(R.started).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} · Responsável: ${R.resp?esc(userName(R.resp)):'todos os inspetores'} · Inspetor: ${esc(st.me.nome)}</p></div>
  <button class="btn" data-act="cancelRonda">${ic('x',16)} Descartar ronda</button></div>
  <div class="rhead"><div class="prog"><b id="prog-t"></b><div class="bar"><i id="prog-b" style="width:0"></i></div></div><button class="btn pri" data-act="submitRonda" id="btn-sub">${ic('check',16)} Finalizar ronda</button></div>
  ${hasItems?blocos.map(bloco).join(''):empty('Esta ronda não tem itens de checklist','Vincule checklists às salas e aos equipamentos em Cadastros.')}
  <div class="card"><label class="field"><span>Observações gerais da ronda (opcional)</span><textarea id="r-obs" data-robs>${esc(R.obs)}</textarea></label></div>`;
}
RH.rondaForm=rondaForm;

function progress(){
  const v=Object.values(st.R.itens),t=v.length,a=v.filter(x=>x.r).length,n=v.filter(x=>x.r==='NC').length;
  const pt=$('#prog-t');if(!pt)return;pt.textContent=`${a} de ${t} itens respondidos${n?` · ${n} não conformidade${n>1?'s':''}`:''}`;$('#prog-b').style.width=(t?a/t*100:0)+'%'}
RH.rondaProgress=progress;
function repaint(k){const e=document.getElementById('it-'+k);if(e)e.outerHTML=itemHtml(k);progress()}

async function submitRonda(){
  const R=st.R,its=Object.entries(R.itens);
  document.querySelectorAll('.it.miss').forEach(e=>e.classList.remove('miss'));
  if(!its.length){toast('Não há itens para registrar nesta ronda.','bad');return}
  const un=its.filter(([,i])=>!i.r);
  if(un.length){un.forEach(([k])=>document.getElementById('it-'+k)?.classList.add('miss'));document.getElementById('it-'+un[0][0])?.scrollIntoView({block:'center'});toast(`Faltam ${un.length} item(ns) sem resposta.`,'bad');return}
  const bad=its.filter(([,i])=>i.r==='NC'&&(!i.tipoId||!(i.desc||'').trim()));
  if(bad.length){bad.forEach(([k])=>document.getElementById('it-'+k)?.classList.add('miss'));document.getElementById('it-'+bad[0][0])?.scrollIntoView({block:'center'});toast('Informe o tipo e a descrição de cada não conformidade.','bad');return}
  const noJust=its.filter(([,i])=>i.r==='IN'&&!(i.just||'').trim());
  if(noJust.length){noJust.forEach(([k])=>document.getElementById('it-'+k)?.classList.add('miss'));document.getElementById('it-'+noJust[0][0])?.scrollIntoView({block:'center'});document.getElementById('ina-'+noJust[0][0])?.focus({preventScroll:true});toast('Descreva o motivo de cada item marcado como Inacessível.','bad');return}
  const b=$('#btn-sub');b.disabled=true;
  /* ts, execId e ids ficam guardados na ronda: se o salvamento falhar no meio e o inspetor
     tentar de novo, os mesmos documentos são sobrescritos (nada fica duplicado) */
  const sub=R.sub||(R.sub={ts:Date.now(),execId:'x'+RH.uid(),ids:{}});
  const ts=sub.ts,execId=sub.execId,mk=(k,pre)=>sub.ids[k]||(sub.ids[k]=pre+RH.uid());
  let totNC=0;
  const ok=await RH.safe(async()=>{
    totNC=0;
    for(const bl of R.blocos){
      const sid=bl.id,sala=bl.tipo==='sala'?byId(S.salas,bl.salaId):null,mine=its.filter(([,i])=>i.sid===sid);
      if(!mine.length||(bl.tipo==='sala'&&!sala))continue;
      const salaNome=sala?sala.nome:'Equipamentos',setor=bl.setor==='Sem setor'?'':bl.setor,respSetor=sala?sala.responsavelId:(S.salas.find(x=>(x.setor||'Sem setor')===bl.setor&&x.responsavelId)||{}).responsavelId;
      const v=mine.map(x=>x[1]),c=v.filter(i=>i.r==='C').length,nc=v.filter(i=>i.r==='NC').length,ina=v.filter(i=>i.r==='IN').length,rid=mk('r:'+sid,'r');
      await RH.put('rondas',rid,{ts,execId,modeloId:R.modeloId,modeloNome:R.nome,salaId:sala?sala.id:null,salaNome,setor,inspId:st.me.id,inspNome:st.me.nome,c,nc,ina,
        pct:c+nc?Math.round(c/(c+nc)*1000)/10:100,obs:(R.obs||'').trim(),itens:v.map(i=>({a:i.a,i:i.i,n:i.n,t:i.t,r:i.r,...(i.r==='IN'?{just:i.just.trim()}:{})}))});
      for(const [k,i] of mine.filter(([,i])=>i.r==='NC')){
        const tipo=byId(S.tiposNC,i.tipoId),eq=i.a==='e'?byId(S.equipamentos,i.i):null;let fotoId=null;
        if(i.full){fotoId=mk('f:'+k,'f');await RH.put('fotos',fotoId,{data:i.full})}
        const sev=+i.sev||tipo?.sev||2;
        await RH.put('ncs',mk('n:'+k,'n'),{ts,rondaId:rid,execId,modeloId:R.modeloId,modeloNome:R.nome,salaId:sala?sala.id:null,salaNome,setor,eqId:eq?.id||null,eqNome:eq?.nome||'',itemTexto:i.t,
          tipoId:i.tipoId,tipoNome:tipo?.nome||'',orient:tipo?.orient||'',sev,desc:i.desc.trim(),thumb:i.thumb||null,fotoId,status:'aberta',resp:respSetor||null,prazo:ts+([0,14,7,3,1][sev])*864e5,inspNome:st.me.nome});
        totNC++;
      }
    }return true});
  if(ok){RH.rondaDraft.clear();st.R=null;toast(totNC?`Ronda registrada com ${totNC} não conformidade${totNC>1?'s':''}.`:'Ronda registrada sem não conformidades.');RH.go(RH.access.gerencia()?'historico':'ronda')}
  else b.disabled=false;
}

/* ---------- eventos ---------- */
Object.assign(RH.ACT,{
  pickRonda:el=>startRonda(el.dataset.id),
  resumeRonda:()=>RH.renderView(true),
  cancelRonda:()=>{if(RH.confirmArm(RH.ACT.cancelRonda,'Toque de novo para descartar a ronda')){RH.rondaDraft.clear();st.R=null;RH.renderView(true)}},
  res:el=>{const it=st.R.itens[el.dataset.k];it.r=it.r===el.dataset.r?'':el.dataset.r;if(it.r==='NC'&&!it.sev)it.sev=2;repaint(el.dataset.k);saveDraft();if(it.r==='IN')document.getElementById('ina-'+el.dataset.k)?.focus({preventScroll:true})},
  rmFoto:el=>{const it=st.R.itens[el.dataset.k];it.thumb=it.full=null;repaint(el.dataset.k);saveDraft()},
  submitRonda
});
RH.ON_CHANGE.push(async el=>{
  if(el.dataset.nc){
    const it=st.R.itens[el.dataset.k],f=el.dataset.nc;it[f]=el.value;
    if(f==='tipoId'){const t=byId(S.tiposNC,el.value);if(t)it.sev=t.sev;repaint(el.dataset.k)} /* mostra a orientação do tipo */
    saveDraft();return true}
  if(el.dataset.ncFoto!=null){
    if(el.files[0]){try{Object.assign(st.R.itens[el.dataset.k],await RH.processImg(el.files[0]));repaint(el.dataset.k);saveDraft()}catch(err){toast('Não foi possível ler a imagem.','bad')}}
    return true}
  return false});
RH.ON_INPUT.push(el=>{
  if(el.dataset.nc==='desc'){st.R.itens[el.dataset.k].desc=el.value;saveDraftSoon();return true}
  if(el.dataset.ina==='just'){st.R.itens[el.dataset.k].just=el.value;el.setCustomValidity('');saveDraftSoon();return true}
  if(el.dataset.robs!=null){st.R.obs=el.value;saveDraftSoon();return true}
  return false});
})();
