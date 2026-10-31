#!/usr/bin/env node
// Robô de promoções: lê as fontes, tira as informações de cada promoção e grava no banco do portal.
//   node robo/promocoes.mjs --testar     só lê e mostra o que achou (não grava nada)
//   node robo/promocoes.mjs              lê e grava (precisa de FIREBASE_SERVICE_ACCOUNT)
// Opcionais: SERPAPI_KEY e TRAVELPAYOUTS_TOKEN ligam o radar de preços saindo de Teresina.
import crypto from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { FONTES } from "./fontes.mjs";
import { lerFeed, acharFeed } from "./rss.mjs";
import { analisar, limparResumo, semAcento } from "./extrair.mjs";
import { conectar } from "./firestore.mjs";
import { radarGoogle, radarAviasales } from "./radar.mjs";

const args = new Set(process.argv.slice(2));
const TESTAR = args.has("--testar");
const UA = "Mozilla/5.0 (compatible; THE-TURISMO-Promocoes/1.0; +https://theturismo-sistemas.web.app)";
const DIA = 864e5;
const NOVO_ATE = 10 * DIA;      // ignora o que foi publicado há mais de 10 dias
const GUARDA = 21 * DIA;        // mantém no banco por 21 dias
const MAX_ITENS = 400;
const agora = new Date();

const fontes = process.env.PROMO_FONTES ? JSON.parse(fs.readFileSync(process.env.PROMO_FONTES, "utf8")) : FONTES;
const so = [...args].find((a) => a.startsWith("--fontes="))?.slice(9).split(",");
const lista = so ? fontes.filter((f) => so.includes(f.id)) : fontes;

async function baixar(url) {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, text/html;q=0.8, */*;q=0.5", "Accept-Language": "pt-BR,pt;q=0.9" },
    redirect: "follow", signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const t = await r.text();
  if (t.length > 8_000_000) throw new Error("resposta grande demais");
  return { texto: t, url: r.url || url };
}

/** Baixa o feed; se o endereço não for feed, procura o feed na página inicial do site. */
async function lerFonte(f) {
  let erro = "";
  try {
    const { texto } = await baixar(f.url);
    const feed = lerFeed(texto);
    if (feed) return { feed, url: f.url, metodo: "feed" };
    const achado = acharFeed(texto, f.url);
    if (achado && achado !== f.url) {
      const feed2 = lerFeed((await baixar(achado)).texto);
      if (feed2) return { feed: feed2, url: achado, metodo: "descoberto" };
    }
    erro = "o endereço não é um feed";
  } catch (e) { erro = e.name === "TimeoutError" ? "demorou demais para responder" : String(e.message || e); }
  if (f.site) {
    try {
      const { texto, url } = await baixar(f.site);
      const achado = acharFeed(texto, url);
      if (achado) {
        const feed = lerFeed((await baixar(achado)).texto);
        if (feed) return { feed, url: achado, metodo: "descoberto" };
      }
    } catch { /* fica o primeiro erro */ }
  }
  throw new Error(erro || "não achei o feed");
}

const idDe = (link) => crypto.createHash("sha1").update(link).digest("hex").slice(0, 14);
const normTitulo = (t) => semAcento(t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const ehGoogle = (link) => /news\.google\./.test(link);

function itensDaFonte(f, feed) {
  const aceitos = [];
  let descartados = 0;
  for (const it of feed.itens) {
    let titulo = it.titulo;
    let fonte = f.nome;
    if (f.google) {
      const nomeFonte = it.fonte || (titulo.match(/\s[-–—]\s([^-–—]+)$/) || [])[1] || "";
      if (nomeFonte) {
        fonte = nomeFonte.trim();
        titulo = titulo.replace(new RegExp(`\\s[-–—]\\s${nomeFonte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`), "").trim();
      }
    }
    let em = it.data && !Number.isNaN(it.data.getTime()) ? it.data : agora;
    if (em > new Date(agora.getTime() + DIA)) em = agora;
    if (agora - em > NOVO_ATE) continue;
    const resumo = f.google ? "" : limparResumo(it.resumo || it.conteudo, titulo);
    const a = analisar({ titulo, resumo, link: it.link, fonteTipo: f.tipo, publicado: em });
    if (!a || (f.tipo === "noticias" && a.categoria === "noticia" && !a.teresina)) { descartados++; continue; }
    if (f.tipo === "passagens" && a.tipo === "milhas" && !a.programas.length && !a.milhas && !a.bonus) a.tipo = "passagens";
    aceitos.push({ id: idDe(it.link), titulo, resumo, link: it.link, fonte, fonteId: f.id, em, visto: agora, ...a, outras: [] });
  }
  return { aceitos, descartados };
}

/** Junta os novos com os que já estavam no banco, sem repetir a mesma promoção vinda de vários sites. */
export function juntar(existentes, novos) {
  const lista = (existentes || []).map((i) => ({ ...i, em: new Date(i.em), visto: new Date(i.visto || i.em), outras: i.outras || [] }));
  const porId = new Map(lista.map((i) => [i.id, i]));
  let entraram = 0;
  for (const n of novos) {
    const ja = porId.get(n.id);
    if (ja) { Object.assign(ja, { ...n, visto: ja.visto, outras: ja.outras }); continue; }
    const nt = normTitulo(n.titulo);
    const dup = lista.find((e) => e.tipo === n.tipo && (normTitulo(e.titulo) === nt || (e.chave === n.chave && Math.abs(e.em - n.em) <= 3 * DIA)));
    if (dup) {
      const jaTem = dup.link === n.link || dup.outras.some((o) => o.link === n.link);
      if (!jaTem) {
        if (ehGoogle(dup.link) && !ehGoogle(n.link)) {
          // o link direto do site vale mais que o do Google Notícias
          dup.outras = [{ fonte: dup.fonte, link: dup.link }, ...dup.outras];
          Object.assign(dup, { link: n.link, fonte: n.fonte, fonteId: n.fonteId, titulo: n.titulo, resumo: n.resumo || dup.resumo });
        } else if (dup.fonte !== n.fonte || !dup.outras.some((o) => o.fonte === n.fonte)) {
          dup.outras.push({ fonte: n.fonte, link: n.link });
        }
        dup.outras = dup.outras.filter((o, k, arr) => o.fonte !== dup.fonte && arr.findIndex((x) => x.fonte === o.fonte) === k).slice(0, 6);
        for (const k of ["preco", "milhas", "bonus", "desconto", "milheiro", "ate"]) if (dup[k] == null && n[k] != null) dup[k] = n[k];
        if (!dup.resumo && n.resumo) dup.resumo = n.resumo;
      }
      continue;
    }
    lista.push(n); porId.set(n.id, n); entraram++;
  }
  const limite = agora.getTime() - GUARDA;
  let final = lista.filter((i) => i.em.getTime() >= limite).sort((a, b) => b.em - a.em).slice(0, MAX_ITENS);
  while (final.length > 50 && JSON.stringify(final).length > 820_000) final = final.slice(0, -10);
  return { itens: final, entraram };
}

async function principal() {
  console.log(`Robô de promoções · ${agora.toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })} · ${lista.length} fontes${TESTAR ? " · TESTE (não grava)" : ""}`);
  const status = [];
  const novos = { passagens: [], milhas: [] };
  const fila = [...lista];
  const trabalhar = async () => {
    for (let f = fila.shift(); f; f = fila.shift()) {
      const s = { id: f.id, nome: f.nome, tipo: f.tipo, url: f.url, ok: false, erro: null, lidos: 0, passagens: 0, milhas: 0, descartados: 0, metodo: null, quando: agora };
      try {
        if (f.google) await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
        const { feed, url, metodo } = await lerFonte(f);
        const { aceitos, descartados } = itensDaFonte(f, feed);
        Object.assign(s, { ok: true, url, metodo, lidos: feed.itens.length, descartados });
        for (const a of aceitos) { novos[a.tipo].push(a); s[a.tipo]++; }
      } catch (e) { s.erro = String(e.message || e).slice(0, 160); }
      status.push(s);
      console.log(`  ${s.ok ? "ok  " : "ERRO"} ${f.nome.padEnd(44)} ${s.ok ? `${String(s.lidos).padStart(3)} lidos · ${s.passagens} passagens · ${s.milhas} milhas · ${s.descartados} descartados${s.metodo === "descoberto" ? " · feed achado em " + s.url : ""}` : s.erro}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, trabalhar));
  status.sort((a, b) => lista.findIndex((f) => f.id === a.id) - lista.findIndex((f) => f.id === b.id));
  const okN = status.filter((s) => s.ok).length;
  console.log(`${okN} de ${status.length} fontes responderam · ${novos.passagens.length} promoções de passagens e ${novos.milhas.length} de milhas nesta leitura`);

  if (TESTAR) {
    for (const tipo of ["passagens", "milhas"]) {
      const { itens } = juntar([], novos[tipo]);
      console.log(`\n── ${tipo.toUpperCase()} (${itens.length} depois de juntar as repetidas) ──`);
      for (const i of itens.slice(0, 12)) {
        const num = i.preco ? `R$ ${i.preco}` : i.bonus ? `${i.bonus}% bônus` : i.milhas ? `${i.milhas} milhas` : i.milheiro ? `milheiro R$ ${i.milheiro}` : i.desconto ? `${i.desconto}% off` : "";
        console.log(`  • [${i.categoria}] ${i.titulo}\n      ${[num, i.cias.join("/"), i.programas.join("/"), i.destinos.join(", "), i.selos.join(", "), i.teresina ? "TERESINA" : "", i.fonte, i.outras.length ? `+${i.outras.length} fontes` : ""].filter(Boolean).join(" · ")}`);
      }
    }
    return;
  }
  if (!okN) throw new Error("nenhuma fonte respondeu: nada foi gravado");

  const db = await conectar();
  const resumo = { atualizadoEm: agora };
  for (const tipo of ["passagens", "milhas"]) {
    const atual = await db.ler(`promocoes/${tipo}`);
    const { itens, entraram } = juntar(atual?.itens, novos[tipo]);
    const antes = new Map((atual?.fontes || []).map((s) => [s.id, s]));
    const fontesAba = status
      .filter((s) => s.tipo === tipo || s.tipo === "misto" || s.tipo === "noticias")
      .map((s) => ({
        id: s.id, nome: s.nome, url: s.url, ok: s.ok, erro: s.erro, lidos: s.lidos, aceitos: s[tipo], metodo: s.metodo, quando: s.quando,
        ultimoOk: s.ok ? agora : antes.get(s.id)?.ultimoOk ?? null,
      }));
    await db.gravar(`promocoes/${tipo}`, { atualizadoEm: agora, itens, fontes: fontesAba, versao: 1 });
    // resumo pequeno para o selo da aba (quantas novas desde a última visita), sem baixar a lista toda
    resumo[tipo] = { total: itens.length, vistos: itens.map((i) => i.visto).sort((a, b) => b - a).slice(0, 120) };
    console.log(`gravado promocoes/${tipo}: ${itens.length} promoções (${entraram} novas)`);
  }
  await db.gravar("promocoes/resumo", resumo);

  const serp = process.env.SERPAPI_KEY, tp = process.env.TRAVELPAYOUTS_TOKEN;
  if (serp || tp) {
    const radar = (await db.ler("promocoes/radar")) || {};
    const novo = { atualizadoEm: agora, google: radar.google || null, aviasales: radar.aviasales || null };
    const velhoGoogle = radar.google?.atualizadoEm ? new Date(radar.google.atualizadoEm) : null;
    if (serp && (args.has("--radar-agora") || !velhoGoogle || agora - velhoGoogle > 20 * 36e5)) {
      novo.google = await radarGoogle(serp, radar.google, agora);
      console.log(`radar Google Voos: ${novo.google.rotas.filter((r) => !r.erro).length} de ${novo.google.rotas.length} rotas`);
    }
    if (tp) {
      try { novo.aviasales = await radarAviasales(tp); console.log(`radar Aviasales: ${novo.aviasales.itens.length} destinos`); }
      catch (e) { console.log("radar Aviasales: " + e.message); }
    }
    await db.gravar("promocoes/radar", novo);
  }
}

if (process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])) {
  principal().catch((e) => { console.error("FALHOU: " + (e.message || e)); process.exit(1); });
}
