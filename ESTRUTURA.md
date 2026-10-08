# Ronda Hospitalar — guia do projeto

## Como publicar (GitHub Pages)
Envie **todo o conteúdo desta pasta** para o seu repositório (mantendo as pastas `css/` e `js/`).
Alternativa de um arquivo só: `dist/ronda-hospitalar.html` (renomeie para `index.html`).
O banco compartilhado (Supabase) é configurado em **`js/config.js`** — é o único arquivo que você edita.
Depois de atualizar o site, recarregue a página com Ctrl+F5 (ou limpe o cache no celular).

## Primeiros passos no hospital
1. **Cadastros → Responsáveis e usuários**: crie os usuários (perfil Inspetor, Gestor ou Administrador).
2. **Salas**, **Checklists** (um de "ambiente" e um de "equipamento"), **Equipamentos** (vinculando o checklist).
3. **Tipos de NC**: preencha a *Orientação / ação esperada* — ela aparece como alerta para o inspetor.
4. **Rondas**: dê um *nome*, marque as *salas* que fazem parte e escolha o *responsável* (ou "Sem responsável").
5. O inspetor entra, abre **Nova ronda**, escolhe a ronda e responde as salas em sequência.

## Regras de acesso
| Perfil | Telas |
|---|---|
| Administrador | Painel, Nova ronda, Histórico, Não conformidades, Cadastros |
| Gestor | Painel, Nova ronda, Histórico, Não conformidades |
| Inspetor | **somente Nova ronda** |

* Ronda **com responsável**: só ele a vê e realiza. Exceção: o **administrador** vê e realiza todas as rondas.
* Ronda **"Sem responsável"**: todos os usuários com acesso a Nova ronda a veem e realizam.
* Excluir uma ronda realizada (Histórico → abrir a ronda → Excluir ronda): administrador e gestor; há uma caixa (desmarcada por padrão) para apagar também as NCs geradas.
* Excluir uma não conformidade: administrador e gestor (pede confirmação; a foto é apagada junto).
* Essas regras controlam a **interface**. O banco é protegido pelo código de acesso da equipe: quem tem o
  código e conhecimentos técnicos consegue ler os dados diretamente. Não compartilhe o código fora da equipe.

## Estrutura de arquivos
```
index.html              página única: carrega os arquivos abaixo, na ordem certa
css/styles.css          todos os estilos (seções comentadas: tema, layout, tabelas, ronda, modal…)
js/config.js            URL e chave do Supabase (deixe vazio para usar só no navegador)
js/core/                núcleo (sem telas)
  data-layer.js           banco: local (IndexedDB) ou compartilhado (Supabase) — RH.store
  utils.js                helpers, constantes, formatação pt-BR, ícones — cria window.RH
  state.js                dados em memória (RH.S), estado da tela (RH.st), filtros, consultas
  access.js               permissões por perfil e visibilidade das rondas
  security.js             hash de senha (PBKDF2)
  images.js               redução de fotos
  ui.js                   aviso, tooltip, modal, selos, caixa de orientação
  data.js                 gravar/atualizar/apagar, sincronização em tempo real
js/features/            uma tela (ou função) por arquivo
  auth.js                 login e primeiro acesso
  painel.js               indicadores e gráficos
  ronda.js                Nova ronda: lista de rondas e preenchimento
  historico.js            histórico de rondas realizadas
  ncs.js                  não conformidades: tratar e excluir
  cadastros.js            cadastros (rondas, salas, equipamentos, checklists, tipos de NC, usuários, hospital/backup)
  seed.js                 dados de exemplo
js/app.js               menu, navegação, despacho de eventos e inicialização
tests/                  testes automáticos (veja abaixo)
tools/gerar-arquivo-unico.py   gera dist/ronda-hospitalar.html
```
Cada tela se registra em `RH.pages`, `RH.ACT` (cliques), `RH.ON_CHANGE/ON_INPUT/ON_SUBMIT`; o `app.js` só despacha.

## Dados (coleções)
`users`, `salas`, `equipamentos`, `checklists`, `tiposNC`, **`modelos`** (cadastro "Nome da ronda"),
`rondas` (um documento por sala visitada; todos de uma execução têm o mesmo `execId`), `ncs`, `config`, `fotos`.
Rondas feitas antes desta versão continuam no histórico (uma linha por sala).

## Testes
Requer Python 3 e Playwright (`pip install playwright && playwright install chromium`).
```
python3 tests/e2e.py          # fluxo completo em modo local (nunca toca o banco real)
python3 tests/remote_mock.py  # modo compartilhado contra um servidor simulado
RH_PAGE=dist/ronda-hospitalar-teste.html python3 tests/e2e.py   # testa o arquivo único (gere com --sem-config)
```
