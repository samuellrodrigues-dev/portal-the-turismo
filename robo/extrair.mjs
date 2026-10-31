// Tira do título (e do resumo) as informações concretas de cada promoção:
// preço, milhas, bônus, desconto, milheiro, companhias, programas, bancos, destinos, origens, prazo.
import { CIDADES, CIAS, PROGRAMAS, BANCOS } from "./dicionario.mjs";

export const semAcento = (s) => String(s || "").normalize("NFC").normalize("NFD").replace(/[̀-ͯ]/g, "");
const baixa = (s) => semAcento(s).toLowerCase();

/** "1.153" → 1153 · "15,46" → 15.46 · "1.234,56" → 1234.56 */
export function numeroBR(txt) {
  let s = String(txt || "").trim();
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* ─── valores ─── */
function precos(t) {
  const passagem = [], milheiro = [];
  for (const m of t.matchAll(/R\$\s?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g)) {
    const v = numeroBR(m[1]);
    if (v == null) continue;
    const antes = baixa(t.slice(Math.max(0, m.index - 36), m.index));
    const depois = baixa(t.slice(m.index + m[0].length, m.index + m[0].length + 28));
    if (/milheiro[^.]{0,22}$|(o|por|cada) mil\s*$/.test(antes) || /^\s*(o|por|cada)\s+(milheiro|mil\b)/.test(depois)) { milheiro.push(v); continue; }
    if (/^\s*(de\s+(desconto|cashback|credito|volta|economia|bonus)|off\b|em\s+(cashback|credito))/.test(depois)) continue;
    if (/(cashback|desconto|credito|anuidade|economize|economia|ganhe|cupom)\s+(de\s+)?(ate\s+)?$/.test(antes)) continue;
    if (/^\s*(\/\s*mes|por mes|mensa|ao mes)/.test(depois) || /(clube|assinatura|plano)[^.]{0,30}$/.test(antes)) continue;
    if (v < 30 || v > 60000) continue;
    passagem.push(v);
  }
  return { passagem, milheiro: milheiro.filter((v) => v > 3 && v < 200) };
}
function milhasDe(tb) {
  const v = [];
  for (const m of tb.matchAll(/(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*(mil\s+)?(milhas|pontos|pts|avios)\b/g)) {
    if (/r\$\s*$/.test(tb.slice(Math.max(0, m.index - 4), m.index))) continue;
    let n = numeroBR(m[1]);
    if (n == null) continue;
    if (m[2]) n *= 1000;
    if (n < 500 || n > 3_000_000) continue;
    v.push(Math.round(n));
  }
  return v;
}
const porcentos = (tb, res) => res.flatMap((re) => [...tb.matchAll(re)].map((m) => Number(m[1]))).filter((n) => n > 0 && n <= 400);

/* ─── nomes ─── */
function acharNomes(texto, lista, pular = 1) {
  let t = texto;
  const achados = [];
  for (const e of lista) {
    for (const r of e.slice(pular)) {
      const re = new RegExp(r, "g");
      if (re.test(t)) {
        if (!achados.includes(e[0])) achados.push(e[0]);
        t = t.replace(new RegExp(r, "g"), (x) => " ".repeat(x.length));
      }
    }
  }
  return { achados, resto: t };
}

const APELIDOS = CIDADES.flatMap(([nome, iata, onde, ne, ...outros]) =>
  [nome, ...outros].map((a) => ({ a: baixa(a), nome, iata, int: onde === "int", ne }))).sort((x, y) => y.a.length - x.a.length);

function acharCidades(tb, original) {
  let t = tb;
  const achadas = [];
  for (const c of APELIDOS) {
    const re = new RegExp(`(^|[^a-z0-9])(${c.a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=$|[^a-z0-9])`, "g");
    for (const m of t.matchAll(re)) {
      const i = m.index + m[1].length;
      const antes = t.slice(Math.max(0, i - 28), i), depois = t.slice(i + c.a.length, i + c.a.length + 24);
      if (c.a === "rio" && /^ (grande|negro|branco|das ostras|quente|claro|verde|preto|sao francisco)/.test(depois)) continue;
      if (c.a === "natal" && /(promo\w*|ofertas?|especial|feliz|ceia|ferias|o|no|do|para o|de) $/.test(antes) && !/(voos?|saindo|partindo|passagens?|trechos?) (de|para) $/.test(antes)) continue;
      if (c.a === "bonito" && original.charAt(i) !== "B") continue;
      if (c.a === "porto" && /^ (alegre|seguro|velho|de galinhas)/.test(depois)) continue;
      achadas.push({ ...c, i });
    }
    t = t.replace(re, (x, a, b) => a + " ".repeat(b.length));
  }
  return achadas.sort((a, b) => a.i - b.i);
}

/** Papel de cada cidade: origem ("saindo de X", "de X para Y") ou destino. */
function papeis(tb, cidades) {
  const origens = [], destinos = [];
  const marcas = [...tb.matchAll(/(saindo|partindo|saidas?|embarques?|embarcando|saem|sai)\s+(de|do|da|em)\s/g)].map((m) => m.index);
  cidades.forEach((c, k) => {
    const antes = tb.slice(Math.max(0, c.i - 30), c.i);
    const prox = cidades[k + 1];
    const entre = prox ? tb.slice(c.i + c.a.length, prox.i) : "";
    const depoisDeMarca = marcas.some((mi) => mi < c.i && !/[.;!?]|\bpara\b|\brumo\b/.test(tb.slice(mi, c.i)) && c.i - mi < 90);
    const ehOrigemPar = prox && /(^|\s)(de|do|da|entre)\s+$/.test(antes) && /^\s*(para|a|ate|x|e|-|–|→|>|\/)\s*$/.test(entre);
    if (depoisDeMarca || ehOrigemPar) { if (!origens.some((o) => o.nome === c.nome)) origens.push(c); }
    else if (!destinos.some((d) => d.nome === c.nome)) destinos.push(c);
  });
  return { origens, destinos: destinos.filter((d) => !origens.some((o) => o.nome === d.nome)) };
}

/* ─── prazo ─── */
function prazo(tb, publicado) {
  const selos = [];
  if (/\bso hoje\b|somente hoje|apenas hoje|ate (as )?23h ?59|termina hoje|acaba hoje|encerra hoje|ultimo dia|ultimas horas|vale ate hoje|so ate hoje|valida ate hoje/.test(tb)) selos.push("Só hoje");
  else if (/ate amanha|termina amanha|acaba amanha|encerra amanha|so ate amanha/.test(tb)) selos.push("Até amanhã");
  else if (/ultimos dias|reta final|esta acabando|ta acabando/.test(tb)) selos.push("Últimos dias");
  if (/relampago|\bflash\b|madrugol|madrugada|noite de promo|anoiteceu|so (nesta|esta) noite|por poucas horas|poucas horas/.test(tb)) selos.push("Relâmpago");
  if (/prorrogad/.test(tb)) selos.push("Prorrogada");
  if (/(^|[^a-z])voltou\b|esta de volta|ta de volta|retorna\b|de volta!/.test(tb)) selos.push("Voltou");
  let ate = null;
  const m = tb.match(/\bate (o dia |dia )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) {
    const d = Number(m[2]), mes = Number(m[3]);
    if (d >= 1 && d <= 31 && mes >= 1 && mes <= 12) {
      const base = publicado instanceof Date && !Number.isNaN(publicado.getTime()) ? publicado : new Date();
      let ano = m[4] ? Number(m[4].length === 2 ? "20" + m[4] : m[4]) : base.getUTCFullYear();
      if (!m[4] && mes < base.getUTCMonth() + 1 - 6) ano++;
      ate = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return { selos, ate };
}

const GUIA = /^(como|dicas|guia|o que|onde|quando|qual|quais|por que|porque|vale a pena|tudo sobre|entenda|saiba|conheca|veja como|aprenda|\d+ (dicas|lugares|destinos|motivos|coisas|cidades|praias)|roteiro|review|analise|resenha)\b/;
const PROMO = /promo|oferta|barat|desconto|baixou|caiu|queda|liquida|black ?friday|cyber|imperdivel|a partir de|por apenas|so hoje|ultimo dia|relampago|\boff\b|bonus|cupom|milheiro|voltou|prorrog|tarifa|aproveite|corra|preco|pechincha|saldao|queima/;

/**
 * Analisa uma notícia. Devolve null se não for promoção (guia, dica, notícia sem número).
 * fonteTipo: "passagens" | "milhas" | "misto" | "noticias"
 */
export function analisar({ titulo, resumo = "", link = "", fonteTipo = "misto", publicado = null }) {
  const t = String(titulo || "").replace(/\s+/g, " ").trim();
  const tb = baixa(t);
  const rb = baixa(resumo).slice(0, 400);
  const linkb = baixa(link);

  const p = precos(t);
  const pr = p.passagem.length ? p : precos(String(resumo).slice(0, 300));
  const milhas = milhasDe(tb).length ? milhasDe(tb) : milhasDe(rb.slice(0, 220));
  const bonus = Math.max(0, ...porcentos(tb, [/(\d{1,3})\s?%\s*(?:de\s+)?(?:bonus|bonificacao)/g, /bonus\s+(?:de\s+)?(?:ate\s+)?(\d{1,3})\s?%/g]));
  const desconto = Math.max(0, ...porcentos(tb, [/(\d{1,3})\s?%\s*(?:off|de\s+desconto|mais\s+barat|de\s+economia)/g, /desconto\s+(?:de\s+)?(?:ate\s+)?(\d{1,3})\s?%/g]));
  const milheiro = p.milheiro.length ? Math.min(...p.milheiro) : null;

  const prog = acharNomes(tb, PROGRAMAS);
  const cias = acharNomes(prog.resto, CIAS, 2);
  const bancos = acharNomes(cias.resto, BANCOS);
  const programas = prog.achados.filter((x) => x !== "Miles&Smiles" || /turkish|miles ?& ?smiles/.test(tb));
  const cidades = acharCidades(tb, semAcento(t));
  const { origens, destinos } = papeis(tb, cidades);
  if (!origens.length && rb) {
    // "Os voos saem de Fortaleza, Recife e Teresina" no resumo
    for (const o of papeis(rb, acharCidades(rb, semAcento(String(resumo).slice(0, 400)))).origens) if (!origens.some((x) => x.nome === o.nome)) origens.push(o);
  }
  const textoAll = tb + " " + rb;
  const teresina = cidades.some((c) => c.nome === "Teresina") || /\bteresina\b|\bpiaui\b/.test(textoAll) || /\bTHE\b/.test(t);
  const variasCidades = /(saindo|partindo|saidas?|embarques?) (de|do|da|em) (varias|diversas|outras|muitas|\d+) (cidades|capitais|origens|aeroportos)|\bde (varias|diversas) (cidades|capitais|origens)|ofertas de outras cidades|(saindo|partindo) de todo o brasil|de todas as regioes/.test(textoAll);

  const sinalPassagem = /passage|\bvoos?\b|tarifa|aere[ao]s?\b|bilhete/.test(tb);
  const sinalMilhas = programas.length > 0 || milhas.length > 0 || bonus > 0 || milheiro != null || /\bmilhas\b|\bpontos\b|fidelidade|milheiro/.test(tb);
  let tipo;
  if (milhas.length || milheiro != null || bonus > 0 || (programas.length && !pr.passagem.length) || linkb.includes("/milhas/")) tipo = "milhas";
  else if (pr.passagem.length || sinalPassagem || linkb.includes("/promocao/")) tipo = "passagens";
  else if (sinalMilhas) tipo = "milhas";
  else tipo = fonteTipo === "milhas" ? "milhas" : "passagens";

  const promo = PROMO.test(tb);
  const guia = GUIA.test(tb) || /guia completo|passo a passo|como (comprar|achar|encontrar|economizar|acumular|usar|juntar)/.test(tb);
  let aceita;
  if (tipo === "passagens") {
    aceita = (pr.passagem.length > 0 && (sinalPassagem || /pacote|hotel|resort|cruzeiro|hospedagem/.test(tb)))
      || (promo && sinalPassagem && !guia)
      || (teresina && /voo|rota|aeroporto|passage|companhia|aere|conexao|frequencia/.test(tb) && !guia);
  } else {
    aceita = milhas.length > 0 || bonus > 0 || milheiro != null || (desconto > 0 && sinalMilhas)
      || (programas.length > 0 && (promo || fonteTipo === "milhas") && !guia);
    if (guia && !(bonus || milheiro != null || desconto)) aceita = false;
  }
  if (!aceita) return null;

  const internacional = destinos.some((d) => d.int) || /internaciona(l|is)|exterior/.test(tb);
  const nacional = !internacional && (destinos.some((d) => !d.int) || /nacionai?s\b|nacional\b|pelo brasil|no brasil/.test(tb));
  let categoria;
  if (tipo === "passagens") {
    if (/\b\d{1,3}\s+(excelentes\s+|otimas\s+|melhores\s+|boas\s+|grandes\s+|novas\s+)?(promocoes|ofertas)\b|ofertas do (fim de semana|dia)|selecao de|resumo d/.test(tb)) categoria = "selecao";
    else if (/pacote|aereo \+ hotel|aereo e hotel|hotel \+ aereo|all inclusive|cruzeiro|resort/.test(tb) && !/passagens? aere/.test(tb)) categoria = "pacote";
    else if (!pr.passagem.length && !promo) categoria = "noticia";
    else categoria = internacional ? "internacional" : nacional ? "nacional" : "geral";
  } else {
    const compra = milheiro != null || /compr(a|ar|e)\s+(de\s+)?(milhas|pontos|avios)|venda de (milhas|pontos)|vende (milhas|pontos)|(milhas|pontos)\s+com\s+(desconto|ate)|(milhas|pontos)\s+pela metade/.test(tb) || (desconto > 0 && /(milhas|pontos|avios)/.test(tb) && !bonus);
    const resgate = milhas.length > 0 && /passage|\bvoos?\b|trecho|resgat|ida e volta|executiva|economica|bilhete|destino|classe/.test(tb);
    if (bonus > 0) categoria = "bonus";
    else if (compra) categoria = "compra";
    else if (resgate || (milhas.length && destinos.length)) categoria = "resgate";
    else if (/clube/.test(tb)) categoria = "clube";
    else if (/cartao|cartoes|anuidade|cashback|pontos por dolar/.test(tb)) categoria = "cartao";
    else categoria = "outras";
  }

  const idaVolta = /ida e volta/.test(tb) ? "ida e volta" : /o trecho|por trecho|cada trecho|so ida|somente ida|apenas ida|por perna/.test(tb) ? "trecho" : null;
  const { selos, ate } = prazo(tb, publicado);
  const preco = pr.passagem.length ? Math.min(...pr.passagem) : null;
  const milhasMin = milhas.length ? Math.min(...milhas) : null;

  const num = tipo === "milhas" ? (bonus || milheiro || milhasMin || desconto || "") : (preco || "");
  const ents = [...programas, ...cias.achados].map(baixa).sort().join(",");
  const dest = destinos.slice(0, 3).map((d) => baixa(d.nome)).sort().join(",");
  let chave = [tipo, categoria, ents, dest, num].join("|");
  if (!num && !ents && !dest) chave = tipo + "|" + tb.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3).slice(0, 7).join(" ");

  if (tipo === "milhas") {
    const prog = { LATAM: "LATAM Pass", GOL: "Smiles", Azul: "Azul Fidelidade" };
    for (const c of cias.achados) if (prog[c] && !programas.includes(prog[c])) programas.push(prog[c]);
  }
  return {
    tipo, categoria, preco, milhas: milhasMin, bonus: bonus || null, desconto: desconto || null, milheiro,
    cias: cias.achados, programas, bancos: bancos.achados,
    destinos: destinos.map((d) => d.nome).slice(0, 8), origens: origens.map((o) => o.nome).slice(0, 8),
    iatas: destinos.map((d) => d.iata).filter(Boolean).slice(0, 8),
    iatasOrigem: origens.map((o) => o.iata).filter(Boolean).slice(0, 8),
    internacional, nacional, teresina, variasCidades, idaVolta, selos, ate, chave,
  };
}

/* ─── o que a agência quer em cada aba ─── */
// Milhas: só ofertas para COMPRAR milhas/pontos nos programas brasileiros.
// Passagens: só passagens aéreas com preço (sem notícias, pacotes ou seleções sem preço).
export const PROGRAMAS_BR = ["Smiles", "LATAM Pass", "Azul Fidelidade", "Livelo", "Esfera", "Átomos", "Inter Loop", "Dotz", "Km de Vantagens", "Coopera", "Curtaí"];
const NOTICIA = /preco medio|precos? sobe|ficam? mais car|aumento d|alta de \d|reajuste|inflacao|golpe|\bpres[ao]\b|policia|morre|acidente|eleic|eleitoral|votac|\bpesquisa\b|levantamento|\bestudo\b|ranking|fluxo de passageiros|movimentacao de passageiros|recorde de passageiros|\banac\b|procon|justica|tribunal|processo|greve|cancelad|investiga|denuncia|prefeitura|governo/;
const PROMO_PASSAGEM = /promo|oferta|a partir de|por apenas|por r\$|baixou|desconto|imperdivel|barat|liquida|black ?friday|cyber|so hoje|relampago|tarifa|saldao|queima|cupom|voltou|corra|aproveite|ida e volta|o trecho|caiu/;
const COMPRA = /compr(a|ar|e|em)\s+(de\s+)?(\d[\d.]*\s+)?(mil\s+)?(milhas|pontos|avios)|venda de (milhas|pontos)|vende(m)? (milhas|pontos)|(milhas|pontos) (com|por) (ate )?\d{1,3}\s?% (de desconto|off|mais barat)|(milhas|pontos) com desconto|(milhas|pontos) (pela|na) metade|milheiro/;

/** true se a promoção é do tipo que a agência quer ver. */
export function noEscopo(a, titulo) {
  const tb = baixa(titulo);
  if (NOTICIA.test(tb)) return false;
  if (a.tipo === "passagens") {
    return a.preco != null && !["pacote", "selecao", "noticia"].includes(a.categoria)
      && /passage|\bvoos?\b|aere|tarifa|bilhete|trecho/.test(tb) && PROMO_PASSAGEM.test(tb);
  }
  const estrangeiro = a.programas.length > 0 && a.programas.every((p) => !PROGRAMAS_BR.includes(p));
  const compra = a.milheiro != null || COMPRA.test(tb) || (a.desconto != null && /(compr|vend|adquir)/.test(tb) && /(milhas|pontos)/.test(tb));
  return compra && !estrangeiro;
}

/** Analisa e já aplica o escopo da agência (o que não interessa volta null). */
export function analisarParaAgencia(dados) {
  const a = analisar(dados);
  if (!a || !noEscopo(a, dados.titulo)) return null;
  if (a.tipo === "milhas") {
    a.categoria = "compra";
    a.programas = a.programas.filter((p) => PROGRAMAS_BR.includes(p));
  }
  return a;
}

/** Limpa o resumo do feed (tira "O post … apareceu primeiro em …", "Leia mais" etc.). */
export function limparResumo(s, titulo = "") {
  let r = String(s || "")
    .replace(/(O post|The post)\s.+?\s(apareceu primeiro em|appeared first on)\s.+$/i, "")
    .replace(/\s*(\[(…|\.\.\.)\]|Leia mais.*|Continue lendo.*|Saiba mais.*|Read more.*)$/i, "")
    .trim();
  if (titulo && r.startsWith(titulo)) r = r.slice(titulo.length).trim();
  if (r.length > 260) r = r.slice(0, 260).replace(/\s+\S*$/, "") + "…";
  return r;
}
