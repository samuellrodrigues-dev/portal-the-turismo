/* ═══════════════════════════════════════════════════════════════
   Fundo animado: aviões cruzando a tela em rotas curvas, com o rastro
   pontilhado dourado (ou a trilha branca no céu dos Boletos) e a
   etiqueta do voo, como num radar de voos: "THE → LIS".

   Desenhado num <canvas> só, a ~30 quadros por segundo, com resolução
   limitada e apagando só o pedaço onde o avião passou, para pesar pouco.
   No primeiro minuto de cada aba os aviões passam com frequência; depois,
   só um por vez, com 35 a 70 s de céu parado entre eles, para o computador
   descansar (a tela só é redesenhada enquanto há avião no ar). Se o computador não der conta (quadros
   atrasando), passa sozinho para o modo leve (1 avião, sem etiqueta) e,
   se ainda assim pesar, para. Não lança voo com a aba escondida, para
   quando não há avião no ar, descansa quando ninguém mexe no computador
   há 90 segundos e respeita "reduzir movimento" e a opção
   "Animações" do menu.
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useRef, useState } from "react";
import { useAnimacaoLigada } from "./animacao";
import { EMULADOR } from "../firebase";
import "./fundo.css";

export type TemaFundo = "entrada" | "mapa" | "ceu";

const DESTINOS = [
  "GRU", "GIG", "BSB", "SSA", "REC", "FOR", "MCZ", "NAT", "JPA", "SLZ", "BEL", "FLN", "POA", "CNF", "IGU", "FEN", "BPS",
  "LIS", "OPO", "MAD", "CDG", "FCO", "MCO", "MIA", "EZE", "SCL", "CUN", "PUJ",
];
const CASA = "THE";
const sorteio = (a: number, b: number) => a + Math.random() * (b - a);
const limitar = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* avião visto de cima, nariz para a direita, numa caixa de 48 × 48 */
const temCanvas = typeof window !== "undefined" && typeof Path2D !== "undefined" && !!document.createElement("canvas").getContext;
const CORPO = temCanvas ? new Path2D(
  "M44.5 24c0-1.5-1.3-2.3-3.2-2.5L10.4 21.6C8.2 21.6 6 22.6 5 24c1 1.4 3.2 2.4 5.4 2.4l30.9-.1c1.9-.2 3.2-1 3.2-2.3z" +
  "M30.5 21.7 17.2 3.6h-3.6l6.9 18.1zM30.5 26.3 17.2 44.4h-3.6l6.9-18.1zM11.6 21.7 6.3 13.8H4l2.6 7.9zM11.6 26.3l-5.3 7.9H4l2.6-7.9z",
) : null;
const MOTORES = temCanvas ? new Path2D("M23 12.6h3.6a1.4 1.4 0 0 1 0 2.8H23a1.4 1.4 0 0 1 0-2.8zM23 32.6h3.6a1.4 1.4 0 0 1 0 2.8H23a1.4 1.4 0 0 1 0-2.8z") : null;

type Voo = {
  t0: number; v: number; escala: number; rotulo: string;
  xs: Float32Array; ys: Float32Array; cum: Float32Array; L: number; // a rota em pedacinhos de ~5 px
  px: Float32Array; py: Float32Array; passo: number; // pontos do rastro, fixos ao longo da rota
  D: number; // comprimento do rastro atrás do avião
  tw?: number; twFonte?: boolean; // largura da etiqueta já medida
};
type Cores = {
  aviao: string; aviaoOp: number; sombra: string; rastro: string; rastroOp: number; largura: number; linha: boolean;
  rotulo: string; rotuloFundo: string; rotuloBorda: string; luzes: boolean;
};

function novaRota(w: number, h: number) {
  const ida = Math.random() < 0.5; // da esquerda para a direita
  const m = 110;
  const y0 = h * sorteio(0.1, 0.9);
  const y1 = limitar(y0 + h * sorteio(-0.42, 0.42), h * 0.06, h * 0.94);
  const x0 = ida ? -m : w + m, x1 = ida ? w + m : -m, dx = x1 - x0;
  const pts = [x0, y0, x0 + dx * 0.3, y0 + h * sorteio(-0.26, 0.26), x0 + dx * 0.7, y1 + h * sorteio(-0.26, 0.26), x1, y1];
  const outro = DESTINOS[Math.floor(Math.random() * DESTINOS.length)];
  const [de, para] = Math.random() < 0.72 ? [CASA, outro] : [outro, CASA];
  return { pts, rotulo: ida ? `${de} → ${para}` : `${para} ← ${de}` }; // a seta aponta para onde o avião vai
}

function criarVoo(pts: number[], rotulo: string, escala: number, velocidade: number, inicio: number, linha: boolean): Voo {
  const [x0, y0, ax, ay, bx, by, x1, y1] = pts;
  const n = Math.max(60, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 5));
  const xs = new Float32Array(n + 1), ys = new Float32Array(n + 1), cum = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    xs[i] = u * u * u * x0 + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * x1;
    ys[i] = u * u * u * y0 + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * y1;
    if (i) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  }
  const L = cum[n];
  const voo: Voo = { t0: 0, v: velocidade / 1000, escala, rotulo, xs, ys, cum, L, px: new Float32Array(0), py: new Float32Array(0), passo: linha ? 6 : 9, D: 580 * escala };
  const k = Math.floor(L / voo.passo) + 1;
  voo.px = new Float32Array(k); voo.py = new Float32Array(k);
  const p = { x: 0, y: 0, a: 0 };
  for (let i = 0; i < k; i++) { emPonto(voo, i * voo.passo, p); voo.px[i] = p.x; voo.py[i] = p.y; }
  voo.t0 = performance.now() - inicio * (L / voo.v); // o primeiro voo já começa no meio do caminho
  return voo;
}

function emPonto(voo: Voo, s: number, saida: { x: number; y: number; a: number }) {
  const c = voo.cum;
  let lo = 0, hi = c.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] < s) lo = m; else hi = m; }
  const f = limitar((s - c[lo]) / (c[hi] - c[lo] || 1), 0, 1);
  saida.x = voo.xs[lo] + (voo.xs[hi] - voo.xs[lo]) * f;
  saida.y = voo.ys[lo] + (voo.ys[hi] - voo.ys[lo]) * f;
  saida.a = Math.atan2(voo.ys[hi] - voo.ys[lo], voo.xs[hi] - voo.xs[lo]);
}

function lerCores(el: HTMLElement): Cores {
  const cs = getComputedStyle(el);
  const v = (n: string, padrao: string) => cs.getPropertyValue(n).trim() || padrao;
  return {
    aviao: v("--aviao", "#2A3038"), aviaoOp: parseFloat(v("--aviao-op", ".58")), sombra: v("--sombra-aviao", "none"),
    rastro: v("--rastro", "#D29E00"), rastroOp: parseFloat(v("--rastro-op", ".9")), largura: parseFloat(v("--rastro-largura", "2.3")),
    linha: v("--rastro-estilo", "pontos") === "linha",
    rotulo: v("--rotulo", "#7D7B74"), rotuloFundo: v("--rotulo-fundo", "rgba(255,255,255,.62)"), rotuloBorda: v("--rotulo-borda", "rgba(0,0,0,.07)"),
    luzes: parseFloat(v("--luzes", "0")) > 0,
  };
}

/** O motor: guarda os voos no ar e desenha tudo no canvas. */
class Motor {
  ctx: CanvasRenderingContext2D;
  w = 0; h = 0; dpr = 1;
  voos: Voo[] = [];
  cores: Cores;
  raf = 0; ultimo = 0;
  livreDesde = performance.now(); // desde quando não há avião no ar
  leve = false; parado = false;
  intervalos: number[] = [];
  private sujo: number[] = []; // retângulos desenhados no quadro anterior (x, y, w, h…): só eles são apagados
  private p = { x: 0, y: 0, a: 0 };
  private fonteAtual = 0;
  fontesProntas = false;
  /** Troca a fonte do canvas só quando muda o tamanho (trocar a fonte a cada quadro custa caro). */
  private fonte(px: number) {
    if (this.fonteAtual === px) return;
    this.fonteAtual = px;
    const c = this.ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    c.font = `700 ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    if ("letterSpacing" in c) c.letterSpacing = `${(px * 0.14).toFixed(1)}px`;
  }
  private escuro = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
  private aoMudarTema = () => { this.cores = lerCores(this.el); };

  constructor(private cv: HTMLCanvasElement, private el: HTMLElement) {
    this.ctx = cv.getContext("2d")!;
    this.cores = lerCores(el);
    document.fonts?.ready.then(() => { this.fontesProntas = true; this.fonteAtual = 0; }).catch(() => {});
    // a página está ocupada (tarefas longas seguidas): os aviões dão espaço
    try {
      const longas: number[] = [];
      this.obs = new PerformanceObserver((l) => {
        const agora = performance.now();
        for (const e of l.getEntries()) if (e.duration >= 120) longas.push(agora);
        while (longas.length && agora - longas[0] > 30_000) longas.shift();
        if (longas.length >= 4) this.aliviar();
      });
      this.obs.observe({ type: "longtask" });
    } catch { /* navegador sem esse recurso (Safari): fica só a medição dos quadros */ }
    this.escuro?.addEventListener?.("change", this.aoMudarTema);
    this.medir();
  }
  private obs: PerformanceObserver | null = null;
  destruir() { cancelAnimationFrame(this.raf); this.raf = 0; this.voos = []; this.escuro?.removeEventListener?.("change", this.aoMudarTema); this.obs?.disconnect(); }
  recarregarCores() { this.cores = lerCores(this.el); }

  medir() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.leve ? 1 : 1.25);
    const w = innerWidth, h = innerHeight;
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w; this.h = h; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr); // isso já limpa o canvas
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.sujo = [];
    this.fonteAtual = 0; // mudar o tamanho do canvas zera a fonte dele
    if (!this.raf && this.voos.length) this.desenhar(performance.now());
  }
  maximo(tema: TemaFundo) { return this.parado ? 0 : this.leve || this.w < 640 ? 1 : tema === "entrada" ? 3 : 2; }
  lancar(v: Voo) { this.voos.push(v); if (!this.raf) { this.ultimo = 0; this.raf = requestAnimationFrame(this.quadro); } }

  private quadro = (agora: number) => {
    this.raf = 0;
    if (!this.voos.length) { this.ctx.clearRect(0, 0, this.w, this.h); this.sujo = []; this.livreDesde = agora; return; }
    this.raf = requestAnimationFrame(this.quadro);
    const passo = this.leve ? 48 : 30; // ~30 quadros por segundo (~20 no modo leve)
    if (this.ultimo && agora - this.ultimo < passo - 3) return;
    if (this.ultimo) this.avaliar(agora - this.ultimo);
    this.ultimo = agora;
    this.desenhar(agora);
  };

  /** Quadros chegando muito atrasados = computador apertado: alivia, e se não bastar, para. */
  private avaliar(dt: number) {
    if (dt > 1000 || document.hidden) return; // voltou de outra aba: não conta
    const a = this.intervalos; a.push(dt);
    if (a.length < 40) return;
    const med = [...a].sort((x, y) => x - y)[a.length >> 1];
    a.length = 0;
    if (!this.leve && med > 45) this.aliviar();
    else if (this.leve && med > 70) { this.parado = true; this.voos = []; }
  }
  /** Modo leve: 1 avião, sem etiqueta, resolução normal, ~20 quadros por segundo. */
  aliviar() { if (this.leve) return; this.leve = true; this.voos = this.voos.slice(0, 1); this.medir(); }

  private aviao(x: number, y: number, ang: number, k: number, cor: string, alfa: number) {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(k, k); c.translate(-24, -24);
    c.globalAlpha = alfa; c.fillStyle = cor; c.fill(CORPO!);
    c.globalAlpha = alfa * 0.7; c.fill(MOTORES!);
    c.restore();
  }

  desenhar(agora: number) {
    const c = this.ctx, k = this.cores, p = this.p;
    const sujo = this.sujo;
    for (let i = 0; i < sujo.length; i += 4) c.clearRect(sujo[i], sujo[i + 1], sujo[i + 2], sujo[i + 3]);
    sujo.length = 0;
    let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
    const marcar = (x: number, y: number, m: number) => { if (x - m < x0) x0 = x - m; if (y - m < y0) y0 = y - m; if (x + m > x1) x1 = x + m; if (y + m > y1) y1 = y + m; };
    const comRotulo = !this.leve && this.w >= 560;
    this.voos = this.voos.filter((v) => (agora - v.t0) * v.v <= v.L + v.D);
    for (const v of this.voos) {
      const s = (agora - v.t0) * v.v;
      x0 = y0 = Infinity; x1 = y1 = -Infinity;
      // rastro: some aos poucos atrás do avião
      const ini = Math.max(0, s - v.D), fim = Math.min(s, v.L);
      c.fillStyle = k.rastro; c.strokeStyle = k.rastro;
      if (k.linha) {
        c.lineWidth = k.largura * v.escala; c.lineCap = "round"; c.lineJoin = "round";
        const a0 = Math.ceil(ini / v.passo), a1 = Math.floor(fim / v.passo);
        for (let i = a0; i < a1; i += 6) {
          const j = Math.min(a1, i + 6), d = s - ((i + j) / 2) * v.passo;
          c.globalAlpha = k.rastroOp * Math.pow(1 - d / v.D, 1.5);
          c.beginPath(); c.moveTo(v.px[i], v.py[i]); marcar(v.px[i], v.py[i], 4);
          for (let q = i + 1; q <= j; q++) { c.lineTo(v.px[q], v.py[q]); marcar(v.px[q], v.py[q], 4); }
          c.stroke();
        }
      } else {
        const r = (k.largura * v.escala) / 2;
        for (let i = Math.ceil(ini / v.passo); i * v.passo <= fim && i < v.px.length; i++) {
          const d = s - i * v.passo;
          c.globalAlpha = k.rastroOp * Math.pow(1 - d / v.D, 1.4);
          c.beginPath(); c.arc(v.px[i], v.py[i], r, 0, 6.2832); c.fill();
          marcar(v.px[i], v.py[i], r + 2);
        }
      }
      if (s > v.L) { if (x1 >= x0) sujo.push(x0, y0, x1 - x0, y1 - y0); continue; }
      emPonto(v, s, p);
      const tam = 34 * v.escala, esc = tam / 48;
      marcar(p.x, p.y, tam * 0.62 + 4);
      if (k.sombra !== "none") this.aviao(p.x + 1.5, p.y + 3.5, p.a, esc, k.sombra, 1);
      this.aviao(p.x, p.y, p.a, esc, k.aviao, k.aviaoOp);
      if (k.luzes) {
        c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.scale(esc, esc); c.translate(-24, -24);
        c.globalAlpha = 0.95;
        c.fillStyle = "#FF4D4D"; c.beginPath(); c.arc(15.2, 4.4, 1.3, 0, 6.2832); c.fill();
        c.fillStyle = "#3DFF8C"; c.beginPath(); c.arc(15.2, 43.6, 1.3, 0, 6.2832); c.fill();
        if ((agora + v.t0) % 1300 > 1150) { c.fillStyle = "#fff"; c.beginPath(); c.arc(4.6, 24, 1.3, 0, 6.2832); c.fill(); }
        c.restore();
      }
      if (comRotulo) {
        const prog = s / v.L;
        const alfa = prog < 0.09 ? prog / 0.09 : prog > 0.88 ? (1 - prog) / 0.12 : 1;
        const fs = Math.round(limitar(11 * v.escala, 9.5, 12.5) * 2) / 2;
        this.fonte(fs);
        // a largura da etiqueta é medida uma vez por voo (e de novo só quando a fonte da página termina de carregar)
        if (!v.tw || v.twFonte !== this.fontesProntas) { v.tw = c.measureText(v.rotulo).width; v.twFonte = this.fontesProntas; }
        const tw = v.tw, ph = Math.round(fs * 1.35 + 3), pw = tw + 14;
        const bx = p.x + 16, by = p.y - 12 - ph;
        c.globalAlpha = alfa;
        c.beginPath();
        if (c.roundRect) c.roundRect(bx, by, pw, ph, 6); else c.rect(bx, by, pw, ph);
        c.fillStyle = k.rotuloFundo; c.fill();
        c.lineWidth = 1; c.strokeStyle = k.rotuloBorda; c.stroke();
        c.fillStyle = k.rotulo; c.textBaseline = "middle";
        c.fillText(v.rotulo, bx + 7, by + ph / 2 + 0.5);
        marcar(bx, by, 3); marcar(bx + pw, by + ph, 3);
      }
      if (x1 >= x0) sujo.push(x0, y0, x1 - x0, y1 - y0);
    }
    c.globalAlpha = 1;
  }
}

function useReduzirMovimento() {
  const q = "(prefers-reduced-motion: reduce)";
  const [r, setR] = useState(() => typeof matchMedia === "function" && matchMedia(q).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const m = matchMedia(q), f = () => setR(m.matches);
    m.addEventListener?.("change", f);
    return () => m.removeEventListener?.("change", f);
  }, []);
  return r;
}

export function FundoViagem({ tema, aba }: { tema: TemaFundo; aba?: string }) {
  const ligada = useAnimacaoLigada();
  const reduzir = useReduzirMovimento();
  const ativo = ligada && !reduzir && temCanvas;
  const raiz = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const motor = useRef<Motor | null>(null);
  const temaRef = useRef(tema);
  temaRef.current = tema;
  const abriuEm = useRef(Date.now()); // quando a aba atual foi aberta
  const reagendar = useRef<() => void>(() => {});

  // estrelas paradas: piscar obriga o navegador a redesenhar a tela inteira o tempo todo
  const estrelas = useMemo(() => Array.from({ length: 70 }, () => ({
    x: Math.random() * 100, y: Math.random() * 100, t: Math.random() < 0.5 ? 1 : 2, o: 0.2 + Math.random() * 0.6,
  })), []);

  useEffect(() => { motor.current?.recarregarCores(); }, [tema]);
  // trocou de aba: volta o "primeiro minuto" animado
  useEffect(() => { abriuEm.current = Date.now(); reagendar.current(); }, [aba]);

  useEffect(() => {
    if (!ativo || !tela.current || !raiz.current) return;
    const m = new Motor(tela.current, raiz.current);
    motor.current = m;
    if (EMULADOR) (window as unknown as { __fundo?: Motor }).__fundo = m; // só nos testes locais
    let fim = false, t = 0, primeiro = true;
    const aoRedimensionar = () => m.medir();
    window.addEventListener("resize", aoRedimensionar);
    const lancar = () => {
      const w = m.w, h = m.h, tm = temaRef.current;
      const longe = Math.random() < 0.35; // alguns bem longe: menores, mais lentos e mais claros
      const escala = (tm === "entrada" ? 1.15 : 1) * (longe ? sorteio(0.55, 0.72) : sorteio(0.85, 1.12)) * (w < 640 ? 0.85 : 1);
      const { pts, rotulo } = novaRota(w, h);
      const vel = sorteio(62, 84) * escala * (w < 640 ? 0.8 : 1);
      m.lancar(criarVoo(pts, rotulo, escala, vel, primeiro ? sorteio(0.22, 0.42) : 0, m.cores.linha));
      primeiro = false;
    };
    // ninguém mexendo no computador há 90 s (tela esquecida aberta): para de lançar aviões até alguém voltar
    let mexeu = Date.now();
    const marcar = () => { mexeu = Date.now(); };
    const eventos = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    eventos.forEach((e) => window.addEventListener(e, marcar, { passive: true, capture: true }));
    // no primeiro minuto de cada aba os aviões passam com frequência; depois, um de vez em quando
    // (animação o tempo todo esquenta computador simples e ele começa a engasgar)
    let descanso = sorteio(35000, 70000);
    const tique = () => {
      if (fim) return;
      const alguem = Date.now() - mexeu < 90_000;
      const calmo = Date.now() - abriuEm.current > 60_000;
      const entrada = temaRef.current === "entrada";
      if (!document.hidden && alguem) {
        if (!calmo) { if (m.voos.length < m.maximo(temaRef.current)) lancar(); }
        // depois do primeiro minuto: um avião só, e um descanso de 35 a 70 s depois que ele sai da tela
        else if (!m.voos.length && !m.parado && performance.now() - m.livreDesde > descanso) { lancar(); descanso = sorteio(35000, 70000); }
      }
      t = window.setTimeout(tique, calmo ? 4000 : entrada ? sorteio(3800, 7500) : sorteio(7000, 14000));
    };
    t = window.setTimeout(tique, 350);
    reagendar.current = () => { clearTimeout(t); t = window.setTimeout(tique, 1500); };
    return () => {
      fim = true; clearTimeout(t);
      window.removeEventListener("resize", aoRedimensionar);
      eventos.forEach((e) => window.removeEventListener(e, marcar, { capture: true }));
      reagendar.current = () => {};
      m.destruir(); motor.current = null;
    };
  }, [ativo]);

  return (
    <div className="tt-fundo" data-tema={tema} ref={raiz} aria-hidden="true">
      <div className="tt-estrelas">
        {estrelas.map((s, i) => (
          <i key={i} style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.t, height: s.t, opacity: s.o }} />
        ))}
      </div>
      {ativo && <canvas ref={tela} className="tt-tela" />}
    </div>
  );
}
