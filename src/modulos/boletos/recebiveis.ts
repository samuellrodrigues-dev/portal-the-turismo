/* ═══════════════════════════════════════════════════════════════
   Valores a receber (sem boleto): quem deve, quanto, até quando.
   Um documento por devedor/venda em "receber", com as parcelas dentro.
   Quem vê e quem edita é o mesmo nível da aba (abas.boletos), garantido
   nas regras do Firestore.
   ═══════════════════════════════════════════════════════════════ */
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where,
  type DocumentData, type Timestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../firebase";
import type { Eu } from "../../equipe/dados";
import { lerDocumento, soNumeros } from "../../lib/documento";
import { diasEntre, hojeIso, somaDias } from "../../lib/tempo";
import type { Clima } from "./dados";

export type Parcela = { venc: string; valor: number; recebidoEm: string | null; valorRecebido: number | null };
export type Recebivel = {
  id: string; devedor: string; documento: string; nascimento: string; telefone: string; referencia: string; obs: string;
  parcelas: Parcela[]; situacao: "aberto" | "quitado"; criadoPor: string; atualizadoPor: string; atualizadoEm: Date | null;
};
export type DadosRecebivel = Pick<Recebivel, "devedor" | "documento" | "nascimento" | "telefone" | "referencia" | "obs" | "parcelas">;

export const MAX_PARCELAS = 60;
/** Parcela sem data fica depois das que têm data (e entre elas, na ordem em que foram lançadas). */
const chaveVenc = (v: string) => v || "9999-12-31";
const porVenc = (a: { venc: string }, b: { venc: string }) => chaveVenc(a.venc).localeCompare(chaveVenc(b.venc));
const centavos = (n: number) => Math.round(n * 100) / 100;
const iso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

/* ─── leitura ─── */
const data = (v: unknown): Date | null => (v && typeof (v as Timestamp).toDate === "function" ? (v as Timestamp).toDate() : null);
function docParaRecebivel(id: string, x: DocumentData): Recebivel {
  const parcelas: Parcela[] = (Array.isArray(x.parcelas) ? x.parcelas : []).map((p: DocumentData) => ({
    venc: iso(p?.venc), valor: Number(p?.valor) || 0, recebidoEm: iso(p?.recebidoEm) || null,
    valorRecebido: typeof p?.valorRecebido === "number" ? p.valorRecebido : null,
  })).sort(porVenc);
  return {
    id, devedor: x.devedor || "", documento: x.documento || "", nascimento: x.nascimento || "", telefone: x.telefone || "",
    referencia: x.referencia || "", obs: x.obs || "", parcelas, situacao: x.situacao === "quitado" ? "quitado" : "aberto",
    criadoPor: x.criadoPor?.nome || "", atualizadoPor: x.atualizadoPor?.nome || "", atualizadoEm: data(x.atualizadoEm),
  };
}

/* ─── contas de cada valor a receber ─── */
export type ParcelaN = Parcela & { i: number };
/** Parcelas com o número (1/5, 2/5…), na ordem de vencimento. */
export const numeradas = (r: Pick<Recebivel, "parcelas">): ParcelaN[] => r.parcelas.map((p, i) => ({ ...p, i }));
export const emAberto = (r: Pick<Recebivel, "parcelas">) => numeradas(r).filter((p) => !p.recebidoEm);
export const proxima = (r: Pick<Recebivel, "parcelas">): ParcelaN | null => emAberto(r)[0] || null;
export const saldo = (r: Pick<Recebivel, "parcelas">) => centavos(emAberto(r).reduce((t, p) => t + p.valor, 0));
export const recebido = (r: Pick<Recebivel, "parcelas">) => centavos(r.parcelas.reduce((t, p) => t + (p.recebidoEm ? p.valorRecebido ?? p.valor : 0), 0));
/** A próxima parcela em aberto não tem data: o valor vai para o grupo "Sem data". */
export const semData = (r: Pick<Recebivel, "parcelas">) => { const p = proxima(r); return !!p && !p.venc; };

/** O "tempo" pela próxima parcela: tempestade (atrasada), chuva (vence hoje), nublado (até 7 dias), céu aberto (depois), sol (tudo recebido). */
export function climaReceber(r: Pick<Recebivel, "parcelas">, hoje = hojeIso()): Clima {
  const p = proxima(r);
  if (!p) return "sol";
  if (!p.venc) return "aberto";
  const d = diasEntre(hoje, p.venc);
  return d < 0 ? "tempestade" : d === 0 ? "chuva" : d <= 7 ? "nublado" : "aberto";
}
/** As parcelas que importam agora: todas as atrasadas; as de hoje; as dos próximos 7 dias; ou só a próxima. */
export function emFoco(r: Pick<Recebivel, "parcelas">, hoje = hojeIso()): ParcelaN[] {
  const c = climaReceber(r, hoje), ab = emAberto(r);
  if (c === "tempestade") return ab.filter((p) => p.venc < hoje);
  if (c === "chuva") return ab.filter((p) => p.venc === hoje);
  if (c === "nublado") return ab.filter((p) => p.venc <= somaDias(hoje, 7));
  return ab.slice(0, 1);
}
export function climaParcela(p: Pick<Parcela, "venc" | "recebidoEm">, hoje = hojeIso()): Clima {
  if (p.recebidoEm) return "sol";
  if (!p.venc) return "aberto";
  const d = diasEntre(hoje, p.venc);
  return d < 0 ? "tempestade" : d === 0 ? "chuva" : d <= 7 ? "nublado" : "aberto";
}
export function quandoParcela(p: Pick<Parcela, "venc" | "recebidoEm">, hoje = hojeIso()) {
  if (p.recebidoEm) return p.recebidoEm === hoje ? "recebida hoje" : `recebida em ${p.recebidoEm.slice(8, 10)}/${p.recebidoEm.slice(5, 7)}`;
  if (!p.venc) return "sem data";
  const d = diasEntre(hoje, p.venc);
  if (d < -1) return `atrasada há ${-d} dias`;
  if (d === -1) return "venceu ontem";
  if (d === 0) return "vence hoje";
  if (d === 1) return "vence amanhã";
  return `vence em ${d} dias`;
}

/** Mesmo dia nos meses seguintes (31/01 → 28/02 → 31/03). */
export function mesesDepois(base: string, k: number) {
  const [a, m, d] = base.split("-").map(Number);
  const ult = new Date(Date.UTC(a, m - 1 + k + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1 + k, Math.min(d, ult))).toISOString().slice(0, 10);
}
/** Divide o total em n parcelas mensais. Os centavos que sobram vão nas primeiras (1.000 em 3x → 333,34 · 333,33 · 333,33). */
export function dividir(total: number, n: number, primeiro: string): { venc: string; valor: number }[] {
  const q = Math.max(1, Math.min(MAX_PARCELAS, Math.floor(n) || 1));
  const c = Math.round(total * 100), base = Math.floor(c / q), resto = c - base * q;
  return Array.from({ length: q }, (_, i) => ({ venc: primeiro ? mesesDepois(primeiro, i) : "", valor: (base + (i < resto ? 1 : 0)) / 100 }));
}

/* ─── ao vivo ─── */
const ordenar = (a: Recebivel, b: Recebivel) => (proxima(a)?.venc || "9").localeCompare(proxima(b)?.venc || "9") || a.devedor.localeCompare(b.devedor, "pt-BR");

/** Todos com alguma parcela em aberto. */
export function useReceberAbertos(ligado = true) {
  const [lista, setLista] = useState<Recebivel[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!ligado) return;
    return onSnapshot(query(collection(db, "receber"), where("situacao", "==", "aberto")), (s) => {
      setLista(s.docs.map((d) => docParaRecebivel(d.id, d.data())).sort(ordenar));
      setErro("");
    }, (e) => { setLista([]); setErro(e.code === "permission-denied" ? "Seu acesso não permite ver os valores a receber." : "Não consegui carregar os valores a receber."); });
  }, [ligado]);
  return { lista, erro };
}

/** Os que tiveram alguma parcela recebida no mês (AAAA-MM). */
export function useRecebidosNoMes(mes: string) {
  const [lista, setLista] = useState<Recebivel[] | null>(null);
  useEffect(() => {
    setLista(null);
    return onSnapshot(query(collection(db, "receber"), where("mesesRecebidos", "array-contains", mes)), (s) =>
      setLista(s.docs.map((d) => docParaRecebivel(d.id, d.data()))), () => setLista([]));
  }, [mes]);
  return lista;
}
/** As parcelas recebidas no mês, uma por linha, da mais recente para a mais antiga. */
export function parcelasRecebidasNoMes(lista: Recebivel[], mes: string) {
  const out: { r: Recebivel; p: ParcelaN }[] = [];
  lista.forEach((r) => numeradas(r).forEach((p) => { if (p.recebidoEm?.startsWith(mes)) out.push({ r, p }); }));
  return out.sort((a, b) => (b.p.recebidoEm || "").localeCompare(a.p.recebidoEm || "") || a.r.devedor.localeCompare(b.r.devedor, "pt-BR"));
}

/* ─── gravação ─── */
const quem = (eu: Eu) => ({ pid: eu.pid, nome: eu.nome });
function limpo(d: DadosRecebivel) {
  const docu = lerDocumento(d.documento);
  const parcelas = d.parcelas
    .map((p) => ({ venc: iso(p.venc), valor: centavos(p.valor), recebidoEm: p.recebidoEm || null, valorRecebido: p.recebidoEm ? centavos(p.valorRecebido ?? p.valor) : null }))
    .sort(porVenc)
    .slice(0, MAX_PARCELAS);
  const abertas = parcelas.filter((p) => !p.recebidoEm);
  return {
    devedor: d.devedor.replace(/\s+/g, " ").trim().slice(0, 120),
    documento: docu.tipo ? docu.digitos : "",
    nascimento: docu.tipo === "cnpj" ? "" : iso(d.nascimento),
    telefone: soNumeros(d.telefone).slice(0, 15),
    referencia: d.referencia.replace(/\s+/g, " ").trim().slice(0, 160),
    obs: d.obs.trim().slice(0, 1000),
    parcelas,
    situacao: abertas.length ? "aberto" : "quitado",
    proxVenc: abertas.find((p) => p.venc)?.venc || null,
    mesesRecebidos: [...new Set(parcelas.filter((p) => p.recebidoEm).map((p) => p.recebidoEm!.slice(0, 7)))].sort(),
  };
}

export async function criarRecebivel(eu: Eu, d: DadosRecebivel) {
  const ref = await addDoc(collection(db, "receber"), {
    ...limpo(d), criadoPor: quem(eu), criadoEm: serverTimestamp(), atualizadoPor: quem(eu), atualizadoEm: serverTimestamp(),
  });
  return ref.id;
}
export async function salvarRecebivel(eu: Eu, id: string, d: DadosRecebivel) {
  await updateDoc(doc(db, "receber", id), { ...limpo(d), atualizadoPor: quem(eu), atualizadoEm: serverTimestamp() });
}
const dados = (r: Recebivel): DadosRecebivel => ({ devedor: r.devedor, documento: r.documento, nascimento: r.nascimento, telefone: r.telefone, referencia: r.referencia, obs: r.obs, parcelas: r.parcelas });

/**
 * Marca parcelas como recebidas. Com uma parcela só, o valor recebido pode ser outro;
 * se for menor e `restoEmAberto`, a diferença vira uma parcela nova em aberto, com o mesmo vencimento.
 */
export async function receberParcelas(eu: Eu, r: Recebivel, indices: number[], recebidoEm: string, valorUnico: number | null, restoEmAberto: boolean) {
  const parcelas = r.parcelas.map((p, i) => (indices.includes(i)
    ? { ...p, recebidoEm, valorRecebido: indices.length === 1 && valorUnico != null ? valorUnico : p.valor }
    : p));
  if (indices.length === 1 && valorUnico != null && restoEmAberto) {
    const p = r.parcelas[indices[0]], falta = centavos(p.valor - valorUnico);
    if (falta >= 0.01) {
      parcelas[indices[0]] = { ...parcelas[indices[0]], valor: valorUnico };
      parcelas.push({ venc: p.venc, valor: falta, recebidoEm: null, valorRecebido: null });
    }
  }
  await salvarRecebivel(eu, r.id, { ...dados(r), parcelas });
  return parcelas.every((p) => p.recebidoEm);
}
export async function desfazerRecebimento(eu: Eu, r: Recebivel, i: number) {
  const parcelas = r.parcelas.map((p, j) => (j === i ? { ...p, recebidoEm: null, valorRecebido: null } : p));
  await salvarRecebivel(eu, r.id, { ...dados(r), parcelas });
}
export async function excluirRecebivel(r: Recebivel) {
  await deleteDoc(doc(db, "receber", r.id));
}
