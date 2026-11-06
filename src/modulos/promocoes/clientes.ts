/* ═══════════════════════════════════════════════════════════════
   Milhas recebidas de clientes (dentro da aba Milhas): quem passou
   milhas para a agência, de qual programa, quantas, quando e por quanto.
   Um documento por recebimento na coleção "milhas_clientes".
   Quem vê e quem edita é o acesso "Milhas de clientes" da Equipe
   (abas.milhas), garantido nas regras do Firestore.
   ═══════════════════════════════════════════════════════════════ */
import {
  addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
  type DocumentData, type Timestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../firebase";
import type { Eu } from "../../equipe/dados";
import { lerDocumento, soNumeros } from "../../lib/documento";

/** Os programas que mais aparecem; "Outro" deixa escrever qualquer nome. */
export const PROGRAMAS = ["Smiles", "LATAM Pass", "Azul Fidelidade", "TAP Miles&Go", "AAdvantage", "Livelo", "Esfera"];
export const MAX_MILHAS = 100_000_000;
export const MAX_VALOR = 10_000_000;
const LIMITE = 3000;

export type Recebimento = {
  id: string; cliente: string; documento: string; programa: string; quantidade: number; data: string;
  valor: number | null; obs: string; criadoPor: string; criadoEm: Date | null; atualizadoPor: string; atualizadoEm: Date | null;
};
export type DadosRecebimento = Pick<Recebimento, "cliente" | "documento" | "programa" | "quantidade" | "data" | "valor" | "obs">;

export const MIL = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
/** Quanto saiu cada mil milhas (só quando há valor). */
export const milheiro = (r: { quantidade: number; valor: number | null }) =>
  r.valor != null && r.quantidade > 0 ? Math.round((r.valor / r.quantidade) * 1000 * 100) / 100 : null;

/* ─── leitura ─── */
const quando = (v: unknown): Date | null => (v && typeof (v as Timestamp).toDate === "function" ? (v as Timestamp).toDate() : null);
const nome = (v: unknown) => (v && typeof v === "object" ? String((v as { nome?: string }).nome || "") : "");
function docPara(id: string, x: DocumentData): Recebimento {
  return {
    id, cliente: x.cliente || "", documento: x.documento || "", programa: x.programa || "", quantidade: Number(x.quantidade) || 0,
    data: typeof x.data === "string" ? x.data : "", valor: typeof x.valor === "number" ? x.valor : null, obs: x.obs || "",
    criadoPor: nome(x.criadoPor), criadoEm: quando(x.criadoEm), atualizadoPor: nome(x.atualizadoPor), atualizadoEm: quando(x.atualizadoEm),
  };
}
/** Mais recentes primeiro; no mesmo dia, o último cadastrado em cima. */
const ordenar = (a: Recebimento, b: Recebimento) =>
  b.data.localeCompare(a.data) || (b.criadoEm?.getTime() ?? 0) - (a.criadoEm?.getTime() ?? 0);

export function useRecebimentos(ligado = true) {
  const [lista, setLista] = useState<Recebimento[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!ligado) return;
    return onSnapshot(query(collection(db, "milhas_clientes"), orderBy("data", "desc"), limit(LIMITE)), (s) => {
      setLista(s.docs.map((d) => docPara(d.id, d.data({ serverTimestamps: "estimate" }))).sort(ordenar));
      setErro("");
    }, (e) => {
      setLista([]);
      setErro(e.code === "permission-denied" ? "Seu acesso não permite ver as milhas de clientes." : "Não consegui carregar as milhas de clientes.");
    });
  }, [ligado]);
  return { lista, erro };
}

/* ─── gravação ─── */
const quem = (eu: Eu) => ({ pid: eu.pid, nome: eu.nome });

/** Confere e limpa o que veio do formulário (as regras do banco conferem de novo). */
export function limpar(d: DadosRecebimento) {
  const cliente = d.cliente.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!cliente) throw new Error("Digite o nome do cliente.");
  const docu = lerDocumento(d.documento);
  if (soNumeros(d.documento) && !(docu.tipo === "cpf" && docu.confere)) throw new Error("O CPF não confere. Confira os números ou deixe em branco.");
  const programa = d.programa.replace(/\s+/g, " ").trim().slice(0, 40);
  if (!programa) throw new Error("Escolha o programa das milhas.");
  if (!Number.isInteger(d.quantidade) || d.quantidade < 1) throw new Error("Digite a quantidade de milhas.");
  if (d.quantidade > MAX_MILHAS) throw new Error("Quantidade grande demais. Confira os números.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data)) throw new Error("Escolha a data em que as milhas foram recebidas.");
  if (d.valor != null && (!isFinite(d.valor) || d.valor < 0 || d.valor > MAX_VALOR)) throw new Error("Valor inválido. Use, por exemplo, 1.980,00.");
  return {
    cliente, documento: docu.tipo === "cpf" ? docu.digitos : "", programa, quantidade: d.quantidade, data: d.data,
    valor: d.valor == null ? null : Math.round(d.valor * 100) / 100, obs: d.obs.trim().slice(0, 500),
  };
}

export async function criarRecebimento(eu: Eu, d: DadosRecebimento) {
  const ref = await addDoc(collection(db, "milhas_clientes"), {
    ...limpar(d), criadoPor: quem(eu), criadoEm: serverTimestamp(), atualizadoPor: quem(eu), atualizadoEm: serverTimestamp(),
  });
  return ref.id;
}
export async function salvarRecebimento(eu: Eu, id: string, d: DadosRecebimento) {
  await updateDoc(doc(db, "milhas_clientes", id), { ...limpar(d), atualizadoPor: quem(eu), atualizadoEm: serverTimestamp() });
}
export async function excluirRecebimento(id: string) {
  await deleteDoc(doc(db, "milhas_clientes", id));
}
