/* Milhas recebidas de clientes: a parte interna da aba Milhas (quem passou milhas para a agência). */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { nivel, type Eu } from "../../equipe/dados";
import { baixarTexto, brl, csv, lerValor, plural, primeiroNome } from "../../lib/formato";
import { formatarDocumento, soNumeros } from "../../lib/documento";
import { brData, hojeIso, mesAtual, nomeMes, somaMes } from "../../lib/tempo";
import { toast } from "../../shell/toast";
import { COR, ICO, Vazio } from "./comum";
import { semAcento } from "./dados";
import {
  MIL, PROGRAMAS, criarRecebimento, excluirRecebimento, milheiro, salvarRecebimento, useRecebimentos, type Recebimento,
} from "./clientes";

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const corDe = (programa: string) => COR[programa] || "#8A877F";
const erroDe = (e: unknown) => (e as { code?: string })?.code === "permission-denied" ? "Seu acesso não permite essa ação." : (e as Error)?.message || "Algo deu errado.";
const ICO_MAIS = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
const ICO_BAIXAR = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>;

/* ═════════════════ Formulário ═════════════════ */

function FormRecebimento({ eu, r, clientes, aoFechar, aoSalvar }: {
  eu: Eu; r: Recebimento | null; clientes: Map<string, { nome: string; documento: string }>; aoFechar: () => void; aoSalvar: (data: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  const [cliente, setCliente] = useState(r?.cliente || "");
  const [cpf, setCpf] = useState(r?.documento ? formatarDocumento(r.documento) : "");
  const [programa, setPrograma] = useState(r ? (PROGRAMAS.includes(r.programa) ? r.programa : "outro") : "");
  const [outro, setOutro] = useState(r && !PROGRAMAS.includes(r.programa) ? r.programa : "");
  const [qtd, setQtd] = useState(r ? MIL.format(r.quantidade) : "");
  const [data, setData] = useState(r?.data || hojeIso());
  const [valor, setValor] = useState(r?.valor != null ? r.valor.toFixed(2).replace(".", ",") : "");
  const [obs, setObs] = useState(r?.obs || "");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [armado, setArmado] = useState(false);
  useEffect(() => { if (!armado) return; const t = setTimeout(() => setArmado(false), 4000); return () => clearTimeout(t); }, [armado]);

  const n = Number(soNumeros(qtd)) || 0;
  const v = lerValor(valor);
  const valorOk = v != null && !isNaN(v);
  const mil = n && valorOk ? milheiro({ quantidade: n, valor: v }) : null;

  // cliente que já passou milhas antes: traz o CPF que ficou guardado
  function completarCpf() {
    const c = clientes.get(semAcento(cliente.replace(/\s+/g, " ").trim()));
    if (c && !soNumeros(cpf) && c.documento) setCpf(formatarDocumento(c.documento));
  }
  async function enviar(e: FormEvent) {
    e.preventDefault(); setErro("");
    if (valor.trim() && !valorOk) { setErro("Valor inválido. Use, por exemplo, 1.980,00."); return; }
    setOcupado(true);
    try {
      const dados = { cliente, documento: cpf, programa: programa === "outro" ? outro : programa, quantidade: n, data, valor: valor.trim() ? v : null, obs };
      if (r) await salvarRecebimento(eu, r.id, dados); else await criarRecebimento(eu, dados);
      toast(r ? "Registro atualizado." : `${MIL.format(n)} milhas de ${primeiroNome(cliente)} registradas.`);
      aoSalvar(data);
    } catch (x) { setErro(erroDe(x)); setOcupado(false); }
  }
  async function excluir() {
    if (!r) return;
    if (!armado) { setArmado(true); return; }
    setOcupado(true);
    try { await excluirRecebimento(r.id); toast("Registro excluído."); aoFechar(); }
    catch (x) { setErro(erroDe(x)); setOcupado(false); setArmado(false); }
  }

  return (
    <dialog ref={ref} className="mcl-dlg" onCancel={(e) => { e.preventDefault(); if (!ocupado) aoFechar(); }}>
      <form onSubmit={enviar} onChange={() => { if (erro) setErro(""); }} noValidate>
        <header>
          <div>
            <h2>{r ? "Editar milhas recebidas" : "Registrar milhas recebidas"}</h2>
            <p>{r ? `Registrado por ${r.criadoPor || "—"}${r.atualizadoPor && r.atualizadoPor !== r.criadoPor ? ` · alterado por ${r.atualizadoPor}` : ""}` : "Milhas que um cliente passou para a agência"}</p>
          </div>
          <button type="button" className="mcl-fechar" onClick={aoFechar} aria-label="Fechar" disabled={ocupado}><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </header>
        <div className="mcl-corpo">
          <label className="tt-campo largo"><span>Cliente</span>
            <input value={cliente} onChange={(e) => setCliente(e.target.value)} onBlur={completarCpf} list="mcl-clientes" maxLength={120} autoComplete="off" placeholder="Nome de quem passou as milhas" autoFocus />
          </label>
          <datalist id="mcl-clientes">{[...clientes.values()].map((c) => <option key={c.nome} value={c.nome} />)}</datalist>
          <label className="tt-campo"><span>CPF do titular <i>opcional</i></span>
            <input value={cpf} onChange={(e) => setCpf(e.target.value)} onBlur={() => { const d = soNumeros(cpf); if (d.length >= 9 && d.length <= 11) setCpf(formatarDocumento(d.padStart(11, "0"))); }} inputMode="numeric" maxLength={20} autoComplete="off" placeholder="000.000.000-00" />
          </label>
          <label className="tt-campo"><span>Data do recebimento</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </label>
          <fieldset className="mcl-progs largo">
            <legend>Programa</legend>
            {[...PROGRAMAS, "outro"].map((x) => (
              <label key={x} style={{ ["--c" as string]: x === "outro" ? "#8A877F" : corDe(x) }}>
                <input type="radio" name="programa" value={x} checked={programa === x} onChange={() => setPrograma(x)} /><i />{x === "outro" ? "Outro" : x}
              </label>
            ))}
            {programa === "outro" && <input className="mcl-outro" value={outro} onChange={(e) => setOutro(e.target.value)} maxLength={40} placeholder="Nome do programa" aria-label="Nome do programa" autoFocus />}
          </fieldset>
          <label className="tt-campo"><span>Quantidade de milhas</span>
            <input className="mcl-num" value={qtd} inputMode="numeric" autoComplete="off" placeholder="Ex.: 120.000"
              onChange={(e) => { const d = soNumeros(e.target.value).replace(/^0+/, "").slice(0, 9); setQtd(d ? MIL.format(Number(d)) : ""); }} />
          </label>
          <label className="tt-campo"><span>Valor pago ou abatido <i>opcional</i></span>
            <input className="mcl-num" value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" autoComplete="off" placeholder="R$ 0,00" />
            <small className="mcl-dica">{mil != null ? <>Sai a <b>{brl(mil)}</b> o milheiro</> : valor.trim() && !valorOk ? "Valor inválido" : "Quanto a agência pagou ou descontou pelas milhas"}</small>
          </label>
          <label className="tt-campo largo"><span>Observação <i>opcional</i></span>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} maxLength={500} placeholder="Ex.: usadas na emissão do localizador ABC123, pagas por PIX" />
          </label>
        </div>
        {erro && <p className="tt-msg erro" role="alert">{erro}</p>}
        <footer>
          {r && <button type="button" className={`tt-btn perigo${armado ? " armado" : ""}`} onClick={excluir} disabled={ocupado}>{armado ? "Excluir de vez?" : "Excluir"}</button>}
          <span className="mcl-esp" />
          <button type="button" className="pro-btn" onClick={aoFechar} disabled={ocupado}>Cancelar</button>
          <button type="submit" className="pro-btn pri" disabled={ocupado}>{ocupado ? "Salvando…" : r ? "Salvar" : "Registrar"}</button>
        </footer>
      </form>
    </dialog>
  );
}

/* ═════════════════ Um registro ═════════════════ */

function Linha({ r, pode, comAno, aoEditar }: { r: Recebimento; pode: boolean; comAno: boolean; aoEditar: () => void }) {
  const m = milheiro(r);
  return (
    <li className="mcl-item" style={{ ["--cor" as string]: corDe(r.programa) }}>
      <time className="mcl-data" dateTime={r.data} title={brData(r.data)}>
        <b>{r.data.slice(8, 10)}</b><span>{MESES_CURTOS[Number(r.data.slice(5, 7)) - 1]}{comAno ? ` ${r.data.slice(2, 4)}` : ""}</span>
      </time>
      <div className="mcl-quem">
        <b>{r.cliente}</b>
        <span>{r.documento ? `CPF ${formatarDocumento(r.documento)}` : "sem CPF"}{r.criadoPor && <> · por {primeiroNome(r.criadoPor)}</>}</span>
      </div>
      <span className="mcl-prog"><i />{r.programa}</span>
      <div className="mcl-qtd"><b>{MIL.format(r.quantidade)}</b><span>milhas</span></div>
      <div className="mcl-valor">
        {r.valor != null ? <><b>{brl(r.valor)}</b><span>{m != null ? `${brl(m)} o milheiro` : ""}</span></> : <span className="sem">sem valor</span>}
      </div>
      {pode ? <button type="button" className="mcl-editar" onClick={aoEditar} aria-label={`Editar ${r.cliente}, ${MIL.format(r.quantidade)} milhas`}>Editar</button> : <span className="mcl-editar vazio" />}
      {r.obs && <p className="mcl-obs">{r.obs}</p>}
    </li>
  );
}

/* ═════════════════ A parte inteira ═════════════════ */

export function SecaoClientes({ eu, nav }: { eu: Eu; nav: ReactNode }) {
  const pode = nivel(eu, "milhas") === "editar";
  const { lista, erro } = useRecebimentos();
  const [mes, setMes] = useState(mesAtual());
  const [busca, setBusca] = useState("");
  const [prog, setProg] = useState("");
  const [form, setForm] = useState<{ r: Recebimento | null } | null>(null);

  const todos = lista || [];
  const termo = semAcento(busca.trim());
  const digitos = soNumeros(busca);
  const bate = (r: Recebimento) => !termo || semAcento(r.cliente).includes(termo) || semAcento(r.programa).includes(termo)
    || semAcento(r.obs).includes(termo) || (digitos.length >= 3 && r.documento.includes(digitos));
  // buscando, procura em todos os meses; sem busca, mostra o mês escolhido
  const doPeriodo = todos.filter((r) => (termo ? bate(r) : r.data.startsWith(mes)));
  const visiveis = doPeriodo.filter((r) => !prog || r.programa === prog);
  const ultimoMes = todos.reduce((m, r) => (r.data.slice(0, 7) > m ? r.data.slice(0, 7) : m), mesAtual());
  const comAno = !!termo && visiveis.some((r) => r.data.slice(0, 4) !== mesAtual().slice(0, 4));
  const periodo = termo ? "da busca" : `de ${nomeMes(mes).toLowerCase()}`;

  const somas = new Map<string, { milhas: number; n: number; valor: number; comValor: number }>();
  doPeriodo.forEach((r) => {
    const x = somas.get(r.programa) || { milhas: 0, n: 0, valor: 0, comValor: 0 };
    x.milhas += r.quantidade; x.n++;
    if (r.valor != null) { x.valor += r.valor; x.comValor += r.quantidade; }
    somas.set(r.programa, x);
  });
  const programas = [...somas.entries()].sort((a, b) => b[1].milhas - a[1].milhas);
  // se o programa filtrado não tem nada no período, solta o filtro
  const temProg = !prog || somas.has(prog);
  useEffect(() => { if (lista && !temProg) setProg(""); }, [lista, temProg]);

  const total = visiveis.reduce((t, r) => t + r.quantidade, 0);
  const comValor = visiveis.filter((r) => r.valor != null);
  const valorTotal = comValor.reduce((t, r) => t + (r.valor || 0), 0);
  const milMedio = milheiro({ quantidade: comValor.reduce((t, r) => t + r.quantidade, 0), valor: comValor.length ? valorTotal : null });

  // nomes já usados, para completar o nome e o CPF no formulário
  const clientes = useMemo(() => {
    const m = new Map<string, { nome: string; documento: string }>();
    todos.forEach((r) => { const k = semAcento(r.cliente); const x = m.get(k); if (!x) m.set(k, { nome: r.cliente, documento: r.documento }); else if (!x.documento && r.documento) x.documento = r.documento; });
    return m;
  }, [todos]);

  function baixar() {
    const linhas = [["Data", "Cliente", "CPF", "Programa", "Milhas", "Valor (R$)", "Milheiro (R$)", "Observação", "Registrado por"],
      ...visiveis.map((r) => [brData(r.data), r.cliente, r.documento ? formatarDocumento(r.documento) : "", r.programa, r.quantidade,
        r.valor != null ? r.valor.toFixed(2).replace(".", ",") : "", milheiro(r) != null ? milheiro(r)!.toFixed(2).replace(".", ",") : "", r.obs, r.criadoPor])];
    baixarTexto(`milhas-de-clientes-${termo ? "busca" : mes}${prog ? "-" + semAcento(prog).replace(/[^a-z0-9]+/g, "-") : ""}.csv`, csv(linhas), "text/csv;charset=utf-8");
  }

  return (
    <div className="pro mil mcl">
      {nav}
      <header className="mil-topo">
        <div>
          <span className="mil-etiqueta">Controle interno</span>
          <h1>Milhas de clientes</h1>
          <p>Quem passou milhas para a agência: programa, quantidade, data e quanto saiu.{!pode && " Você pode ver os registros; cadastrar e editar é com quem tem esse acesso."}</p>
        </div>
        {pode && <button type="button" className="pro-btn pri mcl-novo" onClick={() => setForm({ r: null })}>{ICO_MAIS}Registrar milhas</button>}
      </header>

      {erro && <Vazio titulo={erro} />}
      {!lista && !erro && <Vazio titulo="Carregando…" />}

      {lista && !erro && (
        <>
          <div className="pro-barra mcl-barra">
            {termo ? <p className="mcl-buscando">Buscando em todos os meses</p> : (
              <div className="mcl-mes">
                <button type="button" onClick={() => setMes(somaMes(mes, -1))} aria-label="Mês anterior"><svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6" /></svg></button>
                <h2>{nomeMes(mes)}</h2>
                <button type="button" onClick={() => setMes(somaMes(mes, 1))} disabled={mes >= ultimoMes} aria-label="Próximo mês"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg></button>
                {mes !== mesAtual() && <button type="button" className="mcl-hoje" onClick={() => setMes(mesAtual())}>Voltar para este mês</button>}
              </div>
            )}
            <div className="pro-barra-dir">
              <label className="pro-busca"><span className="sr">Buscar</span>{ICO.busca}
                <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Cliente, CPF, programa…" />
              </label>
              <button type="button" className="pro-btn" onClick={baixar} disabled={!visiveis.length}>{ICO_BAIXAR}Planilha</button>
            </div>
          </div>

          {doPeriodo.length > 0 && (
            <section className={`mcl-resumo${prog ? " filtrado" : ""}`} aria-label={`Resumo ${periodo}`}>
              <div className="mil-recorde mcl-total" style={{ ["--cor" as string]: "#2A2F38" }}>
                <small>{prog ? `${prog} ${termo ? "na busca" : "no mês"}` : termo ? "Total da busca" : "Total do mês"}</small>
                <b>{MIL.format(total)}</b>
                <span>milhas · {plural(visiveis.length, "registro", "registros")}{comValor.length ? ` · ${brl(valorTotal)}` : ""}</span>
                <em>{milMedio != null ? `${brl(milMedio)} o milheiro` : "sem valor informado"}</em>
              </div>
              {programas.length > 1 || prog ? programas.map(([p, x]) => (
                <button key={p} type="button" className="mil-recorde" aria-pressed={prog === p} onClick={() => setProg(prog === p ? "" : p)}
                  style={{ ["--cor" as string]: corDe(p) }} title={prog === p ? "Mostrar todos os programas" : `Mostrar só ${p}`}>
                  <small>{p}</small>
                  <b>{MIL.format(x.milhas)}</b>
                  <span>{plural(x.n, "registro", "registros")}{x.valor ? ` · ${brl(x.valor)}` : ""}</span>
                  <em>{x.comValor ? `${brl(milheiro({ quantidade: x.comValor, valor: x.valor })!)} o milheiro` : "sem valor"}</em>
                </button>
              )) : null}
            </section>
          )}

          {!todos.length ? (
            <Vazio titulo="Nenhuma milha de cliente registrada ainda.">
              {pode ? "Quando um cliente passar milhas para a agência, clique em Registrar milhas." : "Os registros aparecem aqui assim que a equipe cadastrar."}
            </Vazio>
          ) : !visiveis.length ? (
            <Vazio titulo={termo ? `Nada encontrado para “${busca.trim()}”.` : `Nenhuma milha recebida em ${nomeMes(mes).toLowerCase()}.`}>
              {!termo && "Use as setas para ver outros meses ou busque pelo nome do cliente."}
            </Vazio>
          ) : (
            <div className="mcl-tabela">
              <div className="mcl-cab" aria-hidden="true"><span>Data</span><span>Cliente</span><span>Programa</span><span>Milhas</span><span>Valor</span><span /></div>
              <ul className="mcl-lista">
                {visiveis.map((r) => <Linha key={r.id} r={r} pode={pode} comAno={comAno} aoEditar={() => setForm({ r })} />)}
              </ul>
            </div>
          )}
          <p className="pro-rodape">Cada registro guarda quem cadastrou e quem alterou por último. A planilha baixa o que está na tela.</p>
        </>
      )}

      {form && (
        <FormRecebimento key={form.r?.id || "novo"} eu={eu} r={form.r} clientes={clientes} aoFechar={() => setForm(null)}
          aoSalvar={(data) => { setForm(null); if (!termo) setMes(data.slice(0, 7)); }} />
      )}
    </div>
  );
}
