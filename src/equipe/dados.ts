import {
  doc, getDoc, runTransaction, serverTimestamp, writeBatch, type DocumentData,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword, EmailAuthProvider, reauthenticateWithCredential, updatePassword,
} from "firebase/auth";
import { auth, db, comAuthSeparado } from "../firebase";

/* ═════════════════ Tipos ═════════════════ */

export type NivelOkto = "" | "usar" | "admin";
export type NivelVip = "" | "operador" | "admin";
export type NivelBoletos = "" | "ver" | "editar";
export type NivelOperacao = "" | "ver";
export type Abas = { oktoplus: NivelOkto; salavip: NivelVip; boletos: NivelBoletos; operacao: NivelOperacao };
export type ModuloId = keyof Abas;

/** Quem está usando o sistema agora (documento uids/{uid}). */
export type Eu = { uid: string; pid: string; nome: string; admin: boolean; ativo: boolean; abas: Abas };

/** Entrada da lista pública da tela de login (sem dados pessoais). */
export type PessoaPublica = { id: string; nome: string; login: string; d: number };

export type Pessoa = {
  id: string; nome: string; uid: string; login: string; admin: boolean; ativo: boolean; abas: Abas;
  aparelho: string; pinDigitos: number; oktoId?: number | null;
};

export const ABAS_VAZIAS: Abas = { oktoplus: "", salavip: "", boletos: "", operacao: "" };
export const ABAS_TODAS: Abas = { oktoplus: "admin", salavip: "admin", boletos: "editar", operacao: "ver" };

export const MODULOS: { id: ModuloId; nome: string; niveis: [string, string][] }[] = [
  { id: "oktoplus", nome: "Oktoplus", niveis: [["", "Sem acesso"], ["usar", "Usar contas"], ["admin", "Administrar"]] },
  { id: "salavip", nome: "Sala VIP", niveis: [["", "Sem acesso"], ["operador", "Operador"], ["admin", "Administrar"]] },
  { id: "boletos", nome: "Valores a receber", niveis: [["", "Sem acesso"], ["ver", "Só ver"], ["editar", "Cadastrar e editar"]] },
  { id: "operacao", nome: "Operação", niveis: [["", "Sem acesso"], ["ver", "Ver o atalho"]] },
];

/** O que a pessoa pode em cada aba (administrador pode tudo). */
export const nivel = <K extends ModuloId>(eu: Pick<Eu, "admin" | "abas">, m: K): Abas[K] =>
  (eu.admin ? ABAS_TODAS[m] : (eu.abas?.[m] ?? "")) as Abas[K];

export function normalizarAbas(a: Partial<Abas> | undefined | null): Abas {
  const x = a || {};
  return {
    oktoplus: x.oktoplus === "usar" || x.oktoplus === "admin" ? x.oktoplus : "",
    salavip: x.salavip === "operador" || x.salavip === "admin" ? x.salavip : "",
    boletos: x.boletos === "ver" || x.boletos === "editar" ? x.boletos : "",
    operacao: x.operacao === "ver" ? "ver" : "",
  };
}

export function docParaPessoa(id: string, x: DocumentData): Pessoa {
  return {
    id, nome: x.nome || "", uid: x.uid || "", login: x.login || "", admin: !!x.admin, ativo: x.ativo !== false,
    abas: normalizarAbas(x.abas), aparelho: x.aparelho || "", pinDigitos: Number(x.pinDigitos) || 4, oktoId: x.oktoId ?? null,
  };
}

/* ═════════════════ PIN e login ═════════════════
   Cada pessoa tem uma conta no Firebase Authentication com um e-mail interno
   (que ninguém precisa saber) e uma senha derivada do PIN. Nenhum e-mail é enviado. */

const DOMINIO = "pin.theturismo.example";
export const emailDe = (login: string) => `${login}@${DOMINIO}`;
export const senhaDe = (pin: string) => `tt-${pin}-pin`;

/** Mais de 4 números para quem vê dados de clientes ou administra. */
export const precisaPin6 = (admin: boolean, abas: Abas) =>
  admin || !!abas.salavip || !!abas.boletos || !!abas.operacao || abas.oktoplus === "admin";
export const digitosPara = (admin: boolean, abas: Abas) => (precisaPin6(admin, abas) ? 6 : 4);

const aleatorio = (n: number) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
export const pinFraco = (pin: string) =>
  /^(\d)\1+$/.test(pin) || "01234567890".includes(pin) || "09876543210".includes(pin);
export function gerarPin(digitos: number): string {
  let s = "";
  while (s.length < digitos) s += String(aleatorio(10));
  return pinFraco(s) ? gerarPin(digitos) : s;
}

function slug(nome: string) {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "pessoa";
}
const novoLogin = (nome: string) => `${slug(nome)}-${Array.from({ length: 6 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[aleatorio(31)]).join("")}`;
const novoPid = () => "p" + Date.now().toString(36) + Array.from({ length: 5 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[aleatorio(36)]).join("");

export function traduzirErroAuth(e: unknown): string {
  const c = (e as { code?: string })?.code || "";
  if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found" || c === "auth/invalid-login-credentials") return "PIN incorreto.";
  if (c === "auth/too-many-requests") return "Muitas tentativas erradas. Espere alguns minutos e tente de novo.";
  if (c === "auth/user-disabled") return "Esse acesso foi desativado.";
  if (c === "auth/network-request-failed" || c === "unavailable") return "Sem conexão com a internet.";
  if (c === "auth/requires-recent-login") return "Por segurança, saia e entre de novo antes de trocar o PIN.";
  if (c === "permission-denied") return "Seu acesso não permite essa ação.";
  return (e as Error)?.message || "Algo deu errado. Tente de novo.";
}

/* ═════════════════ Gravações ═════════════════ */

const publicoRef = () => doc(db, "publico", "equipe");

export async function lerPublico(): Promise<PessoaPublica[] | null> {
  const s = await getDoc(publicoRef());
  if (!s.exists()) return null;
  return (s.data().pessoas || []) as PessoaPublica[];
}

/** Primeiro acesso: cria o administrador e a lista da equipe. */
export async function configurarInicial(nome: string, pin: string) {
  const login = novoLogin(nome), pid = novoPid();
  const cred = await createUserWithEmailAndPassword(auth, emailDe(login), senhaDe(pin));
  const uid = cred.user.uid;
  const b = writeBatch(db);
  b.set(doc(db, "pessoas", pid), {
    nome, uid, login, admin: true, ativo: true, abas: ABAS_TODAS, aparelho: "", pinDigitos: pin.length,
    criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp(),
  });
  b.set(doc(db, "uids", uid), { pid, nome, admin: true, ativo: true, abas: ABAS_TODAS });
  b.set(publicoRef(), { pessoas: [{ id: pid, nome, login, d: pin.length }], atualizadoEm: serverTimestamp() });
  await b.commit();
}

type NovaPessoa = { nome: string; admin: boolean; abas: Abas; aparelho?: string; oktoId?: number | null; pin?: string };

/** Cadastra uma pessoa e devolve o PIN gerado (mostrado uma vez só). */
export async function criarPessoa(p: NovaPessoa): Promise<{ pid: string; pin: string }> {
  const pin = p.pin || gerarPin(digitosPara(p.admin, p.abas));
  const login = novoLogin(p.nome), pid = novoPid();
  const uid = await comAuthSeparado(async (a) => (await createUserWithEmailAndPassword(a, emailDe(login), senhaDe(pin))).user.uid);
  await runTransaction(db, async (tx) => {
    const pub = await tx.get(publicoRef());
    const lista = ((pub.data()?.pessoas || []) as PessoaPublica[]).filter((x) => x.id !== pid);
    lista.push({ id: pid, nome: p.nome, login, d: pin.length });
    lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    tx.set(doc(db, "pessoas", pid), {
      nome: p.nome, uid, login, admin: p.admin, ativo: true, abas: p.abas, aparelho: p.aparelho || "", pinDigitos: pin.length,
      oktoId: p.oktoId ?? null, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp(),
    });
    tx.set(doc(db, "uids", uid), { pid, nome: p.nome, admin: p.admin, ativo: true, abas: p.abas });
    tx.update(publicoRef(), { pessoas: lista, atualizadoEm: serverTimestamp() });
  });
  return { pid, pin };
}

/** Muda nome, papel, abas, aparelho ou se está ativa. */
export async function atualizarPessoa(p: Pessoa, mud: Partial<Pick<Pessoa, "nome" | "admin" | "abas" | "ativo" | "aparelho">>) {
  const n = { ...p, ...mud };
  await runTransaction(db, async (tx) => {
    const pub = await tx.get(publicoRef());
    let lista = ((pub.data()?.pessoas || []) as PessoaPublica[]).filter((x) => x.id !== p.id);
    // quem não tem login (ex.: veio do histórico antigo) não aparece na entrada
    const ativo = n.ativo && !!p.uid;
    if (ativo) lista.push({ id: p.id, nome: n.nome, login: n.login, d: n.pinDigitos });
    lista = lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    tx.update(doc(db, "pessoas", p.id), {
      nome: n.nome, admin: n.admin, abas: n.abas, ativo, aparelho: n.aparelho, atualizadoEm: serverTimestamp(),
    });
    if (p.uid) tx.set(doc(db, "uids", p.uid), { pid: p.id, nome: n.nome, admin: n.admin, ativo, abas: n.abas });
    tx.update(publicoRef(), { pessoas: lista, atualizadoEm: serverTimestamp() });
  });
}

/**
 * PIN novo para outra pessoa. Sem servidor não dá para trocar a senha de outra conta,
 * então o sistema cria um login novo e desliga o antigo (ele deixa de ter qualquer acesso).
 */
export async function novoPinPara(p: Pessoa, digitos?: number): Promise<string> {
  const pin = gerarPin(digitos || digitosPara(p.admin, p.abas));
  const login = novoLogin(p.nome);
  const uid = await comAuthSeparado(async (a) => (await createUserWithEmailAndPassword(a, emailDe(login), senhaDe(pin))).user.uid);
  await runTransaction(db, async (tx) => {
    const pub = await tx.get(publicoRef());
    const lista = ((pub.data()?.pessoas || []) as PessoaPublica[]).filter((x) => x.id !== p.id);
    lista.push({ id: p.id, nome: p.nome, login, d: pin.length });
    lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    // PIN novo também serve para dar login a quem ainda não tinha (e reativa a pessoa)
    tx.update(doc(db, "pessoas", p.id), { uid, login, pinDigitos: pin.length, ativo: true, atualizadoEm: serverTimestamp() });
    if (p.uid) tx.delete(doc(db, "uids", p.uid));
    tx.set(doc(db, "uids", uid), { pid: p.id, nome: p.nome, admin: p.admin, ativo: true, abas: p.abas });
    tx.update(publicoRef(), { pessoas: lista, atualizadoEm: serverTimestamp() });
  });
  return pin;
}

/** A própria pessoa troca o PIN (mesma quantidade de números, por causa da tela de entrada). */
export async function trocarMeuPin(atual: string, novo: string) {
  const u = auth.currentUser;
  if (!u || !u.email) throw new Error("Entre de novo para trocar o PIN.");
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, senhaDe(atual)));
  await updatePassword(u, senhaDe(novo));
}
