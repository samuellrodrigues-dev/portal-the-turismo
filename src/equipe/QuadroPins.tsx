import { useEffect, useRef, useState } from "react";
import { baixarTexto, csv, iniciais } from "../lib/formato";
import { sinal } from "../auth/sinal";
import { limparPins, temPinsPendentes, tirarPin, usePinsPendentes } from "./pinsPendentes";
import "./quadro-pins.css";

const ICONE_CHAVE = (
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 8.7-8.7M16 7l2.5 2.5M18.5 4.5 21 7" /></svg>
);

/**
 * Quadro fixo no canto da tela com os PINs que ainda não foram entregues.
 * Aparece em qualquer aba e só some quando o administrador marca que anotou.
 */
export function QuadroPins() {
  const itens = usePinsPendentes();
  const [aberto, setAberto] = useState(true);
  const [armado, setArmado] = useState(false);
  const [novos, setNovos] = useState<Set<string>>(new Set());
  const visto = useRef(new Map(itens.map((i) => [i.chave, i.em])));

  // chegou PIN novo: abre o quadro e destaca a linha por alguns segundos
  useEffect(() => {
    const chegaram = itens.filter((i) => visto.current.get(i.chave) !== i.em).map((i) => i.chave);
    visto.current = new Map(itens.map((i) => [i.chave, i.em]));
    if (!chegaram.length) return;
    setAberto(true);
    setNovos(new Set(chegaram));
    const t = setTimeout(() => setNovos(new Set()), 4500);
    return () => clearTimeout(t);
  }, [itens]);

  useEffect(() => { if (!armado) return; const t = setTimeout(() => setArmado(false), 4000); return () => clearTimeout(t); }, [armado]);

  // fechar ou recarregar a aba com PIN não anotado pede confirmação
  useEffect(() => {
    if (!itens.length) return;
    const f = (e: BeforeUnloadEvent) => {
      if (sinal.saindo || !temPinsPendentes()) return; // ao clicar em Sair a pergunta já foi feita no menu
      e.preventDefault(); e.returnValue = "";
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [itens.length]);

  if (!itens.length) return null;
  const n = itens.length;
  const titulo = n === 1 ? "1 PIN para entregar" : `${n} PINs para entregar`;

  function imprimir() {
    document.body.dataset.imprimir = "pins";
    const fim = () => { delete document.body.dataset.imprimir; window.removeEventListener("afterprint", fim); };
    window.addEventListener("afterprint", fim);
    window.print();
    setTimeout(fim, 1500);
  }
  function baixar() {
    baixarTexto("pins-equipe.csv", csv([["Nome", "PIN"], ...itens.map((i) => [i.nome, i.pin])]), "text/csv;charset=utf-8");
  }
  function todos() {
    if (!armado) { setArmado(true); return; }
    setArmado(false); limparPins();
  }

  if (!aberto) {
    return (
      <button type="button" className="qp-pilula" onClick={() => setAberto(true)} aria-label={`${titulo}. Abrir o quadro.`}>
        {ICONE_CHAVE}<span>{titulo}</span>
      </button>
    );
  }

  return (
    <aside className="qp" aria-label="PINs para entregar" aria-live="polite">
      <header className="qp-cab">
        <span className="qp-icone">{ICONE_CHAVE}</span>
        <div>
          <h2>{titulo}</h2>
          <p>Ficam aqui até você marcar que anotou, mesmo trocando de aba. O sistema não guarda PINs.</p>
        </div>
        <button type="button" className="qp-min" onClick={() => setAberto(false)} aria-label="Minimizar o quadro" title="Minimizar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </header>
      <ul className="qp-lista">
        {[...itens].reverse().map((i) => (
          <li key={i.chave} className={novos.has(i.chave) ? "novo" : ""}>
            <span className="qp-av" aria-hidden="true">{iniciais(i.nome)}</span>
            <span className="qp-nome">{i.nome}</span>
            <b className="qp-pin" aria-label={`PIN ${i.pin.split("").join(" ")}`}>{i.pin}</b>
            <button type="button" className="qp-anotei" onClick={() => tirarPin(i.chave)} title={`Já anotei o PIN de ${i.nome}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7" /></svg>
              Anotei
            </button>
          </li>
        ))}
      </ul>
      <footer className="qp-rodape">
        <button type="button" className="tt-btn" onClick={baixar}>Baixar lista</button>
        <button type="button" className="tt-btn" onClick={imprimir}>Imprimir</button>
        <button type="button" className={`tt-btn${armado ? " armado" : ""}`} onClick={todos}>{armado ? "Apagar todos do quadro?" : "Anotei todos"}</button>
      </footer>
    </aside>
  );
}
