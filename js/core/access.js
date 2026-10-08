/* ==========================================================================
   Núcleo · permissões por perfil (um único lugar para todas as regras de acesso)

     Administrador : todas as telas (inclusive Cadastros)
     Gestor        : Painel, Nova ronda, Histórico e Não conformidades
     Inspetor      : SOMENTE "Nova ronda"

   Rondas: uma ronda com responsável só é vista/realizada por ele (o Administrador
   vê e realiza todas); uma ronda "Sem responsável" é vista e realizada por todos
   os usuários com acesso a Nova ronda. Perfil desconhecido é tratado como Inspetor (menor privilégio).

   Atenção: estas regras controlam a INTERFACE. O banco compartilhado é protegido
   apenas pelo código de acesso da equipe (veja LEIA-ME.md).
   ========================================================================== */
(()=>{
const RH=window.RH,st=RH.st;

const PAGES={
  admin:['painel','ronda','historico','ncs','cadastros'],
  gestor:['painel','ronda','historico','ncs'],
  inspetor:['ronda']
};
const pagesOf=()=>PAGES[st.me&&st.me.role]||PAGES.inspetor;
const gerencia=()=>!!st.me&&['admin','gestor'].includes(st.me.role);

RH.access={
  PAGES,
  can:p=>!!st.me&&pagesOf().includes(p),
  firstPage:()=>pagesOf()[0],
  /* a ronda cadastrada `m` aparece para o usuário `u`? */
  rondaVisivel:(m,u)=>!!u&&m.ativo!==false&&(u.role==='admin'||!m.responsavelId||m.responsavelId===u.id),
  canEditNC:()=>gerencia()&&st.canWrite!==false,
  canDeleteNC:()=>gerencia()&&st.canWrite!==false,
  canDeleteRonda:()=>gerencia()&&st.canWrite!==false
};
})();
