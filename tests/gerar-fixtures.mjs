// Gera um boleto de teste (linha válida + PDF) e uma foto de comprovante.
import fs from "node:fs";
import { createRequire } from "node:module";
import { mod11Bancario, lerLinha } from "../src/modulos/boletos/linha.ts";
const require = createRequire(import.meta.url);
const pdfMake = require("/home/claude/gerador/test/node_modules/pdfmake/build/pdfmake.js");
const vfs = require("/home/claude/gerador/test/node_modules/pdfmake/build/vfs_fonts.js");
pdfMake.vfs = (vfs.pdfMake && vfs.pdfMake.vfs) || vfs.vfs || vfs;

const hoje = new Date();
function boleto(banco, vencIso, valorCent, livre) {
  const fator = String(1000 + Math.round((Date.parse(vencIso + "T00:00:00Z") - Date.UTC(2025, 1, 22)) / 864e5)).padStart(4, "0");
  const semDv = banco + "9" + fator + String(valorCent).padStart(10, "0") + livre;
  const cb = semDv.slice(0, 4) + mod11Bancario(semDv) + semDv.slice(4);
  return lerLinha(cb, hoje);
}
const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(d); };
const a = boleto("341", iso(12), 245000, "1090000012345678901234567");   // aluguel, Itaú
const b = boleto("077", iso(3), 19990, "0001000222333444555666777");     // internet, Inter
const c = boleto("001", iso(-2), 87350, "0000003311122233344455566");    // atrasado, BB
const d = boleto("237", iso(0), 41200, "2222333344445555666677778");     // hoje, Bradesco
fs.writeFileSync(new URL("./boletos.json", import.meta.url), JSON.stringify({ a, b, c, d }, null, 1));
const doc = { content: [
  { text: "Banco Inter S.A.  |  077-9  |  " + b.formatada, bold: true, margin: [0, 0, 0, 12] },
  { text: "Beneficiário" }, { text: "NET Fibra Teresina LTDA   CNPJ 12.345.678/0001-90", margin: [0, 0, 0, 8] },
  { text: "Vencimento" }, { text: b.vencimento.split("-").reverse().join("/"), margin: [0, 0, 0, 8] },
  { text: "Valor do Documento" }, { text: "199,90", margin: [0, 0, 0, 8] },
  { text: "Pagador: THE TURISMO LTDA" },
] };
pdfMake.createPdf(doc).getBuffer((buf) => { fs.writeFileSync(new URL("./boleto-internet.pdf", import.meta.url), Buffer.from(buf)); console.log("pdf ok", buf.length); });
console.log(a.formatada, a.valor, a.vencimento); console.log(b.formatada, b.valor, b.vencimento);
