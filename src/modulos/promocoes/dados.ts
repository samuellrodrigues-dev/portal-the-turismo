/* Promoções de passagens e milhas: o robô (pasta robo/) grava em promocoes/{passagens|milhas|radar|resumo}; aqui só se lê. */
import { doc, onSnapshot, type Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { brl } from "../../lib/formato";
import { hojeIso, partes } from "../../lib/tempo";

export type TipoPromo = "passagens" | "milhas";
export type Promo = {
  id: string; titulo: string; resumo: string; link: string; fonte: string; fonteId: string; em: Date; visto: Date;
  tipo: TipoPromo; categoria: string; preco: number | null; milhas: number | null; bonus: number | null; desconto: number | null; milheiro: number | null;
  cias: string[]; programas: string[]; bancos: string[]; destinos: string[]; origens: string[]; iatas: string[]; iatasOrigem: string[];
  internacional: boolean; nacional: boolean; teresina: boolean; variasCidades: boolean; idaVolta: string | null;
  selos: string[]; ate: string | null; outras: { fonte: string; link: string }[];
};
export type StatusFonte = { id: string; nome: string; url: string; ok: boolean; erro: string | null; lidos: number; aceitos: number; metodo: string | null; quando: Date | null; ultimoOk: Date | null };
export type Feed = { atualizadoEm: Date | null; itens: Promo[]; fontes: StatusFonte[] };

export type RotaRadar = {
  id: string; nome: string; de: string; para: string; ida?: string; volta?: string; preco?: number; nivel?: string | null; faixa?: number[] | null;
  cia?: string | null; paradas?: number | null; duracao?: number | null; link?: string; historico?: { d: string; p: number }[]; erro?: string | null;
};
export type ItemAviasales = { destino: string; nome: string; preco: number; paradas: number; cia: string | null; ida: string | null; volta: string | null };
export type Radar = {
  atualizadoEm: Date | null;
  google: { atualizadoEm: Date | null; ida: string; volta: string; rotas: RotaRadar[] } | null;
  aviasales: { atualizadoEm: Date | null; itens: ItemAviasales[] } | null;
};

const data = (v: unknown): Date | null => (v && typeof (v as Timestamp).toDate === "function" ? (v as Timestamp).toDate() : v instanceof Date ? v : typeof v === "string" ? new Date(v) : null);
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function paraPromo(x: Record<string, unknown>): Promo {
  return {
    id: String(x.id || ""), titulo: String(x.titulo || ""), resumo: String(x.resumo || ""), link: String(x.link || ""),
    fonte: String(x.fonte || ""), fonteId: String(x.fonteId || ""), em: data(x.em) || new Date(0), visto: data(x.visto) || data(x.em) || new Date(0),
    tipo: x.tipo === "milhas" ? "milhas" : "passagens", categoria: String(x.categoria || "geral"),
    preco: num(x.preco), milhas: num(x.milhas), bonus: num(x.bonus), desconto: num(x.desconto), milheiro: num(x.milheiro),
    cias: lista(x.cias), programas: lista(x.programas), bancos: lista(x.bancos), destinos: lista(x.destinos), origens: lista(x.origens), iatas: lista(x.iatas), iatasOrigem: lista(x.iatasOrigem),
    internacional: !!x.internacional, nacional: !!x.nacional, teresina: !!x.teresina, variasCidades: !!x.variasCidades,
    idaVolta: typeof x.idaVolta === "string" ? x.idaVolta : null, selos: lista(x.selos), ate: typeof x.ate === "string" ? x.ate : null,
    outras: Array.isArray(x.outras) ? (x.outras as { fonte?: string; link?: string }[]).filter((o) => o && o.link).map((o) => ({ fonte: String(o.fonte || ""), link: String(o.link) })) : [],
  };
}

export function useFeed(tipo: TipoPromo) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => onSnapshot(doc(db, "promocoes", tipo), (s) => {
    const x = s.data() || {};
    setFeed({
      atualizadoEm: data(x.atualizadoEm),
      itens: (Array.isArray(x.itens) ? x.itens : []).map(paraPromo).filter((p: Promo) => p.titulo && /^https?:\/\//.test(p.link)).sort((a: Promo, b: Promo) => b.em.getTime() - a.em.getTime()),
      fontes: (Array.isArray(x.fontes) ? x.fontes : []).map((f: Record<string, unknown>) => ({
        id: String(f.id || ""), nome: String(f.nome || ""), url: String(f.url || ""), ok: !!f.ok, erro: (f.erro as string) || null,
        lidos: Number(f.lidos) || 0, aceitos: Number(f.aceitos) || 0, metodo: (f.metodo as string) || null, quando: data(f.quando), ultimoOk: data(f.ultimoOk),
      })),
    });
    setErro("");
  }, (e) => { setFeed({ atualizadoEm: null, itens: [], fontes: [] }); setErro(e.code === "permission-denied" ? "Seu acesso não permite ver as promoções." : "Não consegui carregar as promoções."); }), [tipo]);
  return { feed, erro };
}

export function useRadar() {
  const [radar, setRadar] = useState<Radar | null>(null);
  useEffect(() => onSnapshot(doc(db, "promocoes", "radar"), (s) => {
    const x = s.data();
    if (!x) { setRadar(null); return; }
    const g = x.google as Record<string, unknown> | null, a = x.aviasales as Record<string, unknown> | null;
    setRadar({
      atualizadoEm: data(x.atualizadoEm),
      google: g ? { atualizadoEm: data(g.atualizadoEm), ida: String(g.ida || ""), volta: String(g.volta || ""), rotas: (Array.isArray(g.rotas) ? g.rotas : []) as RotaRadar[] } : null,
      aviasales: a ? { atualizadoEm: data(a.atualizadoEm), itens: (Array.isArray(a.itens) ? a.itens : []) as ItemAviasales[] } : null,
    });
  }, () => setRadar(null)), []);
  return radar;
}

/* ─── "novas desde a última visita", por navegador ─── */
const CHAVE_VISTO = (t: TipoPromo) => `tt-promo-visto-${t}`;
export function ultimaVisita(t: TipoPromo): number {
  try { const v = Number(localStorage.getItem(CHAVE_VISTO(t))); return Number.isFinite(v) && v > 0 ? v : 0; } catch { return 0; }
}
export function marcarVisita(t: TipoPromo) {
  try { localStorage.setItem(CHAVE_VISTO(t), String(Date.now())); } catch { /* sem armazenamento: tudo bem */ }
  window.dispatchEvent(new CustomEvent("tt-promo-visto", { detail: t }));
}
/** Para o selo das abas: lê só o resumo (pequeno), não a lista inteira. */
export function useNovidades(ligado: boolean) {
  const [r, setR] = useState<{ passagens: number[]; milhas: number[] }>({ passagens: [], milhas: [] });
  const [, setTique] = useState(0);
  useEffect(() => {
    if (!ligado) return;
    const f = () => setTique((n) => n + 1);
    window.addEventListener("tt-promo-visto", f);
    const desligar = onSnapshot(doc(db, "promocoes", "resumo"), (s) => {
      const x = s.data() || {};
      const v = (t: TipoPromo) => ((x[t]?.vistos as unknown[]) || []).map((d) => data(d)?.getTime() || 0).filter(Boolean);
      setR({ passagens: v("passagens"), milhas: v("milhas") });
    }, () => setR({ passagens: [], milhas: [] }));
    return () => { desligar(); window.removeEventListener("tt-promo-visto", f); };
  }, [ligado]);
  const conta = (t: TipoPromo) => { const u = ultimaVisita(t) || Date.now() - 24 * 36e5; return r[t].filter((v) => v > u).length; };
  return { passagens: conta("passagens"), milhas: conta("milhas") };
}

/* ─── textos ─── */
export const preco = (n: number) => brl(n).replace(/,00$/, "");
export const milhasTxt = (n: number) => (n >= 1000 && n % 1000 === 0 ? `${(n / 1000).toLocaleString("pt-BR")} mil` : n.toLocaleString("pt-BR"));
export function ha(d: Date | null, agora = Date.now()) {
  if (!d) return "";
  const m = Math.max(0, Math.round((agora - d.getTime()) / 60000));
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.round(h / 24);
  return dias === 1 ? "ontem" : `há ${dias} dias`;
}
export function horaDe(d: Date) { const p = partes(d); return `${p.hora}:${p.min}`; }
export function diaDe(d: Date) {
  const p = partes(d), iso = `${p.ano}-${p.mes}-${p.dia}`, hoje = hojeIso();
  if (iso === hoje) return "Hoje";
  const ontem = hojeIso(new Date(Date.now() - 864e5));
  if (iso === ontem) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short", timeZone: "America/Fortaleza" }).replace(".", "");
}
const isoDe = (d: Date) => { const p = partes(d); return `${p.ano}-${p.mes}-${p.dia}`; };

/**
 * Situação do prazo. "Só hoje" publicado ontem já acabou; "até 05/11" passado também.
 * urgente: vale hoje e acaba logo · encerrada: provavelmente já acabou
 */
export function situacao(p: Pick<Promo, "selos" | "ate" | "em">, hoje = hojeIso()) {
  const dia = isoDe(p.em);
  const curto = p.selos.includes("Só hoje") || p.selos.includes("Relâmpago");
  if (p.ate && p.ate < hoje) return { rotulo: `Acabou em ${p.ate.slice(8, 10)}/${p.ate.slice(5, 7)}`, urgente: false, encerrada: true };
  if (curto && dia < hoje) return { rotulo: p.selos.includes("Só hoje") ? `Era só em ${dia.slice(8, 10)}/${dia.slice(5, 7)}` : "Relâmpago (já passou)", urgente: false, encerrada: true };
  if (p.selos.includes("Até amanhã") && dia < hojeIso(new Date(Date.now() - 864e5))) return { rotulo: "Já acabou", urgente: false, encerrada: true };
  if (p.ate === hoje) return { rotulo: "Acaba hoje", urgente: true, encerrada: false };
  if (p.selos.includes("Só hoje")) return { rotulo: "Só hoje", urgente: true, encerrada: false };
  if (p.selos.includes("Relâmpago")) return { rotulo: "Relâmpago", urgente: true, encerrada: false };
  if (p.selos.includes("Até amanhã")) return { rotulo: "Até amanhã", urgente: true, encerrada: false };
  if (p.ate) return { rotulo: `Até ${p.ate.slice(8, 10)}/${p.ate.slice(5, 7)}`, urgente: false, encerrada: false };
  if (p.selos.includes("Últimos dias")) return { rotulo: "Últimos dias", urgente: true, encerrada: false };
  if (p.selos.includes("Prorrogada")) return { rotulo: "Prorrogada", urgente: false, encerrada: false };
  if (p.selos.includes("Voltou")) return { rotulo: "Voltou", urgente: false, encerrada: false };
  return null;
}

/** Texto para mandar no WhatsApp (o consultor confere antes). */
export function textoWhats(p: Promo) {
  const linhas: string[] = [];
  if (p.tipo === "passagens") {
    linhas.push(p.destinos.length ? `✈️ ${p.destinos.slice(0, 3).join(", ")}${p.preco ? ` a partir de ${preco(p.preco)}` : ""}${p.idaVolta ? ` ${p.idaVolta}` : ""}` : `✈️ ${p.titulo}`);
    const det = [p.cias.length ? p.cias.join(", ") : "", p.origens.length ? `saindo de ${p.origens.join(", ")}` : p.variasCidades ? "saindo de várias cidades" : ""].filter(Boolean);
    if (det.length) linhas.push(det.join(" · "));
  } else {
    linhas.push(`🎯 ${p.titulo}`);
    const det = [p.bonus ? `${p.bonus}% de bônus` : "", p.milhas ? `${milhasTxt(p.milhas)} milhas${p.idaVolta === "trecho" ? " o trecho" : ""}` : "", p.milheiro ? `milheiro a ${brl(p.milheiro)}` : "", p.desconto ? `${p.desconto}% de desconto` : "", p.programas.join(", ")].filter(Boolean);
    if (det.length) linhas.push(det.join(" · "));
  }
  const s = situacao(p);
  if (s && !s.encerrada) linhas.push(`⏰ ${s.rotulo}`);
  linhas.push(`(visto em ${p.fonte}, ${p.em.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Fortaleza" })} ${horaDe(p.em)}. Sujeito a disponibilidade.)`);
  return linhas.join("\n");
}

export async function copiar(texto: string) {
  try { await navigator.clipboard.writeText(texto); return true; }
  catch {
    const t = document.createElement("textarea");
    t.value = texto; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select();
    const ok = document.execCommand("copy"); t.remove(); return ok;
  }
}

export const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export function bate(p: Promo, termo: string) {
  if (!termo) return true;
  return semAcento([p.titulo, p.resumo, p.fonte, ...p.cias, ...p.programas, ...p.bancos, ...p.destinos, ...p.origens, ...p.iatas].join(" ")).includes(termo);
}
