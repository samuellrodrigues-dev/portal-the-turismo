import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { nivel, type Eu, type ModuloId } from "../equipe/dados";
import { sair } from "../auth/sessao";
import { primeiroNome } from "../lib/formato";
import { useAlertasBoletos } from "../modulos/boletos/alertas";
import { useAlertasVip } from "../modulos/salavip/alertas";
import { useNovidades } from "../modulos/promocoes/dados";
import { FundoViagem } from "./FundoViagem";
import { definirAnimacao, useAnimacaoLigada } from "./animacao";
import { QuadroPins } from "../equipe/QuadroPins";
import { temPinsPendentes } from "../equipe/pinsPendentes";

const CARREGAR = {
  oktoplus: () => import("../modulos/oktoplus/Oktoplus"),
  salavip: () => import("../modulos/salavip/SalaVip"),
  boletos: () => import("../modulos/boletos/Boletos"),
  operacao: () => import("../modulos/operacao/Operacao"),
  passagens: () => import("../modulos/promocoes/Passagens"),
  milhas: () => import("../modulos/promocoes/Milhas"),
  equipe: () => import("../equipe/Equipe"),
  pin: () => import("../equipe/MeuPin"),
};
const Oktoplus = lazy(CARREGAR.oktoplus);
const SalaVip = lazy(CARREGAR.salavip);
const Boletos = lazy(CARREGAR.boletos);
const Operacao = lazy(CARREGAR.operacao);
const Passagens = lazy(CARREGAR.passagens);
const Milhas = lazy(CARREGAR.milhas);
const Equipe = lazy(CARREGAR.equipe);
const MeuPin = lazy(CARREGAR.pin);

const ICONES: Record<string, ReactNode> = {
  oktoplus: <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M8 9h8M8 13h5" /><circle cx="17" cy="15" r="1.2" /></svg>,
  salavip: <svg viewBox="0 0 24 24"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>,
  boletos: <svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v5M18 9.5v5" /></svg>,
  operacao: <svg viewBox="0 0 24 24"><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" /></svg>,
  passagens: <svg viewBox="0 0 24 24"><path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" /><path d="M14.5 6v12" strokeDasharray="1.6 2.2" /><path d="M6.5 12.2h5M8.6 10l2.9 2.2-2.9 2.2" /></svg>,
  milhas: <svg viewBox="0 0 24 24"><ellipse cx="9" cy="7" rx="6" ry="2.6" /><path d="M3 7v4c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6V7" /><path d="M3 11v4c0 1.4 2.7 2.6 6 2.6 1 0 2-.1 2.8-.3" /><circle cx="17" cy="16" r="4.2" /><path d="m15.5 16 1 1 2-2" /></svg>,
  equipe: <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>,
  pin: <svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>,
  aviao: <svg viewBox="0 0 24 24" className="cheio"><path d="M21.5 12c0-.8-.7-1.3-1.7-1.4l-5.1-.2L10 3.2H8.2l2.4 7.2-4.4-.2L4.4 7.8H3l1 4.2-1 4.2h1.4l1.8-2.4 4.4-.2-2.4 7.2H10l4.7-7.2 5.1-.2c1-.1 1.7-.6 1.7-1.4z" /></svg>,
  sair: <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg>,
};
type AbaId = ModuloId | "passagens" | "milhas";
const PROMO: AbaId[] = ["passagens", "milhas"];
const NOMES: Record<AbaId, string> = { oktoplus: "Oktoplus", salavip: "Sala VIP", boletos: "Valores a receber", passagens: "Passagens", milhas: "Milhas", operacao: "Operação" };
const ORDEM: AbaId[] = ["oktoplus", "salavip", "boletos", "passagens", "milhas", "operacao"];
const ULTIMA = "tt-ultima-aba";

function useHash() {
  const ler = () => location.hash.replace(/^#\/?/, "");
  const [h, setH] = useState(ler);
  useEffect(() => { const f = () => setH(ler()); window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  return h;
}

/**
 * A barra dourada embaixo da aba aberta. Ela desliza até a aba nova e,
 * enquanto anda, leva um aviãozinho na ponta.
 */
function useTrilho(nav: RefObject<HTMLElement | null>, atual: string, extra: string) {
  const [pos, setPos] = useState<{ x: number; w: number; sentido: 1 | -1; voando: boolean; pronto: boolean } | null>(null);
  const ultimo = useRef<{ x: number; w: number } | null>(null);
  const abaAntes = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = nav.current;
    if (!el) return;
    let t = 0;
    const trocou = abaAntes.current !== atual;
    abaAntes.current = atual;
    const medir = (mudouAba: boolean) => {
      const a = el.querySelector<HTMLElement>('.tt-aba[aria-current="page"]');
      if (!a) { setPos(null); ultimo.current = null; return; }
      const x = a.offsetLeft + 10, w = Math.max(12, a.offsetWidth - 20);
      const antes = ultimo.current;
      const andou = !!antes && mudouAba && Math.abs(antes.x - x) > 4;
      ultimo.current = { x, w };
      setPos((p) => ({ x, w, sentido: andou ? (x > antes!.x ? 1 : -1) : p?.sentido ?? 1, voando: andou || (!!p?.voando && !mudouAba), pronto: !!antes }));
      if (andou) { clearTimeout(t); t = window.setTimeout(() => setPos((p) => (p ? { ...p, voando: false } : p)), 720); }
      if (mudouAba) a.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: andou ? "smooth" : "auto" });
    };
    medir(trocou);
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => medir(false)) : null;
    ro?.observe(el);
    el.querySelectorAll(".tt-aba").forEach((a) => ro?.observe(a));
    return () => { ro?.disconnect(); };
  }, [atual, extra]);
  return pos;
}

export function Portal({ eu }: { eu: Eu }) {
  const hash = useHash();
  const [menu, setMenu] = useState(false);
  const [sairArmado, setSairArmado] = useState(false);
  const animacao = useAnimacaoLigada();
  const menuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  // Passagens e Milhas: promoções públicas, toda a equipe vê
  const abas = ORDEM.filter((m) => (PROMO.includes(m) ? eu.ativo !== false : nivel(eu, m as ModuloId)));
  const [base, ...resto] = hash.split("/");
  const permitidas = new Set<string>([...abas, "pin", ...(eu.admin ? ["equipe"] : [])]);
  let atual = permitidas.has(base) ? base : "";
  if (!atual) {
    let u: string | null = null;
    try { u = localStorage.getItem(ULTIMA); } catch { /* nada */ }
    atual = u && abas.includes(u as AbaId) ? u : abas[0] || "pin";
  }
  const sub = permitidas.has(base) ? resto.join("/") : "";

  useEffect(() => { if (abas.includes(atual as AbaId)) try { localStorage.setItem(ULTIMA, atual); } catch { /* nada */ } }, [atual]);
  useEffect(() => { if (hash !== atual && !hash.startsWith(atual + "/")) history.replaceState(null, "", "#/" + atual); }, [hash, atual]);
  useEffect(() => {
    if (!menu) return;
    const f = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("mousedown", f); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", f); document.removeEventListener("keydown", k); };
  }, [menu]);
  useEffect(() => { setMenu(false); }, [hash]);
  useEffect(() => { if (!menu) setSairArmado(false); }, [menu]);
  function clicarSair() {
    if (temPinsPendentes() && !sairArmado) { setSairArmado(true); return; }
    sair();
  }
  useEffect(() => { document.title = `${atual === "equipe" ? "Equipe" : atual === "pin" ? "Meu PIN" : NOMES[atual as AbaId] || "Sistemas"} · THE TURISMO`; }, [atual]);

  // com o navegador folgado, já baixa as outras abas: trocar de aba fica instantâneo
  useEffect(() => {
    const lista = [...abas, ...(eu.admin ? (["equipe"] as const) : [])];
    const ir = () => lista.forEach((m) => { CARREGAR[m]().catch(() => {}); });
    const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(ir, { timeout: 5000 }); else setTimeout(ir, 2500);
  }, []);

  const alertasBoletos = useAlertasBoletos(!!nivel(eu, "boletos"));
  const alertasVip = useAlertasVip(!!nivel(eu, "salavip"));
  const novidades = useNovidades(true);
  const selo: Partial<Record<AbaId, { n: number; titulo: string; ouro?: boolean }>> = {};
  for (const t of ["passagens", "milhas"] as const) if (novidades[t] && atual !== t) selo[t] = { n: novidades[t], titulo: `${novidades[t]} ${novidades[t] === 1 ? "promoção nova" : "promoções novas"} desde a sua última visita`, ouro: true };
  if (alertasBoletos.n) selo.boletos = { n: alertasBoletos.n, titulo: alertasBoletos.titulo };
  if (alertasVip.n) selo.salavip = { n: alertasVip.n, titulo: alertasVip.titulo, ouro: true };
  const trilho = useTrilho(navRef, atual, `${abas.join()}|${alertasBoletos.n}|${alertasVip.n}|${selo.passagens?.n || 0}|${selo.milhas?.n || 0}`);

  return (
    <div className="tt-app" data-modulo={atual}>
      <FundoViagem tema={atual === "boletos" ? "ceu" : "mapa"} aba={atual} />
      <header className="tt-barra">
        <a className="tt-marca" href={"#/" + (abas[0] || "pin")} aria-label="THE TURISMO, início">
          <img src="/logo-branco.png" alt="" width={34} height={31} />
          <span>THE TURISMO<small>Sistemas</small></span>
        </a>
        <nav className="tt-abas" aria-label="Sistemas" ref={navRef}>
          {abas.map((m) => (
            <a key={m} className="tt-aba" data-m={m} href={"#/" + m} aria-current={atual === m ? "page" : undefined}>
              {ICONES[m]}{NOMES[m]}
              {selo[m] && <span className={`selo${selo[m]!.ouro ? " ouro" : ""}`} title={selo[m]!.titulo}>{selo[m]!.n}</span>}
            </a>
          ))}
          {eu.admin && (
            <a className="tt-aba" data-m="equipe" href="#/equipe" aria-current={atual === "equipe" ? "page" : undefined}>{ICONES.equipe}Equipe</a>
          )}
          {trilho && (
            <span
              className={`tt-trilho${trilho.pronto ? " pronto" : ""}${trilho.voando ? " voando" : ""}${trilho.sentido < 0 ? " volta" : ""}`}
              style={{ transform: `translateX(${trilho.x}px)`, width: trilho.w }}
              aria-hidden="true"
            >
              <i><svg viewBox="0 0 24 24"><path d="M21.5 12c0-.8-.7-1.3-1.7-1.4l-5.1-.2L10 3.2H8.2l2.4 7.2-4.4-.2L4.4 7.8H3l1 4.2-1 4.2h1.4l1.8-2.4 4.4-.2-2.4 7.2H10l4.7-7.2 5.1-.2c1-.1 1.7-.6 1.7-1.4z" /></svg></i>
            </span>
          )}
        </nav>
        <div className="tt-eu" ref={menuRef}>
          <button type="button" className="tt-eu-btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            <span className="av" aria-hidden="true">{eu.nome.trim().charAt(0).toUpperCase()}</span>
            <span className="nome">{primeiroNome(eu.nome)}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {menu && (
            <div className="tt-menu" role="menu">
              <header><b>{eu.nome}</b><span>{eu.admin ? "Administrador" : "Equipe"}</span></header>
              <a href="#/pin" role="menuitem">{ICONES.pin}Trocar meu PIN</a>
              <button type="button" role="menuitemcheckbox" aria-checked={animacao} className="tt-menu-chave" onClick={() => definirAnimacao(!animacao)}>
                {ICONES.aviao}Aviões no fundo<span className={`tt-chave${animacao ? " on" : ""}`} aria-hidden="true"><i /></span>
              </button>
              {eu.admin && <a href="#/equipe" role="menuitem">{ICONES.equipe}Equipe e acessos</a>}
              <button type="button" role="menuitem" className={sairArmado ? "armado" : undefined} onClick={clicarSair}>
                {ICONES.sair}{sairArmado ? "Há PINs não anotados. Sair mesmo assim?" : "Sair"}
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="tt-conteudo">
        <Suspense fallback={<div className="tt-pag"><p className="tt-nota">Carregando…</p></div>}>
          {atual === "oktoplus" && <Oktoplus eu={eu} sub={sub} />}
          {atual === "salavip" && <SalaVip eu={eu} />}
          {atual === "boletos" && <Boletos eu={eu} sub={sub} />}
          {atual === "operacao" && <Operacao />}
          {atual === "passagens" && <Passagens eu={eu} />}
          {atual === "milhas" && <Milhas eu={eu} sub={sub} />}
          {atual === "equipe" && eu.admin && <Equipe eu={eu} />}
          {atual === "pin" && <MeuPin eu={eu} />}
          {!abas.length && atual === "pin" && null}
        </Suspense>
      </main>
      {eu.admin && <QuadroPins />}
    </div>
  );
}
