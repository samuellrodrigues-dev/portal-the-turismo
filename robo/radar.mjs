// Radar de preços saindo de Teresina (opcional: só roda com as chaves configuradas).
//  • SERPAPI_KEY: preço do Google Voos para as rotas abaixo, uma vez por dia (o plano grátis dá 250 buscas/mês).
//  • TRAVELPAYOUTS_TOKEN: os mais baratos saindo de Teresina, vistos nas buscas da Aviasales (grátis).
import { CIDADE_IATA, NOME_CIA } from "./dicionario.mjs";

// Até 7 rotas cabem no plano grátis do SerpApi (7 × 31 dias = 217 buscas).
export const ROTAS = [
  { id: "THE-SAO", de: "THE", para: "GRU,CGH,VCP", nome: "São Paulo" },
  { id: "THE-RIO", de: "THE", para: "GIG,SDU", nome: "Rio de Janeiro" },
  { id: "THE-BSB", de: "THE", para: "BSB", nome: "Brasília" },
  { id: "THE-SSA", de: "THE", para: "SSA", nome: "Salvador" },
  { id: "THE-LIS", de: "THE", para: "LIS", nome: "Lisboa" },
  { id: "THE-MCO", de: "THE", para: "MCO", nome: "Orlando" },
  { id: "THE-BUE", de: "THE", para: "EZE,AEP", nome: "Buenos Aires" },
];
export const DIAS_ATE_IDA = 30, NOITES = 7;
const SERPAPI = process.env.SERPAPI_URL || "https://serpapi.com/search.json";
const TRAVELPAYOUTS = process.env.TRAVELPAYOUTS_URL || "https://api.travelpayouts.com/v1/prices/cheap";

const iso = (d) => d.toISOString().slice(0, 10);
const somaDias = (d, n) => new Date(d.getTime() + n * 864e5);
const linkGoogle = (de, para, ida, volta) =>
  `https://www.google.com/travel/flights?q=${encodeURIComponent(`Voos de ${de} para ${para.split(",")[0]} em ${ida} volta ${volta}`)}&curr=BRL&hl=pt-BR`;

export async function radarGoogle(chave, anterior, agora = new Date(), buscar = fetch) {
  const ida = iso(somaDias(agora, DIAS_ATE_IDA)), volta = iso(somaDias(agora, DIAS_ATE_IDA + NOITES));
  const hoje = iso(agora);
  const antes = new Map((anterior?.rotas || []).map((r) => [r.id, r]));
  const rotas = [];
  for (const r of ROTAS) {
    const velho = antes.get(r.id);
    const historico = (velho?.historico || []).filter((h) => h.d !== hoje).slice(-44);
    try {
      const u = new URL(SERPAPI);
      Object.entries({ engine: "google_flights", departure_id: r.de, arrival_id: r.para, outbound_date: ida, return_date: volta, type: "1", currency: "BRL", hl: "pt-br", gl: "br", api_key: chave })
        .forEach(([k, v]) => u.searchParams.set(k, v));
      const resp = await buscar(u, { signal: AbortSignal.timeout(40000) });
      const j = await resp.json();
      if (!resp.ok || j.error) throw new Error(j.error || `HTTP ${resp.status}`);
      const op = [...(j.best_flights || []), ...(j.other_flights || [])].filter((o) => typeof o.price === "number").sort((a, b) => a.price - b.price)[0];
      const pi = j.price_insights || {};
      const preco = typeof pi.lowest_price === "number" ? pi.lowest_price : op?.price ?? null;
      if (preco == null) throw new Error("sem preço para essa data");
      const faixa = Array.isArray(pi.typical_price_range) && pi.typical_price_range.length === 2 ? pi.typical_price_range.map(Number) : null;
      historico.push({ d: hoje, p: preco });
      rotas.push({
        id: r.id, nome: r.nome, de: r.de, para: r.para, ida, volta, preco,
        nivel: { low: "baixo", typical: "normal", high: "alto" }[pi.price_level] || pi.price_level || null,
        faixa, cia: op?.flights?.[0]?.airline || null, paradas: Array.isArray(op?.layovers) ? op.layovers.length : null,
        duracao: typeof op?.total_duration === "number" ? op.total_duration : null,
        link: j.search_metadata?.google_flights_url || linkGoogle(r.de, r.para, ida, volta), historico, erro: null,
      });
    } catch (e) {
      rotas.push({ ...(velho || { id: r.id, nome: r.nome, de: r.de, para: r.para }), historico, erro: String(e.message || e).slice(0, 160) });
    }
  }
  return { atualizadoEm: agora, ida, volta, rotas };
}

export async function radarAviasales(token, buscar = fetch) {
  const u = new URL(TRAVELPAYOUTS);
  Object.entries({ origin: "THE", destination: "-", currency: "brl", token }).forEach(([k, v]) => u.searchParams.set(k, v));
  const resp = await buscar(u, { signal: AbortSignal.timeout(30000), headers: { "Accept-Encoding": "gzip, deflate" } });
  const j = await resp.json();
  if (!resp.ok || j.success === false) throw new Error(j.error || `HTTP ${resp.status}`);
  const itens = [];
  for (const [dest, porParadas] of Object.entries(j.data || {})) {
    let melhor = null;
    for (const [paradas, x] of Object.entries(porParadas || {})) {
      if (typeof x?.price !== "number") continue;
      if (!melhor || x.price < melhor.preco) {
        melhor = {
          destino: dest, nome: CIDADE_IATA[dest] || dest, preco: x.price, paradas: Number(paradas) || 0,
          cia: NOME_CIA[x.airline] || x.airline || null, ida: String(x.departure_at || "").slice(0, 10) || null,
          volta: String(x.return_at || "").slice(0, 10) || null, expira: x.expires_at || null,
        };
      }
    }
    if (melhor) itens.push(melhor);
  }
  itens.sort((a, b) => a.preco - b.preco);
  return { atualizadoEm: new Date(), itens: itens.slice(0, 16) };
}
