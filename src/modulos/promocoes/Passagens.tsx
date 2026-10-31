/* Aba Passagens: as promoções num painel de embarque. */
import { useMemo, useState } from "react";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/jetbrains-mono/latin-800.css";
import type { Eu } from "../../equipe/dados";
import { brData, hojeIso } from "../../lib/tempo";
import { bate, diaDe, ha, horaDe, preco, semAcento, situacao, useFeed, useRadar, type Promo, type Radar } from "./dados";
import { BotaoCopiar, Chips, Fontes, ICO, LinksFontes, Vazio, useAgora, useVisita } from "./comum";
import "./promocoes.css";

type Filtro = "todas" | "teresina" | "nacional" | "internacional" | "pacote" | "urgente";
const ROTULO_CAT: Record<string, string> = { nacional: "Voos nacionais", internacional: "Internacional", selecao: "Seleção do dia", pacote: "Pacote", noticia: "Notícia", geral: "Vários destinos" };

function destinoDe(p: Promo) {
  if (p.destinos.length) return p.destinos.slice(0, 3).join(" · ");
  return ROTULO_CAT[p.categoria] || "Promoção";
}
function origemDe(p: Promo) {
  if (p.origens.length) return `de ${p.origens.slice(0, 3).join(", ")}${p.origens.length > 3 ? "…" : ""}`;
  if (p.variasCidades) return "de várias cidades";
  return "";
}

/* ═════════════════ Cartão de embarque (destaques) ═════════════════ */

function Embarque({ p, rotulo, agora, novo }: { p: Promo; rotulo: string; agora: number; novo: boolean }) {
  const s = situacao(p);
  const para = p.iatas[0] || (p.internacional ? "INT" : "BR");
  const de = p.teresina && (p.origens.includes("Teresina") || !p.origens.length) ? "THE" : p.iatasOrigem[0] || "···";
  return (
    <a className={`pas-embarque${p.teresina ? " the" : ""}`} href={p.link} target="_blank" rel="noopener noreferrer">
      <div className="corpo">
        <span className="rotulo">{rotulo}{novo && <em className="novo">nova</em>}</span>
        <div className="rota">
          <span className="cod">{de}</span>
          <span className="linha" aria-hidden="true">{ICO.aviao}</span>
          <span className="cod">{para}</span>
        </div>
        <b className="dest">{destinoDe(p)}</b>
        <span className="det">{[origemDe(p), p.cias.join(", "), p.idaVolta].filter(Boolean).join(" · ") || "—"}</span>
        <span className="tit">{p.titulo}</span>
      </div>
      <div className="canhoto">
        <small>a partir de</small>
        <b>{p.preco ? preco(p.preco) : "—"}</b>
        {s && <span className={`situ${s.urgente ? " urgente" : ""}${s.encerrada ? " fim" : ""}`}>{s.rotulo}</span>}
        <small className="fonte">{p.fonte} · {ha(p.em, agora)}</small>
      </div>
    </a>
  );
}

function escolherDestaques(lista: Promo[], hoje: string) {
  const recentes = lista.filter((p) => Date.now() - p.em.getTime() < 3 * 864e5 && !situacao(p, hoje)?.encerrada && p.preco);
  const usados = new Set<string>();
  const pegar = (rot: string, l: Promo[]) => { const p = l.find((x) => !usados.has(x.id)); if (p) { usados.add(p.id); return { p, rot }; } return null; };
  const porPreco = (l: Promo[]) => [...l].sort((a, b) => (a.preco ?? 1e9) - (b.preco ?? 1e9));
  return [
    pegar("Saindo de Teresina", recentes.filter((p) => p.teresina)),
    pegar("Menor preço nacional", porPreco(recentes.filter((p) => p.categoria === "nacional"))),
    pegar("Menor preço internacional", porPreco(recentes.filter((p) => p.categoria === "internacional"))),
    pegar("Corra: acaba logo", recentes.filter((p) => situacao(p, hoje)?.urgente)),
  ].filter(Boolean) as { p: Promo; rot: string }[];
}

/* ═════════════════ Radar de preços ═════════════════ */

function Linha({ h }: { h: { d: string; p: number }[] }) {
  if (h.length < 2) return null;
  const ps = h.map((x) => x.p), min = Math.min(...ps), max = Math.max(...ps), w = 120, a = 30;
  const pts = h.map((x, i) => `${(i / (h.length - 1)) * w},${a - 3 - ((x.p - min) / (max - min || 1)) * (a - 6)}`).join(" ");
  return (
    <svg className="pas-linha" viewBox={`0 0 ${w} ${a}`} preserveAspectRatio="none" aria-label={`Preço nos últimos ${h.length} dias: de ${preco(min)} a ${preco(max)}`}>
      <polyline points={pts} />
      <circle cx={w} cy={pts.split(" ").pop()!.split(",")[1]} r="2.6" />
    </svg>
  );
}

function RadarTeresina({ radar, agora }: { radar: Radar; agora: number }) {
  const g = radar.google, a = radar.aviasales;
  const rotas = (g?.rotas || []).filter((r) => typeof r.preco === "number");
  if (!rotas.length && !a?.itens.length) return null;
  return (
    <section className="pas-radar" aria-label="Radar de preços saindo de Teresina">
      <header>
        <h2>Radar saindo de Teresina</h2>
        {g && <p>Google Voos · viagem de {brData(g.ida).slice(0, 5)} a {brData(g.volta).slice(0, 5)} (ida em 30 dias, 7 noites) · {ha(g.atualizadoEm, agora)}</p>}
      </header>
      {rotas.length > 0 && (
        <div className="pas-rotas">
          {rotas.map((r) => {
            const hist = r.historico || [];
            const minHist = hist.length ? Math.min(...hist.map((x) => x.p)) : null;
            return (
              <a key={r.id} className={`pas-rota nivel-${r.nivel || "?"}`} href={r.link} target="_blank" rel="noopener noreferrer">
                <span className="cods">THE {ICO.aviao} {r.para.split(",")[0]}</span>
                <b className="nome">{r.nome}</b>
                <b className="valor">{preco(r.preco!)}</b>
                <span className="nivel">{r.nivel === "baixo" ? "Preço baixo" : r.nivel === "alto" ? "Preço alto" : r.nivel === "normal" ? "Preço normal" : "Sem comparação"}</span>
                {r.faixa && <small className="faixa">normal {preco(r.faixa[0])}–{preco(r.faixa[1]).replace("R$ ", "").replace("R$ ", "")}</small>}
                <Linha h={hist} />
                <small>{[r.cia, r.paradas === 0 ? "direto" : r.paradas != null ? `${r.paradas} ${r.paradas === 1 ? "parada" : "paradas"}` : "", minHist != null && hist.length > 2 ? (r.preco! <= minHist ? "o menor do período" : `menor: ${preco(minHist)}`) : ""].filter(Boolean).join(" · ")}</small>
              </a>
            );
          })}
        </div>
      )}
      {!!a?.itens.length && (
        <div className="pas-avia">
          <h3>Mais baratos vistos saindo de Teresina <small>buscas recentes na Aviasales · confirme o preço</small></h3>
          <ol>
            {a.itens.slice(0, 10).map((x) => (
              <li key={x.destino}>
                <span className="cod">{x.destino}</span><b>{x.nome}</b>
                <span>{[x.ida ? `${brData(x.ida).slice(0, 5)}${x.volta ? `–${brData(x.volta).slice(0, 5)}` : ""}` : "", x.cia, x.paradas === 0 ? "direto" : `${x.paradas} parada${x.paradas > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}</span>
                <b className="valor">{preco(x.preco)}</b>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/* ═════════════════ Linha do painel ═════════════════ */

function LinhaPainel({ p, agora, novo }: { p: Promo; agora: number; novo: boolean }) {
  const [aberta, setAberta] = useState(false);
  const s = situacao(p);
  const estado = s ? s.rotulo : novo ? "Nova" : "No ar";
  return (
    <li className={`pas-voo${aberta ? " aberta" : ""}${s?.encerrada ? " fim" : ""}${p.teresina ? " the" : ""}`}>
      <button type="button" className="pas-voo-linha" aria-expanded={aberta} onClick={() => setAberta((v) => !v)}>
        <span className="hora">{horaDe(p.em)}</span>
        <span className="dest">
          <b>{destinoDe(p)}</b>
          <span className="tit">{p.titulo}</span>
          {(p.teresina || origemDe(p)) && <span className="orig">{p.teresina && <em>Teresina</em>}{origemDe(p) && !(p.teresina && p.origens.length === 1) ? origemDe(p) : ""}</span>}
        </span>
        <span className="cia">{p.cias.length ? p.cias.slice(0, 2).join(" · ") : "—"}</span>
        <span className="preco">{p.preco ? <><b>{preco(p.preco)}</b><small>{p.idaVolta || (p.categoria === "pacote" ? "pacote" : "a partir de")}</small></> : <small>sem preço</small>}</span>
        <span className={`estado${s?.urgente ? " urgente" : ""}${s?.encerrada ? " fim" : ""}${!s && novo ? " novo" : ""}`}>{estado}</span>
        <span className="fonte">{p.fonte}{p.outras.length > 0 && <em title={p.outras.map((o) => o.fonte).join(", ")}>+{p.outras.length}</em>}</span>
        <span className="abre" aria-hidden="true">{ICO.seta}</span>
      </button>
      {aberta && (
        <div className="pas-voo-detalhe">
          <p className="tit">{p.titulo}</p>
          {p.resumo && <p className="res">{p.resumo}</p>}
          <dl>
            {p.destinos.length > 0 && <div><dt>Destinos</dt><dd>{p.destinos.join(", ")}</dd></div>}
            {(p.origens.length > 0 || p.variasCidades) && <div><dt>Saindo de</dt><dd>{p.origens.length ? p.origens.join(", ") : "várias cidades"}</dd></div>}
            {p.cias.length > 0 && <div><dt>Companhia</dt><dd>{p.cias.join(", ")}</dd></div>}
            {p.preco != null && <div><dt>Preço</dt><dd>a partir de {preco(p.preco)}{p.idaVolta ? ` · ${p.idaVolta}` : ""}</dd></div>}
            {s && <div><dt>Prazo</dt><dd>{s.rotulo}</dd></div>}
            <div><dt>Publicada</dt><dd>{p.em.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" })} · {ha(p.em, agora)}</dd></div>
            <div className="largo"><dt>{p.outras.length ? `Em ${p.outras.length + 1} sites` : "Fonte"}</dt><dd><LinksFontes p={p} /></dd></div>
          </dl>
          <div className="acoes">
            <a className="pro-btn pri" href={p.link} target="_blank" rel="noopener noreferrer">{ICO.abrir}Abrir a promoção</a>
            <BotaoCopiar p={p} />
          </div>
        </div>
      )}
    </li>
  );
}

/* ═════════════════ Página ═════════════════ */

export default function Passagens({ eu }: { eu: Eu }) {
  const { feed, erro } = useFeed("passagens");
  const radar = useRadar();
  const agora = useAgora();
  const visita = useVisita("passagens");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<"recentes" | "preco">("recentes");
  const [encerradas, setEncerradas] = useState(false);
  const hoje = hojeIso();
  const itens = feed?.itens || [];

  const ativos = useMemo(() => itens.filter((p) => encerradas || !situacao(p, hoje)?.encerrada), [itens, encerradas, hoje]);
  const conta = (f: Filtro) => ativos.filter((p) => passa(p, f)).length;
  function passa(p: Promo, f: Filtro) {
    if (f === "teresina") return p.teresina;
    if (f === "nacional") return p.categoria === "nacional";
    if (f === "internacional") return p.categoria === "internacional";
    if (f === "pacote") return p.categoria === "pacote" || /pacote/i.test(p.titulo);
    if (f === "urgente") return !!situacao(p, hoje)?.urgente;
    return true;
  }
  const termo = semAcento(busca.trim());
  const visiveis = ativos.filter((p) => passa(p, filtro) && bate(p, termo));
  const ordenados = ordem === "preco" ? [...visiveis].sort((a, b) => (a.preco ?? 1e9) - (b.preco ?? 1e9)) : visiveis;
  const grupos = useMemo(() => {
    if (ordem === "preco") return [["Do menor para o maior preço", ordenados] as [string, Promo[]]];
    const m = new Map<string, Promo[]>();
    ordenados.forEach((p) => { const d = diaDe(p.em); m.set(d, [...(m.get(d) || []), p]); });
    return [...m.entries()];
  }, [ordenados, ordem]);
  const destaques = useMemo(() => escolherDestaques(itens, hoje), [itens, hoje]);
  const semana = itens.filter((p) => agora - p.em.getTime() < 7 * 864e5).length;
  const novas = itens.filter((p) => visita && p.visto.getTime() > visita).length;
  const menor = (cat: string) => { const l = ativos.filter((p) => p.categoria === cat && p.preco && agora - p.em.getTime() < 3 * 864e5); return l.length ? Math.min(...l.map((p) => p.preco!)) : null; };
  const mn = menor("nacional"), mi = menor("internacional");
  const okF = feed?.fontes.filter((f) => f.ok).length ?? 0;
  const relogio = new Date(agora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" });

  return (
    <div className="pro pas">
      <header className="pas-painel">
        <div className="pas-painel-cab">
          <span className="pas-etiqueta"><i aria-hidden="true" />Partidas · promoções</span>
          <span className="pas-relogio" aria-label={`Agora em Teresina: ${relogio}`}>{relogio}<small>Teresina</small></span>
        </div>
        <h1>Passagens em promoção</h1>
        <p className="pas-status">
          {!feed ? "Carregando o painel…" : feed.atualizadoEm
            ? <>Atualizado {ha(feed.atualizadoEm, agora)} · {okF} de {feed.fontes.length} fontes no ar · {semana} promoções em 7 dias{novas > 0 && <> · <b>{novas} {novas === 1 ? "nova" : "novas"} desde a sua última visita</b></>}</>
            : "O robô ainda não rodou."}
        </p>
        {itens.length > 0 && (
          <div className="pas-placas">
            <button type="button" onClick={() => setFiltro("teresina")} aria-pressed={filtro === "teresina"}><small>Falam de Teresina</small><b>{conta("teresina")}</b></button>
            <button type="button" onClick={() => setFiltro("urgente")} aria-pressed={filtro === "urgente"}><small>Acabam logo</small><b>{conta("urgente")}</b></button>
            <button type="button" onClick={() => { setFiltro("nacional"); setOrdem("preco"); }}><small>Menor nacional</small><b>{mn ? preco(mn) : "—"}</b></button>
            <button type="button" onClick={() => { setFiltro("internacional"); setOrdem("preco"); }}><small>Menor internacional</small><b>{mi ? preco(mi) : "—"}</b></button>
          </div>
        )}
      </header>

      {erro && <Vazio titulo={erro} />}
      {feed && !feed.atualizadoEm && !erro && (
        <Vazio titulo="Aguardando o robô de promoções">
          {eu.admin ? "Ele lê os sites de promoção a cada 2 horas. Para ligar, siga o passo a passo do LEIAME (parte “Robô de promoções”)." : "As promoções aparecem aqui assim que o robô rodar."}
        </Vazio>
      )}

      {destaques.length > 0 && (
        <section className="pas-destaques" aria-label="Destaques">
          {destaques.map(({ p, rot }) => <Embarque key={p.id} p={p} rotulo={rot} agora={agora} novo={!!visita && p.visto.getTime() > visita} />)}
        </section>
      )}

      {radar && <RadarTeresina radar={radar} agora={agora} />}

      {itens.length > 0 && (
        <>
          <div className="pro-barra">
            <Chips<Filtro> rotulo="Filtrar" valor={filtro} mudar={setFiltro} opcoes={[
              ["todas", "Todas", ativos.length], ["teresina", "Teresina", conta("teresina")], ["nacional", "Nacionais", conta("nacional")],
              ["internacional", "Internacionais", conta("internacional")], ["pacote", "Pacotes", conta("pacote")], ["urgente", "Acabam logo", conta("urgente")],
            ]} />
            <div className="pro-barra-dir">
              <label className="pro-busca"><span className="sr">Buscar</span>{ICO.busca}
                <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Destino, companhia, cidade…" />
              </label>
              <select value={ordem} onChange={(e) => setOrdem(e.target.value as "recentes" | "preco")} aria-label="Ordem">
                <option value="recentes">Mais recentes</option>
                <option value="preco">Menor preço</option>
              </select>
              <label className="pro-chave"><input type="checkbox" checked={encerradas} onChange={(e) => setEncerradas(e.target.checked)} />Mostrar as que já acabaram</label>
            </div>
          </div>

          <section className="pas-quadro" aria-label="Promoções">
            <div className="pas-quadro-cab" aria-hidden="true">
              <span>Hora</span><span>Destino</span><span>Companhia</span><span>Preço</span><span>Situação</span><span>Fonte</span><span />
            </div>
            {grupos.length === 0 && <div className="pas-quadro-vazio">Nenhuma promoção com esse filtro.</div>}
            {grupos.map(([dia, l]) => (
              <div key={dia} className="pas-dia">
                <h2>{dia}<span>{l.length}</span></h2>
                <ul>{l.map((p) => <LinhaPainel key={p.id} p={p} agora={agora} novo={!!visita && p.visto.getTime() > visita} />)}</ul>
              </div>
            ))}
          </section>
        </>
      )}

      {feed && <Fontes fontes={feed.fontes} agora={agora} />}
      <p className="pro-rodape">As promoções vêm de sites públicos e podem mudar a qualquer momento. Confirme tarifa e disponibilidade no sistema de emissão antes de oferecer ao cliente.</p>
    </div>
  );
}
