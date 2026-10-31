/* Aba Milhas: bônus de transferência, passagens com milhas, compra de milhas e o resto, em cartões de fidelidade. */
import { useMemo, useState } from "react";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/jetbrains-mono/latin-800.css";
import type { Eu } from "../../equipe/dados";
import { brl } from "../../lib/formato";
import { hojeIso } from "../../lib/tempo";
import { bate, ha, milhasTxt, semAcento, situacao, useFeed, type Promo } from "./dados";
import { BotaoCopiar, Chips, Fontes, ICO, LinksFontes, Vazio, useAgora, useVisita } from "./comum";
import "./promocoes.css";

type Cat = "tudo" | "bonus" | "resgate" | "compra" | "clube" | "outras";
const SECOES: [Exclude<Cat, "tudo">, string, string, string][] = [
  ["bonus", "Bônus de transferência", "Bônus", "Mande pontos do cartão para o programa da companhia e ganhe mais milhas."],
  ["resgate", "Passagens com milhas", "Passagens", "Trechos com poucas milhas."],
  ["compra", "Compra de milhas e milheiro", "Compra", "Comprar milhas ou pontos com desconto."],
  ["clube", "Clubes e cartões", "Clubes e cartões", "Assinaturas e cartões que dão pontos."],
  ["outras", "Outras novidades", "Outras", "O que mais saiu sobre os programas."],
];
const catDe = (p: Promo): Exclude<Cat, "tudo"> => (p.categoria === "bonus" || p.categoria === "resgate" || p.categoria === "compra" ? p.categoria : p.categoria === "clube" || p.categoria === "cartao" ? "clube" : "outras");

// cor de cada programa (só um detalhe na borda do cartão)
const COR: Record<string, string> = {
  Smiles: "#F2711C", "LATAM Pass": "#C8174A", "Azul Fidelidade": "#1F5FD6", Livelo: "#D81B7A", Esfera: "#D8312A",
  "TAP Miles&Go": "#1E9E5A", AAdvantage: "#3A6EA5", "Flying Blue": "#1B3E8F", Avios: "#7B1E3A", Átomos: "#444",
  "Inter Loop": "#FF7A00", Aeroplan: "#D52B1E", LifeMiles: "#C8102E", "Miles&Smiles": "#C70A0C", "ALL Accor": "#1E2A5A",
};
const PONTOS = ["Livelo", "Esfera", "Átomos", "Inter Loop", "Dotz", "Km de Vantagens", "Coopera", "Curtaí"];

function rotaPontos(p: Promo) {
  const de = [...p.programas.filter((x) => PONTOS.includes(x)), ...p.bancos];
  const para = p.programas.filter((x) => !PONTOS.includes(x));
  if (de.length && para.length) return `${de.slice(0, 2).join(", ")} → ${para.slice(0, 2).join(", ")}`;
  return [...para, ...de].slice(0, 3).join(" · ");
}
function numeroDe(p: Promo): { valor: string; legenda: string } | null {
  const c = catDe(p);
  if (c === "bonus" && p.bonus) return { valor: `${p.bonus}%`, legenda: "de bônus" };
  if (c === "compra" && p.milheiro) return { valor: brl(p.milheiro), legenda: "o milheiro" };
  if (c === "compra" && p.desconto) return { valor: `${p.desconto}%`, legenda: "de desconto" };
  if (p.milhas) return { valor: milhasTxt(p.milhas), legenda: `${p.milhas === 1 ? "milha" : "milhas"}${p.idaVolta === "trecho" ? " o trecho" : p.idaVolta === "ida e volta" ? " ida e volta" : ""}` };
  if (p.bonus) return { valor: `${p.bonus}%`, legenda: "de bônus" };
  if (p.desconto) return { valor: `${p.desconto}%`, legenda: "de desconto" };
  if (p.milheiro) return { valor: brl(p.milheiro), legenda: "o milheiro" };
  return null;
}

function Cartao({ p, agora, novo }: { p: Promo; agora: number; novo: boolean }) {
  const s = situacao(p);
  const n = numeroDe(p);
  const cor = COR[p.programas.find((x) => !PONTOS.includes(x)) || p.programas[0]] || "#8A877F";
  const rota = rotaPontos(p);
  return (
    <article className={`mil-cartao${s?.encerrada ? " fim" : ""}`} style={{ ["--cor" as string]: cor }}>
      <header>
        <div className="progs">{(p.programas.length ? p.programas : ["Milhas"]).slice(0, 3).map((x) => <span key={x} style={{ ["--c" as string]: COR[x] || "#8A877F" }}>{x}</span>)}</div>
        {novo && <em className="novo">nova</em>}
      </header>
      {n && <div className="num"><b>{n.valor}</b><span>{n.legenda}</span></div>}
      {rota.includes("→") && <p className="rota">{rota}</p>}
      <h3><a href={p.link} target="_blank" rel="noopener noreferrer">{p.titulo}</a></h3>
      {p.destinos.length > 0 && <p className="dest">{ICO.aviao}{p.destinos.slice(0, 4).join(", ")}</p>}
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

/** Os recordes da semana: maior bônus, menor milheiro, menos milhas, maior desconto. */
function Recordes({ itens, agora, ir }: { itens: Promo[]; agora: number; ir: (c: Cat) => void }) {
  const hoje = hojeIso();
  const vivos = itens.filter((p) => agora - p.em.getTime() < 7 * 864e5 && !situacao(p, hoje)?.encerrada);
  const max = (l: Promo[], f: (p: Promo) => number | null) => l.filter((p) => f(p) != null).sort((a, b) => f(b)! - f(a)!)[0];
  const min = (l: Promo[], f: (p: Promo) => number | null) => l.filter((p) => f(p) != null).sort((a, b) => f(a)! - f(b)!)[0];
  const bonus = max(vivos.filter((p) => catDe(p) === "bonus"), (p) => p.bonus);
  const milheiro = min(vivos, (p) => p.milheiro);
  const resgate = min(vivos.filter((p) => catDe(p) === "resgate"), (p) => p.milhas);
  const desconto = max(vivos.filter((p) => catDe(p) === "compra"), (p) => p.desconto);
  const cards = [
    bonus && { c: "bonus" as Cat, r: "Maior bônus agora", v: `${bonus.bonus}%`, d: rotaPontos(bonus) || bonus.titulo, p: bonus },
    milheiro && { c: "compra" as Cat, r: "Milheiro mais barato", v: brl(milheiro.milheiro!), d: rotaPontos(milheiro) || milheiro.titulo, p: milheiro },
    resgate && { c: "resgate" as Cat, r: "Passagem com menos milhas", v: `${milhasTxt(resgate.milhas!)}`, d: `${resgate.programas.slice(0, 2).join(", ") || "milhas"}${resgate.idaVolta === "trecho" ? " · o trecho" : ""}`, p: resgate },
    desconto && { c: "compra" as Cat, r: "Maior desconto na compra", v: `${desconto.desconto}%`, d: desconto.programas.slice(0, 2).join(", ") || desconto.titulo, p: desconto },
  ].filter(Boolean) as { c: Cat; r: string; v: string; d: string; p: Promo }[];
  if (!cards.length) return null;
  return (
    <section className="mil-recordes" aria-label="Recordes dos últimos 7 dias">
      {cards.map((x) => {
        const s = situacao(x.p);
        return (
          <button key={x.r} type="button" className="mil-recorde" style={{ ["--cor" as string]: COR[x.p.programas.find((y) => !PONTOS.includes(y)) || x.p.programas[0]] || "#8A877F" }} onClick={() => ir(x.c)}>
            <small>{x.r}</small>
            <b>{x.v}</b>
            <span>{x.d}</span>
            <em>{s ? s.rotulo : ha(x.p.em, agora)}</em>
          </button>
        );
      })}
    </section>
  );
}

export default function Milhas({ eu }: { eu: Eu }) {
  const { feed, erro } = useFeed("milhas");
  const agora = useAgora();
  const visita = useVisita("milhas");
  const [cat, setCat] = useState<Cat>("tudo");
  const [prog, setProg] = useState("");
  const [busca, setBusca] = useState("");
  const [encerradas, setEncerradas] = useState(false);
  const hoje = hojeIso();
  const itens = feed?.itens || [];
  const ativos = useMemo(() => itens.filter((p) => encerradas || !situacao(p, hoje)?.encerrada), [itens, encerradas, hoje]);
  const programas = useMemo(() => {
    const m = new Map<string, number>();
    ativos.forEach((p) => p.programas.forEach((x) => m.set(x, (m.get(x) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [ativos]);
  const termo = semAcento(busca.trim());
  const filtrados = ativos.filter((p) => (!prog || p.programas.includes(prog)) && bate(p, termo));
  const porCat = (c: Exclude<Cat, "tudo">) => filtrados.filter((p) => catDe(p) === c);
  const ordenar = (c: Exclude<Cat, "tudo">, l: Promo[]) => {
    // dentro de cada seção: o que vale hoje primeiro, depois o mais recente
    const peso = (p: Promo) => (situacao(p, hoje)?.urgente ? 1 : 0);
    return [...l].sort((a, b) => peso(b) - peso(a) || b.em.getTime() - a.em.getTime() || (c === "bonus" ? (b.bonus || 0) - (a.bonus || 0) : 0));
  };
  const novas = itens.filter((p) => visita && p.visto.getTime() > visita).length;
  const okF = feed?.fontes.filter((f) => f.ok).length ?? 0;
  const secoes = SECOES.filter(([c]) => cat === "tudo" || cat === c);

  return (
    <div className="pro mil">
      <header className="mil-topo">
        <div>
          <span className="mil-etiqueta">Programas de fidelidade</span>
          <h1>Milhas e pontos</h1>
          <p>
            {!feed ? "Carregando…" : feed.atualizadoEm
              ? <>Atualizado {ha(feed.atualizadoEm, agora)} · {okF} de {feed.fontes.length} fontes no ar · {itens.length} promoções em 21 dias{novas > 0 && <> · <b>{novas} {novas === 1 ? "nova" : "novas"} desde a sua última visita</b></>}</>
              : "O robô ainda não rodou."}
          </p>
        </div>
        <div className="mil-pilha" aria-hidden="true"><i /><i /><i /></div>
      </header>

      {erro && <Vazio titulo={erro} />}
      {feed && !feed.atualizadoEm && !erro && (
        <Vazio titulo="Aguardando o robô de promoções">
          {eu.admin ? "Ele lê os blogs de milhas a cada 2 horas. Para ligar, siga o passo a passo do LEIAME (parte “Robô de promoções”)." : "As promoções aparecem aqui assim que o robô rodar."}
        </Vazio>
      )}

      <Recordes itens={itens} agora={agora} ir={(c) => { setCat(c); setProg(""); document.querySelector(".mil-secoes")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />

      {itens.length > 0 && (
        <>
          <div className="pro-barra">
            <Chips<Cat> rotulo="Tipo" valor={cat} mudar={setCat} opcoes={[["tudo", "Tudo", filtrados.length], ...SECOES.map(([c, , curto]) => [c, curto, porCat(c).length] as [Cat, string, number])]} />
            <div className="pro-barra-dir">
              <label className="pro-busca"><span className="sr">Buscar</span>{ICO.busca}
                <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Programa, banco, destino…" />
              </label>
              <label className="pro-chave"><input type="checkbox" checked={encerradas} onChange={(e) => setEncerradas(e.target.checked)} />Mostrar as que já acabaram</label>
            </div>
          </div>
          {programas.length > 1 && (
            <div className="mil-progs" role="group" aria-label="Programa">
              <button type="button" aria-pressed={!prog} onClick={() => setProg("")}>Todos os programas</button>
              {programas.map(([x, n]) => (
                <button key={x} type="button" aria-pressed={prog === x} onClick={() => setProg(prog === x ? "" : x)} style={{ ["--c" as string]: COR[x] || "#8A877F" }}><i />{x}<span>{n}</span></button>
              ))}
            </div>
          )}
          <div className="mil-secoes">
            {secoes.map(([c, nome, , explica]) => {
              const l = ordenar(c, porCat(c));
              if (!l.length) return cat === c ? <Vazio key={c} titulo={`Nada em “${nome}” com esse filtro.`} /> : null;
              return (
                <section key={c} className={`mil-secao s-${c}`}>
                  <header><h2>{nome}<span>{l.length}</span></h2><p>{explica}</p></header>
                  <div className="mil-grade">{l.map((p) => <Cartao key={p.id} p={p} agora={agora} novo={!!visita && p.visto.getTime() > visita} />)}</div>
                </section>
              );
            })}
            {!filtrados.length && <Vazio titulo="Nenhuma promoção com esse filtro." />}
          </div>
        </>
      )}

      {feed && <Fontes fontes={feed.fontes} agora={agora} />}
      <p className="pro-rodape">Regras, prazos e bônus mudam conforme o cartão e a categoria do cliente no programa. Confira no site do programa antes de transferir ou comprar.</p>
    </div>
  );
}
