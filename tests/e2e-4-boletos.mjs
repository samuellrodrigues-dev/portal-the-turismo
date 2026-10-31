// Boletos: cadastrar pela linha digitável e pelo PDF, avisos de vencimento, pagar com comprovante, anexos.
import fs from "node:fs";
import path from "node:path";
import { navegador, pagina, entrar, sair, foto, checar, totalFalhas, BASE, OUT, listarAdmin } from "./util.mjs";

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const pins = JSON.parse(fs.readFileSync(path.join(OUT, "pins.json"), "utf8"));
const B = JSON.parse(fs.readFileSync(path.join(AQUI, "boletos.json"), "utf8"));
const browser = await navegador();
const p = await pagina(browser);
await p.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:4173" });

console.log("1. céu limpo");
await entrar(p, "Samuel Rodrigues", pins.samuel);
await p.goto(BASE + "#/boletos/pagar");
await p.waitForSelector(".bol-vazio.ceu-limpo", { timeout: 15000 });
checar(true, "sem boletos: céu limpo");
await foto(p, "30-boletos-vazio");

async function novo({ linha, descricao, beneficiario = "", categoria = "", valor = "", venc = "" }) {
  await p.click(".bol-btn.novo");
  const d = p.locator("dialog.bol-dlg[open]");
  await d.waitFor();
  if (linha) {
    await d.locator("input.mono").click();
    await p.evaluate((t) => navigator.clipboard.writeText(t), linha);
    await p.keyboard.press("Control+V");
    await p.waitForTimeout(200);
  }
  await d.locator(".bol-campo:has-text('O que é') input").fill(descricao);
  if (beneficiario) await d.locator(".bol-campo:has-text('Quem recebe') input").fill(beneficiario);
  if (categoria) await d.locator(".bol-campo:has-text('Categoria') input").fill(categoria);
  if (valor) await d.locator(".bol-campo:has-text('Valor') input").fill(valor);
  if (venc) await d.locator(".bol-campo:has-text('Vencimento') input").fill(venc);
  return d;
}

console.log("2. cadastra colando a linha digitável");
let d = await novo({ linha: B.a.formatada, descricao: "Aluguel da sala", beneficiario: "Imobiliária Central", categoria: "Aluguel" });
const lido = await d.locator(".bol-lido").textContent();
checar(lido.includes("Linha conferida") && lido.includes("Itaú") && lido.includes("2.450,00"), "linha conferida: " + lido.trim());
checar((await d.locator(".bol-campo:has-text('Valor') input").inputValue()) === "R$ 2.450,00", "valor preenchido sozinho");
checar((await d.locator(".bol-campo:has-text('Vencimento') input").inputValue()) === B.a.vencimento, "vencimento preenchido sozinho: " + B.a.vencimento);
await foto(p, "31-boletos-novo-linha");
await d.locator("button:has-text('Salvar boleto')").click();
await p.waitForSelector("dialog.bol-dlg[open]", { state: "detached", timeout: 15000 }).catch(() => {});
await p.waitForSelector('.nuvem:has-text("Aluguel da sala")', { timeout: 15000 });
checar(true, "aluguel na lista");

console.log("3. cadastra pelo PDF do boleto");
await p.click(".bol-btn.novo");
d = p.locator("dialog.bol-dlg[open]");
await d.locator("input[type=file][accept='application/pdf']").setInputFiles(path.join(AQUI, "boleto-internet.pdf"));
await p.waitForFunction(() => { const n = document.querySelector("dialog.bol-dlg[open] .bol-nota"); return n && !n.textContent.startsWith("Lendo"); }, null, { timeout: 30000 });
const nota = await d.locator(".bol-nota").textContent();
checar(nota.startsWith("PDF lido"), "PDF lido: " + nota.trim());
checar((await d.locator("input.mono").inputValue()) === B.b.formatada, "linha tirada do PDF");
checar((await d.locator(".bol-campo:has-text('Valor') input").inputValue()) === "R$ 199,90", "valor do PDF");
checar((await d.locator(".bol-campo:has-text('Vencimento') input").inputValue()) === B.b.vencimento, "vencimento do PDF");
const benef = await d.locator(".bol-campo:has-text('Quem recebe') input").inputValue();
checar(benef === "NET Fibra Teresina LTDA", "beneficiário do PDF: " + benef);
checar((await d.locator(".bol-anexos").textContent()).includes("boleto-internet.pdf"), "PDF vai como anexo");
await d.locator(".bol-campo:has-text('O que é') input").fill("Internet da agência");
await d.locator(".bol-campo:has-text('Categoria') input").fill("Internet e telefone");
await foto(p, "32-boletos-novo-pdf");
await d.locator("button:has-text('Salvar boleto')").click();
await p.waitForSelector('.nuvem:has-text("Internet da agência") .anexo', { timeout: 20000 });
checar(true, "internet na lista com o anexo");

console.log("4. um atrasado e um que vence hoje");
d = await novo({ linha: B.c.formatada, descricao: "Contador", beneficiario: "Escritório Contábil", categoria: "Fornecedor" });
await d.locator("button:has-text('Salvar boleto')").click();
await p.waitForSelector('.nuvem:has-text("Contador")', { timeout: 15000 });
d = await novo({ linha: B.d.formatada, descricao: "Energia da loja", categoria: "Energia" });
await d.locator("button:has-text('Salvar boleto')").click();
await p.waitForSelector('.nuvem:has-text("Energia da loja")', { timeout: 15000 });
// um sem linha (preenchido à mão) com valor inválido primeiro
d = await novo({ descricao: "Sistema Volly", valor: "abc", venc: B.a.vencimento });
await d.locator("button:has-text('Salvar boleto')").click();
checar((await d.locator(".bol-erro").textContent()).includes("valor não ficou claro"), "valor inválido avisa");
await d.locator(".bol-campo:has-text('Valor') input").fill("389,9");
await d.locator("button:has-text('Salvar boleto')").click();
await p.waitForSelector('.nuvem:has-text("Sistema Volly")', { timeout: 15000 });
await p.waitForTimeout(500);
const prev = await p.$$eval(".bol-previsao .prev b", (b) => b.map((x) => x.textContent.trim()));
checar(prev.join(",") === "1,1,1,0", "previsão: 1 atrasado, 1 hoje, 1 nos 7 dias, 0 pagos: " + prev.join(","));
const grupos = await p.$$eval(".bol-grupo h2", (h) => h.map((x) => x.textContent.trim()));
checar(grupos.join(",") === "Atrasados,Vencem hoje,Próximos 7 dias,Mais adiante", "grupos em ordem: " + grupos.join(", "));
const selo = (await p.textContent('.tt-aba[data-m="boletos"] .selo')).trim();
checar(selo === "2", "selo da aba Valores a receber: 2 (boleto atrasado + hoje)");
checar((await p.textContent(".nuvem.clima-tempestade .quando")).trim() === "atrasado há 2 dias", "atrasado há 2 dias");
await foto(p, "33-boletos-lista");

console.log("5. copiar a linha digitável");
await p.click('.nuvem:has-text("Aluguel da sala") .nuvem-linha');
const copiado = await p.evaluate(() => navigator.clipboard.readText());
checar(copiado === B.a.linha, "copiou só os números da linha (47)");

console.log("6. pagar com comprovante (foto grande é reduzida)");
await p.click('.nuvem:has-text("Contador") button:has-text("Marcar como pago")');
d = p.locator("dialog.bol-dlg[open]");
await d.locator("input[type=file]").setInputFiles(path.join(AQUI, "comprovante.jpg"));
await d.locator("button:has-text('Confirmar pagamento')").click();
await p.waitForSelector('.nuvem.clima-tempestade:has-text("Contador")', { state: "detached", timeout: 20000 });
checar(true, "saiu dos atrasados");
await p.click(".bol-abas button:has-text('Pagos')");
await p.waitForSelector('.nuvem.clima-sol:has-text("Contador") .anexo.comprovante', { timeout: 15000 });
checar(true, "aparece em Pagos, com o comprovante");
const arqs = await listarAdmin("arquivos");
const comp = arqs.find((a) => a.fields.papel.stringValue === "comprovante");
checar(comp && Number(comp.fields.bytes.integerValue) < 459414, "comprovante reduzido: " + (comp && comp.fields.bytes.integerValue) + " bytes");
const [popup] = await Promise.all([p.waitForEvent("popup"), p.click('.nuvem:has-text("Contador") .anexo.comprovante')]);
await popup.waitForLoadState().catch(() => {});
await popup.waitForTimeout(800);
checar(popup.url().startsWith("blob:"), "abre o comprovante: " + popup.url().slice(0, 30));
await popup.close();
await foto(p, "34-boletos-pagos");
await p.click(".bol-abas button:has-text('Em aberto')");

console.log("7. repetir no mês seguinte e excluir");
await p.click('.nuvem:has-text("Aluguel da sala") .bol-icone');
await p.click('.bol-menu button:has-text("Repetir no mês seguinte")');
await p.waitForFunction(() => document.querySelectorAll('.nuvem h3').length && [...document.querySelectorAll('.nuvem h3')].filter((h) => h.textContent === "Aluguel da sala").length === 2, null, { timeout: 15000 });
checar(true, "aluguel repetido para o mês seguinte");
await p.click('.nuvem:has-text("Sistema Volly") .bol-icone');
await p.click('.bol-menu button:has-text("Excluir")');
await p.click('.bol-menu button:has-text("Clique de novo para excluir")');
await p.waitForSelector('.nuvem:has-text("Sistema Volly")', { state: "detached", timeout: 15000 });
checar(true, "excluiu");
checar(p.erros.length === 0, "sem erros: " + p.erros.join(" | "));

console.log("8. outras telas: celular e modo escuro");
const m = await pagina(browser, { largura: 390, altura: 844 });
await entrar(m, "Samuel Rodrigues", pins.samuel);
await m.goto(BASE + "#/boletos/pagar");
await m.waitForSelector(".nuvem", { timeout: 15000 });
await m.waitForTimeout(500);
await foto(m, "35-boletos-celular");
const largo = await m.evaluate(() => document.documentElement.scrollWidth);
checar(largo <= 390, "sem rolagem para o lado no celular: " + largo);
const e = await pagina(browser, { escuro: true });
await entrar(e, "Samuel Rodrigues", pins.samuel);
await e.goto(BASE + "#/boletos/pagar");
await e.waitForSelector(".nuvem", { timeout: 15000 });
await e.waitForTimeout(500);
await foto(e, "36-boletos-escuro");
await e.goto(BASE + "#/oktoplus");
await e.waitForSelector(".okto .resumo", { timeout: 15000 });
await foto(e, "37-oktoplus-escuro");
await e.goto(BASE + "#/salavip");
await e.waitForTimeout(1200);
await foto(e, "38-salavip-escuro");
await e.goto(BASE + "#/operacao");
await e.waitForSelector(".op-cartao");
await foto(e, "39-operacao-escuro");
await m.goto(BASE + "#/oktoplus");
await m.waitForSelector(".okto .resumo", { timeout: 15000 });
await foto(m, "40-oktoplus-celular");
await m.goto(BASE + "#/salavip");
await m.waitForTimeout(1200);
await foto(m, "41-salavip-celular");
checar(m.erros.length === 0 && e.erros.length === 0, "sem erros: " + [...m.erros, ...e.erros].join(" | "));

console.log("9. quem não tem a aba não vê; João Pedro (editar) vê");
await sair(p);
await entrar(p, "João Pedro", pins.joao);
await p.goto(BASE + "#/boletos/pagar");
await p.waitForSelector(".nuvem", { timeout: 15000 });
checar((await p.$$(".bol-btn.novo")).length === 1, "João Pedro pode cadastrar");
await browser.close();
console.log(totalFalhas() ? `${totalFalhas()} FALHA(S)` : "TUDO CERTO");
process.exit(totalFalhas() ? 1 : 0);
