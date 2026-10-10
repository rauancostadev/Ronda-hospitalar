/* ==========================================================================
   Cadastros (somente administrador): Rondas, Salas, Equipamentos, Checklists,
   Tipos de NC, Usuários e dados do hospital / backup.
   Cada entidade é descrita em ENT (colunas da tabela + campos do formulário).
   ========================================================================== */
(()=>{
const RH=window.RH;
const {$,esc,uid,S,st,byId,userName,ic,empty,toast,modal,closeModal,sevPill,actPill,ROLE,SEV}=RH;

const optsSetor=()=>[...new Set([...S.salas.map(s=>s.setor),...S.equipamentos.map(RH.setorEq)].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const usersAtivos=()=>S.users.filter(u=>u.ativo!==false);
/* setores das salas de uma ronda, cada setor uma única vez (ordem alfabética) */
const setoresDa=m=>[...new Set([...(m.salaIds||[]).map(id=>byId(S.salas,id)).filter(Boolean).map(x=>x.setor||'Sem setor'),...RH.equipsDaRonda(m).map(e=>RH.setorEq(e)||'Sem setor')])].sort((a,b)=>a.localeCompare(b));

/* quem pode realizar a ronda: texto + selo */
function acessoRonda(m){
  if(!m.responsavelId)return '<span class="pill okp">Todos os inspetores</span>';
  const u=byId(S.users,m.responsavelId);
  if(!u||u.ativo===false)return `<span class="pill late">Responsável inativo</span>`;
  return `<span class="pill inf">Somente ${esc(u.nome)}</span>`;
}

const TIPO_CK={sala:'Sala',equipamento:'Equipamento',ambos:'Sala e equipamento'};
const ENT={
 modelos:{col:'modelos',nome:'Rondas',um:'ronda',
  cols:[['Nome da ronda',m=>`<b>${esc(m.nome)}</b><small>${esc(m.descricao||'')}</small>`],['Setores',m=>setoresDa(m).map(esc).join(', ')||'—'],['Quem realiza',acessoRonda],['Dias e horários',m=>esc(RH.agenda.resumo(m))],['Situação',actPill]],
  fields:[
   {k:'nome',l:'Nome da ronda',req:1,full:1,hint:'Ex.: Ronda UTI · plantão diurno'},
   {k:'descricao',l:'Descrição / roteiro (opcional)',full:1},
   {k:'responsavelId',l:'Responsável pela ronda',t:'select',full:1,opts:()=>usersAtivos().map(u=>[u.id,u.nome+(u.cargo?' · '+u.cargo:'')]),blank:'Sem responsável (todos os inspetores)',
    hint:'Somente o responsável escolhido vê e realiza esta ronda. Com "Sem responsável", todos os inspetores podem realizá-la.'},
   {k:'ativo',l:'Ronda ativa',t:'check',def:true,full:1},
   {k:'agenda',l:'Dias e horários da ronda',t:'agenda',full:1},
   {k:'salaIds',l:'Setor (salas e equipamentos)',t:'salas',full:1}]},
 salas:{col:'salas',nome:'Salas',um:'sala',
  cols:[['Sala',s=>`<b>${esc(s.nome)}</b><small>${esc(s.andar||'')}</small>`],['Setor',s=>esc(s.setor||'—')],['Responsável pela sala',s=>esc(userName(s.responsavelId))],['Equipamentos no setor',s=>S.equipamentos.filter(e=>s.setor&&RH.setorEq(e)===s.setor).length],['Rondas',s=>S.modelos.filter(m=>(m.salaIds||[]).includes(s.id)).length||'<span class="pill late">Fora de rondas</span>'],['Situação',actPill]],
  fields:[{k:'nome',l:'Nome da sala / ambiente',req:1,full:1},{k:'setor',l:'Setor',req:1,list:optsSetor,hint:'Ex.: UTI, Centro Cirúrgico, Emergência'},{k:'andar',l:'Andar / bloco'},
   {k:'responsavelId',l:'Responsável pela sala (recebe as NCs)',t:'select',full:1,opts:()=>usersAtivos().map(u=>[u.id,u.nome+(u.cargo?' · '+u.cargo:'')]),blank:'Sem responsável'},
   {k:'checklistId',l:'Checklist da sala',t:'select',full:1,opts:()=>S.checklists.filter(c=>['sala','ambos'].includes(c.tipo)).map(c=>[c.id,c.nome]),blank:'Nenhum'},
   {k:'ativo',l:'Sala ativa (aparece nas rondas)',t:'check',def:true,full:1}],
  canDel:s=>S.modelos.some(m=>(m.salaIds||[]).includes(s.id))?'Esta sala faz parte de uma ronda. Remova-a da ronda antes de excluir. Ou apenas desative a sala.':''},
 equipamentos:{col:'equipamentos',nome:'Equipamentos',um:'equipamento',
  cols:[['Equipamento',e=>`<div style="display:flex;gap:10px;align-items:center">${RH.thumbEq(e)}<div><b>${esc(e.nome)}</b><small class="mono">${esc(e.patrimonio||'')}</small></div></div>`],['Categoria',e=>esc(e.categoria||'—')],['Setor',e=>esc(RH.setorEq(e)||'—')],['Calibração',e=>e.calibracao?RH.calBadge(e.calibracao):'—'],['Situação',actPill]],
  fields:[{k:'nome',l:'Nome do equipamento',req:1},{k:'patrimonio',l:'Nº de patrimônio / série'},{k:'categoria',l:'Categoria',list:()=>[...new Set(S.equipamentos.map(e=>e.categoria).filter(Boolean))],hint:'Ex.: Suporte à vida, Esterilização'},
   {k:'setor',l:'Setor',req:1,list:optsSetor,hint:'Setor onde o equipamento fica. Ex.: UTI, Centro Cirúrgico'},
   {k:'checklistId',l:'Checklist do equipamento',t:'select',opts:()=>S.checklists.filter(c=>['equipamento','ambos'].includes(c.tipo)).map(c=>[c.id,c.nome]),blank:'Nenhum'},
   {k:'calibracao',l:'Validade da calibração',t:'date'},{k:'foto',l:'Foto do equipamento',t:'photo',full:1},
   {k:'obs',l:'Observações',t:'textarea',full:1},{k:'ativo',l:'Equipamento ativo',t:'check',def:true,full:1}]},
 checklists:{col:'checklists',nome:'Checklists',um:'checklist',
  cols:[['Checklist',c=>`<b>${esc(c.nome)}</b>`],['Aplica-se a',c=>TIPO_CK[c.tipo]||'Sala'],['Itens',c=>(c.itens||[]).length],['Em uso',c=>S.salas.filter(s=>s.checklistId===c.id).length+S.equipamentos.filter(e=>e.checklistId===c.id).length+' vínculos']],
  fields:[{k:'nome',l:'Nome do checklist',req:1,full:1},{k:'tipo',l:'Aplica-se a',t:'select',req:1,opts:()=>Object.entries(TIPO_CK),hint:'Escolha "Sala e equipamento" para usar o mesmo checklist nos dois cadastros.'},{k:'itens',l:'Itens a verificar',t:'items',full:1}],
  canDel:c=>S.salas.some(s=>s.checklistId===c.id)||S.equipamentos.some(e=>e.checklistId===c.id)?'Este checklist está vinculado a salas ou equipamentos. Troque o vínculo antes de excluir.':''},
 tiposNC:{col:'tiposNC',nome:'Tipos de NC',um:'tipo de não conformidade',
  cols:[['Tipo',t=>`<b>${esc(t.nome)}</b>`],['Severidade padrão',t=>sevPill(t.sev||2)],['Orientação / ação esperada (exibida ao inspetor)',t=>t.orient?`<span style="white-space:normal">${esc(t.orient)}</span>`:'<small>—</small>'],['Registros',t=>S.ncs.filter(n=>n.tipoId===t.id).length]],
  fields:[{k:'nome',l:'Nome',req:1,full:1},{k:'sev',l:'Severidade padrão',t:'select',req:1,opts:()=>[1,2,3,4].map(s=>[s,s+' · '+SEV[s]]),def:2},
   {k:'orient',l:'Orientação / ação esperada',t:'textarea',full:1,sugerir:1,hint:'Sugerida automaticamente a partir do nome (você pode editar). Aparece como alerta para o inspetor ao registrar este tipo de não conformidade durante a ronda.'}]},
 users:{col:'users',nome:'Responsáveis e usuários',um:'usuário',
  cols:[['Nome',u=>`<b>${esc(u.nome)}</b><small>${esc(u.cargo||'')}</small>`],['Usuário',u=>`<span class="mono">${esc(u.login||'—')}</span>`],['Perfil',u=>ROLE[u.role]||'—'],['Acesso',u=>u.hash?actPill(u):'<span class="pill off">Sem senha</span>']],
  fields:[{k:'nome',l:'Nome completo',req:1},{k:'cargo',l:'Cargo / função',hint:'Ex.: Enfermeira, Engenheiro clínico'},{k:'login',l:'Usuário de acesso',req:1},{k:'senha',l:'Senha',t:'password',hint:RH.SENHA_REGRA+' Deixe em branco para manter a atual.'},
   {k:'role',l:'Perfil de acesso',t:'select',req:1,opts:()=>Object.entries(ROLE),def:'inspetor',full:1,hint:'Administrador: tudo. Gestor: painel, histórico e tratamento de NCs. Inspetor: apenas a tela Nova ronda.'},{k:'ativo',l:'Usuário ativo',t:'check',def:true,full:1}],
  canDel:u=>u.id===st.me.id?'Você não pode excluir o próprio usuário.':(u.role==='admin'&&S.users.filter(x=>x.role==='admin'&&x.ativo!==false).length<2?'É o único administrador ativo.':(S.modelos.some(m=>m.responsavelId===u.id)?'Este usuário é responsável por rondas. Troque o responsável das rondas antes de excluir. Ou apenas desative o usuário.':''))}
};
RH.ENT=ENT;

/* ---------- backup ---------- */
function backupCard(){
  const L=RH.store,rem=L.mode==='remote';
  return `<div class="card" style="max-width:560px;margin-top:14px"><h3>${rem?'Base compartilhada e backup':'Backup dos dados'}</h3>
  ${rem?`<p style="margin:0 0 6px;color:var(--ink2)"><span class="pill okp"><i></i>Conectado ao banco compartilhado</span><br>Todos os usuários da equipe veem os mesmos dados, atualizados a cada poucos segundos. Mesmo assim, exporte um backup de vez em quando.</p>`
  :`<p style="margin:0 0 6px;color:var(--ink2)">Neste modo os dados ficam salvos só no navegador deste aparelho e não são compartilhados. Para a equipe usar a mesma base, configure o banco compartilhado (veja o LEIA-ME). Exporte backups com frequência.</p>`}
  ${L.volatile()?'<p class="err">Atenção: este navegador bloqueou o armazenamento. Os dados serão perdidos ao fechar a aba.</p>':''}
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" data-act="exportBackup">Exportar backup (.json)</button><label class="btn" style="cursor:pointer">Importar backup<input class="sr" type="file" accept="application/json,.json" data-import></label>${rem?'<button class="btn" data-act="changeCode">Trocar código de acesso neste aparelho</button>':''}</div></div>`;
}

/* ---------- página ---------- */
RH.pages.cadastros=()=>{
  const tabs=[...Object.keys(ENT),'hospital'],nm=k=>k==='hospital'?'Hospital':ENT[k].nome;
  let body='';
  if(st.cadTab==='hospital'){
    const demo=['users','salas','equipamentos','checklists','tiposNC','modelos','rondas','ncs'].reduce((n,c)=>n+S[c].filter(x=>x.demo).length,0);
    body=`<form id="f-cfg" class="card" style="max-width:560px;display:grid;gap:14px"><h3>Dados do hospital</h3><label class="field"><span>Nome do hospital</span><input type="text" name="hospital" value="${esc(S.cfg.hospital||'')}" required></label>
    <label class="field"><span>Meta de conformidade (%)</span><input type="number" name="meta" min="50" max="100" value="${+S.cfg.meta||95}"></label><div><button class="btn pri" type="submit">Salvar</button></div></form>
    <div class="card" style="max-width:560px;margin-top:14px"><h3>Dados de exemplo</h3><p style="margin:0 0 12px;color:var(--ink2)">${demo?`Há ${demo} registros de exemplo no sistema. Remova-os antes de começar a usar de verdade.`:'Carregue salas, equipamentos, checklists, rondas e 4 semanas de execuções fictícias para conhecer o painel.'}</p>
    <div class="prog-seed" id="seed-prog" hidden><i></i></div>
    ${demo?`<button class="btn bad" data-act="wipeDemo">Remover dados de exemplo</button>`:`<button class="btn" data-act="seedDemo">Carregar dados de exemplo</button>`}</div>${backupCard()}`;
  }else{
    const E=ENT[st.cadTab],rows=[...S[E.col]].sort((a,b)=>(a.nome||'').localeCompare(b.nome||''));
    body=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap"><small>${rows.length} cadastrado${rows.length===1?'':'s'} · clique em uma linha para editar ou use Duplicar</small><button class="btn pri" data-act="newEnt">${ic('plus',16)} Adicionar ${E.um}</button></div>
    ${rows.length?`<div class="tw"><table><thead><tr>${E.cols.map(c=>`<th>${c[0]}</th>`).join('')}<th class="th-act"><span class="sr">Ações</span></th></tr></thead><tbody>${rows.map(r=>`<tr data-act="editEnt" data-id="${r.id}">${E.cols.map(c=>`<td>${c[1](r)}</td>`).join('')}<td class="td-act"><button type="button" class="btn sm" data-act="dupEnt" data-id="${r.id}" title="Duplicar este cadastro" aria-label="Duplicar ${esc(r.nome||'')}">${ic('copy',14)} Duplicar</button></td></tr>`).join('')}</tbody></table></div>`:empty(`Nenhum cadastro em ${E.nome}`,'Use o botão Adicionar para criar o primeiro.')}`;
  }
  return `<div class="top"><div><h1>Cadastros</h1><p>Rondas, salas, equipamentos, checklists, tipos de não conformidade e usuários.</p></div></div>
  <div class="tabs" role="tablist">${tabs.map(k=>`<button role="tab" data-act="cadTab" data-k="${k}" aria-selected="${st.cadTab===k}">${nm(k)}</button>`).join('')}</div>${body}`;
};

/* ---------- formulário ---------- */
const fotoPrev=()=>st.M.foto.thumb&&!st.M.foto.remove?`<img class="thumb" style="width:72px;height:72px" src="${st.M.foto.thumb}" alt="Foto atual">`:`<div class="thumb" style="width:72px;height:72px">${ic('dev',26)}</div>`;
const itemsHtml=()=>st.M.items.map((it,i)=>`<div class="irow"><input type="text" data-itx="${i}" value="${esc(it.t)}" placeholder="Ex.: Equipamento limpo e sem avarias" aria-label="Item ${i+1}"><button type="button" class="ic-btn" data-act="itUp" data-i="${i}" aria-label="Subir">${ic('up',14)}</button><button type="button" class="ic-btn" data-act="itDn" data-i="${i}" aria-label="Descer">${ic('dn',14)}</button><button type="button" class="ic-btn" data-act="itDel" data-i="${i}" aria-label="Remover">${ic('trash',14)}</button></div>`).join('')||'<div class="hint" style="margin-bottom:8px">Nenhum item. Adicione os pontos que o inspetor deve verificar.</div>';

/* Setor (salas e equipamentos): para cada setor, as salas ficam à esquerda e os equipamentos à direita */
function salasPicker(f,v){
  const sel=new Set(Array.isArray(v)?v:[]),seq=new Set(st.M.equipIds||[]),sn=x=>x||'Sem setor';
  const salas=S.salas.filter(s=>s.ativo!==false||sel.has(s.id)),eqs=S.equipamentos.filter(e=>e.ativo!==false||seq.has(e.id));
  const ks=[...new Set([...salas.map(s=>sn(s.setor)),...eqs.map(e=>sn(RH.setorEq(e)))])].sort((a,b)=>a.localeCompare(b));
  const h=ks.map((k,i)=>{
    const ls=salas.filter(s=>sn(s.setor)===k).sort((a,b)=>a.nome.localeCompare(b.nome)),le=eqs.filter(e=>sn(RH.setorEq(e))===k).sort((a,b)=>a.nome.localeCompare(b.nome));
    const all=ls.every(s=>sel.has(s.id))&&le.every(e=>seq.has(e.id));
    return `<div class="sg"><label class="gt"><input type="checkbox" data-setor-all="${i}" ${all?'checked':''}> ${esc(k)} <small>(marcar salas e equipamentos do setor)</small></label>
    <div class="sg-c"><div><h5>Salas</h5>${ls.map(s=>`<label class="chk"><input type="checkbox" data-sala data-g="${i}" value="${s.id}" ${sel.has(s.id)?'checked':''}> ${esc(s.nome)}${s.andar?` <small>${esc(s.andar)}</small>`:''}${s.ativo===false?' <small>(inativa)</small>':''}</label>`).join('')||'<small>Nenhuma sala</small>'}</div>
    <div><h5>Equipamentos</h5>${le.map(e=>`<label class="chk"><input type="checkbox" data-eq data-g="${i}" value="${e.id}" ${seq.has(e.id)?'checked':''}> ${esc(e.nome)}${e.patrimonio?` <small>${esc(e.patrimonio)}</small>`:''}${e.ativo===false?' <small>(inativo)</small>':''}</label>`).join('')||'<small>Nenhum equipamento</small>'}</div></div></div>`}).join('');
  return `<div class="full"><span class="hint" style="font-weight:600;color:var(--ink2)">${esc(f.l)} *</span><div class="chk-list setor-pick" id="salas-pick" style="margin-top:6px">${h||'<small>Cadastre salas ou equipamentos antes de criar uma ronda.</small>'}</div><small>Salas e equipamentos são percorridos por setor, com os checklists vinculados a cada um.</small></div>`}

/* dias da semana + horários em que a ronda deve ser realizada */
const horasHtml=()=>st.M.horarios.map((h,i)=>`<div class="irow"><input type="time" data-hx="${i}" value="${esc(h)}" required aria-label="Horário ${i+1}"><button type="button" class="ic-btn" data-act="agDelH" data-i="${i}" aria-label="Remover horário">${ic('trash',14)}</button></div>`).join('')||'<div class="hint" style="margin-bottom:8px">Nenhum horário. Adicione ao menos um.</div>';
function agendaPicker(f){
  const on=new Set(st.M.dias);
  return `<div class="full"><span class="hint" style="font-weight:600;color:var(--ink2)">${esc(f.l)} *</span>
  <div class="dias" id="ag-dias" style="margin-top:6px">${RH.agenda.DIAS.map((n,i)=>`<label class="dia"><input type="checkbox" data-dia value="${i}" ${on.has(i)?'checked':''}> ${n}</label>`).join('')}</div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0"><button type="button" class="btn sm" data-act="agDias" data-v="todos">Todos os dias</button><button type="button" class="btn sm" data-act="agDias" data-v="uteis">Segunda a sexta</button></div>
  <div id="ag-horas">${horasHtml()}</div>
  <button type="button" class="btn sm" data-act="agAddH">${ic('plus',14)} Adicionar horário</button>
  <div><small>A ronda deve ser feita em cada dia marcado, em cada horário. Fica "em atraso" 1 hora depois do horário sem ser realizada.</small></div></div>`}

function fieldHtml(f,v){
  const cls=f.full?'field full':'field',id='ff-'+f.k;
  if(f.t==='check')return `<label class="chk ${f.full?'full':''}"><input type="checkbox" name="${f.k}" id="${id}" ${v?'checked':''}> ${esc(f.l)}</label>`;
  if(f.t==='salas')return salasPicker(f,v);
  if(f.t==='agenda')return agendaPicker(f);
  if(f.t==='items')return `<div class="full"><span class="hint" style="font-weight:600;color:var(--ink2)">${esc(f.l)}</span><div id="items" style="margin-top:8px">${itemsHtml()}</div><button type="button" class="btn sm" data-act="itAdd">${ic('plus',14)} Adicionar item</button></div>`;
  if(f.t==='photo')return `<div class="full"><span class="hint" style="font-weight:600;color:var(--ink2)">${esc(f.l)}</span><div style="display:flex;gap:12px;align-items:center;margin-top:8px;flex-wrap:wrap"><div id="foto-prev">${fotoPrev()}</div><label class="btn sm" style="cursor:pointer">${ic('cam',16)} Escolher imagem<input class="sr" type="file" accept="image/*" id="ff-foto" data-ent-foto></label><button type="button" class="btn sm" data-act="rmEntFoto">Remover</button></div></div>`;
  let inp;
  if(f.t==='select')inp=`<select name="${f.k}" id="${id}" ${f.req?'required':''}>${f.blank!==undefined?`<option value="">${f.blank}</option>`:''}${f.opts().map(([o,l])=>`<option value="${esc(o)}" ${String(v)===String(o)?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
  else if(f.t==='textarea')inp=`<textarea name="${f.k}" id="${id}">${esc(v||'')}</textarea>${f.sugerir?`<div><button type="button" class="btn sm" data-act="genOrient">${ic('check',14)} Gerar sugestão a partir do nome</button></div>`:''}`;
  else if(f.t==='password')inp=`<div style="display:flex;gap:8px"><input type="text" class="pw" name="${f.k}" id="${id}" value="" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" style="flex:1"><button type="button" class="btn sm" data-act="genPw" style="min-height:38px">Gerar senha forte</button></div>`;
  else inp=`<input type="${f.t||'text'}" name="${f.k}" id="${id}" value="${esc(v??'')}" ${f.req?'required':''} ${f.list?`list="dl-${f.k}"`:''}>${f.list?`<datalist id="dl-${f.k}">${f.list().map(o=>`<option value="${esc(o)}">`).join('')}</datalist>`:''}`;
  return `<label class="${cls}"><span>${esc(f.l)}${f.req?' *':''}</span>${inp}${f.hint?`<small>${esc(f.hint)}</small>`:''}</label>`;
}

/* duplicar: abre o formulário de novo cadastro já preenchido com os dados do original */
function preparaCopia(ent,d){
  d.nome=(d.nome||'')+' (cópia)';
  if(ent==='users'){d.login='';d.hash=null;d.salt=null}
  if(ent==='equipamentos')d.patrimonio='';
  if(ent==='checklists')d.itens=(d.itens||[]).map(x=>({...x,id:'i'+uid()}));
  delete d.id;delete d.demo}
function openEnt(ent,id,dupId){
  const E=ENT[ent],d=id||dupId?{...byId(S[E.col],id||dupId)}:{};
  if(dupId)preparaCopia(ent,d);
  if(ent==='equipamentos'&&!d.setor)d.setor=RH.setorEq(d);
  st.M={ent,id,equipIds:ent==='modelos'?(Array.isArray(d.equipIds)?d.equipIds:RH.equipsDaRonda(d).map(e=>e.id)):null,items:(d.itens||[]).map(x=>({...x})),foto:{thumb:d.thumb||null,fotoId:d.fotoId||null,full:null,remove:false},armed:false};
  if(ent==='checklists'&&!id&&!st.M.items.length)st.M.items=[{id:'i'+uid(),t:''}];
  /* agenda da ronda (padrão: segunda a sexta às 08:00; ronda antiga sem agenda: todos os dias) */
  st.M.dias=RH.agenda.temAgenda(d)?[...d.dias]:(id?[0,1,2,3,4,5,6]:[1,2,3,4,5]);
  st.M.horarios=RH.agenda.temAgenda(d)?[...d.horarios]:['08:00'];
  st.M.orientManual=!!(d.orient||'').trim();
  modal(`<div class="mh"><h3 style="font-size:16px">${dupId?'Duplicar':id?'Editar':'Adicionar'} ${E.um}</h3><button class="ic-btn" data-act="closeModal" aria-label="Fechar">${ic('x',16)}</button></div>
  <form id="f-ent" autocomplete="off"><div class="mb"><div class="fg">${E.fields.map(f=>fieldHtml(f,d[f.k]??(f.def??(f.t==='check'?false:f.t==='salas'?[]:'')))).join('')}</div><div class="err" id="ent-err" role="alert"></div></div>
  <div class="mf">${id?`<button type="button" class="btn bad sp" data-act="delEnt" id="btn-del">${ic('trash',16)} Excluir</button>`:''}<button type="button" class="btn" data-act="closeModal">Cancelar</button><button class="btn pri" type="submit">Salvar</button></div></form>`,true);
  if(ent==='tiposNC'&&!st.M.orientManual&&d.nome)$('#ff-orient').value=RH.sugerirOrientacao(d.nome);
}

async function saveEnt(form){
  const M=st.M,E=ENT[M.ent],err=m=>{$('#ent-err').textContent=m},data={},old=M.id?byId(S[E.col],M.id):null;
  for(const f of E.fields){
    if(f.t==='photo')continue;
    if(f.t==='items'){data[f.k]=M.items.filter(x=>x.t.trim()).map(x=>({id:x.id,t:x.t.trim()}));if(!data[f.k].length)return err('Adicione ao menos um item ao checklist.');continue}
    if(f.t==='agenda'){
      const dias=[...form.querySelectorAll('[data-dia]:checked')].map(x=>+x.value),hs=[...new Set(M.horarios.filter(RH.agenda.validaHora))].sort();
      if(!dias.length)return err('Marque ao menos um dia da semana para a ronda.');
      if(!hs.length)return err('Informe ao menos um horário para a ronda.');
      data.dias=dias;data.horarios=hs;continue}
    if(f.t==='salas'){data[f.k]=[...form.querySelectorAll('[data-sala]:checked')].map(x=>x.value);data.equipIds=[...form.querySelectorAll('[data-eq]:checked')].map(x=>x.value);if(!data[f.k].length&&!data.equipIds.length)return err('Marque ao menos uma sala ou um equipamento para a ronda.');continue}
    if(f.t==='check'){data[f.k]=form.elements[f.k].checked;continue}
    if(f.t==='password')continue;
    let v=(form.elements[f.k].value||'').trim();
    if(f.t==='number')v=v===''?null:+v;
    if(f.k==='sev')v=+v;
    if(f.req&&(v===''||v==null))return err(`Preencha o campo: ${f.l}`);
    data[f.k]=v}
  if(M.ent==='users'){
    const login=data.login.toLowerCase();
    if(S.users.some(u=>u.id!==M.id&&(u.login||'').toLowerCase()===login))return err('Já existe um usuário com este login.');
    data.login=login;
    const pw=form.elements.senha.value;
    if(pw){const pe=RH.checkSenha(pw);if(pe)return err(pe);data.salt=uid()+uid();data.hash=await RH.hash(pw,data.salt)}
    else if(!old?.hash)return err('Defina uma senha para este usuário.');
    if(old&&old.id===st.me.id&&(data.ativo===false||data.role!=='admin'))return err('Você não pode remover o próprio acesso de administrador.');
    if(old&&data.ativo===false){const n=S.modelos.filter(m=>m.responsavelId===old.id&&m.ativo!==false).length;if(n)return err(`Este usuário é responsável por ${n} ronda${n>1?'s':''}. Troque o responsável antes de desativar.`)}
  }
  if(M.ent==='modelos'){
    data.responsavelId=data.responsavelId||'';data.freq=null;
    /* horários anteriores à criação/alteração da agenda não contam como "atraso" */
    if(!old||JSON.stringify([old.dias,old.horarios])!==JSON.stringify([data.dias,data.horarios]))data.agendaDesde=Date.now()}
  if(M.ent==='tiposNC'&&!data.orient)data.orient=RH.sugerirOrientacao(data.nome);
  const id=M.id||(E.col[0]+uid());
  if(M.ent==='equipamentos'){
    if(M.foto.remove){data.thumb=null;data.fotoId=null}
    else if(M.foto.full){const fid=M.foto.fotoId||'f'+uid();const okf=await RH.safe(async()=>{await RH.put('fotos',fid,{data:M.foto.full});return true});if(!okf)return;data.thumb=M.foto.thumb;data.fotoId=fid}
    else{data.thumb=M.foto.thumb;data.fotoId=M.foto.fotoId}
  }
  const rec=old?{...old,...data}:data;delete rec.id;
  const ok=await RH.safe(async()=>{await RH.put(E.col,id,rec);return true});
  if(ok){closeModal();toast('Cadastro salvo.')}
}

async function deleteEnt(){
  const M=st.M,E=ENT[M.ent],d=byId(S[E.col],M.id),b=E.canDel&&E.canDel(d);
  if(b){$('#ent-err').textContent=b;return}
  if(!M.armed){M.armed=true;$('#btn-del').textContent='Confirmar exclusão';return}
  if(await RH.safe(async()=>{await RH.del(E.col,M.id);return true})){closeModal();toast('Cadastro excluído.')}
}

/* ---------- eventos ---------- */
Object.assign(RH.ACT,{
  agDias:el=>{document.querySelectorAll('[data-dia]').forEach(c=>{const d=+c.value;c.checked=el.dataset.v==='todos'||(d>=1&&d<=5)})},
  agAddH:()=>{st.M.horarios.push('');$('#ag-horas').innerHTML=horasHtml();const i=document.querySelectorAll('[data-hx]');i[i.length-1]?.focus()},
  agDelH:el=>{st.M.horarios.splice(+el.dataset.i,1);$('#ag-horas').innerHTML=horasHtml()},
  genOrient:()=>{const n=($('#ff-nome')?.value||'').trim();if(!n){toast('Digite primeiro o nome do tipo.','bad');return}
    $('#ff-orient').value=RH.sugerirOrientacao(n);st.M.orientManual=false},
  cadTab:el=>{st.cadTab=el.dataset.k;RH.renderView()},
  newEnt:()=>openEnt(st.cadTab), editEnt:el=>openEnt(st.cadTab,el.dataset.id), dupEnt:el=>openEnt(st.cadTab,null,el.dataset.id),
  delEnt:deleteEnt,
  itAdd:()=>{st.M.items.push({id:'i'+uid(),t:''});$('#items').innerHTML=itemsHtml();const i=document.querySelectorAll('[data-itx]');i[i.length-1]?.focus()},
  itDel:el=>{st.M.items.splice(+el.dataset.i,1);$('#items').innerHTML=itemsHtml()},
  itUp:el=>{const i=+el.dataset.i,M=st.M;if(i>0){[M.items[i-1],M.items[i]]=[M.items[i],M.items[i-1]];$('#items').innerHTML=itemsHtml()}},
  itDn:el=>{const i=+el.dataset.i,M=st.M;if(i<M.items.length-1){[M.items[i+1],M.items[i]]=[M.items[i],M.items[i+1]];$('#items').innerHTML=itemsHtml()}},
  rmEntFoto:()=>{st.M.foto.remove=true;st.M.foto.full=null;$('#foto-prev').innerHTML=fotoPrev()},
  genPw:()=>{const pw=RH.senhaForte();const i=document.getElementById('ff-senha');i.value=pw;i.classList.add('show');const h=i.closest('label').querySelector('small');if(h)h.textContent='Anote esta senha e entregue ao usuário. Depois de salvar ela não poderá ser exibida de novo.'},
  seedDemo:async el=>{el.disabled=true;st.busy=true;await RH.seedDemo('#seed-prog');st.busy=false;toast('Dados de exemplo carregados.');RH.renderView(true)},
  wipeDemo:async el=>{el.disabled=true;st.busy=true;await RH.wipeDemo();st.busy=false;RH.renderView(true)},
  exportBackup:async el=>{el.disabled=true;try{const b=new Blob([await RH.store.exportJSON()],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='ronda-hospitalar-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);toast('Backup exportado.')}catch(e){toast('Não foi possível exportar o backup.','bad')}el.disabled=false},
  changeCode:()=>RH.store.changeCode()
});
RH.ON_CHANGE.push(async el=>{
  /* picker de salas: caixa do setor marca/desmarca todas as salas dele */
  if(el.dataset.setorAll!=null){document.querySelectorAll(`[data-sala][data-g="${el.dataset.setorAll}"],[data-eq][data-g="${el.dataset.setorAll}"]`).forEach(c=>c.checked=el.checked);return true}
  if(el.dataset.sala!=null||el.dataset.eq!=null){const all=[...document.querySelectorAll(`[data-sala][data-g="${el.dataset.g}"],[data-eq][data-g="${el.dataset.g}"]`)],h=document.querySelector(`[data-setor-all="${el.dataset.g}"]`);if(h)h.checked=all.every(c=>c.checked);return true}
  if(el.dataset.import!=null){if(el.files[0]){try{const n=await RH.store.importJSON(await el.files[0].text());toast(n+' registros importados.')}catch(err){toast(err.message||'Não foi possível importar o arquivo.','bad')}el.value=''}return true}
  if(el.dataset.entFoto!=null){if(el.files[0]){try{Object.assign(st.M.foto,await RH.processImg(el.files[0]),{remove:false});$('#foto-prev').innerHTML=fotoPrev()}catch(err){toast('Não foi possível ler a imagem.','bad')}}return true}
  return false});
RH.ON_INPUT.push(el=>{
  if(el.dataset.itx!=null){st.M.items[+el.dataset.itx].t=el.value;return true}
  if(el.dataset.hx!=null){st.M.horarios[+el.dataset.hx]=el.value;return true}
  /* Tipos de NC: a orientação acompanha o nome enquanto a pessoa não a editar à mão */
  if(st.M&&st.M.ent==='tiposNC'){
    if(el.id==='ff-nome'&&!st.M.orientManual){$('#ff-orient').value=RH.sugerirOrientacao(el.value);return true}
    if(el.id==='ff-orient'){st.M.orientManual=el.value.trim()!=='';return true}}
  return false});
RH.ON_SUBMIT['f-ent']=saveEnt;
RH.ON_SUBMIT['f-cfg']=async f=>{
  const ok=await RH.safe(async()=>{await RH.put('config','main',{...S.cfg,hospital:f.hospital.value.trim(),meta:+f.meta.value||95});return true});
  if(ok){toast('Dados salvos.');st.screen='';RH.renderRoot()}};
})();
