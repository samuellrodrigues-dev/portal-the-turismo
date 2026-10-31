import {
  collection, doc, onSnapshot, query, where, runTransaction, serverTimestamp, updateDoc,
  type DocumentData, type Timestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../firebase";
import type { Eu } from "../../equipe/dados";
import { mesAtual, mesesEntre } from "../../lib/tempo";

/* ═════════════════ Tipos ═════════════════ */
export type Quem = { pid: string; nome: string };
export type UsoAberto = { id: string; pid: string; nome: string; aparelho: string; inicio: Date };
export type Conta = {
  id: string; titular: string; final: string; obs: string; ativa: boolean;
  esgotadaMes: string | null; esgotadaPor: Quem | null; esgotadaEm: Date | null;
  uso: UsoAberto | null; esgotada: boolean;
};
export type FimTipo = "devolvida" | "esgotou" | "liberada";
export type UsoHist = {
  id: string; contaId: string; titular: string; final: string; pid: string; nome: string; aparelho: string;
  inicio: Date; fim: Date | null; fimTipo: FimTipo | null; fimPor: Quem | null;
};
export type Evento = {
  id: string; em: Date; tipo: string; contaId: string | null; conta: string | null; final: string;
  quem: Quem | null; alvo: Quem | null; detalhe: string | null;
};

const data = (v: unknown): Date | null => (v && typeof (v as Timestamp).toDate === "function" ? (v as Timestamp).toDate() : null);
const quem = (v: unknown): Quem | null => (v && typeof v === "object" && (v as Quem).pid ? { pid: (v as Quem).pid, nome: (v as Quem).nome || "" } : null);

function docParaConta(id: string, x: DocumentData): Conta {
  const u = x.uso && typeof x.uso === "object" ? x.uso : null;
  const mes = mesAtual();
  return {
    id, titular: x.titular || "", final: x.final || "", obs: x.obs || "", ativa: x.ativa !== false,
    esgotadaMes: x.esgotadaMes || null, esgotadaPor: quem(x.esgotadaPor), esgotadaEm: data(x.esgotadaEm),
    uso: u ? { id: u.id, pid: u.pid, nome: u.nome || "", aparelho: u.aparelho || "", inicio: data(u.inicio) || new Date() } : null,
    esgotada: x.esgotadaMes === mes,
  };
}
function docParaUso(id: string, x: DocumentData): UsoHist {
  return {
    id, contaId: x.contaId || "", titular: x.titular || "", final: x.final || "", pid: x.pid || "", nome: x.nome || "",
    aparelho: x.aparelho || "", inicio: data(x.inicio) || new Date(0), fim: data(x.fim), fimTipo: x.fimTipo || null, fimPor: quem(x.fimPor),
  };
}
function docParaEvento(id: string, x: DocumentData): Evento {
  return {
    id, em: data(x.em) || new Date(0), tipo: x.tipo || "", contaId: x.contaId || null, conta: x.conta || null, final: x.final || "",
    quem: quem(x.quem), alvo: quem(x.alvo), detalhe: x.detalhe || null,
  };
}

export const ordenarContas = (a: Conta, b: Conta) =>
  a.titular.localeCompare(b.titular, "pt-BR", { sensitivity: "base" }) || a.final.localeCompare(b.final) || a.id.localeCompare(b.id);
export const nomeConta = (titular: string | null, final: string) => (titular ? (final ? `${titular} •••${final}` : titular) : "conta removida");

/* ═════════════════ Leitura ao vivo ═════════════════ */

/** Todas as contas, atualizando sozinho quando alguém pega ou devolve. */
export function useContas() {
  const [contas, setContas] = useState<Conta[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => onSnapshot(collection(db, "okto_contas"), (s) => {
    setContas(s.docs.map((d) => docParaConta(d.id, d.data())).sort(ordenarContas));
    setErro("");
  }, (e) => setErro(e.code === "permission-denied" ? "Seu acesso não permite ver as contas." : "Não consegui carregar as contas.")), []);
  return { contas, erro };
}

/** Usos e registro de um mês (para o histórico do administrador). */
export function useHistorico(mes: string) {
  const [usos, setUsos] = useState<UsoHist[] | null>(null);
  const [abertos, setAbertos] = useState<UsoHist[]>([]);
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  useEffect(() => {
    setUsos(null); setEventos(null);
    const a = onSnapshot(query(collection(db, "okto_usos"), where("meses", "array-contains", mes)), (s) => setUsos(s.docs.map((d) => docParaUso(d.id, d.data()))), () => setUsos([]));
    const b = onSnapshot(query(collection(db, "okto_usos"), where("fim", "==", null)), (s) => setAbertos(s.docs.map((d) => docParaUso(d.id, d.data()))), () => setAbertos([]));
    const c = onSnapshot(query(collection(db, "okto_eventos"), where("mes", "==", mes)), (s) =>
      setEventos(s.docs.map((d) => docParaEvento(d.id, d.data())).sort((x, y) => y.em.getTime() - x.em.getTime() || y.id.localeCompare(x.id))), () => setEventos([]));
    return () => { a(); b(); c(); };
  }, [mes]);
  // usos ainda abertos que começaram antes deste mês também contam no mês
  const lista = usos ? (() => {
    const m = new Map(usos.map((u) => [u.id, u]));
    abertos.forEach((u) => { if (!m.has(u.id) && mesesEntre(u.inicio, new Date()).includes(mes)) m.set(u.id, u); });
    return [...m.values()].sort((x, y) => y.inicio.getTime() - x.inicio.getTime() || y.id.localeCompare(x.id));
  })() : null;
  return { usos: lista, eventos };
}

/* ═════════════════ Ações ═════════════════ */

const eu$ = (eu: Eu): Quem => ({ pid: eu.pid, nome: eu.nome });

function novoEvento(tx: Parameters<Parameters<typeof runTransaction>[1]>[0], e: Omit<Evento, "id" | "em"> & { mes?: string }) {
  tx.set(doc(collection(db, "okto_eventos")), {
    em: serverTimestamp(), mes: e.mes || mesAtual(), tipo: e.tipo, contaId: e.contaId, conta: e.conta, final: e.final,
    quem: e.quem, alvo: e.alvo, detalhe: e.detalhe,
  });
}

export async function pegar(eu: Eu, contaId: string, aparelho: string): Promise<string> {
  const ap = aparelho.replace(/\s+/g, " ").trim().slice(0, 40);
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "okto_contas", contaId);
    const s = await tx.get(ref);
    if (!s.exists() || s.data().ativa === false) throw new Error("Conta não encontrada.");
    const c = docParaConta(s.id, s.data());
    if (c.esgotada) throw new Error(`${c.titular} já está esgotada neste mês.`);
    if (c.uso) throw new Error(c.uso.pid === eu.pid ? `Você já está com ${c.titular}.` : `${c.titular} já está com ${c.uso.nome}.`);
    const usoRef = doc(collection(db, "okto_usos"));
    tx.update(ref, { uso: { id: usoRef.id, pid: eu.pid, nome: eu.nome, aparelho: ap, inicio: serverTimestamp() } });
    tx.set(usoRef, {
      contaId, titular: c.titular, final: c.final, pid: eu.pid, nome: eu.nome, aparelho: ap,
      inicio: serverTimestamp(), fim: null, fimTipo: null, fimPor: null, meses: [mesAtual()],
    });
    novoEvento(tx, { tipo: "pegou", contaId, conta: c.titular, final: c.final, quem: eu$(eu), alvo: null, detalhe: ap || null });
    return `Você está com ${c.titular}.`;
  });
}

/** Devolver (quem estava), liberar (administrador tirando de outra pessoa) ou esgotou. */
export async function fechar(eu: Eu, contaId: string, esgotou: boolean, souAdmin: boolean): Promise<string> {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "okto_contas", contaId);
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error("Conta não encontrada.");
    const c = docParaConta(s.id, s.data());
    const u = c.uso;
    if (!u) throw new Error("Essa conta já foi devolvida.");
    const meu = u.pid === eu.pid;
    if (!meu && !souAdmin) throw new Error(`Essa conta está com ${u.nome}. Só ${u.nome} ou o administrador podem mexer.`);
    const tipo: FimTipo = esgotou ? "esgotou" : meu ? "devolvida" : "liberada";
    const mud: DocumentData = { uso: null };
    if (esgotou) Object.assign(mud, { esgotadaMes: mesAtual(), esgotadaPor: eu$(eu), esgotadaEm: serverTimestamp() });
    tx.update(ref, mud);
    tx.update(doc(db, "okto_usos", u.id), { fim: serverTimestamp(), fimTipo: tipo, fimPor: eu$(eu), meses: mesesEntre(u.inicio, new Date()) });
    const holder = { pid: u.pid, nome: u.nome };
    novoEvento(tx, { tipo: esgotou ? "esgotou" : meu ? "devolveu" : "liberou", contaId, conta: c.titular, final: c.final, quem: eu$(eu), alvo: holder, detalhe: null });
    if (esgotou) return `${c.titular} marcada como esgotada até o fim do mês.`;
    return meu ? `Você devolveu ${c.titular}.` : `${c.titular} liberada (estava com ${u.nome}).`;
  });
}

/** Administrador: marca como esgotada (e fecha o uso aberto, se houver). */
export async function marcarEsgotada(eu: Eu, contaId: string): Promise<string> {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "okto_contas", contaId);
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error("Conta não encontrada.");
    const c = docParaConta(s.id, s.data());
    if (c.uso) tx.update(doc(db, "okto_usos", c.uso.id), { fim: serverTimestamp(), fimTipo: "esgotou", fimPor: eu$(eu), meses: mesesEntre(c.uso.inicio, new Date()) });
    tx.update(ref, { uso: null, esgotadaMes: mesAtual(), esgotadaPor: eu$(eu), esgotadaEm: serverTimestamp() });
    novoEvento(tx, { tipo: "esgotou", contaId, conta: c.titular, final: c.final, quem: eu$(eu), alvo: c.uso ? { pid: c.uso.pid, nome: c.uso.nome } : null, detalhe: null });
    return `${c.titular} marcada como esgotada.`;
  });
}

export async function desmarcarEsgotada(eu: Eu, contaId: string): Promise<string> {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "okto_contas", contaId);
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error("Conta não encontrada.");
    const c = docParaConta(s.id, s.data());
    tx.update(ref, { esgotadaMes: null, esgotadaPor: null, esgotadaEm: null });
    novoEvento(tx, { tipo: "reabriu", contaId, conta: c.titular, final: c.final, quem: eu$(eu), alvo: null, detalhe: null });
    return `${c.titular} voltou a ficar disponível.`;
  });
}

export async function salvarConta(eu: Eu, id: string | null, v: { titular: string; final: string; obs: string; ativa: boolean }): Promise<string> {
  const titular = v.titular.replace(/\s+/g, " ").trim().slice(0, 60);
  const final = v.final.replace(/\D/g, "").slice(0, 4);
  const obs = v.obs.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!titular) throw new Error("Digite o nome do titular da conta.");
  return runTransaction(db, async (tx) => {
    if (!id) {
      const ref = doc(collection(db, "okto_contas"));
      tx.set(ref, { titular, final, obs, ativa: true, uso: null, esgotadaMes: null, esgotadaPor: null, esgotadaEm: null, criadoEm: serverTimestamp() });
      novoEvento(tx, { tipo: "conta_criada", contaId: ref.id, conta: titular, final, quem: eu$(eu), alvo: null, detalhe: null });
      return `Conta ${titular} cadastrada.`;
    }
    const ref = doc(db, "okto_contas", id);
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error("Conta não encontrada.");
    const antes = docParaConta(s.id, s.data());
    const mud: DocumentData = { titular, final, obs, ativa: v.ativa };
    if (antes.ativa && !v.ativa && antes.uso) {
      tx.update(doc(db, "okto_usos", antes.uso.id), { fim: serverTimestamp(), fimTipo: "liberada", fimPor: eu$(eu), meses: mesesEntre(antes.uso.inicio, new Date()) });
      mud.uso = null;
    }
    tx.update(ref, mud);
    novoEvento(tx, {
      tipo: "conta_editada", contaId: id, conta: titular, final, quem: eu$(eu), alvo: null,
      detalhe: antes.ativa && !v.ativa ? "desativada" : !antes.ativa && v.ativa ? "reativada" : null,
    });
    return `Conta ${titular} salva.`;
  });
}

/** Aparelho de costume da pessoa (sugerido ao pegar uma conta). */
export async function lembrarAparelho(eu: Eu, aparelho: string) {
  try { await updateDoc(doc(db, "pessoas", eu.pid), { aparelho: aparelho.slice(0, 40), atualizadoEm: serverTimestamp() }); } catch { /* não é importante */ }
}
