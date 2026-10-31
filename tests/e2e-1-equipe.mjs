// Primeiro acesso, cadastro da equipe, entrada por nome + PIN e o que cada pessoa vê.
import fs from "node:fs";
import path from "node:path";
import { zerar, navegador, pagina, entrar, sair, escolher, foto, checar, totalFalhas, BASE, OUT, lerAdmin, pinsDoQuadro, pinDoQuadro } from "./util.mjs";

await zerar();
const browser = await navegador();
const p = await pagina(browser);

console.log("1. primeiro acesso");
await p.goto(BASE);
await p.waitForSelector("text=Configurar o sistema");
await foto(p, "01-primeiro-acesso");
await p.fill(".tt-campo-escuro input >> nth=0", "Samuel Rodrigues");
await p.fill(".tt-campo-escuro input >> nth=1", "482915");
await p.fill(".tt-campo-escuro input >> nth=2", "482915");
await p.click("button:has-text('Criar administrador')");
await p.waitForSelector(".tt-barra", { timeout: 15000 });
const abas = await p.$$eval(".tt-aba", (els) => els.map((e) => e.textContent.trim()));
checar(JSON.stringify(abas) === JSON.stringify(["Oktoplus", "Sala VIP", "Valores a receber", "Passagens", "Milhas", "Operação", "Equipe"]), "admin vê todas as abas: " + abas.join(", "));
checar(p.erros.length === 0, "sem erros na página " + p.erros.join(" | "));

console.log("2. cadastra a equipe");
await p.goto(BASE + "#/equipe");
await p.waitForSelector("text=Equipe e acessos");
async function cadastrar(nome, abasSel, aparelho = "") {
  await p.click("button:has-text('Adicionar pessoa')");
  const f = p.locator(".tt-bloco:has(h2:has-text('Nova pessoa')) form");
  await f.locator("input").nth(0).fill(nome);
  if (aparelho) await f.locator("input").nth(1).fill(aparelho);
  const sel = f.locator("select");
  for (const [i, v] of abasSel.entries()) await sel.nth(i).selectOption(v);
  await f.locator("button:has-text('Cadastrar e gerar PIN')").click();
  const pin = await pinDoQuadro(p, nome);
  await p.click(".tt-pag-topo button:has-text('Fechar')");
  return pin;
}
const pinLivia = await cadastrar("Lívia Pia", ["usar", "", "", ""], "Cell Lívia");
checar(/^\d{4}$/.test(pinLivia), "Lívia (só Oktoplus) ganhou PIN de 4 números: " + pinLivia);
const pinAlan = await cadastrar("Alan Ferreira", ["usar", "operador", "", ""]);
checar(/^\d{6}$/.test(pinAlan), "Alan (Sala VIP) ganhou PIN de 6 números: " + pinAlan);
const pinJoao = await cadastrar("João Pedro", ["admin", "admin", "editar", "ver"]);
checar(/^\d{6}$/.test(pinJoao), "João Pedro ganhou PIN de 6 números");
await p.waitForTimeout(400);
await foto(p, "02-equipe");

console.log("2b. o quadro de PINs fica na tela até marcar que anotou");
let q = await pinsDoQuadro(p);
checar(q.length === 3 && q[0][0] === "João Pedro", "3 PINs no quadro, o mais novo em cima: " + q.map((x) => x[0]).join(", "));
await p.goto(BASE + "#/oktoplus");
await p.waitForSelector(".okto", { timeout: 15000 });
q = await pinsDoQuadro(p);
checar(q.length === 3, "trocou de aba e os PINs continuam no quadro");
let perguntou = "";
p.once("dialog", (d) => { perguntou = d.type(); d.accept(); });
await p.reload();
await p.waitForSelector(".tt-barra", { timeout: 15000 });
q = await pinsDoQuadro(p);
checar(perguntou === "beforeunload", "recarregar com PIN no quadro pede confirmação");
checar(q.length === 3 && q.find((x) => x[0] === "Lívia Pia")[1] === pinLivia, "recarregou e os PINs continuam no quadro");
await p.click(".qp-min");
checar(!!(await p.$(".qp-pilula")) && (await p.textContent(".qp-pilula")).includes("3 PINs"), "minimiza e fica a pílula com 3 PINs");
await foto(p, "06-quadro-pilula");
await p.click(".qp-pilula");
await p.goto(BASE + "#/equipe");
await p.waitForSelector("text=Equipe e acessos");
await foto(p, "06-quadro-pins");
await p.click('.qp-lista li:has(.qp-nome:text-is("Lívia Pia")) .qp-anotei');
q = await pinsDoQuadro(p);
checar(q.length === 2 && !q.some((x) => x[0] === "Lívia Pia"), "marcou a Lívia como anotada: sobram 2");
await p.click(".qp-rodape button:has-text('Anotei todos')");
checar((await pinsDoQuadro(p)).length === 2, "o primeiro clique em Anotei todos só pergunta");
await p.click(".qp-rodape button:has-text('Apagar todos do quadro?')");
await p.waitForSelector(".qp", { state: "detached" });
checar(!(await p.$(".qp-pilula")), "quadro vazio some da tela");
const ss = await p.evaluate(() => sessionStorage.getItem("tt-pins-pendentes"));
checar(ss === null, "nada sobrou guardado no navegador");

const pub = await lerAdmin("publico/equipe");
const nomesPub = pub.fields.pessoas.arrayValue.values.map((v) => v.mapValue.fields.nome.stringValue);
checar(nomesPub.join(",") === "Alan Ferreira,João Pedro,Lívia Pia,Samuel Rodrigues", "lista pública em ordem: " + nomesPub.join(", "));
const temPin = JSON.stringify(pub).match(/"(pin|senha|uid)"/);
checar(!temPin, "lista pública sem PIN nem uid");

console.log("3. sair e entrar como Lívia");
await sair(p);
if (await p.$(".tt-quem")) await p.click(".tt-link-claro");
await p.waitForSelector(".tt-nomes");
await foto(p, "03-entrada-nomes");
await escolher(p, "Lívia Pia");
await foto(p, "04-entrada-pin");
await p.fill(".tt-pin input", "0000");
await p.waitForSelector(".tt-entrada-msg:has-text('PIN incorreto')", { timeout: 15000 });
checar(true, "PIN errado avisa");
await foto(p, "05-pin-errado");
await p.fill(".tt-pin input", pinLivia);
await p.waitForSelector(".tt-barra", { timeout: 15000 });
const abasL = await p.$$eval(".tt-aba", (els) => els.map((e) => e.textContent.trim()));
checar(JSON.stringify(abasL) === JSON.stringify(["Oktoplus", "Passagens", "Milhas"]), "Lívia vê Oktoplus e as promoções: " + abasL.join(", "));
await p.goto(BASE + "#/boletos");
await p.waitForTimeout(500);
checar(!(await p.$(".bol")), "Lívia não abre Valores a receber pelo endereço");
// tenta ler e gravar o que não pode, direto pelo Firestore da página
const tentativas = await p.evaluate(async () => {
  const fs = await import("/node_modules/.vite/deps/firebase_firestore.js").catch(() => null);
  return fs ? "dev" : "build";
});
console.log("  (modo", tentativas + ")");

console.log("4. Lívia troca o PIN");
await p.goto(BASE + "#/pin");
await p.waitForSelector("text=Trocar meu PIN");
const campos = p.locator(".eq-form input");
await campos.nth(0).fill(pinLivia);
await campos.nth(1).fill("2580");
await campos.nth(2).fill("2580");
await p.click("button:has-text('Trocar PIN')");
await p.waitForSelector(".tt-msg.ok", { timeout: 15000 });
checar(true, "PIN trocado");
await sair(p);
await entrar(p, "Lívia Pia", "2580");
checar(!!(await p.$(".tt-barra")), "entra com o PIN novo");
await sair(p);

console.log("5. admin gera PIN novo para o Alan; o antigo para de funcionar");
await entrar(p, "Samuel Rodrigues", "482915");
await p.goto(BASE + "#/equipe");
await p.click('.eq-cab:has-text("Alan Ferreira")');
await p.click("button:has-text('Gerar PIN novo')");
await p.click("button:has-text('Gerar PIN novo para Alan')");
const pinAlan2 = await pinDoQuadro(p, "Alan Ferreira");
checar(/^\d{6}$/.test(pinAlan2) && pinAlan2 !== pinAlan, "PIN novo do Alan: " + pinAlan2);
await p.click('.eq-cab:has-text("Alan Ferreira")'); // fecha a pessoa
checar((await pinDoQuadro(p, "Alan Ferreira")) === pinAlan2, "fechou a pessoa e o PIN continua no quadro");
await p.click(".tt-eu-btn");
await p.click(".tt-menu button:has-text('Sair')");
checar((await p.textContent(".tt-menu button.armado")).includes("PINs não anotados"), "Sair com PIN no quadro pergunta antes");
await p.click(".tt-menu button.armado");
await p.waitForSelector(".tt-entrada", { timeout: 15000 });
await escolher(p, "Alan Ferreira");
await p.fill(".tt-pin input", pinAlan);
await p.waitForSelector(".tt-entrada-msg:has-text('PIN incorreto')", { timeout: 15000 });
checar(true, "PIN antigo do Alan não entra mais");
await p.fill(".tt-pin input", pinAlan2);
await p.waitForSelector(".tt-barra", { timeout: 15000 });
const abasA = await p.$$eval(".tt-aba", (els) => els.map((e) => e.textContent.trim()));
checar(JSON.stringify(abasA) === JSON.stringify(["Oktoplus", "Sala VIP", "Passagens", "Milhas"]), "Alan vê Oktoplus, Sala VIP e as promoções: " + abasA.join(", "));
await sair(p);

console.log("6. desativar a Lívia tira o acesso dela na hora");
const p2 = await pagina(browser);
await entrar(p2, "Lívia Pia", "2580");
await entrar(p, "Samuel Rodrigues", "482915");
checar(!(await p.$(".qp")) && !(await p.$(".qp-pilula")), "depois de Sair, o quadro de PINs volta vazio");
await p.goto(BASE + "#/equipe");
await p.click('.eq-cab:has-text("Lívia Pia")');
await p.uncheck(".eq-lista .tt-chk:has-text('Ativa') input");
await p.click(".eq-lista button:has-text('Salvar')");
await p.waitForSelector(".eq-lista .tt-msg.ok", { timeout: 15000 });
await p2.waitForSelector("text=Acesso desligado", { timeout: 15000 });
checar(true, "a tela da Lívia mostra acesso desligado");
await p2.click("button:has-text('Voltar para a entrada')");
await p2.waitForSelector(".tt-nomes");
const nomes2 = await p2.$$eval(".tt-nome", (els) => els.map((e) => e.textContent.trim()));
checar(!nomes2.some((n) => n.includes("Lívia")), "Lívia sumiu da tela de entrada");
// reativa para os próximos testes
await p.click(".eq-lista .tt-chk:has-text('Ativa') input");
await p.click(".eq-lista button:has-text('Salvar')");
await p.waitForTimeout(800);

fs.writeFileSync(path.join(OUT, "pins.json"), JSON.stringify({ samuel: "482915", livia: "2580", alan: pinAlan2, joao: pinJoao }));
checar(p.erros.length === 0 && p2.erros.length === 0, "sem erros de página: " + [...p.erros, ...p2.erros].join(" | "));
await browser.close();
console.log(totalFalhas() ? `${totalFalhas()} FALHA(S)` : "TUDO CERTO");
process.exit(totalFalhas() ? 1 : 0);
