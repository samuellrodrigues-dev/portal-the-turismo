/* Preferência de cada computador: animações do fundo ligadas ou desligadas (fica guardada no navegador). */
import { useSyncExternalStore } from "react";

const CHAVE = "tt-animacao";
const ler = () => { try { return localStorage.getItem(CHAVE) !== "desligada"; } catch { return true; } };
let ligada = ler();
const ouvintes = new Set<() => void>();

export function definirAnimacao(v: boolean) {
  ligada = v;
  try { if (v) localStorage.removeItem(CHAVE); else localStorage.setItem(CHAVE, "desligada"); } catch { /* sem armazenamento: vale só nesta página */ }
  ouvintes.forEach((f) => f());
}

const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
export function useAnimacaoLigada() { return useSyncExternalStore(assinar, () => ligada, () => ligada); }
