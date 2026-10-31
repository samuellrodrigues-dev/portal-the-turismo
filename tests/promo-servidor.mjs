// Servidor local com feeds de exemplo (nos formatos reais: WordPress, Google Notícias, Atom),
// um site em que o robô precisa achar o feed sozinho, uma fonte fora do ar e as APIs do radar.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const h = (n) => new Date(Date.now() - n * 36e5).toUTCString();
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const wp = (titulo, itens) => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel><title>${titulo}</title><link>https://exemplo.test/</link>
${itens.map((i) => `<item><title>${i.t}</title><link>${i.l}</link><pubDate>${h(i.h)}</pubDate>
<dc:creator><![CDATA[Redação]]></dc:creator>${(i.c || ["Promoções"]).map((c) => `<category><![CDATA[${c}]]></category>`).join("")}
<guid isPermaLink="false">${i.l}?p=1</guid><description><![CDATA[${i.d || ""} O post ${i.t} apareceu primeiro em ${titulo}.]]></description>
${i.conteudo ? `<content:encoded><![CDATA[<p>${i.conteudo}</p>]]></content:encoded>` : ""}</item>`).join("\n")}
</channel></rss>`;

const gnews = (itens) => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><generator>NFE/5.0</generator><title>"promoção" - Google Notícias</title>
${itens.map((i, k) => `<item><title>${esc(i.t)} - ${esc(i.f)}</title><link>https://news.google.com/rss/articles/CBMi${k}${i.id}?oc=5</link><guid isPermaLink="false">CBMi${k}${i.id}</guid><pubDate>${h(i.h)}</pubDate><description>&lt;a href="https://news.google.com/rss/articles/CBMi${k}${i.id}?oc=5" target="_blank"&gt;${esc(i.t)}&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;${esc(i.f)}&lt;/font&gt;</description><source url="${i.u}">${esc(i.f)}</source></item>`).join("\n")}
</channel></rss>`;

const atom = (itens) => `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Viagens baratas</title><id>urn:x</id><updated>${new Date().toISOString()}</updated>
${itens.map((i) => `<entry><title type="html">${esc(i.t)}</title><link rel="alternate" type="text/html" href="${i.l}"/><id>${i.l}</id><published>${new Date(Date.now() - i.h * 36e5).toISOString()}</published><updated>${new Date(Date.now() - i.h * 36e5).toISOString()}</updated><summary type="html">${esc("<p>" + (i.d || "") + "</p>")}</summary></entry>`).join("\n")}
</feed>`;

export const ARQUIVOS = {
  "/md.xml": wp("Melhores Destinos", [
    { t: "Só hoje! Promoção da Latam tem passagens aéreas nacionais a partir de R$ 289 ida e volta!", l: "https://www.melhoresdestinos.com.br/promocao/passagens-aereas-nacionais-29-10-26", h: 2, d: "A Latam abriu uma promoção com voos nacionais para várias capitais, saindo de São Paulo, Brasília e Fortaleza." },
    { t: "Portugal com bons preços! Voos para Lisboa ou Porto a partir de R$ 3.279 ida e volta saindo de várias cidades", l: "https://www.melhoresdestinos.com.br/promocao/portugal-bons-precos-passagens-3279", h: 5, d: "Os voos da TAP saem de Fortaleza, Recife e Teresina, com datas até junho de 2027.", conteudo: "Os voos da TAP saem de Fortaleza, Recife e Teresina." },
    { t: "Prorrogado! Smiles oferece até 80% de bônus na transferência de pontos Livelo", l: "https://www.melhoresdestinos.com.br/milhas/smiles-livelo-80-bonus-out26", h: 3, c: ["Milhas"], d: "A promoção vale para clientes do Clube Smiles &#8211; quem não é do clube recebe até 60%." },
    { t: "Muito barato! Latam Pass tem voos a partir de apenas 2 mil milhas o trecho", l: "https://www.melhoresdestinos.com.br/milhas/latam-pass-promocao-resgate-out26", h: 26, c: ["Milhas"] },
    { t: "10 dicas para economizar na viagem para a Europa", l: "https://www.melhoresdestinos.com.br/dicas-economizar-europa.html", h: 6, c: ["Dicas"] },
    { t: "Escapada para Buenos Aires! Passagens aéreas para a Argentina a partir de R$ 1.153 ida e volta", l: "https://www.melhoresdestinos.com.br/promocao/escapada-argentina-passagens-buenos-aies-1153", h: 50 },
    { t: "Ofertas no ar! 17 excelentes promoções de passagens, pacotes e hotéis para aproveitar hoje", l: "https://www.melhoresdestinos.com.br/promocao/17-promocoes-30-out", h: 1 },
    { t: "Passagens para Paris a partir de R$ 2.890 ida e volta", l: "https://www.melhoresdestinos.com.br/promocao/paris-antiga", h: 15 * 24 },
  ]),
  "/pp.xml": wp("Passageiro de Primeira", [
    { t: "Só hoje! Smiles oferece até 80% de bônus nas transferências de pontos da Livelo", l: "https://passageirodeprimeira.com/so-hoje-smiles-80-livelo/", h: 4, c: ["Smiles", "Livelo"] },
    { t: "Smiles e Livelo: milheiro a partir de R$ 15,46 transferindo pontos mais dinheiro", l: "https://passageirodeprimeira.com/milheiro-smiles-livelo-1546/", h: 8 },
    { t: "Esfera dá até 100% de bônus na transferência para a Azul Fidelidade até 05/11", l: "https://passageirodeprimeira.com/esfera-azul-100-bonus/", h: 20 },
    { t: "Clube Smiles a partir de R$ 21,90 por mês com 5 mil milhas de bônus", l: "https://passageirodeprimeira.com/clube-smiles-2190/", h: 30 },
    { t: "Azul Fidelidade vende pontos com 50% de desconto", l: "https://passageirodeprimeira.com/azul-pontos-50-off/", h: 10 },
    { t: "Como usar milhas para viajar de executiva", l: "https://passageirodeprimeira.com/como-executiva/", h: 12 },
  ]),
  "/gn-milhas.xml": gnews([
    { t: "Smiles oferece até 80% de bônus nas transferências de pontos da Livelo", f: "Passageiro de Primeira", u: "https://passageirodeprimeira.com", h: 4, id: "a" },
    { t: "LATAM Pass tem passagens para a Europa a partir de 35 mil milhas o trecho", f: "Melhores Destinos", u: "https://www.melhoresdestinos.com.br", h: 7, id: "b" },
  ]),
  "/gn-teresina.xml": gnews([
    { t: "Azul anuncia novo voo direto entre Teresina e Lisboa", f: "Cidade Verde", u: "https://cidadeverde.com", h: 9, id: "c" },
    { t: "Voos de Teresina para São Paulo por R$ 437 ida e volta com a Gol", f: "Meio Norte", u: "https://www.meionorte.com", h: 11, id: "d" },
    { t: "Prefeitura de Teresina anuncia obras no centro", f: "Cidade Verde", u: "https://cidadeverde.com", h: 3, id: "e" },
  ]),
  "/atom.xml": atom([
    { t: "Passagens para Salvador a partir de R$ 572 ida e volta no fim de semana", l: "https://viagens.exemplo.test/salvador-572", h: 14, d: "Voos da Gol e da Azul em novembro." },
  ]),
  "/site.html": `<!doctype html><html><head><title>Blog</title><link rel="alternate" type="application/rss+xml" title="Comentários" href="/comments/feed/"><link rel="alternate" type="application/rss+xml" title="Feed" href="/descoberto.xml"></head><body>oi</body></html>`,
  "/descoberto.xml": wp("Voopter", [
    { t: "Relâmpago! Voos para Orlando a partir de R$ 2.499 ida e volta pela American Airlines", l: "https://www.voopter.com.br/blog/orlando-2499", h: 2 },
  ]),
};

export function fontesTeste(base) {
  return [
    { id: "md", nome: "Melhores Destinos", tipo: "misto", url: base + "/md.xml" },
    { id: "pp", nome: "Passageiro de Primeira", tipo: "milhas", url: base + "/pp.xml" },
    { id: "gn-milhas", nome: "Google Notícias · milhas", tipo: "milhas", url: base + "/gn-milhas.xml", google: true },
    { id: "gn-teresina", nome: "Google Notícias · Teresina", tipo: "passagens", url: base + "/gn-teresina.xml", google: true },
    { id: "atom", nome: "Viagens Baratas (Atom)", tipo: "passagens", url: base + "/atom.xml" },
    { id: "voopter", nome: "Voopter", tipo: "passagens", url: base + "/nao-existe.xml", site: base + "/site.html" },
    { id: "fora", nome: "Site fora do ar", tipo: "passagens", url: base + "/erro500" },
  ];
}

function serp(u) {
  const para = u.searchParams.get("arrival_id");
  const base = { "GRU,CGH,VCP": 812, "GIG,SDU": 945, BSB: 690, SSA: 520, LIS: 4310, MCO: 3980, "EZE,AEP": 2150 }[para] ?? 999;
  if (para === "SSA") return { error: "Google Flights hasn't returned any results for this query." };
  return {
    search_metadata: { google_flights_url: `https://www.google.com/travel/flights?test=${encodeURIComponent(para)}` },
    best_flights: [{ price: base, total_duration: 215, layovers: para.length > 3 ? [{ duration: 60, name: "Brasília", id: "BSB" }] : [], flights: [{ airline: "LATAM", departure_airport: { id: "THE" }, arrival_airport: { id: para.slice(0, 3) } }] }],
    price_insights: { lowest_price: base, price_level: base < 900 ? "low" : "typical", typical_price_range: [Math.round(base * 1.05), Math.round(base * 1.6)] },
  };
}
function tp() {
  return { success: true, currency: "brl", data: {
    GRU: { 0: { price: 1388, airline: "G3", flight_number: 1601, departure_at: "2026-11-18T06:10:00-03:00", return_at: "2026-11-25T21:40:00-03:00", expires_at: "2026-11-02T10:00:00Z" }, 1: { price: 799, airline: "LA", flight_number: 3301, departure_at: "2026-11-20T05:00:00-03:00", return_at: "2026-11-27T22:00:00-03:00", expires_at: "2026-11-02T10:00:00Z" } },
    LIS: { 1: { price: 3650, airline: "TP", flight_number: 14, departure_at: "2027-02-10T22:00:00-03:00", return_at: "2027-02-24T10:00:00Z", expires_at: "2026-11-03T10:00:00Z" } },
    BSB: { 0: { price: 610, airline: "AD", flight_number: 4100, departure_at: "2026-12-04T13:00:00-03:00", return_at: "2026-12-08T19:00:00-03:00", expires_at: "2026-11-02T10:00:00Z" } },
  } };
}

export function subirServidor(porta = 4555) {
  const pedidos = [];
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, `http://127.0.0.1:${porta}`);
    pedidos.push(u.pathname);
    if (u.pathname === "/erro500") { res.writeHead(500); res.end("erro"); return; }
    if (u.pathname === "/serp") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(serp(u))); return; }
    if (u.pathname === "/tp") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(tp())); return; }
    const a = ARQUIVOS[u.pathname];
    if (!a) { res.writeHead(404, { "Content-Type": "text/html" }); res.end("<html><body>não encontrado</body></html>"); return; }
    res.writeHead(200, { "Content-Type": u.pathname.endsWith(".html") ? "text/html; charset=utf-8" : "application/rss+xml; charset=utf-8" });
    res.end(a);
  });
  return new Promise((ok) => srv.listen(porta, "127.0.0.1", () => {
    const base = `http://127.0.0.1:${porta}`;
    const arq = path.join(path.dirname(new URL(import.meta.url).pathname), "out", "promo-fontes.json");
    fs.mkdirSync(path.dirname(arq), { recursive: true });
    fs.writeFileSync(arq, JSON.stringify(fontesTeste(base)));
    ok({ base, fontes: arq, pedidos, fechar: () => new Promise((f) => srv.close(f)) });
  }));
}
