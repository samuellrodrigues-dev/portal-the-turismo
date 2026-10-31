// Ajudantes dos testes: zera os emuladores, abre o navegador e faz login por nome + PIN.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import fs from "node:fs";
import path from "node:path";

export const BASE = "http://127.0.0.1:4173/?emulador";
export const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "out");
fs.mkdirSync(OUT, { recursive: true });

export async function zerar() {
  await fetch("http://127.0.0.1:8080/emulator/v1/projects/demo-portal/databases/(default)/documents", { method: "DELETE" });
  await fetch("http://127.0.0.1:9099/emulator/v1/projects/demo-portal/accounts", { method: "DELETE" });
}

/** Grava direto no Firestore do emulador, sem passar pelas regras (para simular dados antigos). */
export async function gravarAdmin(caminho, campos) {
  const conv = (v) => {
    if (v === null) return { nullValue: null };
    if (v instanceof Date) return { timestampValue: v.toISOString() };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(conv) } };
    if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === "boolean") return { booleanValue: v };
    if (typeof v === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, conv(x)])) } };
    return { stringValue: String(v) };
  };
  const r = await fetch(`http://127.0.0.1:8080/v1/projects/demo-portal/databases/(default)/documents/${caminho}`, {
    method: "PATCH", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, conv(v)])) }),
  });
  if (!r.ok) throw new Error("gravarAdmin " + caminho + " " + (await r.text()));
}
export async function lerAdmin(caminho) {
  const r = await fetch(`http://127.0.0.1:8080/v1/projects/demo-portal/databases/(default)/documents/${caminho}`, { headers: { Authorization: "Bearer owner" } });
  return r.ok ? r.json() : null;
}
export async function listarAdmin(colecao) {
  const r = await fetch(`http://127.0.0.1:8080/v1/projects/demo-portal/databases/(default)/documents/${colecao}?pageSize=500`, { headers: { Authorization: "Bearer owner" } });
  return (await r.json()).documents || [];
}

export async function navegador() {
  const browser = await chromium.launch();
  return browser;
}
export async function pagina(browser, { largura = 1360, altura = 900, escuro = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: largura, height: altura }, colorScheme: escuro ? "dark" : "light", locale: "pt-BR", timezoneId: "America/Fortaleza" });
  const page = await ctx.newPage();
  page.erros = [];
  page.on("pageerror", (e) => page.erros.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) page.erros.push(m.text()); });
  return page;
}

export async function entrar(page, nome, pin) {
  await page.goto(BASE);
  await page.waitForSelector(".tt-nomes, .tt-quem", { timeout: 15000 });
  if (await page.$(".tt-quem")) {
    const atual = await page.textContent(".tt-quem b");
    if (atual.trim() !== nome) await page.click(".tt-link-claro");
  }
  if (await page.$(".tt-nomes")) await page.click(`.tt-nome span:nth-child(2):text-is("${nome}")`);
  await page.waitForSelector(".tt-pin input");
  await page.fill(".tt-pin input", pin);
  await page.waitForSelector(".tt-barra", { timeout: 15000 });
}

export async function escolher(page, nome) {
  await page.waitForSelector(".tt-nomes, .tt-quem", { timeout: 15000 });
  if (await page.$(".tt-quem")) await page.click(".tt-link-claro");
  await page.click(`.tt-nome span:nth-child(2):text-is("${nome}")`);
  await page.waitForSelector(".tt-pin input");
}

export async function sair(page) {
  await page.click(".tt-eu-btn");
  await page.click(".tt-menu button:has-text('Sair')");
  // com PIN ainda no quadro, o menu pede para clicar de novo
  const armado = await page.$(".tt-menu button.armado").catch(() => null); // sem PIN, a página já está recarregando
  if (armado) await armado.click().catch(() => {});
  await page.waitForSelector(".tt-entrada", { timeout: 15000 });
}

/** Lê os PINs que estão no quadro "PINs para entregar": [[nome, pin], …] na ordem da tela. */
export async function pinsDoQuadro(page) {
  if (!(await page.$(".qp"))) { if (await page.$(".qp-pilula")) await page.click(".qp-pilula"); else return []; }
  return page.$$eval(".qp-lista li", (lis) => lis.map((li) => [li.querySelector(".qp-nome").textContent.trim(), li.querySelector(".qp-pin").textContent.trim()]));
}
export async function pinDoQuadro(page, nome) {
  const sel = `.qp-lista li:has(.qp-nome:text-is("${nome}")) .qp-pin`;
  await page.waitForSelector(sel, { timeout: 30000 });
  return (await page.textContent(sel)).trim();
}

export const foto = (page, nome) => page.screenshot({ path: path.join(OUT, nome + ".png"), fullPage: true });

let falhas = 0;
export function checar(cond, msg) { if (cond) console.log("  ok -", msg); else { falhas++; console.log("  FALHOU -", msg); } }
export const totalFalhas = () => falhas;
