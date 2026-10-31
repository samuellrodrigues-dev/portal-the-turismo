/* ═══════════════════════════════════════════════════════════════
   Firebase
   No Firebase Hosting a configuração vem sozinha de /__/firebase/init.json.
   Para testar com os emuladores locais, abra com ?emulador no endereço.
   ═══════════════════════════════════════════════════════════════ */
import { initializeApp, deleteApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
  terminate, clearIndexedDbPersistence, type Firestore,
} from "firebase/firestore";

export const EMULADOR = new URLSearchParams(location.search).has("emulador");

let config: FirebaseOptions;
export let app: FirebaseApp;
export let auth: Auth;
export let db: Firestore;

async function carregarConfig(): Promise<FirebaseOptions> {
  const w = window as unknown as { __PORTAL_CONFIG__?: FirebaseOptions };
  if (w.__PORTAL_CONFIG__) return w.__PORTAL_CONFIG__;
  if (EMULADOR) return { apiKey: "demo", authDomain: "localhost", projectId: "demo-portal" };
  const r = await fetch("/__/firebase/init.json");
  if (!r.ok) throw new Error("config");
  return r.json();
}

export async function iniciarFirebase() {
  config = await carregarConfig();
  app = initializeApp(config);
  auth = getAuth(app);
  auth.languageCode = "pt-BR";
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  if (EMULADOR) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
}

/**
 * Cria uma conta de login sem trocar quem está usando o sistema: usa uma segunda
 * instância do Firebase só para isso e a descarta em seguida.
 */
export async function comAuthSeparado<T>(fn: (a: Auth) => Promise<T>): Promise<T> {
  const extra = initializeApp(config, "cadastro-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7));
  const a = getAuth(extra);
  if (EMULADOR) connectAuthEmulator(a, "http://127.0.0.1:9099", { disableWarnings: true });
  try {
    return await fn(a);
  } finally {
    try { await a.signOut(); } catch { /* nada */ }
    await deleteApp(extra);
  }
}

/** Ao sair, apaga a cópia local dos dados (útil em computador compartilhado). */
export async function limparCacheLocal() {
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch { /* se não der, a página recarrega do mesmo jeito */ }
}
