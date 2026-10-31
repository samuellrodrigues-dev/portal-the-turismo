const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (n: number) => BRL.format(n).replace(/ /g, " ");

/** "R$ 1.412,50" · "450" · "450,5" · "1.412" → número; vazio → null; inválido → NaN */
export function lerValor(txt: string): number | null {
  let s = String(txt || "").replace(/r\$|\s/gi, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
export const limpar = (s: string, max = 120) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);
export const primeiroNome = (nome: string) => String(nome || "").trim().split(/\s+/)[0] || "";
export const iniciais = (nome: string) => {
  const p = String(nome || "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
};

/** Baixa um texto como arquivo (CSV etc.). */
export function baixarTexto(nome: string, conteudo: string, tipo = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** CSV com ponto e vírgula e BOM: abre direto no Excel em português. */
export function csv(linhas: (string | number | null | undefined)[][]) {
  const cel = (v: unknown) => { const s = v == null ? "" : String(v); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "﻿" + linhas.map((l) => l.map(cel).join(";")).join("\r\n");
}
