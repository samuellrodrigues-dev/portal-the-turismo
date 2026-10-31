// Leitor de RSS 2.0, RSS 1.0 (RDF) e Atom, sem dependências.

const NOMEADAS = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’",
  ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", ordm: "º", ordf: "ª", deg: "°", euro: "€", reg: "®", copy: "©", trade: "™",
  bull: "•", middot: "·", times: "×", sup2: "²", sup3: "³", frac12: "½", iexcl: "¡", iquest: "¿", shy: "",
  aacute: "á", Aacute: "Á", eacute: "é", Eacute: "É", iacute: "í", Iacute: "Í", oacute: "ó", Oacute: "Ó", uacute: "ú", Uacute: "Ú",
  acirc: "â", Acirc: "Â", ecirc: "ê", Ecirc: "Ê", ocirc: "ô", Ocirc: "Ô", atilde: "ã", Atilde: "Ã", otilde: "õ", Otilde: "Õ",
  ccedil: "ç", Ccedil: "Ç", agrave: "à", Agrave: "À", uuml: "ü", Uuml: "Ü", ntilde: "ñ", Ntilde: "Ñ", iuml: "ï", euml: "ë",
};

export function decodificar(s) {
  return String(s || "")
    .replace(/&#(\d+);/g, (_, n) => { const c = Number(n); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : ""; })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { const c = parseInt(n, 16); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : ""; })
    .replace(/&([a-z][a-z0-9]*);/gi, (m, n) => (n in NOMEADAS ? NOMEADAS[n] : m));
}

const semCdata = (s) => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");

/** HTML → texto corrido. */
export function textoDe(html) {
  let s = semCdata(html);
  // o conteúdo de feeds costuma vir "escapado" (&lt;p&gt;…): desfaz uma vez se não houver tags de verdade
  if (!/<[a-z!/]/i.test(s) && /&lt;[a-z!/]/i.test(s)) s = decodificar(s);
  s = s.replace(/<(script|style|figure|figcaption)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodificar(s).replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function campo(bloco, nomes) {
  for (const n of nomes) {
    const re = new RegExp(`<${n.replace(":", "\\:")}(?:\\s[^>]*)?>([\\s\\S]*?)</${n.replace(":", "\\:")}>`, "i");
    const m = bloco.match(re);
    if (m && m[1].trim()) return m[1];
  }
  return "";
}
function atributo(tag, nome) {
  const m = tag.match(new RegExp(`\\s${nome}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? decodificar(m[2] ?? m[3] ?? "") : "";
}
function linkAtom(bloco) {
  const tags = bloco.match(/<link\b[^>]*>/gi) || [];
  const alt = tags.find((t) => { const r = atributo(t, "rel"); return (!r || r === "alternate") && atributo(t, "href"); });
  return alt ? atributo(alt, "href") : "";
}
function data(s) {
  const t = decodificar(semCdata(s)).trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Lê o texto de um feed. Devolve null se não parecer feed. */
export function lerFeed(xml) {
  const s = String(xml || "");
  const ehAtom = /<feed[\s>]/i.test(s) && /<entry[\s>]/i.test(s);
  const ehRss = /<(rss|rdf:RDF)[\s>]/i.test(s) || /<channel[\s>]/i.test(s);
  if (!ehAtom && !ehRss) return null;
  const blocos = s.match(ehAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) || [];
  const cab = s.slice(0, s.search(ehAtom ? /<entry[\s>]/i : /<item[\s>]/i) >>> 0 || 4000);
  const itens = blocos.map((b) => {
    const titulo = textoDe(campo(b, ["title"]));
    let link = ehAtom ? linkAtom(b) : decodificar(semCdata(campo(b, ["link"]))).trim();
    if (!link) link = decodificar(semCdata(campo(b, ["guid", "id"]))).trim();
    const desc = campo(b, ["description", "summary", "content:encoded", "content"]);
    const conteudo = campo(b, ["content:encoded", "content"]);
    const categorias = [
      ...[...b.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi)].map((m) => textoDe(m[1])),
      ...[...b.matchAll(/<category\b[^>]*\bterm\s*=\s*"([^"]*)"[^>]*\/?>/gi)].map((m) => decodificar(m[1])),
    ].filter(Boolean);
    const fonteTag = b.match(/<source\b[^>]*>([\s\S]*?)<\/source>/i);
    return {
      titulo, link, categorias,
      data: data(campo(b, ["pubDate", "published", "updated", "dc:date"])),
      resumo: textoDe(desc),
      conteudo: conteudo && conteudo !== desc ? textoDe(conteudo).slice(0, 1200) : "",
      fonte: fonteTag ? textoDe(fonteTag[1]) : "",
    };
  }).filter((i) => i.titulo && /^https?:\/\//i.test(i.link));
  return { titulo: textoDe(campo(cab, ["title"])), itens };
}

/** Procura o endereço do feed numa página HTML (<link rel="alternate" type="application/rss+xml">). */
export function acharFeed(html, base) {
  const tags = String(html || "").match(/<link\b[^>]*>/gi) || [];
  const t = tags.find((x) => /alternate/i.test(atributo(x, "rel")) && /(rss|atom)\+xml/i.test(atributo(x, "type")) && !/comments/i.test(atributo(x, "href")));
  if (!t) return "";
  try { return new URL(atributo(t, "href"), base).href; } catch { return ""; }
}
