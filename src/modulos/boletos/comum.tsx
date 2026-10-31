/* Peças que os boletos a pagar e os valores a receber usam juntos: ícones do tempo, céu, diálogo e previsão. */
import { useEffect, useRef, type ReactNode } from "react";
import { brl } from "../../lib/formato";
import type { Clima } from "./dados";

export const erroDe = (e: unknown) => (e as { code?: string })?.code === "permission-denied" ? "Seu acesso não permite essa ação." : (e as Error)?.message || "Algo deu errado.";

/** Sem acento e em minúsculas, para a busca. */
export const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const NUVEM = "M7.5 19a4.5 4.5 0 0 1-.7-8.95 6 6 0 0 1 11.5-1.6A4.6 4.6 0 0 1 18 19z";
export function IconeClima({ c, tam = 44 }: { c: Clima; tam?: number }) {
  return (
    <svg className={`bol-ic ic-${c}`} width={tam} height={tam} viewBox="0 0 32 32" aria-hidden="true">
      {(c === "sol" || c === "aberto") && (
        <g className="sol" transform={c === "aberto" ? "translate(-4 -4) scale(.82)" : undefined}>
          <circle cx="16" cy="16" r="6.2" />
          {Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <line key={i} x1={16 + Math.cos(a) * 9.2} y1={16 + Math.sin(a) * 9.2} x2={16 + Math.cos(a) * 12.4} y2={16 + Math.sin(a) * 12.4} />; })}
        </g>
      )}
      {c !== "sol" && <path className="nuvem" d={NUVEM} transform={c === "aberto" ? "translate(8 8) scale(.92)" : "translate(4 2) scale(1.02)"} />}
      {(c === "chuva" || c === "tempestade") && (
        <g className="gotas">{[10, 15, 20].map((x, i) => <line key={x} x1={x} y1={23 + (i % 2)} x2={x - 1.6} y2={27.5 + (i % 2)} />)}</g>
      )}
      {c === "tempestade" && <path className="raio" d="M17.5 17.5 13.8 23h3.4l-2 5.5 5.6-7.2h-3.5l2-3.8z" />}
    </svg>
  );
}

export const CEU: Record<Clima, string> = { tempestade: "Tempestade", chuva: "Chuva", nublado: "Nublado", aberto: "Céu aberto", sol: "Sol" };

export function Ceu() {
  return (
    <div className="bol-ceu" aria-hidden="true">
      <svg className="n1" viewBox="0 0 200 80"><path d="M30 70a24 24 0 0 1 4-47.6A34 34 0 0 1 98 14a28 28 0 0 1 48 10 22 22 0 0 1 24 46z" /></svg>
      <svg className="n2" viewBox="0 0 200 80"><path d="M30 70a24 24 0 0 1 4-47.6A34 34 0 0 1 98 14a28 28 0 0 1 48 10 22 22 0 0 1 24 46z" /></svg>
      <svg className="n3" viewBox="0 0 200 80"><path d="M30 70a24 24 0 0 1 4-47.6A34 34 0 0 1 98 14a28 28 0 0 1 48 10 22 22 0 0 1 24 46z" /></svg>
      <span className="estrelas" />
    </div>
  );
}

export function Dialogo({ aberto, aoFechar, titulo, sub, children, rodape, classe = "" }: { aberto: boolean; aoFechar: () => void; titulo: string; sub?: string; children: ReactNode; rodape: ReactNode; classe?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (aberto && !d.open) d.showModal(); if (!aberto && d.open) d.close(); }, [aberto]);
  return (
    <dialog ref={ref} className={`bol-dlg ${classe}`.trim()} onClose={aoFechar} onCancel={aoFechar}>
      <div className="bol-dlg-caixa">
        <header><div><h2>{titulo}</h2>{sub && <p>{sub}</p>}</div><button type="button" className="bol-icone" onClick={aoFechar} aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg></button></header>
        <div className="bol-dlg-corpo">{children}</div>
        <footer>{rodape}</footer>
      </div>
    </dialog>
  );
}

/** Os quatro cartões do resumo: [tempo, título, quantos, soma, texto quando não há nada]. */
export type CartaoPrevisao = [Clima, string, number | null, number, string];
export function Previsao({ cartoes, rotulo }: { cartoes: CartaoPrevisao[]; rotulo: string }) {
  return (
    <section className="bol-previsao" aria-label={rotulo}>
      {cartoes.map(([c, t, n, soma, vazio]) => (
        <div key={c} className={`prev clima-${c}${n && c !== "sol" ? " ativo" : ""}`}>
          <IconeClima c={c} tam={52} />
          <div>
            <span className="prev-t">{t}</span>
            <b>{n ?? "…"}</b>
            <span className="prev-v">{n ? brl(soma) : vazio}</span>
          </div>
        </div>
      ))}
    </section>
  );
}

/** Setas de mês: ‹ Outubro de 2026 › */
export function SeletorMes({ titulo, antes, depois, podeDepois, resumo }: { titulo: string; antes: () => void; depois: () => void; podeDepois: boolean; resumo?: ReactNode }) {
  return (
    <div className="bol-mes">
      <button type="button" className="bol-icone" onClick={antes} aria-label="Mês anterior"><svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6" /></svg></button>
      <h2>{titulo}</h2>
      <button type="button" className="bol-icone" onClick={depois} disabled={!podeDepois} aria-label="Próximo mês"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg></button>
      {resumo && <span>{resumo}</span>}
    </div>
  );
}

/** Menu "⋯" que fecha ao clicar fora. */
export function useFecharFora(aberto: boolean, fechar: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const f = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) fechar(); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    document.addEventListener("mousedown", f); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", f); document.removeEventListener("keydown", k); };
  }, [aberto]);
  return ref;
}
