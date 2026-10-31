/* ═══════════════════════════════════════════════════════════════
   PINs para entregar
   Todo PIN gerado (importação, "Gerar PIN novo", "Adicionar pessoa")
   vem para cá e fica no quadro até o administrador marcar que anotou.
   Mudar de aba ou recarregar a página não apaga. Fica só nesta aba do
   navegador (sessionStorage): fechar a aba ou clicar em Sair apaga.
   Os PINs nunca vão para o banco.
   ═══════════════════════════════════════════════════════════════ */
import { useSyncExternalStore } from "react";

export type PinPendente = { chave: string; nome: string; pin: string; em: number };

export const CHAVE_PINS = "tt-pins-pendentes";

function ler(): PinPendente[] {
  try {
    const s = sessionStorage.getItem(CHAVE_PINS);
    const x = s ? JSON.parse(s) : [];
    return Array.isArray(x) ? x.filter((i) => i && typeof i.pin === "string" && typeof i.nome === "string") : [];
  } catch { return []; }
}

let itens: PinPendente[] = ler();
const ouvintes = new Set<() => void>();
let ultimoAviso = 0;

function mudou() {
  try {
    if (itens.length) sessionStorage.setItem(CHAVE_PINS, JSON.stringify(itens));
    else sessionStorage.removeItem(CHAVE_PINS);
  } catch { /* sem armazenamento: fica só na memória, ainda sobrevive à troca de aba */ }
  ouvintes.forEach((f) => f());
}

/** Guarda um ou mais PINs. Se a pessoa já tinha um PIN no quadro, o novo substitui o antigo. */
export function guardarPins(novos: { chave: string; nome: string; pin: string }[]) {
  if (!novos.length) return;
  const agora = Date.now();
  const chaves = new Set(novos.map((n) => n.chave));
  itens = [...itens.filter((i) => !chaves.has(i.chave)), ...novos.map((n, k) => ({ ...n, em: agora + k }))];
  ultimoAviso = agora;
  mudou();
}

export function tirarPin(chave: string) {
  itens = itens.filter((i) => i.chave !== chave);
  mudou();
}

export function limparPins() {
  itens = [];
  mudou();
}

export function temPinsPendentes() { return itens.length > 0; }
/** Momento do último PIN guardado (o quadro usa para abrir sozinho e destacar). */
export function ultimoPinEm() { return ultimoAviso; }

const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
export function usePinsPendentes(): PinPendente[] {
  return useSyncExternalStore(assinar, () => itens, () => itens);
}
