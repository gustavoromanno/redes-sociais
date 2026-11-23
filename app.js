const PID = document.body.dataset.painel;
const P = PAINEIS[PID];
const KEY = 'rs-' + PID;
let db = JSON.parse(localStorage.getItem(KEY) || 'null') || { atualizado: 0, pautas: [] };
let sha = null, aba = 'planejar', filtro = 'todos', semana = segundaPadrao(), timer;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex'];
const STATUS = { rascunho: 'Rascunho', aprovado: 'Aprovado', agendado: 'Agendado', aguardando: 'Aguardando confirmação', publicado: 'Publicado', falhou: 'Falhou', manual: 'Manual — pronto p/ postar' };

function segundaPadrao() {
  const d = new Date(), w = d.getDay();
  d.setDate(d.getDate() + (w === 0 ? 1 : w >= 5 ? 8 - w : 1 - w));
  return ymd(d);
}
function diasSemana() {
  const [y, m, d] = semana.split('-').map(Number);
  return [0, 1, 2, 3, 4].map(i => ymd(new Date(y, m - 1, d + i)));
}
const quando = p => new Date(`${p.dia}T${p.hora || '00:00'}:00-03:00`);
const fmt = p => `${DIAS[diasSemana().indexOf(p.dia)] ?? ''} ${p.dia.slice(8)}/${p.dia.slice(5, 7)} às ${p.hora || '--:--'} (Brasília)`;
const grupoNome = p => P.grupos ? P.grupos[p.grupo].nome : p.produto || 'Sem produto';
const possiveis = p => P.grupos ? P.grupos[p.grupo].destinos : P.destinos;
const daSemana = () => db.pautas.filter(p => diasSemana().includes(p.dia) && (filtro === 'todos' || p.grupo === filtro)).sort((a, b) => quando(a) - quando(b));

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
  if (!p.feito?.roteiro) f.push('roteiro');
  if (!p.video) f.push('subir vídeo');
  if (Object.values(p.destinos).some(d => !d.legenda)) f.push('legenda');
  if (!p.feito?.revisado) f.push('revisar');
  return f;
}
const pronto = (p, id) => p.video && p.hora && p.destinos[id].legenda && !conflitos(p).length && modo(id, p).t !== 'pendente';

function salvar(render = true) {
  db.atualizado = Date.now();
  localStorage.setItem(KEY, JSON.stringify(db));
  if (localStorage.getItem('rs-token')) { clearTimeout(timer); timer = setTimeout(enviar, 1500); }
  if (render) desenhar();
}

// ---------- GitHub (data/*.json no próprio repositório) ----------
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
    } else {
      remoto = await (await fetch(`${P.arquivo}?${Date.now()}`)).json();
    }
    if ((remoto.atualizado || 0) > db.atualizado) { db = remoto; localStorage.setItem(KEY, JSON.stringify(db)); }
    aviso('');
  } catch (e) { aviso(`Não consegui ler ${P.arquivo} do GitHub (${e}). Usando a cópia deste aparelho.`); }
  desenhar();
}
async function enviar() {
  const r = await api('PUT', { message: `painel: atualiza ${P.arquivo}`, sha, content: btoa(unescape(encodeURIComponent(JSON.stringify(db, null, 1)))) });
  if (r.ok) { sha = (await r.json()).content.sha; aviso(''); }
  else if (r.status === 409 || r.status === 422) aviso('O arquivo mudou no GitHub (status das publicações). Clique em "Recarregar do GitHub" antes de continuar.', true);
  else aviso(`Falha ao salvar no GitHub (${r.status}). Confira o token em Contas.`, true);
}
function aviso(txt, erro) { const a = $('#aviso'); a.textContent = txt; a.className = txt ? (erro ? 'aviso erro' : 'aviso') : 'hide'; }

// ---------- telas ----------
function desenhar() {
  document.querySelectorAll('[data-aba]').forEach(b => b.classList.toggle('on', b.dataset.aba === aba));
  document.querySelectorAll('[data-filtro]').forEach(b => b.classList.toggle('on', b.dataset.filtro === filtro));
  const d = diasSemana();
  $('#semana').textContent = `Semana ${d[0].slice(8)}/${d[0].slice(5, 7)} a ${d[4].slice(8)}/${d[4].slice(5, 7)}`;
  $('#conteudo').innerHTML = { planejar, revisar, acompanhar, contas }[aba]();
}

function selGrupo() {
  return P.grupos
    ? `<select name="grupo">${Object.entries(P.grupos).map(([k, g]) => `<option value="${k}" ${filtro === k ? 'selected' : ''}>${g.nome}</option>`).join('')}</select>`
    : `<input name="produto" placeholder="Produto" required><input name="vitrine" placeholder="Vitrine/link (opcional): TikTok Shop ou Shopee">`;
}

function planejar() {
  const banco = db.pautas.filter(p => !p.dia && (filtro === 'todos' || p.grupo === filtro));
  const grupos = {};
  banco.forEach(p => (grupos[grupoNome(p)] ??= []).push(p));
  const semanaP = daSemana();
  return `
  <section class="col">
    <h2>${P.grupos ? 'Banco de pautas' : 'Vídeos por produto'}</h2>
    <form id="nova" class="card">
      ${selGrupo()}
      <input name="titulo" placeholder="${P.grupos ? 'Pauta (ex.: bastidor do painel de estoque)' : 'Vídeo (ex.: POV camiseta oversized)'}" required>
      <textarea name="notas" placeholder="Ideia, funcionalidade confirmada, roteiro…"></textarea>
      <button>Adicionar ao banco</button>
    </form>
    ${Object.entries(grupos).map(([g, ps]) => `<h3>${esc(g)}</h3>` + ps.map(p => `
      <div class="card">
        <b>${esc(p.titulo)}</b>${p.vitrine ? ' <span class="tag">vitrine</span>' : ''}
        <p class="muted">${esc(p.notas)}</p>
        <div class="row">
          <select data-dia="${p.id}">${diasSemana().map((x, i) => `<option value="${x}">${DIAS[i]} ${x.slice(8)}</option>`).join('')}</select>
          <input type="time" data-hora-banco="${p.id}" value="12:00">
          <button data-acao="puxar" data-id="${p.id}">Pôr na semana</button>
          <button class="sec" data-acao="apagar" data-id="${p.id}">Apagar</button>
        </div>
      </div>`).join('')).join('') || '<p class="muted">Banco vazio.</p>'}
  </section>
  <section class="col largo">
    <h2>Semana — escolha onde cada um sai</h2>
    <div class="grade">${diasSemana().map((dia, i) => `
      <div><h3>${DIAS[i]} ${dia.slice(8)}/${dia.slice(5, 7)}</h3>
      ${semanaP.filter(p => p.dia === dia).map(p => `
        <div class="card">
          <span class="tag">${esc(grupoNome(p))}</span> <b>${esc(p.titulo)}</b>
          <input type="time" data-campo="hora" data-id="${p.id}" value="${p.hora || ''}">
          ${possiveis(p).map(id => `<label class="chk"><input type="checkbox" data-destino="${id}" data-id="${p.id}" ${p.destinos[id] ? 'checked' : ''}> ${esc(PERFIS[id].nome)}</label>`).join('')}
          ${conflitos(p).map(c => `<p class="erro">${esc(c)}</p>`).join('')}
          <button class="sec" data-acao="banco" data-id="${p.id}">Voltar ao banco</button>
        </div>`).join('')}
      </div>`).join('')}
    </div>
    <h2>Falta produzir ou revisar</h2>
    ${semanaP.map(p => [p, faltas(p)]).filter(([, f]) => f.length).map(([p, f]) =>
      `<div class="falta"><b>${esc(p.titulo)}</b> <span class="muted">${fmt(p)}</span> — ${f.join(', ')}</div>`).join('') || '<p class="muted">Nada pendente nesta semana.</p>'}
  </section>`;
}

function revisar() {
  const ps = daSemana();
  const linhas = ps.flatMap(p => Object.keys(p.destinos).map(id => ({ p, id, m: modo(id, p), ok: pronto(p, id) })));
  return `
  <section class="col largo">
    <h2>Revisar: um vídeo por pauta, adaptação por rede</h2>
    ${ps.map(p => `
    <div class="card">
      <span class="tag">${esc(grupoNome(p))}</span> <b>${esc(p.titulo)}</b> <span class="muted">${fmt(p)}</span>
      ${p.vitrine ? `<p class="muted">Vitrine/link: ${esc(p.vitrine)}</p>` : ''}
      <input data-campo="video" data-id="${p.id}" value="${esc(p.video)}" placeholder="Link do vídeo (Google Drive público ou URL direta) — sobe uma vez só">
      <div class="row">${['roteiro', 'gravado', 'revisado'].map(k => `<label class="chk"><input type="checkbox" data-feito="${k}" data-id="${p.id}" ${p.feito?.[k] ? 'checked' : ''}> ${k}</label>`).join('')}</div>
      ${conflitos(p).map(c => `<p class="erro">${esc(c)}</p>`).join('')}
      ${Object.keys(p.destinos).length > 1 ? `<button class="sec" data-acao="replicar" data-id="${p.id}">Copiar legenda/CTA do 1º destino para os outros</button>` : ''}
      <div class="destinos">${Object.entries(p.destinos).map(([id, d]) => { const m = modo(id, p); return `
        <div class="destino">
          <div class="prev">
            <b>${PERFIS[id].rede}</b> · ${esc(PERFIS[id].nome)}<br><span class="muted">${fmt(p)}</span><br>
            <span class="modo ${m.t}">${m.txt}</span>
            ${PERFIS[id].rede === 'Instagram' && p.vitrine ? '<p class="muted">Link não fica clicável na legenda: use bio/stories.</p>' : ''}
          </div>
          <textarea data-leg="${id}" data-id="${p.id}" placeholder="Legenda para ${PERFIS[id].rede}">${esc(d.legenda)}</textarea>
          <input data-cta="${id}" data-id="${p.id}" value="${esc(d.cta)}" placeholder="CTA">
          <input data-capa="${id}" data-id="${p.id}" value="${esc(d.capa)}" placeholder="Capa: link da imagem ou segundo do vídeo (ex.: 3s)">
          <div class="previa">${esc(d.legenda)}${d.cta ? '\n\n' + esc(d.cta) : ''}</div>
        </div>`; }).join('')}</div>
    </div>`).join('') || '<p class="muted">Nenhuma pauta nesta semana. Planeje na aba Sexta.</p>'}
  </section>
  <section class="col">
    <h2>Aprovar lote</h2>
    <table>${linhas.map(l => `<tr class="${l.ok ? '' : 'nao'}"><td>${esc(l.p.titulo)}</td><td>${PERFIS[l.id].rede}<br><span class="muted">${esc(PERFIS[l.id].nome)}</span></td><td>${fmt(l.p)}</td><td><span class="modo ${l.m.t}">${l.m.txt}</span>${l.ok ? '' : '<br><span class="erro">incompleto</span>'}</td><td>${STATUS[l.p.destinos[l.id].status]}</td></tr>`).join('')}</table>
    <p class="muted">Aprova só o que está completo. Automáticos viram "Aprovado" e o Claude agenda no Metricool; manuais ou sem conexão ficam "Manual — pronto p/ postar".</p>
    <button data-acao="aprovar" ${linhas.some(l => l.ok) ? '' : 'disabled'}>Aprovar ${linhas.filter(l => l.ok && l.p.destinos[l.id].status === 'rascunho').length} publicações</button>
  </section>`;
}

function acompanhar() {
  const agora = new Date(), ps = daSemana();
  const alertas = [];
  ps.forEach(p => Object.entries(p.destinos).forEach(([id, d]) => {
    const r = `${p.titulo} · ${PERFIS[id].nome} · ${fmt(p)}`;
    if (d.status === 'falhou') alertas.push(['erro', `Falhou: ${r}${d.obs ? ' — ' + d.obs : ''}`]);
    else if (quando(p) < agora && ['aprovado', 'agendado', 'aguardando'].includes(d.status)) alertas.push(['erro', `Atrasado/sem confirmação: ${r}`]);
    else if (d.status === 'manual' && quando(p) - agora < 864e5) alertas.push(['manual', `Ação manual: ${r}`]);
    else if (d.status === 'rascunho' && quando(p) > agora) alertas.push(['manual', `Não aprovado: ${r}`]);
  }));
  return `
  <section class="col largo">
    <h2>Alertas</h2>
    ${alertas.map(([t, x]) => `<div class="alerta ${t}">${esc(x)}</div>`).join('') || '<p class="muted">Tudo em dia.</p>'}
    ${diasSemana().map((dia, i) => { const doDia = ps.filter(p => p.dia === dia); return doDia.length ? `
      <h3>${DIAS[i]} ${dia.slice(8)}/${dia.slice(5, 7)}</h3>
      ${doDia.map(p => Object.entries(p.destinos).map(([id, d]) => `
        <div class="card linha">
          <div><b>${p.hora}</b> ${esc(p.titulo)}<br><span class="muted">${esc(PERFIS[id].nome)}</span></div>
          <select data-status="${id}" data-id="${p.id}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${d.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <input data-link="${id}" data-id="${p.id}" value="${esc(d.link)}" placeholder="Link do post">
          ${d.link ? `<a href="${esc(d.link)}" target="_blank" rel="noopener">abrir</a>` : ''}
          ${d.status === 'manual' ? `<button class="sec" data-acao="copiar" data-id="${p.id}" data-d="${id}">Copiar legenda</button>${p.video ? `<a href="${esc(p.video)}" target="_blank" rel="noopener">vídeo</a>` : ''}` : ''}
        </div>`).join('')).join('')}` : ''; }).join('')}
  </section>`;
}

function contas() {
  const ids = [...new Set(P.grupos ? Object.values(P.grupos).flatMap(g => g.destinos) : P.destinos)];
  const sit = f => f.integ === 'pendente' ? 'Identificar perfil' : f.integ === 'manual' ? 'Manual' : f.conectado ? 'Conectado' : 'Conectar no Metricool';
  return `
  <section class="col largo">
    <h2>Contas deste painel</h2>
    <table><tr><th>Rede</th><th>Perfil</th><th>Situação</th></tr>
    ${ids.map(id => `<tr><td>${PERFIS[id].rede}</td><td>${esc(PERFIS[id].nome)}</td><td>${sit(PERFIS[id])}</td></tr>`).join('')}</table>
    <p class="muted">Perfis e integrações ficam em <code>config.js</code>.</p>
    <h2>O que cada integração faz (Metricool)</h2>
    <ul>
      <li><b>Instagram</b> (conta profissional ligada a uma Página do Facebook): Reels, posts e stories com capa e legenda. Link de Shopee não fica clicável — vai na bio/stories.</li>
      <li><b>TikTok</b>: vídeo com legenda e capa (capa personalizada só em conta Business). <b>Produto do TikTok Shop não pode ser vinculado por agendamento</b>: com vitrine, vira etapa manual no app.</li>
      <li><b>Facebook</b>: só Páginas (não perfil pessoal) — post, reel ou story.</li>
      <li><b>Threads</b>: texto com imagem/vídeo.</li>
      <li><b>Plano gratuito</b>: 1 marca, 1 perfil por rede e 20 publicações/mês. O que ficar de fora é publicado como manual.</li>
    </ul>
  </section>
  <section class="col">
    <h2>Sincronizar com o GitHub</h2>
    <p class="muted">Sem token o painel só lê o repositório e guarda alterações neste aparelho. Com token (fine-grained, só este repositório, permissão Contents: read and write) ele salva em <code>${P.arquivo}</code>, e o Claude lê dali para agendar e devolve os status.</p>
    <input id="token" type="password" placeholder="github_pat_…" value="${localStorage.getItem('rs-token') ? '••••••••' : ''}">
    <div class="row"><button data-acao="token">Salvar token</button><button class="sec" data-acao="recarregar">Recarregar do GitHub</button></div>
  </section>`;
}

// ---------- eventos ----------
const achar = id => db.pautas.find(p => p.id === id);
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  db.pautas.push({ id: uid(), ...f, dia: '', hora: '', video: '', feito: {}, destinos: {} });
  salvar();
});
document.addEventListener('click', e => {
  const b = e.target.closest('button,[data-aba],[data-filtro],[data-sem]'); if (!b) return;
  if (b.dataset.aba) { aba = b.dataset.aba; return desenhar(); }
  if (b.dataset.filtro) { filtro = b.dataset.filtro; return desenhar(); }
  if (b.dataset.sem) { const [y, m, d] = semana.split('-').map(Number); semana = ymd(new Date(y, m - 1, d + 7 * b.dataset.sem)); return desenhar(); }
  const p = achar(b.dataset.id);
  switch (b.dataset.acao) {
    case 'puxar': p.dia = $(`[data-dia="${p.id}"]`).value; p.hora = $(`[data-hora-banco="${p.id}"]`).value;
      if (!Object.keys(p.destinos).length) possiveis(p).forEach(id => PERFIS[id].integ !== 'pendente' && (p.destinos[id] = { legenda: '', cta: '', capa: '', status: 'rascunho', link: '' }));
      return salvar();
    case 'banco': p.dia = ''; return salvar();
    case 'apagar': if (confirm('Apagar esta pauta?')) { db.pautas = db.pautas.filter(x => x !== p); salvar(); } return;
    case 'replicar': { const [first, ...rest] = Object.values(p.destinos); rest.forEach(d => { d.legenda = first.legenda; d.cta = first.cta; }); return salvar(); }
    case 'aprovar': daSemana().forEach(p => Object.entries(p.destinos).forEach(([id, d]) => {
        if (d.status === 'rascunho' && pronto(p, id)) d.status = modo(id, p).t === 'auto' ? 'aprovado' : 'manual';
      })); return salvar();
    case 'copiar': { const d = p.destinos[b.dataset.d]; navigator.clipboard.writeText(d.legenda + (d.cta ? '\n\n' + d.cta : '')); b.textContent = 'Copiado!'; return; }
    case 'token': { const t = $('#token').value.trim(); if (t && !t.startsWith('••')) localStorage.setItem('rs-token', t); if (!t) localStorage.removeItem('rs-token'); return baixar(); }
    case 'recarregar': db.atualizado = 0; return baixar();
  }
});
document.addEventListener('change', e => {
  const el = e.target, p = achar(el.dataset.id); if (!p) return;
  const ds = el.dataset;
  if (ds.campo) p[ds.campo] = el.value;
  else if (ds.destino) { if (el.checked) p.destinos[ds.destino] = { legenda: '', cta: '', capa: '', status: 'rascunho', link: '' }; else delete p.destinos[ds.destino]; }
  else if (ds.feito) (p.feito ??= {})[ds.feito] = el.checked;
  else if (ds.leg) p.destinos[ds.leg].legenda = el.value;
  else if (ds.cta) p.destinos[ds.cta].cta = el.value;
  else if (ds.capa) p.destinos[ds.capa].capa = el.value;
  else if (ds.status) p.destinos[ds.status].status = el.value;
  else if (ds.link) p.destinos[ds.link].link = el.value;
  else return;
  salvar(el.type === 'checkbox' || el.tagName === 'SELECT');
});
document.addEventListener('input', e => {
  const box = e.target.closest('.destino'); if (!box) return;
  const leg = box.querySelector('[data-leg]').value, cta = box.querySelector('[data-cta]').value;
  box.querySelector('.previa').textContent = leg + (cta ? '\n\n' + cta : '');
});

$('#titulo').textContent = P.titulo;
if (!P.grupos) $('#filtros').remove();
desenhar();
baixar();
