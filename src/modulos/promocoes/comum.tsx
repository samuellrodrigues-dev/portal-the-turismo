/* Peças comuns das abas Passagens e Milhas. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "../../shell/toast";
import { copiar, ha, horaDe, marcarVisita, textoWhats, ultimaVisita, type Promo, type StatusFonte, type TipoPromo } from "./dados";

/** Cor de cada programa de milhas/pontos, só como detalhe (cartões das ofertas e das milhas de clientes). */
export const COR: Record<string, string> = {
  Smiles: "#F2711C", "LATAM Pass": "#C8174A", "Azul Fidelidade": "#1F5FD6", Livelo: "#D81B7A", Esfera: "#D8312A",
  Átomos: "#444B55", "Inter Loop": "#FF7A00", Dotz: "#E4572E", "Km de Vantagens": "#0E7C66", Coopera: "#2E7D32", Curtaí: "#6A3FB5",
  "TAP Miles&Go": "#0F8A4F", AAdvantage: "#0A6FB8",
};

export const ICO = {
  abrir: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg>,
  copiar: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></svg>,
  busca: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  seta: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>,
  aviao: <svg viewBox="0 0 24 24" aria-hidden="true" className="cheio"><path d="M21.5 12c0-.8-.7-1.3-1.7-1.4l-5.1-.2L10 3.2H8.2l2.4 7.2-4.4-.2L4.4 7.8H3l1 4.2-1 4.2h1.4l1.8-2.4 4.4-.2-2.4 7.2H10l4.7-7.2 5.1-.2c1-.1 1.7-.6 1.7-1.4z" /></svg>,
};

/** Relógio que anda sozinho (para "há 5 min" e o relógio do painel). */
export function useAgora(passo = 30_000) {
  const [t, setT] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setT(Date.now()), passo); return () => clearInterval(i); }, [passo]);
  return t;
}

/** Guarda a última visita (para marcar o que é novo) e registra esta visita depois de um instante. */
export function useVisita(tipo: TipoPromo) {
  const antes = useRef(ultimaVisita(tipo));
  useEffect(() => { const t = setTimeout(() => marcarVisita(tipo), 1500); return () => { clearTimeout(t); marcarVisita(tipo); }; }, [tipo]);
  return antes.current;
}

export function BotaoCopiar({ p, classe = "" }: { p: Promo; classe?: string }) {
  return (
    <button type="button" className={`pro-btn ${classe}`} onClick={async (e) => { e.stopPropagation(); toast((await copiar(textoWhats(p))) ? "Texto copiado. Confira o preço no sistema antes de passar ao cliente." : "Não consegui copiar.", false); }}>
      {ICO.copiar}Copiar para o WhatsApp
    </button>
  );
}

export function Fontes({ fontes, agora }: { fontes: StatusFonte[]; agora: number }) {
  const ok = fontes.filter((f) => f.ok).length;
  if (!fontes.length) return null;
  return (
    <details className="pro-fontes">
      <summary>
        <span className={`pro-pulso${ok === fontes.length ? " todas" : ok ? "" : " nenhuma"}`} aria-hidden="true" />
        <b>Fontes</b><span>{ok} de {fontes.length} no ar</span>{ICO.seta}
      </summary>
      <ul>
        {fontes.map((f) => (
          <li key={f.id} className={f.ok ? "ok" : "ruim"}>
            <i aria-hidden="true" />
            <div>
              <b>{f.nome}</b>
              <small>{f.ok
                ? `${f.aceitos} ${f.aceitos === 1 ? "promoção" : "promoções"} nesta leitura · ${f.lidos} lidas${f.metodo === "descoberto" ? " · feed achado sozinho" : ""}`
                : `Sem resposta: ${f.erro || "erro"}${f.ultimoOk ? ` · funcionou ${ha(f.ultimoOk, agora)}` : ""}`}</small>
            </div>
          </li>
        ))}
      </ul>
      <p className="pro-nota">O robô lê as fontes a cada 2 horas. Uma fonte fora do ar volta sozinha quando o site responder.</p>
    </details>
  );
}

export function LinksFontes({ p }: { p: Promo }) {
  return (
    <span className="pro-links">
      <a href={p.link} target="_blank" rel="noopener noreferrer">{p.fonte}</a>
      {p.outras.map((o) => <a key={o.link} href={o.link} target="_blank" rel="noopener noreferrer">{o.fonte}</a>)}
    </span>
  );
}

export const quando = (p: Promo, agora: number) => `${ha(p.em, agora)} · ${horaDe(p.em)}`;

/** Grupo de botões "chip" com contagem. */
export function Chips<T extends string>({ opcoes, valor, mudar, rotulo }: { opcoes: [T, string, number][]; valor: T; mudar: (v: T) => void; rotulo: string }) {
  return (
    <div className="pro-chips" role="group" aria-label={rotulo}>
      {opcoes.map(([v, nome, n]) => (
        <button key={v} type="button" aria-pressed={valor === v} onClick={() => mudar(v)} disabled={!n && valor !== v}>
          {nome}<span>{n}</span>
        </button>
      ))}
    </div>
  );
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return <div className="pro-vazio"><b>{titulo}</b>{children && <span>{children}</span>}</div>;
}
