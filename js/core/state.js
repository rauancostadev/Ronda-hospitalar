/* ==========================================================================
   Núcleo · estado da aplicação
   - RH.S   : cópia local dos cadastros e registros (atualizada em tempo real).
   - RH.st  : estado da interface (usuário logado, tela atual, ronda em andamento…).
   - RH.F / NF / HF : filtros do Painel, das Não conformidades e do Histórico.
   - Registros onde cada tela se "pluga": RH.pages, RH.after, RH.ACT,
     RH.ON_CHANGE, RH.ON_INPUT, RH.ON_SUBMIT (despachados em js/app.js).
   - Funções de consulta usadas por várias telas (byId, salasDaRonda, execs).
   ========================================================================== */
(()=>{
const RH=window.RH;

/* coleções do banco → RH.S[coleção]; "config" vira RH.S.cfg */
RH.COLS=['users','salas','equipamentos','checklists','tiposNC','modelos','rondas','ncs','config'];
const S=RH.S={users:[],salas:[],equipamentos:[],checklists:[],tiposNC:[],modelos:[],rondas:[],ncs:[],cfg:{}};

RH.st={
  db:null,          // banco (collection/doc) aberto por RH.store.open()
  me:null,          // usuário logado
  page:'painel',    // tela atual
  screen:'',        // 'noaccess' | 'login' | 'setup' | 'app' (evita redesenhar à toa)
  busy:false,       // true durante operações longas (não redesenha a tela)
  booted:false,     // true quando todas as coleções chegaram pela 1ª vez
  canWrite:true,
  R:null,           // ronda em andamento (preenchimento)
  M:null,           // formulário de cadastro aberto (modal)
  cadTab:'modelos'  // aba atual de Cadastros
};

RH.F={periodo:30,setor:''};
RH.NF={status:'abertas',sev:'',setor:'',q:''};
RH.HF={ronda:'',periodo:30};

RH.pages={};       // pages[nome]() → HTML da tela
RH.after={};       // after[nome]() → roda depois de desenhar a tela (ex.: gráfico)
RH.ACT={};         // ACT[data-act](elemento, evento) → cliques
RH.ON_CHANGE=[];   // funções (el,e) → true se tratou o evento "change"
RH.ON_INPUT=[];    // idem para "input"
RH.ON_SUBMIT={};   // ON_SUBMIT[id do form](form)

/* ---------- consultas ---------- */
const byId=(a,id)=>a.find(x=>x.id===id);
RH.byId=byId;
RH.userName=id=>byId(S.users,id)?.nome||'—';

/* salas ativas de uma ronda cadastrada, na ordem salva */
RH.salasDaRonda=m=>(m.salaIds||[]).map(id=>byId(S.salas,id)).filter(s=>s&&s.ativo!==false);

/* Uma "execução" de ronda grava um documento por sala visitada, todos com o mesmo
   execId. Esta função junta os documentos de volta em uma linha por execução.
   Documentos antigos (sem execId) viram uma execução própria. */
RH.execs=list=>{
  const g=new Map();
  list.forEach(r=>{
    const k=r.execId||r.id;let e=g.get(k);
    if(!e){e={id:k,nome:r.modeloNome||r.salaNome||'Ronda',modeloId:r.modeloId||null,ts:r.ts,inspNome:r.inspNome,c:0,nc:0,na:0,docs:[]};g.set(k,e)}
    e.docs.push(r);e.c+=r.c||0;e.nc+=r.nc||0;e.na+=r.na||0;if(r.ts<e.ts)e.ts=r.ts});
  return [...g.values()].map(e=>({...e,pct:e.c+e.nc?Math.round(e.c/(e.c+e.nc)*1000)/10:100})).sort((a,b)=>b.ts-a.ts);
};
})();
