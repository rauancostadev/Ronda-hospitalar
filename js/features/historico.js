/* ==========================================================================
   Histórico de rondas: uma linha por execução (ronda), com o detalhe por sala.
   ========================================================================== */
(()=>{
const RH=window.RH;
const {esc,S,HF,pc,fdt,ic,empty,modal,closeModal,toast}=RH;

RH.pages.historico=()=>{
  const from=Date.now()-HF.periodo*864e5;
  const ex=RH.execs(S.rondas.filter(r=>r.ts>=from&&(!HF.ronda||r.modeloId===HF.ronda)));
  const meta=+S.cfg.meta||95;
  return `<div class="top"><div><h1>Histórico de rondas</h1><p>${ex.length} ronda${ex.length===1?'':'s'} no período</p></div>
  <div class="filters"><label class="field"><span>Período</span><select data-set="HF:periodo" data-num="1">${[7,30,90,365].map(d=>`<option value="${d}" ${d===HF.periodo?'selected':''}>Últimos ${d} dias</option>`).join('')}</select></label>
  <label class="field"><span>Ronda</span><select data-set="HF:ronda"><option value="">Todas as rondas</option>${[...S.modelos].sort((a,b)=>a.nome.localeCompare(b.nome)).map(m=>`<option value="${m.id}" ${m.id===HF.ronda?'selected':''}>${esc(m.nome)}</option>`).join('')}</select></label></div></div>
  ${ex.length?`<div class="tw"><table><thead><tr><th>Data</th><th>Ronda</th><th>Inspetor</th><th>Conformidade</th><th>Itens</th><th>NCs</th></tr></thead><tbody>${ex.slice(0,200).map(e=>`<tr data-act="rondaOpen" data-id="${esc(e.id)}"><td class="num">${fdt(e.ts)}</td><td><b>${esc(e.nome)}</b><small>${e.docs.length} sala${e.docs.length===1?'':'s'}</small></td><td>${esc(e.inspNome)}</td><td class="num"><span class="pill ${e.pct>=meta?'okp':'st-aberta'}">${pc(e.pct)}</span></td><td class="num">${e.c+e.nc+e.na}</td><td class="num">${e.nc||'—'}</td></tr>`).join('')}</tbody></table></div>`:empty('Nenhuma ronda no período','Registre uma ronda em Nova ronda.')}`;
};

/* NCs geradas por uma execução (documentos novos têm execId; antigos, só rondaId) */
const ncsDa=e=>S.ncs.filter(n=>n.execId===e.id||e.docs.some(d=>d.id===n.rondaId));

function openRonda(id){
  const e=RH.execs(S.rondas.filter(r=>(r.execId||r.id)===id))[0];if(!e)return;
  const porSala=e.docs.map(r=>{
    const g={};(r.itens||[]).forEach(i=>{(g[i.a+i.i]=g[i.a+i.i]||{n:i.n,l:[]}).l.push(i)});
    return `<div><h4 style="font-size:15px;border-bottom:2px solid var(--brand);padding-bottom:4px">${esc(r.salaNome)} <small>${esc(r.setor||'')} · ${pc(r.pct)}</small></h4>
    ${Object.values(g).map(x=>`<div style="margin-top:10px"><b>${esc(x.n)}</b><div style="margin-top:4px">${x.l.map(i=>`<div style="display:flex;gap:10px;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc(i.t)}</span><span style="flex:none" class="pill ${i.r==='C'?'okp':i.r==='NC'?'st-aberta':'off'}">${i.r==='C'?'Conforme':i.r==='NC'?'Não conforme':'N/A'}</span></div>`).join('')}</div></div>`).join('')}</div>`}).join('');
  const obs=e.docs.map(r=>r.obs).find(Boolean),nNC=ncsDa(e).length;
  modal(`<div class="mh"><div><h3 style="font-size:16px">${esc(e.nome)}</h3><small>${fdt(e.ts)} · Inspetor: ${esc(e.inspNome)}</small></div><button class="ic-btn" data-act="closeModal" aria-label="Fechar">${ic('x',16)}</button></div>
  <div class="mb"><div class="legend"><span>Conformidade <b>${pc(e.pct)}</b></span><span>Conformes <b>${e.c}</b></span><span>Não conformes <b>${e.nc}</b></span><span>N/A <b>${e.na}</b></span></div>
  ${obs?`<div><b>Observações</b><p style="margin:4px 0 0">${esc(obs)}</p></div>`:''}
  ${porSala}</div>
  <div class="mf">${RH.access.canDeleteRonda()?`<button type="button" class="btn bad sp" data-act="delRonda" data-id="${esc(e.id)}" id="btn-delronda">${ic('trash',16)} Excluir ronda</button>
    <label class="chk" style="margin-right:auto"><input type="checkbox" id="del-ncs" ${nNC?'':'disabled'}> Excluir também as ${nNC} não conformidade${nNC===1?'':'s'} geradas</label>`:''}
    <button type="button" class="btn" data-act="closeModal">Fechar</button></div>`,true);
}
/* exclusão em dois toques; apaga os documentos da execução e, se marcado, as NCs (e fotos) */
async function delRonda(el){
  if(!RH.access.canDeleteRonda())return;
  if(!el.dataset.armed){el.dataset.armed='1';el.textContent='Confirmar exclusão';return}
  const e=RH.execs(S.rondas.filter(r=>(r.execId||r.id)===el.dataset.id))[0];if(!e)return;
  const comNC=document.getElementById('del-ncs')?.checked,ncs=comNC?ncsDa(e):[];
  const ok=await RH.safe(async()=>{
    for(const n of ncs){await RH.del('ncs',n.id);if(n.fotoId)await RH.del('fotos',n.fotoId)}
    for(const d of e.docs)await RH.del('rondas',d.id);
    return true});
  if(ok){closeModal();toast('Ronda excluída'+(ncs.length?` junto com ${ncs.length} não conformidade${ncs.length===1?'':'s'}.`:'.'))}
}
RH.ACT.rondaOpen=el=>openRonda(el.dataset.id);
RH.ACT.delRonda=delRonda;
})();
