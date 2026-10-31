// Firestore pela API REST, sem dependências.
// Em produção: conta de serviço do Google (JSON) em FIREBASE_SERVICE_ACCOUNT (o texto do JSON ou o caminho do arquivo).
// Nos testes: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 (o emulador aceita "Bearer owner").
import crypto from "node:crypto";
import fs from "node:fs";

function contaDeServico() {
  const v = String(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS || "").replace(/^\uFEFF/, "").trim();
  if (!v) return null;
  // aceita o conteúdo do .json (mesmo com aspas ou espaços em volta), o mesmo conteúdo em base64, ou o caminho do arquivo
  let txt = "";
  if (v.includes("{") && v.includes("}")) txt = v.slice(v.indexOf("{"), v.lastIndexOf("}") + 1);
  else if (/^[A-Za-z0-9+/=\s]{200,}$/.test(v)) { const d = Buffer.from(v, "base64").toString("utf8"); if (d.includes("{")) txt = d.slice(d.indexOf("{"), d.lastIndexOf("}") + 1); }
  else if (fs.existsSync(v)) txt = fs.readFileSync(v, "utf8");
  if (!txt) {
    throw new Error(`o segredo FIREBASE_SERVICE_ACCOUNT não é o conteúdo do arquivo .json da chave (tem ${v.length} caracteres e devia começar com "{"). No Mac, rode: pbcopy < arquivo.json, e cole de novo no segredo.`);
  }
  let j;
  try { j = JSON.parse(txt); }
  catch { throw new Error("o segredo FIREBASE_SERVICE_ACCOUNT parece cortado ou alterado (não é um JSON válido). Copie de novo com pbcopy < arquivo.json e cole no segredo."); }
  if (!j.client_email || !j.private_key) throw new Error("a chave precisa ter client_email e private_key: use o arquivo .json baixado em Chaves → Adicionar chave → JSON.");
  return j;
}

const b64url = (b) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

async function tokenGoogle(conta) {
  const agora = Math.floor(Date.now() / 1000);
  const cab = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = b64url(JSON.stringify({
    iss: conta.client_email, scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token", iat: agora, exp: agora + 3600,
  }));
  const assinatura = b64url(crypto.createSign("RSA-SHA256").update(`${cab}.${corpo}`).sign(conta.private_key));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${cab}.${corpo}.${assinatura}` }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("Google recusou a conta de serviço: " + (j.error_description || j.error || r.status));
  return j.access_token;
}

/* ─── valores tipados do Firestore ─── */
export function paraFirestore(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.filter((x) => !Array.isArray(x)).map(paraFirestore) } };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, paraFirestore(x)])) } };
  return { stringValue: String(v) };
}
export function deFirestore(v) {
  if (!v || typeof v !== "object") return null;
  if ("nullValue" in v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return new Date(v.timestampValue);
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(deFirestore);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, deFirestore(x)]));
  return null;
}

export async function conectar() {
  const emu = process.env.FIRESTORE_EMULATOR_HOST;
  const conta = emu ? null : contaDeServico();
  const projeto = process.env.FIREBASE_PROJECT || conta?.project_id || "project-sala-vip";
  if (!emu && !conta) throw new Error("Falta a conta de serviço (FIREBASE_SERVICE_ACCOUNT).");
  const base = emu ? `http://${emu}/v1/projects/${projeto}/databases/(default)/documents` : `https://firestore.googleapis.com/v1/projects/${projeto}/databases/(default)/documents`;
  let token = emu ? "owner" : await tokenGoogle(conta);
  const pedir = async (metodo, caminho, corpo) => {
    const r = await fetch(`${base}/${caminho}`, {
      method: metodo, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (r.status === 404 && metodo === "GET") return null;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Firestore ${metodo} ${caminho}: ${r.status} ${j.error?.message || ""}`);
    return j;
  };
  return {
    projeto,
    async ler(caminho) {
      const j = await pedir("GET", caminho);
      return j ? deFirestore({ mapValue: { fields: j.fields || {} } }) : null;
    },
    /** Grava o documento inteiro (cria ou substitui). */
    async gravar(caminho, dados) {
      await pedir("PATCH", caminho, { fields: paraFirestore(dados).mapValue.fields });
    },
  };
}
