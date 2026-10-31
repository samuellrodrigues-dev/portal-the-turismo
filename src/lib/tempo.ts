// Horários sempre no fuso de Teresina, não importa onde o computador está.
export const TZ = "America/Fortaleza";

type Partes = { ano: string; mes: string; dia: string; hora: string; min: string };
const fmtPartes = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
export function partes(d: Date): Partes {
  const p = fmtPartes.formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { ano: g("year"), mes: g("month"), dia: g("day"), hora: g("hour"), min: g("minute") };
}

/** Hoje no formato AAAA-MM-DD. */
export const hojeIso = (agora = new Date()) => { const p = partes(agora); return `${p.ano}-${p.mes}-${p.dia}`; };
/** Mês atual no formato AAAA-MM. */
export const mesAtual = (agora = new Date()) => { const p = partes(agora); return `${p.ano}-${p.mes}`; };
export const mesDe = (d: Date) => mesAtual(d);
export const mesValido = (m: string | null | undefined) => !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

const utc = (iso: string) => { const [a, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(a, m - 1, d || 1)); };
export function somaDias(iso: string, n: number) { const d = utc(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function diasEntre(de: string, ate: string) { return Math.round((utc(ate).getTime() - utc(de).getTime()) / 864e5); }
export function somaMes(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
/** Meses (AAAA-MM) de um intervalo, inclusive. */
export function mesesEntre(de: Date, ate: Date) {
  const out: string[] = [];
  let m = mesDe(de); const fim = mesDe(ate);
  for (let i = 0; i < 240 && m <= fim; i++) { out.push(m); m = somaMes(m, 1); }
  return out;
}
/** Início e fim do mês (no fuso de Teresina, UTC-3) como instantes. */
export function limitesMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return { ini: new Date(Date.UTC(a, m - 1, 1, 3)), fim: new Date(Date.UTC(a, m, 1, 3)) };
}
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_C = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const nomeMes = (mes: string) => { const [a, m] = mes.split("-").map(Number); const s = `${MESES[m - 1]} de ${a}`; return s.charAt(0).toUpperCase() + s.slice(1); };
export const proximaRenovacao = (agora = new Date()) => { const [a, m] = somaMes(mesAtual(agora), 1).split("-"); return `01/${m}/${a}`; };

export function hora(d: Date) { const p = partes(d); return `${p.hora}:${p.min}`; }
export function dataCurta(d: Date) { const p = partes(d); return `${p.dia}/${p.mes}`; }
export function dataHora(d: Date) { const p = partes(d); return `${p.dia}/${p.mes}/${p.ano} ${p.hora}:${p.min}`; }
/** "15/11/2026" a partir de "2026-11-15". */
export const brData = (iso: string) => (iso && iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
/** "15 nov" a partir de "2026-11-15". */
export const diaMes = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES_C[Number(iso.slice(5, 7)) - 1]}`;
export const diaSemana = (iso: string) => DIAS[utc(iso).getUTCDay()];

/** "hoje 14:20", "ontem 09:10" ou "12/10 14:20" */
export function quando(d: Date, agora = new Date()) {
  const p = partes(d), h = partes(agora), o = partes(new Date(agora.getTime() - 864e5));
  const dia = (q: Partes) => `${q.ano}${q.mes}${q.dia}`;
  const hm = `${p.hora}:${p.min}`;
  if (dia(p) === dia(h)) return `hoje ${hm}`;
  if (dia(p) === dia(o)) return `ontem ${hm}`;
  return `${p.dia}/${p.mes} ${hm}`;
}
export function duracao(ini: Date, fim: Date | null, agora = new Date()) {
  const ms = (fim ?? agora).getTime() - ini.getTime();
  return duracaoMs(ms);
}
export function duracaoMs(ms: number) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), r = min % 60;
  if (h < 24) return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
  const d = Math.floor(h / 24), hr = h % 24;
  return hr ? `${d}d ${hr}h` : `${d}d`;
}
