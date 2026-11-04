/* Valores a receber sem boleto: devedor, CPF/CNPJ, prazo, parcelas. Mesmo céu dos boletos. */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Eu } from "../../equipe/dados";
import { toast } from "../../shell/toast";
import { baixarTexto, brl, csv, lerValor, plural, primeiroNome } from "../../lib/formato";
import { brData, hojeIso, mesAtual, nomeMes, somaDias, somaMes } from "../../lib/tempo";
import { formatarDocumento, formatarTelefone, idade, lerDocumento, linkWhatsapp, soNumeros } from "../../lib/documento";
import { CEU, Dialogo, IconeClima, Previsao, SeletorMes, erroDe, semAcento, useFecharFora, type CartaoPrevisao } from "./comum";
import type { Clima } from "./dados";
import {
  MAX_PARCELAS, climaParcela, climaReceber, criarRecebivel, desfazerRecebimento, dividir, emAberto, emFoco, excluirRecebivel,
  mesesDepois, numeradas, parcelasRecebidasNoMes, quandoParcela, receberParcelas, saldo, salvarRecebivel, semData, useRecebidosNoMes,
  type ParcelaN, type Recebivel,
} from "./recebiveis";

type Grupo = Clima | "semdata";
const ROTULO: Record<Grupo, string> = { tempestade: "Atrasados", chuva: "Vencem hoje", nublado: "Próximos 7 dias", aberto: "Mais adiante", semdata: "Sem data", sol: "Recebidos" };
/** Data da parcela, ou "sem data" quando não foi combinada. */
const dataOu = (iso: string) => brData(iso) || "sem data";
const soma = (l: { valor: number }[]) => Math.round(l.reduce((t, p) => t + p.valor, 0) * 100) / 100;

const ICO = {
  wpp: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 20.5 5 16.3A8.5 8.5 0 1 1 8 19.2z" /><path d="M9 8.6c0 3.4 2.9 6.3 6.3 6.4l1.2-1.4-1.9-1-1 .8a4.6 4.6 0 0 1-2.4-2.4l.8-1-1-1.9z" /></svg>,
  baixar: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" /></svg>,
  mais: <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>,
  tirar: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>,
};

/** Texto pronto para cobrar no WhatsApp (a pessoa ainda pode mudar antes de mandar). */
function mensagemCobranca(r: Recebivel, foco: ParcelaN[], hoje: string) {
  const ola = lerDocumento(r.documento).tipo === "cnpj" ? "Olá! Tudo bem?" : `Olá, ${primeiroNome(r.devedor)}! Tudo bem?`;
  const ref = r.referencia ? ` referente a ${r.referencia}` : "";
  const p = foco[0];
  if (!p) return "";
  if (foco.length > 1) return `${ola} Aqui é da THE TURISMO. Passando para lembrar das parcelas em aberto${ref}, que somam ${brl(soma(foco))}${p.venc ? `, a primeira com vencimento em ${brData(p.venc)}` : ""}.`;
  if (!p.venc) return `${ola} Aqui é da THE TURISMO. Passando para lembrar do pagamento de ${brl(p.valor)}${ref}.`;
  const venceu = p.venc < hoje ? "que venceu" : "com vencimento";
  return `${ola} Aqui é da THE TURISMO. Passando para lembrar do pagamento de ${brl(p.valor)}${ref}, ${venceu} em ${brData(p.venc)}.`;
}

/* ═════════════════ Um valor a receber ═════════════════ */

function Cartao({ r, pode, hoje, eu, aoEditar, aoReceber }: { r: Recebivel; pode: boolean; hoje: string; eu: Eu; aoEditar: () => void; aoReceber: (i?: number) => void }) {
  const c = climaReceber(r, hoje);
  const foco = emFoco(r, hoje);
  const total = r.parcelas.length, nRec = total - emAberto(r).length;
  const [menu, setMenu] = useState(false);
  const [armado, setArmado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const ref = useFecharFora(menu, () => setMenu(false));
  useEffect(() => { if (!armado) return; const t = setTimeout(() => setArmado(false), 4000); return () => clearTimeout(t); }, [armado]);
  const docu = r.documento ? lerDocumento(r.documento) : null;
  const p = foco[0];
  const wpp = linkWhatsapp(r.telefone, mensagemCobranca(r, foco, hoje));
  const varias = foco.length > 1;
  const quando = !p ? "" : varias
    ? `${foco.length} parcelas ${c === "tempestade" ? "atrasadas" : c === "chuva" ? "vencem hoje" : "nos próximos dias"}`
    : quandoParcela(p, hoje);
  const desfazer = async (i: number) => { try { await desfazerRecebimento(eu, r, i); toast(`Parcela ${i + 1}/${total} voltou para em aberto.`); } catch (e) { toast(erroDe(e), true); } };
  const anos = r.nascimento ? idade(r.nascimento, hoje) : null;

  return (
    <article className={`nuvem rec clima-${c}`}>
      <div className="nuvem-ic" title={CEU[c]}><IconeClima c={c} /></div>
      <div className="nuvem-info">
        <h3>{r.devedor}</h3>
        <p className="nuvem-sub">
          {docu && <span className="doc">{docu.tipo === "cnpj" ? "CNPJ" : "CPF"} {formatarDocumento(r.documento)}{!docu.confere && <em className="nao-confere">não confere</em>}</span>}
          {r.referencia && <span className="cat">{r.referencia}</span>}
          {r.telefone && <span>{formatarTelefone(r.telefone)}</span>}
        </p>
        {total > 1 && (
          <div className="rec-prog">
            <span className="barra" aria-hidden="true"><i style={{ width: `${(nRec / total) * 100}%` }} /></span>
            <span>{nRec} de {total} parcelas recebidas · falta {brl(saldo(r))}</span>
          </div>
        )}
        {r.obs && !aberto && <div className="nuvem-extra"><span className="obs" title={r.obs}>{r.obs}</span></div>}
        {aberto && (
          <div className="rec-det">
            <dl>
              {r.nascimento && <div><dt>Nascimento</dt><dd>{brData(r.nascimento)}{anos != null ? ` · ${anos} anos` : ""}</dd></div>}
              {r.telefone && <div><dt>Telefone</dt><dd>{formatarTelefone(r.telefone)}</dd></div>}
              {r.criadoPor && <div><dt>Cadastrado por</dt><dd>{r.criadoPor}</dd></div>}
              {r.obs && <div className="largo"><dt>Observações</dt><dd>{r.obs}</dd></div>}
            </dl>
            <ol className="rec-parcelas">
              {numeradas(r).map((x) => {
                const cp = climaParcela(x, hoje);
                return (
                  <li key={x.i} className={`p-${cp}`}>
                    <span className="n">{x.i + 1}/{total}</span>
                    <span className="d">{dataOu(x.venc)}</span>
                    <b>{brl(x.recebidoEm ? x.valorRecebido ?? x.valor : x.valor)}</b>
                    <span className={`quando q-${cp}`}>{quandoParcela(x, hoje)}</span>
                    {pode && (x.recebidoEm
                      ? <button type="button" className="bol-link" onClick={() => desfazer(x.i)}>Desfazer</button>
                      : <button type="button" className="bol-link" onClick={() => aoReceber(x.i)}>Receber</button>)}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        <button type="button" className="bol-link rec-ver" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          {aberto ? "Esconder detalhes" : total > 1 ? `Ver as ${total} parcelas` : "Ver detalhes"}
        </button>
      </div>
      <div className="nuvem-valor">
        <b>{brl(soma(foco))}</b>
        {p && <span className={`quando q-${c}`}>{quando}</span>}
        {p && (total > 1 || p.venc) && <small>{[
          total > 1 ? `${varias ? "parcelas" : "parcela"} ${foco.map((x) => x.i + 1).join(", ")}/${total}` : "",
          p.venc ? `${brData(p.venc)}${varias ? ` a ${dataOu(foco[foco.length - 1].venc).slice(0, 5)}` : ""}` : "",
        ].filter(Boolean).join(" · ")}</small>}
      </div>
      <div className="nuvem-acoes" ref={ref}>
        {wpp && <a className="bol-icone wpp" href={wpp} target="_blank" rel="noopener noreferrer" title="Cobrar no WhatsApp" aria-label={`Cobrar ${r.devedor} no WhatsApp`}>{ICO.wpp}</a>}
        {pode && (
          <>
            <button type="button" className="bol-btn pagar" onClick={() => aoReceber()}>Marcar como recebido</button>
            <button type="button" className="bol-icone" aria-label={`Mais opções de ${r.devedor}`} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>{ICO.mais}</button>
            {menu && (
              <div className="bol-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenu(false); aoEditar(); }}>Editar</button>
                <button type="button" role="menuitem" className={`perigo${armado ? " armado" : ""}`} onClick={async () => {
                  if (!armado) { setArmado(true); return; }
                  setMenu(false);
                  try { await excluirRecebivel(r); toast(`${r.devedor} excluído dos valores a receber.`); } catch (e) { toast(erroDe(e), true); }
                }}>{armado ? "Clique de novo para excluir" : "Excluir"}</button>
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}

/* ═════════════════ Cadastro ═════════════════ */

type Linha = { venc: string; valor: string; recebidoEm: string | null; valorRecebido: number | null };
const linhaNova = (venc = "", valor = ""): Linha => ({ venc, valor, recebidoEm: null, valorRecebido: null });

function FormRecebivel({ eu, r, aoFechar }: { eu: Eu; r: Recebivel | null; aoFechar: () => void }) {
  const hoje = hojeIso();
  const comRecebidas = !!r?.parcelas.some((p) => p.recebidoEm);
  const [devedor, setDevedor] = useState(r?.devedor || "");
  const [documento, setDocumento] = useState(r?.documento ? formatarDocumento(r.documento) : "");
  const [nascimento, setNascimento] = useState(r?.nascimento || "");
  const [telefone, setTelefone] = useState(r?.telefone ? formatarTelefone(r.telefone) : "");
  const [referencia, setReferencia] = useState(r?.referencia || "");
  const [obs, setObs] = useState(r?.obs || "");
  const [total, setTotal] = useState(r ? brl(soma(r.parcelas)) : "");
  const [n, setN] = useState(String(r?.parcelas.length || 1));
  const [primeiro, setPrimeiro] = useState(r?.parcelas[0]?.venc || "");
  const [linhas, setLinhas] = useState<Linha[]>(r ? r.parcelas.map((p) => ({ venc: p.venc, valor: brl(p.valor), recebidoEm: p.recebidoEm, valorRecebido: p.valorRecebido })) : [linhaNova()]);
  const [armadoDoc, setArmadoDoc] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const docu = lerDocumento(documento);
  const ehCnpj = docu.tipo === "cnpj";
  const qtd = Math.max(1, Math.min(MAX_PARCELAS, parseInt(n, 10) || 1));
  const tabela = comRecebidas || linhas.length > 1 || qtd > 1;

  /** Mudar o total, a quantidade ou o 1º vencimento refaz a divisão (enquanto nada foi recebido). */
  function refazer(t: string, q: string, prim: string) {
    if (comRecebidas) return;
    const v = lerValor(t);
    const ok = v != null && !Number.isNaN(v) && v > 0;
    setLinhas(dividir(ok ? v! : 0, parseInt(q, 10) || 1, prim).map((x) => linhaNova(x.venc, ok ? brl(x.valor) : "")));
  }
  const mudarLinha = (i: number, c: Partial<Linha>) => setLinhas((l) => l.map((x, j) => (j === i ? { ...x, ...c } : x)));
  function adicionar() {
    setLinhas((l) => { const u = l[l.length - 1]; const nova = [...l, linhaNova(u?.venc ? mesesDepois(u.venc, 1) : "")]; setN(String(nova.length)); return nova; });
  }
  function tirar(i: number) {
    setLinhas((l) => { const nova = l.filter((_, j) => j !== i); setN(String(Math.max(1, nova.length))); return nova.length ? nova : [linhaNova()]; });
  }

  const valores = linhas.map((l) => (l.recebidoEm ? l.valorRecebido ?? lerValor(l.valor) ?? 0 : lerValor(l.valor)));
  const somaLinhas = Math.round(valores.reduce<number>((t, v) => t + (v != null && !Number.isNaN(v) ? v : 0), 0) * 100) / 100;
  const totalDigitado = lerValor(total);
  const difere = !comRecebidas && tabela && totalDigitado != null && !Number.isNaN(totalDigitado) && totalDigitado > 0 && Math.abs(totalDigitado - somaLinhas) >= 0.01;

  async function salvar() {
    setErro("");
    if (!devedor.trim()) return setErro("Digite o nome de quem deve.");
    if (documento.trim() && !docu.tipo) return setErro("O CPF tem 11 números e o CNPJ, 14. Confira o que foi digitado.");
    if (docu.tipo && !docu.confere && !armadoDoc) {
      setArmadoDoc(true);
      return setErro(`O ${ehCnpj ? "CNPJ" : "CPF"} não confere. Confira os números, ou clique em Salvar de novo para guardar assim mesmo.`);
    }
    if (nascimento && !ehCnpj && (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento) || nascimento > hoje || nascimento < "1900-01-01")) return setErro("A data de nascimento não ficou certa.");
    const tel = soNumeros(telefone);
    if (tel && (tel.length < 10 || tel.length > 13)) return setErro("O telefone precisa do DDD, por exemplo (86) 99999-9999.");
    const parcelas = [];
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      const qual = tabela ? `da parcela ${i + 1}` : "";
      if (l.recebidoEm) { parcelas.push({ venc: l.venc, valor: lerValor(l.valor) ?? l.valorRecebido ?? 0, recebidoEm: l.recebidoEm, valorRecebido: l.valorRecebido }); continue; }
      const v = lerValor(l.valor);
      if (v == null || Number.isNaN(v) || v <= 0) return setErro(tabela ? `O valor ${qual} não ficou claro. Use, por exemplo, 450 ou 450,00.` : "O valor não ficou claro. Use, por exemplo, 450 ou 450,00.");
      if (l.venc && !/^\d{4}-\d{2}-\d{2}$/.test(l.venc)) return setErro(tabela ? `O vencimento ${qual} não ficou certo.` : "O prazo para receber não ficou certo.");
      parcelas.push({ venc: l.venc, valor: v, recebidoEm: null, valorRecebido: null });
    }
    setOcupado(true);
    try {
      const dados = { devedor, documento, nascimento: ehCnpj ? "" : nascimento, telefone, referencia, obs, parcelas };
      if (r) await salvarRecebivel(eu, r.id, dados); else await criarRecebivel(eu, dados);
      toast(r ? "Valor a receber atualizado." : "Valor a receber cadastrado.");
      aoFechar();
    } catch (e) { setErro(erroDe(e)); } finally { setOcupado(false); }
  }

  const anos = nascimento && !ehCnpj ? idade(nascimento, hoje) : null;
  const dicaDoc = !documento.trim() ? "" : docu.tipo ? (docu.confere ? `${ehCnpj ? "CNPJ" : "CPF"} confere` : `${ehCnpj ? "CNPJ" : "CPF"} não confere: confira os números`) : "CPF tem 11 números; CNPJ, 14";

  return (
    <Dialogo aberto aoFechar={aoFechar} classe="rec-dlg" titulo={r ? "Editar valor a receber" : "Novo valor a receber"} sub="Quem deve, quanto e, se já tiver, até quando. Pode dividir em parcelas."
      rodape={<>
        <span className="espaco" />
        <button type="button" className="bol-btn" onClick={aoFechar}>Cancelar</button>
        <button type="button" className="bol-btn pri" onClick={salvar} disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar"}</button>
      </>}>
      <section className="rec-bloco">
        <h3>Devedor</h3>
        <div className="bol-grade">
          <label className="bol-campo largo"><span>Nome do devedor</span><input value={devedor} onChange={(e) => setDevedor(e.target.value)} maxLength={120} placeholder="Nome completo ou razão social" autoComplete="off" /></label>
          <label className="bol-campo"><span>CPF ou CNPJ <em>opcional</em></span>
            <input value={documento} inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
              className={docu.tipo ? (docu.confere ? "confere" : "nao-confere") : ""}
              onChange={(e) => { setDocumento(e.target.value); setArmadoDoc(false); }}
              onBlur={() => { if (docu.tipo) setDocumento(formatarDocumento(docu.digitos)); }} />
            {dicaDoc && <small className={docu.tipo ? (docu.confere ? "ok" : "ruim") : ""}>{dicaDoc}</small>}
          </label>
          {!ehCnpj && (
            <label className="bol-campo"><span>Data de nascimento <em>opcional</em></span>
              <input type="date" value={nascimento} max={hoje} min="1900-01-01" onChange={(e) => setNascimento(e.target.value)} />
              {anos != null && <small>{anos} anos</small>}
            </label>
          )}
          <label className="bol-campo"><span>Telefone / WhatsApp <em>opcional</em></span>
            <input value={telefone} inputMode="tel" autoComplete="off" placeholder="(86) 99999-9999" onChange={(e) => setTelefone(e.target.value)} onBlur={() => setTelefone((t) => formatarTelefone(t))} />
          </label>
          <label className={`bol-campo${ehCnpj ? "" : " largo"}`}><span>Referência da venda <em>opcional</em></span>
            <input value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={160} placeholder="Ex.: Pacote Gramado · localizador ABC123" />
          </label>
        </div>
      </section>

      <section className="rec-bloco">
        <h3>Valor e prazo</h3>
        {comRecebidas
          ? <p className="bol-nota">Já tem parcela recebida. Ajuste as parcelas em aberto abaixo, ou adicione outra.</p>
          : (
            <div className="rec-ger">
              <label className="bol-campo valor"><span>{qtd > 1 ? "Valor total" : "Valor"}</span>
                <input value={total} inputMode="decimal" placeholder="R$ 0,00"
                  onChange={(e) => { setTotal(e.target.value); refazer(e.target.value, n, primeiro); }}
                  onBlur={() => { const v = lerValor(total); if (v != null && !Number.isNaN(v)) setTotal(brl(v)); }} />
              </label>
              <label className="bol-campo"><span>Parcelas</span>
                <input type="number" min={1} max={MAX_PARCELAS} value={n} inputMode="numeric"
                  onChange={(e) => { setN(e.target.value); if (e.target.value) refazer(total, e.target.value, primeiro); }}
                  onBlur={() => setN(String(qtd))} />
              </label>
              <label className="bol-campo"><span>{qtd > 1 ? "1ª parcela vence em" : "Prazo para receber"} <em>opcional</em></span>
                <input type="date" value={primeiro} onChange={(e) => { setPrimeiro(e.target.value); refazer(total, n, e.target.value); }} />
              </label>
            </div>
          )}
        {tabela && (
          <>
            <ol className="rec-linhas">
              {linhas.map((l, i) => (
                <li key={i} className={l.recebidoEm ? "recebida" : ""}>
                  <span className="n">{i + 1}/{linhas.length}</span>
                  {l.recebidoEm ? (
                    <>
                      <span className="d">{dataOu(l.venc)}</span>
                      <b>{brl(l.valorRecebido ?? lerValor(l.valor) ?? 0)}</b>
                      <span className="quando q-sol">{quandoParcela(l, hoje)}</span>
                    </>
                  ) : (
                    <>
                      <input type="date" aria-label={`Vencimento da parcela ${i + 1}`} value={l.venc} onChange={(e) => mudarLinha(i, { venc: e.target.value })} />
                      <input aria-label={`Valor da parcela ${i + 1}`} value={l.valor} inputMode="decimal" placeholder="R$ 0,00"
                        onChange={(e) => mudarLinha(i, { valor: e.target.value })}
                        onBlur={() => { const v = lerValor(l.valor); if (v != null && !Number.isNaN(v)) mudarLinha(i, { valor: brl(v) }); }} />
                      <button type="button" className="bol-icone" aria-label={`Tirar a parcela ${i + 1}`} onClick={() => tirar(i)} disabled={linhas.length === 1}>{ICO.tirar}</button>
                    </>
                  )}
                </li>
              ))}
            </ol>
            <div className="rec-soma">
              <span>{plural(linhas.length, "parcela", "parcelas")} · soma <b>{brl(somaLinhas)}</b>{difere && <em> · diferente do valor total ({brl(totalDigitado!)})</em>}</span>
              {linhas.length < MAX_PARCELAS && <button type="button" className="bol-link" onClick={adicionar}>Adicionar parcela</button>}
            </div>
            {!comRecebidas && <p className="bol-nota">Dá para mudar a data e o valor de cada parcela. Mudar o valor total, as parcelas ou o 1º vencimento refaz a divisão. Parcela sem data fica em “Sem data” até alguém escolher o vencimento.</p>}
          </>
        )}
        {!tabela && !comRecebidas && !primeiro && <p className="bol-nota">Sem prazo, o valor fica em “Sem data” até alguém escolher o vencimento.</p>}
      </section>

      <label className="bol-campo largo"><span>Observações <em>opcional</em></span>
        <textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={1000} rows={2} placeholder="Ex.: combinou pagar por PIX, mandar lembrete um dia antes" />
      </label>
      {erro && <p className="bol-erro" role="alert">{erro}</p>}
    </Dialogo>
  );
}

/* ═════════════════ Marcar como recebido ═════════════════ */

function Receber({ eu, r, inicial, aoFechar }: { eu: Eu; r: Recebivel; inicial?: number; aoFechar: () => void }) {
  const hoje = hojeIso();
  const ab = emAberto(r);
  const total = r.parcelas.length;
  const [sel, setSel] = useState<number[]>(() => [inicial ?? ab[0]?.i ?? 0]);
  const [data, setData] = useState(hoje);
  const unica = sel.length === 1 ? r.parcelas[sel[0]] : null;
  const [valor, setValor] = useState(unica ? brl(unica.valor) : "");
  const [resto, setResto] = useState(true);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { if (unica) setValor(brl(unica.valor)); }, [sel.join()]);
  const v = lerValor(valor);
  const falta = unica && v != null && !Number.isNaN(v) ? Math.round((unica.valor - v) * 100) / 100 : 0;
  const somaSel = soma(sel.map((i) => r.parcelas[i]));

  async function confirmar() {
    setErro("");
    if (!sel.length) return setErro("Escolha qual parcela foi recebida.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro("Escolha a data em que recebeu.");
    if (unica && (v == null || Number.isNaN(v) || v <= 0)) return setErro("O valor recebido não ficou claro.");
    setOcupado(true);
    try {
      const quitou = await receberParcelas(eu, r, [...sel].sort((a, b) => a - b), data, unica ? v : null, resto);
      toast(quitou ? `${r.devedor}: tudo recebido. Céu limpo ☀` : sel.length > 1 ? `${r.devedor}: ${sel.length} parcelas recebidas.` : total > 1 ? `${r.devedor}: parcela ${sel[0] + 1}/${total} recebida.` : `${r.devedor}: recebido.`);
      aoFechar();
    } catch (e) { setErro(erroDe(e)); } finally { setOcupado(false); }
  }

  return (
    <Dialogo aberto aoFechar={aoFechar} titulo="Marcar como recebido" sub={[r.devedor, r.referencia].filter(Boolean).join(" · ")}
      rodape={<><span className="espaco" /><button type="button" className="bol-btn" onClick={aoFechar}>Cancelar</button><button type="button" className="bol-btn pri" onClick={confirmar} disabled={ocupado}>{ocupado ? "Salvando…" : "Confirmar recebimento"}</button></>}>
      {ab.length > 1 && (
        <fieldset className="rec-escolha">
          <legend>Quais parcelas foram recebidas</legend>
          {ab.map((p) => {
            const cp = climaParcela(p, hoje);
            return (
              <label key={p.i} className={sel.includes(p.i) ? "on" : ""}>
                <input type="checkbox" checked={sel.includes(p.i)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, p.i] : s.filter((x) => x !== p.i)))} />
                <span className="n">{p.i + 1}/{total}</span>
                <span className="d">{dataOu(p.venc)}</span>
                <span className={`quando q-${cp}`}>{quandoParcela(p, hoje)}</span>
                <b>{brl(p.valor)}</b>
              </label>
            );
          })}
        </fieldset>
      )}
      <div className="bol-grade">
        <label className="bol-campo"><span>Recebido em</span><input type="date" value={data} max={somaDias(hoje, 1)} onChange={(e) => setData(e.target.value)} /></label>
        {unica ? (
          <label className="bol-campo"><span>Valor recebido</span>
            <input value={valor} onChange={(e) => setValor(e.target.value)} onBlur={() => { if (v != null && !Number.isNaN(v)) setValor(brl(v)); }} inputMode="decimal" />
            {falta < 0 && <small>{brl(-falta)} acima da parcela (juros ou multa).</small>}
          </label>
        ) : (
          <div className="bol-campo"><span>Total recebido</span><p className="rec-total">{brl(somaSel)}</p></div>
        )}
      </div>
      {unica && falta >= 0.01 && (
        <label className="rec-resto">
          <input type="checkbox" checked={resto} onChange={(e) => setResto(e.target.checked)} />
          <span>Deixar a diferença de <b>{brl(falta)}</b> em aberto, com o mesmo vencimento</span>
        </label>
      )}
      {erro && <p className="bol-erro" role="alert">{erro}</p>}
    </Dialogo>
  );
}

/* ═════════════════ A seção "A receber" ═════════════════ */

export function SecaoReceber({ eu, pode, hoje, abertos, erro, topo }: { eu: Eu; pode: boolean; hoje: string; abertos: Recebivel[] | null; erro: string; topo: (novo: ReactNode, resumo: string) => ReactNode }) {
  const [aba, setAba] = useState<"abertos" | "recebidos">("abertos");
  const [mes, setMes] = useState(mesAtual());
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<{ r: Recebivel | null } | null>(null);
  const [receber, setReceber] = useState<{ r: Recebivel; i?: number } | null>(null);
  const doMes = useRecebidosNoMes(mes);
  const doMesAtual = useRecebidosNoMes(mesAtual());

  const grupos = useMemo(() => {
    const g: Record<Grupo, Recebivel[]> = { tempestade: [], chuva: [], nublado: [], aberto: [], semdata: [], sol: [] };
    (abertos || []).forEach((r) => g[semData(r) ? "semdata" : climaReceber(r, hoje)].push(r));
    return g;
  }, [abertos, hoje]);
  const recebidasHoje = useMemo(() => (doMesAtual ? parcelasRecebidasNoMes(doMesAtual, mesAtual()) : null), [doMesAtual]);
  const recebidasMes = useMemo(() => (doMes ? parcelasRecebidasNoMes(doMes, mes) : null), [doMes, mes]);

  const termo = semAcento(busca.trim());
  const termoNum = soNumeros(busca);
  const bate = (r: Recebivel) => !termo || semAcento([r.devedor, r.referencia, r.obs, formatarDocumento(r.documento), formatarTelefone(r.telefone), ...r.parcelas.map((p) => brl(p.valor))].join(" ")).includes(termo)
    || (termoNum.length >= 3 && (r.documento.includes(termoNum) || r.telefone.includes(termoNum)));
  const aReceber = (abertos || []).reduce((t, r) => t + saldo(r), 0);
  const focoDe = (l: Recebivel[]) => soma(l.flatMap((r) => emFoco(r, hoje)));
  const mesCurto = nomeMes(mesAtual()).split(" ")[0].toLowerCase();
  const cartoes: CartaoPrevisao[] = [
    ["tempestade", "Atrasados", abertos ? grupos.tempestade.length : null, focoDe(grupos.tempestade), "tudo em dia"],
    ["chuva", "Vencem hoje", abertos ? grupos.chuva.length : null, focoDe(grupos.chuva), "nada hoje"],
    ["nublado", "Próximos 7 dias", abertos ? grupos.nublado.length : null, focoDe(grupos.nublado), `nada até ${brData(somaDias(hoje, 7)).slice(0, 5)}`],
    ["sol", `Recebidos em ${mesCurto}`, recebidasHoje ? recebidasHoje.length : null, recebidasHoje ? recebidasHoje.reduce((t, x) => t + (x.p.valorRecebido ?? x.p.valor), 0) : 0, "nenhum ainda"],
  ];

  function baixar() {
    const linhas: (string | number)[][] = [["Devedor", "CPF/CNPJ", "Nascimento", "Telefone", "Referência", "Parcela", "Vencimento", "Valor", "Situação", "Observações"]];
    (abertos || []).filter(bate).forEach((r) => emAberto(r).forEach((p) => linhas.push([
      r.devedor, formatarDocumento(r.documento), brData(r.nascimento), formatarTelefone(r.telefone), r.referencia,
      `${p.i + 1}/${r.parcelas.length}`, brData(p.venc), p.valor.toFixed(2).replace(".", ","), quandoParcela(p, hoje), r.obs,
    ])));
    baixarTexto(`valores-a-receber-${hoje}.csv`, csv(linhas), "text/csv;charset=utf-8");
  }
  const desfazer = async (r: Recebivel, i: number) => { try { await desfazerRecebimento(eu, r, i); toast(`${r.devedor}: parcela voltou para em aberto.`); } catch (e) { toast(erroDe(e), true); } };

  const novo = pode ? (
    <button type="button" className="bol-btn novo" onClick={() => setForm({ r: null })}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Novo valor a receber
    </button>
  ) : null;
  const resumo = abertos ? ` · ${plural(abertos.length, "valor em aberto", "valores em aberto")}, ${brl(aReceber)} a receber` : "";

  return (
    <>
      {topo(novo, resumo)}
      <Previsao cartoes={cartoes} rotulo="Resumo dos valores a receber" />

      <div className="bol-barra">
        <div className="bol-abas" role="tablist">
          <button type="button" role="tab" aria-selected={aba === "abertos"} onClick={() => setAba("abertos")}>Em aberto<span>{abertos?.length ?? "…"}</span></button>
          <button type="button" role="tab" aria-selected={aba === "recebidos"} onClick={() => setAba("recebidos")}>Recebidos</button>
        </div>
        <div className="rec-barra-dir">
          <label className="bol-busca"><span className="sr">Buscar</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar devedor, CPF, referência" />
          </label>
          {aba === "abertos" && !!abertos?.length && <button type="button" className="bol-icone rec-baixar" onClick={baixar} title="Baixar planilha (CSV)" aria-label="Baixar planilha dos valores em aberto">{ICO.baixar}</button>}
        </div>
      </div>

      {erro && <div className="bol-vazio"><b>{erro}</b></div>}
      {aba === "abertos" && !erro && (
        !abertos ? <div className="bol-vazio">Carregando…</div>
          : !abertos.length ? (
            <div className="bol-vazio ceu-limpo">
              <IconeClima c="sol" tam={64} />
              <b>Nada a receber em aberto.</b>
              {pode ? <span>Cadastre um valor a receber e ele entra na previsão.</span> : <span>Os valores a receber cadastrados aparecem aqui.</span>}
            </div>
          ) : (
            <>
              {(["tempestade", "chuva", "nublado", "aberto", "semdata"] as Grupo[]).map((c) => {
                const l = grupos[c].filter(bate);
                if (!l.length) return null;
                return (
                  <section key={c} className={`bol-grupo g-${c}`}>
                    <header><h2>{ROTULO[c]}</h2><span>{plural(l.length, "devedor", "devedores")} · {brl(focoDe(l))}</span></header>
                    <div className="bol-nuvens">
                      {l.map((r) => <Cartao key={r.id} r={r} pode={pode} hoje={hoje} eu={eu} aoEditar={() => setForm({ r })} aoReceber={(i) => setReceber({ r, i })} />)}
                    </div>
                  </section>
                );
              })}
              {termo && !abertos.some(bate) && <div className="bol-vazio"><b>Nada encontrado para “{busca.trim()}”.</b></div>}
            </>
          )
      )}

      {aba === "recebidos" && (
        <section className="bol-grupo g-sol">
          <SeletorMes titulo={nomeMes(mes)} antes={() => setMes(somaMes(mes, -1))} depois={() => setMes(somaMes(mes, 1))} podeDepois={mes < mesAtual()}
            resumo={recebidasMes ? `${plural(recebidasMes.length, "recebimento", "recebimentos")} · ${brl(recebidasMes.reduce((t, x) => t + (x.p.valorRecebido ?? x.p.valor), 0))}` : undefined} />
          {(() => {
            if (!recebidasMes) return <div className="bol-vazio">Carregando…</div>;
            const l = recebidasMes.filter((x) => bate(x.r));
            if (!l.length) return <div className="bol-vazio">{termo ? <b>Nada encontrado.</b> : <b>Nada recebido em {nomeMes(mes).toLowerCase()}.</b>}</div>;
            return (
              <ul className="rec-recebidos">
                {l.map(({ r, p }) => (
                  <li key={`${r.id}-${p.i}`}>
                    <IconeClima c="sol" tam={34} />
                    <div className="q">
                      <b>{r.devedor}</b>
                      <small>{[r.referencia, r.parcelas.length > 1 ? `parcela ${p.i + 1}/${r.parcelas.length}` : "", p.venc ? `venc. ${brData(p.venc)}` : "sem data"].filter(Boolean).join(" · ")}</small>
                    </div>
                    <span className="quando q-sol">{quandoParcela(p, hoje)}</span>
                    <b className="v">{brl(p.valorRecebido ?? p.valor)}</b>
                    {pode && <button type="button" className="bol-link" onClick={() => desfazer(r, p.i)}>Desfazer</button>}
                  </li>
                ))}
              </ul>
            );
          })()}
        </section>
      )}

      {form && <FormRecebivel key={form.r?.id || "novo"} eu={eu} r={form.r} aoFechar={() => setForm(null)} />}
      {receber && <Receber eu={eu} r={receber.r} inicial={receber.i} aoFechar={() => setReceber(null)} />}
    </>
  );
}
