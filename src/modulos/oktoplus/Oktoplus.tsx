import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { nivel, type Eu } from "../../equipe/dados";
import { toast } from "../../shell/toast";
import { csv, baixarTexto } from "../../lib/formato";
import {
  dataHora, duracao, duracaoMs, limitesMes, mesAtual, mesValido, nomeMes, proximaRenovacao, quando, somaMes,
} from "../../lib/tempo";
import {
  useContas, useHistorico, pegar, fechar, marcarEsgotada, desmarcarEsgotada, salvarConta, lembrarAparelho, nomeConta,
  type Conta, type Evento,
} from "./dados";
import {
  useAcessos, acessoDaConta, contaDoAcesso, ehContaOktoplus, cpfValido, formatarCpf, lerPlanilha, salvarPlanilha,
  salvarAcesso, excluirAcesso, type Acesso, type LinhaPlanilha,
} from "./acessos";
import "./oktoplus.css";

const erroDe = (e: unknown) => (e as { code?: string })?.code === "permission-denied" ? "Seu acesso não permite essa ação." : (e as Error)?.message || "Algo deu errado.";

/* ═════════════════ Peças ═════════════════ */

function NomeConta({ c }: { c: Pick<Conta, "titular" | "final"> }) {
  return <span className="conta-nome">{c.titular}{c.final ? <small className="final" title="Final do CPF">•••{c.final}</small> : null}</span>;
}

/** Botão que faz uma ação; com `confirmar`, o primeiro clique só arma. */
function BotaoAcao({ rotulo, confirmar, classe = "btn", titulo, acao }: {
  rotulo: string; confirmar?: string; classe?: string; titulo?: string; acao: () => Promise<string>;
}) {
  const [armado, setArmado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { if (!armado) return; const t = setTimeout(() => setArmado(false), 4000); return () => clearTimeout(t); }, [armado]);
  return (
    <button type="button" className={`${classe}${armado ? " armado" : ""}`} disabled={ocupado} title={titulo}
      onClick={async () => {
        if (confirmar && !armado) { setArmado(true); return; }
        setOcupado(true);
        try { toast(await acao()); } catch (e) { toast(erroDe(e), true); } finally { setOcupado(false); setArmado(false); }
      }}>
      {ocupado ? "…" : armado ? confirmar : rotulo}
    </button>
  );
}

/* ─── logins: mostrar, esconder e copiar ─── */

const ICO = {
  copiar: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>,
  ver: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  esconder: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>,
  abrir: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" /></svg>,
};

async function copiar(valor: string, rotulo: string) {
  try {
    await navigator.clipboard.writeText(valor);
  } catch {
    const t = document.createElement("textarea"); t.value = valor; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
  }
  toast(`${rotulo} copiado.`);
}

// "grupothe.digisac.io" vira link; CPF e e-mail não
const pareceLink = (v: string) => !v.includes("@") && /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(v.replace(/^https?:\/\//, ""));

function Credencial({ rotulo, valor, copia, segredo, endereco }: { rotulo: string; valor: string; copia?: string; segredo?: boolean; endereco?: boolean }) {
  const [ver, setVer] = useState(false);
  useEffect(() => { if (!ver) return; const t = setTimeout(() => setVer(false), 30_000); return () => clearTimeout(t); }, [ver]);
  if (!valor) return <div className="cred"><span className="cred-r">{rotulo}</span><span className="cred-v"><span className="cred-nada">—</span></span></div>;
  const link = !!endereco && pareceLink(valor);
  const nomeCurto = rotulo === "CPF" ? "CPF" : rotulo.toLowerCase();
  return (
    <div className="cred">
      <span className="cred-r">{rotulo}</span>
      <span className="cred-v">
        <code className={segredo && !ver ? "oculto" : ""}>{segredo && !ver ? "•".repeat(Math.min(12, Math.max(8, valor.length))) : valor}</code>
        {segredo && (
          <button type="button" className="ico" onClick={() => setVer((v) => !v)} aria-label={ver ? `Esconder ${nomeCurto}` : `Mostrar ${nomeCurto}`} title={ver ? "Esconder" : "Mostrar"}>
            {ver ? ICO.esconder : ICO.ver}
          </button>
        )}
        {link && <a className="ico" href={/^https?:/.test(valor) ? valor : `https://${valor}`} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${valor}`} title="Abrir">{ICO.abrir}</a>}
        <button type="button" className="ico" onClick={() => copiar(copia ?? valor, rotulo)} aria-label={`Copiar ${nomeCurto}`} title="Copiar">{ICO.copiar}</button>
      </span>
    </div>
  );
}

function Credenciais({ a }: { a: Acesso }) {
  return (
    <div className="creds">
      {ehContaOktoplus(a) && <Credencial rotulo="CPF" valor={formatarCpf(a.cpf)} copia={a.cpf} />}
      <Credencial rotulo="Senha" valor={a.senha} segredo />
      <Credencial rotulo={a.email && pareceLink(a.email) ? "Endereço" : "E-mail"} valor={a.email} endereco />
    </div>
  );
}

function PegarConta({ eu, conta, aparelhoPadrao, aparelhos, aoPegar }: {
  eu: Eu; conta: Conta; aparelhoPadrao: string; aparelhos: string[]; aoPegar: (ap: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [ap, setAp] = useState(aparelhoPadrao);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { if (!aberto) setAp(aparelhoPadrao); }, [aparelhoPadrao, aberto]);
  if (!aberto) return <button type="button" className="btn pri" onClick={() => setAberto(true)}>Pegar</button>;
  const lista = `ap-${conta.id}`;
  return (
    <form className="pegar" onSubmit={async (e) => {
      e.preventDefault(); setOcupado(true);
      try { toast(await pegar(eu, conta.id, ap)); aoPegar(ap.trim()); } catch (x) { toast(erroDe(x), true); setOcupado(false); }
    }}>
      <label className="campo">
        <span>Em qual aparelho você vai usar {conta.titular}?</span>
        <input list={lista} value={ap} onChange={(e) => setAp(e.target.value)} placeholder="Ex.: Cell Lívia" autoComplete="off" maxLength={40} autoFocus />
        <datalist id={lista}>{aparelhos.map((a) => <option key={a} value={a} />)}</datalist>
      </label>
      <div className="linha">
        <button type="submit" className="btn pri" disabled={ocupado}>{ocupado ? "Pegando…" : "Confirmar"}</button>
        <button type="button" className="btn" onClick={() => setAberto(false)} disabled={ocupado}>Cancelar</button>
      </div>
    </form>
  );
}

function Navegacao({ sub, admin }: { sub: string; admin: boolean }) {
  const itens: [string, string][] = admin
    ? [["", "Contas"], ["logins", "Logins"], ["historico", "Histórico"], ["gerenciar", "Gerenciar contas"]]
    : [["", "Contas"], ["logins", "Logins"], ["gerenciar", "Gerenciar contas"]];
  return (
    <nav className="okto-nav" aria-label="Seções do Oktoplus">
      {itens.map(([k, t]) => <a key={k} href={`#/oktoplus${k ? "/" + k : ""}`} className={sub.split("/")[0] === k ? "on" : ""} aria-current={sub.split("/")[0] === k ? "page" : undefined}>{t}</a>)}
    </nav>
  );
}

/* ═════════════════ Página principal: quem está com cada conta ═════════════════ */

function Painel({ eu, contas, admin, acessos }: { eu: Eu; contas: Conta[]; admin: boolean; acessos: Acesso[] }) {
  const [aparelho, setAparelho] = useState("");
  useEffect(() => {
    getDoc(doc(db, "pessoas", eu.pid)).then((s) => { if (s.exists()) setAparelho(s.data().aparelho || ""); }).catch(() => {});
  }, [eu.pid]);
  const ativas = contas.filter((c) => c.ativa);
  const comigo = ativas.filter((c) => c.uso && c.uso.pid === eu.pid);
  const livres = ativas.filter((c) => !c.uso && !c.esgotada);
  const comOutros = ativas.filter((c) => c.uso && c.uso.pid !== eu.pid).sort((a, b) => a.uso!.nome.localeCompare(b.uso!.nome, "pt-BR"));
  const esgotadas = ativas.filter((c) => c.esgotada && !c.uso);
  const nUso = ativas.filter((c) => c.uso).length;
  const aparelhos = useMemo(() => [...new Set([aparelho, ...ativas.map((c) => c.uso?.aparelho || "")].filter(Boolean))].sort(), [aparelho, ativas]);
  const aoPegar = (ap: string) => { if (ap && ap !== aparelho) { setAparelho(ap); lembrarAparelho(eu, ap); } };

  return (
    <>
      <div className="resumo" aria-label="Resumo das contas">
        <div className="kpi livre"><b>{livres.length}</b><span>livres</span></div>
        <div className="kpi uso"><b>{nUso}</b><span>em uso</span></div>
        <div className="kpi esg"><b>{esgotadas.length}</b><span>esgotadas</span></div>
      </div>

      <section aria-labelledby="h-comigo" className="bloco">
        <h2 id="h-comigo" className="tit">Com você <span className="cont">{comigo.length}</span></h2>
        {comigo.length ? (
          <ul className="lista">
            {comigo.map((c) => (
              <li key={c.id} className="item meu">
                <div className="item-t">
                  <NomeConta c={c} />
                  <span className="det">com você desde {quando(c.uso!.inicio)} · {duracao(c.uso!.inicio, null)}{c.uso!.aparelho ? <> · <span className="nw">{c.uso!.aparelho}</span></> : ""}</span>
                </div>
                <div className="item-a">
                  <BotaoAcao rotulo="Devolver" acao={() => fechar(eu, c.id, false, admin)} />
                  <BotaoAcao rotulo="Esgotou" confirmar="Confirmar: esgotou?" classe="btn aviso" titulo="Os tokens desta conta acabaram neste mês" acao={() => fechar(eu, c.id, true, admin)} />
                </div>
                {(() => {
                  const a = acessoDaConta(c, acessos);
                  if (a) return <div className="login-conta"><span className="login-tit">Login para entrar na Oktoplus</span><Credenciais a={a} /></div>;
                  return <p className="login-falta">O login desta conta ainda não está em <a href="#/oktoplus/logins">Logins</a>. Cadastre lá em <b>Adicionar login</b>.</p>;
                })()}
              </li>
            ))}
          </ul>
        ) : <p className="vazio">Você não está com nenhuma conta agora.</p>}
      </section>

      <section aria-labelledby="h-livres" className="bloco">
        <h2 id="h-livres" className="tit">Livres <span className="cont">{livres.length}</span></h2>
        {livres.length ? (
          <ul className="lista">
            {livres.map((c) => (
              <li key={c.id} className="item">
                <div className="item-t"><NomeConta c={c} /></div>
                <div className="item-a"><PegarConta eu={eu} conta={c} aparelhoPadrao={aparelho} aparelhos={aparelhos} aoPegar={aoPegar} /></div>
              </li>
            ))}
          </ul>
        ) : <p className="vazio">Nenhuma conta livre agora.</p>}
      </section>

      <section aria-labelledby="h-uso" className="bloco">
        <h2 id="h-uso" className="tit">Com outras pessoas <span className="cont">{comOutros.length}</span></h2>
        {comOutros.length ? (
          <ul className="lista">
            {comOutros.map((c) => (
              <li key={c.id} className="item">
                <div className="item-t">
                  <NomeConta c={c} />
                  <span className="det">com <b>{c.uso!.nome}</b> desde <span className="nw">{quando(c.uso!.inicio)}</span>{c.uso!.aparelho ? <> · <span className="nw">{c.uso!.aparelho}</span></> : ""}</span>
                </div>
                {admin && (
                  <div className="item-a">
                    <BotaoAcao rotulo="Liberar" confirmar={`Tirar de ${c.uso!.nome}?`} titulo="Libera a conta (como administrador)" acao={() => fechar(eu, c.id, false, admin)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="vazio">Ninguém mais está com conta agora.</p>}
      </section>

      <section aria-labelledby="h-esg" className="bloco">
        <h2 id="h-esg" className="tit">Esgotadas neste mês <span className="cont">{esgotadas.length}</span></h2>
        <p className="dica">Os tokens renovam em {proximaRenovacao()} e elas voltam sozinhas para as livres.</p>
        {esgotadas.length ? (
          <ul className="lista">
            {esgotadas.map((c) => (
              <li key={c.id} className="item esg">
                <div className="item-t">
                  <NomeConta c={c} />
                  <span className="det">{c.esgotadaPor && c.esgotadaEm ? <>esgotou {quando(c.esgotadaEm)} · marcada por {c.esgotadaPor.nome}</> : "esgotada neste mês"}</span>
                </div>
                {admin && (
                  <div className="item-a">
                    <BotaoAcao rotulo="Desmarcar" confirmar="Voltar para livres?" titulo="Use se a conta foi marcada por engano" acao={() => desmarcarEsgotada(eu, c.id)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="vazio">Nenhuma conta esgotada neste mês.</p>}
      </section>
    </>
  );
}

/* ═════════════════ Gerenciar contas (toda a equipe da Oktoplus) ═════════════════ */

function FormConta({ eu, conta, admin, aoSalvar }: { eu: Eu; conta: Conta | null; admin: boolean; aoSalvar?: () => void }) {
  const [titular, setTitular] = useState(conta?.titular || "");
  const [final, setFinal] = useState(conta?.final || "");
  const [obs, setObs] = useState(conta?.obs || "");
  const [ativa, setAtiva] = useState(conta ? conta.ativa : true);
  const [msg, setMsg] = useState<{ ok?: string; erro?: string }>({});
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault(); setOcupado(true); setMsg({});
    try {
      const r = await salvarConta(eu, conta?.id || null, { titular, final, obs, ativa });
      setMsg({ ok: r });
      if (!conta) { setTitular(""); setFinal(""); setObs(""); }
      aoSalvar?.();
    } catch (x) { setMsg({ erro: erroDe(x) }); } finally { setOcupado(false); }
  }
  return (
    <form className="form grade" onSubmit={enviar}>
      <label className="campo"><span>Titular</span><input value={titular} onChange={(e) => setTitular(e.target.value)} required maxLength={60} placeholder="Nome da pessoa da conta" /></label>
      <label className="campo curto"><span>Final do CPF</span><input value={final} onChange={(e) => setFinal(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={4} placeholder="Ex.: 75" /></label>
      <label className="campo largo"><span>Observação</span><input value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} /></label>
      {conta && (() => {
        // desativar fecha o uso de quem está com a conta: sem ser administrador, só com a conta livre
        const travada = !admin && !!conta.uso;
        return (
          <label className="chk" title={travada ? `Está com ${conta.uso!.nome}: só dá para desativar depois que for devolvida` : undefined}>
            <input type="checkbox" checked={ativa} disabled={travada} onChange={(e) => setAtiva(e.target.checked)} /> <span>Conta ativa{travada ? ` (em uso por ${conta.uso!.nome})` : ""}</span>
          </label>
        );
      })()}
      <div className="linha"><button type="submit" className="btn pri" disabled={ocupado}>{ocupado ? "Salvando…" : conta ? "Salvar conta" : "Cadastrar conta"}</button></div>
      {msg.erro && <p className="msg erro" role="alert">{msg.erro}</p>}
      {msg.ok && <p className="msg ok" role="status">{msg.ok}</p>}
    </form>
  );
}

function Gerenciar({ eu, contas, admin }: { eu: Eu; contas: Conta[]; admin: boolean }) {
  const ordenadas = [...contas].sort((a, b) => Number(b.ativa) - Number(a.ativa));
  return (
    <section aria-labelledby="h-contas" className="bloco">
      <h2 id="h-contas" className="tit">Contas <span className="cont">{contas.filter((c) => c.ativa).length} ativas</span></h2>
      <p className="dica">{admin
        ? <>Qualquer pessoa com acesso pode pegar qualquer conta livre; quem usou fica no Histórico. Toda a equipe da Oktoplus pode cadastrar e editar contas aqui e os logins em Logins; liberar a conta de outra pessoa e apagar login é só com o administrador. Os logins (CPF, senha e e-mail) ficam em <a href="#/oktoplus/logins">Logins</a>. As pessoas e os PINs ficam em Equipe.</>
        : <>Aqui você cadastra uma conta nova e corrige o nome, o final do CPF ou a observação. Depois de cadastrar, coloque o login dela (CPF, senha e e-mail) em <a href="#/oktoplus/logins">Logins</a>. Tirar a conta de outra pessoa é só com o administrador.</>}</p>
      <ul className="lista">
        {ordenadas.map((c) => (
          <li key={c.id} className={`item col${c.ativa ? "" : " inativa"}`}>
            <details className="edit">
              <summary>
                <div className="item-t">
                  <NomeConta c={c} />
                  <span className="det">
                    {!c.ativa ? "desativada" : c.esgotada ? "esgotada neste mês" : c.uso ? <>com <b>{c.uso.nome}</b> desde {quando(c.uso.inicio)}</> : "livre"}
                    {c.obs ? ` · ${c.obs}` : ""}
                  </span>
                </div>
                <span className="editar" aria-hidden="true">Editar</span>
              </summary>
              <FormConta eu={eu} conta={c} admin={admin} />
            </details>
            {c.ativa && (
              <div className="item-a">
                {admin && c.uso && <BotaoAcao rotulo="Liberar" confirmar={`Tirar de ${c.uso.nome}?`} acao={() => fechar(eu, c.id, false, true)} />}
                {c.esgotada
                  ? <BotaoAcao rotulo="Desmarcar esgotada" confirmar="Voltar para livres?" acao={() => desmarcarEsgotada(eu, c.id)} />
                  : (admin || !c.uso || c.uso.pid === eu.pid) && <BotaoAcao rotulo="Marcar esgotada" confirmar="Confirmar: esgotada?" classe="btn aviso" acao={() => marcarEsgotada(eu, c.id)} />}
              </div>
            )}
          </li>
        ))}
      </ul>
      <details className="novo">
        <summary className="btn">Adicionar conta</summary>
        <FormConta eu={eu} conta={null} admin={admin} />
      </details>
    </section>
  );
}

/* ═════════════════ Histórico (administrador) ═════════════════ */

function textoEvento(e: Evento): ReactNode {
  const conta = nomeConta(e.conta, e.final), q = e.quem?.nome ?? "Alguém", alvo = e.alvo?.nome;
  switch (e.tipo) {
    case "pegou": { const ap = (e.detalhe ?? "").replace(/\s*·?\s*empréstimo/, "").trim(); return <><b>{q}</b> pegou <b>{conta}</b>{ap ? ` (${ap})` : ""}</>; }
    case "devolveu": return <><b>{q}</b> devolveu <b>{conta}</b></>;
    case "esgotou": return e.quem
      ? <><b>{q}</b> marcou <b>{conta}</b> como esgotada{alvo && alvo !== q ? ` (estava com ${alvo})` : ""}</>
      : <><b>{conta}</b> esgotada{e.detalhe ? ` (${e.detalhe})` : ""}</>;
    case "liberou": return <><b>{q}</b> liberou <b>{conta}</b>{alvo ? ` (estava com ${alvo})` : ""}</>;
    case "reabriu": return <><b>{q}</b> desmarcou <b>{conta}</b> como esgotada</>;
    case "conta_criada": return <><b>{q}</b> cadastrou a conta <b>{conta}</b></>;
    case "conta_editada": return <><b>{q}</b> editou a conta <b>{conta}</b>{e.detalhe ? ` (${e.detalhe})` : ""}</>;
    case "pessoa_criada": return <><b>{q}</b> cadastrou <b>{alvo}</b>{e.detalhe ? ` (${e.detalhe})` : ""}</>;
    case "pessoa_editada": return <><b>{q}</b> editou <b>{alvo}</b>{e.detalhe ? ` (${e.detalhe})` : ""}</>;
    case "pin_gerado": return <><b>{q}</b> gerou um PIN novo para <b>{alvo}</b></>;
    case "pin_trocado": return <><b>{q}</b> trocou o próprio PIN</>;
    case "bloqueio": return <>Entrada de <b>{q}</b> bloqueada ({e.detalhe})</>;
    case "carga_inicial": return <>Carga inicial da planilha{e.detalhe ? ` (${e.detalhe})` : ""}</>;
    case "zerado": return <><b>Início do controle</b>: uso zerado{e.detalhe ? ` (${e.detalhe})` : ""}</>;
    case "logins": return <><b>{q}</b> {e.detalhe || "mexeu nos logins"}</>;
    case "importado": return <><b>{q}</b> trouxe os dados do site antigo da Oktoplus{e.detalhe ? ` (${e.detalhe})` : ""}</>;
    default: return <>{e.tipo}</>;
  }
}

function Historico({ contas, mes }: { contas: Conta[]; mes: string }) {
  const { usos, eventos } = useHistorico(mes);
  const atual = mesAtual();
  if (!usos || !eventos) return <p className="vazio">Carregando o histórico…</p>;
  const { ini, fim: fimMes } = limitesMes(mes);
  const agora = new Date();
  const iniciados = usos.filter((u) => u.inicio >= ini);
  const esgotou = eventos.filter((e) => e.tipo === "esgotou");
  const msNoMes = (u: { inicio: Date; fim: Date | null }) => Math.max(0, Math.min((u.fim ?? agora).getTime(), fimMes.getTime(), agora.getTime()) - Math.max(u.inicio.getTime(), ini.getTime()));
  const tempo = (ms: number) => (ms ? duracaoMs(ms) : "—");

  type P = { nome: string; usos: number; contas: Set<string>; esg: number; ms: number };
  const pp = new Map<string, P>();
  const P = (n: string) => { if (!pp.has(n)) pp.set(n, { nome: n, usos: 0, contas: new Set(), esg: 0, ms: 0 }); return pp.get(n)!; };
  for (const u of usos) { const p = P(u.nome); if (u.inicio >= ini) p.usos++; p.contas.add(u.contaId); p.ms += msNoMes(u); }
  for (const e of esgotou) if (e.quem) P(e.quem.nome).esg++;
  const pessoas = [...pp.values()].sort((a, b) => b.usos - a.usos || b.ms - a.ms || a.nome.localeCompare(b.nome, "pt-BR"));

  const porConta = new Map<string, { quem: Map<string, number>; vezes: number }>();
  for (const u of usos) {
    const c = porConta.get(u.contaId) ?? { quem: new Map(), vezes: 0 };
    c.quem.set(u.nome, (c.quem.get(u.nome) ?? 0) + 1); c.vezes++;
    porConta.set(u.contaId, c);
  }
  const esgPorConta = new Map<string, Evento>();
  for (const e of [...esgotou].reverse()) if (e.contaId) esgPorConta.set(e.contaId, e);
  const contasAtivas = contas.filter((c) => c.ativa);
  const nEsg = new Set(esgotou.map((e) => e.contaId || e.conta)).size, nPessoas = pessoas.filter((p) => p.usos).length;
  const como = (t: string | null) => (t === "devolvida" ? "devolveu" : t === "esgotou" ? "esgotou" : t === "liberada" ? "liberada" : "");

  const baixar = () => {
    const linhas = usos.map((u) => [u.titular, u.final, u.nome, u.aparelho, dataHora(u.inicio), u.fim ? dataHora(u.fim) : "em uso", duracao(u.inicio, u.fim), como(u.fimTipo), u.fimPor?.nome ?? ""]);
    baixarTexto(`oktoplus-usos-${mes}.csv`, csv([["Conta", "Final CPF", "Quem usou", "Aparelho", "Início", "Fim", "Tempo", "Como terminou", "Por"], ...linhas]), "text/csv;charset=utf-8");
  };

  return (
    <>
      <div className="mes-nav">
        <a className="btn" href={`#/oktoplus/historico/${somaMes(mes, -1)}`} aria-label="Mês anterior">‹</a>
        <h1>{nomeMes(mes)}</h1>
        {mes < atual ? <a className="btn" href={`#/oktoplus/historico/${somaMes(mes, 1)}`} aria-label="Próximo mês">›</a> : <span className="btn fantasma" aria-hidden="true">›</span>}
        <button type="button" className="btn" onClick={baixar}>Baixar CSV</button>
      </div>

      <div className="resumo r4">
        <div className="kpi"><b>{iniciados.length}</b><span>{iniciados.length === 1 ? "vez que pegaram conta" : "vezes que pegaram conta"}</span></div>
        <div className="kpi uso"><b>{porConta.size}</b><span>{porConta.size === 1 ? "conta usada" : "contas usadas"}</span></div>
        <div className="kpi esg"><b>{nEsg}</b><span>{nEsg === 1 ? "esgotada" : "esgotadas"} (de {contasAtivas.length} contas)</span></div>
        <div className="kpi livre"><b>{nPessoas}</b><span>{nPessoas === 1 ? "pessoa usou" : "pessoas usaram"}</span></div>
      </div>

      <section className="bloco" aria-labelledby="h-pp">
        <h2 id="h-pp" className="tit">Por pessoa</h2>
        {pessoas.length ? (
          <div className="tabela-w"><table className="tabela">
            <thead><tr><th>Pessoa</th><th className="n">Pegou conta</th><th className="n">Contas diferentes</th><th className="n">Tempo com contas</th><th className="n">Marcou esgotada</th></tr></thead>
            <tbody>{pessoas.map((p) => <tr key={p.nome}><td>{p.nome}</td><td className="n">{p.usos || "—"}</td><td className="n">{p.contas.size || "—"}</td><td className="n nw">{tempo(p.ms)}</td><td className="n">{p.esg || "—"}</td></tr>)}</tbody>
          </table></div>
        ) : <p className="vazio">Nenhum uso registrado em {nomeMes(mes).toLowerCase()}.</p>}
      </section>

      <section className="bloco" aria-labelledby="h-pc">
        <h2 id="h-pc" className="tit">Por conta</h2>
        <div className="tabela-w"><table className="tabela">
          <thead><tr><th>Conta</th><th>Quem usou</th><th className="n">Vezes</th><th>Esgotou</th></tr></thead>
          <tbody>{contasAtivas.map((c) => {
            const x = porConta.get(c.id), e = esgPorConta.get(c.id);
            return <tr key={c.id}>
              <td>{nomeConta(c.titular, c.final)}</td>
              <td>{x ? [...x.quem.entries()].map(([n, k]) => (k > 1 ? `${n} (${k}x)` : n)).join(", ") : "—"}</td>
              <td className="n">{x?.vezes || "—"}</td>
              <td>{e ? `${quando(e.em)}${e.quem ? ` · ${e.quem.nome}` : " · planilha"}` : "—"}</td>
            </tr>;
          })}</tbody>
        </table></div>
      </section>

      <section className="bloco" aria-labelledby="h-usos">
        <h2 id="h-usos" className="tit">Usos <span className="cont">{usos.length}</span></h2>
        {usos.length ? (
          <div className="tabela-w"><table className="tabela">
            <thead><tr><th>Conta</th><th>Com</th><th>Aparelho</th><th>De</th><th>Até</th><th className="n">Tempo</th><th>Como terminou</th></tr></thead>
            <tbody>{usos.map((u) => <tr key={u.id}>
              <td>{nomeConta(u.titular, u.final)}</td>
              <td>{u.nome}</td>
              <td>{u.aparelho || "—"}</td>
              <td className="nw">{dataHora(u.inicio)}</td>
              <td className="nw">{u.fim ? dataHora(u.fim) : <em className="tag uso">em uso</em>}</td>
              <td className="n nw">{duracao(u.inicio, u.fim)}</td>
              <td>{u.fimTipo === "devolvida" ? "devolveu" : u.fimTipo === "esgotou" ? `esgotou${u.fimPor && u.fimPor.nome !== u.nome ? ` (${u.fimPor.nome})` : ""}` : u.fimTipo === "liberada" ? `liberada${u.fimPor ? ` por ${u.fimPor.nome}` : ""}` : "—"}</td>
            </tr>)}</tbody>
          </table></div>
        ) : <p className="vazio">Nenhum uso neste mês.</p>}
      </section>

      <section className="bloco" aria-labelledby="h-reg">
        <h2 id="h-reg" className="tit">Registro de tudo <span className="cont">{eventos.length}</span></h2>
        {eventos.length ? (
          <ul className="registro">
            {eventos.map((e) => <li key={e.id}><time>{quando(e.em)}</time><span>{textoEvento(e)}</span></li>)}
          </ul>
        ) : <p className="vazio">Nada registrado neste mês.</p>}
      </section>
    </>
  );
}

/* ═════════════════ Logins ═════════════════ */

function FormLogin({ eu, atual, aoSalvar }: { eu: Eu; atual: Acesso | null; aoSalvar?: () => void }) {
  const [nome, setNome] = useState(atual?.nome || "");
  const [cpf, setCpf] = useState(atual?.cpf ? formatarCpf(atual.cpf) : "");
  const [senha, setSenha] = useState(atual?.senha || "");
  const [email, setEmail] = useState(atual?.email || "");
  const [obs, setObs] = useState(atual?.obs || "");
  const [msg, setMsg] = useState<{ ok?: string; erro?: string }>({});
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault(); setOcupado(true); setMsg({});
    try {
      const r = await salvarAcesso(eu, atual, { nome, cpf, senha, email, obs });
      setMsg({ ok: r });
      if (!atual) { setNome(""); setCpf(""); setSenha(""); setEmail(""); setObs(""); }
      aoSalvar?.();
    } catch (x) { setMsg({ erro: erroDe(x) }); } finally { setOcupado(false); }
  }
  return (
    <form className="form grade" onSubmit={enviar}>
      <label className="campo"><span>Nome (titular da conta ou sistema)</span><input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={60} placeholder="Ex.: Isolina, Seats.aero" /></label>
      <label className="campo"><span>CPF (só para contas Oktoplus)</span><input value={cpf} onChange={(e) => setCpf(e.target.value)} inputMode="numeric" maxLength={20} placeholder="000.000.000-00" /></label>
      <label className="campo"><span>Senha</span><input value={senha} onChange={(e) => setSenha(e.target.value)} maxLength={120} autoComplete="off" spellCheck={false} /></label>
      <label className="campo"><span>E-mail ou endereço</span><input value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} autoComplete="off" spellCheck={false} /></label>
      <label className="campo largo"><span>Observação</span><input value={obs} onChange={(e) => setObs(e.target.value)} maxLength={300} /></label>
      <div className="linha"><button type="submit" className="btn pri" disabled={ocupado}>{ocupado ? "Salvando…" : atual ? "Salvar login" : "Cadastrar login"}</button></div>
      {msg.erro && <p className="msg erro" role="alert">{msg.erro}</p>}
      {msg.ok && <p className="msg ok" role="status">{msg.ok}</p>}
    </form>
  );
}

function situacao(c: Conta | null) {
  if (!c) return null;
  if (!c.ativa) return <em className="tag">desativada</em>;
  if (c.uso) return <em className="tag uso">com {c.uso.nome}</em>;
  if (c.esgotada) return <em className="tag esg">esgotada</em>;
  return <em className="tag sua">livre</em>;
}

function CartaoLogin({ eu, a, conta, admin }: { eu: Eu; a: Acesso; conta: Conta | null; admin: boolean }) {
  const okto = ehContaOktoplus(a);
  return (
    <li className="item col login">
      <div className="login-cab">
        <span className="conta-nome">{a.nome}{okto ? <small className="final" title="Final do CPF">•••{a.cpf.slice(-2)}</small> : null}</span>
        {situacao(conta)}
        {okto && !cpfValido(a.cpf) && <em className="tag emp" title="Os dígitos verificadores deste CPF não batem. Confira na planilha.">CPF não confere</em>}
        {okto && !conta && <em className="tag" title="Não achei uma conta com esse nome e final de CPF em Gerenciar contas">sem conta cadastrada</em>}
      </div>
      <Credenciais a={a} />
      {a.obs && <p className="det obs">{a.obs}</p>}
      <div className="login-adm">
        <details className="edit">
          <summary><span className="editar">Editar</span></summary>
          <FormLogin eu={eu} atual={a} />
        </details>
        {admin && <BotaoAcao rotulo="Apagar" confirmar={`Apagar o login de ${a.nome}?`} classe="btn aviso" acao={() => excluirAcesso(eu, a)} />}
      </div>
    </li>
  );
}

function ColarPlanilha({ eu, acessos, contas }: { eu: Eu; acessos: Acesso[]; contas: Conta[] }) {
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const lido = useMemo(() => (texto.trim() ? lerPlanilha(texto, acessos) : null), [texto, acessos]);
  // para a prévia: cada linha como se já estivesse salva, para achar a conta dela
  const comoAcesso = (l: LinhaPlanilha, i: number): Acesso => ({ id: `previa-${i}`, ...l, ordem: i, atualizadoPor: "", atualizadoEm: null });
  const previa = lido ? lido.linhas.map((l, i) => { const a = comoAcesso(l, i); return { l, conta: contaDoAcesso(a, contas, lido.linhas.map(comoAcesso)) }; }) : [];
  async function salvar() {
    if (!lido?.linhas.length) return;
    setOcupado(true);
    try { toast(await salvarPlanilha(eu, lido.linhas)); setTexto(""); } catch (x) { toast(erroDe(x), true); } finally { setOcupado(false); }
  }
  return (
    <details className="novo colar">
      <summary className="btn">Colar da planilha</summary>
      <p className="dica">Na planilha, selecione as linhas (pode incluir o cabeçalho) com as colunas <b>ACESSO, CPF, SENHA, EMAIL</b>, copie e cole aqui. Quem já está na lista com o mesmo nome e CPF é atualizado; o resto entra como novo.</p>
      <label className="campo"><span>Linhas copiadas da planilha</span>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} spellCheck={false} autoComplete="off" placeholder={"ACESSO\tCPF\tSENHA\tEMAIL\nMARIA\t000.000.000-00\tsenha123\temail@exemplo.com"} />
      </label>
      {lido && (
        <>
          <div className="tabela-w"><table className="tabela previa">
            <thead><tr><th>Acesso</th><th>CPF</th><th>Senha</th><th>E-mail</th><th>Vai para</th><th /></tr></thead>
            <tbody>{previa.map(({ l, conta }, i) => (
              <tr key={i}>
                <td>{l.nome}</td>
                <td className="nw">{l.cpf ? <>{formatarCpf(l.cpf)}{!cpfValido(l.cpf) && <em className="tag emp">não confere</em>}</> : "—"}</td>
                <td className="nw">{l.senha ? "••••••" : "—"}</td>
                <td className="email">{l.email || "—"}</td>
                <td className="vai">{l.cpf ? (conta ? <>conta <b>{conta.titular}</b> <span className="nw">•••{conta.final}</span></> : <span className="det">sem conta cadastrada</span>) : "Outros acessos"}</td>
                <td>{l.existente ? <em className="tag uso">atualiza</em> : <em className="tag sua">novo</em>}</td>
              </tr>
            ))}</tbody>
          </table></div>
          {lido.ignoradas > 0 && <p className="dica">{lido.ignoradas} linha(s) sem nome ficaram de fora.</p>}
          <div className="linha">
            <button type="button" className="btn pri" onClick={salvar} disabled={ocupado || !lido.linhas.length}>{ocupado ? "Salvando…" : `Salvar ${lido.linhas.length} login${lido.linhas.length === 1 ? "" : "s"}`}</button>
            <button type="button" className="btn" onClick={() => setTexto("")} disabled={ocupado}>Limpar</button>
          </div>
        </>
      )}
    </details>
  );
}

function Logins({ eu, contas, acessos, erro, admin }: { eu: Eu; contas: Conta[]; acessos: Acesso[] | null; erro: string; admin: boolean }) {
  const [busca, setBusca] = useState("");
  if (erro) return <p className="vazio">{erro}</p>;
  if (!acessos) return <p className="vazio">Carregando os logins…</p>;
  const q = busca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const qd = q.replace(/\D/g, "");
  const bate = (a: Acesso) => !q || a.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(q)
    || a.email.toLowerCase().includes(q) || (qd.length >= 3 && a.cpf.includes(qd));
  const lista = acessos.filter(bate);
  const okto = lista.filter(ehContaOktoplus), outros = lista.filter((a) => !ehContaOktoplus(a));
  return (
    <>
      <p className="dica topo-dica">Toda a equipe da Oktoplus vê esta lista e pode cadastrar e corrigir logins (fica registrado quem mexeu). A senha fica escondida até você clicar no olho, e o botão de copiar copia sem mostrar. Ao sair do sistema, a cópia guardada no navegador é apagada.</p>
      {acessos.length > 0 && (
        <label className="campo busca"><span className="sr">Buscar login</span>
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CPF ou e-mail" />
        </label>
      )}
      <section className="bloco" aria-labelledby="h-lg-okto">
        <h2 id="h-lg-okto" className="tit">Contas Oktoplus <span className="cont">{okto.length}</span></h2>
        {okto.length ? (
          <ul className="lista">{okto.map((a) => <CartaoLogin key={a.id} eu={eu} a={a} conta={contaDoAcesso(a, contas, acessos)} admin={admin} />)}</ul>
        ) : <p className="vazio">{busca ? "Nenhum login encontrado." : admin ? "Nenhum login cadastrado ainda. Use \"Colar da planilha\" logo abaixo." : "Nenhum login cadastrado ainda. Use \"Adicionar login\" logo abaixo."}</p>}
      </section>
      {(outros.length > 0 || !busca) && (
        <section className="bloco" aria-labelledby="h-lg-outros">
          <h2 id="h-lg-outros" className="tit">Outros acessos da agência <span className="cont">{outros.length}</span></h2>
          {outros.length ? <ul className="lista">{outros.map((a) => <CartaoLogin key={a.id} eu={eu} a={a} conta={null} admin={admin} />)}</ul>
            : <p className="vazio">Nenhum outro acesso cadastrado.</p>}
        </section>
      )}
      <section className="bloco">
        <details className="novo">
          <summary className="btn">Adicionar login</summary>
          <p className="dica">Para uma conta Oktoplus nova, use o mesmo nome e o CPF do titular cadastrado em <a href="#/oktoplus/gerenciar">Gerenciar contas</a>: o login aparece sozinho para quem pegar a conta.</p>
          <FormLogin eu={eu} atual={null} />
        </details>
        {admin && <ColarPlanilha eu={eu} acessos={acessos} contas={contas} />}
      </section>
    </>
  );
}

/* ═════════════════ Aba ═════════════════ */

export default function Oktoplus({ eu, sub }: { eu: Eu; sub: string }) {
  const admin = nivel(eu, "oktoplus") === "admin";
  const { contas, erro } = useContas();
  const { acessos, erro: erroAcessos } = useAcessos();
  const [secao, param] = sub.split("/");
  const pagina = secao === "logins" || secao === "gerenciar" ? secao : admin && secao === "historico" ? secao : "";
  const mes = mesValido(param) && param <= mesAtual() ? param : mesAtual();
  return (
    <div className="okto">
      <main className={`pag${pagina === "historico" ? " larga" : ""}`}>
        <div className="okto-topo">
          <div>
            <h1>{pagina === "logins" ? "Logins" : "Contas Oktoplus"}</h1>
            <p>{pagina === "logins" ? "CPF, senha e e-mail das contas Oktoplus e dos outros sistemas da agência" : "Quem está com cada conta da agência agora"}</p>
          </div>
          <Navegacao sub={pagina} admin={admin} />
        </div>
        {erro && <p className="vazio">{erro}</p>}
        {!contas && !erro && <p className="vazio">Carregando as contas…</p>}
        {contas && !contas.length && pagina === "" && (
          <p className="vazio">{admin ? <>Nenhuma conta cadastrada ainda. Cadastre em <a href="#/oktoplus/gerenciar">Gerenciar contas</a> ou traga os dados do site antigo em <a href="#/equipe">Equipe</a>.</> : <>Nenhuma conta cadastrada ainda. Cadastre em <a href="#/oktoplus/gerenciar">Gerenciar contas</a>.</>}</p>
        )}
        {contas && pagina === "" && <Painel eu={eu} contas={contas} admin={admin} acessos={acessos || []} />}
        {contas && pagina === "logins" && <Logins eu={eu} contas={contas} acessos={acessos} erro={erroAcessos} admin={admin} />}
        {contas && pagina === "gerenciar" && <Gerenciar eu={eu} contas={contas} admin={admin} />}
        {contas && pagina === "historico" && <Historico contas={contas} mes={mes} />}
      </main>
    </div>
  );
}
