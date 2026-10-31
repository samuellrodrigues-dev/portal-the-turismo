import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import {
  configurarInicial, emailDe, pinFraco, senhaDe, traduzirErroAuth, type PessoaPublica,
} from "../equipe/dados";
import { sinal } from "./sinal";
import { FundoViagem } from "../shell/FundoViagem";
import "./entrar.css";

const CHAVE = "tt-ultimo-nome";
const lerUltimo = () => { try { return localStorage.getItem(CHAVE); } catch { return null; } };
const gravarUltimo = (id: string) => { try { localStorage.setItem(CHAVE, id); } catch { /* sem armazenamento: tudo bem */ } };

const AMBAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** Título que se acerta letra por letra, como um painel de partidas de aeroporto. */
function Letreiro({ texto }: { texto: string }) {
  const parado = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [tique, setTique] = useState(parado ? 999 : 0);
  const fim = useMemo(() => texto.split("").map((_, i) => 5 + i * 2), [texto]);
  const total = Math.max(...fim);
  useEffect(() => {
    if (parado) return;
    const id = window.setInterval(() => setTique((t) => { if (t >= total) { clearInterval(id); return t; } return t + 1; }), 52);
    return () => clearInterval(id);
  }, [parado, total]);
  return (
    <span className="tt-letreiro">
      <span className="sr">{texto}</span>
      {texto.split("").map((c, i) => {
        const certo = c === " " || tique >= fim[i];
        let mostra = c;
        if (!certo) {
          const r = AMBAS[(i * 7 + tique * 5) % AMBAS.length];
          mostra = c === c.toLowerCase() ? r.toLowerCase() : r;
        }
        return (
          <span key={i} className={`flap${certo ? "" : " gira"}`} aria-hidden="true">
            <b>{c}</b><i>{mostra}</i>
          </span>
        );
      })}
    </span>
  );
}

function Moldura({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <main className="tt-entrada">
      <FundoViagem tema="entrada" />
      <div className="tt-entrada-fundo" aria-hidden="true">
        <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <path className="rota" d="M-40 640 C 220 520, 360 700, 600 520 S 1000 260, 1260 300" />
          <path className="rota r2" d="M-40 220 C 260 300, 420 120, 700 200 S 1080 520, 1260 440" />
        </svg>
      </div>
      <section className="tt-entrada-caixa">
        <header className="tt-entrada-marca">
          <img src="/logo-branco.png" alt="THE TURISMO" width={66} height={60} />
          <div>
            <h1><Letreiro texto="Sistemas" /></h1>
            <p>{sub || "Oktoplus, Sala VIP, Valores a receber, promoções e Operação"}</p>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}

export function Aviso({ titulo, texto, botao, acao }: { titulo: string; texto: string; botao: string; acao: () => void }) {
  return (
    <Moldura>
      <div className="tt-entrada-corpo">
        <h2 className="tt-entrada-tit">{titulo}</h2>
        <p className="tt-entrada-txt">{texto}</p>
        <button type="button" className="tt-btn-ouro" onClick={acao}>{botao}</button>
      </div>
    </Moldura>
  );
}

/* ═════════════════ Teclado de PIN ═════════════════ */

function TecladoPin({ digitos, valor, onChange, onEnviar, ocupado, erro }: {
  digitos: number; valor: string; onChange: (v: string) => void; onEnviar: (v: string) => void; ocupado: boolean; erro: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [treme, setTreme] = useState(0);
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => { if (erro) { setTreme((t) => t + 1); ref.current?.focus(); } }, [erro]);
  const por = (v: string) => {
    const s = v.replace(/\D/g, "").slice(0, 8);
    onChange(s);
    if (s.length === digitos && !ocupado) onEnviar(s);
  };
  const tecla = (k: string) => { if (ocupado) return; if (k === "<") por(valor.slice(0, -1)); else por(valor + k); ref.current?.focus(); };
  return (
    <div className="tt-pin">
      <label className="tt-pin-campo" key={treme} data-treme={treme > 0 || undefined}>
        <span className="sr">PIN de {digitos} números</span>
        <input
          ref={ref} type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="current-password"
          value={valor} maxLength={8} disabled={ocupado}
          onChange={(e) => por(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && valor.length >= 4) onEnviar(valor); }}
        />
        <span className="tt-pin-pontos" aria-hidden="true">
          {Array.from({ length: Math.max(digitos, valor.length) }, (_, i) => <i key={i} className={i < valor.length ? "on" : ""} />)}
        </span>
      </label>
      <div className="tt-teclado" aria-hidden="true">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "<"].map((k, i) =>
          k === "" ? <span key={i} /> : (
            <button key={i} type="button" tabIndex={-1} onClick={() => tecla(k)} disabled={ocupado} className={k === "<" ? "apagar" : ""}>
              {k === "<" ? <svg viewBox="0 0 24 24"><path d="M21 5H9l-6 7 6 7h12z" /><path d="m17 9-6 6M11 9l6 6" /></svg> : k}
            </button>
          ))}
      </div>
    </div>
  );
}

/* ═════════════════ Entrar ═════════════════ */

export function Entrar({ pessoas }: { pessoas: PessoaPublica[] }) {
  const [sel, setSel] = useState<PessoaPublica | null>(null);
  const [busca, setBusca] = useState("");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const u = lerUltimo();
    const p = pessoas.find((x) => x.id === u);
    if (p) setSel(p);
  }, [pessoas]);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return t ? pessoas.filter((p) => p.nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(t)) : pessoas;
  }, [pessoas, busca]);

  async function enviar(v: string) {
    if (!sel || ocupado) return;
    setOcupado(true); setErro("");
    try {
      gravarUltimo(sel.id);
      await signInWithEmailAndPassword(auth, emailDe(sel.login), senhaDe(v));
    } catch (e) {
      setErro(traduzirErroAuth(e));
      setPin("");
      setOcupado(false);
    }
  }

  if (!sel) {
    return (
      <Moldura>
        <div className="tt-entrada-corpo">
          <h2 className="tt-entrada-tit">Quem é você?</h2>
          {pessoas.length > 10 && (
            <input className="tt-entrada-busca" type="search" placeholder="Buscar seu nome" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus aria-label="Buscar seu nome" />
          )}
          <div className="tt-nomes">
            {lista.map((p) => (
              <button key={p.id} type="button" className="tt-nome" onClick={() => { setSel(p); setErro(""); setPin(""); }}>
                <span className="av" aria-hidden="true">{p.nome.trim().charAt(0).toUpperCase()}</span>
                <span>{p.nome}</span>
              </button>
            ))}
            {!lista.length && <p className="tt-entrada-txt">Ninguém com esse nome.</p>}
          </div>
        </div>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <div className="tt-entrada-corpo">
        <div className="tt-quem">
          <span className="av" aria-hidden="true">{sel.nome.trim().charAt(0).toUpperCase()}</span>
          <div>
            <small>Entrando como</small>
            <b>{sel.nome}</b>
          </div>
          <button type="button" className="tt-link-claro" onClick={() => { setSel(null); setPin(""); setErro(""); }}>Não é você?</button>
        </div>
        <h2 className="tt-entrada-tit">Digite seu PIN</h2>
        <TecladoPin digitos={sel.d || 4} valor={pin} onChange={(v) => { setPin(v); if (erro) setErro(""); }} onEnviar={enviar} ocupado={ocupado} erro={erro} />
        <p className="tt-entrada-msg" role="alert">{ocupado ? "Entrando…" : erro}</p>
        <p className="tt-entrada-dica">Esqueceu o PIN? Peça um novo ao administrador.</p>
      </div>
    </Moldura>
  );
}

/* ═════════════════ Primeiro acesso ═════════════════ */

export function PrimeiroAcesso() {
  const [nome, setNome] = useState("");
  const [pin, setPin] = useState("");
  const [conf, setConf] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    const n = nome.replace(/\s+/g, " ").trim();
    if (n.length < 2) return setErro("Digite seu nome.");
    if (!/^\d{6,8}$/.test(pin)) return setErro("O PIN do administrador precisa ter de 6 a 8 números.");
    if (pinFraco(pin)) return setErro("Escolha um PIN menos óbvio (sem números repetidos ou em sequência).");
    if (pin !== conf) return setErro("Os dois PINs não são iguais.");
    setOcupado(true); setErro("");
    sinal.configurando = true;
    try {
      await configurarInicial(n.slice(0, 40), pin);
    } catch (x) {
      sinal.configurando = false;
      setErro(traduzirErroAuth(x));
      setOcupado(false);
    }
  }

  return (
    <Moldura sub="Primeiro acesso">
      <form className="tt-entrada-corpo" onSubmit={criar} noValidate>
        <h2 className="tt-entrada-tit">Configurar o sistema</h2>
        <p className="tt-entrada-txt">Ainda não tem ninguém cadastrado. Quem configurar agora vira o <b>administrador</b> e depois cadastra a equipe e os acessos.</p>
        <label className="tt-campo-escuro"><span>Seu nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} autoComplete="name" autoFocus />
        </label>
        <div className="tt-dois">
          <label className="tt-campo-escuro"><span>PIN (6 a 8 números)</span>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} type="password" inputMode="numeric" maxLength={8} autoComplete="new-password" className="pin" />
          </label>
          <label className="tt-campo-escuro"><span>Repita o PIN</span>
            <input value={conf} onChange={(e) => setConf(e.target.value.replace(/\D/g, ""))} type="password" inputMode="numeric" maxLength={8} autoComplete="new-password" className="pin" />
          </label>
        </div>
        <button className="tt-btn-ouro" type="submit" disabled={ocupado}>{ocupado ? "Configurando…" : "Criar administrador e entrar"}</button>
        <p className="tt-entrada-msg" role="alert">{erro}</p>
      </form>
    </Moldura>
  );
}
