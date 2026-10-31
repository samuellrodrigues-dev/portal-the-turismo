import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where,
  type DocumentData, type Timestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../firebase";
import type { Eu } from "../../equipe/dados";
import { diasEntre, hojeIso } from "../../lib/tempo";
import { excluirAnexo, type Anexo } from "./arquivos";

export type Boleto = {
  id: string; descricao: string; beneficiario: string; categoria: string; valor: number; vencimento: string;
  linha: string; emissor: string; status: "aberto" | "pago"; pagoEm: string | null; pagoMes: string | null; valorPago: number | null;
  obs: string; anexos: Anexo[]; criadoPor: string; atualizadoPor: string; atualizadoEm: Date | null;
};
export type Clima = "tempestade" | "chuva" | "nublado" | "aberto" | "sol";

export const CATEGORIAS = ["Aluguel", "Energia", "Água", "Internet e telefone", "Fornecedor", "Impostos", "Cartão", "Funcionários", "Sistemas", "Outros"];

const data = (v: unknown): Date | null => (v && typeof (v as Timestamp).toDate === "function" ? (v as Timestamp).toDate() : null);
function docParaBoleto(id: string, x: DocumentData): Boleto {
  return {
    id, descricao: x.descricao || "", beneficiario: x.beneficiario || "", categoria: x.categoria || "", valor: Number(x.valor) || 0,
    vencimento: x.vencimento || "", linha: x.linha || "", emissor: x.emissor || "", status: x.status === "pago" ? "pago" : "aberto",
    pagoEm: x.pagoEm || null, pagoMes: x.pagoMes || null, valorPago: typeof x.valorPago === "number" ? x.valorPago : null,
    obs: x.obs || "", anexos: Array.isArray(x.anexos) ? x.anexos : [], criadoPor: x.criadoPor?.nome || "",
    atualizadoPor: x.atualizadoPor?.nome || "", atualizadoEm: data(x.atualizadoEm),
  };
}

/** O "tempo" de cada boleto: tempestade (atrasado), chuva (vence hoje), nublado (até 7 dias), céu aberto (mais adiante), sol (pago). */
export function clima(b: Pick<Boleto, "status" | "vencimento">, hoje = hojeIso()): Clima {
  if (b.status === "pago") return "sol";
  const d = diasEntre(hoje, b.vencimento);
  if (d < 0) return "tempestade";
  if (d === 0) return "chuva";
  if (d <= 7) return "nublado";
  return "aberto";
}
export function quandoVence(b: Pick<Boleto, "status" | "vencimento" | "pagoEm">, hoje = hojeIso()) {
  if (b.status === "pago") return b.pagoEm ? (b.pagoEm === hoje ? "pago hoje" : `pago em ${b.pagoEm.slice(8, 10)}/${b.pagoEm.slice(5, 7)}`) : "pago";
  const d = diasEntre(hoje, b.vencimento);
  if (d < -1) return `atrasado há ${-d} dias`;
  if (d === -1) return "venceu ontem";
  if (d === 0) return "vence hoje";
  if (d === 1) return "vence amanhã";
  return `vence em ${d} dias`;
}

/** Todos os boletos em aberto, ao vivo. */
export function useAbertos(ligado = true) {
  const [lista, setLista] = useState<Boleto[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!ligado) return;
    return onSnapshot(query(collection(db, "boletos"), where("status", "==", "aberto")), (s) => {
      setLista(s.docs.map((d) => docParaBoleto(d.id, d.data())).sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.descricao.localeCompare(b.descricao, "pt-BR")));
      setErro("");
    }, (e) => setErro(e.code === "permission-denied" ? "Seu acesso não permite ver os boletos." : "Não consegui carregar os boletos."));
  }, [ligado]);
  return { lista, erro };
}

/** Pagos num mês (AAAA-MM). */
export function usePagos(mes: string) {
  const [lista, setLista] = useState<Boleto[] | null>(null);
  useEffect(() => {
    setLista(null);
    return onSnapshot(query(collection(db, "boletos"), where("pagoMes", "==", mes)), (s) =>
      setLista(s.docs.map((d) => docParaBoleto(d.id, d.data())).sort((a, b) => (b.pagoEm || "").localeCompare(a.pagoEm || "") || a.descricao.localeCompare(b.descricao, "pt-BR"))), () => setLista([]));
  }, [mes]);
  return lista;
}

export type DadosBoleto = Pick<Boleto, "descricao" | "beneficiario" | "categoria" | "valor" | "vencimento" | "linha" | "emissor" | "obs" | "anexos">;
const quem = (eu: Eu) => ({ pid: eu.pid, nome: eu.nome });
const limpo = (d: DadosBoleto) => ({
  descricao: d.descricao.replace(/\s+/g, " ").trim().slice(0, 160),
  beneficiario: d.beneficiario.replace(/\s+/g, " ").trim().slice(0, 160),
  categoria: d.categoria.replace(/\s+/g, " ").trim().slice(0, 40),
  valor: Math.round(d.valor * 100) / 100,
  vencimento: d.vencimento,
  linha: d.linha.replace(/\D/g, "").slice(0, 48),
  emissor: d.emissor.slice(0, 80),
  obs: d.obs.trim().slice(0, 1000),
  anexos: d.anexos.slice(0, 12),
});

export async function criarBoleto(eu: Eu, d: DadosBoleto) {
  const ref = await addDoc(collection(db, "boletos"), {
    ...limpo(d), status: "aberto", pagoEm: null, pagoMes: null, valorPago: null,
    criadoPor: quem(eu), criadoEm: serverTimestamp(), atualizadoPor: quem(eu), atualizadoEm: serverTimestamp(),
  });
  return ref.id;
}
export async function salvarBoleto(eu: Eu, id: string, d: DadosBoleto) {
  await updateDoc(doc(db, "boletos", id), { ...limpo(d), atualizadoPor: quem(eu), atualizadoEm: serverTimestamp() });
}
export async function marcarPago(eu: Eu, b: Boleto, pagoEm: string, valorPago: number, anexos: Anexo[]) {
  await updateDoc(doc(db, "boletos", b.id), {
    status: "pago", pagoEm, pagoMes: pagoEm.slice(0, 7), valorPago: Math.round(valorPago * 100) / 100, anexos: anexos.slice(0, 12),
    atualizadoPor: quem(eu), atualizadoEm: serverTimestamp(),
  });
}
export async function reabrir(eu: Eu, b: Boleto) {
  await updateDoc(doc(db, "boletos", b.id), { status: "aberto", pagoEm: null, pagoMes: null, valorPago: null, atualizadoPor: quem(eu), atualizadoEm: serverTimestamp() });
}
export async function excluirBoleto(b: Boleto) {
  for (const a of b.anexos) { try { await excluirAnexo(a.id); } catch { /* segue */ } }
  await deleteDoc(doc(db, "boletos", b.id));
}
/** Para contas que se repetem (aluguel, internet): mesmo boleto no mês seguinte, sem linha nem anexos. */
export async function repetirProximoMes(eu: Eu, b: Boleto) {
  const [a, m, d] = b.vencimento.split("-").map(Number);
  const ult = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  const nova = new Date(Date.UTC(a, m, Math.min(d, ult))).toISOString().slice(0, 10);
  return criarBoleto(eu, { ...b, vencimento: nova, linha: "", emissor: "", anexos: [], obs: b.obs });
}
