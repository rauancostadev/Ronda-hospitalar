"""
Teste ponta a ponta (Playwright + Chromium) da Ronda Hospitalar.
Roda SEMPRE em modo local (IndexedDB descartável): js/config.js é substituído por uma
configuração vazia durante o teste, então nenhum dado vai para o Supabase real.

Uso:  python3 tests/e2e.py
"""
import base64, http.server, socketserver, threading, os, sys, functools, json
from playwright.sync_api import sync_playwright, expect

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8765
PAGE = os.environ.get("RH_PAGE", "index.html")   # RH_PAGE=dist/ronda-hospitalar-teste.html testa o arquivo único
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
errors, results, blocked = [], [], []

def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("  OK   " if cond else "  FAIL ") + name + (f"  -> {extra}" if (extra and not cond) else ""))

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve():
    h = functools.partial(Quiet, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(("127.0.0.1", PORT), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

def new_ctx(browser, **kw):
    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, **kw)
    # configuração vazia => modo local; bloqueia fontes externas
    ctx.route("**/js/config.js*", lambda r: r.fulfill(body="window.RONDA_CONFIG={supabaseUrl:'',supabaseKey:''};", content_type="application/javascript"))
    ctx.route("**/*.supabase.co/**", lambda r: (blocked.append(r.request.url), r.abort()))  # trava: nunca tocar o banco real
    ctx.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    ctx.route("**/fonts.gstatic.com/**", lambda r: r.abort())
    return ctx

def attach_errors(page, tag):
    page.on("pageerror", lambda e: errors.append(f"[{tag}] pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"[{tag}] console.error: {m.text}") if m.type == "error" else None)

def login(page, user, pw):
    page.fill("#lg-login", user); page.fill("#lg-senha", pw); page.click("#f-login button[type=submit]")
    page.wait_for_selector("#nav")

def logout(page):
    page.click("[data-act=logout]"); page.wait_for_selector("#f-login")

def nav_labels(page):
    return [b.inner_text().strip() for b in page.query_selector_all("#nav button")]

def open_cad(page, tab):
    page.click(f"#nav [data-p=cadastros]"); page.click(f"[data-act=cadTab][data-k={tab}]")

def add(page, tab, fill=None, select=None, checks=None, check_boxes=None):
    open_cad(page, tab)
    page.click("[data-act=newEnt]")
    for k, v in (fill or {}).items():
        page.fill(f"#ff-{k}", str(v))
    for k, v in (select or {}).items():
        page.select_option(f"#ff-{k}", label=v)
    for k in (checks or []):
        page.uncheck(f"#ff-{k}")
    for label in (check_boxes or []):
        page.locator("#salas-pick label.chk", has_text=label).locator("input").check()
    return page

def save(page):
    page.click("#f-ent button[type=submit]")
    page.wait_for_selector("#f-ent", state="detached", timeout=4000)

def main():
    srv = serve()
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ================= CENÁRIO 1: fluxo completo =================
        print("\n== Cenário 1: configuração, acessos, ronda, NC e exclusão ==")
        ctx = new_ctx(browser); page = ctx.new_page(); attach_errors(page, "c1")
        page.goto(f"http://127.0.0.1:{PORT}/{PAGE}")
        page.wait_for_selector("#f-setup")
        check("primeiro acesso: dados de exemplo desmarcados por padrão", not page.is_checked("#st-d"))
        page.fill("#st-n", "Ana Admin"); page.fill("#st-l", "admin"); page.fill("#st-s", "senha123")
        page.click("#st-btn"); page.wait_for_selector("#nav")
        check("admin entra no Painel", page.inner_text("h1") == "Painel de controle")
        check("admin vê as 5 telas", nav_labels(page) == ["Painel", "Nova ronda", "Histórico", "Não conformidades", "Cadastros"], nav_labels(page))

        # usuários
        for nome, login_, role in [("Gil Gestor", "gestor", "Gestor da qualidade"), ("Iara Inspetora", "iara", "Inspetor"), ("Ivo Inspetor", "ivo", "Inspetor")]:
            add(page, "users", fill={"nome": nome, "login": login_, "senha": "senha123"}, select={"role": role}); save(page)
        # salas
        add(page, "salas", fill={"nome": "UTI 01", "setor": "UTI"}); save(page)
        add(page, "salas", fill={"nome": "UTI 02", "setor": "UTI"}); save(page)
        add(page, "salas", fill={"nome": "Farmácia", "setor": "Farmácia"}); save(page)
        # checklists
        open_cad(page, "checklists"); page.click("[data-act=newEnt]")
        page.fill("#ff-nome", "Ambiente padrão"); page.select_option("#ff-tipo", label="Ambiente (sala)")
        page.fill("[data-itx='0']", "Limpeza adequada"); page.click("[data-act=itAdd]"); page.fill("[data-itx='1']", "Extintor válido"); save(page)
        open_cad(page, "checklists"); page.click("[data-act=newEnt]")
        page.fill("#ff-nome", "Equipamento padrão"); page.select_option("#ff-tipo", label="Equipamento")
        page.fill("[data-itx='0']", "Alarme funcionando"); save(page)
        # vincula checklist às salas
        open_cad(page, "salas")
        for nome in ["UTI 01", "UTI 02", "Farmácia"]:
            page.click(f"tr[data-act=editEnt]:has-text('{nome}')")
            page.select_option("#ff-checklistId", label="Ambiente padrão"); save(page)
            open_cad(page, "salas")
        # equipamento na UTI 01
        add(page, "equipamentos", fill={"nome": "Monitor", "patrimonio": "PAT-1"}, select={"salaId": "UTI 01", "checklistId": "Equipamento padrão"}); save(page)
        # tipos de NC com orientação
        add(page, "tiposNC", fill={"nome": "Alarme inoperante", "orient": "Testar, reparar e validar antes de reutilizar."}, select={"sev": "4 · Crítica"}); save(page)
        add(page, "tiposNC", fill={"nome": "Higienização deficiente", "orient": "Refazer a limpeza terminal."}); save(page)
        open_cad(page, "tiposNC")
        check("Tipos de NC exibem a orientação na tabela", "Testar, reparar e validar" in page.inner_text("table"))

        # rondas (cadastro "Nome da ronda")
        add(page, "modelos", fill={"nome": "Ronda UTI", "freq": 12}, check_boxes=["UTI 01", "UTI 02"])
        opts = [o.inner_text() for o in page.query_selector_all("#ff-responsavelId option")]
        check("Ronda: opção 'Sem responsável' existe", any("Sem responsável" in o for o in opts), opts)
        page.select_option("#ff-responsavelId", label=[o for o in opts if o.startswith("Iara")][0])
        save(page)
        add(page, "modelos", fill={"nome": "Ronda Farmácia"}, check_boxes=["Farmácia"]); save(page)  # sem responsável
        open_cad(page, "modelos")
        tbl = page.inner_text("table")
        check("Cadastro de rondas lista as duas rondas", "Ronda UTI" in tbl and "Ronda Farmácia" in tbl)
        check("Acesso exibido: somente a Iara / todos os inspetores", "Somente Iara Inspetora" in tbl and "Todos os inspetores" in tbl, tbl)

        # validação: ronda sem sala
        open_cad(page, "modelos"); page.click("[data-act=newEnt]"); page.fill("#ff-nome", "Vazia"); page.click("#f-ent button[type=submit]")
        check("Ronda sem sala é recusada", "ao menos uma sala" in page.inner_text("#ent-err"))
        page.click("[data-act=closeModal]")

        # admin só vê rondas sem responsável em Nova ronda
        page.click("#nav [data-p=ronda]")
        cards = [c.inner_text() for c in page.query_selector_all("[data-act=pickRonda]")]
        check("Administrador vê todas as rondas (com e sem responsável)", len(cards) == 2, cards)
        logout(page)

        # ---- inspetora Iara
        login(page, "iara", "senha123")
        check("Inspetor vê apenas 'Nova ronda' no menu", nav_labels(page) == ["Nova ronda"], nav_labels(page))
        check("Inspetor cai direto em Nova ronda", page.inner_text("h1") == "Nova ronda")
        page.evaluate("RH.go('painel');RH.go('cadastros');RH.go('ncs');RH.go('historico')")
        check("Inspetor não consegue abrir outras telas", page.inner_text("h1") == "Nova ronda")
        cards = [c.inner_text() for c in page.query_selector_all("[data-act=pickRonda]")]
        check("Iara vê as duas rondas (a sua e a sem responsável)", len(cards) == 2, cards)
        page.click("[data-act=pickRonda]:has-text('Ronda UTI')")
        page.wait_for_selector(".rhead")
        check("Ronda mostra as 2 salas", page.locator(".sala-h").count() == 2)
        check("Progresso inicial", "0 de" in page.inner_text("#prog-t"))
        # tenta finalizar vazio
        page.click("#btn-sub")
        check("Finalizar sem responder é bloqueado", "sem resposta" in page.inner_text("#toast"))
        # tudo conforme em todos os grupos
        for b in page.query_selector_all("[data-act=allc]"): b.click()
        # marca uma NC no monitor
        item = page.locator(".it", has_text="Alarme funcionando")
        item.locator("button.n").click()
        check("Sem tipo selecionado não há orientação", page.locator(".orient").count() == 0)
        item = page.locator(".it", has_text="Alarme funcionando")
        item.locator("select[data-nc=tipoId]").select_option(label="Alarme inoperante")
        item = page.locator(".it", has_text="Alarme funcionando")
        check("Orientação do tipo aparece ao inspetor", "Testar, reparar e validar" in item.locator(".orient").inner_text())
        check("Severidade preenchida pelo tipo (Crítica)", item.locator("select[data-nc=sev]").input_value() == "4")
        page.click("#btn-sub")
        check("NC sem descrição é bloqueada", "tipo e a descrição" in page.inner_text("#toast"))
        item = page.locator(".it", has_text="Alarme funcionando")
        item.locator("textarea").fill("Alarme não soa no teste.")
        item.locator("input[data-nc-foto]").set_input_files({"name": "f.png", "mimeType": "image/png", "buffer": PNG})
        page.wait_for_selector(".ncp img")
        check("Foto anexada", page.locator(".ncp img").count() == 1)
        check("Descrição preservada após anexar foto", page.locator(".it", has_text="Alarme funcionando").locator("textarea").input_value() == "Alarme não soa no teste.")
        check("Painel mostra 1 NC", "1 não conformidade" in page.inner_text("#prog-t"))
        page.click("#btn-sub")
        page.wait_for_selector(".top h1:has-text('Nova ronda')")
        check("Após finalizar, inspetor volta para Nova ronda", page.inner_text("h1") == "Nova ronda")
        ex = page.evaluate("RH.execs(RH.S.rondas).map(e=>({n:e.nome,salas:e.docs.length,nc:e.nc,c:e.c}))")
        check("Execução única com 2 salas", len(ex) == 1 and ex[0]["salas"] == 2 and ex[0]["nc"] == 1, ex)
        ncs = page.evaluate("RH.S.ncs.map(n=>({m:n.modeloNome,s:n.salaNome,e:n.eqNome,sev:n.sev,f:!!n.fotoId}))")
        check("NC gerada com ronda, sala, equipamento e foto", ncs == [{"m": "Ronda UTI", "s": "UTI 01", "e": "Monitor", "sev": 4, "f": True}], ncs)
        logout(page)

        # ---- inspetor Ivo
        login(page, "ivo", "senha123")
        cards = [c.inner_text() for c in page.query_selector_all("[data-act=pickRonda]")]
        check("Ivo vê só a ronda sem responsável", len(cards) == 1 and "Ronda Farmácia" in cards[0], cards)
        page.evaluate("RH.ACT.pickRonda({dataset:{id:RH.S.modelos.find(m=>m.nome==='Ronda UTI').id}})")
        check("Ivo não consegue iniciar ronda de outro responsável", st_R(page) is None)
        logout(page)

        # ---- gestor
        login(page, "gestor", "senha123")
        check("Gestor não vê Cadastros", nav_labels(page) == ["Painel", "Nova ronda", "Histórico", "Não conformidades"], nav_labels(page))
        page.click("#nav [data-p=historico]")
        check("Histórico: 1 linha (execução) com 2 salas", page.locator("tbody tr").count() == 1 and "2 salas" in page.inner_text("tbody"))
        page.click("tbody tr"); page.wait_for_selector(".mod")
        check("Detalhe da ronda lista as duas salas", "UTI 01" in page.inner_text(".mod") and "UTI 02" in page.inner_text(".mod"))
        page.click(".mh [data-act=closeModal]")
        page.click("#nav [data-p=ncs]")
        check("NC aparece na lista com a ronda", "Ronda UTI" in page.inner_text("#nc-list"))
        page.click("[data-act=ncOpen]"); page.wait_for_selector("#f-nc")
        check("Detalhe da NC mostra a orientação", "Testar, reparar e validar" in page.inner_text(".orient"))
        page.wait_for_selector("#nc-foto img.big-img:not([style])", timeout=3000)
        # tratar NC
        page.select_option("select[name=status]", "resolvida")
        page.click("#f-nc button[type=submit]")
        check("Resolver sem ação corretiva é bloqueado", "ação corretiva" in page.inner_text("#toast") and page.locator("#f-nc").count() == 1)
        page.fill("textarea[name=resolucao]", "Alarme trocado.")
        page.click("#f-nc button[type=submit]"); page.wait_for_selector("#f-nc", state="detached")
        check("NC resolvida salva", page.evaluate("RH.S.ncs[0].status") == "resolvida" and page.evaluate("!!RH.S.ncs[0].resolvidoEm"))
        # excluir
        page.click(".chip:has-text('Todas')")
        foto_id = page.evaluate("RH.S.ncs[0].fotoId")
        page.click("[data-act=ncOpen]"); page.wait_for_selector("#f-nc")
        page.click("#btn-delnc")
        check("Exclusão pede confirmação (1º toque não exclui)", page.evaluate("RH.S.ncs.length") == 1 and "Confirmar" in page.inner_text("#btn-delnc"))
        page.click("#btn-delnc"); page.wait_for_selector("#f-nc", state="detached")
        check("NC excluída", page.evaluate("RH.S.ncs.length") == 0)
        check("Foto da NC excluída junto", page.evaluate("fid=>RH.st.db.doc('fotos/'+fid).get().then(s=>s.exists)", foto_id) is False)
        page.wait_for_function("document.querySelector('#nc-list').innerText.includes('Nenhuma não conformidade')", timeout=3000)
        check("Lista atualiza sozinha após exclusão", True)
        page.click("#nav [data-p=painel]")
        check("Painel renderiza (gestor)", page.locator("#ch-line svg, #ch-line .empty").count() == 1)
        logout(page)
        ctx.close()

        # ================= CENÁRIO 2: dados de exemplo =================
        print("\n== Cenário 2: dados de exemplo, painel e remoção ==")
        ctx = new_ctx(browser); page = ctx.new_page(); attach_errors(page, "c2")
        page.goto(f"http://127.0.0.1:{PORT}/{PAGE}"); page.wait_for_selector("#f-setup")
        page.fill("#st-n", "Ana"); page.fill("#st-l", "admin"); page.fill("#st-s", "senha123"); page.check("#st-d")
        page.click("#st-btn"); page.wait_for_selector("#nav h1, h1:has-text('Painel')", timeout=30000)
        page.wait_for_selector("#ch-line svg", timeout=10000)
        check("Painel com dados de exemplo", page.locator(".kpi").count() == 6 and page.locator("#ch-line svg").count() == 1)
        check("KPI 'Rondas em atraso' presente", "Rondas em atraso" in page.inner_text(".kpis"))
        page.click("#nav [data-p=historico]")
        check("Histórico agrupa por ronda", "Ronda UTI · plantão diurno" in page.inner_text("tbody") and "3 salas" in page.inner_text("tbody"))
        page.click("#nav [data-p=ronda]")
        n_cards = page.locator("[data-act=pickRonda]").count()
        check("Administrador vê todas as rondas do exemplo (5)", n_cards == 5, n_cards)
        page.click("#nav [data-p=ncs]")
        check("NCs de exemplo listadas", page.locator(".nc").count() > 10)
        page.click("#nav [data-p=cadastros]"); page.click("[data-act=cadTab][data-k=hospital]")
        page.click("[data-act=wipeDemo]"); page.wait_for_selector("[data-act=seedDemo]", timeout=15000)
        check("Dados de exemplo removidos (inclusive rondas)", page.evaluate("RH.S.modelos.length+RH.S.rondas.length+RH.S.ncs.length+RH.S.salas.length") == 0)
        ctx.close()

        # ================= CENÁRIO 3: mobile =================
        print("\n== Cenário 3: celular, persistência e exclusão de usuário/ronda ==")
        ctx = browser.new_context(viewport={"width": 390, "height": 800})
        ctx.route("**/js/config.js*", lambda r: r.fulfill(body="window.RONDA_CONFIG={};", content_type="application/javascript"))
        ctx.route("**/fonts.g*/**", lambda r: r.abort())
        ctx.route("**/*.supabase.co/**", lambda r: (blocked.append(r.request.url), r.abort()))
        page = ctx.new_page(); attach_errors(page, "c3")
        page.goto(f"http://127.0.0.1:{PORT}/{PAGE}"); page.wait_for_selector("#f-setup")
        page.fill("#st-n", "Ana"); page.fill("#st-l", "admin"); page.fill("#st-s", "senha123"); page.click("#st-btn"); page.wait_for_selector("#nav")
        overflow = page.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth")
        check("Sem rolagem horizontal no celular", not overflow)
        add(page, "users", fill={"nome": "Bia", "login": "bia", "senha": "senha123"}, select={"role": "Inspetor"}); save(page)
        add(page, "salas", fill={"nome": "Sala X", "setor": "S"}); save(page)
        add(page, "modelos", fill={"nome": "R1"}, check_boxes=["Sala X"]); page.select_option("#ff-responsavelId", label="Bia"); save(page)
        # excluir usuário responsável é bloqueado
        open_cad(page, "users"); page.click("tr[data-act=editEnt]:has-text('Bia')"); page.click("#btn-del")
        check("Usuário responsável por ronda não pode ser excluído", "responsável por rondas" in page.inner_text("#ent-err"))
        page.click("[data-act=closeModal]")
        # desativar usuário responsável é bloqueado
        page.click("tr[data-act=editEnt]:has-text('Bia')"); page.uncheck("#ff-ativo"); page.click("#f-ent button[type=submit]")
        check("Usuário responsável por ronda não pode ser desativado", "responsável por 1 ronda" in page.inner_text("#ent-err"))
        page.click("[data-act=closeModal]")
        # sala em ronda não pode ser excluída
        open_cad(page, "salas"); page.click("tr[data-act=editEnt]"); page.click("#btn-del")
        check("Sala pertencente a ronda não pode ser excluída", "faz parte de uma ronda" in page.inner_text("#ent-err"))
        page.click("[data-act=closeModal]")
        # persistência após recarregar (sessão e dados)
        page.reload(); page.wait_for_selector("#nav")
        check("Sessão e dados persistem após recarregar", page.evaluate("RH.S.modelos.length") == 1)
        # excluir ronda
        open_cad(page, "modelos"); page.click("tr[data-act=editEnt]"); page.click("#btn-del"); page.click("#btn-del"); page.wait_for_selector("#f-ent", state="detached")
        check("Ronda excluída", page.evaluate("RH.S.modelos.length") == 0)
        ctx.close()

        # ================= CENÁRIO 4: robustez (falha ao salvar, fuso horário, permissões) =================
        print("\n== Cenário 4: salvamento com falha, data local, permissões e saída ==")
        ctx = new_ctx(browser, timezone_id="America/Fortaleza"); page = ctx.new_page(); attach_errors(page, "c4")
        page.goto(f"http://127.0.0.1:{PORT}/{PAGE}"); page.wait_for_selector("#f-setup")
        page.fill("#st-n", "Ana"); page.fill("#st-l", "admin"); page.fill("#st-s", "senha123"); page.click("#st-btn"); page.wait_for_selector("#nav")
        page.evaluate("""(async()=>{
          const P=RH.put;
          await P('users','uI',{nome:'Ines',login:'ines',role:'inspetor',ativo:true,salt:'s',hash:await RH.hash('senha123','s')});
          await P('checklists','c1',{nome:'Amb',tipo:'sala',itens:[{id:'i1',t:'Limpo'},{id:'i2',t:'Seguro'}]});
          await P('salas','s1',{nome:'Sala 1',setor:'A',checklistId:'c1',ativo:true});
          await P('salas','s2',{nome:'Sala 2',setor:'A',checklistId:'c1',ativo:true});
          await P('tiposNC','t1',{nome:'Falha',sev:3,orient:'Chamar a manutenção.'});
          await P('modelos','m1',{nome:'Ronda A',salaIds:['s1','s2'],responsavelId:'',freq:24,ativo:true});
        })()""")
        check("data local (fuso de Fortaleza) não adianta o dia", page.evaluate("RH.ymd(Date.parse('2026-10-08T02:30:00Z'))") == "2026-10-07")
        logout(page); login(page, "ines", "senha123")
        page.click("[data-act=pickRonda]"); page.wait_for_selector(".rhead")
        for b in page.query_selector_all("[data-act=allc]"): b.click()
        item = page.locator(".sala-h:has-text('Sala 2') ~ .grp .it", has_text="Seguro")
        item.locator("button.n").click()
        page.locator(".it select[data-nc=tipoId]").select_option(label="Falha")
        page.locator(".it textarea").fill("Porta quebrada.")
        # sair com ronda em andamento pede confirmação
        page.click("[data-act=logout]")
        check("Sair com ronda em andamento pede confirmação", page.locator("#f-login").count() == 0 and "em andamento" in page.inner_text("#toast"))
        # 1ª tentativa de salvar falha na NC (depois de gravar a sala 1 e a sala 2)
        page.evaluate("""(()=>{const o=RH.put;RH.put=(c,i,d)=>{if(c==='ncs'&&!window.__f){window.__f=1;return Promise.reject(new Error('falha simulada'))}return o(c,i,d)}})()""")
        page.click("#btn-sub")
        page.wait_for_function("document.querySelector('#toast').innerText.includes('Não foi possível salvar')", timeout=4000)
        check("Falha ao salvar avisa e mantém a ronda aberta", page.evaluate("!!RH.st.R") and page.locator(".rhead").count() == 1)
        page.click("#btn-sub"); page.wait_for_selector(".rhead", state="detached", timeout=5000)
        check("Nova tentativa não duplica registros", page.evaluate("RH.S.rondas.length") == 2 and page.evaluate("RH.S.ncs.length") == 1,
              page.evaluate("[RH.S.rondas.length,RH.S.ncs.length]"))
        check("As duas salas pertencem à mesma execução", page.evaluate("new Set(RH.S.rondas.map(r=>r.execId)).size") == 1)
        check("NC guarda a orientação do tipo", page.evaluate("RH.S.ncs[0].orient") == "Chamar a manutenção.")
        # inspetor não consegue excluir NC nem editando via console
        page.evaluate("RH.ACT.delNC({dataset:{id:RH.S.ncs[0].id,armed:'1'},textContent:''})")
        page.wait_for_timeout(300)
        check("Inspetor não consegue excluir NC", page.evaluate("RH.S.ncs.length") == 1)
        logout(page)
        # prazo da NC aparece no dia local, sem adiantar por causa do UTC
        login(page, "admin", "senha123")
        page.evaluate("RH.upd('ncs',RH.S.ncs[0].id,{prazo:Date.parse('2026-10-08T02:30:00Z')})")
        page.click("#nav [data-p=ncs]"); page.click("[data-act=ncOpen]"); page.wait_for_selector("#f-nc")
        check("Prazo da NC mostra o dia local (07/10), não o do UTC", page.input_value("input[name=prazo]") == "2026-10-07", page.input_value("input[name=prazo]"))

        # ---- excluir ronda realizada (Histórico)
        page.evaluate("RH.ACT.delRonda({dataset:{id:RH.S.rondas[0].execId,armed:'1'},textContent:''})")  # só para provar o fluxo abaixo
        page.wait_for_timeout(300)
        check("Admin pode excluir ronda (fluxo direto)", page.evaluate("RH.S.rondas.length") == 0)
        page.evaluate("""(async()=>{ // recria uma execução com 1 NC e uma sem NC para testar as duas opções
          const base={ts:Date.now(),salaId:'s1',salaNome:'Sala 1',setor:'A',inspNome:'Ines',c:1,nc:0,na:0,pct:100,itens:[]};
          await RH.put('rondas','rA1',{...base,execId:'xA',modeloId:'m1',modeloNome:'Ronda A',c:0,nc:1,pct:0});
          await RH.put('rondas','rA2',{...base,execId:'xA',salaId:'s2',salaNome:'Sala 2',modeloId:'m1',modeloNome:'Ronda A'});
          await RH.put('ncs','nA',{ts:base.ts,rondaId:'rA1',execId:'xA',salaNome:'Sala 1',sev:2,status:'aberta',desc:'x',tipoNome:'Falha'});
          await RH.put('rondas','rB1',{...base,execId:'xB',modeloId:'m1',modeloNome:'Ronda A',ts:base.ts-1000});
        })()""")
        page.click("#nav [data-p=historico]")
        page.locator("tbody tr").first.click(); page.wait_for_selector("#btn-delronda")
        check("Detalhe oferece excluir ronda; apagar as NCs vem desmarcado (padrão seguro)", not page.is_checked("#del-ncs") and "1 não conformidade" in page.inner_text(".mf"))
        page.check("#del-ncs")
        page.click("#btn-delronda")
        check("Excluir ronda pede confirmação (1º toque não exclui)", page.evaluate("RH.S.rondas.length") == 3 and "Confirmar" in page.inner_text("#btn-delronda"))
        page.click("#btn-delronda"); page.wait_for_selector(".mod", state="detached")
        check("Ronda excluída com todas as salas e a NC dela", page.evaluate("[RH.S.rondas.length,RH.S.ncs.some(n=>n.id==='nA')]") == [1, False])
        page.evaluate("RH.put('ncs','nB',{ts:Date.now(),rondaId:'rB1',execId:'xB',salaNome:'Sala 1',sev:2,status:'aberta',desc:'y'})")
        page.click("#nav [data-p=painel]"); page.click("#nav [data-p=historico]")
        page.locator("tbody tr").first.click(); page.wait_for_selector("#btn-delronda")
        page.uncheck("#del-ncs"); page.click("#btn-delronda"); page.click("#btn-delronda"); page.wait_for_selector(".mod", state="detached")
        check("Desmarcando a opção, as NCs são mantidas", page.evaluate("[RH.S.rondas.length,RH.S.ncs.some(n=>n.id==='nB')]") == [0, True])
        logout(page)
        # gestor também vê o botão; inspetor não consegue excluir por console
        page.evaluate("RH.put('rondas','rC',{ts:Date.now(),execId:'xC',modeloNome:'C',salaId:'s1',salaNome:'S',inspNome:'i',c:1,nc:0,na:0,pct:100,itens:[]})")
        login(page, "ines", "senha123")
        page.evaluate("RH.ACT.delRonda({dataset:{id:'xC',armed:'1'},textContent:''})"); page.wait_for_timeout(300)
        check("Inspetor não consegue excluir ronda", page.evaluate("RH.S.rondas.length") == 1)
        # ---- atualização automática não rouba o foco de quem está digitando
        logout(page); login(page, "admin", "senha123")
        page.click("#nav [data-p=ncs]"); page.click("#nc-q"); page.keyboard.type("abc")
        page.evaluate("RH.put('config','main',{...RH.S.cfg,meta:90})"); page.wait_for_timeout(700)
        check("Dados mudando em outro aparelho não tiram o foco do campo de busca", page.evaluate("document.activeElement.id") == "nc-q" and page.input_value("#nc-q") == "abc")
        ctx.close()
        browser.close()
    srv.shutdown()

    print("\n== Erros de console/página ==")
    real = [e for e in errors if "Failed to load resource" not in e and "fonts" not in e and "falha simulada" not in e]
    for e in real: print("  ", e)
    check("Nenhum erro de JavaScript no console", not real)
    check("Nenhuma requisição ao Supabase real durante o teste", not blocked, blocked[:3])
    bad = [n for n, ok in results if not ok]
    print(f"\n{len(results)-len(bad)}/{len(results)} verificações passaram")
    sys.exit(1 if bad else 0)

def st_R(page):
    return page.evaluate("RH.st.R")

if __name__ == "__main__":
    main()
