// Milhas de clientes (aba Milhas → Recebidas de clientes): acesso pela Equipe, cadastro, CPF, resumo do mês,
// filtro por programa, edição, busca em todos os meses, planilha, exclusão, quem só vê, celular e escuro.
// Só dados inventados. Roda depois do e2e-7 (usa a equipe dos testes anteriores).
import fs from "node:fs";
import path from "node:path";
import { navegador, pagina, entrar, sair, foto, checar, totalFalhas, BASE, OUT, listarAdmin } from "./util.mjs";

const pins = JSON.parse(fs.readFileSync(path.join(OUT, "pins.json"), "utf8"));
const fmtIso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" });
const hoje = fmtIso.format(new Date());
const [ano, mes] = hoje.split("-").map(Number);
const mesPassado = new Date(Date.UTC(ano, mes - 2, 15)).toISOString().slice(0, 10);
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (iso) => { const s = `${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`; return s[0].toUpperCase() + s.slice(1); };

function cpfFalso(semente) {
  const b = String(100000000 + (semente * 7919) % 899999999).slice(0, 9).split("").map(Number);
  const dv = (n) => { let s = 0; for (let i = 0; i < n.length; i++) s += n[i] * (n.length + 1 - i); return ((s * 10) % 11) % 10; };
  const d1 = dv(b), d2 = dv([...b, d1]);
  return b.join("") + d1 + d2;
}
const CPF = cpfFalso(57);
const fmtCpf = (d) => `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;

for (const x of await listarAdmin("milhas_clientes")) await fetch("http://127.0.0.1:8080/v1/" + x.name, { method: "DELETE", headers: { Authorization: "Bearer owner" } });

const browser = await navegador();
const p = await pagina(browser);
const dlg = () => p.locator("dialog.mcl-dlg[open]");
const campo = (rotulo) => dlg().locator(`.tt-campo:has(> span:has-text("${rotulo}")) input, .tt-campo:has(> span:has-text("${rotulo}")) textarea`).first();
const programa = (nome) => dlg().locator(`.mcl-progs label:has-text("${nome}")`).click();
const registrar = async () => { await p.click(".mcl-novo"); await dlg().waitFor(); };
const salvar = async () => dlg().locator("footer button[type=submit]").click();
const fechou = () => p.waitForSelector("dialog.mcl-dlg[open]", { state: "detached", timeout: 15000 });
const linhas = () => p.$$eval(".mcl-item", (els) => els.map((e) => [e.querySelector(".mcl-quem b").textContent, e.querySelector(".mcl-prog").textContent, e.querySelector(".mcl-qtd b").textContent, e.querySelector(".mcl-valor").textContent]));
const total = async () => (await p.textContent(".mcl-total b")).trim();
const docs = async () => (await listarAdmin("milhas_clientes")).map((d) => d.fields);

console.log("1. o administrador vê as duas partes da aba Milhas");
await entrar(p, "Samuel Rodrigues", pins.samuel);
await p.goto(BASE + "#/milhas");
await p.waitForSelector(".mil-nav", { timeout: 15000 });
const partes = await p.$$eval(".mil-nav a", (els) => els.map((e) => e.textContent.trim()));
checar(partes.join("|") === "Ofertas de compra|Recebidas de clientes", "partes: " + partes.join(", "));
checar((await p.textContent(".mil-nav a[aria-current=page]")).trim() === "Ofertas de compra" && (await p.textContent(".mil-topo h1")).trim() === "Compra de milhas", "abre nas ofertas, como antes");
await p.click(".mil-nav a:has-text('Recebidas de clientes')");
await p.waitForSelector(".mcl .mil-topo h1:text-is('Milhas de clientes')", { timeout: 15000 });
checar(p.url().endsWith("#/milhas/clientes"), "endereço #/milhas/clientes");
await p.waitForSelector(".pro-vazio:has-text('Nenhuma milha de cliente registrada ainda')", { timeout: 15000 });
checar(true, "vazio: nenhuma milha registrada");
checar((await p.textContent(".mcl-mes h2")).trim() === nomeMes(hoje), "abre no mês atual: " + (await p.textContent(".mcl-mes h2")));
checar(await p.isDisabled(".mcl-barra .pro-btn:has-text('Planilha')"), "sem registros, a planilha fica desligada");

console.log("2. registra milhas de um cliente");
await registrar();
await salvar();
checar((await dlg().locator(".tt-msg.erro").textContent()).includes("Digite o nome do cliente"), "sem nome: pede o nome");
await campo("Cliente").fill("Maria Teste Silva");
await campo("CPF do titular").fill("123.456.789-00");
await programa("Smiles");
await campo("Quantidade de milhas").pressSequentially("120000");
checar((await campo("Quantidade de milhas").inputValue()) === "120.000", "quantidade formatada enquanto digita: " + (await campo("Quantidade de milhas").inputValue()));
await campo("Valor pago ou abatido").fill("1.980,00");
checar((await dlg().locator(".mcl-dica").textContent()).includes("R$ 16,50 o milheiro"), "milheiro calculado: " + (await dlg().locator(".mcl-dica").textContent()));
checar((await campo("Data do recebimento").inputValue()) === hoje, "data começa em hoje");
await salvar();
await dlg().locator(".tt-msg.erro:has-text('CPF não confere')").waitFor();
checar(true, "CPF que não confere é recusado");
await campo("CPF do titular").fill(CPF);
await campo("Observação").fill("Pagas por PIX");
await foto(p, "80-milhas-clientes-form");
await salvar();
await fechou();
await p.waitForSelector(".mcl-item", { timeout: 15000 });
let l = await linhas();
checar(l.length === 1 && l[0][0] === "Maria Teste Silva" && l[0][1] === "Smiles" && l[0][2] === "120.000" && l[0][3].includes("R$ 1.980,00") && l[0][3].includes("R$ 16,50 o milheiro"), "aparece na lista: " + JSON.stringify(l[0]));
checar((await p.textContent(".mcl-item .mcl-quem span")).includes(`CPF ${fmtCpf(CPF)}`) && (await p.textContent(".mcl-item .mcl-quem span")).includes("por Samuel"), "mostra CPF e quem registrou");
checar((await p.textContent(".mcl-item .mcl-obs")).trim() === "Pagas por PIX", "mostra a observação");
let d = await docs();
checar(d.length === 1 && d[0].quantidade.integerValue === "120000" && Number(d[0].valor.integerValue ?? d[0].valor.doubleValue) === 1980 && d[0].documento.stringValue === CPF
  && d[0].data.stringValue === hoje && d[0].criadoPor.mapValue.fields.nome.stringValue === "Samuel Rodrigues", "gravado no banco com número inteiro, CPF só com dígitos e quem registrou");

console.log("3. outro cliente, no mês passado e sem valor");
await registrar();
await campo("Cliente").fill("José Exemplo Costa");
await programa("LATAM Pass");
await campo("Quantidade de milhas").pressSequentially("80000");
await campo("Data do recebimento").fill(mesPassado);
await salvar();
await fechou();
await p.waitForSelector(`.mcl-mes h2:text-is("${nomeMes(mesPassado)}")`, { timeout: 15000 });
checar(true, "salvou em outro mês e a tela foi para esse mês");
l = await linhas();
checar(l.length === 1 && l[0][0] === "José Exemplo Costa" && l[0][3].includes("sem valor"), "só o José no mês passado, sem valor");
checar((await total()) === "80.000" && (await p.textContent(".mcl-total em")).includes("sem valor informado"), "total do mês passado: 80.000");
await p.click(".mcl-hoje");
await p.waitForSelector(`.mcl-mes h2:text-is("${nomeMes(hoje)}")`);
checar((await total()) === "120.000", "voltou para este mês: 120.000");

console.log("4. o mesmo cliente de novo: o CPF vem sozinho");
await registrar();
await campo("Cliente").fill("maria teste silva");
await campo("Data do recebimento").focus();
checar((await campo("CPF do titular").inputValue()) === fmtCpf(CPF), "CPF completado pelo nome: " + (await campo("CPF do titular").inputValue()));
await campo("Cliente").fill("Maria Teste Silva");
await programa("Outro");
await dlg().locator(".mcl-outro").fill("Azul Fidelidade");
await campo("Quantidade de milhas").pressSequentially("50000");
await campo("Valor pago ou abatido").fill("900");
await salvar();
await fechou();
await p.waitForFunction(() => document.querySelectorAll(".mcl-item").length === 2);
checar((await total()) === "170.000" && (await p.textContent(".mcl-total small")).trim() === "Total do mês" && (await p.textContent(".mcl-total span")).includes("2 registros"), "total do mês: 170.000 em 2 registros");
checar((await p.textContent(".mcl-total span")).includes("R$ 2.880,00") && (await p.textContent(".mcl-total em")).includes("R$ 16,94 o milheiro"), "valor somado e milheiro médio: " + (await p.textContent(".mcl-total")));
const cards = await p.$$eval(".mcl-resumo button.mil-recorde", (els) => els.map((e) => e.querySelector("small").textContent + "=" + e.querySelector("b").textContent));
checar(cards.join("|") === "Smiles=120.000|Azul Fidelidade=50.000", "um cartão por programa, o maior primeiro: " + cards.join(", "));
await p.click(".mcl-resumo button.mil-recorde:has-text('Azul Fidelidade')");
l = await linhas();
checar(l.length === 1 && l[0][1] === "Azul Fidelidade" && (await total()) === "50.000" && (await p.textContent(".mcl-total small")).startsWith("Azul Fidelidade"), "filtro pelo cartão do programa");
await p.click(".mcl-resumo button.mil-recorde:has-text('Azul Fidelidade')");
checar((await linhas()).length === 2, "clicar de novo mostra todos");
await foto(p, "81-milhas-clientes-lista");

console.log("5. edita");
await p.click('.mcl-item:has-text("Azul Fidelidade") .mcl-editar');
await dlg().waitFor();
checar((await dlg().locator("h2").textContent()).includes("Editar") && (await dlg().locator(".mcl-progs label:has(input:checked)").textContent()).includes("Azul Fidelidade"), "abre com os dados (programa marcado)");
await campo("Quantidade de milhas").fill("");
await campo("Quantidade de milhas").pressSequentially("55000");
await salvar();
await fechou();
await p.waitForSelector('.mcl-item:has-text("Azul Fidelidade") .mcl-qtd b:text-is("55.000")', { timeout: 15000 });
checar((await total()) === "175.000", "editou: 55.000 e total 175.000");
d = await docs();
checar(d.length === 3, "3 registros no banco");

console.log("6. busca em todos os meses");
await p.fill(".mcl-barra .pro-busca input", "jose");
await p.waitForSelector(".mcl-buscando");
l = await linhas();
checar(l.length === 1 && l[0][0] === "José Exemplo Costa", "busca sem acento acha o José do mês passado");
await p.fill(".mcl-barra .pro-busca input", CPF.slice(0, 5));
await p.waitForFunction(() => document.querySelectorAll(".mcl-item").length === 2);
checar(true, "busca pelo CPF acha os 2 da Maria");
await p.fill(".mcl-barra .pro-busca input", "xyz inexistente");
await p.waitForSelector(".pro-vazio:has-text('Nada encontrado')");
checar(true, "busca sem resultado");
await p.fill(".mcl-barra .pro-busca input", "");

console.log("7. planilha");
const [baixado] = await Promise.all([p.waitForEvent("download"), p.click(".mcl-barra .pro-btn:has-text('Planilha')")]);
const texto = fs.readFileSync(await baixado.path(), "utf8");
checar(baixado.suggestedFilename() === `milhas-de-clientes-${hoje.slice(0, 7)}.csv`, "nome do arquivo: " + baixado.suggestedFilename());
checar(texto.includes("Data;Cliente;CPF;Programa;Milhas;Valor (R$);Milheiro (R$);Observação;Registrado por") && texto.includes(`Maria Teste Silva;${fmtCpf(CPF)};Smiles;120000;1980,00;16,50;Pagas por PIX;Samuel Rodrigues`), "planilha com as colunas e os valores");
checar(!texto.includes("José"), "a planilha leva só o mês da tela");

console.log("8. exclui");
await p.click(".mcl-mes button[aria-label='Mês anterior']");
await p.waitForSelector('.mcl-item:has-text("José")');
await p.click('.mcl-item:has-text("José") .mcl-editar');
await dlg().waitFor();
await dlg().locator("footer button:has-text('Excluir')").click();
checar((await dlg().locator("footer button.armado").textContent()).includes("Excluir de vez"), "pede confirmação antes de excluir");
await dlg().locator("footer button.armado").click();
await fechou();
await p.waitForSelector(".pro-vazio:has-text('Nenhuma milha recebida em')", { timeout: 15000 });
checar((await docs()).length === 2, "excluído do banco");
checar(p.erros.length === 0, "sem erros na página " + p.erros.join(" | "));

console.log("9. acesso pela Equipe: Alan só vê");
await p.goto(BASE + "#/equipe");
await p.click('.eq-cab:has-text("Alan Ferreira")');
const selMilhas = p.locator('.eq-lista .tt-campo:has(> span:text-is("Milhas de clientes")) select');
checar((await selMilhas.locator("option").allTextContents()).join("|") === "Sem acesso|Só ver|Cadastrar e editar", "Equipe tem o acesso Milhas de clientes");
await selMilhas.selectOption("ver");
await p.click(".eq-lista button:has-text('Salvar')");
await p.waitForSelector(".eq-lista .tt-msg.ok", { timeout: 15000 });
checar((await p.textContent('.eq-cab:has-text("Alan Ferreira")')).includes("Milhas de clientes: só ver"), "resumo dos acessos do Alan mostra Milhas de clientes");
await p.click('.eq-cab:has-text("Alan Ferreira")');
await p.click('.eq-cab:has-text("Lívia Pia")');
await p.locator('.eq-lista .tt-campo:has(> span:text-is("Milhas de clientes")) select').selectOption("editar");
await p.click(".eq-lista button:has-text('Salvar')");
await p.waitForSelector(".eq-lista .tt-msg.ok", { timeout: 15000 });
checar((await p.textContent(".eq-lista .tt-msg.ok")).includes("PIN precisa ter 6 números"), "dar o acesso a quem tem PIN de 4 números avisa para gerar PIN novo");
await p.locator('.eq-lista .tt-campo:has(> span:text-is("Milhas de clientes")) select').selectOption("");
await p.click(".eq-lista button:has-text('Salvar')");
await p.waitForSelector(".eq-lista .tt-msg.ok:not(:has-text('6 números'))", { timeout: 15000 });
await sair(p);

const a = await pagina(browser);
await entrar(a, "Alan Ferreira", pins.alan);
await a.goto(BASE + "#/milhas/clientes");
await a.waitForSelector(".mcl-item", { timeout: 15000 });
checar((await a.$$(".mcl-item")).length === 2, "Alan vê os 2 registros do mês");
checar(!(await a.$(".mcl-novo")) && !(await a.$("button.mcl-editar")), "Alan não vê Registrar nem Editar");
checar((await a.textContent(".mcl .mil-topo p")).includes("Você pode ver os registros"), "explica que é só para ver");
checar(a.erros.length === 0, "sem erros na página do Alan " + a.erros.join(" | "));
await a.context().close();

console.log("10. quem não tem o acesso só vê as ofertas");
const lv = await pagina(browser);
await entrar(lv, "Lívia Pia", pins.livia);
await lv.goto(BASE + "#/milhas/clientes");
await lv.waitForSelector(".mil-topo h1", { timeout: 15000 });
checar((await lv.textContent(".mil-topo h1")).trim() === "Compra de milhas" && !(await lv.$(".mil-nav")), "Lívia: só as ofertas, sem a parte de clientes");
checar(lv.erros.length === 0, "sem erros na página da Lívia " + lv.erros.join(" | "));
await lv.context().close();

console.log("11. celular e escuro");
const m = await pagina(browser, { largura: 390, altura: 844 });
await entrar(m, "Samuel Rodrigues", pins.samuel);
await m.goto(BASE + "#/milhas/clientes");
await m.waitForSelector(".mcl-item", { timeout: 15000 });
const larg = await m.evaluate(() => document.documentElement.scrollWidth);
checar(larg <= 390, "celular sem rolagem para o lado: " + larg + "px");
await foto(m, "82-milhas-clientes-celular");
await m.click(".mcl-novo");
await m.locator("dialog.mcl-dlg[open]").waitFor();
await m.waitForTimeout(250);
await m.screenshot({ path: path.join(OUT, "83-milhas-clientes-celular-form.png") });
await m.context().close();
const e = await pagina(browser, { escuro: true });
await entrar(e, "Samuel Rodrigues", pins.samuel);
await e.goto(BASE + "#/milhas/clientes");
await e.waitForSelector(".mcl-item", { timeout: 15000 });
await foto(e, "84-milhas-clientes-escuro");
await e.goto(BASE + "#/milhas");
await e.waitForSelector(".mil-cartao", { timeout: 15000 });
await foto(e, "85-milhas-ofertas-escuro-nav");
checar(e.erros.length === 0, "sem erros no escuro " + e.erros.join(" | "));

await browser.close();
console.log(totalFalhas() ? `${totalFalhas()} FALHA(S)` : "TUDO CERTO");
process.exit(totalFalhas() ? 1 : 0);
