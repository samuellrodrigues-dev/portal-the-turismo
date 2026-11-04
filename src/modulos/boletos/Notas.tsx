/* ═══════════════════════════════════════════════════════════════
   Anotações: um texto livre da equipe dentro de Valores a receber,
   para o que ainda não tem valor ou data (ex.: milhas a verificar).
   Um documento só, "anotacoes/receber". Salva sozinho enquanto a pessoa digita.
   Quem vê e quem edita é o mesmo nível da aba (abas.boletos), garantido nas regras.
   ═══════════════════════════════════════════════════════════════ */
import { doc, onSnapshot, serverTimestamp, setDoc, type Timestamp } from "firebase/firestore";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { db } from "../../firebase";
import type { Eu } from "../../equipe/dados";
import { erroDe } from "./comum";

export const MAX_NOTAS = 20000;
const ref = () => doc(db, "anotacoes", "receber");
type Remoto = { texto: string; por: string; pid: string; em: Date | null };

const hora = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", " às");

export function SecaoNotas({ eu, pode, nav }: { eu: Eu; pode: boolean; nav: ReactNode }) {
  const [remoto, setRemoto] = useState<Remoto | null>(null);
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<"" | "digitando" | "salvando" | "salvo" | "erro">("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const versao = useRef(0);      // sobe a cada tecla
  const salva = useRef(0);       // a última versão que foi para o banco
  const textoRef = useRef("");
  textoRef.current = texto;
  const sujo = () => versao.current !== salva.current;

  useEffect(() => onSnapshot(ref(), (s) => {
    const x = s.data();
    const r: Remoto = { texto: typeof x?.texto === "string" ? x.texto : "", por: x?.atualizadoPor?.nome || "", pid: x?.atualizadoPor?.pid || "", em: (x?.atualizadoEm as Timestamp | undefined)?.toDate?.() || null };
    setRemoto(r);
    setErro("");
    if (!sujo()) { setTexto(r.texto); setAviso(""); }
    else if (r.pid && r.pid !== eu.pid && r.texto !== textoRef.current) setAviso(`${r.por} também mudou as anotações agora. Ao salvar, fica o que está na sua tela.`);
  }, (e) => { setRemoto({ texto: "", por: "", pid: "", em: null }); setErro(e.code === "permission-denied" ? "Seu acesso não permite ver as anotações." : "Não consegui carregar as anotações."); }), [eu.pid]);

  async function salvar() {
    if (!pode || !sujo()) return;
    const v = versao.current, t = textoRef.current.slice(0, MAX_NOTAS);
    setEstado("salvando");
    try {
      await setDoc(ref(), { texto: t, atualizadoPor: { pid: eu.pid, nome: eu.nome }, atualizadoEm: serverTimestamp() });
      salva.current = Math.max(salva.current, v);
      setEstado(sujo() ? "digitando" : "salvo");
      if (!sujo()) setAviso("");
    } catch (e) { setEstado("erro"); setErro(erroDe(e)); }
  }

  // salva 1 segundo depois da última tecla
  useEffect(() => {
    if (estado !== "digitando") return;
    const t = setTimeout(salvar, 1000);
    return () => clearTimeout(t);
  }, [texto, estado]);
  // não deixa sair com coisa por salvar
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => { if (sujo()) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", f);
    return () => { window.removeEventListener("beforeunload", f); if (sujo()) void salvar(); };
  }, []);

  const situacao = estado === "salvando" ? "Salvando…"
    : estado === "digitando" ? "Digitando…"
    : estado === "erro" ? `Não salvou: ${erro}`
    : remoto?.em ? `Salvo · última mudança por ${remoto.por || "alguém"} em ${hora(remoto.em)}`
    : remoto ? (pode ? "Nada anotado ainda." : "Nada anotado ainda.") : "Carregando…";

  return (
    <>
      {nav}
      <header className="bol-topo">
        <div>
          <h1>Anotações</h1>
          <p>Lembretes da equipe sobre o que ainda não tem valor ou data, como milhas a verificar.{pode ? " Salva sozinho." : ""}</p>
        </div>
      </header>
      {erro && !remoto?.em && estado !== "erro" ? <div className="bol-vazio"><b>{erro}</b></div> : (
        <section className="nuvem notas">
          <textarea
            aria-label="Anotações"
            value={texto}
            readOnly={!pode}
            maxLength={MAX_NOTAS}
            spellCheck
            placeholder={pode ? "Ex.: 40K conta Paula – a verificar\n80K LATAM – conta Mauro" : "Nada anotado ainda."}
            onChange={(e) => { versao.current++; setTexto(e.target.value); setEstado("digitando"); }}
            onBlur={() => { void salvar(); }}
          />
          <footer>
            <span className={`notas-estado e-${estado || "ok"}`} role="status">{situacao}</span>
            <span className="notas-conta">{texto.length.toLocaleString("pt-BR")} / {MAX_NOTAS.toLocaleString("pt-BR")}</span>
          </footer>
          {aviso && <p className="bol-nota notas-aviso">{aviso}</p>}
        </section>
      )}
    </>
  );
}
