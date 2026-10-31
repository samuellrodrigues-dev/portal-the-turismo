import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CEU, Ceu, Dialogo, IconeClima, Previsao, SeletorMes, erroDe, semAcento, type CartaoPrevisao } from "./comum";
import { SecaoReceber } from "./Receber";
import { useReceberAbertos } from "./recebiveis";
import { nivel, type Eu } from "../../equipe/dados";
import { toast } from "../../shell/toast";
import { brl, lerValor, plural } from "../../lib/formato";
import { brData, diasEntre, hojeIso, mesAtual, nomeMes, somaDias, somaMes } from "../../lib/tempo";
import {
  CATEGORIAS, clima, criarBoleto, excluirBoleto, marcarPago, quandoVence, reabrir, repetirProximoMes, salvarBoleto,
  useAbertos, usePagos, type Boleto, type Clima, type DadosBoleto,
} from "./dados";
import { lerLinha, type LeituraLinha } from "./linha";
import { abrirAnexo, excluirAnexo, salvarAnexo, tamanho, MAX_BYTES, type Anexo, type Papel } from "./arquivos";
import "./boletos.css";

const ROTULO: Record<Clima, string> = { tempestade: "Atrasados", chuva: "Vencem hoje", nublado: "Próximos 7 dias", aberto: "Mais adiante", sol: "Pagos" };

/* ═════════════════ Um boleto ═════════════════ */

function linhaCurta(l: string) {
  const r = lerLinha(l);
  return r ? r.formatada : l;
}

function Nuvem({ b, pode, aoEditar, aoPagar, hoje, eu }: { b: Boleto; pode: boolean; aoEditar: () => void; aoPagar: () => void; hoje: string; eu: Eu }) {
  const c = clima(b, hoje);
  const [menu, setMenu] = useState(false);
  const [armado, setArmado] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!armado) return; const t = setTimeout(() => setArmado(false), 4000); return () => clearTimeout(t); }, [armado]);
  useEffect(() => {
    if (!menu) return;
    const f = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", f); return () => document.removeEventListener("mousedown", f);
  }, [menu]);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(b.linha); toast("Linha digitável copiada. É só colar no app do banco."); }
    catch { toast("Não consegui copiar. Selecione a linha e copie à mão.", true); }
  };
  const abrir = async (a: Anexo) => { try { await abrirAnexo(a); } catch (e) { toast(erroDe(e), true); } };
  const valorMostrado = b.status === "pago" && b.valorPago != null ? b.valorPago : b.valor;
  return (
    <article className={`nuvem clima-${c}`}>
      <div className="nuvem-ic" title={CEU[c]}><IconeClima c={c} /></div>
      <div className="nuvem-info">
        <h3>{b.descricao}</h3>
        <p className="nuvem-sub">
          {b.beneficiario && <span>{b.beneficiario}</span>}
          {b.categoria && <span className="cat">{b.categoria}</span>}
          {b.emissor && <span className="emissor">{b.emissor}</span>}
        </p>
        {b.linha && b.status === "aberto" && (
          <button type="button" className="nuvem-linha" onClick={copiar} title="Copiar a linha digitável">
            <code>{linhaCurta(b.linha)}</code>
            <span>Copiar</span>
          </button>
        )}
        {(b.anexos.length > 0 || b.obs) && (
          <div className="nuvem-extra">
            {b.anexos.map((a) => (
              <button key={a.id} type="button" className={`anexo ${a.papel}`} onClick={() => abrir(a)} title={`${a.nome} · ${tamanho(a.bytes)}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.5 12.8 20.7a5 5 0 0 1-7.1-7.1l8.5-8.5a3.4 3.4 0 0 1 4.8 4.8l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" /></svg>
                {a.papel === "boleto" ? "Boleto" : a.papel === "comprovante" ? "Comprovante" : a.nome}
              </button>
            ))}
            {b.obs && <span className="obs" title={b.obs}>{b.obs}</span>}
          </div>
        )}
      </div>
      <div className="nuvem-valor">
        <b>{brl(valorMostrado)}</b>
        <span className={`quando q-${c}`}>{quandoVence(b, hoje)}</span>
        <small>{b.status === "pago" ? `vencia ${brData(b.vencimento)}` : brData(b.vencimento)}</small>
      </div>
      {pode && (
        <div className="nuvem-acoes" ref={ref}>
          {b.status === "aberto"
            ? <button type="button" className="bol-btn pagar" onClick={aoPagar}>Marcar como pago</button>
            : <button type="button" className="bol-btn" onClick={async () => { try { await reabrir(eu, b); toast(`${b.descricao} voltou para em aberto.`); } catch (e) { toast(erroDe(e), true); } }}>Desfazer pagamento</button>}
          <button type="button" className="bol-icone" aria-label={`Mais opções de ${b.descricao}`} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
          </button>
          {menu && (
            <div className="bol-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMenu(false); aoEditar(); }}>Editar</button>
              <button type="button" role="menuitem" onClick={async () => { setMenu(false); try { await repetirProximoMes(eu, b); toast(`${b.descricao}: criado para o mês seguinte.`); } catch (e) { toast(erroDe(e), true); } }}>Repetir no mês seguinte</button>
              <button type="button" role="menuitem" className={`perigo${armado ? " armado" : ""}`} onClick={async () => {
                if (!armado) { setArmado(true); return; }
                setMenu(false);
                try { await excluirBoleto(b); toast(`${b.descricao} excluído.`); } catch (e) { toast(erroDe(e), true); }
              }}>{armado ? "Clique de novo para excluir" : "Excluir"}</button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/* ═════════════════ Formulário ═════════════════ */

type Pendente = { file: File; papel: Papel; nome: string };

function FormBoleto({ eu, b, categorias, aoFechar }: { eu: Eu; b: Boleto | null; categorias: string[]; aoFechar: () => void }) {
  const [linha, setLinha] = useState(b?.linha ? linhaCurta(b.linha) : "");
  const [leitura, setLeitura] = useState<LeituraLinha | null>(b?.linha ? lerLinha(b.linha) : null);
  const [descricao, setDescricao] = useState(b?.descricao || "");
  const [beneficiario, setBeneficiario] = useState(b?.beneficiario || "");
  const [categoria, setCategoria] = useState(b?.categoria || "");
  const [valor, setValor] = useState(b ? brl(b.valor) : "");
  const [vencimento, setVencimento] = useState(b?.vencimento || "");
  const [obs, setObs] = useState(b?.obs || "");
  const [anexos, setAnexos] = useState<Anexo[]>(b?.anexos || []);
  const [tirados, setTirados] = useState<string[]>([]);
  const [novos, setNovos] = useState<Pendente[]>([]);
  const [auto, setAuto] = useState<Record<string, boolean>>({});
  const [lendo, setLendo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const pdfRef = useRef<HTMLInputElement>(null);

  function aplicarLinha(texto: string, forcar = false) {
    const r = lerLinha(texto);
    setLeitura(r);
    if (!r) return;
    setLinha(r.formatada);
    const a: Record<string, boolean> = {};
    if (r.valor != null && (forcar || !valor || auto.valor)) { setValor(brl(r.valor)); a.valor = true; }
    if (r.vencimento && (forcar || !vencimento || auto.vencimento)) { setVencimento(r.vencimento); a.vencimento = true; }
    setAuto((x) => ({ ...x, ...a }));
  }

  async function lerPdf(f: File | undefined) {
    if (!f) return;
    if (f.size > MAX_BYTES) { setErro(`"${f.name}" tem mais de 8 MB.`); return; }
    setLendo("Lendo o PDF…"); setErro("");
    setNovos((n) => [...n.filter((x) => x.papel !== "boleto"), { file: f, papel: "boleto", nome: f.name }]);
    try {
      const { lerPdfBoleto } = await import("./lerPdf");
      const r = await lerPdfBoleto(await f.arrayBuffer());
      const a: Record<string, boolean> = {};
      if (r.linha) { setLinha(r.linha.formatada); setLeitura(r.linha); }
      const v = r.linha?.valor ?? r.valor, venc = r.linha?.vencimento ?? r.vencimento;
      if (v != null) { setValor(brl(v)); a.valor = true; }
      if (venc) { setVencimento(venc); a.vencimento = true; }
      if (r.beneficiario && !beneficiario) { setBeneficiario(r.beneficiario); a.beneficiario = true; }
      setAuto((x) => ({ ...x, ...a }));
      setLendo(r.linha ? (r.linha.valido ? "PDF lido: linha digitável, valor e vencimento preenchidos. Confira antes de salvar." : "Achei a linha digitável, mas ela não confere. Confira os números.") : "O PDF vai junto como anexo, mas não achei a linha digitável nele. Digite ou cole a linha.");
    } catch {
      setLendo("O PDF vai junto como anexo, mas não consegui ler o texto dele. Preencha à mão.");
    }
  }

  async function salvar() {
    setErro("");
    const v = lerValor(valor);
    if (!descricao.trim()) return setErro("Diga o que é esse boleto (ex.: Aluguel da sala, Internet).");
    if (v == null || Number.isNaN(v) || v <= 0) return setErro("O valor não ficou claro. Use, por exemplo, 450 ou 450,00.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) return setErro("Escolha a data de vencimento.");
    if (linha.trim() && leitura && !leitura.valido) return setErro(leitura.motivo || "A linha digitável não confere.");
    if (linha.trim() && !leitura) return setErro("A linha digitável precisa ter 47 números (ou 48, nas contas de consumo).");
    setOcupado(true);
    try {
      const dados: DadosBoleto = {
        descricao, beneficiario, categoria, valor: v, vencimento, linha: leitura?.linha || "", emissor: leitura?.emissor || "", obs,
        anexos: anexos.filter((a) => !tirados.includes(a.id)),
      };
      let id = b?.id || "";
      if (b) await salvarBoleto(eu, b.id, dados); else id = await criarBoleto(eu, dados);
      if (novos.length) {
        const subidos: Anexo[] = [];
        for (const n of novos) subidos.push(await salvarAnexo(id, n.file, n.papel));
        await salvarBoleto(eu, id, { ...dados, anexos: [...dados.anexos, ...subidos] });
      }
      for (const t of tirados) { try { await excluirAnexo(t); } catch { /* segue */ } }
      toast(b ? "Boleto atualizado." : "Boleto cadastrado.");
      aoFechar();
    } catch (e) { setErro(erroDe(e)); } finally { setOcupado(false); }
  }

  const hoje = hojeIso();
  const dica = vencimento ? (() => { const d = diasEntre(hoje, vencimento); return d < 0 ? `Venceu há ${-d} ${-d === 1 ? "dia" : "dias"}.` : d === 0 ? "Vence hoje." : `Vence em ${d} ${d === 1 ? "dia" : "dias"}.`; })() : "";

  return (
    <Dialogo aberto aoFechar={aoFechar} titulo={b ? "Editar boleto" : "Novo boleto"} sub="Cole a linha digitável ou anexe o PDF: o valor e o vencimento se preenchem sozinhos."
      rodape={<>
        <span className="espaco" />
        <button type="button" className="bol-btn" onClick={aoFechar}>Cancelar</button>
        <button type="button" className="bol-btn pri" onClick={salvar} disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar boleto"}</button>
      </>}>
      <section className="bol-ler">
        <label className="bol-campo"><span>Linha digitável ou código de barras <em>opcional</em></span>
          <input className="mono" value={linha} placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000" inputMode="numeric" autoComplete="off"
            onChange={(e) => { setLinha(e.target.value); const n = e.target.value.replace(/\D/g, ""); if ([44, 47, 48].includes(n.length)) aplicarLinha(e.target.value); else setLeitura(null); }}
            onPaste={(e) => { const t = e.clipboardData.getData("text"); if (t) { e.preventDefault(); setLinha(t); aplicarLinha(t, true); } }}
            onBlur={() => linha.trim() && aplicarLinha(linha)} />
        </label>
        {leitura && (
          <p className={`bol-lido ${leitura.valido ? "ok" : "ruim"}`}>
            {leitura.valido
              ? <>Linha conferida · {leitura.emissor}{leitura.valor != null ? ` · ${brl(leitura.valor)}` : ""}{leitura.vencimento ? ` · vence ${brData(leitura.vencimento)}` : ""}</>
              : leitura.motivo}
          </p>
        )}
        <div className="bol-ou"><span>ou</span></div>
        <button type="button" className="bol-btn pdf" onClick={() => pdfRef.current?.click()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 18v-6M9 15l3 3 3-3" /></svg>
          Anexar o PDF do boleto
        </button>
        <input ref={pdfRef} type="file" accept="application/pdf" hidden onChange={(e) => { lerPdf(e.target.files?.[0]); e.target.value = ""; }} />
        {lendo && <p className="bol-nota">{lendo}</p>}
      </section>

      <div className="bol-grade">
        <label className="bol-campo largo"><span>O que é</span><input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={160} placeholder="Ex.: Aluguel da sala, Internet da agência" /></label>
        <label className="bol-campo"><span>Quem recebe <em>opcional</em></span><input className={auto.beneficiario ? "auto" : ""} value={beneficiario} onChange={(e) => { setBeneficiario(e.target.value); setAuto((x) => ({ ...x, beneficiario: false })); }} maxLength={160} placeholder="Beneficiário" /></label>
        <label className="bol-campo"><span>Categoria <em>opcional</em></span>
          <input value={categoria} onChange={(e) => setCategoria(e.target.value)} list="bol-categorias" maxLength={40} placeholder="Ex.: Aluguel" />
          <datalist id="bol-categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="bol-campo"><span>Valor</span><input className={auto.valor ? "auto" : ""} value={valor} onChange={(e) => { setValor(e.target.value); setAuto((x) => ({ ...x, valor: false })); }} onBlur={() => { const v = lerValor(valor); if (v != null && !Number.isNaN(v)) setValor(brl(v)); }} inputMode="decimal" placeholder="R$ 0,00" /></label>
        <label className="bol-campo"><span>Vencimento</span><input className={auto.vencimento ? "auto" : ""} type="date" value={vencimento} onChange={(e) => { setVencimento(e.target.value); setAuto((x) => ({ ...x, vencimento: false })); }} />{dica && <small>{dica}</small>}</label>
        <label className="bol-campo largo"><span>Observações <em>opcional</em></span><textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={1000} rows={2} placeholder="Ex.: pagar pelo PIX do Inter, mandar comprovante para o contador" /></label>
      </div>

      <section className="bol-anexos">
        <h3>Anexos</h3>
        <ul>
          {anexos.filter((a) => !tirados.includes(a.id)).map((a) => (
            <li key={a.id}><span className={`papel ${a.papel}`}>{a.papel === "boleto" ? "Boleto" : a.papel === "comprovante" ? "Comprovante" : "Outro"}</span><button type="button" className="bol-link" onClick={() => abrirAnexo(a).catch((e) => toast(erroDe(e), true))}>{a.nome}</button><small>{tamanho(a.bytes)}</small><button type="button" className="bol-link perigo" onClick={() => setTirados((t) => [...t, a.id])}>Tirar</button></li>
          ))}
          {novos.map((n, i) => (
            <li key={i}><span className={`papel ${n.papel}`}>{n.papel === "boleto" ? "Boleto" : n.papel === "comprovante" ? "Comprovante" : "Outro"}</span><span>{n.nome}</span><small>{tamanho(n.file.size)} · vai ao salvar</small><button type="button" className="bol-link perigo" onClick={() => setNovos((x) => x.filter((_, j) => j !== i))}>Tirar</button></li>
          ))}
          {!anexos.filter((a) => !tirados.includes(a.id)).length && !novos.length && <li className="vazio">Nenhum anexo.</li>}
        </ul>
        <div className="bol-anexar">
          {(["comprovante", "outro"] as Papel[]).map((p) => (
            <label key={p} className="bol-btn">
              {p === "comprovante" ? "Anexar comprovante" : "Anexar outro arquivo"}
              <input type="file" accept="application/pdf,image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setNovos((x) => [...x, { file: f, papel: p, nome: f.name }]); e.target.value = ""; }} />
            </label>
          ))}
        </div>
      </section>
      {erro && <p className="bol-erro" role="alert">{erro}</p>}
    </Dialogo>
  );
}

function PagarBoleto({ eu, b, aoFechar }: { eu: Eu; b: Boleto; aoFechar: () => void }) {
  const [data, setData] = useState(hojeIso());
  const [valor, setValor] = useState(brl(b.valor));
  const [comp, setComp] = useState<File | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function pagar() {
    const v = lerValor(valor);
    if (v == null || Number.isNaN(v) || v <= 0) return setErro("O valor pago não ficou claro.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro("Escolha a data do pagamento.");
    setOcupado(true); setErro("");
    try {
      const anexos = [...b.anexos];
      if (comp) anexos.push(await salvarAnexo(b.id, comp, "comprovante"));
      await marcarPago(eu, b, data, v, anexos);
      toast(`${b.descricao}: pago. Céu limpo ☀`);
      aoFechar();
    } catch (e) { setErro(erroDe(e)); } finally { setOcupado(false); }
  }
  return (
    <Dialogo aberto aoFechar={aoFechar} titulo="Marcar como pago" sub={`${b.descricao} · vence ${brData(b.vencimento)}`}
      rodape={<><span className="espaco" /><button type="button" className="bol-btn" onClick={aoFechar}>Cancelar</button><button type="button" className="bol-btn pri" onClick={pagar} disabled={ocupado}>{ocupado ? "Salvando…" : "Confirmar pagamento"}</button></>}>
      <div className="bol-grade">
        <label className="bol-campo"><span>Pago em</span><input type="date" value={data} max={somaDias(hojeIso(), 1)} onChange={(e) => setData(e.target.value)} /></label>
        <label className="bol-campo"><span>Valor pago</span><input value={valor} onChange={(e) => setValor(e.target.value)} onBlur={() => { const v = lerValor(valor); if (v != null && !Number.isNaN(v)) setValor(brl(v)); }} inputMode="decimal" /></label>
        <label className="bol-campo largo"><span>Comprovante <em>opcional</em></span>
          <input type="file" accept="application/pdf,image/*" onChange={(e) => setComp(e.target.files?.[0] || null)} />
          <small>PDF ou foto. Fotos grandes são reduzidas antes de salvar.</small>
        </label>
      </div>
      {erro && <p className="bol-erro" role="alert">{erro}</p>}
    </Dialogo>
  );
}

/* ═════════════════ Boletos a pagar ═════════════════ */

function SecaoPagar({ eu, pode, hoje, abertos, erro, topo }: { eu: Eu; pode: boolean; hoje: string; abertos: Boleto[] | null; erro: string; topo: (novo: ReactNode, resumo: string) => ReactNode }) {
  const [aba, setAba] = useState<"abertos" | "pagos">("abertos");
  const [mes, setMes] = useState(mesAtual());
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<{ b: Boleto | null } | null>(null);
  const [pagar, setPagar] = useState<Boleto | null>(null);
  const pagosMes = usePagos(mes);
  const pagosHoje = usePagos(mesAtual());

  const grupos = useMemo(() => {
    const g: Record<Clima, Boleto[]> = { tempestade: [], chuva: [], nublado: [], aberto: [], sol: [] };
    (abertos || []).forEach((b) => g[clima(b, hoje)].push(b));
    return g;
  }, [abertos, hoje]);
  const categorias = useMemo(() => [...new Set([...CATEGORIAS, ...(abertos || []).map((b) => b.categoria), ...(pagosMes || []).map((b) => b.categoria)].filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")), [abertos, pagosMes]);

  const termo = semAcento(busca.trim());
  const filtrar = (l: Boleto[]) => (termo ? l.filter((b) => semAcento([b.descricao, b.beneficiario, b.categoria, b.obs, b.emissor, brl(b.valor)].join(" ")).includes(termo)) : l);
  const totalAberto = (abertos || []).reduce((t, b) => t + b.valor, 0);
  const soma = (l: Boleto[]) => l.reduce((t, b) => t + b.valor, 0);
  const cartoes: CartaoPrevisao[] = [
    ["tempestade", "Atrasados", abertos ? grupos.tempestade.length : null, soma(grupos.tempestade), "tudo em dia"],
    ["chuva", "Vencem hoje", abertos ? grupos.chuva.length : null, soma(grupos.chuva), "nada hoje"],
    ["nublado", "Próximos 7 dias", abertos ? grupos.nublado.length : null, soma(grupos.nublado), `nada até ${brData(somaDias(hoje, 7)).slice(0, 5)}`],
    ["sol", `Pagos em ${nomeMes(mesAtual()).split(" ")[0].toLowerCase()}`, pagosHoje ? pagosHoje.length : null, (pagosHoje || []).reduce((x, b) => x + (b.valorPago ?? b.valor), 0), "nenhum ainda"],
  ];
  const novo = pode ? (
    <button type="button" className="bol-btn novo" onClick={() => setForm({ b: null })}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Novo boleto
    </button>
  ) : null;
  const resumo = abertos ? ` · ${plural(abertos.length, "boleto em aberto", "boletos em aberto")}, ${brl(totalAberto)}` : "";

  return (
    <>
      {topo(novo, resumo)}
      <Previsao cartoes={cartoes} rotulo="Resumo dos vencimentos" />

      <div className="bol-barra">
        <div className="bol-abas" role="tablist">
          <button type="button" role="tab" aria-selected={aba === "abertos"} onClick={() => setAba("abertos")}>Em aberto<span>{abertos?.length ?? "…"}</span></button>
          <button type="button" role="tab" aria-selected={aba === "pagos"} onClick={() => setAba("pagos")}>Pagos</button>
        </div>
        <label className="bol-busca"><span className="sr">Buscar</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar boleto, quem recebe, categoria" />
        </label>
      </div>

      {erro && <div className="bol-vazio"><b>{erro}</b></div>}
      {aba === "abertos" && !erro && (
        !abertos ? <div className="bol-vazio">Carregando a previsão…</div>
          : !abertos.length ? (
            <div className="bol-vazio ceu-limpo">
              <IconeClima c="sol" tam={64} />
              <b>Céu limpo: nenhum boleto em aberto.</b>
              {pode ? <span>Cadastre o próximo boleto e ele entra na previsão.</span> : <span>Os boletos cadastrados aparecem aqui.</span>}
            </div>
          ) : (
            (["tempestade", "chuva", "nublado", "aberto"] as Clima[]).map((c) => {
              const l = filtrar(grupos[c]);
              if (!l.length) return null;
              return (
                <section key={c} className={`bol-grupo g-${c}`}>
                  <header>
                    <h2>{ROTULO[c]}</h2>
                    <span>{plural(l.length, "boleto", "boletos")} · {brl(soma(l))}</span>
                  </header>
                  <div className="bol-nuvens">
                    {l.map((b) => <Nuvem key={b.id} b={b} pode={pode} hoje={hoje} eu={eu} aoEditar={() => setForm({ b })} aoPagar={() => setPagar(b)} />)}
                  </div>
                </section>
              );
            })
          )
      )}
      {aba === "abertos" && abertos && abertos.length > 0 && termo && !(["tempestade", "chuva", "nublado", "aberto"] as Clima[]).some((c) => filtrar(grupos[c]).length) && (
        <div className="bol-vazio"><b>Nada encontrado para “{busca.trim()}”.</b></div>
      )}

      {aba === "pagos" && (
        <section className="bol-grupo g-sol">
          <SeletorMes titulo={nomeMes(mes)} antes={() => setMes(somaMes(mes, -1))} depois={() => setMes(somaMes(mes, 1))} podeDepois={mes < mesAtual()}
            resumo={pagosMes ? `${plural(pagosMes.length, "pago", "pagos")} · ${brl(pagosMes.reduce((t, b) => t + (b.valorPago ?? b.valor), 0))}` : undefined} />
          {!pagosMes ? <div className="bol-vazio">Carregando…</div>
            : !filtrar(pagosMes).length ? <div className="bol-vazio">{termo ? <b>Nada encontrado.</b> : <b>Nenhum boleto pago em {nomeMes(mes).toLowerCase()}.</b>}</div>
              : <div className="bol-nuvens">{filtrar(pagosMes).map((b) => <Nuvem key={b.id} b={b} pode={pode} hoje={hoje} eu={eu} aoEditar={() => setForm({ b })} aoPagar={() => setPagar(b)} />)}</div>}
        </section>
      )}
      {form && <FormBoleto key={form.b?.id || "novo"} eu={eu} b={form.b} categorias={categorias} aoFechar={() => setForm(null)} />}
      {pagar && <PagarBoleto eu={eu} b={pagar} aoFechar={() => setPagar(null)} />}
    </>
  );
}

/* ═════════════════ Página: Valores a receber ═════════════════ */

const ICO_SECAO = {
  receber: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v5M18 9.5v5" /></svg>,
  pagar: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.5h14v17l-2.4-1.6-2.3 1.6-2.3-1.6-2.3 1.6-2.3-1.6L5 20.5z" /><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" /></svg>,
};

/** #/boletos → A receber · #/boletos/pagar → Boletos a pagar (o endereço continua "boletos" para não mexer nos acessos). */
export default function ValoresAReceber({ eu, sub = "" }: { eu: Eu; sub?: string }) {
  const pode = nivel(eu, "boletos") === "editar";
  const secao = sub.split("/")[0] === "pagar" ? "pagar" : "receber";
  const [hoje, setHoje] = useState(hojeIso());
  useEffect(() => { const t = setInterval(() => setHoje(hojeIso()), 60_000); return () => clearInterval(t); }, []);
  const boletos = useAbertos();
  const receber = useReceberAbertos();
  const diaLongo = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Fortaleza" });

  const nav = (
    <nav className="bol-secoes" aria-label="Seções">
      <a href="#/boletos" aria-current={secao === "receber" ? "page" : undefined}>{ICO_SECAO.receber}A receber<span>{receber.lista?.length ?? "…"}</span></a>
      <a href="#/boletos/pagar" aria-current={secao === "pagar" ? "page" : undefined}>{ICO_SECAO.pagar}Boletos a pagar<span>{boletos.lista?.length ?? "…"}</span></a>
    </nav>
  );
  const topo = (titulo: string) => (novo: ReactNode, resumo: string) => (
    <>
      {nav}
      <header className="bol-topo">
        <div>
          <h1>{titulo}</h1>
          <p>Previsão de {diaLongo}{resumo}</p>
        </div>
        {novo}
      </header>
    </>
  );

  return (
    <div className="bol">
      <Ceu />
      <main className="bol-pag">
        {secao === "receber"
          ? <SecaoReceber eu={eu} pode={pode} hoje={hoje} abertos={receber.lista} erro={receber.erro} topo={topo("Valores a receber")} />
          : <SecaoPagar eu={eu} pode={pode} hoje={hoje} abertos={boletos.lista} erro={boletos.erro} topo={topo("Boletos a pagar")} />}
      </main>
    </div>
  );
}
