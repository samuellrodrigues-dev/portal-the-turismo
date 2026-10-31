import { signOut } from "firebase/auth";
import { auth, limparCacheLocal } from "../firebase";
import { sinal } from "./sinal";
import { CHAVE_PINS } from "../equipe/pinsPendentes";

/** Sai e apaga a cópia local dos dados (computador compartilhado fica limpo). */
export async function sair() {
  sinal.saindo = true;
  try { await signOut(auth); } catch { /* segue */ }
  await limparCacheLocal();
  try { sessionStorage.removeItem(CHAVE_PINS); } catch { /* nada */ }
  location.hash = "";
  location.reload();
}
