// Promoções: o robô lê feeds de exemplo, grava no banco, e as abas Passagens e Milhas mostram tudo.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { navegador, pagina, entrar, foto, checar, totalFalhas, BASE, OUT, listarAdmin, gravarAdmin } from "./util.mjs";
import { subirServidor, ATE } from "./promo-servidor.mjs";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const pins = JSON.parse(fs.readFileSync(path.join(OUT, "pins.json"), "utf8"));
for (const x of await listarAdmin("promocoes")) await fetch("http://127.0.0.1:8080/v1/" + x.name, { method: "DELETE", headers: { Authorization: "Bearer owner" } });

const srv = await subirServidor();
const robo = (extra = []) => new Promise((ok) => {
  let saida = "";
  const p = spawn("node", ["robo/promocoes.mjs", ...extra], {
    cwd: RAIZ, env: {
      ...process.env, PROMO_FONTES: srv.fontes, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_PROJECT: "demo-portal",
      SERPAPI_KEY: "teste", SERPAPI_URL: srv.base + "/serp", TRAVELPAYOUTS_TOKEN: "teste", TRAVELPAYOUTS_URL: srv.base + "/tp",
    },
  });
  p.stdout.on("data", (d) => { saida += d; }); p.stderr.on("data", (d) => { saida += d; });
  p.on("close", (c) => ok({ c, saida }));
});

const browser = await navegador();
const p = await pagina(browser);
await p.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:4173" });

console.log("1. abas novas, antes do robô");
await entrar(p, "Samuel Rodrigues", pins.samuel);
const abas = await p.$$eval(".tt-aba", (els) => els.map((e) => e.getAttribute("data-m")));
checar(abas.join() === "oktoplus,salavip,boletos,passagens,milhas,operacao,equipe", "ordem das abas: " + abas.join(", "));
await p.goto(BASE + "#/passagens");
await p.waitForSelector(".pro-vazio:has-text('Aguardando o robô')", { timeout: 15000 });
checar(true, "sem dados: aguardando o robô (com o passo a passo para o administrador)");
await p.goto(BASE + "#/oktoplus");
await p.waitForSelector(".okto", { timeout: 15000 });

console.log("2. o robô roda");
// uma notícia que ficou de uma leitura antiga: o filtro novo tem que tirar
await gravarAdmin("promocoes/passagens", { atualizadoEm: new Date(Date.now() - 3 * 36e5), fontes: [], versao: 1, itens: [{
  id: "antiga1", titulo: "Aeroporto de Teresina espera alta de 33% no fluxo de passageiros", resumo: "", link: "https://exemplo.test/aeroporto",
  fonte: "Cidade Verde", fonteId: "gn-teresina", em: new Date(Date.now() - 5 * 36e5), visto: new Date(Date.now() - 5 * 36e5), tipo: "passagens", categoria: "noticia",
  preco: null, milhas: null, bonus: null, desconto: null, milheiro: null, cias: [], programas: [], bancos: [], destinos: [], origens: ["Teresina"], iatas: [], iatasOrigem: ["THE"],
  internacional: false, nacional: false, teresina: true, variasCidades: false, idaVolta: null, selos: [], ate: null, chave: "x", outras: [],
}] });
let r = await robo();
checar(r.c === 0, "robô terminou sem erro");
checar(/6 de 7 fontes responderam/.test(r.saida), "6 de 7 fontes (uma fora do ar)");
checar(/feed achado em .*descoberto\.xml/.test(r.saida), "achou sozinho o feed de um site");
checar(/gravado promocoes\/passagens: 6 promoções \(6 novas, 1 fora do filtro saíram\)/.test(r.saida) && /gravado promocoes\/milhas: 5 promoções \(5 novas\)/.test(r.saida), "6 de passagens e 5 de milhas; a notícia antiga saiu: " + (r.saida.match(/gravado promocoes\/passagens[^\n]*/) || [""])[0]);
checar(/radar Google Voos: 6 de 7 rotas/.test(r.saida) && /radar Aviasales: 3 destinos/.test(r.saida), "radar: 6 rotas do Google e 3 da Aviasales");
r = await robo();
checar(/promocoes\/passagens: 6 promoções \(0 novas\)/.test(r.saida) && /promocoes\/milhas: 5 promoções \(0 novas\)/.test(r.saida), "rodando de novo não repete nada");
checar(!/radar Google Voos/.test(r.saida), "Google Voos só uma vez por dia (plano grátis)");
const teste = await robo(["--testar"]);
checar(teste.c === 0 && /TESTE \(não grava\)/.test(teste.saida) && /milheiro R\$ 15.46 · Smiles\/Livelo/.test(teste.saida), "modo --testar mostra o que achou sem gravar");

console.log("3. Passagens: painel");
await p.goto(BASE + "#/oktoplus");
await p.waitForSelector('.tt-aba[data-m="passagens"] .selo', { timeout: 15000 });
checar((await p.textContent('.tt-aba[data-m="passagens"] .selo')).trim() === "6", "selo: 6 promoções novas em Passagens");
await p.click('.tt-aba[data-m="passagens"]');
await p.waitForSelector(".pas-voo", { timeout: 15000 });
await p.waitForTimeout(500);
const status = await p.textContent(".pas-status");
checar(/Atualizado agora · 4 de 5 fontes no ar · 6 promoções em 7 dias/.test(status), "linha de status: " + status.trim());
const placas = await p.$$eval(".pas-placas b", (b) => b.map((x) => x.textContent.trim()));
checar(placas.join(" | ") === "2 | 2 | R$ 289 | R$ 1.153", "placas (Teresina, acabam logo, menor nacional, menor internacional): " + placas.join(" | "));
const dest = await p.$$eval(".pas-embarque", (els) => els.map((e) => e.querySelector(".rotulo").textContent.replace(/nova$/i, "").trim() + " = " + e.querySelector(".canhoto b").textContent.trim()));
checar(dest.join(" ; ") === "Saindo de Teresina = R$ 3.279 ; Menor preço nacional = R$ 289 ; Menor preço internacional = R$ 1.153 ; Corra: acaba logo = R$ 2.499", "destaques: " + dest.join(" ; "));
const rotas = await p.$$eval(".pas-rota", (els) => els.map((e) => e.querySelector(".nome").textContent + " " + e.querySelector(".valor").textContent));
checar(rotas.length === 6 && rotas[0] === "São Paulo R$ 812", "radar Google: 6 rotas, São Paulo R$ 812: " + rotas.join(", "));
checar((await p.textContent(".pas-rota.nivel-baixo .nivel")).trim() === "Preço baixo" && (await p.textContent(".pas-rota.nivel-baixo .faixa")).includes("normal R$ 853–1.299"), "nível e faixa normal do Google");
const codigos = await p.$$eval(".pas-embarque .rota", (els) => els.map((e) => [...e.querySelectorAll(".cod")].map((c) => c.textContent).join("-")));
checar(codigos.join(" ") === "THE-LIS SAO-BR ···-BUE ···-ORL", "códigos dos cartões de embarque: " + codigos.join(" "));
checar((await p.$$(".pas-avia li")).length === 3 && (await p.textContent(".pas-avia li:first-child")).includes("Brasília"), "Aviasales: 3 destinos, o mais barato primeiro");
const linhas = await p.$$eval(".pas-voo", (els) => els.length);
checar(linhas === 6, "6 linhas no painel (sem notícias, pacotes nem seleções sem preço)");
const titulos = await p.$$eval(".pas-voo .tit", (els) => els.map((e) => e.textContent).join(" | "));
checar(!/Aeroporto|presa|Preço médio|Pacotes|Ofertas no ar|anuncia novo voo/.test(titulos), "notícias e pacotes ficaram de fora");
const dias = await p.$$eval(".pas-dia h2", (h) => h.map((x) => x.childNodes[0].textContent));
checar(dias[0] === "Hoje", "agrupado por dia: " + dias.join(", "));
const sojeLinha = p.locator('.pas-voo:has-text("Promoção da Latam")');
checar((await sojeLinha.locator(".estado").textContent()).trim() === "Só hoje", "situação Só hoje");
checar((await sojeLinha.locator(".dest b").textContent()).trim() === "Voos nacionais", "sem destino no título: 'Voos nacionais'");
checar((await p.locator('.pas-voo:has-text("Portugal com bons")').locator(".orig").textContent()).includes("Teresina"), "Portugal: marca Teresina (do resumo)");
await foto(p, "70-passagens");

console.log("4. abrir uma linha, copiar, filtros");
await sojeLinha.locator(".pas-voo-linha").click();
await p.waitForSelector(".pas-voo-detalhe");
checar((await p.textContent(".pas-voo-detalhe")).includes("A Latam abriu uma promoção"), "detalhe com o resumo");
checar(await p.$eval(".pas-voo-detalhe a.pri", (a) => a.href === "https://www.melhoresdestinos.com.br/promocao/passagens-aereas-nacionais-29-10-26"), "link para a promoção");
await p.click(".pas-voo-detalhe button:has-text('Copiar para o WhatsApp')");
const copiado = await p.evaluate(() => navigator.clipboard.readText());
checar(copiado.startsWith("✈️ Só hoje! Promoção da Latam") && (copiado.match(/R\$ 289/g) || []).length === 1 && copiado.includes("LATAM · saindo de São Paulo, Brasília, Fortaleza") && copiado.includes("⏰ Só hoje") && copiado.includes("Sujeito a disponibilidade"), "texto do WhatsApp: " + copiado.replace(/\n/g, " / "));
await foto(p, "71-passagens-detalhe");
await p.click(".pro-chips button:has-text('Teresina')");
checar((await p.$$(".pas-voo")).length === 2, "filtro Teresina: 2");
await p.click(".pro-chips button:has-text('Todas')");
await p.selectOption(".pro-barra select", "preco");
checar((await p.textContent(".pas-voo .preco b")).trim() === "R$ 289", "menor preço primeiro");
await p.fill(".pro-busca input", "orlando");
checar((await p.$$(".pas-voo")).length === 1, "busca 'orlando': 1");
await p.fill(".pro-busca input", "");
await p.click(".pro-fontes summary");
checar((await p.textContent(".pro-fontes li.ruim")).includes("Site fora do ar") && (await p.textContent(".pro-fontes li.ruim")).includes("HTTP 500"), "fonte fora do ar aparece com o erro");
checar((await p.textContent(".pro-fontes")).includes("feed achado sozinho"), "mostra o feed achado sozinho");

console.log("5. Milhas");
await p.click('.tt-aba[data-m="milhas"]');
await p.waitForSelector(".mil-cartao", { timeout: 15000 });
await p.waitForTimeout(400);
checar(!(await p.$('.tt-aba[data-m="passagens"] .selo')), "selo de Passagens some depois da visita");
const rec = await p.$$eval(".mil-recorde", (els) => els.map((e) => e.querySelector("small").textContent + " = " + e.querySelector("b").textContent + " (" + e.querySelector("span").textContent + ")"));
checar(rec[0] === "Milheiro mais barato = R$ 15,46 (Livelo → Smiles)" && rec[1] === "Maior desconto na compra = 75% (Smiles)" && rec[2].startsWith("Ofertas valendo agora = 5"), "recordes: " + rec.join(" ; "));
checar((await p.textContent(".mil-topo h1")).trim() === "Compra de milhas", "título Compra de milhas");
const cartoes = await p.$$eval(".mil-cartao h3", (h) => h.map((x) => x.textContent));
checar(cartoes.length === 5, "5 ofertas de compra: " + cartoes.length);
checar(!cartoes.some((t) => /AAdvantage|80% de bônus|Esfera dá|mil milhas o trecho|Clube Smiles/.test(t)), "fora: programa estrangeiro, bônus de transferência, resgate e clube");
checar((await p.textContent('.mil-cartao:has-text("Latam Pass: compre pontos") .situ')).trim() === "Até " + ATE, "prazo 'até " + ATE + "' lido do título");
checar((await p.textContent('.mil-cartao:has-text("Livelo: compre pontos") .situ')).trim() === "Só hoje", "Livelo: só hoje");
checar((await p.textContent('.mil-cartao:has-text("milheiro a partir") .num')).includes("R$ 15,46o milheiro"), "milheiro em destaque no cartão");
await p.click('.mil-progs button:has-text("Smiles")');
checar((await p.$$(".mil-cartao")).length === 2, "filtro Smiles: 2 cartões");
await p.click('.mil-progs button:has-text("Todos")');
await p.selectOption(".pro-barra select", "desconto");
checar((await p.textContent(".mil-cartao .num b")).trim() === "75%", "ordem: maior desconto primeiro");
await foto(p, "72-milhas");
checar(p.erros.length === 0, "sem erros: " + p.erros.join(" | "));

console.log("6. quem só usa a Oktoplus também vê as promoções");
const l = await pagina(browser);
await entrar(l, "Lívia Pia", pins.livia);
const abasL = await l.$$eval(".tt-aba", (els) => els.map((e) => e.getAttribute("data-m")));
checar(abasL.join() === "oktoplus,passagens,milhas", "Lívia: " + abasL.join(", "));
await l.goto(BASE + "#/milhas");
await l.waitForSelector(".mil-cartao", { timeout: 15000 });
checar(true, "Lívia lê as milhas");

console.log("7. celular e modo escuro");
const m = await pagina(browser, { largura: 390, altura: 844 });
await entrar(m, "Samuel Rodrigues", pins.samuel);
await m.goto(BASE + "#/passagens");
await m.waitForSelector(".pas-voo", { timeout: 15000 });
await m.locator(".pas-voo").first().locator(".pas-voo-linha").click();
await m.waitForTimeout(400);
await foto(m, "73-passagens-celular");
checar((await m.evaluate(() => document.documentElement.scrollWidth)) <= 390, "Passagens sem rolagem para o lado no celular");
await m.goto(BASE + "#/milhas");
await m.waitForSelector(".mil-cartao", { timeout: 15000 });
await m.waitForTimeout(400);
await foto(m, "74-milhas-celular");
checar((await m.evaluate(() => document.documentElement.scrollWidth)) <= 390, "Milhas sem rolagem para o lado no celular");
const e = await pagina(browser, { escuro: true });
await entrar(e, "Samuel Rodrigues", pins.samuel);
await e.goto(BASE + "#/passagens");
await e.waitForSelector(".pas-voo", { timeout: 15000 });
await e.waitForTimeout(500);
await foto(e, "75-passagens-escuro");
await e.goto(BASE + "#/milhas");
await e.waitForSelector(".mil-cartao", { timeout: 15000 });
await e.waitForTimeout(500);
await foto(e, "76-milhas-escuro");
checar(m.erros.length === 0 && e.erros.length === 0 && l.erros.length === 0, "sem erros: " + [...m.erros, ...e.erros, ...l.erros].join(" | "));

await browser.close();
await srv.fechar();
console.log(totalFalhas() ? `${totalFalhas()} FALHA(S)` : "TUDO CERTO");
process.exit(totalFalhas() ? 1 : 0);
