/* ═══════════════════════════════════════════════════════════════
   Linha digitável e código de barras (padrão FEBRABAN)
   - Boleto bancário: linha de 47 números (ou código de barras de 44).
     Dela saem o banco, o valor e o vencimento, e os dígitos verificadores
     dizem se a linha foi copiada certa.
   - Contas de consumo e tributos (arrecadação): 48 números, começam com 8.
     Dela sai o valor; o vencimento vem do papel.
   ═══════════════════════════════════════════════════════════════ */

export type LeituraLinha = {
  tipo: "bancario" | "arrecadacao";
  valido: boolean;
  motivo: string;
  linha: string;          // só números, como digitada (47 ou 48)
  codigoBarras: string;   // 44 números
  valor: number | null;
  vencimento: string | null; // AAAA-MM-DD
  emissor: string;        // banco ou tipo de conta
  formatada: string;
};

const BANCOS: Record<string, string> = {
  "001": "Banco do Brasil", "004": "Banco do Nordeste", "021": "Banestes", "033": "Santander", "037": "Banpará", "041": "Banrisul",
  "070": "BRB", "077": "Inter", "104": "Caixa", "197": "Stone", "208": "BTG Pactual", "212": "Banco Original", "237": "Bradesco",
  "260": "Nubank", "290": "PagBank", "323": "Mercado Pago", "336": "C6 Bank", "341": "Itaú", "380": "PicPay", "389": "Mercantil",
  "403": "Cora", "422": "Safra", "623": "Banco Pan", "655": "Votorantim", "748": "Sicredi", "756": "Sicoob",
};
const SEGMENTOS: Record<string, string> = {
  "1": "Prefeitura", "2": "Água e saneamento", "3": "Energia elétrica e gás", "4": "Telecomunicações",
  "5": "Órgão do governo", "6": "Carnê ou assemelhado", "7": "Multa de trânsito", "9": "Uso do banco",
};

export const soNumeros = (s: string) => String(s || "").replace(/\D/g, "");

export function mod10(num: string): number {
  let soma = 0, peso = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    let p = Number(num[i]) * peso;
    if (p > 9) p = Math.floor(p / 10) + (p % 10);
    soma += p;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}
function somaMod11(num: string) {
  let soma = 0, peso = 2;
  for (let i = num.length - 1; i >= 0; i--) { soma += Number(num[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  return soma;
}
/** DV geral do boleto bancário: 0, 10 e 11 viram 1. */
export function mod11Bancario(num: string): number { const dv = 11 - (somaMod11(num) % 11); return dv === 0 || dv >= 10 ? 1 : dv; }
/** DV da arrecadação: restos 0 e 1 viram 0. */
export function mod11Arrecadacao(num: string): number { const dv = 11 - (somaMod11(num) % 11); return dv >= 10 ? 0 : dv; }

const DIA = 864e5;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
/**
 * Fator de vencimento: dias desde 07/10/1997. Em 22/02/2025 o fator chegou a 9999 e
 * recomeçou em 1000. Fica a data possível mais perto de hoje.
 */
export function vencimentoDoFator(fator: number, hoje = new Date()): string | null {
  if (!fator) return null;
  const antigo = Date.UTC(1997, 9, 7) + fator * DIA;
  const novo = Date.UTC(2025, 1, 22) + (fator - 1000) * DIA;
  const agora = hoje.getTime();
  return iso(Math.abs(novo - agora) <= Math.abs(antigo - agora) ? novo : antigo);
}

function formatarBancario(l: string) {
  return `${l.slice(0, 5)}.${l.slice(5, 10)} ${l.slice(10, 15)}.${l.slice(15, 21)} ${l.slice(21, 26)}.${l.slice(26, 32)} ${l[32]} ${l.slice(33)}`;
}
function formatarArrecadacao(l: string) {
  return [0, 12, 24, 36].map((i) => `${l.slice(i, i + 11)}-${l[i + 11]}`).join(" ");
}

function lerBancarioDeBarras(cb: string, linha: string, hoje: Date): LeituraLinha {
  const dvGeral = mod11Bancario(cb.slice(0, 4) + cb.slice(5));
  const okGeral = Number(cb[4]) === dvGeral;
  const fator = Number(cb.slice(5, 9));
  const valor = Number(cb.slice(9, 19)) / 100;
  const banco = cb.slice(0, 3);
  const l = linha || (() => {
    const c1 = cb.slice(0, 4) + cb.slice(19, 24), c2 = cb.slice(24, 34), c3 = cb.slice(34, 44);
    return c1 + mod10(c1) + c2 + mod10(c2) + c3 + mod10(c3) + cb[4] + cb.slice(5, 19);
  })();
  return {
    tipo: "bancario", valido: okGeral, motivo: okGeral ? "" : "O dígito verificador geral não confere. Confira se a linha foi copiada inteira.",
    linha: l, codigoBarras: cb, valor: valor > 0 ? valor : null, vencimento: vencimentoDoFator(fator, hoje),
    emissor: BANCOS[banco] ? `${BANCOS[banco]} (${banco})` : `Banco ${banco}`, formatada: formatarBancario(l),
  };
}

function lerArrecadacaoDeBarras(cb: string, linha: string): LeituraLinha {
  const id = cb[2];
  const usa10 = id === "6" || id === "7";
  const dv = (s: string) => (usa10 ? mod10(s) : mod11Arrecadacao(s));
  const okGeral = Number(cb[3]) === dv(cb.slice(0, 3) + cb.slice(4));
  const real = id === "6" || id === "8";
  const valor = real ? Number(cb.slice(4, 15)) / 100 : null;
  const l = linha || [0, 11, 22, 33].map((i) => cb.slice(i, i + 11) + dv(cb.slice(i, i + 11))).join("");
  return {
    tipo: "arrecadacao", valido: okGeral, motivo: okGeral ? "" : "O dígito verificador não confere. Confira se a linha foi copiada inteira.",
    linha: l, codigoBarras: cb, valor: valor && valor > 0 ? valor : null, vencimento: null,
    emissor: SEGMENTOS[cb[1]] || "Conta de consumo ou tributo", formatada: formatarArrecadacao(l),
  };
}

/** Lê uma linha digitável (47 ou 48 números) ou um código de barras (44). Devolve null se não parecer um boleto. */
export function lerLinha(texto: string, hoje = new Date()): LeituraLinha | null {
  const n = soNumeros(texto);
  if (n.length === 44) return n[0] === "8" ? lerArrecadacaoDeBarras(n, "") : lerBancarioDeBarras(n, "", hoje);
  if (n.length === 47) {
    const campos = [[n.slice(0, 9), n[9]], [n.slice(10, 20), n[20]], [n.slice(21, 31), n[31]]];
    const okCampos = campos.every(([c, d]) => mod10(c) === Number(d));
    const cb = n.slice(0, 4) + n[32] + n.slice(33, 47) + n.slice(4, 9) + n.slice(10, 20) + n.slice(21, 31);
    const r = lerBancarioDeBarras(cb, n, hoje);
    if (!okCampos) { r.valido = false; r.motivo = "Algum número da linha digitável está errado (o dígito de um dos blocos não confere)."; }
    return r;
  }
  if (n.length === 48 && n[0] === "8") {
    const blocos = [0, 12, 24, 36].map((i) => [n.slice(i, i + 11), n[i + 11]] as const);
    const cb = blocos.map(([b]) => b).join("");
    const r = lerArrecadacaoDeBarras(cb, n);
    const usa10 = cb[2] === "6" || cb[2] === "7";
    const okBlocos = blocos.every(([b, d]) => (usa10 ? mod10(b) : mod11Arrecadacao(b)) === Number(d));
    if (!okBlocos) { r.valido = false; r.motivo = "Algum número da linha digitável está errado (o dígito de um dos blocos não confere)."; }
    return r;
  }
  return null;
}

/** Procura uma linha digitável válida num texto qualquer (ex.: o texto do PDF do boleto). */
export function acharLinhaNoTexto(texto: string, hoje = new Date()): LeituraLinha | null {
  const candidatos: string[] = [];
  const t = String(texto || "");
  // bancária com pontos e espaços: 00000.00000 00000.000000 00000.000000 0 00000000000000
  for (const m of t.matchAll(/\d{5}[.\s]?\d{5}\s*\d{5}[.\s]?\d{6}\s*\d{5}[.\s]?\d{6}\s*\d\s*\d{14}/g)) candidatos.push(m[0]);
  // arrecadação: 4 blocos de 11 + dígito
  for (const m of t.matchAll(/8\d{10}[-\s]?\d\s*\d{11}[-\s]?\d\s*\d{11}[-\s]?\d\s*\d{11}[-\s]?\d/g)) candidatos.push(m[0]);
  // sequências longas de números (o texto do PDF às vezes vem sem espaços)
  for (const m of t.replace(/[.\-\s]/g, " ").matchAll(/(?:\d[\d ]{42,70}\d)/g)) {
    const d = soNumeros(m[0]);
    for (const tam of [47, 48]) for (let i = 0; i + tam <= d.length; i++) candidatos.push(d.slice(i, i + tam));
  }
  let melhor: LeituraLinha | null = null;
  for (const c of candidatos) {
    const r = lerLinha(c, hoje);
    if (r && r.valido) return r;
    if (r && !melhor) melhor = r;
  }
  return melhor;
}
