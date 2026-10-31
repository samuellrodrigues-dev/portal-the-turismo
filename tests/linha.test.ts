import { lerLinha, acharLinhaNoTexto, mod10, mod11Bancario, mod11Arrecadacao, vencimentoDoFator } from "../src/modulos/boletos/linha.ts";

let falhas = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { falhas++; console.log("FALHOU:", msg); } else console.log("ok -", msg); };
const hoje = new Date(Date.UTC(2026, 9, 29, 12));

// monta um boleto bancário válido: banco 341 (Itaú), moeda 9, vencimento 15/11/2026, R$ 1.234,56
const diasDesde = (iso: string) => Math.round((Date.parse(iso + "T00:00:00Z") - Date.UTC(2025, 1, 22)) / 864e5);
const fator = String(1000 + diasDesde("2026-11-15")).padStart(4, "0");
const valor = "0000123456";
const livre = "1090000012345678901234567".slice(0, 25);
const semDv = "3419" + fator + valor + livre;
const dv = mod11Bancario(semDv);
const cb = "3419" + dv + fator + valor + livre;
ok(cb.length === 44, "código de barras com 44 números");
const r1 = lerLinha(cb, hoje)!;
ok(r1.valido && r1.tipo === "bancario", "barras bancário válido");
ok(r1.valor === 1234.56, "valor 1234,56 -> " + r1.valor);
ok(r1.vencimento === "2026-11-15", "vencimento 15/11/2026 -> " + r1.vencimento);
ok(r1.emissor.startsWith("Itaú"), "banco Itaú -> " + r1.emissor);
ok(r1.linha.length === 47, "linha gerada com 47 números");
const r2 = lerLinha(r1.formatada, hoje)!;
ok(r2.valido && r2.codigoBarras === cb, "linha formatada volta ao mesmo código de barras");
ok(r2.valor === 1234.56 && r2.vencimento === "2026-11-15", "linha: valor e vencimento");
// um número trocado na linha
const errada = r1.linha.slice(0, 12) + ((Number(r1.linha[12]) + 1) % 10) + r1.linha.slice(13);
ok(lerLinha(errada, hoje)!.valido === false, "número trocado é recusado");
// acha no meio de texto de PDF
const r3 = acharLinhaNoTexto(`Beneficiário: ACME LTDA\nLinha digitável\n${r1.formatada}\nVencimento 15/11/2026 Valor R$ 1.234,56`, hoje)!;
ok(!!r3 && r3.valido && r3.valor === 1234.56, "acha a linha no texto do PDF");
const r4 = acharLinhaNoTexto("xx " + r1.linha + " yy", hoje)!;
ok(!!r4 && r4.valido, "acha a linha sem espaços");
// fator de vencimento: regra antiga e nova
ok(vencimentoDoFator(9999, hoje) === "2025-02-21", "fator 9999 (último da regra antiga) -> " + vencimentoDoFator(9999, hoje));
ok(vencimentoDoFator(1000, hoje) === "2025-02-22", "fator 1000 (primeiro da regra nova) -> " + vencimentoDoFator(1000, hoje));
ok(vencimentoDoFator(0, hoje) === null, "fator 0 = sem vencimento");
// arrecadação (energia, valor real, módulo 10): 83 6 ...
const base = "836" + "00000012345" + "0123" + "4567890123456789012345678".slice(0, 25);
// 3 + 11 + 4 + 25 = 43 números sem o DV geral (posição 4)
const semDvA = base.slice(0, 3) + base.slice(3);
ok(semDvA.length === 43, "arrecadação: 43 números sem DV");
const dvA = mod10(semDvA);
const cbA = semDvA.slice(0, 3) + dvA + semDvA.slice(3);
const rA = lerLinha(cbA, hoje)!;
ok(rA.valido && rA.tipo === "arrecadacao", "barras de arrecadação válido");
ok(rA.valor === 123.45, "arrecadação: valor 123,45 -> " + rA.valor);
ok(rA.emissor.startsWith("Energia"), "arrecadação: segmento energia -> " + rA.emissor);
const rA2 = lerLinha(rA.formatada, hoje)!;
ok(rA2.valido && rA2.linha.length === 48 && rA2.codigoBarras === cbA, "arrecadação: linha de 48 volta ao código");
// arrecadação módulo 11 (identificador 8)
const semDvB = "858" + "00000009990" + "0001" + "1111222233334444555566667";
const cbB = semDvB.slice(0, 3) + mod11Arrecadacao(semDvB) + semDvB.slice(3);
const rB = lerLinha(cbB, hoje)!;
ok(rB.valido && rB.valor === 99.9, "arrecadação módulo 11: valor 99,90 -> " + rB.valor);
ok(lerLinha(rB.formatada, hoje)!.valido, "arrecadação módulo 11: linha de 48 válida");
ok(lerLinha("123", hoje) === null, "texto curto não é boleto");
if (falhas) { console.log(falhas, "falha(s)"); process.exit(1); } else console.log("tudo certo");
