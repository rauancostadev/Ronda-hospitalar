/* ==========================================================================
   Histórico de rondas: uma linha por execução (ronda), com o detalhe por sala.
   ========================================================================== */
(()=>{
const RH=window.RH;
const {esc,S,HF,byId,pc,fdt,ic,empty,modal}=RH;

RH.pages.historico=()=>{
  const from=Date.now()-HF.periodo*864e5;
  const ex=RH.execs(S.rondas.filter(r=>r.ts>=from&&(!HF.ronda||r.modeloId===HF.ronda)));
  const meta=+S.cfg.meta||95;
  return `<div class="top"><div><h1>Histórico de rondas</h1><p>${ex.length} ronda${ex.length===1?'':'s'} no período</p></div>
  <div class="filters"><label class="field"><span>Período</span><select data-set="HF:periodo" data-num="1">${[7,30,90,365].map(d=>`<option value="${d}" ${d===HF.periodo?'selected':''}>Últimos ${d} dias</option>`).join('')}</select></label>
  <label class="field"><span>Ronda</span><select data-set="HF:ronda"><option value="">Todas as rondas</option>${[...S.modelos].sort((a,b)=>a.nome.localeCompare(b.nome)).map(m=>`<option value="${m.id}" ${m.id===HF.ronda?'selected':''}>${esc(m.nome)}</option>`).join('')}</select></label></div></div>
  ${ex.length?`<div class="tw"><table><thead><tr><th>Data</th><th>Ronda</th><th>Inspetor</th><th>Conformidade</th><th>Itens</th><th>NCs</th></tr></thead><tbody>${ex.slice(0,200).map(e=>`<tr data-act="rondaOpen" data-id="${esc(e.id)}"><td class="num">${fdt(e.ts)}</td><td><b>${esc(e.nome)}</b><small>${e.docs.length} sala${e.docs.length===1?'':'s'}</small></td><td>${esc(e.inspNome)}</td><td class="num"><span class="pill ${e.pct>=meta?'okp':'st-aberta'}">${pc(e.pct)}</span></td><td class="num">${e.c+e.nc+e.na}</td><td class="num">${e.nc||'—'}</td></tr>`).join('')}</tbody></table></div>`:empty('Nenhuma ronda no período','Registre uma ronda em Nova ronda.')}`;
};

function openRonda(id){
  const e=RH.execs(S.rondas.filter(r=>(r.execId||r.id)===id))[0];if(!e)return;
  const porSala=e.docs.map(r=>{
    const g={};(r.itens||[]).forEach(i=>{(g[i.a+i.i]=g[i.a+i.i]||{n:i.n,l:[]}).l.push(i)});
    return `<div><h4 style="font-size:15px;border-bottom:2px solid var(--brand);padding-bottom:4px">${esc(r.salaNome)} <small>${esc(r.setor||'')} · ${pc(r.pct)}</small></h4>
    ${Object.values(g).map(x=>`<div style="margin-top:10px"><b>${esc(x.n)}</b><div style="margin-top:4px">${x.l.map(i=>`<div style="display:flex;gap:10px;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc(i.t)}</span><span class="pill ${i.r==='C'?'okp':i.r==='NC'?'st-aberta':'off'}">${i.r==='C'?'Conforme':i.r==='NC'?'Não conforme':'N/A'}</span></div>`).join('')}</div></div>`).join('')}</div>`}).join('');
  const obs=e.docs.map(r=>r.obs).find(Boolean);
  modal(`<div class="mh"><div><h3 style="font-size:16px">${esc(e.nome)}</h3><small>${fdt(e.ts)} · Inspetor: ${esc(e.inspNome)}</small></div><button class="ic-btn" data-act="closeModal" aria-label="Fechar">${ic('x',16)}</button></div>
  <div class="mb"><div class="legend"><span>Conformidade <b>${pc(e.pct)}</b></span><span>Conformes <b>${e.c}</b></span><span>Não conformes <b>${e.nc}</b></span><span>N/A <b>${e.na}</b></span></div>
  ${obs?`<div><b>Observações</b><p style="margin:4px 0 0">${esc(obs)}</p></div>`:''}
  ${porSala}</div>`,true);
}
RH.ACT.rondaOpen=el=>openRonda(el.dataset.id);
})();
