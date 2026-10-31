/* Lê o texto do PDF do boleto (no próprio navegador; o arquivo não sai daqui)
   e tenta achar a linha digitável, o beneficiário, o vencimento e o valor. */
import { acharLinhaNoTexto, type LeituraLinha } from "./linha";

export type LeituraPdf = { linha: LeituraLinha | null; beneficiario: string; vencimento: string | null; valor: number | null };

async function textoDoPdf(buf: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const pdf = await tarefa.promise;
  const partes: string[] = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 4); p++) {
    const pg = await pdf.getPage(p);
    const tc = await pg.getTextContent();
    let linha = "", ultimoY: number | null = null;
    for (const it of tc.items as { str: string; transform: number[]; hasEOL?: boolean }[]) {
      const y = Math.round(it.transform?.[5] ?? 0);
      if (ultimoY !== null && Math.abs(y - ultimoY) > 2) { partes.push(linha); linha = ""; }
      linha += (linha && !linha.endsWith(" ") ? " " : "") + it.str;
      ultimoY = y;
      if (it.hasEOL) { partes.push(linha); linha = ""; ultimoY = null; }
    }
    if (linha) partes.push(linha);
  }
  await tarefa.destroy();
  return partes.join("\n");
}

const dataBr = (s: string) => { const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const valorBr = (s: string) => { const m = s.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/); return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : null; };

export async function lerPdfBoleto(buf: ArrayBuffer): Promise<LeituraPdf> {
  const texto = await textoDoPdf(buf);
  const linhas = texto.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const linha = acharLinhaNoTexto(texto);
  const depoisDe = (re: RegExp, max = 2) => {
    const i = linhas.findIndex((l) => re.test(l));
    if (i < 0) return "";
    const mesma = linhas[i].replace(re, "").replace(/^[\s:–-]+/, "").trim();
    return mesma || linhas.slice(i + 1, i + 1 + max).join(" ");
  };
  let beneficiario = depoisDe(/^(benefici[aá]rio|cedente)\b[^:]*:?/i, 1)
    .replace(/\b(cnpj|cpf)\b.*$/i, "").replace(/\s{2,}/g, " ").trim();
  if (/^(ag[eê]ncia|c[oó]digo|nosso|cpf|cnpj)/i.test(beneficiario)) beneficiario = "";
  const venc = dataBr(depoisDe(/vencimento/i, 2));
  const val = valorBr(depoisDe(/valor (do )?documento|valor cobrado|total a pagar|valor a pagar/i, 2));
  return { linha, beneficiario: beneficiario.slice(0, 120), vencimento: venc, valor: val };
}
