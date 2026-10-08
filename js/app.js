/* ==========================================================================
   Aplicação: estrutura da tela (menu lateral), navegação, despacho de eventos
   e inicialização. As telas ficam em js/features/*.js e se registram em
   RH.pages / RH.ACT / RH.ON_CHANGE / RH.ON_INPUT / RH.ON_SUBMIT.
   ========================================================================== */
(async()=>{
const RH=window.RH;
const {$,esc,S,st,F,NF,HF,ic}=RH;

const PAGES=[['painel','Painel','dash'],['ronda','Nova ronda','clip'],['historico','Histórico','hist'],['ncs','Não conformidades','alert'],['cadastros','Cadastros','set']];
const allowedPages=()=>PAGES.filter(p=>RH.access.can(p[0]));

/* ---------- raiz: decide qual tela mostrar ---------- */
RH.renderRoot=()=>{
  if(st.busy)return;
  const sc=!st.db?'noaccess':!st.me?(S.users.length?'login':'setup'):'app';
  if(sc!==st.screen){st.screen=sc;if(sc==='app')renderShell();else RH.views[sc]();return}
  if(sc==='app')RH.renderView();
};

function renderShell(){
  const me=st.me,ini=me.nome.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
  if(!RH.access.can(st.page))st.page=RH.access.firstPage();
  $('#app').innerHTML=`<div class="app"><aside class="side"><div class="brand"><div class="logo">${ic('cross',20)}</div><div><b>${esc(S.cfg.hospital||'Ronda Hospitalar')}</b><span>Ronda e conformidade</span></div></div>
  <nav class="nav" id="nav" aria-label="Principal">${allowedPages().map(p=>`<button data-act="nav" data-p="${p[0]}">${ic(p[2])}<span>${p[1]}</span></button>`).join('')}</nav>
  <div class="side-foot"><div class="me"><div class="avatar">${esc(ini)}</div><div><b>${esc(me.nome)}</b><span>${RH.ROLE[me.role]||''}</span></div></div>
  <div class="row"><button class="ghost-d" data-act="theme" aria-label="Alternar tema">${ic('moon')}<span>Tema</span></button><button class="ghost-d" data-act="logout" aria-label="Sair">${ic('out')}<span>Sair</span></button></div></div></aside>
  <main id="main"></main></div>`;
  RH.renderView();
}

RH.go=p=>{if(!RH.access.can(p))return;st.page=p;RH.renderView(true);scrollTo(0,0)};

RH.renderView=force=>{
  const m=$('#main');if(!m||st.busy||!st.me)return;
  if(!RH.access.can(st.page))st.page=RH.access.firstPage();
  const page=st.page;
  document.querySelectorAll('#nav button').forEach(b=>{
    const on=b.dataset.p===page;if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
    const d=b.querySelector('.dot'),isR=b.dataset.p==='ronda';
    if(isR&&st.R&&!d)b.insertAdjacentHTML('beforeend','<i class="dot" title="Ronda em andamento"></i>');
    if(d&&!(isR&&st.R))d.remove()});
  /* ronda em andamento: não redesenha a cada atualização de dados (preserva o que foi digitado) */
  if(page==='ronda'&&st.R){if(!force&&m.querySelector('.rhead'))return;m.innerHTML=RH.rondaForm();RH.rondaProgress();return}
  const ro=st.canWrite===false?`<div class="banner">Seu acesso é somente leitura: você pode consultar, mas não registrar dados.</div>`:'';
  m.innerHTML=ro+RH.pages[page]();
  RH.after[page]?.();
};

RH.logout=()=>{st.me=null;st.R=null;try{sessionStorage.removeItem('rh_uid')}catch(e){}st.screen='';RH.renderRoot()};

/* ---------- ações do menu e do modal ---------- */
Object.assign(RH.ACT,{
  nav:el=>RH.go(el.dataset.p),
  theme:()=>{const d=document.documentElement,cur=d.dataset.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'),next=cur==='dark'?'light':'dark';d.dataset.theme=next;try{localStorage.setItem('rh_theme',next)}catch(e){}if(st.page==='painel')setTimeout(()=>RH.after.painel(),0)},
  /* não perde uma ronda em andamento sem avisar */
  logout:()=>{if(st.R&&Object.values(st.R.itens).some(i=>i.r)&&!RH.confirmArm(RH.ACT.logout,'Há uma ronda em andamento. Toque de novo em Sair para descartá-la.'))return;RH.logout()},
  closeModal:RH.closeModal,
  ovClose:(el,e)=>{if(e.target===el)RH.closeModal()}
});

/* ---------- despacho de eventos ---------- */
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');if(!el)return;
  if(el.tagName==='TR'&&e.target.closest('button,a'))return;
  RH.ACT[el.dataset.act]?.(el,e)});
document.addEventListener('change',async e=>{
  const el=e.target;
  for(const h of RH.ON_CHANGE){if(await h(el,e))return}
  if(el.dataset.set&&el.dataset.live==null){const [o,k]=el.dataset.set.split(':');({F,NF,HF})[o][k]=el.dataset.num?+el.value:el.value;RH.renderView()}
});
document.addEventListener('input',e=>{for(const h of RH.ON_INPUT){if(h(e.target,e))return}});
document.addEventListener('submit',e=>{e.preventDefault();const h=RH.ON_SUBMIT[e.target.id];if(h)h(e.target)});
/* evita perder uma ronda em andamento ao fechar/recarregar a página */
addEventListener('beforeunload',e=>{if(st.R){e.preventDefault();e.returnValue=''}});

/* ---------- início ---------- */
try{const th=localStorage.getItem('rh_theme');if(th)document.documentElement.dataset.theme=th}catch(e){}
$('#app').innerHTML='<div class="auth-r" style="min-height:100%"><p style="color:var(--muted)">Carregando…</p></div>';
try{st.db=await RH.store.open()}catch(e){console.error(e);st.db=null}
if(!st.db){st.screen='';RH.renderRoot();return}
RH.syncAll();
})();
