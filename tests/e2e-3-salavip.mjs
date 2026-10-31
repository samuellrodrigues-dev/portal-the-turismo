// Sala VIP dentro do portal, com dados no formato do sistema antigo.
import fs from "node:fs";
import path from "node:path";
import { navegador, pagina, entrar, sair, foto, checar, totalFalhas, BASE, OUT, gravarAdmin, lerAdmin } from "./util.mjs";

const pins = JSON.parse(fs.readFileSync(path.join(OUT, "pins.json"), "utf8"));
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
const soma = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// dados como o sistema antigo gravava (atualizadoPor com e-mail)
const base = { contato: "(86) 99999-0001", obs: "", atendente: "Débora", valor: 150, criadoEm: new Date(), atualizadoEm: new Date(), atualizadoPor: "samuel@exemplo.com" };
await gravarAdmin("usos/u1", { ...base, emissao: "E1", cliente: "Maria Clara Neri", data: soma(hoje, 1), emitirEm: hoje, aeroportos: ["THE", "GRU"], acessos: 2, status: "Pendente" });
await gravarAdmin("usos/u2", { ...base, emissao: "E2", cliente: "Jailson Cardoso", data: soma(hoje, 3), emitirEm: soma(hoje, 2), aeroportos: ["SDU"], acessos: 1, status: "Pendente" });
await gravarAdmin("usos/u3", { ...base, emissao: "E3", cliente: "Rosângela Almeida", data: soma(hoje, -3), emitirEm: soma(hoje, -4), aeroportos: ["SCL"], acessos: 2, status: "Enviado" });
await gravarAdmin("acesso/papeis", { admins: ["samuel@exemplo.com"], operadores: ["alan@exemplo.com"] });

const browser = await navegador();
const p = await pagina(browser);
console.log("1. admin abre a Sala VIP com os dados antigos");
await entrar(p, "Samuel Rodrigues", pins.samuel);
await p.waitForSelector('.tt-aba:has-text("Sala VIP") .selo', { timeout: 15000 });
checar((await p.textContent('.tt-aba:has-text("Sala VIP") .selo')).trim() === "1", "selo da aba: 1 para emitir hoje");
await p.goto(BASE + "#/salavip");
const host = p.locator(".tt-salavip");
await host.locator(".quadro-linha").first().waitFor({ timeout: 15000 });
const quadro = await host.locator(".quadro").textContent();
checar(quadro.includes("Maria Clara Neri"), "painel Emitir hoje mostra Maria Clara");
await host.locator(".abas button:has-text('Histórico')").click();
await p.waitForTimeout(400);
checar((await host.locator("#lista").textContent()).includes("Rosângela Almeida"), "histórico mostra o envio antigo");
await host.locator(".abas button:has-text('Próximas')").click();
await p.waitForTimeout(600);
await foto(p, "20-salavip-admin");

console.log("2. admin muda status (regra nova: quem mudou = nome da pessoa)");
await host.locator('.quadro-linha:has-text("Maria Clara") button[data-v=Emitido]').click();
await p.waitForTimeout(1500);
const u1 = await lerAdmin("usos/u1");
checar(u1.fields.status.stringValue === "Emitido" && u1.fields.atualizadoPor.stringValue === "Samuel Rodrigues", "gravou Emitido por Samuel Rodrigues");

console.log("3. admin cadastra uma emissão colando a mensagem do WhatsApp");
await host.locator("button:has-text('Nova emissão')").first().click();
const msg = `EMISSÃO
✈️ **PACOTE RIO DE JANEIRO – 1 PESSOA**
**IDA – ${soma(hoje, 5).slice(8, 10)}/${soma(hoje, 5).slice(5, 7)}**
Teresina (THE) → Rio de Janeiro (SDU)
🕐 11:50 → 17:25
SALA VIP: 1 acesso em THE – R$ 180,00

Jailson Cardoso do Nascimento
04/01/1979
CPF:81590881320
86998401708

ATENDENTE: PEDRO H`;
await host.locator("#f-texto").fill(msg);
await host.locator("#f-ler").click();
await p.waitForTimeout(300);
checar((await host.locator("#f-cliente").inputValue()) === "Jailson Cardoso do Nascimento", "leu o cliente da mensagem");
await host.locator("#f-salvar").click();
await p.waitForTimeout(1500);
checar(!(await host.locator("#dlg").evaluate((d) => d.open)), "salvou e fechou o formulário");
checar((await host.locator("#lista").textContent()).includes("Jailson Cardoso do Nascimento"), "nova emissão na lista de próximas");
checar(p.erros.length === 0, "sem erros: " + p.erros.join(" | "));
await sair(p);

console.log("4. operador (Alan) só muda status");
await entrar(p, "Alan Ferreira", pins.alan);
await p.goto(BASE + "#/salavip");
await host.locator(".linha, .quadro-linha").first().waitFor({ timeout: 15000 });
checar((await host.locator("button:has-text('Nova emissão')").count()) === 0, "operador não vê Nova emissão");
checar((await host.locator("[data-acao=editar]").count()) === 0, "operador não vê editar");
await host.locator('.linha:has-text("Jailson Cardoso Do Nascimento"), .linha:has-text("Jailson Cardoso do Nascimento")').first().locator("button[data-v=Emitido]").click();
await p.waitForTimeout(1500);
await foto(p, "21-salavip-operador");
checar(p.erros.length === 0, "sem erros: " + p.erros.join(" | "));
await sair(p);

console.log("5. quem não tem Sala VIP não vê a aba");
await entrar(p, "Lívia Pia", pins.livia);
checar(!(await p.$('.tt-aba:has-text("Sala VIP")')), "Lívia sem aba Sala VIP");
await browser.close();
console.log(totalFalhas() ? `${totalFalhas()} FALHA(S)` : "TUDO CERTO");
process.exit(totalFalhas() ? 1 : 0);
