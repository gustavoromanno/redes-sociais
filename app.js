const PID = document.body.dataset.painel;
const P = PAINEIS[PID];
const KEY = 'rs-' + PID;
const GRUPOS = Object.keys(P.grupos);
let db = migrar(JSON.parse(localStorage.getItem(KEY) || 'null'));
let metr = { perfis: {} };
let sha = null, filtro = 'todos', semana = segundaPadrao(), mes = primeiroDoMes(new Date()), periodo = 7, feedPerfil = null, timer;
let pagina = location.hash.slice(1) || 'visao';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function primeiroDoMes(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function segundaPadrao() {
  const d = new Date(), w = d.getDay();
  d.setDate(d.getDate() + (w === 0 ? 1 : w >= 5 ? 8 - w : 1 - w));
  return ymd(d);
}
function migrar(d) {
  d ||= { atualizado: 0, pautas: [] };
  d.tarefas ||= []; d.reunioes ||= []; d.respostas ||= []; d.linha ||= {};
  d.pautas.forEach(p => { p.etapa ||= p.dia ? 'producao' : 'pauta'; p.grupo ||= GRUPOS[0]; p.destinos ||= {}; p.feito ||= {}; });
  return d;
}

const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const STATUS = { rascunho: 'Rascunho', aprovado: 'Aprovado', agendado: 'Agendado', aguardando: 'Aguardando confirmação', publicado: 'Publicado', falhou: 'Falhou', manual: 'Manual — pronto p/ postar' };
const ETAPAS = { pauta: 'Pauta', producao: 'Produção', revisao: 'Revisão', aprovado: 'Aprovado', agendado: 'Agendado', publicado: 'Publicado' };
const novoDestino = () => ({ legenda: '', cta: '', capa: '', status: 'rascunho', link: '' });

const diasSemana = () => { const [y, m, d] = semana.split('-').map(Number); return [0, 1, 2, 3, 4].map(i => ymd(new Date(y, m - 1, d + i))); };
const quando = p => new Date(`${p.dia}T${p.hora || '00:00'}:00-03:00`);
const dataCurta = dia => dia ? `${dia.slice(8)}/${dia.slice(5, 7)}` : 'sem data';
const fmt = p => p.dia ? `${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(p.dia + 'T12:00').getDay()]} ${dataCurta(p.dia)} às ${p.hora || '--:--'} (Brasília)` : 'sem data';
const marcaDe = p => MARCAS[p.grupo];
const grupoNome = p => PID === 'afiliados' ? (p.produto || 'Sem produto') : marcaDe(p).nome;
const visiveis = () => db.pautas.filter(p => filtro === 'todos' || p.grupo === filtro);
const daSemana = () => visiveis().filter(p => diasSemana().includes(p.dia)).sort((a, b) => quando(a) - quando(b));
const perfisDoPainel = () => [...new Set(GRUPOS.filter(g => filtro === 'todos' || g === filtro).flatMap(g => P.grupos[g]))];
const ponto = p => `<i class="dot" style="background:${marcaDe(p).cor}"></i>`;

function modo(pid, p) {
  const f = PERFIS[pid];
  if (f.integ === 'pendente') return { t: 'pendente', txt: 'Perfil a identificar' };
  if (f.rede === 'TikTok' && p.vitrine) return { t: 'manual', txt: 'Manual: vincular produto no app do TikTok' };
  if (f.integ === 'manual') return { t: 'manual', txt: 'Manual: você posta' };
  if (!f.conectado) return { t: 'conexao', txt: 'Depende de conexão no Metricool' };
  return { t: 'auto', txt: 'Automático (Metricool)' };
}
function conflitos(p) {
  const ids = Object.keys(p.destinos);
  return ids.flatMap(id => (PERFIS[id].compartilhaEm || []).filter(o => ids.includes(o))
    .map(o => `${PERFIS[id].nome} já compartilha em ${PERFIS[o].nome} — remova um dos dois.`));
}
function faltas(p) {
  const f = [];
  if (!Object.keys(p.destinos).length) f.push('escolher onde sai');
  if (!p.hora) f.push('definir horário');
  if (!p.feito.roteiro) f.push('roteiro');
  if (!p.video) f.push('subir vídeo');
  if (Object.values(p.destinos).some(d => !d.legenda)) f.push('legenda');
  if (!p.feito.revisado) f.push('revisar');
  return f;
}
const pronto = (p, id) => p.video && p.hora && p.destinos[id].legenda && !conflitos(p).length && modo(id, p).t !== 'pendente';
function alertas() {
  const agora = new Date(), out = [];
  daSemana().forEach(p => Object.entries(p.destinos).forEach(([id, d]) => {
    const r = `${p.titulo} · ${PERFIS[id].nome} · ${fmt(p)}`;
    if (d.status === 'falhou') out.push(['erro', `Falhou: ${r}${d.obs ? ' — ' + d.obs : ''}`]);
    else if (quando(p) < agora && ['aprovado', 'agendado'].includes(d.status)) out.push(['erro', `Atrasado: ${r}`]);
    else if (d.status === 'aguardando') out.push(['manual', `Aguardando confirmação: ${r}${d.obs ? ' — ' + d.obs : ''}`]);
    else if (d.status === 'manual' && quando(p) - agora < 864e5) out.push(['manual', `Ação manual: ${r}`]);
    else if (d.status === 'rascunho' && quando(p) > agora && quando(p) - agora < 864e5) out.push(['manual', `Não aprovado: ${r}`]);
    if (d.check && d.check.ok === false) out.push(['erro', `Fiscal: ${r} — ${d.check.txt}`]);
  }));
  return out;
}

// ---------- persistência ----------
function salvar(render = true) {
  db.atualizado = Date.now();
  localStorage.setItem(KEY, JSON.stringify(db));
  if (localStorage.getItem('rs-token')) { clearTimeout(timer); timer = setTimeout(enviar, 1500); }
  if (render) desenhar();
}
const repo = () => `${location.hostname.split('.')[0]}/${location.pathname.split('/')[1]}`;
const api = (method, body) => fetch(`https://api.github.com/repos/${repo()}/contents/${P.arquivo}`, {
  method, cache: 'no-store',
  headers: { Authorization: `Bearer ${localStorage.getItem('rs-token')}`, Accept: 'application/vnd.github+json' },
  body: body && JSON.stringify(body),
});
async function baixar() {
  try {
    let remoto;
    if (localStorage.getItem('rs-token')) {
      const r = await api('GET'); if (!r.ok) throw r.status;
      const j = await r.json(); sha = j.sha;
      remoto = JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g, '')))));
    } else remoto = await (await fetch(`${P.arquivo}?${Date.now()}`)).json();
    if ((remoto.atualizado || 0) > db.atualizado) { db = migrar(remoto); localStorage.setItem(KEY, JSON.stringify(db)); }
    aviso('');
  } catch (e) { aviso(`Não consegui ler ${P.arquivo} do GitHub (${e}). Usando a cópia deste aparelho.`); }
  try { metr = await (await fetch(`data/metricas.json?${Date.now()}`)).json(); } catch { }
  desenhar();
}
async function enviar() {
  const r = await api('PUT', { message: `painel: atualiza ${P.arquivo}`, sha, content: btoa(unescape(encodeURIComponent(JSON.stringify(db, null, 1)))) });
  if (r.ok) { sha = (await r.json()).content.sha; aviso(''); }
  else if (r.status === 409 || r.status === 422) aviso('O arquivo mudou no GitHub (status das publicações). Recarregue em Sincronização antes de continuar.', true);
  else aviso(`Falha ao salvar no GitHub (${r.status}). Confira o token em Sincronização.`, true);
}
function aviso(txt, erro) { const a = $('#aviso'); a.textContent = txt; a.className = txt ? (erro ? 'aviso erro' : 'aviso') : 'hide'; }

// ---------- ícones ----------
const ICO = {
  visao: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', tarefas: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  cronograma: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4', banco: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z',
  producao: 'M3 3h5v18H3zM10 3h5v12h-5zM17 3h4v8h-4z', planejar: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  revisar: 'M20 6 9 17l-5-5', fiscal: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2', feed: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  instagram: 'M4 20V10M10 20V4M16 20v-8M22 20H2', tiktok: 'M4 20V10M10 20V4M16 20v-8M22 20H2', reunioes: 'M2 7h14v10H2zM16 10l6-3v10l-6-3',
  whatsapp: 'M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z', ingles: 'M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
  contas: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1', sync: 'M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M3 21v-5h5',
};
const ico = k => `<svg viewBox="0 0 24 24" class="ico"><path d="${ICO[k]}"/></svg>`;

const MENU = [
  ['Geral', [['visao', 'Visão geral'], ['tarefas', 'Tarefas e anotações'], ['cronograma', 'Cronograma'], ['banco', 'Banco de pautas'], ['producao', 'Produção'], ['feed', 'Prévia do feed']]],
  ['Rotina', [['planejar', 'Sexta · Planejar semana'], ['revisar', 'Sábado · Revisar e agendar'], ['fiscal', 'Semana · Fiscal de post']]],
  ['Análise', [['instagram', 'Instagram'], ['tiktok', 'TikTok']]],
  ['Próximas etapas', [['reunioes', 'Reuniões'], ['whatsapp', 'WhatsApp'], ['ingles', 'Versão em inglês']]],
  ['Contas', [['contas', 'Conectar redes'], ['sync', 'Sincronização']]],
];

// ---------- render ----------
function desenhar() {
  const tema = MARCAS[filtro === 'todos' ? GRUPOS[0] : filtro];
  document.documentElement.style.setProperty('--marca', tema.cor);
  document.documentElement.style.setProperty('--marca2', tema.cor2);
  document.documentElement.style.setProperty('--claro', tema.claro);
  const badge = {
    banco: visiveis().filter(p => p.etapa === 'pauta').length,
    revisar: daSemana().flatMap(p => Object.values(p.destinos)).filter(d => d.status === 'rascunho').length,
    fiscal: alertas().length, tarefas: db.tarefas.filter(t => !t.feito && t.tipo !== 'ideia').length,
  };
  $('#menu').innerHTML = MENU.map(([sec, itens]) => `<div class="sec">${sec}</div>` + itens.map(([k, n]) =>
    `<a href="#${k}" class="${pagina === k ? 'on' : ''}">${ico(k)}<span>${n}</span>${badge[k] ? `<b class="badge">${badge[k]}</b>` : ''}</a>`).join('')).join('');
  $('#conteudo').innerHTML = (PAGINAS[pagina] || PAGINAS.visao)();
}

function cabeca(eyebrow, titulo, lead, extra = '') {
  const filtros = PID === 'marcas' ? `<div class="seg">${['todos', ...GRUPOS].map(g => `<button data-filtro="${g}" class="${filtro === g ? 'on' : ''}">${g === 'todos' ? 'Todos' : MARCAS[g].nome}</button>`).join('')}</div>` : '';
  return `<header class="cabeca"><div><div class="eyebrow">${P.titulo} · ${eyebrow}</div><h1>${titulo}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div><div class="acoes">${filtros}${extra}</div></header>`;
}
const navSemana = () => `<div class="seg"><button data-sem="-1">‹</button><button class="on">Semana ${dataCurta(diasSemana()[0])} a ${dataCurta(diasSemana()[4])}</button><button data-sem="1">›</button></div>`;
const selGrupo = (nome = 'grupo', val) => PID === 'afiliados' ? '' : `<label>Marca<select name="${nome}">${GRUPOS.map(g => `<option value="${g}" ${(val || (filtro === 'todos' ? GRUPOS[0] : filtro)) === g ? 'selected' : ''}>${MARCAS[g].nome}</option>`).join('')}</select></label>`;
const selFormato = (val) => `<label>Formato<select name="formato">${FORMATOS.map(f => `<option ${val === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>`;
const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };

function somaMetricas(ids, dias) {
  const r = { seguidores: 0, novos: 0, deixaram: 0, alcance: 0, visualizacoes: 0, interacoes: 0, serie: [] , tem: false };
  ids.forEach(id => {
    const m = metr.perfis?.[id]; if (!m) return; r.tem = true;
    r.seguidores += m.seguidores || 0;
    const s = (m.serie || []).slice(-dias);
    s.forEach((x, i) => {
      r.novos += x.novos || 0; r.deixaram += x.deixaram || 0; r.alcance += x.alcance || 0; r.visualizacoes += x.visualizacoes || 0; r.interacoes += x.interacoes || 0;
      r.serie[i] = (r.serie[i] || 0) + (x.alcance || 0);
    });
  });
  r.engajamento = r.alcance ? (r.interacoes / r.alcance * 100).toFixed(1).replace('.', ',') + '%' : '—';
  return r;
}
const num = n => n >= 1000 ? (n / 1000).toFixed(n >= 1e4 ? 0 : 1).replace('.', ',') + ' mil' : String(n);
function linhaSvg(serie, w = 340, h = 70) {
  if (serie.length < 2) return '';
  const max = Math.max(...serie, 1), pts = serie.map((v, i) => `${(i / (serie.length - 1) * w).toFixed(1)},${(h - v / max * (h - 6)).toFixed(1)}`);
  return `<svg viewBox="0 0 ${w} ${h}" class="spark"><path d="M0,${h} L${pts.join(' L')} L${w},${h}Z" class="area"/><path d="M${pts.join(' L')}" class="linha"/></svg>`;
}

function miniCal() {
  const y = mes.getFullYear(), m = mes.getMonth(), ini = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate();
  const comPost = new Set(visiveis().map(p => p.dia));
  const hoje = ymd(new Date());
  let cells = Array(ini).fill('<span></span>').join('');
  for (let d = 1; d <= n; d++) { const k = ymd(new Date(y, m, d)); cells += `<a href="#cronograma" class="${k === hoje ? 'hoje' : ''}">${d}${comPost.has(k) ? '<i></i>' : ''}</a>`; }
  return `<div class="card"><div class="calhead"><button class="seta" data-mes="-1">‹</button><span class="pill">${MESES[m]} ${y}</span><button class="seta" data-mes="1">›</button></div>
    <div class="minical">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(x => `<b>${x}</b>`).join('')}${cells}</div>
    <button class="btn full" data-acao="nova">+ Nova pauta</button></div>`;
}

const PAGINAS = {
  visao() {
    const hoje = ymd(new Date());
    const hojeP = visiveis().filter(p => p.dia === hoje);
    const emRevisao = visiveis().filter(p => p.etapa === 'revisao').length;
    const m = somaMetricas(perfisDoPainel(), periodo);
    const conta = e => visiveis().filter(p => p.etapa === e).length;
    const tabs = `<div class="tabs">${[7, 14, 30].map(d => `<button data-periodo="${d}" class="${periodo === d ? 'on' : ''}">${d} dias</button>`).join('')}</div>`;
    const sem = (txt) => `<p class="vazio">${txt}</p><a class="btn ghost" href="#contas">Conectar redes →</a>`;
    return cabeca('Visão geral', `${saudacao()}, Gustavo.`,
      `${hojeP.length ? hojeP.length + ' publicações hoje' : 'Nada marcado para hoje'} e ${emRevisao} conteúdo${emRevisao === 1 ? '' : 's'} esperando revisão.`,
      `<button class="btn" data-acao="nova">+ Nova pauta</button>`) + `
    <div class="grid-visao">
      <div class="card escuro"><div class="cardhead"><h3>Seguidores</h3>${tabs}</div>
        ${m.tem ? `<div class="big">${num(m.seguidores)} <small>+${m.novos}</small></div><div class="sub">total hoje · novos em ${periodo} dias</div><div class="big2">−${m.deixaram}</div><div class="sub">deixaram de seguir</div>` : sem('Os números chegam quando as redes estiverem conectadas no Metricool.')}
      </div>
      <div class="card claro"><div class="cardhead"><h3>Alcance</h3>${tabs}</div>
        ${m.tem ? `<div class="kpis"><div><b>${num(m.alcance)}</b><span>contas alcançadas</span></div><div><b>${m.engajamento}</b><span>engajamento</span></div><div><b>${num(m.interacoes)}</b><span>interações</span></div></div><div class="big2">${num(m.visualizacoes)}</div><div class="sub">visualizações</div>${linhaSvg(m.serie)}` : sem('Alcance, engajamento e visualizações aparecem aqui.')}
      </div>
      <div class="col-dir">
        <div class="card"><div class="cardhead"><h3>Para fazer</h3><a href="#tarefas">Abrir →</a></div>
          ${db.tarefas.filter(t => !t.feito && t.tipo !== 'ideia').slice(0, 4).map(t => `<label class="chk"><input type="checkbox" data-tarefa="${t.id}"> ${esc(t.txt)}</label>`).join('') || '<p class="vazio">Tudo feito por aqui.</p>'}
        </div>
        ${miniCal()}
      </div>
      <div class="card"><div class="cardhead"><h3>Fluxo da semana</h3><a href="#producao">Abrir produção →</a></div>
        <div class="kpis">${['pauta', 'producao', 'revisao', 'aprovado'].map(e => `<div><b>${conta(e)}</b><span><i class="dot e-${e}"></i>${ETAPAS[e]}</span></div>`).join('')}</div>
      </div>
      <div class="card"><div class="cardhead"><h3>Hoje</h3><a href="#fiscal">Fiscal de post →</a></div>
        ${hojeP.flatMap(p => Object.entries(p.destinos).map(([id, d]) => `<div class="li">${ponto(p)}<b>${p.hora}</b> ${esc(p.titulo)} <span class="muted">· ${PERFIS[id].rede}</span> <span class="st st-${d.status}">${STATUS[d.status]}</span></div>`)).join('') || '<p class="vazio">Sem posts hoje.</p>'}
        ${alertas().length ? `<a class="alerta erro" href="#fiscal">${alertas().length} alerta(s) no fiscal de post →</a>` : ''}
      </div>
    </div>`;
  },

  tarefas() {
    const bloco = (titulo, lista, tipo) => `<div class="card"><h3>${titulo} <span class="muted">${lista.length}</span></h3>
      ${lista.map(t => `<div class="li tarefa ${t.feito ? 'feito' : ''}">${tipo !== 'ideia' ? `<input type="checkbox" data-tarefa="${t.id}" ${t.feito ? 'checked' : ''}>` : '•'} <span>${esc(t.txt)}</span>${t.dia ? `<span class="muted">${dataCurta(t.dia)}</span>` : ''}<button class="x" data-acao="apagar-tarefa" data-tid="${t.id}">×</button></div>`).join('') || '<p class="vazio">Nada aqui.</p>'}</div>`;
    return cabeca('Tarefas e anotações', 'Tarefas e anotações.', 'O que falta fazer, o que já foi e as ideias soltas para não perder.') + `
    <form class="card form-linha" data-form="tarefa"><label class="cresce">Nova tarefa ou ideia<input name="txt" required placeholder="Ex.: gravar bastidor do painel de estoque"></label>
      <label>Tipo<select name="tipo"><option value="tarefa">Para fazer</option><option value="ideia">Ideia ou anotação</option></select></label><label>Prazo<input type="date" name="dia"></label><button class="btn">Adicionar</button></form>
    ${bloco('Para fazer', db.tarefas.filter(t => !t.feito && t.tipo !== 'ideia'))}
    ${bloco('Feitos', db.tarefas.filter(t => t.feito))}
    ${bloco('Ideias e anotações', db.tarefas.filter(t => t.tipo === 'ideia' && !t.feito), 'ideia')}`;
  },

  cronograma() {
    const y = mes.getFullYear(), m = mes.getMonth(), ini = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate(), hoje = ymd(new Date());
    let cells = '';
    for (let i = 0; i < ini; i++) cells += '<div class="dia fora"></div>';
    for (let d = 1; d <= n; d++) {
      const k = ymd(new Date(y, m, d));
      const ps = visiveis().filter(p => p.dia === k).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
      const reun = db.reunioes.filter(r => r.dia === k);
      cells += `<div class="dia ${k === hoje ? 'hoje' : ''}" data-novo-dia="${k}"><span class="n">${d}</span>
        ${ps.map(p => `<button class="evento e-${p.etapa}" data-abrir="${p.id}">${ponto(p)}<b>${p.hora || ''}</b> ${esc(p.titulo)}</button>`).join('')}
        ${reun.map(r => `<div class="evento reun">▣ ${esc(r.cliente)}</div>`).join('')}</div>`;
    }
    return cabeca('Cronograma', `${MESES[m][0].toUpperCase() + MESES[m].slice(1)} de ${y}.`, `${visiveis().filter(p => p.dia?.startsWith(ymd(mes).slice(0, 7))).length} conteúdos planejados. Clique em um dia vazio para criar uma pauta nele.`,
      `<div class="seg"><button data-mes="-1">‹</button><button data-acao="mes-hoje">Hoje</button><button data-mes="1">›</button></div>`) + `
    <div class="legenda">${Object.entries(ETAPAS).map(([k, v]) => `<span><i class="dot e-${k}"></i>${v}</span>`).join('')}${PID === 'marcas' ? GRUPOS.map(g => `<span><i class="dot" style="background:${MARCAS[g].cor}"></i>${MARCAS[g].nome}</span>`).join('') : ''}</div>
    <div class="cal"><div class="cal-h">${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map(x => `<b>${x}</b>`).join('')}</div><div class="cal-g">${cells}</div></div>`;
  },

  banco() {
    const banco = visiveis().filter(p => p.etapa === 'pauta');
    const grupos = {};
    banco.forEach(p => (grupos[grupoNome(p)] ??= []).push(p));
    if (PID === 'marcas') GRUPOS.filter(g => filtro === 'todos' || g === filtro).forEach(g => grupos[MARCAS[g].nome] ??= []);
    return cabeca('Banco de pautas', 'Banco de pautas.', `${banco.length} ideias guardadas${PID === 'afiliados' ? ', organizadas por produto' : ', separadas por marca'}. Quando uma pauta for para produção, ela segue para o quadro de Produção.`) + `
    <form class="card form-linha" data-form="pauta">
      <label class="cresce">${PID === 'afiliados' ? 'Vídeo' : 'Ideia de pauta'}<input name="titulo" required placeholder="${PID === 'afiliados' ? 'Ex.: POV camiseta oversized' : 'Ex.: Buckley separando contas PF e CNPJ'}"></label>
      ${PID === 'afiliados' ? '<label>Produto<input name="produto" required></label><label>Vitrine/link (opcional)<input name="vitrine" placeholder="TikTok Shop ou Shopee"></label>' : selGrupo()}
      ${selFormato()}<button class="btn">+ Adicionar pauta</button></form>
    ${Object.entries(grupos).map(([g, ps]) => { const cor = PID === 'marcas' ? MARCAS[GRUPOS.find(k => MARCAS[k].nome === g)].cor : MARCAS.wear.cor; return `
      <details class="acordeao" open><summary style="background:${cor}">${esc(g)} <span class="cont">${ps.length}</span></summary>
      ${ps.map(p => `<div class="li pauta"><span class="cresce">${esc(p.titulo)}${p.vitrine ? ' <span class="tag">vitrine</span>' : ''}${p.notas ? `<br><span class="muted">${esc(p.notas)}</span>` : ''}</span>
        <span class="muted">${esc(p.formato || '')}</span><span class="muted">${dataCurta(p.dia)}</span>
        <button class="link" data-abrir="${p.id}">Abrir</button><button class="btn ghost" data-acao="produzir" data-id="${p.id}">Produzir →</button></div>`).join('') || '<p class="vazio">Nenhuma pauta.</p>'}
      </details>`; }).join('')}`;
  },

  producao() {
    const cols = ['pauta', 'producao', 'revisao', 'aprovado', 'agendado', 'publicado'];
    return cabeca('Produção', 'Produção.', 'Cada conteúdo anda da pauta até o post publicado. Arraste os cards entre as etapas ou use a seta para avançar.') + `
    <div class="kanban">${cols.map(c => { const ps = visiveis().filter(p => p.etapa === c); return `
      <div class="coluna" data-col="${c}"><div class="colhead"><i class="dot e-${c}"></i>${ETAPAS[c]} <span class="muted">${ps.length}</span></div>
      ${ps.map(p => `<div class="card kcard" draggable="true" data-drag="${p.id}"><b>${esc(p.titulo)}</b>
        <div class="meta">${ponto(p)}${esc(grupoNome(p))} · ${esc(p.formato || '—')}</div><div class="meta">▢ ${fmt(p)}</div>
        <div class="kacoes"><button class="btn ghost" data-abrir="${p.id}">Abrir</button>${c !== 'publicado' ? `<button class="redondo" data-acao="avancar" data-id="${p.id}">→</button>` : ''}</div></div>`).join('') || '<p class="vazio">Arraste um card para cá.</p>'}</div>`; }).join('')}</div>`;
  },

  planejar() {
    const cand = visiveis().filter(p => !diasSemana().includes(p.dia) && ['pauta', 'producao', 'revisao'].includes(p.etapa));
    const sug = visiveis().filter(p => p.sugestao && diasSemana().includes(p.sugestao.dia));
    const semanaP = daSemana();
    return cabeca('Sexta · Planejar', 'Planejar semana.', 'Escolha as pautas de cada marca, o dia, o horário e onde cada uma sai. Depois veja o que falta preparar.', navSemana()) + `
    ${sug.length ? `<div class="card destaque"><h3>Sugestões do Claude para esta semana</h3>${sug.map(p => `<div class="li">${ponto(p)}<span class="cresce"><b>${esc(p.titulo)}</b> <span class="muted">${fmt(p.sugestao)} · ${(p.sugestao.destinos || []).map(id => PERFIS[id]?.rede).join(', ')}</span>${p.sugestao.motivo ? `<br><span class="muted">${esc(p.sugestao.motivo)}</span>` : ''}</span><button class="btn" data-acao="aceitar" data-id="${p.id}">Aceitar</button><button class="btn ghost" data-acao="recusar" data-id="${p.id}">Recusar</button></div>`).join('')}</div>` : ''}
    <section><h2>Semana</h2>
        <div class="grade5">${diasSemana().map((dia, i) => `<div><div class="colhead">${DIAS[i]} ${dataCurta(dia)}</div>
          ${semanaP.filter(p => p.dia === dia).map(p => `<div class="card mini">${ponto(p)}<b>${esc(p.titulo)}</b>
            <input type="time" data-campo="hora" data-id="${p.id}" value="${p.hora || ''}">
            ${P.grupos[p.grupo].map(id => `<label class="chk"><input type="checkbox" data-destino="${id}" data-id="${p.id}" ${p.destinos[id] ? 'checked' : ''}> ${esc(PERFIS[id].rede)} <span class="muted">${esc(PERFIS[id].nome.replace(PERFIS[id].rede + ' ', ''))}</span></label>`).join('')}
            ${conflitos(p).map(c => `<p class="erro">${esc(c)}</p>`).join('')}
            <button class="link" data-acao="tirar" data-id="${p.id}">Tirar da semana</button></div>`).join('')}</div>`).join('')}</div>
      </section>
    <h2>Falta produzir ou revisar</h2>
    ${semanaP.map(p => [p, faltas(p)]).filter(([, f]) => f.length).map(([p, f]) => `<div class="falta">${ponto(p)}<b>${esc(p.titulo)}</b> <span class="muted">${fmt(p)}</span> — ${f.join(', ')}</div>`).join('') || '<p class="vazio">Nada pendente nesta semana.</p>'}
    <div class="disp"><h2>Pautas disponíveis</h2>
        ${cand.map(p => `<div class="card"><div>${ponto(p)}<b>${esc(p.titulo)}</b> <span class="muted">${esc(grupoNome(p))} · ${esc(p.formato || '')} · ${ETAPAS[p.etapa]}</span></div>
          <div class="row"><select data-dia="${p.id}">${diasSemana().map((x, i) => `<option value="${x}">${DIAS[i]} ${dataCurta(x)}</option>`).join('')}</select>
          <input type="time" data-hora-banco="${p.id}" value="12:00"><button class="btn" data-acao="puxar" data-id="${p.id}">Pôr na semana</button></div></div>`).join('') || '<p class="vazio">Sem pautas no banco. Adicione em Banco de pautas.</p>'}</div>`;
  },

  revisar() {
    const ps = daSemana();
    const linhas = ps.flatMap(p => Object.keys(p.destinos).map(id => ({ p, id, m: modo(id, p), ok: pronto(p, id) })));
    const n = linhas.filter(l => l.ok && l.p.destinos[l.id].status === 'rascunho').length;
    return cabeca('Sábado · Revisar e agendar', 'Revisar e agendar.', 'Um vídeo por pauta, legenda, capa e CTA adaptados por rede. Confira a prévia e aprove o lote.', navSemana()) + `
    <div class="duas larga">
    <section>${ps.map(p => `
      <div class="card">
        <div class="cardhead"><div>${ponto(p)}<b>${esc(p.titulo)}</b> <span class="muted">${esc(grupoNome(p))} · ${fmt(p)}</span></div><div class="row">${p.arte ? `<a class="link" href="${esc(p.arte)}" target="_blank" rel="noopener">Artes →</a>` : ''}<button class="link" data-abrir="${p.id}">Abrir</button></div></div>
        ${p.vitrine ? `<p class="muted">Vitrine/link: ${esc(p.vitrine)}</p>` : ''}
        <label>Link do vídeo (sobe uma vez só)<input data-campo="video" data-id="${p.id}" value="${esc(p.video)}" placeholder="Google Drive público ou URL direta"></label>
        <div class="row">${['roteiro', 'gravado', 'revisado'].map(k => `<label class="chk"><input type="checkbox" data-feito="${k}" data-id="${p.id}" ${p.feito[k] ? 'checked' : ''}> ${k}</label>`).join('')}</div>
        ${conflitos(p).map(c => `<p class="erro">${esc(c)}</p>`).join('')}
        ${Object.keys(p.destinos).length > 1 ? `<button class="link" data-acao="replicar" data-id="${p.id}">Copiar legenda e CTA do 1º destino para os outros</button>` : ''}
        <div class="destinos">${Object.entries(p.destinos).map(([id, d]) => { const m = modo(id, p); return `
          <div class="destino">
            <div class="prevtopo"><b>${PERFIS[id].rede}</b> · ${esc(PERFIS[id].nome)}<br><span class="muted">${fmt(p)}</span><br><span class="modo ${m.t}">${m.txt}</span>
            ${PERFIS[id].rede === 'Instagram' && p.vitrine ? '<p class="muted">Link não fica clicável na legenda: use bio ou stories.</p>' : ''}</div>
            <textarea data-leg="${id}" data-id="${p.id}" placeholder="Legenda para ${PERFIS[id].rede}">${esc(d.legenda)}</textarea>
            <input data-cta="${id}" data-id="${p.id}" value="${esc(d.cta)}" placeholder="CTA">
            <input data-capa="${id}" data-id="${p.id}" value="${esc(d.capa)}" placeholder="Capa: link da imagem ou segundo do vídeo (ex.: 3s)">
            <div class="previa">${esc(d.legenda)}${d.cta ? '\n\n' + esc(d.cta) : ''}</div>
          </div>`; }).join('')}</div>
      </div>`).join('') || '<p class="vazio">Nenhuma pauta nesta semana. Planeje em Sexta · Planejar semana.</p>'}</section>
    <section><div class="card sticky"><h3>Aprovar lote</h3>
      <table>${linhas.map(l => `<tr class="${l.ok ? '' : 'nao'}"><td>${esc(l.p.titulo)}<br><span class="muted">${PERFIS[l.id].rede} · ${esc(PERFIS[l.id].nome)}</span><br><span class="muted">${fmt(l.p)}</span></td><td><span class="modo ${l.m.t}">${l.m.txt}</span>${l.ok ? '' : '<br><span class="erro">incompleto</span>'}<br><span class="st st-${l.p.destinos[l.id].status}">${STATUS[l.p.destinos[l.id].status]}</span></td></tr>`).join('')}</table>
      <p class="muted">Aprova só o que está completo. Automáticos viram "Aprovado" e o Claude agenda no Metricool quando você pedir <b>"agenda a semana aprovada"</b>. Manuais ou sem conexão ficam "Manual — pronto p/ postar".</p>
      <button class="btn full" data-acao="aprovar" ${n ? '' : 'disabled'}>Aprovar ${n} publicações</button></div></section>
    </div>`;
  },

  fiscal() {
    const ps = daSemana(), al = alertas();
    return cabeca('Semana · Fiscal de post', 'Fiscal de post.', 'O Claude confere os posts às 10h37, 18h37 e 22h37 (seg a sex): se saíram, se o link abre e se algo travou. Quebrou? Ele te avisa no celular.', navSemana()) + `
    <div class="kpis cards3">
      <div class="card"><span>Para publicar</span><b>${ps.flatMap(p => Object.values(p.destinos)).filter(d => ['aprovado', 'agendado', 'manual'].includes(d.status)).length}</b></div>
      <div class="card"><span>Publicados</span><b>${ps.flatMap(p => Object.values(p.destinos)).filter(d => d.status === 'publicado').length}</b></div>
      <div class="card"><span>Alertas</span><b>${al.length}</b></div></div>
    ${al.map(([t, x]) => `<div class="alerta ${t}">${esc(x)}</div>`).join('') || '<p class="vazio">Tudo em dia.</p>'}
    ${diasSemana().map((dia, i) => { const doDia = ps.filter(p => p.dia === dia); return doDia.length ? `<h2>${DIAS[i]} ${dataCurta(dia)}</h2>
      ${doDia.map(p => Object.entries(p.destinos).map(([id, d]) => `
        <div class="card linha">
          <div>${ponto(p)}<b>${p.hora}</b> ${esc(p.titulo)}<br><span class="muted">${esc(PERFIS[id].nome)}</span>${d.check ? `<br><span class="${d.check.ok ? 'ok' : 'erro'}">${d.check.ok ? '✓' : '✕'} ${esc(d.check.txt)}</span>` : ''}</div>
          <select data-status="${id}" data-id="${p.id}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${d.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <input data-link="${id}" data-id="${p.id}" value="${esc(d.link)}" placeholder="Link do post">
          <div class="row">${d.link ? `<a class="link" href="${esc(d.link)}" target="_blank" rel="noopener">abrir</a>` : ''}
          ${p.arte ? `<a class="link" href="${esc(p.arte)}" target="_blank" rel="noopener">artes</a>` : ''}${d.status === 'manual' ? `<button class="btn ghost" data-acao="copiar" data-id="${p.id}" data-d="${id}">Copiar legenda</button>${p.video ? `<a class="link" href="${esc(p.video)}" target="_blank" rel="noopener">baixar vídeo</a>` : ''}` : ''}</div>
        </div>`).join('')).join('')}` : ''; }).join('')}`;
  },

  feed() {
    const ids = perfisDoPainel().filter(id => ['Instagram', 'TikTok'].includes(PERFIS[id].rede));
    if (!ids.includes(feedPerfil)) feedPerfil = ids[0];
    const chave = ymd(mes).slice(0, 7);
    const ps = db.pautas.filter(p => p.destinos[feedPerfil] && p.dia?.startsWith(chave)).sort((a, b) => quando(b) - quando(a));
    const conta = e => ps.filter(p => p.etapa === e).length;
    const img = u => /^https?:.*\.(png|jpe?g|webp)(\?|$)/i.test(u || '');
    const f = PERFIS[feedPerfil];
    return cabeca('Prévia do feed', `Prévia do feed de ${MESES[mes.getMonth()]}.`, 'A grade do mês como vai aparecer no perfil, do mais recente ao mais antigo.',
      `<div class="seg"><button data-mes="-1">‹</button><button data-mes="1">›</button></div>`) + `
    <div class="seg abas-perfil">${ids.map(id => `<button data-feed="${id}" class="${id === feedPerfil ? 'on' : ''}">${esc(PERFIS[id].nome)}</button>`).join('')}</div>
    <div class="duas">
      <div class="card perfil"><div class="perfil-topo"><div class="avatar" style="background:${MARCAS[f.marca].cor}">${MARCAS[f.marca].nome[0]}</div><div><b>${esc(f.nome)}</b><br><span class="muted">${ps.length} no mês · ${num(metr.perfis?.[feedPerfil]?.seguidores || 0)} seguidores</span></div></div>
        <div class="grade-feed">${ps.map(p => { const d = p.destinos[feedPerfil]; return `<button class="tile" data-abrir="${p.id}" style="${img(d.capa) ? `background-image:url('${esc(d.capa)}')` : `background:${marcaDe(p).cor}`}"><span class="tile-tag">${dataCurta(p.dia)} · ${ETAPAS[p.etapa]}</span>${img(d.capa) ? '' : `<span class="tile-t">${esc(p.titulo)}</span>`}</button>`; }).join('') || '<p class="vazio">Nada planejado para este perfil no mês.</p>'}</div></div>
      <div><div class="card"><h3>${MESES[mes.getMonth()]} de ${mes.getFullYear()}</h3><div class="kpis"><div><b>${ps.length}</b><span>no mês</span></div><div><b>${conta('producao')}</b><span>em produção</span></div><div><b>${conta('revisao')}</b><span>em revisão</span></div><div><b>${conta('aprovado') + conta('agendado')}</b><span>aprovados</span></div><div><b>${conta('publicado')}</b><span>publicados</span></div></div></div>
        <div class="card"><h3>Linha editorial</h3><textarea data-linha="${feedPerfil}" placeholder="Tom, temas e o que não repetir neste perfil">${esc(db.linha[feedPerfil])}</textarea></div></div>
    </div>`;
  },

  instagram() { return analise('Instagram'); },
  tiktok() { return analise('TikTok'); },

  reunioes() {
    const clientes = [...new Set(db.reunioes.map(r => r.cliente))];
    return cabeca('Reuniões', 'Reuniões.', 'Pronto para quando você começar a ter reuniões: a ata vira tarefa e cada cliente ganha uma página com o que foi decidido e os próximos passos.') + `
    <div class="card destaque">Etapa futura — já dá para usar manualmente. Depois, o Claude pode ler a gravação ou a transcrição e preencher a ata sozinho.</div>
    <form class="card form-linha" data-form="reuniao"><label>Data<input type="date" name="dia" required></label><label class="cresce">Cliente<input name="cliente" required></label><label class="cresce">Assunto<input name="assunto"></label><button class="btn">+ Nova reunião</button></form>
    ${db.reunioes.slice().reverse().map(r => `<div class="card"><div class="cardhead"><b>${esc(r.cliente)} · ${dataCurta(r.dia)}</b><span class="muted">${esc(r.assunto)}</span></div>
      <div class="tres"><label>Ata<textarea data-reun="ata" data-rid="${r.id}">${esc(r.ata)}</textarea></label>
      <label>O que foi decidido<textarea data-reun="decidido" data-rid="${r.id}">${esc(r.decidido)}</textarea></label>
      <label>Próximos passos (um por linha)<textarea data-reun="passos" data-rid="${r.id}">${esc(r.passos)}</textarea></label></div>
      <button class="btn ghost" data-acao="passos" data-rid="${r.id}">Mandar próximos passos para Tarefas</button></div>`).join('')}
    ${clientes.length ? `<h2>Página do cliente</h2>${clientes.map(c => { const rs = db.reunioes.filter(r => r.cliente === c); return `<div class="card"><h3>${esc(c)}</h3><div class="duas"><div><b>O que foi decidido</b>${rs.map(r => `<p>${dataCurta(r.dia)} — ${esc(r.decidido || '—')}</p>`).join('')}</div><div><b>Próximos passos</b>${rs.flatMap(r => (r.passos || '').split('\n').filter(Boolean)).map(x => `<p>→ ${esc(x)}</p>`).join('') || '<p class="vazio">—</p>'}</div></div></div>`; }).join('')}` : ''}`;
  },

  whatsapp() {
    return cabeca('WhatsApp', 'Secretária de WhatsApp.', 'Ela lê, cruza com agenda e e-mail e deixa as respostas prontas — mas não manda nada sozinha.') + `
    <div class="card destaque">Etapa futura: precisa de uma conexão com o WhatsApp Business. Por enquanto, monte aqui a biblioteca de respostas prontas e copie com um clique.</div>
    <form class="card form-linha" data-form="resposta"><label>Título<input name="titulo" required placeholder="Ex.: orçamento de painel"></label><label class="cresce">Resposta<textarea name="texto" required></textarea></label><button class="btn">+ Salvar resposta</button></form>
    ${db.respostas.map(r => `<div class="card"><div class="cardhead"><b>${esc(r.titulo)}</b><div class="row"><button class="btn ghost" data-acao="copiar-resp" data-rid="${r.id}">Copiar</button><button class="x" data-acao="apagar-resp" data-rid="${r.id}">×</button></div></div><p class="pre">${esc(r.texto)}</p></div>`).join('')}`;
  },

  ingles() {
    const ps = visiveis().filter(p => p.etapa !== 'pauta');
    return cabeca('Versão em inglês', 'Mesmo vídeo, outro público.', 'Marque as pautas que ganham versão em inglês e deixe o roteiro pronto. A dublagem com a sua voz entra numa etapa futura.') + `
    ${ps.map(p => `<div class="card"><label class="chk">${ponto(p)}<input type="checkbox" data-campo-chk="en" data-id="${p.id}" ${p.en ? 'checked' : ''}> <b>${esc(p.titulo)}</b> <span class="muted">${fmt(p)}</span></label>
      ${p.en ? `<div class="duas"><label>Roteiro (PT)<textarea data-campo="roteiro" data-id="${p.id}">${esc(p.roteiro)}</textarea></label><label>Script (EN)<textarea data-campo="roteiroEn" data-id="${p.id}" placeholder="Peça ao Claude: traduz o roteiro da pauta '${esc(p.titulo)}'">${esc(p.roteiroEn)}</textarea></label></div>` : ''}</div>`).join('') || '<p class="vazio">Nenhuma pauta em produção ainda.</p>'}`;
  },

  contas() {
    const grupos = GRUPOS.filter(g => filtro === 'todos' || g === filtro);
    const sit = f => f.integ === 'pendente' ? ['pendente', 'Identificar perfil'] : f.integ === 'manual' ? ['manual', 'Manual por enquanto'] : f.conectado ? ['auto', 'Conectado'] : ['conexao', 'Falta conectar'];
    return cabeca('Contas', 'Conectar redes.', 'Cada marca conecta as próprias redes. Os botões abrem o Metricool na marca certa; depois me avise para eu marcar como conectado.') + `
    ${grupos.map(g => { const M = MARCAS[g], url = M.metricool ? `https://app.metricool.com/brands/connections?blogId=${M.metricool}` : 'https://app.metricool.com/'; return `
      <div class="card marca-bloco"><div class="marca-topo" style="background:${M.cor}"><b>${M.nome}</b><span>${M.metricool ? `Marca no Metricool #${M.metricool}` : 'Ainda sem marca no Metricool'}</span></div>
      ${M.metricool ? '' : `<p class="muted">O plano gratuito do Metricool tem só 1 marca (hoje usada pela Romanno). Para conectar ${M.nome}, é preciso um plano pago — até lá, os posts saem como manuais.</p>`}
      ${P.grupos[g].map(id => { const f = PERFIS[id], [c, t] = sit(f); return `<div class="li conta"><span class="rede r-${f.rede.toLowerCase()}">${f.rede[0]}</span><span class="cresce"><b>${f.rede}</b><br><span class="muted">${esc(f.nome)}${f.marca !== g ? ` · compartilhado com ${MARCAS[f.marca].nome}` : ''}</span></span>
        <span class="modo ${c}">${t}</span>
        <a class="btn ${M.metricool && f.marca === g ? '' : 'ghost'}" href="${f.marca === g ? url : '#contas'}" ${f.marca === g ? 'target="_blank" rel="noopener"' : ''}>${f.marca !== g ? 'Conectado pela ' + MARCAS[f.marca].nome : M.metricool ? 'Conectar no Metricool' : 'Criar marca no Metricool'}</a>
        <a class="link" href="${REDE_URL[f.rede]}" target="_blank" rel="noopener">abrir ${f.rede}</a></div>`; }).join('')}</div>`; }).join('')}
    <div class="card"><h3>O que cada integração faz</h3><ul>
      <li><b>Instagram</b> (conta profissional ligada a uma Página do Facebook): Reels, posts e stories com capa e legenda. Link de Shopee não fica clicável — vai na bio ou nos stories.</li>
      <li><b>TikTok</b>: vídeo com legenda e capa (capa personalizada só em conta Business). Produto do TikTok Shop não pode ser vinculado por agendamento: com vitrine, vira etapa manual no app.</li>
      <li><b>Facebook</b>: só Páginas (não perfil pessoal) — post, reel ou story.</li>
      <li><b>Threads</b>: texto com imagem ou vídeo.</li>
      <li><b>Plano gratuito do Metricool</b>: 1 marca, 1 perfil por rede e 20 publicações por mês. O que ficar de fora sai como manual.</li></ul></div>`;
  },

  sync() {
    return cabeca('Sincronização', 'Sincronização.', 'Sem token o painel só lê o repositório e guarda alterações neste aparelho.') + `
    <div class="card"><p>Com um token (fine-grained, só o repositório <code>redes-sociais</code>, permissão <b>Contents: Read and write</b>), o painel salva em <code>${P.arquivo}</code> e o Claude lê dali para agendar, conferir e devolver os status.</p>
      <p class="muted">GitHub → Settings → Developer settings → Fine-grained tokens. O token fica salvo só no navegador deste aparelho.</p>
      <div class="form-linha"><label class="cresce">Token<input id="token" type="password" placeholder="github_pat_…" value="${localStorage.getItem('rs-token') ? '••••••••' : ''}"></label><button class="btn" data-acao="token">Salvar token</button><button class="btn ghost" data-acao="recarregar">Recarregar do GitHub</button></div></div>`;
  },
};

function analise(rede) {
  const ids = perfisDoPainel().filter(id => PERFIS[id].rede === rede);
  const tabs = `<div class="tabs">${[7, 14, 30, 90].map(d => `<button data-periodo="${d}" class="${periodo === d ? 'on' : ''}">${d} dias</button>`).join('')}</div>`;
  return cabeca('Análise', `${rede}.`, `Os números chegam sozinhos: o Claude lê o Metricool todo dia e grava em data/metricas.json.${metr.atualizado ? ' Última leitura: ' + new Date(metr.atualizado).toLocaleString('pt-BR') + '.' : ''}`, tabs) +
    ids.map(id => {
      const m = metr.perfis?.[id], f = PERFIS[id];
      if (!m) return `<div class="card"><h3>${esc(f.nome)}</h3><p class="vazio">Sem dados ainda: este perfil precisa estar conectado no Metricool.</p><a class="btn" href="#contas">Conectar →</a></div>`;
      const s = somaMetricas([id], periodo), serie = (m.serie || []).slice(-periodo);
      const max = Math.max(...serie.map(x => x.visualizacoes || 0), 1);
      return `<div class="card"><h3>${esc(f.nome)}</h3><div class="kpis cards">
        ${[['Visualizações', num(s.visualizacoes)], ['Seguidores hoje', num(s.seguidores)], ['Novos seguidores', '+' + s.novos], ['Deixaram de seguir', s.deixaram], ['Interações', num(s.interacoes)], ['Engajamento', s.engajamento], ['Alcance', num(s.alcance)]].map(([k, v]) => `<div class="card"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
        <h3>Visualizações por dia</h3><div class="barras">${serie.map(x => `<div title="${x.dia}: ${x.visualizacoes || 0}"><i style="height:${(x.visualizacoes || 0) / max * 100}%"></i><span>${dataCurta(x.dia)}</span></div>`).join('')}</div></div>`;
    }).join('');
}

// ---------- modal da pauta ----------
function abrir(id) {
  const p = achar(id), d = $('#modal');
  d.innerHTML = `<form method="dialog" class="modal"><div class="cardhead"><h2>${esc(p.titulo)}</h2><button class="x">×</button></div>
    <div class="duas"><label>Título<input data-campo="titulo" data-id="${id}" value="${esc(p.titulo)}"></label>
    ${PID === 'afiliados' ? `<label>Produto<input data-campo="produto" data-id="${id}" value="${esc(p.produto)}"></label><label>Vitrine/link (opcional)<input data-campo="vitrine" data-id="${id}" value="${esc(p.vitrine)}"></label>` : `<label>Marca<select data-campo="grupo" data-id="${id}">${GRUPOS.map(g => `<option value="${g}" ${p.grupo === g ? 'selected' : ''}>${MARCAS[g].nome}</option>`).join('')}</select></label>`}
    <label>Formato<select data-campo="formato" data-id="${id}">${FORMATOS.map(f => `<option ${p.formato === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
    <label>Etapa<select data-campo="etapa" data-id="${id}">${Object.entries(ETAPAS).map(([k, v]) => `<option value="${k}" ${p.etapa === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>Dia<input type="date" data-campo="dia" data-id="${id}" value="${p.dia || ''}"></label><label>Hora (Brasília)<input type="time" data-campo="hora" data-id="${id}" value="${p.hora || ''}"></label></div>
    <label>Ideia / funcionalidade confirmada<textarea data-campo="notas" data-id="${id}">${esc(p.notas)}</textarea></label>
    <label>Roteiro<textarea data-campo="roteiro" data-id="${id}">${esc(p.roteiro)}</textarea></label>
    <label>Link do vídeo<input data-campo="video" data-id="${id}" value="${esc(p.video)}"></label>
    <label>Artes (link do design)<input data-campo="arte" data-id="${id}" value="${esc(p.arte)}"></label>${p.arte ? `<a class="link" href="${esc(p.arte)}" target="_blank" rel="noopener">Abrir artes →</a>` : ''}
    <div class="row"><button class="btn ghost" data-acao="apagar" data-id="${id}" type="button">Apagar pauta</button><button class="btn">Fechar</button></div></form>`;
  d.showModal();
}

// ---------- eventos ----------
const achar = id => db.pautas.find(p => p.id === id);
window.addEventListener('hashchange', () => { pagina = location.hash.slice(1) || 'visao'; desenhar(); scrollTo(0, 0); });
$('#modal').addEventListener('close', () => desenhar());

document.addEventListener('submit', e => {
  const tipo = e.target.dataset.form; if (!tipo) return;
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  if (tipo === 'pauta') db.pautas.push({ id: uid(), grupo: f.grupo || GRUPOS[0], titulo: f.titulo, produto: f.produto, vitrine: f.vitrine, formato: f.formato, etapa: 'pauta', dia: '', hora: '', video: '', feito: {}, destinos: {} });
  if (tipo === 'tarefa') db.tarefas.push({ id: uid(), txt: f.txt, tipo: f.tipo, dia: f.dia, feito: false });
  if (tipo === 'reuniao') db.reunioes.push({ id: uid(), ...f, ata: '', decidido: '', passos: '' });
  if (tipo === 'resposta') db.respostas.push({ id: uid(), ...f });
  salvar();
});

document.addEventListener('click', e => {
  const b = e.target.closest('button,[data-novo-dia]'); if (!b) return;
  const ds = b.dataset;
  if (ds.filtro) { filtro = ds.filtro; return desenhar(); }
  if (ds.sem) { const [y, m, d] = semana.split('-').map(Number); semana = ymd(new Date(y, m - 1, d + 7 * ds.sem)); return desenhar(); }
  if (ds.mes) { mes = new Date(mes.getFullYear(), mes.getMonth() + +ds.mes, 1); return desenhar(); }
  if (ds.periodo) { periodo = +ds.periodo; return desenhar(); }
  if (ds.feed) { feedPerfil = ds.feed; return desenhar(); }
  if (ds.abrir) { e.stopPropagation(); return abrir(ds.abrir); }
  if (ds.novoDia) { const p = nova(); p.dia = ds.novoDia; p.etapa = 'producao'; salvar(false); return abrir(p.id); }
  const p = achar(ds.id);
  switch (ds.acao) {
    case 'nova': return abrir(nova().id);
    case 'mes-hoje': mes = primeiroDoMes(new Date()); return desenhar();
    case 'produzir': p.etapa = 'producao'; return salvar();
    case 'avancar': { const ks = Object.keys(ETAPAS); p.etapa = ks[ks.indexOf(p.etapa) + 1]; return salvar(); }
    case 'puxar': p.dia = $(`[data-dia="${p.id}"]`).value; p.hora = $(`[data-hora-banco="${p.id}"]`).value; if (p.etapa === 'pauta') p.etapa = 'producao'; padraoDestinos(p); return salvar();
    case 'aceitar': Object.assign(p, { dia: p.sugestao.dia, hora: p.sugestao.hora }); if (p.etapa === 'pauta') p.etapa = 'producao';
      (p.sugestao.destinos || []).forEach(id => p.destinos[id] ||= novoDestino()); padraoDestinos(p); delete p.sugestao; return salvar();
    case 'recusar': delete p.sugestao; return salvar();
    case 'tirar': p.dia = ''; return salvar();
    case 'apagar': if (confirm('Apagar esta pauta?')) { db.pautas = db.pautas.filter(x => x !== p); $('#modal').close(); salvar(); } return;
    case 'replicar': { const [first, ...rest] = Object.values(p.destinos); rest.forEach(d => { d.legenda = first.legenda; d.cta = first.cta; }); return salvar(); }
    case 'aprovar': daSemana().forEach(p => { let algum = false; Object.entries(p.destinos).forEach(([id, d]) => {
        if (d.status === 'rascunho' && pronto(p, id)) { d.status = modo(id, p).t === 'auto' ? 'aprovado' : 'manual'; algum = true; } });
        if (algum && ['pauta', 'producao', 'revisao'].includes(p.etapa)) p.etapa = 'aprovado'; }); return salvar();
    case 'copiar': { const d = p.destinos[ds.d]; navigator.clipboard.writeText(d.legenda + (d.cta ? '\n\n' + d.cta : '')); b.textContent = 'Copiado!'; return; }
    case 'apagar-tarefa': db.tarefas = db.tarefas.filter(t => t.id !== ds.tid); return salvar();
    case 'passos': { const r = db.reunioes.find(r => r.id === ds.rid); (r.passos || '').split('\n').filter(Boolean).forEach(txt => db.tarefas.push({ id: uid(), txt: `${r.cliente}: ${txt}`, tipo: 'tarefa', feito: false })); location.hash = 'tarefas'; return salvar(); }
    case 'copiar-resp': navigator.clipboard.writeText(db.respostas.find(r => r.id === ds.rid).texto); b.textContent = 'Copiado!'; return;
    case 'apagar-resp': db.respostas = db.respostas.filter(r => r.id !== ds.rid); return salvar();
    case 'token': { const t = $('#token').value.trim(); if (t && !t.startsWith('••')) localStorage.setItem('rs-token', t); if (!t) localStorage.removeItem('rs-token'); return baixar(); }
    case 'recarregar': db.atualizado = 0; return baixar();
  }
});
function nova() { const p = { id: uid(), grupo: filtro === 'todos' ? GRUPOS[0] : filtro, titulo: 'Nova pauta', formato: FORMATOS[0], etapa: 'pauta', dia: '', hora: '', video: '', feito: {}, destinos: {} }; db.pautas.push(p); return p; }
function padraoDestinos(p) { if (!Object.keys(p.destinos).length) P.grupos[p.grupo].forEach(id => PERFIS[id].integ !== 'pendente' && (p.destinos[id] = novoDestino())); }

document.addEventListener('change', e => {
  const el = e.target, ds = el.dataset;
  if (ds.tarefa) { const t = db.tarefas.find(t => t.id === ds.tarefa); t.feito = el.checked; return salvar(); }
  if (ds.reun) { db.reunioes.find(r => r.id === ds.rid)[ds.reun] = el.value; return salvar(false); }
  if (ds.linha) { db.linha[ds.linha] = el.value; return salvar(false); }
  const p = achar(ds.id); if (!p) return;
  if (ds.campo) { p[ds.campo] = el.value; if (ds.campo === 'grupo') p.destinos = {}; }
  else if (ds.campoChk) p[ds.campoChk] = el.checked;
  else if (ds.destino) { if (el.checked) p.destinos[ds.destino] = novoDestino(); else delete p.destinos[ds.destino]; }
  else if (ds.feito) p.feito[ds.feito] = el.checked;
  else if (ds.leg) p.destinos[ds.leg].legenda = el.value;
  else if (ds.cta) p.destinos[ds.cta].cta = el.value;
  else if (ds.capa) p.destinos[ds.capa].capa = el.value;
  else if (ds.status) p.destinos[ds.status].status = el.value;
  else if (ds.link) p.destinos[ds.link].link = el.value;
  else return;
  salvar(!$('#modal').open && (el.type === 'checkbox' || el.tagName === 'SELECT'));
});
document.addEventListener('input', e => {
  const box = e.target.closest('.destino'); if (!box) return;
  const leg = box.querySelector('[data-leg]').value, cta = box.querySelector('[data-cta]').value;
  box.querySelector('.previa').textContent = leg + (cta ? '\n\n' + cta : '');
});
document.addEventListener('dragstart', e => { const c = e.target.closest('[data-drag]'); if (c) e.dataTransfer.setData('text/plain', c.dataset.drag); });
document.addEventListener('dragover', e => { if (e.target.closest('[data-col]')) e.preventDefault(); });
document.addEventListener('drop', e => {
  const col = e.target.closest('[data-col]'); if (!col) return;
  e.preventDefault(); const p = achar(e.dataTransfer.getData('text/plain')); if (p) { p.etapa = col.dataset.col; salvar(); }
});

desenhar();
baixar();
