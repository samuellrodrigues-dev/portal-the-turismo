// Logins da Oktoplus: colar da planilha, ver e copiar, login na conta que a pessoa pegou, quem pode editar.
// Roda depois do e2e-2 (usa as contas e a equipe criadas lá). Os CPFs e senhas daqui são inventados.
import fs from "node:fs";
import path from "node:path";
import { navegador, pagina, entrar, sair, foto, checar, totalFalhas, BASE, OUT, listarAdmin } from "./util.mjs";

const pins = { ...JSON.parse(fs.readFileSync(path.join(OUT, "pins.json"), "utf8")), ...JSON.parse(fs.readFileSync(path.join(OUT, "pins2.json"), "utf8")) };

// CPF inventado e válido que termina com os dois dígitos pedidos
function cpfCom(final, semente, comZero = false) {
  for (let b = semente; ; b += 7919) {
    const base = String(100000000 + (b % 899999999)).padStart(9, "0").slice(0, 9).split("").map(Number);
    if (comZero) base[0] = 0;
    const dv = (n) => { let s = 0; for (let i = 0; i < n.length; i++) s += n[i] * (n.length + 1 - i); return ((s * 10) % 11) % 10; };
    const d1 = dv(base), d2 = dv([...base, d1]);
    if (`${d1}${d2}` === final) return base.join("") + d1 + d2;
  }
}
const cpf = {
  isolina: cpfCom("91", 11), denise75: cpfCom("75", 23), denise53: cpfCom("53", 37, true), debora41: cpfCom("41", 41),
  debora28: cpfCom("28", 53), mariaO: cpfCom("99", 67),
};
// Denise •••53 com o zero da frente comido, como acontece na planilha
const denise53SemZero = cpf.denise53.startsWith("0") ? cpf.denise53.slice(1) : cpf.denise53;
const fmt = (d) => `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
const planilha = [
  ["ACESSO", "CPF", "SENHA", "EMAIL"],
  ["ISOLINA", cpf.isolina, "Teste123@", "agencia@exemplo.com"],
  ["DENISE", fmt(cpf.denise75), "Outra456", "denise@exemplo.com"],
  ["DEBORA", cpf.debora28, "Teste123@", "debora@exemplo.com"],
  ["DÉBORA", cpf.debora41, "Teste123@", "debora2@exemplo.com"],
  ["*HOTELDO*", "*HOTELDO*", "Hotel789@@", "debora2@exemplo.com"],
  ["MARIA O", cpf.mariaO, "maria999", "maria@exemplo.com"],
  ["DENISE", denise53SemZero, "Outra456", "denise@exemplo.com"],
  ["SEATSAERO", "", "Seats000%", "seats@exemplo.com"],
  ["EHTL", "", "", ""],
  ["DIGISAC", "-", "-", "empresa.digisac.io"],
  ["LIDIA ADNA", "063.332.263-03", "Teste123@", "agencia@exemplo.com"],
].map((l) => l.join("\t")).join("\n");

// começa sem logins (o teste pode rodar mais de uma vez)
for (const d of await listarAdmin("okto_acessos")) {
  await fetch(`http://127.0.0.1:8080/v1/${d.name}`, { method: "DELETE", headers: { Authorization: "Bearer owner" } });
}
const browser = await navegador();
const p = await pagina(browser);
await p.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:4173" });

console.log("1. administrador cola a planilha");
await entrar(p, "Samuel Rodrigues", pins.samuel);
await p.goto(BASE + "#/oktoplus/logins");
await p.waitForSelector("text=Nenhum login cadastrado ainda", { timeout: 15000 });
checar((await p.$$eval(".okto-nav a", (a) => a.map((x) => x.textContent))).join(",") === "Contas,Logins,Histórico,Gerenciar contas", "menu da Oktoplus com Logins");
await p.click("summary:has-text('Colar da planilha')");
await p.fill("details.colar textarea", planilha);
await p.waitForSelector(".tabela.previa tbody tr");
const prev = await p.$$eval(".tabela.previa tbody tr", (trs) => trs.map((tr) => [...tr.children].map((td) => td.textContent.trim())));
checar(prev.length === 11, "prévia com 11 linhas (o cabeçalho fica de fora): " + prev.length);
const linha = (n) => prev.find((r) => r[0] === n);
checar(linha("ISOLINA")[4].includes("Isolina") && linha("ISOLINA")[4].includes("91"), "Isolina vai para a conta Isolina •••91");
checar(prev.filter((r) => r[0] === "DENISE").map((r) => r[4]).sort().join("|").includes("•••53") && prev.some((r) => r[0] === "DENISE" && r[4].includes("•••75")), "as duas Denises vão cada uma para a sua conta (75 e 53)");
checar(linha("DENISE") && prev.some((r) => r[0] === "DENISE" && r[1] === fmt(cpf.denise53)), "CPF sem o zero da frente foi completado: " + fmt(cpf.denise53));
checar(linha("DEBORA")[4].includes("•••28") && linha("DÉBORA")[4].includes("•••41"), "Debora •••28 e Débora •••41 separadas pelo final do CPF");
checar(linha("MARIA O")[4].includes("Maria O."), "MARIA O vai para Maria O.");
checar(linha("HOTELDO")[4] === "Outros acessos" && linha("HOTELDO")[1] === "—", "*HOTELDO* vira outro acesso, sem CPF, com o nome limpo");
checar(linha("LIDIA ADNA")[1].includes("não confere") && linha("LIDIA ADNA")[4].includes("sem conta cadastrada"), "Lidia: CPF não confere e não tem conta cadastrada");
checar(!prev.some((r) => r.join(" ").includes("Teste123@")), "a prévia não mostra as senhas");
await foto(p, "50-logins-previa");
await p.click("details.colar button:has-text('Salvar 11 logins')");
await p.waitForSelector("#h-lg-okto + .lista .item", { timeout: 15000 });
await p.waitForTimeout(500);
checar((await p.textContent("#h-lg-okto .cont")).trim() === "7", "7 contas Oktoplus na lista");
checar((await p.textContent("#h-lg-outros .cont")).trim() === "4", "4 outros acessos (HotelDO, Seats.aero, EHTL, Digisac)");
const docs = await listarAdmin("okto_acessos");
checar(docs.length === 11 && docs.every((d) => d.fields.atualizadoPor.stringValue === "Samuel Rodrigues"), "11 logins gravados, assinados por quem colou");

console.log("2. ver, esconder e copiar");
checar(await p.locator("#h-lg-okto + .lista .cred:has-text('CPF') a.ico").count() === 0, "CPF não vira link");
const isolina = p.locator("#h-lg-okto + .lista .item:has(.conta-nome:has-text('ISOLINA•••91'))");
checar((await isolina.locator(".cred:has-text('Senha') code").textContent()).startsWith("•"), "senha escondida de início");
await isolina.locator(".cred:has-text('Senha') button[aria-label^='Mostrar']").click();
checar((await isolina.locator(".cred:has-text('Senha') code").textContent()) === "Teste123@", "o olho mostra a senha");
await isolina.locator(".cred:has-text('CPF') button[aria-label^='Copiar']").click();
checar((await p.evaluate(() => navigator.clipboard.readText())) === cpf.isolina, "copiar CPF copia só os números");
await isolina.locator(".cred:has-text('Senha') button[aria-label^='Esconder']").click();
await isolina.locator(".cred:has-text('Senha') button[aria-label^='Copiar']").click();
checar((await p.evaluate(() => navigator.clipboard.readText())) === "Teste123@", "copiar senha funciona com ela escondida");
checar(await isolina.locator(".tag.sua:has-text('livre')").count() === 1, "mostra que a conta Isolina está livre");
checar(await p.locator(".item:has-text('LIDIA ADNA') .tag:has-text('CPF não confere')").count() === 1, "Lidia com o aviso de CPF");
checar(await p.locator(".item:has-text('DIGISAC') a.ico[href='https://empresa.digisac.io']").count() === 1, "Digisac com botão de abrir o endereço");
checar(await p.locator(".item:has(.conta-nome:has-text('HOTELDO'))").count() === 1, "HotelDO sem os asteriscos");
await p.fill(".busca input", "denise");
await p.waitForTimeout(200);
checar(await p.locator("#h-lg-okto + .lista .item").count() === 2 && !(await p.$("#h-lg-outros")), "busca: 2 Denises");
await p.fill(".busca input", "");
await foto(p, "51-logins-lista");

console.log("3. colar de novo só atualiza");
await p.click("summary:has-text('Colar da planilha')").catch(() => {});
if (!(await p.$("details.colar[open]"))) await p.click("summary:has-text('Colar da planilha')");
await p.fill("details.colar textarea", planilha);
await p.waitForSelector(".tabela.previa tbody tr");
const tags = await p.$$eval(".tabela.previa tbody tr td:last-child", (t) => t.map((x) => x.textContent.trim()));
checar(tags.every((t) => t === "atualiza"), "todas as linhas aparecem como 'atualiza'");
await p.click("details.colar button:has-text('Salvar 11 logins')");
await p.waitForTimeout(1500);
checar((await listarAdmin("okto_acessos")).length === 11, "continua com 11 (nada duplicado)");

console.log("4. editar e apagar");
const ehtl = p.locator(".item:has(.conta-nome:has-text('EHTL'))");
await ehtl.locator("summary:has-text('Editar')").click();
await ehtl.locator(".campo:has-text('Senha') input").fill("Nova@2026");
await ehtl.locator("button:has-text('Salvar login')").click();
await p.waitForSelector(".item:has(.conta-nome:has-text('EHTL')) .msg.ok", { timeout: 15000 });
checar(true, "editou a senha do EHTL");
await p.locator(".item:has(.conta-nome:has-text('SEATSAERO')) button:has-text('Apagar')").click();
await p.locator(".item:has(.conta-nome:has-text('SEATSAERO')) button:has-text('Apagar o login')").click();
await p.waitForSelector(".item:has(.conta-nome:has-text('SEATSAERO'))", { state: "detached", timeout: 15000 });
// espera o aviso de "apagado": ele só aparece depois que o registro foi gravado (sair antes disso perdia o registro)
await p.waitForSelector("text=Login de SEATSAERO apagado.", { timeout: 15000 });
checar(true, "apagou o Seats.aero");
checar(p.erros.length === 0, "sem erros: " + p.erros.join(" | "));
await sair(p);

console.log("5. Pedro (só usa a Oktoplus) vê os logins e pega a Isolina");
await entrar(p, "Pedro", pins.Pedro);
await p.waitForSelector(".okto .resumo", { timeout: 15000 });
checar((await p.$$eval(".okto-nav a", (a) => a.map((x) => x.textContent))).join(",") === "Contas,Logins,Gerenciar contas", "menu do Pedro: Contas, Logins e Gerenciar contas");
await p.click(".okto-nav a:has-text('Logins')");
await p.waitForSelector("#h-lg-okto + .lista .item", { timeout: 15000 });
checar(!(await p.$("summary:has-text('Colar da planilha')")) && !(await p.$("button:has-text('Apagar')")), "Pedro não vê colar da planilha nem apagar");
checar(!!(await p.$("summary:has-text('Adicionar login')")) && !!(await p.$("#h-lg-okto + .lista summary:has-text('Editar')")), "Pedro vê Adicionar login e Editar");
// Pedro cadastra o login da conta que ele criou em Gerenciar contas (e2e-2): "Conta nova do Pedro" •••33
await p.click("summary:has-text('Adicionar login')");
await p.fill("details.novo .campo:has-text('Nome') input", "Conta nova do Pedro");
await p.fill("details.novo .campo:has-text('CPF') input", "360.607.104-33");
await p.fill("details.novo .campo:has-text('Senha') input", "Pedro@2026");
await p.fill("details.novo .campo:has-text('E-mail') input", "pedro@exemplo.com");
await p.click("details.novo button:has-text('Cadastrar login')");
await p.waitForSelector("details.novo .msg.ok", { timeout: 15000 });
const novoLg = p.locator("#h-lg-okto + .lista .item:has(.conta-nome:has-text('Conta nova do Pedro'))");
await novoLg.waitFor({ timeout: 15000 });
checar(await novoLg.locator(".tag.sua:has-text('livre')").count() === 1, "o login novo do Pedro já aparece ligado à conta dele (livre)");
checar((await listarAdmin("okto_acessos")).some((d) => d.fields.nome.stringValue === "Conta nova do Pedro" && d.fields.atualizadoPor.stringValue === "Pedro"), "o login novo ficou assinado pelo Pedro");
await foto(p, "51b-logins-pedro-cadastrou");
await p.click(".okto-nav a:has-text('Contas')");
await p.waitForSelector(".okto .resumo");
await p.click("#h-livres + .lista .item:has(.conta-nome:has-text('Isolina•••91')) button:has-text('Pegar')");
await p.fill(".pegar input", "Cell Pedro");
await p.click(".pegar button:has-text('Confirmar')");
await p.waitForSelector("#h-comigo + .lista .login-conta", { timeout: 15000 });
const comigo = await p.textContent("#h-comigo + .lista .login-conta");
checar(comigo.includes("Login para entrar na Oktoplus") && comigo.includes(fmt(cpf.isolina)) && comigo.includes("agencia@exemplo.com"), "a conta que o Pedro pegou já mostra CPF, senha e e-mail");
await foto(p, "52-logins-com-voce");
// com a Isolina em uso, o Pedro não consegue desativar a conta em Gerenciar contas
await p.click(".okto-nav a:has-text('Gerenciar contas')");
await p.waitForSelector("#h-contas", { timeout: 15000 });
const isolinaEd = "details.edit:has(.conta-nome:has-text('Isolina•••91'))";
checar(await p.$eval(`${isolinaEd} input[type=checkbox]`, (i) => i.disabled), "Isolina em uso: o campo Conta ativa fica travado para o Pedro");
checar((await p.textContent(`${isolinaEd} label.chk`)).includes("em uso por Pedro"), "o campo diz que está em uso pelo Pedro");
await p.click(".okto-nav a:has-text('Contas')");
await p.waitForSelector("#h-comigo + .lista .login-conta", { timeout: 15000 });
await p.click("#h-comigo + .lista button:has-text('Devolver')");
await p.waitForFunction(() => document.querySelector("#h-comigo .cont")?.textContent.trim() === "0", null, { timeout: 15000 });
checar(p.erros.length === 0, "sem erros: " + p.erros.join(" | "));
await sair(p);

console.log("6. o histórico registra quem mexeu nos logins (sem senha)");
await entrar(p, "Samuel Rodrigues", pins.samuel);
await p.goto(BASE + "#/oktoplus/historico");
await p.waitForSelector("#h-reg", { timeout: 15000 });
await p.waitForTimeout(800);
const reg = await p.textContent(".registro");
checar(reg.includes("colou 11 logins da planilha") && reg.includes("editou o login de EHTL") && reg.includes("apagou o login de SEATSAERO"), "registro: colou, editou e apagou");
checar(reg.includes("Pedro cadastrou o login de Conta nova do Pedro"), "registro: o Pedro cadastrou o login");
checar(!reg.includes("Nova@2026") && !reg.includes("Teste123@"), "nenhuma senha no registro");
// celular
const m = await pagina(browser, { largura: 390, altura: 844 });
await entrar(m, "Samuel Rodrigues", pins.samuel);
await m.goto(BASE + "#/oktoplus/logins");
await m.waitForSelector("#h-lg-okto + .lista .item", { timeout: 15000 });
await m.waitForTimeout(400);
checar((await m.evaluate(() => document.documentElement.scrollWidth)) <= 390, "sem rolagem para o lado no celular");
await foto(m, "53-logins-celular");
checar(p.erros.length === 0 && m.erros.length === 0, "sem erros: " + [...p.erros, ...m.erros].join(" | "));
await browser.close();
console.log(totalFalhas() ? `${totalFalhas()} FALHA(S)` : "TUDO CERTO");
process.exit(totalFalhas() ? 1 : 0);
