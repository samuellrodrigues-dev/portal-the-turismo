// Trazer os dados do site antigo da Oktoplus e usar as contas (pegar, devolver, esgotou, histórico).
// Roda depois do e2e-1 (usa a equipe criada lá).
import fs from "node:fs";
import path from "node:path";
import { navegador, pagina, entrar, sair, foto, checar, totalFalhas, BASE, OUT, listarAdmin } from "./util.mjs";
import { pinsDoQuadro } from "./util.mjs";

const pins = JSON.parse(fs.readFileSync(path.join(OUT, "pins.json"), "utf8"));
// as contas esgotadas do arquivo de exemplo são de outubro de 2026: passam para o mês corrente,
// senão o teste quebra quando o mês vira (esgotada só vale no próprio mês)
const original = path.join(path.dirname(new URL(import.meta.url).pathname), "oktoplus-exportacao.json");
const hoje = new Date(), mesCorrente = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
const arquivo = path.join(OUT, "oktoplus-exportacao.json");
fs.writeFileSync(arquivo, fs.readFileSync(original, "utf8").replaceAll('"esgotada_mes": "2026-10"', `"esgotada_mes": "${mesCorrente}"`));
const browser = await navegador();
const p = await pagina(browser);

console.log("1. prévia da importação");
await entrar(p, "Samuel Rodrigues", pins.samuel);
await p.goto(BASE + "#/equipe");
await p.setInputFiles(".eq-arquivo input", arquivo);
await p.waitForSelector(".eq-previa", { timeout: 15000 });
const previa = await p.textContent(".eq-previa");
checar(/17\s*contas/.test(previa) && /4\s*usos/.test(previa) && /9\s*registros/.test(previa), "prévia com 17 contas, 4 usos e 9 registros");
checar(previa.includes("Samuel → Samuel Rodrigues") && previa.includes("Lívia → Lívia Pia") && previa.includes("Alan → Alan Ferreira") && previa.includes("João Pedro"), "liga quem já existe (Samuel, Lívia, Alan, João Pedro)");
checar(/Vão ganhar login e PIN novo: Pedro, Denise, Débora/.test(previa), "Pedro, Denise e Débora ganham login");
checar(previa.includes("1 que saíram"), "Bárbara (desativada) vai só para o histórico");
await foto(p, "10-importar-previa");

console.log("2. importa");
await p.click("button:has-text('Trazer os dados')");
await p.waitForSelector(".eq-resultado", { timeout: 60000 });
const res = await p.textContent(".eq-resultado");
checar(res.includes("Tudo conferido"), "conferência bateu");
checar((await p.textContent(".eq-resultado")).includes("PINs para entregar"), "o resultado aponta para o quadro de PINs");
// o que aconteceu de verdade: trocou de aba logo depois de importar
await p.click('.tt-aba[data-m="oktoplus"]');
await p.waitForSelector(".okto", { timeout: 15000 });
await p.click('.tt-aba[data-m="equipe"]');
await p.waitForSelector("text=Equipe e acessos");
const pinsNovos = await pinsDoQuadro(p);
checar(pinsNovos.length === 3, "trocou de aba e voltou: os 3 PINs da importação continuam no quadro");
checar(pinsNovos.length === 3 && pinsNovos.every(([, pin]) => /^\d{4}$/.test(pin)), "3 PINs novos de 4 números: " + pinsNovos.map((x) => x[0]).join(", "));
await foto(p, "11-importar-resultado");
const pessoas = await listarAdmin("pessoas");
checar(pessoas.length === 8, "8 pessoas no total (4 de antes + Pedro, Denise, Débora + Bárbara sem login): " + pessoas.length);
const nomes = pessoas.map((d) => d.fields.nome.stringValue).sort();
checar(!nomes.includes("Samuel") && !nomes.includes("Lívia"), "não duplicou Samuel nem Lívia");

console.log("3. painel do Oktoplus");
await p.goto(BASE + "#/oktoplus");
await p.waitForSelector(".okto .resumo", { timeout: 15000 });
const kpi = await p.$$eval(".okto .resumo .kpi b", (b) => b.map((x) => x.textContent.trim()));
checar(kpi.join(",") === "14,1,2", "14 livres, 1 em uso, 2 esgotadas: " + kpi.join(","));
const comOutros = await p.textContent("#h-uso + .lista");
checar(/com\s*Pedro/.test(comOutros) && comOutros.includes("Cell Pedro"), "a conta em uso aparece com o Pedro e o aparelho");
await foto(p, "12-oktoplus-painel");

console.log("4. histórico de outubro e setembro");
await p.goto(BASE + "#/oktoplus/historico/2026-10");
await p.waitForSelector("#h-usos", { timeout: 15000 });
await p.waitForTimeout(800);
const nUsos = (await p.textContent("#h-usos .cont")).trim();
checar(nUsos === "4", "4 usos em outubro (inclui o que atravessou o mês e o em andamento): " + nUsos);
const porPessoa = await p.textContent("#h-pp + .tabela-w");
checar(porPessoa.includes("Lívia Pia") && porPessoa.includes("Alan Ferreira") && porPessoa.includes("Denise"), "por pessoa com os nomes novos");
await foto(p, "13-oktoplus-historico");
await p.goto(BASE + "#/oktoplus/historico/2026-09");
await p.waitForTimeout(1200);
const nSet = (await p.textContent("#h-usos .cont")).trim();
checar(nSet === "1", "1 uso em setembro (o do Alan, que virou o mês): " + nSet);
const [csvDl] = await Promise.all([p.waitForEvent("download"), p.click("button:has-text('Baixar CSV')")]);
const csv = fs.readFileSync(await csvDl.path(), "utf8");
checar(csv.startsWith("﻿Conta;Final CPF;Quem usou") && csv.includes("Alan Ferreira"), "CSV com cabeçalho e o uso do Alan");
await sair(p);

console.log("5. Pedro usa as contas");
const pinPedro = pinsNovos.find(([n]) => n === "Pedro")[1];
await entrar(p, "Pedro", pinPedro);
await p.waitForSelector(".okto .resumo", { timeout: 15000 });
checar((await p.textContent("#h-comigo .cont")).trim() === "1", "Pedro vê a conta que estava com ele no site antigo");
await p.click("#h-comigo + .lista button:has-text('Devolver')");
await p.waitForFunction(() => document.querySelector("#h-comigo .cont")?.textContent.trim() === "0", null, { timeout: 15000 });
checar(true, "devolveu");
await p.click("#h-livres + .lista .item >> nth=0 >> button:has-text('Pegar')");
await p.fill(".pegar input", "Cell Pedro");
await p.click(".pegar button:has-text('Confirmar')");
await p.waitForFunction(() => document.querySelector("#h-comigo .cont")?.textContent.trim() === "1", null, { timeout: 15000 });
checar(true, "pegou outra conta");
await foto(p, "14-oktoplus-pedro");
await p.click("#h-comigo + .lista button:has-text('Esgotou')");
await p.click("#h-comigo + .lista button:has-text('Confirmar: esgotou?')");
await p.waitForFunction(() => document.querySelectorAll(".okto .resumo .kpi b")[2]?.textContent.trim() === "3", null, { timeout: 15000 });
checar(true, "marcou esgotada (3 esgotadas)");
// Gerenciar contas: liberado para toda a equipe da Oktoplus (sem Liberar a conta de outra pessoa)
await p.goto(BASE + "#/oktoplus/gerenciar");
await p.waitForSelector("#h-contas", { timeout: 15000 });
checar((await p.$$eval(".okto-nav a", (a) => a.map((x) => x.textContent))).join(",") === "Contas,Logins,Gerenciar contas", "Pedro vê Gerenciar contas no menu");
checar(!(await p.$(".okto .item-a button:has-text('Liberar')")), "Pedro não vê Liberar");
// conta em uso: quem não administra não desativa (desativar tiraria a conta de quem está usando)
const [travada, emUso] = await p.$$eval(".okto details.edit", (ds) => [
  ds.filter((d) => d.querySelector("input[type=checkbox]")?.disabled).length,
  ds.filter((d) => / com /.test(" " + d.querySelector(".det")?.textContent)).length,
]);
checar(travada === emUso, `contas em uso travadas para desativar: ${travada} de ${emUso}`);
await p.click("summary:has-text('Adicionar conta')");
await p.fill("details.novo input[placeholder='Nome da pessoa da conta']", "Conta nova do Pedro");
await p.fill("details.novo input[placeholder='Ex.: 75']", "33");
await p.click("details.novo button:has-text('Cadastrar conta')");
await p.waitForSelector("details.novo .msg.ok", { timeout: 15000 });
checar((await p.textContent("details.novo .msg.ok")).includes("Conta nova do Pedro cadastrada"), "Pedro cadastrou uma conta");
await p.waitForFunction(() => [...document.querySelectorAll(".okto .lista .item")].some((li) => li.textContent.includes("Conta nova do Pedro")), null, { timeout: 15000 });
checar(true, "a conta nova aparece na lista");
await foto(p, "14b-oktoplus-pedro-gerenciar");
await p.goto(BASE + "#/oktoplus");
await p.waitForSelector(".okto .resumo", { timeout: 15000 });
const abasP = await p.$$eval(".tt-aba", (els) => els.map((e) => e.textContent.trim()));
checar(abasP.join(",") === "Oktoplus,Passagens,Milhas" && !(await p.$("text=Histórico")), "Pedro vê Oktoplus e as promoções, e não vê o histórico: " + abasP.join(","));
checar(p.erros.length === 0, "sem erros: " + p.erros.join(" | "));
await sair(p);

console.log("6. o histórico registrou tudo");
await entrar(p, "Samuel Rodrigues", pins.samuel);
await p.goto(BASE + "#/oktoplus/historico");
await p.waitForSelector("#h-reg", { timeout: 15000 });
await p.waitForTimeout(1000);
const reg = await p.textContent(".registro");
checar(reg.includes("Pedro devolveu") && reg.includes("Pedro pegou") && /Pedro marcou .* como esgotada/.test(reg) && reg.includes("trouxe os dados do site antigo"), "registro com devolveu, pegou, esgotou e a importação");
checar(reg.includes("Pedro cadastrou a conta Conta nova do Pedro"), "registro mostra a conta que o Pedro cadastrou");
fs.writeFileSync(path.join(OUT, "pins2.json"), JSON.stringify(Object.fromEntries(pinsNovos)));
checar(p.erros.length === 0, "sem erros: " + p.erros.join(" | "));
await browser.close();
console.log(totalFalhas() ? `${totalFalhas()} FALHA(S)` : "TUDO CERTO");
process.exit(totalFalhas() ? 1 : 0);
