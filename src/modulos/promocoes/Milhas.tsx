/* Aba Milhas: ofertas para COMPRAR milhas e pontos nos programas brasileiros, em cartões de fidelidade,
   e (para quem tem o acesso "Milhas de clientes") as milhas que a agência recebeu de clientes. */
import { useMemo, useState, type ReactNode } from "react";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/jetbrains-mono/latin-800.css";
import { nivel, type Eu } from "../../equipe/dados";
import { brl } from "../../lib/formato";
import { hojeIso } from "../../lib/tempo";
import { bate, ha, semAcento, situacao, useFeed, type Promo } from "./dados";
import { BotaoCopiar, COR, Fontes, ICO, LinksFontes, Vazio, useAgora, useVisita } from "./comum";
import { SecaoClientes } from "./MilhasClientes";
import "./promocoes.css";

const PONTOS = ["Livelo", "Esfera", "Átomos", "Inter Loop", "Dotz", "Km de Vantagens", "Coopera", "Curtaí"];
const corDe = (p: Promo) => COR[p.programas.find((x) => !PONTOS.includes(x)) || p.programas[0]] || "#8A877F";
/** Só compra de milhas/pontos (o robô já filtra; isto cobre o que ficou de leituras antigas). */
const serve = (p: Promo) => p.categoria === "compra" && (p.milheiro != null || p.desconto != null || /compr|vend|milheiro/i.test(p.titulo));

function rotaPontos(p: Promo) {
  const de = [...p.programas.filter((x) => PONTOS.includes(x)), ...p.bancos];
  const para = p.programas.filter((x) => !PONTOS.includes(x));
  return de.length && para.length ? `${de.slice(0, 2).join(", ")} → ${para.slice(0, 2).join(", ")}` : "";
}
function numeroDe(p: Promo): { valor: string; legenda: string } | null {
  if (p.milheiro) return { valor: brl(p.milheiro), legenda: "o milheiro" };
  if (p.desconto) return { valor: `${p.desconto}%`, legenda: "de desconto na compra" };
  return null;
}

function Cartao({ p, agora, novo }: { p: Promo; agora: number; novo: boolean }) {
  const s = situacao(p);
  const n = numeroDe(p);
  const rota = rotaPontos(p);
  const extra = p.milheiro && p.desconto ? `e ${p.desconto}% de desconto` : "";
  return (
    <article className={`mil-cartao${s?.encerrada ? " fim" : ""}`} style={{ ["--cor" as string]: corDe(p) }}>
      <header>
        <div className="progs">{(p.programas.length ? p.programas : ["Milhas"]).slice(0, 3).map((x) => <span key={x} style={{ ["--c" as string]: COR[x] || "#8A877F" }}>{x}</span>)}</div>
        {novo && <em className="novo">nova</em>}
      </header>
      {n && <div className="num"><b>{n.valor}</b><span>{n.legenda}{extra ? ` ${extra}` : ""}</span></div>}
      {rota && <p className="rota">{rota}</p>}
      <h3><a href={p.link} target="_blank" rel="noopener noreferrer">{p.titulo}</a></h3>
      <footer>
        {s && <span className={`situ${s.urgente ? " urgente" : ""}${s.encerrada ? " fim" : ""}`}>{s.rotulo}</span>}
        <span className="quando">{ha(p.em, agora)}</span>
        <LinksFontes p={p} />
      </footer>
      <div className="acoes">
        <a className="pro-btn" href={p.link} target="_blank" rel="noopener noreferrer">{ICO.abrir}Abrir</a>
        <BotaoCopiar p={p} />
      </div>
    </article>
  );
}

/** Os recordes: milheiro mais barato, maior desconto na compra e quantas ofertas estão valendo. */
function Recordes({ ativos, agora }: { ativos: Promo[]; agora: number }) {
  const hoje = hojeIso();
  const vivos = ativos.filter((p) => agora - p.em.getTime() < 7 * 864e5 && !situacao(p, hoje)?.encerrada);
  const milheiro = vivos.filter((p) => p.milheiro != null).sort((a, b) => a.milheiro! - b.milheiro!)[0];
  const desconto = vivos.filter((p) => p.desconto != null).sort((a, b) => b.desconto! - a.desconto!)[0];
  const progs = [...new Set(vivos.flatMap((p) => p.programas))];
  const cards = [
    milheiro && { r: "Milheiro mais barato", v: brl(milheiro.milheiro!), d: rotaPontos(milheiro) || milheiro.programas.join(", ") || milheiro.titulo, p: milheiro, cor: corDe(milheiro) },
    desconto && { r: "Maior desconto na compra", v: `${desconto.desconto}%`, d: desconto.programas.slice(0, 2).join(", ") || desconto.titulo, p: desconto, cor: corDe(desconto) },
    vivos.length > 0 && { r: "Ofertas valendo agora", v: String(vivos.length), d: progs.slice(0, 4).join(" · ") || "programas brasileiros", p: null, cor: "#2A2F38" },
  ].filter(Boolean) as { r: string; v: string; d: string; p: Promo | null; cor: string }[];
  if (!cards.length) return null;
  return (
    <section className="mil-recordes" aria-label="Recordes dos últimos 7 dias">
      {cards.map((x) => {
        const s = x.p ? situacao(x.p) : null;
        const corpo = (
          <>
            <small>{x.r}</small>
            <b>{x.v}</b>
            <span>{x.d}</span>
            <em>{x.p ? (s ? s.rotulo : ha(x.p.em, agora)) : "últimos 7 dias"}</em>
          </>
        );
        return x.p
          ? <a key={x.r} className="mil-recorde" href={x.p.link} target="_blank" rel="noopener noreferrer" style={{ ["--cor" as string]: x.cor }}>{corpo}</a>
          : <div key={x.r} className="mil-recorde" style={{ ["--cor" as string]: x.cor }}>{corpo}</div>;
      })}
    </section>
  );
}

function Ofertas({ eu, nav }: { eu: Eu; nav: ReactNode }) {
  const { feed, erro } = useFeed("milhas");
  const agora = useAgora();
  const visita = useVisita("milhas");
  const [prog, setProg] = useState("");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<"recentes" | "milheiro" | "desconto">("recentes");
  const [encerradas, setEncerradas] = useState(false);
  const hoje = hojeIso();
  const itens = useMemo(() => (feed?.itens || []).filter(serve), [feed]);
  const ativos = useMemo(() => itens.filter((p) => encerradas || !situacao(p, hoje)?.encerrada), [itens, encerradas, hoje]);
  const programas = useMemo(() => {
    const m = new Map<string, number>();
    ativos.forEach((p) => p.programas.forEach((x) => m.set(x, (m.get(x) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [ativos]);
  const termo = semAcento(busca.trim());
  const filtrados = ativos.filter((p) => (!prog || p.programas.includes(prog)) && bate(p, termo));
  const urg = (p: Promo) => (situacao(p, hoje)?.urgente ? 1 : 0);
  const lista = [...filtrados].sort((a, b) =>
    ordem === "milheiro" ? (a.milheiro ?? 1e9) - (b.milheiro ?? 1e9) || b.em.getTime() - a.em.getTime()
      : ordem === "desconto" ? (b.desconto ?? -1) - (a.desconto ?? -1) || b.em.getTime() - a.em.getTime()
        : urg(b) - urg(a) || b.em.getTime() - a.em.getTime());
  const novas = itens.filter((p) => visita && p.visto.getTime() > visita).length;
  const okF = feed?.fontes.filter((f) => f.ok).length ?? 0;

  return (
    <div className="pro mil">
      {nav}
      <header className="mil-topo">
        <div>
          <span className="mil-etiqueta">Programas brasileiros</span>
          <h1>Compra de milhas</h1>
          <p>
            {!feed ? "Carregando…" : feed.atualizadoEm
              ? <>Atualizado {ha(feed.atualizadoEm, agora)} · {okF} de {feed.fontes.length} fontes no ar · {itens.length} ofertas em 21 dias{novas > 0 && <> · <b>{novas} {novas === 1 ? "nova" : "novas"} desde a sua última visita</b></>}</>
              : "O robô ainda não rodou."}
          </p>
        </div>
        <div className="mil-pilha" aria-hidden="true"><i /><i /><i /></div>
      </header>

      {erro && <Vazio titulo={erro} />}
      {feed && !feed.atualizadoEm && !erro && (
        <Vazio titulo="Aguardando o robô de promoções">
          {eu.admin ? "Ele lê os blogs de milhas a cada 2 horas. Para ligar, siga o passo a passo do LEIAME (parte “Robô de promoções”)." : "As ofertas aparecem aqui assim que o robô rodar."}
        </Vazio>
      )}
      {feed?.atualizadoEm && !itens.length && !erro && <Vazio titulo="Nenhuma oferta de compra de milhas nos últimos 21 dias." />}

      <Recordes ativos={ativos} agora={agora} />

      {itens.length > 0 && (
        <>
          <div className="pro-barra">
            {programas.length > 0 ? (
              <div className="mil-progs" role="group" aria-label="Programa">
                <button type="button" aria-pressed={!prog} onClick={() => setProg("")}>Todos<span>{ativos.length}</span></button>
                {programas.map(([x, n]) => (
                  <button key={x} type="button" aria-pressed={prog === x} onClick={() => setProg(prog === x ? "" : x)} style={{ ["--c" as string]: COR[x] || "#8A877F" }}><i />{x}<span>{n}</span></button>
                ))}
              </div>
            ) : <span />}
            <div className="pro-barra-dir">
              <label className="pro-busca"><span className="sr">Buscar</span>{ICO.busca}
                <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Programa, banco…" />
              </label>
              <select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)} aria-label="Ordem">
                <option value="recentes">Mais recentes</option>
                <option value="milheiro">Menor milheiro</option>
                <option value="desconto">Maior desconto</option>
              </select>
              <label className="pro-chave"><input type="checkbox" checked={encerradas} onChange={(e) => setEncerradas(e.target.checked)} />Mostrar as que já acabaram</label>
            </div>
          </div>
          {lista.length
            ? <div className="mil-grade">{lista.map((p) => <Cartao key={p.id} p={p} agora={agora} novo={!!visita && p.visto.getTime() > visita} />)}</div>
            : <Vazio titulo="Nenhuma oferta com esse filtro." />}
        </>
      )}

      {feed && <Fontes fontes={feed.fontes} agora={agora} />}
      <p className="pro-rodape">Preço do milheiro e desconto mudam conforme o clube, o cartão e a categoria do cliente no programa. Confira no site do programa antes de comprar.</p>
    </div>
  );
}

const ICO_SECAO = {
  ofertas: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>,
  clientes: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20v-1a5.5 5.5 0 0 1 9.6-3.7" /><ellipse cx="17.5" cy="14" rx="4" ry="1.8" /><path d="M13.5 14v3.2c0 1 1.8 1.8 4 1.8s4-.8 4-1.8V14" /></svg>,
};

/** #/milhas → ofertas de compra · #/milhas/clientes → milhas recebidas de clientes (só com o acesso "Milhas de clientes"). */
export default function Milhas({ eu, sub = "" }: { eu: Eu; sub?: string }) {
  const verClientes = !!nivel(eu, "milhas");
  const secao = verClientes && sub.split("/")[0] === "clientes" ? "clientes" : "ofertas";
  const nav = verClientes ? (
    <nav className="mil-nav" aria-label="Partes da aba Milhas">
      <a href="#/milhas" aria-current={secao === "ofertas" ? "page" : undefined}>{ICO_SECAO.ofertas}Ofertas de compra</a>
      <a href="#/milhas/clientes" aria-current={secao === "clientes" ? "page" : undefined}>{ICO_SECAO.clientes}Recebidas de clientes</a>
    </nav>
  ) : null;
  return secao === "clientes" ? <SecaoClientes eu={eu} nav={nav} /> : <Ofertas eu={eu} nav={nav} />;
}
