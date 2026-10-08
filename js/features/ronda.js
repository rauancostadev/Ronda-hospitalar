/* ==========================================================================
   Nova ronda: lista as rondas cadastradas (Cadastros → Rondas) que o usuário pode
   realizar e conduz o preenchimento do checklist de TODAS as salas da ronda.

   Regras de acesso:
   - ronda com responsável  → só ele a vê e realiza;
   - ronda "Sem responsável" → todos os usuários com acesso à tela (todos os inspetores).
   Ao finalizar, gera um documento em `rondas` por sala visitada (todos com o mesmo
   execId, modeloId e modeloNome) e uma não conformidade em `ncs` para cada item NC.
   ========================================================================== */
(()=>{
const RH=window.RH;
const {$,esc,S,st,byId,userName,pc,ago,fdt,fd,ic,empty,toast,SEV}=RH;

/* alvos de uma sala: o ambiente e cada equipamento ativo */
function alvos(sala){
  const o=[{a:'s',i:sala.id,n:'Ambiente · '+sala.nome,cl:byId(S.checklists,sala.checklistId)}];
  S.equipamentos.filter(e=>e.salaId===sala.id&&e.ativo!==false).forEach(e=>o.push({a:'e',i:e.id,n:e.nome,eq:e,cl:byId(S.checklists,e.checklistId)}));
  return o}
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
    const l=lastExec(m.id),late=!l||Date.now()-l.ts>(+m.freq||24)*36e5,salas=RH.salasDaRonda(m);
    const ne=salas.reduce((n,s)=>n+S.equipamentos.filter(e=>e.salaId===s.id&&e.ativo!==false).length,0);
    return `<button class="sala" data-act="pickRonda" data-id="${m.id}"><div class="h"><b>${esc(m.nome)}</b>${late?'<span class="pill late">Em atraso</span>':'<span class="pill okp">Em dia</span>'}</div>
    ${m.descricao?`<small>${esc(m.descricao)}</small>`:''}
    <div class="f"><span>${salas.length} sala${salas.length===1?'':'s'}</span><span>${ne} equipamento${ne===1?'':'s'}</span></div>
    <div class="f"><span>Responsável: ${m.responsavelId?esc(userName(m.responsavelId)):'todos os inspetores'}</span></div>
    <small>${l?`Última realização ${ago(l.ts)}`:'Nunca realizada'} · a cada ${+m.freq||24} h</small></button>`}).join('')}</div>`:vazio}`;
};

/* ---------- execução ---------- */
function startRonda(id){
  const m=byId(S.modelos,id);if(!m)return;
  if(!RH.access.rondaVisivel(m,st.me)){toast('Você não tem acesso a esta ronda.','bad');return}
  const salas=RH.salasDaRonda(m);
  if(!salas.length){toast('Esta ronda não tem salas ativas. Ajuste em Cadastros → Rondas.','bad');return}
  const itens={};
  salas.forEach(sala=>alvos(sala).forEach(al=>(al.cl?.itens||[]).forEach(it=>{itens[prefix(sala.id,al)+it.id]={sid:sala.id,a:al.a,i:al.i,n:al.n,t:it.t,r:''}})));
  st.R={modeloId:m.id,nome:m.nome,resp:m.responsavelId||'',salaIds:salas.map(s=>s.id),itens,obs:'',started:Date.now()};
  RH.renderView(true);scrollTo(0,0);
}

function itemHtml(k){
  const it=st.R.itens[k],nc=it.r==='NC',tipo=nc?byId(S.tiposNC,it.tipoId):null;
  return `<div class="it" id="it-${k}"><div class="it-row"><div class="it-t">${esc(it.t)}</div>
  <div class="seg" role="group" aria-label="Resultado">${[['C','Conforme','c'],['NC','Não conforme','n'],['NA','N/A','a']].map(([v,l,c])=>`<button type="button" class="${c}" data-act="res" data-k="${k}" data-r="${v}" aria-pressed="${it.r===v}">${l}</button>`).join('')}</div></div>
  ${nc?`<div class="ncp"><label class="field"><span>Tipo de não conformidade</span><select data-nc="tipoId" data-k="${k}"><option value="">Selecione…</option>${S.tiposNC.map(t=>`<option value="${t.id}" ${it.tipoId===t.id?'selected':''}>${esc(t.nome)}</option>`).join('')}</select></label>
  <label class="field"><span>Severidade</span><select data-nc="sev" data-k="${k}">${[1,2,3,4].map(s=>`<option value="${s}" ${(it.sev||2)==s?'selected':''}>${s} · ${SEV[s]}</option>`).join('')}</select></label>
  ${tipo&&tipo.orient?`<div class="full">${RH.orientBox(tipo.orient)}</div>`:''}
  <label class="field full"><span>Descrição do problema</span><textarea data-nc="desc" data-k="${k}" placeholder="O que foi encontrado, onde e em que condição?">${esc(it.desc||'')}</textarea></label>
  <div class="full ph">${it.thumb?`<img src="${it.thumb}" alt="Foto da não conformidade"><button type="button" class="btn sm" data-act="rmFoto" data-k="${k}">Remover foto</button>`:''}
  <label class="btn sm" style="cursor:pointer">${ic('cam',16)} ${it.thumb?'Trocar foto':'Anexar foto'}<input class="sr" type="file" accept="image/*" capture="environment" data-nc-foto data-k="${k}"></label></div></div>`:''}</div>`;
}

function rondaForm(){
  const R=st.R,salas=R.salaIds.map(id=>byId(S.salas,id)).filter(Boolean);
  const hasItems=Object.keys(R.itens).length>0;
  const guia=S.tiposNC.filter(t=>t.orient);
  const bloco=sala=>`<div class="sala-h"><h2>${esc(sala.nome)}</h2><small>${esc(sala.setor||'')}${sala.andar?' · '+esc(sala.andar):''}</small></div>`+alvos(sala).map(al=>{
    const ks=Object.keys(R.itens).filter(k=>k.startsWith(prefix(sala.id,al)));
    if(!ks.length)return `<div class="grp noitems"><div class="gh">${al.eq?thumbEq(al.eq):`<div class="thumb">${ic('shield',22)}</div>`}<div class="t"><b>${esc(al.n)}</b><small>Sem checklist vinculado${st.me.role==='admin'?' · vincule em Cadastros':''}</small></div></div></div>`;
    const cal=al.eq?.calibracao?RH.calBadge(al.eq.calibracao):'';
    return `<div class="grp"><div class="gh">${al.eq?thumbEq(al.eq):`<div class="thumb">${ic('shield',22)}</div>`}<div class="t"><b>${esc(al.n)}</b><small>${al.eq?`<span class="mono">${esc(al.eq.patrimonio||'sem patrimônio')}</span> · ${esc(al.eq.categoria||'')}`:esc(al.cl?.nome||'')}</small> ${cal}</div><button class="btn sm" data-act="allc" data-pre="${prefix(sala.id,al)}">Tudo conforme</button></div><div class="items">${ks.map(itemHtml).join('')}</div></div>`}).join('');
  return `<div class="top"><div><h1>${esc(R.nome)}</h1><p>${salas.length} sala${salas.length===1?'':'s'} · Responsável: ${R.resp?esc(userName(R.resp)):'todos os inspetores'} · Inspetor: ${esc(st.me.nome)}</p></div>
  <button class="btn" data-act="cancelRonda">${ic('x',16)} Descartar ronda</button></div>
  <div class="rhead"><div class="prog"><b id="prog-t"></b><div class="bar"><i id="prog-b" style="width:0"></i></div></div><button class="btn pri" data-act="submitRonda" id="btn-sub">${ic('check',16)} Finalizar ronda</button></div>
  ${guia.length?`<details class="card guide"><summary>Orientações por tipo de não conformidade</summary><div class="guide-l">${guia.map(t=>`<div><b>${esc(t.nome)}</b> ${RH.sevPill(t.sev||2)}<p>${esc(t.orient)}</p></div>`).join('')}</div></details>`:''}
  ${hasItems?salas.map(bloco).join(''):empty('Esta ronda não tem itens de checklist','Vincule checklists às salas e aos equipamentos em Cadastros.')}
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
  const b=$('#btn-sub');b.disabled=true;
  /* ts, execId e ids ficam guardados na ronda: se o salvamento falhar no meio e o inspetor
     tentar de novo, os mesmos documentos são sobrescritos (nada fica duplicado) */
  const sub=R.sub||(R.sub={ts:Date.now(),execId:'x'+RH.uid(),ids:{}});
  const ts=sub.ts,execId=sub.execId,mk=(k,pre)=>sub.ids[k]||(sub.ids[k]=pre+RH.uid());
  let totNC=0;
  const ok=await RH.safe(async()=>{
    totNC=0;
    for(const sid of R.salaIds){
      const sala=byId(S.salas,sid),mine=its.filter(([,i])=>i.sid===sid);
      if(!sala||!mine.length)continue;
      const v=mine.map(x=>x[1]),c=v.filter(i=>i.r==='C').length,nc=v.filter(i=>i.r==='NC').length,na=v.filter(i=>i.r==='NA').length,rid=mk('r:'+sid,'r');
      await RH.put('rondas',rid,{ts,execId,modeloId:R.modeloId,modeloNome:R.nome,salaId:sala.id,salaNome:sala.nome,setor:sala.setor||'',inspId:st.me.id,inspNome:st.me.nome,c,nc,na,
        pct:c+nc?Math.round(c/(c+nc)*1000)/10:100,obs:(R.obs||'').trim(),itens:v.map(i=>({a:i.a,i:i.i,n:i.n,t:i.t,r:i.r}))});
      for(const [k,i] of mine.filter(([,i])=>i.r==='NC')){
        const tipo=byId(S.tiposNC,i.tipoId),eq=i.a==='e'?byId(S.equipamentos,i.i):null;let fotoId=null;
        if(i.full){fotoId=mk('f:'+k,'f');await RH.put('fotos',fotoId,{data:i.full})}
        const sev=+i.sev||tipo?.sev||2;
        await RH.put('ncs',mk('n:'+k,'n'),{ts,rondaId:rid,execId,modeloId:R.modeloId,modeloNome:R.nome,salaId:sala.id,salaNome:sala.nome,setor:sala.setor||'',eqId:eq?.id||null,eqNome:eq?.nome||'',itemTexto:i.t,
          tipoId:i.tipoId,tipoNome:tipo?.nome||'',orient:tipo?.orient||'',sev,desc:i.desc.trim(),thumb:i.thumb||null,fotoId,status:'aberta',resp:sala.responsavelId||null,prazo:ts+([0,14,7,3,1][sev])*864e5,inspNome:st.me.nome});
        totNC++;
      }
    }return true});
  if(ok){st.R=null;toast(totNC?`Ronda registrada com ${totNC} não conformidade${totNC>1?'s':''}.`:'Ronda registrada sem não conformidades.');RH.go(RH.access.can('historico')?'historico':'ronda')}
  else b.disabled=false;
}

/* ---------- eventos ---------- */
Object.assign(RH.ACT,{
  pickRonda:el=>startRonda(el.dataset.id),
  resumeRonda:()=>RH.renderView(true),
  cancelRonda:()=>{if(RH.confirmArm(RH.ACT.cancelRonda,'Toque de novo para descartar a ronda')){st.R=null;RH.renderView(true)}},
  res:el=>{const it=st.R.itens[el.dataset.k];it.r=it.r===el.dataset.r?'':el.dataset.r;if(it.r==='NC'&&!it.sev)it.sev=2;repaint(el.dataset.k)},
  allc:el=>{Object.keys(st.R.itens).filter(k=>k.startsWith(el.dataset.pre)).forEach(k=>{if(st.R.itens[k].r!=='NC'){st.R.itens[k].r='C';repaint(k)}})},
  rmFoto:el=>{const it=st.R.itens[el.dataset.k];it.thumb=it.full=null;repaint(el.dataset.k)},
  submitRonda
});
RH.ON_CHANGE.push(async el=>{
  if(el.dataset.nc){
    const it=st.R.itens[el.dataset.k],f=el.dataset.nc;it[f]=el.value;
    if(f==='tipoId'){const t=byId(S.tiposNC,el.value);if(t)it.sev=t.sev;repaint(el.dataset.k)} /* mostra a orientação do tipo */
    return true}
  if(el.dataset.ncFoto!=null){
    if(el.files[0]){try{Object.assign(st.R.itens[el.dataset.k],await RH.processImg(el.files[0]));repaint(el.dataset.k)}catch(err){toast('Não foi possível ler a imagem.','bad')}}
    return true}
  return false});
RH.ON_INPUT.push(el=>{
  if(el.dataset.nc==='desc'){st.R.itens[el.dataset.k].desc=el.value;return true}
  if(el.dataset.robs!=null){st.R.obs=el.value;return true}
  return false});
})();
