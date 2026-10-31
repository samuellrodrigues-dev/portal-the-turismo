/* ═══════════════════════════════════════════════════════════════
   Logins (CPF, senha e e-mail) das contas Oktoplus e de outros
   sistemas da agência. Ficam em okto_acessos: toda a equipe da
   Oktoplus lê; só quem administra a Oktoplus cadastra, edita e apaga
   (garantido nas regras do Firestore, não só na tela).
   Nada disso fica no código do site.
   ═══════════════════════════════════════════════════════════════ */
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, writeBatch,
  type DocumentData, type Timestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { mesAtual } from "../../lib/tempo";
import type { Eu } from "../../equipe/dados";
import type { Conta } from "./dados";

export type Acesso = {
  id: string; nome: string; cpf: string; senha: string; email: string; obs: string; ordem: number;
  atualizadoPor: string; atualizadoEm: Date | null;
};
export type NovoAcesso = { nome: string; cpf: string; senha: string; email: string; obs: string };

/* ─── CPF ─── */
export const soDigitos = (s: string) => (s || "").replace(/\D/g, "");
/** Planilha costuma comer o zero da frente (07800061353 vira 7800061353): devolve com 11 dígitos. */
export function normalizarCpf(s: string): string {
  const t = (s || "").trim();
  if (!t || /[a-z]/i.test(t)) return ""; // "*HOTELDO*", "-" etc. não são CPF
  const d = soDigitos(t);
  return d.length >= 9 && d.length <= 11 ? d.padStart(11, "0") : d;
}
export function cpfValido(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const n = d.split("").map(Number);
  for (const k of [9, 10]) {
    let s = 0;
    for (let i = 0; i < k; i++) s += n[i] * (k + 1 - i);
    if (((s * 10) % 11) % 10 !== n[k]) return false;
  }
  return true;
}
export const formatarCpf = (d: string) => (/^\d{11}$/.test(d) ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d);
export const ehContaOktoplus = (a: Pick<Acesso, "cpf">) => /^\d{11}$/.test(a.cpf);

/* ─── nomes ─── */
const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const primeiro = (s: string) => norm(s).split(" ")[0] || "";
/** "*HOTELDO*" → "HOTELDO" */
export const limparNome = (s: string) => (s || "").replace(/^[\s*_~-]+|[\s*_~-]+$/g, "").replace(/\s+/g, " ").trim();

/**
 * Qual login é de qual conta: mesmo final do CPF e mesmo primeiro nome
 * ("Maria O." ↔ "MARIA O" •••99; "Débora" ↔ "DÉBORA" •••41). Sem final, só pelo nome inteiro.
 */
export function acessoDaConta(c: Pick<Conta, "titular" | "final">, acessos: Acesso[]): Acesso | null {
  const contaFinal = soDigitos(c.final);
  const candidatos = acessos.filter((a) => ehContaOktoplus(a) && (contaFinal
    ? a.cpf.endsWith(contaFinal) && primeiro(a.nome) === primeiro(c.titular)
    : norm(a.nome) === norm(c.titular)));
  return candidatos.find((a) => norm(a.nome) === norm(c.titular)) || candidatos[0] || null;
}
export function contaDoAcesso(a: Acesso, contas: Conta[], acessos: Acesso[]): Conta | null {
  if (!ehContaOktoplus(a)) return null;
  return contas.find((c) => acessoDaConta(c, acessos)?.id === a.id) || null;
}

/* ─── leitura ao vivo ─── */
const data = (v: unknown): Date | null => (v && typeof (v as Timestamp).toDate === "function" ? (v as Timestamp).toDate() : null);
function docParaAcesso(id: string, x: DocumentData): Acesso {
  return {
    id, nome: x.nome || "", cpf: x.cpf || "", senha: x.senha || "", email: x.email || "", obs: x.obs || "",
    ordem: typeof x.ordem === "number" ? x.ordem : 0, atualizadoPor: x.atualizadoPor || "", atualizadoEm: data(x.atualizadoEm),
  };
}
export const ordenarAcessos = (a: Acesso, b: Acesso) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }) || a.cpf.localeCompare(b.cpf) || a.ordem - b.ordem;

export function useAcessos() {
  const [acessos, setAcessos] = useState<Acesso[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => onSnapshot(collection(db, "okto_acessos"), (s) => {
    setAcessos(s.docs.map((d) => docParaAcesso(d.id, d.data())).sort(ordenarAcessos));
    setErro("");
  }, (e) => { setAcessos([]); setErro(e.code === "permission-denied" ? "Seu acesso não permite ver os logins." : "Não consegui carregar os logins."); }), []);
  return { acessos, erro };
}

/* ─── gravação (administrador da Oktoplus) ─── */
function limpar(v: NovoAcesso) {
  return {
    nome: limparNome(v.nome).slice(0, 60),
    cpf: normalizarCpf(v.cpf).slice(0, 20),
    senha: (v.senha || "").trim().slice(0, 120),
    email: (v.email || "").trim().slice(0, 160),
    obs: (v.obs || "").trim().slice(0, 300),
  };
}
async function registrar(eu: Eu, detalhe: string) {
  try {
    await addDoc(collection(db, "okto_eventos"), {
      em: serverTimestamp(), mes: mesAtual(), tipo: "logins", contaId: null, conta: null, final: "",
      quem: { pid: eu.pid, nome: eu.nome }, alvo: null, detalhe,
    });
  } catch { /* o registro é só histórico: não impede a gravação */ }
}

export async function salvarAcesso(eu: Eu, atual: Acesso | null, v: NovoAcesso): Promise<string> {
  const x = limpar(v);
  if (!x.nome) throw new Error("Digite o nome do acesso.");
  const dados = { ...x, ordem: atual?.ordem ?? Date.now() % 1_000_000_000, atualizadoEm: serverTimestamp(), atualizadoPor: eu.nome };
  const ref = atual ? doc(db, "okto_acessos", atual.id) : doc(collection(db, "okto_acessos"));
  await setDoc(ref, dados);
  await registrar(eu, atual ? `editou o login de ${x.nome}` : `cadastrou o login de ${x.nome}`);
  return atual ? `Login de ${x.nome} salvo.` : `Login de ${x.nome} cadastrado.`;
}

export async function excluirAcesso(eu: Eu, a: Acesso): Promise<string> {
  await deleteDoc(doc(db, "okto_acessos", a.id));
  await registrar(eu, `apagou o login de ${a.nome}`);
  return `Login de ${a.nome} apagado.`;
}

/* ─── colar da planilha ─── */
export type LinhaPlanilha = NovoAcesso & { existente: Acesso | null };

/** Lê o que foi copiado da planilha (Google Planilhas ou Excel separam por tabulação; também aceita ; ou ,). */
export function lerPlanilha(texto: string, existentes: Acesso[]): { linhas: LinhaPlanilha[]; ignoradas: number } {
  const linhas: LinhaPlanilha[] = [];
  let ignoradas = 0;
  for (const bruta of texto.replace(/\r/g, "").split("\n")) {
    if (!bruta.trim()) continue;
    const sep = bruta.includes("\t") ? "\t" : bruta.includes(";") ? ";" : ",";
    const col = bruta.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, "$1").trim());
    const vazio = (s?: string) => (!s || /^[-–—]+$/.test(s) ? "" : s);
    const [nome, cpf, senha, email, obs] = [vazio(col[0]), vazio(col[1]), vazio(col[2]), vazio(col[3]), vazio(col[4])];
    if (/^acesso$/i.test(nome) && /cpf/i.test(cpf)) continue; // cabeçalho
    if (!limparNome(nome)) { ignoradas++; continue; }
    const x = limpar({ nome, cpf, senha, email, obs });
    const existente = existentes.find((a) => norm(a.nome) === norm(x.nome) && a.cpf === x.cpf) || null;
    linhas.push({ ...x, existente });
  }
  return { linhas, ignoradas };
}

export async function salvarPlanilha(eu: Eu, linhas: LinhaPlanilha[]): Promise<string> {
  const b = writeBatch(db);
  let novos = 0, atualizados = 0;
  linhas.forEach((l, i) => {
    const ref = l.existente ? doc(db, "okto_acessos", l.existente.id) : doc(collection(db, "okto_acessos"));
    if (l.existente) atualizados++; else novos++;
    b.set(ref, {
      nome: l.nome, cpf: l.cpf, senha: l.senha, email: l.email, obs: l.obs || l.existente?.obs || "",
      ordem: l.existente?.ordem ?? i, atualizadoEm: serverTimestamp(), atualizadoPor: eu.nome,
    });
  });
  await b.commit();
  const partes = [novos ? `${novos} novo${novos > 1 ? "s" : ""}` : "", atualizados ? `${atualizados} atualizado${atualizados > 1 ? "s" : ""}` : ""].filter(Boolean).join(" e ");
  await registrar(eu, `colou ${linhas.length} logins da planilha (${partes})`);
  return `Logins salvos: ${partes}.`;
}
