/* ═══════════════════════════════════════════════════════════════
   SALA VIP · The Turismo — dentro do portal
   É o mesmo sistema de antes (mesmos dados no Firestore, mesma tela);
   o login e a equipe agora ficam no portal. Roda num Shadow DOM para
   o visual de aeroporto não se misturar com as outras abas.
   ═══════════════════════════════════════════════════════════════ */
import {
  collection, doc, query, where, onSnapshot, updateDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import CSS from './salavip.css?inline';
import HTML from './salavip.html?raw';

/**
 * Monta a Sala VIP dentro de `host`.
 * ctx: { db, nome, nivel: 'admin' | 'operador' }
 * Devolve a função que desmonta (para os ouvintes e os temporizadores).
 */
export function montarSalaVip(host, ctx) {
const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
root.innerHTML = `<style>${CSS}</style><div class="sv-corpo">${HTML}</div>`;
const db = ctx.db;
const app$ = root.getElementById('app');
const dlg = root.getElementById('dlg');

/* ═════════════════ Constantes ═════════════════ */

const AEROPORTOS = [
  ['THE', 'Teresina'], ['GRU', 'São Paulo – Guarulhos'], ['CGH', 'São Paulo – Congonhas'],
  ['VCP', 'Campinas – Viracopos'], ['BSB', 'Brasília'], ['GIG', 'Rio de Janeiro – Galeão'],
  ['SDU', 'Rio de Janeiro – Santos Dumont'], ['CNF', 'Belo Horizonte – Confins'], ['FOR', 'Fortaleza'],
  ['REC', 'Recife'], ['SSA', 'Salvador'], ['SLZ', 'São Luís'], ['NAT', 'Natal'], ['MCZ', 'Maceió'],
  ['JPA', 'João Pessoa'], ['AJU', 'Aracaju'], ['BEL', 'Belém'], ['MAO', 'Manaus'], ['CWB', 'Curitiba'],
  ['POA', 'Porto Alegre'], ['FLN', 'Florianópolis'], ['GYN', 'Goiânia'], ['CGB', 'Cuiabá'],
  ['VIX', 'Vitória'], ['IGU', 'Foz do Iguaçu'], ['MIA', 'Miami'], ['MCO', 'Orlando'],
  ['JFK', 'Nova York – JFK'], ['EZE', 'Buenos Aires – Ezeiza'], ['SCL', 'Santiago'], ['LIM', 'Lima'],
  ['PTY', 'Cidade do Panamá'], ['CUN', 'Cancún'], ['LIS', 'Lisboa'], ['OPO', 'Porto'], ['MAD', 'Madri'],
  ['CDG', 'Paris – Charles de Gaulle'], ['FCO', 'Roma – Fiumicino'], ['MXP', 'Milão – Malpensa'],
  ['LHR', 'Londres – Heathrow'], ['DXB', 'Dubai'], ['DOH', 'Doha'],
];
const NOME_AEROPORTO = Object.fromEntries(AEROPORTOS);
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_LONGOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const STATUS = ['Pendente', 'Emitido', 'Enviado'];
const JANELA_INICIAL = 45;   // dias para trás carregados ao vivo
const REDUZIR_MOVIMENTO = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ═════════════════ Estado ═════════════════ */

const S = {
  nome: ctx.nome, papel: ctx.nivel,
  hoje: hojeFortaleza(), usos: [],
  recentes: new Map(), pendentes: new Map(), seq: 0, diasAtras: JANELA_INICIAL,
  aba: 'proximas', busca: '', online: navigator.onLine,
  montado: false, animouPainel: false, carregouUsos: false,
};
const desligar = { recentes: null, pendentes: null };

/* ═════════════════ Utilitários ═════════════════ */

const $ = (sel, raiz) => (raiz || root).querySelector(sel);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function hojeFortaleza() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
const utc = iso => { const p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); };
const somarDias = (iso, n) => { const d = utc(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const vespera = iso => somarDias(iso, -1);
const ddmm = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);
const diaSem = iso => DIAS[utc(iso).getUTCDay()];
const rotuloDia = iso => diaSem(iso) + ', ' + ddmm(iso);
function rotuloRelativo(iso) {
  if (iso === S.hoje) return 'hoje';
  if (iso === somarDias(S.hoje, 1)) return 'amanhã';
  if (iso === somarDias(S.hoje, -1)) return 'ontem';
  return '';
}
function dataLonga(iso) {
  const d = utc(iso);
  return { dia: DIAS_LONGOS[d.getUTCDay()], data: d.getUTCDate() + ' de ' + MESES_LONGOS[d.getUTCMonth()] };
}
const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
const dois = n => String(n).padStart(2, '0');
const somaAcessos = lista => lista.reduce((t, u) => t + (u.acessos || 0), 0);
const nomeCurto = quem => { const s = String(quem || ''); const p = s.includes('@') ? s.split('@')[0].split(/[._-]/)[0] : s.trim().split(/\s+/)[0]; return p ? p.charAt(0).toUpperCase() + p.slice(1) : ''; };
const normalizarCodigo = s => /^[a-z]{3}$/i.test(s) ? s.toUpperCase() : s;
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
/** "R$ 1.412,50" · "450" · "450,5" → número; vazio → null; inválido → NaN */
function lerValorCampo(txt) {
  let s = String(txt || '').replace(/r\$|\s/gi, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return isFinite(n) && n >= 0 && n <= 1000000 ? Math.round(n * 100) / 100 : NaN;
}
const emailValido = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const ICONES = {
  aviao: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  lapis: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  whats: '<path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3z"/><path d="M9 9.5c.3 1.8 2.7 4.3 4.6 4.6l1.1-1.1 2 .9c-.2 1.3-1.4 2-2.6 1.8C11 15 9 13 8.3 9.9 8.1 8.7 8.8 7.5 10 7.3l.9 2-1.1 1.1"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  telefone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  equipe: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  dinheiro: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
};
/** Linha de detalhes: contato, atendente, valor e parte da emissão. */
function htmlDetalhes(u, parte, escuro) {
  return [
    htmlContato(u.contato, escuro),
    u.atendente ? `<span title="Atendente">${icone('pessoa')}${esc(u.atendente)}</span>` : '',
    u.valor != null ? `<span title="Valor da sala VIP">${icone('dinheiro')}${BRL.format(u.valor)}</span>` : '',
    parte ? (escuro ? `<span>${parte}</span>` : `<span class="parte">${parte}</span>`) : '',
  ].join('');
}
const icone = (nome, cls) => `<svg class="i ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome]}</svg>`;

/** Letreiro de virar: cada letra numa plaquinha; na primeira vez, as letras giram até parar. */
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function letreiro(el, texto, animar) {
  const letras = [...texto.toUpperCase()];
  el.innerHTML = `<span class="sr">${esc(texto)}</span>` + letras.map(c =>
    c === ' ' ? '<span class="esp" aria-hidden="true"></span>' : `<span class="t" aria-hidden="true">${animar && !REDUZIR_MOVIMENTO ? '' : esc(c)}</span>`
  ).join('');
  if (!animar || REDUZIR_MOVIMENTO) return;
  const placas = el.querySelectorAll('.t');
  const finais = letras.filter(c => c !== ' ');
  placas.forEach((p, i) => {
    let voltas = 6 + i * 2;
    const girar = () => {
      if (voltas-- <= 0) { p.textContent = finais[i]; return; }
      p.textContent = ALFABETO[(Math.random() * ALFABETO.length) | 0];
      setTimeout(girar, 38);
    };
    setTimeout(girar, i * 28);
  });
}

function htmlContato(c, escuro) {
  if (!c) return '';
  const dig = c.replace(/\D/g, '');
  if (/@/.test(c)) return `<a href="mailto:${esc(c)}">${icone('email')}${esc(c)}</a>`;
  if (dig.length >= 10 && dig.length <= 13) {
    const num = dig.length <= 11 ? '55' + dig : dig;
    return `<a href="https://wa.me/${num}" target="_blank" rel="noopener" title="Abrir conversa no WhatsApp">${icone('whats')}${esc(c)}</a>`;
  }
  return `<span>${icone('telefone')}${esc(c)}</span>`;
}

function htmlAeroportos(lista, escuro) {
  return lista.map(a => {
    const iata = /^[A-Z]{3}$/.test(a);
    const titulo = iata && NOME_AEROPORTO[a] ? ` title="${esc(NOME_AEROPORTO[a])}"` : '';
    return escuro
      ? `<span class="flap"${titulo}>${esc(a)}</span>`
      : `<span class="aero${iata ? ' iata' : ''}"${titulo}>${esc(a)}</span>`;
  }).join('');
}

function htmlStatus(u, escuro) {
  const quem = u.atualizadoPor ? ` title="Última mudança: ${esc(nomeCurto(u.atualizadoPor))}${u.atualizadoEm ? ' às ' + u.atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' de ' + u.atualizadoEm.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}"` : '';
  return `<div class="seg${escuro ? ' escuro' : ''}" role="group" aria-label="Status de ${esc(u.cliente)}"${quem}>` +
    STATUS.map(v => `<button type="button" data-acao="status" data-id="${esc(u.id)}" data-v="${v}" aria-pressed="${u.status === v}">${v}</button>`).join('') +
    '</div>';
}

function mapaPartes() {
  const grupos = {};
  S.usos.forEach(u => { (grupos[u.emissao] = grupos[u.emissao] || []).push(u); });
  const partes = {};
  Object.values(grupos).forEach(g => {
    g.sort((a, b) => a.data.localeCompare(b.data));
    g.forEach((u, i) => { partes[u.id] = g.length > 1 ? `Data ${i + 1} de ${g.length}` : ''; });
  });
  return partes;
}

function traduzirErro(e) {
  const c = (e && e.code) || '';
  if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-login-credentials') return 'E-mail ou senha incorretos.';
  if (c === 'auth/invalid-email') return 'Esse e-mail não parece válido.';
  if (c === 'auth/too-many-requests') return 'Muitas tentativas seguidas. Espere alguns minutos ou redefina a senha.';
  if (c === 'auth/user-disabled') return 'Essa conta foi desativada.';
  if (c === 'auth/network-request-failed' || c === 'unavailable') return 'Sem conexão com a internet.';
  if (c === 'permission-denied') return 'Seu acesso não permite essa ação. Confira seu papel na equipe.';
  return (e && e.message) || 'Algo deu errado. Tente de novo.';
}

/** Espera o servidor confirmar; se demorar (sem internet), segue e avisa quando sincronizar. */
async function comPrazo(promessa, ms) {
  let pronto = false;
  const resultado = promessa.then(() => { pronto = true; }, e => { pronto = true; throw e; });
  await Promise.race([resultado, new Promise(r => setTimeout(r, ms || 3500))]);
  if (pronto) return resultado.then(() => 'ok');
  resultado.then(() => toast('Alterações sincronizadas.'), e => toast(traduzirErro(e), true));
  return 'pendente';
}

let toastTimer = null;
function toast(msg, erro) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('erro', !!erro);
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), erro ? 6500 : 3200);
}

/* ═════════════════ Leitura da emissão do WhatsApp ═════════════════
   Regras fixas, sem IA: o texto não sai do navegador.
   Pega cliente (1º passageiro), contato, cada trecho (IDA/VOLTA) como uma
   data de uso, aeroportos de embarque e conexão, acessos (= passageiros),
   atendente e, se houver uma linha de sala VIP, quantidade e valor.
   CPF e data de nascimento são ignorados de propósito.
   ═══════════════════════════════════════════════════════════════════ */
/* LEITOR-INICIO */
const LEITOR = (() => {
  const MESES_TXT = 'janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro';
  const NAO_E_NOME = /\b(emiss[aã]o|pacote|hospedagem|pousada|hotel|resort|valor|total|atendente|telefone|forma|pagamento|ida|volta|retorno|trecho|voo|dura[cç][aã]o|linhas|a[eé]reas|airlines|sala|vip|lounge|pix|cart[aã]o|parcela|bagagem|transfer|seguro|caf[eé]|di[aá]rias?|noites?|quarto|apartamento)\b/i;
  const CAB_TRECHO = /^(ida|volta|retorno|trecho\s*\d*|\d+\s*[ºo°]?\s*trecho)\b/i;
  const FIM_TRECHO = /^(hospedagem|valor|atendente|telefone|forma de pagamento|sala\s*vip|lounge|transfer|seguro|passageiros?|observa)/i;
  const CIAS = ['Azul', 'LATAM', 'GOL', 'TAP', 'American Airlines', 'Copa Airlines', 'Avianca', 'Aerolíneas Argentinas', 'Iberia', 'Air France', 'KLM', 'Emirates', 'Qatar Airways', 'United', 'Delta', 'JetSMART', 'Air Europa', 'Lufthansa'];
  const MINUSCULAS = ['da', 'de', 'do', 'das', 'dos', 'e', 'a', 'o', 'para', 'pessoas', 'pessoa', 'adultos', 'crianças', 'noites', 'dias'];
  const dois = n => String(n).padStart(2, '0');

  const limpar = l => l.normalize('NFKC')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/[*~]+/g, '') // negrito e riscado do WhatsApp (*IDA – 27/11*)
    .replace(/\s+/g, ' ').trim();

  const capitalizar = s => s.toLowerCase().split(' ').filter(Boolean)
    .map((p, i) => (i > 0 && MINUSCULAS.includes(p)) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

  const somar = (iso, n) => { const p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10); };

  function dataIso(dia, mes, ano, anoCabecalho, hoje) {
    dia = +dia; mes = +mes;
    let a = ano ? +ano : anoCabecalho;
    if (a && a < 100) a += 2000;
    if (!a) {
      a = +hoje.slice(0, 4);
      if (`${a}-${dois(mes)}-${dois(dia)}` < somar(hoje, -30)) a += 1; // sem ano: próxima ocorrência
    }
    const d = new Date(Date.UTC(a, mes - 1, dia));
    if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return '';
    return d.toISOString().slice(0, 10);
  }

  function formatarFone(txt) {
    let d = txt.replace(/\D/g, '');
    if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return txt.trim();
  }

  function valorReais(txt) {
    const m = String(txt || '').match(/R\$\s*([\d.]+(?:,\d{1,2})?)/i);
    if (!m) return null;
    const n = Number(m[1].replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  function ler(texto, hoje, conhecidos) {
    const bruto = String(texto || '');
    const linhas = bruto.split(/\r?\n/).map(limpar);
    const naoVazias = linhas.filter(Boolean);
    const r = { cliente: '', contato: '', atendente: '', valor: null, obs: '', usos: [], achou: [], avisos: [] };
    if (!naoVazias.length) { r.avisos.push('O texto colado está vazio.'); return r; }

    // ano do cabeçalho ("13 a 16 de novembro de 2026")
    const linhaAno = naoVazias.find(l => new RegExp(`(${MESES_TXT})\\D{0,12}(20\\d{2})`, 'i').test(l));
    const anoCab = linhaAno ? +linhaAno.match(/(20\d{2})/)[1] : null;

    // trechos: IDA, VOLTA, TRECHO 2…
    const trechos = [];
    let atual = null;
    linhas.forEach(l => {
      if (!l) return;
      if (CAB_TRECHO.test(l)) { atual = { linhas: [l] }; trechos.push(atual); return; }
      if (atual && (FIM_TRECHO.test(l) || /^r\$/i.test(l))) { atual = null; return; }
      if (atual) atual.linhas.push(l);
    });

    const usos = [];
    trechos.forEach(t => {
      let data = '';
      for (const l of t.linhas.slice(0, 3)) {
        const m = l.match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/);
        if (m) { data = dataIso(m[1], m[2], m[3], anoCab, hoje); break; }
      }
      const corpo = t.linhas.join(' ');
      let codigos = [...corpo.matchAll(/\(([A-Z]{3})\)/g)].map(m => m[1]);
      if (!codigos.length) codigos = [...corpo.matchAll(/\b([A-Z]{3})\b/g)].map(m => m[1]).filter(c => conhecidos[c]);
      const seq = codigos.filter((c, i) => c !== codigos[i - 1]);
      const embarques = (seq.length > 1 ? seq.slice(0, -1) : seq).filter((c, i, a) => a.indexOf(c) === i);
      if (data || embarques.length) usos.push({ data, aeroportos: embarques });
    });

    // passageiros: linha só com letras seguida de nascimento, CPF ou "DN"
    const nomes = [];
    naoVazias.forEach((l, i) => {
      if (!/^[\p{L}][\p{L}'’. -]*$/u.test(l)) return;
      if (l.split(' ').filter(w => w.length > 1).length < 2 || NAO_E_NOME.test(l)) return;
      const prox = naoVazias[i + 1] || '';
      if (/\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}/.test(prox) || /\b(cpf|dn|nasc)/i.test(prox) || /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(prox)) {
        nomes.push(capitalizar(l));
      }
    });
    const declarados = (bruto.normalize('NFKC').match(/(\d+)\s*(pessoas|pax|passageiros|adultos)\b/i) || [])[1];
    const pax = Math.min(99, Math.max(nomes.length, +declarados || 0)) || 0;

    // contato: celular na área dos passageiros (antes do ATENDENTE); CPF fica de fora
    const iAtend = naoVazias.findIndex(l => /^atendente\b/i.test(l));
    const zona = iAtend > -1 ? naoVazias.slice(0, iAtend) : naoVazias;
    const ehCpf = l => /\bcpf\b/i.test(l) || /\d{3}\.\d{3}\.\d{3}-\d{2}/.test(l);
    const ehFone = l => { const d = l.replace(/\D/g, ''); return !ehCpf(l) && /^[+()\d\s.-]+$/.test(l) && d.length >= 10 && d.length <= 13; };
    const fone = zona.find(ehFone);
    const email = (zona.join(' ').match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i) || [])[0];
    const foneRotulado = naoVazias.find(l => /^(telefone|celular|whats\w*|contato)\s*:/i.test(l));

    r.cliente = nomes[0] || '';
    if (fone) r.contato = formatarFone(fone);
    else if (email) r.contato = email.toLowerCase();
    else if (foneRotulado) { r.contato = formatarFone(foneRotulado.replace(/^[^:]+:/, '')); r.avisos.push('O contato veio da linha "Telefone" da emissão. Confira se é do cliente.'); }

    const atend = naoVazias.find(l => /^atendente\s*:?/i.test(l));
    if (atend) r.atendente = capitalizar(atend.replace(/^atendente\s*:?\s*/i, '')).slice(0, 60);

    // linha específica de sala VIP, se houver ("SALA VIP: 2 acessos em GRU – R$ 300")
    const iVip = naoVazias.findIndex(l => /sala\s*vip|lounge/i.test(l));
    let acessosVip = 0, aeroportosVip = [];
    if (iVip > -1) {
      const bloco = naoVazias.slice(iVip, iVip + 3).join(' ');
      acessosVip = +((bloco.match(/(\d+)\s*(acessos?|entradas?|pax|pessoas?)/i) || [])[1] || 0);
      aeroportosVip = [...bloco.matchAll(/\b([A-Z]{3})\b/g)].map(m => m[1]).filter((c, i, a) => conhecidos[c] && a.indexOf(c) === i);
      r.valor = valorReais(naoVazias[iVip]) ?? valorReais(bloco);
    }

    const acessos = Math.min(99, acessosVip || pax || 1);
    r.usos = usos.map(u => ({
      data: u.data,
      aeroportos: aeroportosVip.length ? (u.aeroportos.filter(a => aeroportosVip.includes(a)).length ? u.aeroportos.filter(a => aeroportosVip.includes(a)) : u.aeroportos) : u.aeroportos,
      acessos,
    }));

    // observações: pacote, companhia e demais passageiros
    const titulo = naoVazias.find(l => /^pacote\b/i.test(l));
    const cia = CIAS.find(c => new RegExp(`\\b${c}\\b`, 'i').test(bruto));
    r.obs = [
      titulo ? capitalizar(titulo) : '',
      cia ? 'Voo ' + cia : '',
      nomes.length > 1 ? 'Passageiros: ' + nomes.join(', ') : '',
      fone && email ? 'E-mail: ' + email.toLowerCase() : '',
    ].filter(Boolean).join('. ').slice(0, 500);

    // resumo do que foi encontrado
    if (r.cliente) r.achou.push('cliente');
    if (r.contato) r.achou.push('contato');
    const comData = r.usos.filter(u => u.data).length;
    if (comData) r.achou.push(comData === 1 ? '1 data' : comData + ' datas');
    if (r.usos.some(u => u.aeroportos.length)) r.achou.push('aeroportos');
    if (pax || acessosVip) r.achou.push(acessos === 1 ? '1 acesso' : acessos + ' acessos');
    if (r.atendente) r.achou.push('atendente');
    if (r.valor != null) r.achou.push('valor');

    if (!r.cliente) r.avisos.push('Não achei o nome do passageiro.');
    if (!r.usos.length) r.avisos.push('Não achei os trechos de IDA e VOLTA. Preencha as datas à mão.');
    else if (r.usos.some(u => !u.data)) r.avisos.push('Algum trecho veio sem data. Confira.');
    if (!pax && !acessosVip) r.avisos.push('Não achei quantos passageiros são. Deixei 1 acesso.');
    return r;
  }

  return { ler, formatarFone, valorReais };
})();
/* LEITOR-FIM */

/* ═════════════════ Ligar e desligar ═════════════════ */

function pararTudo() {
  Object.keys(desligar).forEach(k => { if (desligar[k]) { desligar[k](); desligar[k] = null; } });
  S.recentes.clear(); S.pendentes.clear(); S.usos = [];
  S.montado = false; S.carregouUsos = false; S.animouPainel = false;
  if (dlg.open) dlg.close();
}

/* ═════════════════ Dados ao vivo ═════════════════ */

function docParaUso(d, seq) {
  const x = d.data();
  const data = typeof x.data === 'string' ? x.data : '';
  return {
    id: d.id,
    emissao: x.emissao || d.id,
    cliente: x.cliente || '',
    contato: x.contato || '',
    obs: x.obs || '',
    data,
    emitirEm: data ? vespera(data) : '',
    aeroportos: Array.isArray(x.aeroportos) ? x.aeroportos : [],
    acessos: Number(x.acessos) || 0,
    status: STATUS.includes(x.status) ? x.status : 'Pendente',
    atendente: typeof x.atendente === 'string' ? x.atendente : '',
    valor: typeof x.valor === 'number' ? x.valor : null,
    atualizadoPor: x.atualizadoPor || '',
    atualizadoEm: x.atualizadoEm && typeof x.atualizadoEm.toDate === 'function' ? x.atualizadoEm.toDate() : null,
    _seq: seq,
  };
}

function ouvirUsos() {
  ['recentes', 'pendentes'].forEach(k => { if (desligar[k]) desligar[k](); });
  const usos = collection(db, 'usos');
  const receber = mapa => snap => {
    const seq = ++S.seq;
    mapa.clear();
    snap.docs.forEach(d => { const u = docParaUso(d, seq); if (u.data) mapa.set(u.id, u); });
    S.carregouUsos = true;
    S.online = navigator.onLine && !snap.metadata.fromCache;
    juntar();
    agendarRender();
  };
  const falhar = e => { if (e.code === 'permission-denied') return; toast(traduzirErro(e), true); };
  // tudo que é recente (inclui o histórico dos últimos dias)…
  desligar.recentes = onSnapshot(query(usos, where('emitirEm', '>=', somarDias(S.hoje, -S.diasAtras))), { includeMetadataChanges: true }, receber(S.recentes), falhar);
  // …e qualquer pendente antigo que tenha ficado para trás
  desligar.pendentes = onSnapshot(query(usos, where('status', '==', 'Pendente')), receber(S.pendentes), falhar);
}

function juntar() {
  const m = new Map(S.pendentes);
  S.recentes.forEach((u, id) => { const o = m.get(id); if (!o || u._seq >= o._seq) m.set(id, u); });
  S.usos = [...m.values()];
}

let renderPendente = false;
function agendarRender() {
  if (renderPendente) return;
  renderPendente = true;
  requestAnimationFrame(() => { renderPendente = false; render(); });
}

/* ═════════════════ Tela principal ═════════════════ */

function montar() {
  app$.innerHTML = `
    <div class="wrap">
      <header class="topo">
        <div class="marca">
          <span class="marca-selo">${icone('aviao')}</span>
          <div><h1>Sala VIP</h1><small>Emissões da The Turismo</small></div>
        </div>
        <div class="topo-acoes" id="topo-acoes"></div>
      </header>
      <section class="painel" id="painel" aria-labelledby="painel-titulo"></section>
      <div class="barra">
        <div class="abas" role="tablist" id="abas"></div>
        <label class="busca">
          <span class="sr">Buscar</span>
          ${icone('busca')}
          <input type="search" id="busca" placeholder="Buscar cliente, contato ou aeroporto" autocomplete="off">
        </label>
      </div>
      <section id="lista" aria-live="polite"></section>
    </div>`;
  $('#busca').value = S.busca;
  $('#busca').addEventListener('input', ev => { S.busca = ev.target.value; const c = classificar(); renderAbas(c); renderLista(c); });
  S.montado = true;
}

function classificar() {
  const painel = [], proximas = [], historico = [];
  S.usos.forEach(u => {
    if (u.emitirEm === S.hoje) painel.push(u);
    else if (u.emitirEm < S.hoje && u.status === 'Pendente') painel.push(u);
    else if (u.emitirEm > S.hoje) proximas.push(u);
    else historico.push(u);
  });
  const ordem = { Pendente: 0, Emitido: 1, Enviado: 2 };
  const nome = (a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR');
  painel.sort((a, b) => (a.emitirEm < S.hoje ? 0 : 1) - (b.emitirEm < S.hoje ? 0 : 1) || a.emitirEm.localeCompare(b.emitirEm) || ordem[a.status] - ordem[b.status] || nome(a, b));
  proximas.sort((a, b) => a.emitirEm.localeCompare(b.emitirEm) || nome(a, b));
  historico.sort((a, b) => b.emitirEm.localeCompare(a.emitirEm) || nome(a, b));
  return { painel, proximas, historico };
}

function render() {
  if (!S.montado || !$('#painel')) return;
  const c = classificar();
  renderTopo();
  renderPainel(c);
  renderAbas(c);
  renderLista(c);
}

function renderTopo() {
  const admin = S.papel === 'admin';
  $('#topo-acoes').innerHTML = `
    <span class="aovivo${S.online ? '' : ' off'}" title="${S.online ? 'As mudanças aparecem na hora para todos.' : 'Sem internet. O que você mudar fica salvo neste computador e sobe quando a conexão voltar.'}"><span>${S.online ? 'Ao vivo' : 'Sem internet'}</span></span>
    <span class="quem"><b>${esc(nomeCurto(S.nome))}</b><em>${admin ? 'administrador' : 'operador'}</em></span>
    ${admin ? `<button class="btn" type="button" data-acao="nova">${icone('mais')}Nova emissão</button>` : ''}`;
}

function renderPainel(c) {
  const painel = $('#painel');
  const partes = mapaPartes();
  const hojeLista = c.painel.filter(u => u.emitirEm === S.hoje);
  const atrasadas = c.painel.filter(u => u.emitirEm < S.hoje);
  const amanha = S.usos.filter(u => u.emitirEm === somarDias(S.hoje, 1));
  const animar = !S.animouPainel && S.carregouUsos;
  const quando = dataLonga(S.hoje);

  let corpo;
  if (!S.carregouUsos) {
    corpo = '<div class="quadro-vazio">Carregando emissões…</div>';
  } else if (!c.painel.length) {
    const prox = c.proximas[0];
    const dica = prox
      ? `A próxima é ${rotuloRelativo(prox.emitirEm) || 'em ' + rotuloDia(prox.emitirEm)}: ${plural(c.proximas.filter(u => u.emitirEm === prox.emitirEm).length, 'cliente', 'clientes')}.`
      : 'Nenhuma emissão agendada para os próximos dias.';
    corpo = `<div class="quadro-vazio"><strong>Nenhuma sala VIP para emitir hoje.</strong>${esc(dica)}</div>`;
  } else {
    corpo = `
      <div class="quadro" role="table" aria-label="Emissões de hoje">
        <div class="quadro-cab" role="row">
          <span role="columnheader">Uso</span><span role="columnheader">Cliente</span>
          <span role="columnheader">Aeroportos</span><span role="columnheader">Acessos</span><span role="columnheader">Status</span>
        </div>
        ${c.painel.map((u, i) => {
          const atrasada = u.emitirEm < S.hoje;
          const aviso = atrasada ? (u.data < S.hoje ? 'Data de uso já passou' : 'Atrasada: o uso é hoje') : '';
          const d = utc(u.data);
          return `
          <div class="quadro-linha${atrasada ? ' atrasada' : ''}${u.status === 'Enviado' ? ' feita' : ''}" role="row" style="animation-delay:${Math.min(i, 10) * 55 + 260}ms">
            <div class="q-dia" role="cell"><span class="flap flap-data"><b>${dois(d.getUTCDate())} ${MESES[d.getUTCMonth()]}</b><span>${diaSem(u.data)}</span></span></div>
            <div class="q-info" role="cell">
              <div class="q-nome">${esc(u.cliente)}</div>
              <div class="q-sub">${htmlDetalhes(u, partes[u.id], true)}${aviso ? `<span class="q-aviso">${aviso}</span>` : ''}</div>
            </div>
            <div class="q-aero flaps" role="cell">${htmlAeroportos(u.aeroportos, true)}</div>
            <div class="q-qtd" role="cell"><span class="flap flap-num" title="${plural(u.acessos, 'acesso', 'acessos')}">${dois(u.acessos)}</span></div>
            <div class="q-st" role="cell">${htmlStatus(u, true)}</div>
          </div>`;
        }).join('')}
      </div>`;
  }

  // o letreiro só é recriado na primeira vez, para não piscar a cada atualização
  if (!$('#painel-titulo')) {
    painel.innerHTML = `
      <div class="painel-topo">
        <h2 class="letreiro" id="painel-titulo"></h2>
        <p class="quando" id="painel-quando"></p>
      </div>
      <div id="painel-corpo"></div>
      <div class="placar" id="placar"></div>`;
    letreiro($('#painel-titulo'), 'Emitir hoje', true);
  }
  $('#painel-quando').innerHTML = `${esc(quando.dia)}, <b>${esc(quando.data)}</b>`;
  painel.classList.toggle('entrando', animar);
  $('#painel-corpo').innerHTML = corpo;
  $('#placar').innerHTML = `
    <div><span class="flap">${dois(hojeLista.length)}</span><span>${hojeLista.length === 1 ? 'cliente hoje' : 'clientes hoje'}</span></div>
    <div><span class="flap">${dois(somaAcessos(hojeLista))}</span><span>${somaAcessos(hojeLista) === 1 ? 'acesso hoje' : 'acessos hoje'}</span></div>
    <div class="${atrasadas.length ? 'alerta' : ''}"><span class="flap">${dois(atrasadas.length)}</span><span>${atrasadas.length === 1 ? 'atrasada' : 'atrasadas'}</span></div>
    <div><span class="flap">${dois(amanha.length)}</span><span>para amanhã</span></div>`;
  if (animar) S.animouPainel = true;
}

function renderAbas(c) {
  const busca = S.busca.trim();
  $('#abas').innerHTML = [['proximas', 'Próximas', c.proximas.length], ['historico', 'Histórico', c.historico.length]].map(([id, rot, n]) =>
    `<button type="button" role="tab" data-acao="aba" data-aba="${id}" aria-selected="${S.aba === id && !busca}">${rot}<span class="n">${n}</span></button>`
  ).join('');
}

function renderLista(c) {
  c = c || classificar();
  const lista = $('#lista');
  if (!lista) return;
  const termo = S.busca.trim().toLowerCase();
  const admin = S.papel === 'admin';
  let itens, vazio, rodape = '';

  if (termo) {
    const achou = S.usos.filter(u => [u.cliente, u.contato, u.obs, u.atendente, ...u.aeroportos, ...u.aeroportos.map(a => NOME_AEROPORTO[a] || '')].join(' ').toLowerCase().includes(termo));
    itens = achou.filter(u => u.emitirEm >= S.hoje).sort((a, b) => a.emitirEm.localeCompare(b.emitirEm))
      .concat(achou.filter(u => u.emitirEm < S.hoje).sort((a, b) => b.emitirEm.localeCompare(a.emitirEm)));
    vazio = `<strong>Nada encontrado para “${esc(S.busca.trim())}”.</strong>Confira a grafia ou busque pelo código do aeroporto.`;
  } else if (S.aba === 'historico') {
    itens = c.historico;
    vazio = `<strong>Nada nos últimos ${S.diasAtras} dias.</strong>As emissões de dias anteriores aparecem aqui.`;
    rodape = `<div class="mais-antigas"><button class="btn-sec" type="button" data-acao="antigas">Mostrar mais ${S.diasAtras >= 365 ? '' : '90 dias '}para trás</button></div>`;
  } else {
    itens = c.proximas;
    vazio = '<strong>Nenhuma emissão agendada para os próximos dias.</strong>' + (admin
      ? `Cadastre uma emissão e ela entra na lista da véspera.<br><button class="btn" type="button" data-acao="nova">${icone('mais')}Nova emissão</button>`
      : 'As novas emissões aparecem aqui assim que forem cadastradas.');
  }

  if (!S.carregouUsos) { lista.innerHTML = ''; return; }
  if (!itens.length) { lista.innerHTML = `<div class="vazio">${vazio}</div>${rodape}`; return; }

  const grupos = [];
  itens.forEach(u => {
    const g = grupos[grupos.length - 1];
    if (g && g.dia === u.emitirEm) g.itens.push(u); else grupos.push({ dia: u.emitirEm, itens: [u] });
  });
  const partes = mapaPartes();

  lista.innerHTML = grupos.map(g => {
    const rel = rotuloRelativo(g.dia);
    return `
    <div class="grupo">
      <div class="grupo-cab">
        <h3>${rel ? `Emitir ${rel}<span>${rotuloDia(g.dia)}</span>` : `Emitir ${rotuloDia(g.dia)}`}</h3>
        <p>${plural(g.itens.length, 'cliente', 'clientes')}, ${plural(somaAcessos(g.itens), 'acesso', 'acessos')}</p>
      </div>
      <div class="linhas${admin ? '' : ' leitor'}">
        ${g.itens.map(u => {
          const d = utc(u.data);
          return `
          <div class="linha">
            <div class="dia" title="Data de uso"><b>${dois(d.getUTCDate())}</b><span>${MESES[d.getUTCMonth()]}, ${diaSem(u.data)}</span></div>
            <div class="info">
              <div class="nome">${esc(u.cliente)}</div>
              <div class="sub">${htmlDetalhes(u, partes[u.id], false)}</div>
              ${u.obs ? `<div class="obs" title="${esc(u.obs)}">${esc(u.obs)}</div>` : ''}
            </div>
            <div class="aeros chips-ver">${htmlAeroportos(u.aeroportos)}</div>
            <div class="acessos"><b>${u.acessos}</b><span>${u.acessos === 1 ? 'acesso' : 'acessos'}</span></div>
            <div class="st">${htmlStatus(u)}</div>
            ${admin ? `<button type="button" class="icone editar" data-acao="editar" data-emissao="${esc(u.emissao)}" aria-label="Editar emissão de ${esc(u.cliente)}" title="Editar emissão">${icone('lapis')}</button>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('') + rodape;
}

/* ═════════════════ Ações ═════════════════ */

async function mudarStatus(id, status) {
  const u = S.usos.find(x => x.id === id);
  if (!u || u.status === status) return;
  const frase = { Pendente: 'voltou para pendente', Emitido: 'marcado como emitido', Enviado: 'marcado como enviado ao cliente' }[status];
  const gravacao = updateDoc(doc(db, 'usos', id), { status, atualizadoEm: serverTimestamp(), atualizadoPor: S.nome });
  toast(`${u.cliente}: ${frase}.`);
  try { await gravacao; } catch (e) { toast(traduzirErro(e), true); }
}

app$.addEventListener('click', ev => {
  const el = ev.target.closest('[data-acao]');
  if (!el) return;
  const acao = el.dataset.acao;
  if (acao === 'status') mudarStatus(el.dataset.id, el.dataset.v);
  else if (acao === 'aba') { S.aba = el.dataset.aba; S.busca = ''; $('#busca').value = ''; const c = classificar(); renderAbas(c); renderLista(c); }
  else if (acao === 'nova') abrirForm(null);
  else if (acao === 'editar') abrirForm(el.dataset.emissao);
  else if (acao === 'antigas') { S.diasAtras += 90; ouvirUsos(); toast('Carregando dias anteriores…'); }
});

const aoOnline = () => { S.online = true; agendarRender(); };
const aoOffline = () => { S.online = false; agendarRender(); };
window.addEventListener('online', aoOnline);
window.addEventListener('offline', aoOffline);

// virada do dia: recalcula "hoje" e a janela de dados
const relogio = setInterval(() => {
  const agora = hojeFortaleza();
  if (agora !== S.hoje) { S.hoje = agora; if (S.montado) { ouvirUsos(); agendarRender(); } }
}, 30000);

/* ═════════════════ Formulário de emissão ═════════════════ */

const fUsos = $('#f-usos');
let F = null;
let armarTimer = null;
let redesenhando = false;

function abrirForm(emissao) {
  const usos = emissao ? S.usos.filter(u => u.emissao === emissao).sort((a, b) => a.data.localeCompare(b.data)) : [];
  const base = usos[0];
  F = {
    emissao: emissao || '',
    originais: usos.map(u => u.id),
    usos: usos.length
      ? usos.map(u => ({ id: u.id, data: u.data, aeroportos: u.aeroportos.slice(), acessos: u.acessos }))
      : [{ id: '', data: '', aeroportos: [], acessos: 1 }],
  };
  $('#dlg-titulo').textContent = emissao ? 'Editar emissão' : 'Nova emissão';
  $('#f-cliente').value = base ? base.cliente : '';
  $('#f-contato').value = base ? base.contato : '';
  $('#f-atendente').value = base ? base.atendente : '';
  $('#f-valor').value = base && base.valor != null ? BRL.format(base.valor) : '';
  $('#f-obs').value = base ? base.obs : '';
  $('#f-excluir').hidden = !emissao;
  dlg.querySelectorAll('.auto, [aria-invalid]').forEach(el => { el.classList.remove('auto'); el.removeAttribute('aria-invalid'); });
  // colar emissão: só no cadastro novo
  $('#f-colar').hidden = !!emissao;
  $('#f-texto').value = '';
  $('#f-lido').hidden = true;
  const atendentes = [...new Set(S.usos.map(u => u.atendente).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  $('#lista-atendentes').innerHTML = atendentes.map(a => `<option value="${esc(a)}"></option>`).join('');
  desarmarExcluir();
  erroForm('');
  renderUsos();
  dlg.showModal();
  (emissao ? $('#f-cliente') : $('#f-texto')).focus();
}

/* ───── colar emissão ───── */

function preencherComTexto() {
  const texto = $('#f-texto').value;
  if (!texto.trim()) { $('#f-texto').focus(); return; }
  const r = LEITOR.ler(texto, S.hoje, NOME_AEROPORTO);
  const marcar = (sel, valor) => { if (valor) { const el = $(sel); el.value = valor; el.classList.add('auto'); el.removeAttribute('aria-invalid'); } };
  marcar('#f-cliente', r.cliente);
  marcar('#f-contato', r.contato);
  marcar('#f-atendente', r.atendente);
  if (r.valor != null) marcar('#f-valor', BRL.format(r.valor));
  marcar('#f-obs', r.obs);
  if (r.usos.length) {
    F.usos = r.usos.slice(0, 12).map(u => ({
      id: '', data: u.data, aeroportos: u.aeroportos.slice(0, 8), acessos: u.acessos,
      auto: { data: !!u.data, aero: u.aeroportos.length > 0, acessos: true },
    }));
    renderUsos();
  }
  const lido = $('#f-lido');
  lido.innerHTML = `
    <div class="lido-topo">
      <span>${r.achou.length ? `<b>Preenchido:</b> ${esc(r.achou.join(', '))}. Os campos em destaque vieram da emissão; confira antes de salvar.` : '<b>Não consegui ler essa emissão.</b> Preencha os campos à mão.'}</span>
      <button type="button" class="link" id="f-outra">Colar outra</button>
    </div>
    ${r.avisos.length ? `<ul>${r.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}`;
  lido.hidden = false;
  $('#f-colar').hidden = true;
  $('#f-outra').addEventListener('click', () => {
    lido.hidden = true;
    $('#f-colar').hidden = false;
    $('#f-texto').select();
  });
  const semData = F.usos.findIndex(u => !u.data);
  const alvo = !r.cliente ? $('#f-cliente') : semData > -1 ? $(`.uso[data-i="${semData}"] [data-campo=data]`, fUsos) : $('#f-cliente');
  if (alvo) alvo.focus();
}

$('#f-ler').addEventListener('click', preencherComTexto);
$('#f-texto').addEventListener('paste', () => setTimeout(preencherComTexto, 0));
$('#f-valor').addEventListener('blur', ev => {
  const v = lerValorCampo(ev.target.value);
  if (v != null && !isNaN(v)) ev.target.value = BRL.format(v);
});
['#f-cliente', '#f-contato', '#f-atendente', '#f-valor', '#f-obs'].forEach(sel =>
  $(sel).addEventListener('input', ev => { ev.target.classList.remove('auto'); ev.target.removeAttribute('aria-invalid'); }));

function chipsHtml(u, i) {
  return u.aeroportos.map((a, j) =>
    `<span class="chip" title="${esc(NOME_AEROPORTO[a] || a)}">${esc(a)}<button type="button" data-tirar="${j}" aria-label="Tirar ${esc(a)}">${icone('x')}</button></span>`
  ).join('') + `<input data-campo="aero" list="lista-aeroportos" aria-labelledby="rot-aero-${i}" placeholder="${u.aeroportos.length ? 'Adicionar' : 'Ex.: THE, GRU'}" autocomplete="off">`;
}

function renderUsos() {
  redesenhando = true;
  try {
    fUsos.innerHTML = F.usos.map((u, i) => {
      const a = u.auto || {};
      return `
      <div class="uso" data-i="${i}">
        <label class="campo"><span>Data de uso</span><input type="date" data-campo="data" value="${esc(u.data)}"${a.data ? ' class="auto"' : ''}></label>
        <div class="campo"><span id="rot-aero-${i}">Aeroportos</span><div class="chips${a.aero ? ' auto' : ''}" data-chips>${chipsHtml(u, i)}</div></div>
        <div class="campo"><span>Acessos</span>
          <div class="contador${a.acessos ? ' auto' : ''}">
            <button type="button" data-passo="-1" aria-label="Menos um acesso">−</button>
            <input type="number" data-campo="acessos" min="1" max="99" value="${u.acessos}" aria-label="Quantidade de acessos">
            <button type="button" data-passo="1" aria-label="Mais um acesso">+</button>
          </div>
        </div>
        <button type="button" class="icone remover" data-remover aria-label="Remover esta data" title="Remover esta data" ${F.usos.length === 1 ? 'hidden' : ''}>${icone('x')}</button>
        <p class="uso-dica${alertaUso(u.data) ? ' alerta' : ''}">${dicaUso(u.data)}</p>
      </div>`;
    }).join('');
  } finally { redesenhando = false; }
}

/** Tira o destaque de "veio da emissão" quando a pessoa mexe no campo. */
function conferido(i, parte) {
  const u = F.usos[i];
  if (u && u.auto) u.auto[parte] = false;
  const box = $(`.uso[data-i="${i}"]`, fUsos);
  if (!box) return;
  const el = parte === 'data' ? $('[data-campo=data]', box) : parte === 'aero' ? $('[data-chips]', box) : $('.contador', box);
  if (el) el.classList.remove('auto');
}

function redesenharChips(i, focar) {
  const box = $(`.uso[data-i="${i}"] [data-chips]`, fUsos);
  if (!box || redesenhando) return;
  redesenhando = true;
  try { box.innerHTML = chipsHtml(F.usos[i], i); } finally { redesenhando = false; }
  if (focar) $('[data-campo=aero]', box).focus();
}

function addAeroporto(i, texto) {
  const novos = String(texto || '').split(/[,;]+/).map(s => s.trim()).filter(Boolean).map(normalizarCodigo);
  if (!novos.length) return false;
  const lista = F.usos[i].aeroportos;
  novos.forEach(a => { if (lista.length < 8 && !lista.some(x => x.toUpperCase() === a.toUpperCase())) lista.push(a.slice(0, 40)); });
  return true;
}

function colherPendentes() {
  fUsos.querySelectorAll('.uso').forEach((box, i) => {
    const inp = $('[data-campo=aero]', box);
    if (inp && inp.value.trim()) { addAeroporto(i, inp.value); inp.value = ''; }
  });
}

const alertaUso = data => !!data && vespera(data) < S.hoje;
function dicaUso(data) {
  if (!data) return 'Escolha a data em que o cliente vai usar a sala.';
  const em = vespera(data);
  if (data < S.hoje) return '<strong>Essa data já passou.</strong> Confira antes de salvar.';
  if (em < S.hoje) return '<strong>O uso é hoje: emita agora.</strong>';
  return `Emitir em <strong>${em === S.hoje ? 'hoje' : rotuloDia(em)}</strong>, véspera do uso.`;
}
const usoDe = el => { const box = el.closest('.uso'); return box ? { box, i: +box.dataset.i } : null; };

fUsos.addEventListener('input', ev => {
  const alvo = ev.target, ref = usoDe(alvo);
  if (!ref) return;
  const u = F.usos[ref.i];
  if (alvo.dataset.campo === 'data') {
    u.data = alvo.value;
    alvo.removeAttribute('aria-invalid');
    conferido(ref.i, 'data');
    const dica = $('.uso-dica', ref.box);
    dica.innerHTML = dicaUso(u.data);
    dica.classList.toggle('alerta', alertaUso(u.data));
  } else if (alvo.dataset.campo === 'acessos') {
    u.acessos = parseInt(alvo.value, 10) || '';
    alvo.removeAttribute('aria-invalid');
    conferido(ref.i, 'acessos');
  } else if (alvo.dataset.campo === 'aero') {
    $('[data-chips]', ref.box).classList.remove('invalido');
    conferido(ref.i, 'aero');
    const v = alvo.value.trim().toUpperCase();
    if (/[,;]$/.test(alvo.value) || (ev.inputType === 'insertReplacementText' && NOME_AEROPORTO[v])) {
      if (addAeroporto(ref.i, alvo.value)) redesenharChips(ref.i, true);
    }
  }
});

fUsos.addEventListener('keydown', ev => {
  const alvo = ev.target;
  if (alvo.dataset.campo !== 'aero') return;
  const ref = usoDe(alvo);
  if (ev.key === 'Enter') {
    ev.preventDefault();
    if (addAeroporto(ref.i, alvo.value)) redesenharChips(ref.i, true);
  } else if (ev.key === 'Backspace' && !alvo.value && F.usos[ref.i].aeroportos.length) {
    F.usos[ref.i].aeroportos.pop();
    conferido(ref.i, 'aero');
    redesenharChips(ref.i, true);
  }
});

fUsos.addEventListener('focusout', ev => {
  const alvo = ev.target;
  if (redesenhando || alvo.dataset.campo !== 'aero' || !alvo.value.trim()) return;
  const ref = usoDe(alvo);
  if (addAeroporto(ref.i, alvo.value)) redesenharChips(ref.i, false);
});

fUsos.addEventListener('click', ev => {
  const ref = usoDe(ev.target);
  if (!ref) return;
  const tirar = ev.target.closest('[data-tirar]');
  const passo = ev.target.closest('[data-passo]');
  if (tirar) {
    F.usos[ref.i].aeroportos.splice(+tirar.dataset.tirar, 1);
    conferido(ref.i, 'aero');
    redesenharChips(ref.i, true);
  } else if (passo) {
    const u = F.usos[ref.i];
    u.acessos = Math.min(99, Math.max(1, (parseInt(u.acessos, 10) || 0) + +passo.dataset.passo));
    $('[data-campo=acessos]', ref.box).value = u.acessos;
    conferido(ref.i, 'acessos');
  } else if (ev.target.closest('[data-remover]')) {
    colherPendentes();
    F.usos.splice(ref.i, 1);
    renderUsos();
  } else if (ev.target.closest('[data-chips]') && !ev.target.closest('.chip')) {
    $('[data-campo=aero]', ref.box).focus();
  }
});

$('#f-add').addEventListener('click', () => {
  colherPendentes();
  const ultimo = F.usos[F.usos.length - 1];
  F.usos.push({ id: '', data: '', aeroportos: ultimo ? ultimo.aeroportos.slice().reverse() : [], acessos: ultimo ? ultimo.acessos : 1 });
  renderUsos();
  const novo = $(`.uso[data-i="${F.usos.length - 1}"] [data-campo=data]`, fUsos);
  if (novo) novo.focus();
});

function erroForm(msg) { const el = $('#f-erro'); el.textContent = msg; el.hidden = !msg; }

function validarForm() {
  let primeiro = null;
  const marcar = el => { el.setAttribute('aria-invalid', 'true'); if (!primeiro) primeiro = el; };
  const cliente = $('#f-cliente');
  if (!cliente.value.trim()) marcar(cliente);
  fUsos.querySelectorAll('.uso').forEach((box, i) => {
    const u = F.usos[i];
    const pendente = $('[data-campo=aero]', box).value;
    if (pendente.trim() && addAeroporto(i, pendente)) redesenharChips(i, false);
    if (!u.data) marcar($('[data-campo=data]', box));
    if (!u.aeroportos.length) { $('[data-chips]', box).classList.add('invalido'); if (!primeiro) primeiro = $('[data-campo=aero]', box); }
    if (!(u.acessos >= 1 && u.acessos <= 99)) marcar($('[data-campo=acessos]', box));
  });
  const valor = $('#f-valor');
  const valorRuim = Number.isNaN(lerValorCampo(valor.value));
  if (valorRuim) marcar(valor);
  if (primeiro) {
    erroForm(valorRuim && primeiro === valor
      ? 'O valor da sala VIP não ficou claro. Use, por exemplo, 450 ou 450,00.'
      : 'Preencha os campos marcados: cliente, data, pelo menos um aeroporto e de 1 a 99 acessos.');
    primeiro.focus();
    return false;
  }
  return true;
}

$('#form').addEventListener('input', () => erroForm(''));
$('#f-cliente').addEventListener('input', ev => ev.target.removeAttribute('aria-invalid'));

$('#form').addEventListener('submit', async ev => {
  ev.preventDefault();
  erroForm('');
  if (!validarForm()) return;
  const botao = $('#f-salvar');
  botao.disabled = true; botao.textContent = 'Salvando…';

  const usosCol = collection(db, 'usos');
  const emissao = F.emissao || doc(usosCol).id;
  const base = {
    emissao,
    cliente: $('#f-cliente').value.replace(/\s+/g, ' ').trim().slice(0, 120),
    contato: $('#f-contato').value.replace(/\s+/g, ' ').trim().slice(0, 120),
    obs: $('#f-obs').value.trim().slice(0, 500),
    atendente: $('#f-atendente').value.replace(/\s+/g, ' ').trim().slice(0, 60),
    valor: lerValorCampo($('#f-valor').value),
    atualizadoEm: serverTimestamp(),
    atualizadoPor: S.nome,
  };
  const lote = writeBatch(db);
  const ficam = new Set(F.usos.filter(u => u.id).map(u => u.id));
  F.originais.filter(id => !ficam.has(id)).forEach(id => lote.delete(doc(db, 'usos', id)));
  F.usos.forEach(u => {
    const campos = { ...base, data: u.data, emitirEm: vespera(u.data), aeroportos: u.aeroportos, acessos: Number(u.acessos) };
    if (u.id) lote.update(doc(db, 'usos', u.id), campos);
    else lote.set(doc(usosCol), { ...campos, status: 'Pendente', criadoEm: serverTimestamp() });
  });

  const nova = !F.emissao;
  try {
    const r = await comPrazo(lote.commit());
    dlg.close();
    toast(r === 'pendente' ? 'Salvo neste computador. Sobe para todos quando a internet voltar.' : nova ? 'Emissão cadastrada.' : 'Emissão atualizada.');
  } catch (e) {
    erroForm(traduzirErro(e));
  } finally {
    botao.disabled = false; botao.textContent = 'Salvar emissão';
  }
});

function desarmarExcluir() {
  clearTimeout(armarTimer);
  const b = $('#f-excluir');
  b.classList.remove('armado');
  b.textContent = 'Excluir emissão';
  b.disabled = false;
}

$('#f-excluir').addEventListener('click', async ev => {
  const b = ev.currentTarget;
  if (!b.classList.contains('armado')) {
    b.classList.add('armado');
    b.textContent = 'Clique de novo para excluir';
    armarTimer = setTimeout(desarmarExcluir, 4000);
    return;
  }
  clearTimeout(armarTimer);
  b.disabled = true; b.textContent = 'Excluindo…';
  const lote = writeBatch(db);
  F.originais.forEach(id => lote.delete(doc(db, 'usos', id)));
  try {
    await comPrazo(lote.commit());
    dlg.close();
    toast('Emissão excluída.');
  } catch (e) {
    erroForm(traduzirErro(e));
    desarmarExcluir();
  }
});

/* ═════════════════ Diálogos ═════════════════ */

dlg.addEventListener('click', ev => { if (ev.target.closest('[data-fechar]')) dlg.close(); });
dlg.addEventListener('close', () => { F = null; });
$('#lista-aeroportos').innerHTML = AEROPORTOS.map(([c, n]) => `<option value="${c}" label="${esc(n)}"></option>`).join('');

/* ═════════════════ Início ═════════════════ */
montar();
ouvirUsos();
agendarRender();

return function desmontar() {
  pararTudo();
  clearInterval(relogio);
  clearTimeout(toastTimer);
  clearTimeout(armarTimer);
  window.removeEventListener('online', aoOnline);
  window.removeEventListener('offline', aoOffline);
  root.innerHTML = '';
};
}
