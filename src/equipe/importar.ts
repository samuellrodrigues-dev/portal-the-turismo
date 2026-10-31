/* ═══════════════════════════════════════════════════════════════
   Trazer os dados do site antigo da Oktoplus (Postgres/Neon) para cá.
   O arquivo vem do comando `node scripts/exportar-oktoplus.mjs`, rodado
   na pasta controle-oktoplus. Os IDs são fixos (c12, u340, e911…), então
   importar de novo não duplica nada: só regrava os mesmos documentos.
   ═══════════════════════════════════════════════════════════════ */
import {
  collection, doc, getCountFromServer, getDoc, getDocs, query, serverTimestamp, Timestamp, where, writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebase";
import { ABAS_VAZIAS, criarPessoa, docParaPessoa, type Eu, type Pessoa } from "./dados";
import { mesDe, mesesEntre } from "../lib/tempo";

type F = { id: number; nome: string; admin: boolean; ativo: boolean; aparelho: string | null };
type C = { id: number; titular: string; final_cpf: string | null; obs: string | null; ativa: boolean; esgotada_mes: string | null; esgotada_por: number | null; esgotada_em: string | null; criado_em: string | null };
type U = { id: number; conta_id: number; funcionario_id: number; aparelho: string | null; inicio: string; fim: string | null; fim_tipo: string | null; fim_por: number | null };
type E = { id: number; em: string; tipo: string; conta_id: number | null; funcionario_id: number | null; alvo_id: number | null; detalhe: string | null };
export type Exportacao = { origem: string; versao: number; exportadoEm: string; funcionarios: F[]; contas: C[]; usos: U[]; eventos: E[] };

export type Previa = { pessoas: number; ativas: number; contas: number; usos: number; abertos: number; eventos: number; exportadoEm: string; novas: string[]; jaExistem: string[] };
export type Resultado = { pins: { pid: string; nome: string; pin: string }[]; conferencia: { item: string; esperado: number; achado: number }[]; avisos: string[] };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const ts = (s: string | null | undefined) => (s ? Timestamp.fromDate(new Date(s)) : null);

export function lerArquivo(texto: string): Exportacao {
  let x: Exportacao;
  try { x = JSON.parse(texto); } catch { throw new Error("O arquivo não é um JSON válido."); }
  if (!x || x.origem !== "controle-oktoplus" || !Array.isArray(x.funcionarios) || !Array.isArray(x.contas) || !Array.isArray(x.usos) || !Array.isArray(x.eventos)) {
    throw new Error("Esse arquivo não é a exportação do Controle Oktoplus. Gere de novo com o comando do passo a passo.");
  }
  return x;
}

async function pessoasAtuais(): Promise<Pessoa[]> {
  const s = await getDocs(collection(db, "pessoas"));
  return s.docs.map((d) => docParaPessoa(d.id, d.data()));
}

const primeiro = (s: string) => norm(s).split(" ")[0];
/**
 * Quem já está cadastrado aqui: pelo vínculo de uma importação anterior, pelo nome igual,
 * ou pelo primeiro nome quando ele é único dos dois lados ("Samuel" = "Samuel Rodrigues").
 */
function casar(f: F, atuais: Pessoa[], todos: F[]) {
  const porId = atuais.find((p) => p.oktoId === f.id);
  if (porId) return porId;
  const igual = atuais.find((p) => norm(p.nome) === norm(f.nome) && p.oktoId == null);
  if (igual) return igual;
  const pn = primeiro(f.nome);
  const aqui = atuais.filter((p) => primeiro(p.nome) === pn && p.oktoId == null);
  const la = todos.filter((x) => primeiro(x.nome) === pn);
  return aqui.length === 1 && la.length === 1 ? aqui[0] : null;
}

export async function previa(x: Exportacao): Promise<Previa> {
  const atuais = await pessoasAtuais();
  const ativos = x.funcionarios.filter((f) => f.ativo);
  return {
    pessoas: x.funcionarios.length, ativas: ativos.length, contas: x.contas.length, usos: x.usos.length,
    abertos: x.usos.filter((u) => !u.fim).length, eventos: x.eventos.length, exportadoEm: x.exportadoEm,
    novas: ativos.filter((f) => !casar(f, atuais, x.funcionarios)).map((f) => f.nome),
    jaExistem: x.funcionarios.map((f) => ({ f, p: casar(f, atuais, x.funcionarios) })).filter((c) => c.p)
      .map((c) => (norm(c.f.nome) === norm(c.p!.nome) ? c.f.nome : `${c.f.nome} → ${c.p!.nome}`)),
  };
}

export async function jaImportado(): Promise<{ em: Date | null; por: string } | null> {
  const s = await getDoc(doc(db, "config", "oktoImportacao"));
  if (!s.exists()) return null;
  const d = s.data();
  return { em: d.em?.toDate?.() ?? null, por: d.por || "" };
}

/** Grava tudo em lotes (no máximo 450 gravações por vez). */
async function gravarEmLotes(itens: { caminho: [string, string]; dados: DocumentData }[], progresso: (feito: number) => void) {
  for (let i = 0; i < itens.length; i += 450) {
    const b = writeBatch(db);
    itens.slice(i, i + 450).forEach((it) => b.set(doc(db, it.caminho[0], it.caminho[1]), it.dados));
    await b.commit();
    progresso(Math.min(itens.length, i + 450));
  }
}

export async function importar(eu: Eu, x: Exportacao, progresso: (txt: string) => void): Promise<Resultado> {
  const avisos: string[] = [];
  const pins: { pid: string; nome: string; pin: string }[] = [];

  // 1. pessoas: quem já existe aqui (ex.: você) é ligado pelo nome; as outras ganham PIN novo
  progresso("Cadastrando a equipe…");
  const atuais = await pessoasAtuais();
  const mapa = new Map<number, { pid: string; nome: string }>();
  for (const f of x.funcionarios) {
    const ja = casar(f, atuais, x.funcionarios);
    if (ja) {
      mapa.set(f.id, { pid: ja.id, nome: ja.nome });
      const b = writeBatch(db);
      b.update(doc(db, "pessoas", ja.id), { oktoId: f.id, ...(ja.aparelho || !f.aparelho ? {} : { aparelho: f.aparelho }), atualizadoEm: serverTimestamp() });
      await b.commit();
      continue;
    }
    if (!f.ativo) {
      // quem saiu da equipe não ganha login; fica só para o histórico mostrar o nome
      const pid = `okto-${f.id}`;
      const b = writeBatch(db);
      b.set(doc(db, "pessoas", pid), {
        nome: f.nome, uid: "", login: "", admin: false, ativo: false, abas: ABAS_VAZIAS, aparelho: f.aparelho || "", pinDigitos: 4,
        oktoId: f.id, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp(),
      });
      await b.commit();
      mapa.set(f.id, { pid, nome: f.nome });
      continue;
    }
    progresso(`Cadastrando ${f.nome}…`);
    const abas = { ...ABAS_VAZIAS, oktoplus: f.admin ? ("admin" as const) : ("usar" as const) };
    const r = await criarPessoa({ nome: f.nome, admin: false, abas, aparelho: f.aparelho || "", oktoId: f.id });
    mapa.set(f.id, { pid: r.pid, nome: f.nome });
    pins.push({ pid: r.pid, nome: f.nome, pin: r.pin });
  }
  const q = (id: number | null) => (id != null && mapa.has(id) ? mapa.get(id)! : null);

  // 2. contas, usos e registro
  const contas = new Map(x.contas.map((c) => [c.id, c]));
  const abertoPorConta = new Map(x.usos.filter((u) => !u.fim).map((u) => [u.conta_id, u]));
  const itens: { caminho: [string, string]; dados: DocumentData }[] = [];
  for (const c of x.contas) {
    const u = abertoPorConta.get(c.id);
    const dono = u ? q(u.funcionario_id) : null;
    itens.push({
      caminho: ["okto_contas", `c${c.id}`],
      dados: {
        titular: c.titular, final: c.final_cpf || "", obs: c.obs || "", ativa: c.ativa,
        esgotadaMes: c.esgotada_mes || null, esgotadaPor: q(c.esgotada_por), esgotadaEm: ts(c.esgotada_em),
        uso: u && dono ? { id: `u${u.id}`, pid: dono.pid, nome: dono.nome, aparelho: u.aparelho || "", inicio: ts(u.inicio) } : null,
        criadoEm: ts(c.criado_em) || serverTimestamp(), legadoId: c.id,
      },
    });
  }
  for (const u of x.usos) {
    const c = contas.get(u.conta_id), p = q(u.funcionario_id);
    if (!p) { avisos.push(`Uso ${u.id} sem pessoa conhecida; ficou de fora.`); continue; }
    const ini = new Date(u.inicio), fim = u.fim ? new Date(u.fim) : null;
    itens.push({
      caminho: ["okto_usos", `u${u.id}`],
      dados: {
        contaId: `c${u.conta_id}`, titular: c?.titular || "conta removida", final: c?.final_cpf || "", pid: p.pid, nome: p.nome,
        aparelho: u.aparelho || "", inicio: ts(u.inicio), fim: ts(u.fim), fimTipo: u.fim_tipo || null, fimPor: q(u.fim_por),
        meses: mesesEntre(ini, fim || new Date()), legadoId: u.id,
      },
    });
  }
  for (const e of x.eventos) {
    const c = e.conta_id != null ? contas.get(e.conta_id) : null;
    itens.push({
      caminho: ["okto_eventos", `e${e.id}`],
      dados: {
        em: ts(e.em), mes: mesDe(new Date(e.em)), tipo: e.tipo, contaId: e.conta_id != null ? `c${e.conta_id}` : null,
        conta: c?.titular ?? null, final: c?.final_cpf || "", quem: q(e.funcionario_id), alvo: q(e.alvo_id), detalhe: e.detalhe || null, legadoId: e.id,
      },
    });
  }
  const total = itens.length;
  await gravarEmLotes(itens, (n) => progresso(`Gravando contas e histórico… ${n} de ${total}`));

  // 3. marca da importação + registro
  const b = writeBatch(db);
  const resumo = `${x.contas.length} contas, ${x.usos.length} usos, ${x.eventos.length} registros`;
  b.set(doc(db, "config", "oktoImportacao"), { em: serverTimestamp(), por: eu.nome, exportadoEm: x.exportadoEm, resumo });
  b.set(doc(collection(db, "okto_eventos")), {
    em: serverTimestamp(), mes: mesDe(new Date()), tipo: "importado", contaId: null, conta: null, final: "",
    quem: { pid: eu.pid, nome: eu.nome }, alvo: null, detalhe: resumo,
  });
  await b.commit();

  // 4. conferência: conta o que ficou gravado
  progresso("Conferindo…");
  const contar = async (c: string) => (await getCountFromServer(query(collection(db, c), where("legadoId", ">=", 0)))).data().count;
  const usosEsperados = x.usos.filter((u) => q(u.funcionario_id)).length;
  const conferencia = [
    { item: "Contas", esperado: x.contas.length, achado: await contar("okto_contas") },
    { item: "Usos", esperado: usosEsperados, achado: await contar("okto_usos") },
    { item: "Registros", esperado: x.eventos.length, achado: await contar("okto_eventos") },
    { item: "Pessoas", esperado: x.funcionarios.length, achado: (await getCountFromServer(query(collection(db, "pessoas"), where("oktoId", ">=", 0)))).data().count },
  ];
  return { pins, conferencia, avisos };
}
