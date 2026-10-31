/* CPF, CNPJ e telefone: limpar, conferir os dígitos e mostrar formatado. */

export const soNumeros = (s: string) => (s || "").replace(/\D/g, "");

export function cpfConfere(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const n = d.split("").map(Number);
  for (const k of [9, 10]) {
    let s = 0;
    for (let i = 0; i < k; i++) s += n[i] * (k + 1 - i);
    if (((s * 10) % 11) % 10 !== n[k]) return false;
  }
  return true;
}

export function cnpjConfere(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const n = d.split("").map(Number);
  const dv = (k: number) => {
    const pesos = k === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((t, p, i) => t + p * n[i], 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  return dv(12) === n[12] && dv(13) === n[13];
}

export type TipoDoc = "cpf" | "cnpj" | "";
/** Planilha e WhatsApp costumam comer o zero da frente do CPF: 9 ou 10 números viram 11. */
export function lerDocumento(txt: string): { digitos: string; tipo: TipoDoc; confere: boolean } {
  let d = soNumeros(txt);
  if (d.length === 9 || d.length === 10) d = d.padStart(11, "0");
  if (d.length === 13) d = d.padStart(14, "0");
  const tipo: TipoDoc = d.length === 11 ? "cpf" : d.length === 14 ? "cnpj" : "";
  return { digitos: d, tipo, confere: tipo === "cpf" ? cpfConfere(d) : tipo === "cnpj" ? cnpjConfere(d) : false };
}

export function formatarDocumento(d: string): string {
  if (/^\d{11}$/.test(d)) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (/^\d{14}$/.test(d)) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return d;
}

/** "(86) 99415-7587" a partir de "86994157587" (com ou sem o 55 do Brasil). */
export function formatarTelefone(t: string): string {
  let d = soNumeros(t);
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t.trim();
}

/** Link do WhatsApp (com o 55 do Brasil quando falta). Vazio se o número não tem cara de celular/fixo. */
export function linkWhatsapp(t: string, texto = ""): string {
  let d = soNumeros(t);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (d.length < 12 || d.length > 13) return "";
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

/** Idade em anos completos numa data (AAAA-MM-DD). */
export function idade(nascimento: string, hoje: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) return null;
  const [a, m, d] = nascimento.split("-").map(Number);
  const [ha, hm, hd] = hoje.split("-").map(Number);
  let i = ha - a;
  if (hm < m || (hm === m && hd < d)) i--;
  return i >= 0 && i < 130 ? i : null;
}
