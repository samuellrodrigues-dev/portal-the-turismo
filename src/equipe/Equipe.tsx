import { useEffect, useState, type FormEvent } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "../shell/toast";
import { iniciais } from "../lib/formato";
import {
  ABAS_VAZIAS, MODULOS, atualizarPessoa, criarPessoa, digitosPara, docParaPessoa, novoPinPara, precisaPin6, traduzirErroAuth,
  type Abas, type Eu, type Pessoa,
} from "./dados";
import { importar, jaImportado, lerArquivo, previa, type Exportacao, type Previa, type Resultado } from "./importar";
import { guardarPins } from "./pinsPendentes";
import "./equipe.css";

function resumoAcessos(p: Pick<Pessoa, "admin" | "abas">) {
  if (p.admin) return "Administrador · vê e faz tudo";
  const partes = MODULOS.filter((m) => p.abas[m.id]).map((m) => `${m.nome}: ${m.niveis.find(([v]) => v === p.abas[m.id])?.[1].toLowerCase()}`);
  return partes.length ? partes.join(" · ") : "Sem acesso a nenhuma aba";
}

function Acessos({ admin, abas, onAdmin, onAbas, travarAdmin }: {
  admin: boolean; abas: Abas; onAdmin: (v: boolean) => void; onAbas: (a: Abas) => void; travarAdmin?: boolean;
}) {
  return (
    <div className="eq-acessos">
      <label className="tt-chk"><input type="checkbox" checked={admin} disabled={travarAdmin} onChange={(e) => onAdmin(e.target.checked)} /> <span><b>Administrador</b>: vê todas as abas e cuida da equipe</span></label>
      {!admin && (
        <div className="eq-abas">
          {MODULOS.map((m) => (
            <label key={m.id} className="tt-campo"><span>{m.nome}</span>
              <select value={abas[m.id]} onChange={(e) => onAbas({ ...abas, [m.id]: e.target.value } as Abas)}>
                {m.niveis.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function EditarPessoa({ eu, p }: { eu: Eu; p: Pessoa }) {
  const souEu = p.id === eu.pid;
  const [nome, setNome] = useState(p.nome);
  const [admin, setAdmin] = useState(p.admin);
  const [abas, setAbas] = useState<Abas>(p.abas);
  const [ativo, setAtivo] = useState(p.ativo);
  const [aparelho, setAparelho] = useState(p.aparelho);
  const [msg, setMsg] = useState<{ ok?: string; erro?: string }>({});
  const [armado, setArmado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { if (!armado) return; const t = setTimeout(() => setArmado(false), 4000); return () => clearTimeout(t); }, [armado]);
  const semLogin = !p.uid;

  async function salvar(e: FormEvent) {
    e.preventDefault(); setMsg({}); setOcupado(true);
    try {
      const n = nome.replace(/\s+/g, " ").trim().slice(0, 40);
      if (!n) throw new Error("Digite o nome.");
      if (souEu && (!admin || !ativo)) throw new Error("Você não pode tirar seu próprio acesso de administrador nem se desativar.");
      await atualizarPessoa(p, { nome: n, admin, abas: admin ? p.abas : abas, ativo, aparelho: aparelho.trim().slice(0, 40) });
      const fraco = ativo && p.pinDigitos < 6 && precisaPin6(admin, abas);
      setMsg({ ok: `${n} salvo(a).${fraco ? " Com esses acessos o PIN precisa ter 6 números: gere um PIN novo." : ""}` });
    } catch (x) { setMsg({ erro: traduzirErroAuth(x) }); } finally { setOcupado(false); }
  }
  async function gerar() {
    if (!armado) { setArmado(true); return; }
    setArmado(false); setOcupado(true); setMsg({});
    try {
      const pin = await novoPinPara(p, digitosPara(p.admin, p.abas));
      guardarPins([{ chave: p.id, nome: p.nome, pin }]);
      setMsg({ ok: `PIN novo de ${p.nome} gerado. Ele está no quadro "PINs para entregar", no canto da tela.` });
    } catch (x) { setMsg({ erro: traduzirErroAuth(x) }); } finally { setOcupado(false); }
  }

  return (
    <form className="eq-form" onSubmit={salvar}>
      <div className="eq-linha">
        <label className="tt-campo"><span>Nome</span><input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} required /></label>
        <label className="tt-campo"><span>Aparelho de costume (Oktoplus)</span><input value={aparelho} onChange={(e) => setAparelho(e.target.value)} maxLength={40} placeholder="Ex.: Cell Lívia" /></label>
      </div>
      <Acessos admin={admin} abas={abas} onAdmin={setAdmin} onAbas={setAbas} travarAdmin={souEu} />
      {!souEu && !semLogin && <label className="tt-chk"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> <span>Ativa (pode entrar no sistema)</span></label>}
      <div className="eq-botoes">
        <button type="submit" className="tt-btn pri" disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar"}</button>
        {!souEu && (p.ativo || semLogin) && (
          <button type="button" className={`tt-btn${armado ? " armado" : ""}`} onClick={gerar} disabled={ocupado}>
            {armado ? (semLogin ? `Criar login para ${p.nome}?` : `Gerar PIN novo para ${p.nome}?`) : semLogin ? "Criar login e PIN" : "Gerar PIN novo"}
          </button>
        )}
        {souEu && <a className="tt-btn" href="#/pin">Trocar meu PIN</a>}
      </div>
      {semLogin && <p className="tt-nota">Essa pessoa veio do histórico antigo e ainda não tem login. Para ela voltar a entrar, use "Criar login e PIN".</p>}
      {msg.erro && <p className="tt-msg erro" role="alert">{msg.erro}</p>}
      {msg.ok && <p className="tt-msg ok" role="status">{msg.ok}</p>}
    </form>
  );
}

function NovaPessoa() {
  const [nome, setNome] = useState("");
  const [admin, setAdmin] = useState(false);
  const [abas, setAbas] = useState<Abas>({ ...ABAS_VAZIAS, oktoplus: "usar" });
  const [aparelho, setAparelho] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function criar(e: FormEvent) {
    e.preventDefault(); setMsg(""); setOk("");
    const n = nome.replace(/\s+/g, " ").trim().slice(0, 40);
    if (!n) return setMsg("Digite o nome.");
    setOcupado(true);
    try {
      const r = await criarPessoa({ nome: n, admin, abas, aparelho: aparelho.trim() });
      guardarPins([{ chave: r.pid, nome: n, pin: r.pin }]);
      setOk(`${n} cadastrado(a). O PIN está no quadro "PINs para entregar", no canto da tela.`); setNome(""); setAparelho(""); setAdmin(false); setAbas({ ...ABAS_VAZIAS, oktoplus: "usar" });
      toast(`${n} cadastrado(a).`);
    } catch (x) { setMsg(traduzirErroAuth(x)); } finally { setOcupado(false); }
  }
  return (
    <form className="eq-form" onSubmit={criar}>
      <div className="eq-linha">
        <label className="tt-campo"><span>Nome</span><input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} placeholder="Como aparece na tela de entrada" /></label>
        <label className="tt-campo"><span>Aparelho de costume (Oktoplus)</span><input value={aparelho} onChange={(e) => setAparelho(e.target.value)} maxLength={40} placeholder="Ex.: Cell Lívia" /></label>
      </div>
      <Acessos admin={admin} abas={abas} onAdmin={setAdmin} onAbas={setAbas} />
      <p className="tt-nota">O PIN é gerado na hora: {digitosPara(admin, abas)} números {precisaPin6(admin, abas) ? "(quem vê dados de clientes ou administra usa 6)" : "(só Oktoplus usa 4)"}.</p>
      <div className="eq-botoes"><button type="submit" className="tt-btn pri" disabled={ocupado}>{ocupado ? "Cadastrando…" : "Cadastrar e gerar PIN"}</button></div>
      {msg && <p className="tt-msg erro" role="alert">{msg}</p>}
      {ok && <p className="tt-msg ok" role="status">{ok}</p>}
    </form>
  );
}

/* ═════════════════ Importar do site antigo da Oktoplus ═════════════════ */

function ImportarOktoplus({ eu }: { eu: Eu }) {
  const [arq, setArq] = useState<Exportacao | null>(null);
  const [pv, setPv] = useState<Previa | null>(null);
  const [ja, setJa] = useState<{ em: Date | null; por: string } | null>(null);
  const [erro, setErro] = useState("");
  const [passo, setPasso] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);
  const [confirmo, setConfirmo] = useState(false);
  useEffect(() => { jaImportado().then(setJa).catch(() => {}); }, [res]);

  async function escolher(f: File | undefined) {
    setErro(""); setPv(null); setArq(null); setRes(null); setConfirmo(false);
    if (!f) return;
    try { const x = lerArquivo(await f.text()); setArq(x); setPv(await previa(x)); } catch (x) { setErro((x as Error).message); }
  }
  async function rodar() {
    if (!arq) return;
    setErro(""); setPasso("Começando…");
    try {
      const r = await importar(eu, arq, setPasso);
      guardarPins(r.pins.map((x) => ({ chave: x.pid, nome: x.nome, pin: x.pin })));
      setRes(r); setPasso(""); toast("Dados da Oktoplus trazidos.");
    }
    catch (x) { setErro(traduzirErroAuth(x)); setPasso(""); }
  }
  const tudoCerto = res && res.conferencia.every((c) => c.achado >= c.esperado);

  return (
    <section className="tt-bloco eq-importar">
      <h2>Trazer dados do site antigo da Oktoplus</h2>
      <p>Uma vez só, na troca de sistema. Traz a equipe, as contas, quem está com cada conta agora e todo o histórico. Cada pessoa ganha um PIN novo.</p>
      {ja && !res && <p className="tt-msg ok">Já foi feito{ja.em ? ` em ${ja.em.toLocaleDateString("pt-BR")}` : ""}{ja.por ? ` por ${ja.por}` : ""}. Importar de novo regrava as contas como estavam no arquivo.</p>}
      {!res && (
        <label className="eq-arquivo">
          <input type="file" accept="application/json,.json" onChange={(e) => escolher(e.target.files?.[0])} disabled={!!passo} />
          <b>Escolher o arquivo</b>
          <span><code>oktoplus-exportacao.json</code>, gerado na pasta controle-oktoplus</span>
        </label>
      )}
      {erro && <p className="tt-msg erro" role="alert">{erro}</p>}
      {pv && !res && (
        <div className="eq-previa">
          <ul>
            <li><b>{pv.contas}</b> contas · <b>{pv.usos}</b> usos ({pv.abertos} em andamento) · <b>{pv.eventos}</b> registros</li>
            <li><b>{pv.ativas}</b> pessoas ativas{pv.pessoas > pv.ativas ? ` (+ ${pv.pessoas - pv.ativas} que saíram, só para o histórico)` : ""}</li>
            {pv.jaExistem.length > 0 && <li>Já estão aqui e só serão ligadas: {pv.jaExistem.join(", ")}</li>}
            {pv.novas.length > 0 && <li>Vão ganhar login e PIN novo: {pv.novas.join(", ")}</li>}
            <li>Arquivo gerado em {new Date(pv.exportadoEm).toLocaleString("pt-BR")}</li>
          </ul>
          {ja && <label className="tt-chk"><input type="checkbox" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} /> <span>Entendi: vai regravar as contas como estavam no arquivo.</span></label>}
          <button type="button" className="tt-btn ouro" onClick={rodar} disabled={!!passo || (!!ja && !confirmo)}>{passo || "Trazer os dados"}</button>
        </div>
      )}
      {res && (
        <div className="eq-resultado">
          <table className="eq-tabela">
            <thead><tr><th>Conferência</th><th className="n">No arquivo</th><th className="n">Gravado aqui</th><th /></tr></thead>
            <tbody>{res.conferencia.map((c) => (
              <tr key={c.item}><td>{c.item}</td><td className="n">{c.esperado}</td><td className="n">{c.achado}</td><td>{c.achado >= c.esperado ? "✓" : "faltou"}</td></tr>
            ))}</tbody>
          </table>
          <p className={`tt-msg ${tudoCerto ? "ok" : "erro"}`}>{tudoCerto ? "Tudo conferido: nada ficou para trás." : "Alguma coisa não bateu. Rode a importação de novo; ela não duplica nada."}</p>
          {res.avisos.map((a) => <p key={a} className="tt-nota">{a}</p>)}
          {res.pins.length > 0 && (
            <p className="tt-msg ok eq-pins-aviso">Os {res.pins.length} PINs novos estão no quadro <b>"PINs para entregar"</b>, no canto da tela. Ele fica aberto até você marcar que anotou.</p>
          )}
        </div>
      )}
    </section>
  );
}

/* ═════════════════ Página ═════════════════ */

export default function Equipe({ eu }: { eu: Eu }) {
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [nova, setNova] = useState(false);
  useEffect(() => onSnapshot(collection(db, "pessoas"), (s) => {
    setPessoas(s.docs.map((d) => docParaPessoa(d.id, d.data())).sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR")));
  }, () => setPessoas([])), []);
  const ativas = pessoas?.filter((p) => p.ativo).length ?? 0;
  return (
    <div className="tt-pag eq">
      <div className="tt-pag-topo">
        <div>
          <h1>Equipe e acessos</h1>
          <p>Quem entra no sistema, com qual PIN, e o que cada pessoa vê. A tela de entrada mostra só os nomes das pessoas ativas.</p>
        </div>
        <button type="button" className="tt-btn pri" onClick={() => setNova((v) => !v)}>{nova ? "Fechar" : "Adicionar pessoa"}</button>
      </div>
      {nova && <section className="tt-bloco"><h2>Nova pessoa</h2><NovaPessoa /></section>}
      <section className="tt-bloco">
        <h2>Pessoas <span className="eq-cont">{ativas} ativas</span></h2>
        {!pessoas ? <p className="tt-nota">Carregando…</p> : (
          <ul className="eq-lista">
            {pessoas.map((p) => (
              <li key={p.id} className={p.ativo ? "" : "inativa"}>
                <button type="button" className="eq-cab" aria-expanded={aberta === p.id} onClick={() => setAberta(aberta === p.id ? null : p.id)}>
                  <span className="eq-av" aria-hidden="true">{iniciais(p.nome)}</span>
                  <span className="eq-quem">
                    <b>{p.nome}{p.id === eu.pid ? <em> · você</em> : null}</b>
                    <span>{p.ativo ? resumoAcessos(p) : "Desativada"}{p.ativo && p.uid ? ` · PIN de ${p.pinDigitos} números` : ""}</span>
                  </span>
                  <span className="eq-editar">{aberta === p.id ? "Fechar" : "Editar"}</span>
                </button>
                {aberta === p.id && <EditarPessoa eu={eu} p={p} />}
              </li>
            ))}
          </ul>
        )}
      </section>
      <ImportarOktoplus eu={eu} />
    </div>
  );
}
