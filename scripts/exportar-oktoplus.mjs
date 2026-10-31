// Exporta os dados do Controle Oktoplus (Postgres/Neon) para levar ao site novo.
//
//   Copie este arquivo para a pasta scripts/ do controle-oktoplus e rode, dentro da pasta:
//     node scripts/exportar-oktoplus.mjs
//
// Usa a DATABASE_URL do arquivo .env.local (a mesma do site antigo). Só LÊ o banco: não muda nada.
// Gera o arquivo oktoplus-exportacao.json na pasta do projeto. PINs e senhas não vão no arquivo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const arq of [".env.local", ".env"]) {
  const f = path.join(raiz, arq);
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("\n✗ Falta a variável DATABASE_URL. Rode dentro da pasta controle-oktoplus, onde fica o arquivo .env.local.\n");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("begin isolation level repeatable read read only");
  const q = async (sql) => (await client.query(sql)).rows;
  const iso = (d) => (d ? new Date(d).toISOString() : null);
  const funcionarios = (await q("select id, nome, admin, ativo, aparelho from funcionarios order by id"))
    .map((f) => ({ id: f.id, nome: f.nome, admin: f.admin, ativo: f.ativo, aparelho: f.aparelho }));
  const contas = (await q("select id, titular, final_cpf, obs, ativa, esgotada_mes, esgotada_por, esgotada_em, criado_em from contas order by id"))
    .map((c) => ({ ...c, esgotada_em: iso(c.esgotada_em), criado_em: iso(c.criado_em) }));
  const usos = (await q("select id, conta_id, funcionario_id, aparelho, inicio, fim, fim_tipo, fim_por from usos order by id"))
    .map((u) => ({ ...u, inicio: iso(u.inicio), fim: iso(u.fim) }));
  const eventos = (await q("select id, em, tipo, conta_id, funcionario_id, alvo_id, detalhe from eventos order by id"))
    .map((e) => ({ ...e, em: iso(e.em) }));
  await client.query("commit");

  const saida = { origem: "controle-oktoplus", versao: 1, exportadoEm: new Date().toISOString(), funcionarios, contas, usos, eventos };
  const destino = path.join(raiz, "oktoplus-exportacao.json");
  fs.writeFileSync(destino, JSON.stringify(saida, null, 1));
  const abertos = usos.filter((u) => !u.fim).length;
  console.log(`\n✓ Exportado: ${funcionarios.length} pessoas, ${contas.length} contas, ${usos.length} usos (${abertos} em andamento) e ${eventos.length} registros.`);
  console.log(`  Arquivo: ${destino}`);
  console.log("  Agora, no site novo: Equipe → Trazer dados do site antigo da Oktoplus → escolha este arquivo.\n");
} finally {
  await client.end();
}
