/* ═══════════════════════════════════════════════════════════════
   Anexos (PDF do boleto, comprovante)
   Desde 02/2026 o Firebase só guarda arquivos (Storage) no plano pago.
   Por isso os anexos ficam no próprio Firestore, que segue grátis:
   cada arquivo vira um documento com partes de até ~700 KB.
   Fotos grandes são reduzidas antes de salvar.
   ═══════════════════════════════════════════════════════════════ */
import { collection, doc, getDoc, getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";

export type Papel = "boleto" | "comprovante" | "outro";
export type Anexo = { id: string; nome: string; tipo: string; bytes: number; papel: Papel };

const PARTE = 700_000;          // caracteres base64 por parte (o limite de um documento é ~1 MB)
export const MAX_BYTES = 8 * 1024 * 1024;

function paraBase64(buf: ArrayBuffer) {
  const b = new Uint8Array(buf); let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
function deBase64(s: string) {
  const bin = atob(s); const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

/** Foto grande (comprovante do celular) vira JPEG de até 1800 px, bem menor. */
async function reduzirImagem(f: File): Promise<{ buf: ArrayBuffer; tipo: string; nome: string }> {
  if (!f.type.startsWith("image/") || f.size < 450_000 || f.type === "image/gif") return { buf: await f.arrayBuffer(), tipo: f.type || "application/octet-stream", nome: f.name };
  const img = await createImageBitmap(f);
  const k = Math.min(1, 1800 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((ok) => c.toBlob((b) => ok(b!), "image/jpeg", 0.82));
  if (blob.size >= f.size) return { buf: await f.arrayBuffer(), tipo: f.type, nome: f.name };
  return { buf: await blob.arrayBuffer(), tipo: "image/jpeg", nome: f.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg" };
}

export async function salvarAnexo(boletoId: string, f: File, papel: Papel): Promise<Anexo> {
  const { buf, tipo, nome } = await reduzirImagem(f);
  if (buf.byteLength > MAX_BYTES) throw new Error(`"${f.name}" tem mais de 8 MB. Use um PDF menor ou uma foto.`);
  const b64 = paraBase64(buf);
  const ref = doc(collection(db, "arquivos"));
  const partes = Math.max(1, Math.ceil(b64.length / PARTE));
  // até 8 partes por lote, para não passar do tamanho máximo de uma gravação
  for (let i = 0; i < partes; i += 8) {
    const lote = writeBatch(db);
    for (let j = i; j < Math.min(partes, i + 8); j++) lote.set(doc(db, "arquivos", ref.id, "partes", String(j)), { d: b64.slice(j * PARTE, (j + 1) * PARTE) });
    if (i + 8 >= partes) lote.set(ref, { boletoId, nome: nome.slice(0, 140), tipo, bytes: buf.byteLength, partes, papel, criadoEm: serverTimestamp() });
    await lote.commit();
  }
  return { id: ref.id, nome: nome.slice(0, 140), tipo, bytes: buf.byteLength, papel };
}

export async function lerAnexo(a: Anexo): Promise<Blob> {
  const s = await getDoc(doc(db, "arquivos", a.id));
  if (!s.exists()) throw new Error("Esse anexo não foi encontrado.");
  const partes = await getDocs(collection(db, "arquivos", a.id, "partes"));
  const ordem = partes.docs.sort((x, y) => Number(x.id) - Number(y.id)).map((d) => d.data().d as string);
  if (ordem.length !== s.data().partes) throw new Error("O anexo está incompleto. Envie de novo.");
  return new Blob([deBase64(ordem.join(""))], { type: s.data().tipo || a.tipo });
}

export async function abrirAnexo(a: Anexo) {
  const janela = window.open("", "_blank");
  try {
    const url = URL.createObjectURL(await lerAnexo(a));
    if (janela) janela.location.href = url; else location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) { janela?.close(); throw e; }
}

export async function excluirAnexo(id: string) {
  const partes = await getDocs(collection(db, "arquivos", id, "partes"));
  const lote = writeBatch(db);
  partes.docs.forEach((d) => lote.delete(d.ref));
  lote.delete(doc(db, "arquivos", id));
  await lote.commit();
}

export const tamanho = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);
