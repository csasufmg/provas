/* provas.js — geração, revisão/aprovação, impressão, equipe */
(function(){
const A = window.App;
const {esc, nl2br} = A;
const DIFS = ['facil', 'medio', 'dificil'];
A.openProvaId = null;

/* =============== GERAR PROVA (coordenação) =============== */
function newGen(){
  return {
    meta: {titulo: '', semestre: '', professora: A.staff.nome || '', valor: '', duracao: ''},
    f: {de: '', ate: '', temas: [], prior: true, incRev: false},
    cont: {objetiva: {facil: 0, medio: 0, dificil: 0}, discursiva: {facil: 0, medio: 0, dificil: 0}},
    revisores: A.equipe.filter(p => p.ativo && p.revisor).map(p => p.email),
    draft: null,
  };
}
function pool(tipo, dif, exclude){
  const f = A.gen.f;
  return A.questoes.filter(q => {
    if ((q.tipo || 'objetiva') !== tipo || q.dificuldade !== dif) return false;
    if (exclude && exclude.has(q.id)) return false;
    if (q.precisaRevisao && !f.incRev) return false;
    if (f.temas.length && !f.temas.includes(q.tema)) return false;
    const d = A.dateKey(q.criadoEm);
    if (f.de && d < f.de) return false;
    if (f.ate && d > f.ate) return false;
    return true;
  });
}
function ordenar(arr){
  if (!A.gen.f.prior) return A.shuffle(arr);
  return A.shuffle(arr.filter(q => !q.usadoAnteriormente)).concat(A.shuffle(arr.filter(q => q.usadoAnteriormente)));
}
function snapshot(q){
  const s = JSON.parse(JSON.stringify(q));
  if (s.tipo !== 'discursiva' && s.alternativas) { // embaralha alternativas acompanhando a correta
    const idx = A.shuffle(s.alternativas.map((_, i) => i));
    s.alternativas = idx.map(i => q.alternativas[i]); s.corretaIndex = idx.indexOf(q.corretaIndex);
  }
  return s;
}
function sortear(){
  const g = A.gen, used = new Set(), res = {obj: [], disc: [], faltas: []};
  [['objetiva', 'obj'], ['discursiva', 'disc']].forEach(([tipo, k]) => DIFS.forEach(d => {
    const n = +g.cont[tipo][d] || 0; if (!n) return;
    const p = ordenar(pool(tipo, d, used)).slice(0, n);
    if (p.length < n) res.faltas.push(A.tipoLabel(tipo) + ' ' + A.difLabel(d).toLowerCase() + ': pedidas ' + n + ', disponíveis ' + p.length);
    p.forEach(q => { used.add(q.id); res[k].push(snapshot(q)); });
  }));
  res.obj = A.shuffle(res.obj); res.disc = A.shuffle(res.disc); // distribuídas, não agrupadas por dificuldade
  g.draft = res;
  return res;
}

A.renderGerar = function(v){
  if (!A.gen) A.gen = newGen();
  const g = A.gen, m = g.meta;
  const inp = (id, lb, val, ph) => '<div class="field grow"><label>' + lb + '</label><input type="text" id="' + id + '" value="' + esc(val) + '" placeholder="' + (ph || '') + '"></div>';
  v.innerHTML = '<div class="card"><h2 style="margin-top:0">Gerar nova prova</h2>' +
    '<div class="row">' + inp('gTit', 'Título', m.titulo, 'Prova 1') + inp('gSem', 'Semestre / turma', m.semestre, '2026/2') + inp('gProf', 'Professor(a) responsável', m.professora) + inp('gVal', 'Valor', m.valor, '30 pontos') + inp('gDur', 'Duração', m.duracao, '2 horas') + '</div></div>' +
    '<div class="card"><strong>Filtros do sorteio</strong><div class="row" style="margin-top:8px">' +
    '<div class="field"><label>Questões criadas de</label><input type="date" id="gDe" value="' + g.f.de + '"></div>' +
    '<div class="field"><label>até</label><input type="date" id="gAte" value="' + g.f.ate + '"></div>' +
    '<label style="display:flex;gap:5px;align-items:center;padding-bottom:9px;color:var(--text)"><input type="checkbox" id="gPrior"' + (g.f.prior ? ' checked' : '') + '> priorizar não usadas</label>' +
    '<label style="display:flex;gap:5px;align-items:center;padding-bottom:9px;color:var(--text)"><input type="checkbox" id="gRev"' + (g.f.incRev ? ' checked' : '') + '> incluir marcadas “precisa revisão”</label></div>' +
    '<div class="field" style="margin-top:8px"><label>Temas (nenhum marcado = todos)</label><div class="checklist" id="gTemas">' +
    A.temas().map(t => '<label><input type="checkbox" value="' + esc(t) + '"' + (g.f.temas.includes(t) ? ' checked' : '') + '>' + esc(t) + '</label>').join('') + '</div></div></div>' +
    '<div class="card"><strong>Quantidade de questões</strong><div class="table-wrap"><table><thead><tr><th></th>' + DIFS.map(d => '<th>' + A.difLabel(d) + '</th>').join('') + '</tr></thead><tbody>' +
    [['objetiva', 'Parte I — objetivas'], ['discursiva', 'Parte II — discursivas']].map(([t, l]) => '<tr><td>' + l + '</td>' + DIFS.map(d =>
      '<td><input type="number" min="0" style="width:70px" data-c="' + t + '|' + d + '" value="' + g.cont[t][d] + '"> <span class="muted" data-av="' + t + '|' + d + '"></span></td>').join('') + '</tr>').join('') +
    '</tbody></table></div></div>' +
    '<div class="card"><strong>Professores que vão avaliar a prova</strong><div class="checklist" id="gRevs" style="margin-top:8px">' +
    (A.equipe.filter(p => p.ativo).map(p => '<label><input type="checkbox" value="' + esc(p.email) + '"' + (g.revisores.includes(p.email) ? ' checked' : '') + '>' + esc(p.nome || p.email) + '</label>').join('') || '<span class="muted">Cadastre professores na aba Equipe.</span>') +
    '</div></div><div class="card"><button class="btn" id="gSort">🎲 Sortear questões</button></div><div id="gDraft"></div>';
  const $ = s => A.$(s, v);
  const sync = () => { m.titulo = $('#gTit').value; m.semestre = $('#gSem').value; m.professora = $('#gProf').value; m.valor = $('#gVal').value; m.duracao = $('#gDur').value; };
  const avail = () => A.$$('[data-av]', v).forEach(s => { const [t, d] = s.dataset.av.split('|'); s.textContent = '/ ' + pool(t, d).length + ' disp.'; });
  ['gTit', 'gSem', 'gProf', 'gVal', 'gDur'].forEach(id => $('#' + id).oninput = sync);
  $('#gDe').onchange = e => { g.f.de = e.target.value; avail(); };
  $('#gAte').onchange = e => { g.f.ate = e.target.value; avail(); };
  $('#gPrior').onchange = e => g.f.prior = e.target.checked;
  $('#gRev').onchange = e => { g.f.incRev = e.target.checked; avail(); };
  $('#gTemas').onchange = () => { g.f.temas = A.$$('input:checked', $('#gTemas')).map(i => i.value); avail(); };
  $('#gRevs').onchange = () => { g.revisores = A.$$('input:checked', $('#gRevs')).map(i => i.value); };
  A.$$('[data-c]', v).forEach(i => i.oninput = () => { const [t, d] = i.dataset.c.split('|'); g.cont[t][d] = Math.max(0, +i.value || 0); });
  avail();
  $('#gSort').onclick = () => {
    sync();
    const r = sortear(); drawDraft(v);
    if (!r.obj.length && !r.disc.length) A.toast('Nenhuma questão sorteada — confira quantidades e filtros.', 4000);
  };
  if (g.draft) drawDraft(v);
};

function drawDraft(v){
  const g = A.gen, d = g.draft, box = A.$('#gDraft', v);
  const item = (q, i, k) => '<div class="q-preview" data-k="' + k + '" data-i="' + i + '"><div class="flex-between"><span class="meta">' + (i + 1) + ' · ' + esc(q.tema || '') + ' · <span class="badge ' + esc(q.dificuldade) + '">' + A.difLabel(q.dificuldade) + '</span> · criada ' + A.fmtDate(q.criadoEm) + (q.usadoAnteriormente ? ' · já usada' : '') + '</span>' +
    '<span class="row-actions"><button class="icon-btn" data-act="swap" title="Trocar por outra">🔄</button><button class="icon-btn danger" data-act="rm" title="Remover">✕</button></span></div>' +
    '<div class="enun">' + esc((q.enunciado || '').slice(0, 260)) + ((q.enunciado || '').length > 260 ? '…' : '') + '</div></div>';
  box.innerHTML = '<div class="card"><h2 style="margin-top:0">Rascunho da prova</h2>' +
    (d.faltas.length ? '<div class="banner warn">Faltam questões: ' + d.faltas.map(esc).join('; ') + '</div>' : '') +
    '<strong>Parte I — objetivas (' + d.obj.length + ')</strong>' + d.obj.map((q, i) => item(q, i, 'obj')).join('') +
    (d.disc.length ? '<br><strong>Parte II — discursivas (' + d.disc.length + ')</strong>' + d.disc.map((q, i) => item(q, i, 'disc')).join('') : '') +
    '<hr class="divider"><div class="banner">Ao criar, a prova fica <strong>em revisão</strong>: cada professor selecionado avalia as questões. Só depois de todas aprovadas por todos ela poderá ser enviada para impressão.</div>' +
    '<button class="btn" id="gCreate">Criar prova e abrir para revisão</button> <button class="btn secondary" id="gAgain">Sortear de novo</button></div>';
  box.onclick = async e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const it = b.closest('[data-k]'), k = it.dataset.k, i = +it.dataset.i, q = d[k][i];
    if (b.dataset.act === 'rm') { d[k].splice(i, 1); }
    else {
      const ids = new Set(d.obj.concat(d.disc).map(x => x.id));
      const cand = ordenar(pool(q.tipo || 'objetiva', q.dificuldade, ids));
      if (!cand.length) return A.toast('Não há outra questão disponível para trocar.');
      d[k][i] = snapshot(cand[0]);
    }
    drawDraft(v);
  };
  A.$('#gAgain', v).onclick = () => { sortear(); drawDraft(v); };
  A.$('#gCreate', v).onclick = async () => {
    if (!d.obj.length && !d.disc.length) return A.toast('A prova está vazia.');
    if (!g.revisores.length && !await A.confirm('Nenhum professor selecionado para avaliar: a prova nunca poderá ser aprovada. Continuar?', 'Continuar')) return;
    const p = Object.assign({}, g.meta, {
      id: 'p-' + A.uid(), titulo: g.meta.titulo || ('Prova ' + (g.meta.semestre || '')), criadoEm: new Date().toISOString(),
      contagens: g.cont.objetiva, contagensDiscursiva: g.cont.discursiva, temasFiltro: g.f.temas,
      criadasDe: g.f.de || null, criadasAte: g.f.ate || null, questoes: d.obj, questoesDiscursivas: d.disc,
      revisores: g.revisores, criadoPor: A.email(),
    });
    try { await A.upsert(A.T().provas, p); } catch (er) { return A.toast('Erro: ' + er.message, 5000); }
    A.provas.push(p); A.gen = null; A.openProvaId = p.id; A.tab = 'provas'; A.render(); A.toast('Prova criada — aguardando avaliação dos professores');
  };
}

/* =============== STATUS / REVISÃO =============== */
A.revOf = (p, qid, prof) => A.revisoes.find(r => r.prova_id === p.id && r.questao_id === qid && r.professor === prof);
A.provaStatus = function(p){
  const qs = A.allQuestoes(p), rv = p.revisores || [];
  let ok = 0, bad = 0, pend = 0;
  qs.forEach(q => rv.forEach(e => { const r = A.revOf(p, q.id, e); if (!r) pend++; else if (r.parecer === 'aprovada') ok++; else bad++; }));
  const total = qs.length * rv.length;
  return {ok, bad, pend, total, pronta: total > 0 && ok === total && qs.length > 0};
};

A.renderProvas = function(v){
  const p = A.provas.find(x => x.id === A.openProvaId);
  if (p) return renderProva(v, p);
  const list = A.provas.slice().sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
  v.innerHTML = '<div class="card"><h2 style="margin-top:0">Provas</h2>' + (list.length ? '<div class="table-wrap"><table><thead><tr><th>Prova</th><th>Criada</th><th>Questões</th><th>Situação</th><th></th></tr></thead><tbody>' +
    list.map(p => {
      const s = A.provaStatus(p), mine = (p.revisores || []).includes(A.email());
      const minhas = A.allQuestoes(p).filter(q => !A.revOf(p, q.id, A.email())).length;
      const sit = p.enviadaImpressaoEm ? '<span class="badge facil">Enviada p/ impressão</span>' : s.pronta ? '<span class="badge facil">Aprovada</span>' : s.bad ? '<span class="badge dificil">Com reprovações</span>' : '<span class="badge medio">Em revisão</span>';
      return '<tr><td>' + esc(p.titulo) + '<div class="muted" style="font-size:12px">' + esc(p.semestre || '') + '</div></td><td>' + A.fmtDate(p.criadoEm) + '</td><td>' + A.allQuestoes(p).length + '</td>' +
        '<td>' + sit + (p.enviadaImpressaoEm ? '' : '<div class="progress" style="width:120px;margin-top:4px"><div style="width:' + (s.total ? Math.round(100 * s.ok / s.total) : 0) + '%"></div></div><span class="muted" style="font-size:11.5px">' + s.ok + '/' + s.total + ' pareceres aprovados</span>') +
        (mine && !p.enviadaImpressaoEm && minhas ? '<div class="revisao-tag">você tem ' + minhas + ' a avaliar</div>' : '') + '</td>' +
        '<td><div class="row-actions" data-id="' + esc(p.id) + '"><button class="btn small" data-a="open">Abrir</button>' + (A.isCoord() ? '<button class="icon-btn danger" data-a="del" title="Excluir">🗑</button>' : '') + '</div></td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="empty">Nenhuma prova ainda.</div>') + '</div>';
  v.onclick = async e => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const id = b.parentElement.dataset.id;
    if (b.dataset.a === 'open') { A.openProvaId = id; A.render(); }
    if (b.dataset.a === 'del' && await A.confirm('Excluir esta prova e seus pareceres?', 'Excluir')) {
      const T = A.T();
      await A.sb.from(T.revisoes).delete().eq('prova_id', id);
      const {error} = await A.sb.from(T.provas).delete().eq('id', id);
      if (error) return A.toast('Erro: ' + error.message);
      A.provas = A.provas.filter(x => x.id !== id); A.revisoes = A.revisoes.filter(r => r.prova_id !== id); A.render();
    }
  };
};

function dk(p, q){ return p.id + '|' + q.id; }
function renderProva(v, p){
  v.onclick = null;
  const me = A.email(), isRev = (p.revisores || []).includes(me), s = A.provaStatus(p), enviada = !!p.enviadaImpressaoEm;
  const nome = e => { const x = A.equipe.find(y => y.email === e); return x && x.nome ? x.nome : e; };
  const secs = [['Parte I — objetivas', p.questoes || []], ['Parte II — discursivas', p.questoesDiscursivas || []]];
  let h = '<div class="flex-between" style="margin-bottom:10px"><button class="btn secondary small" id="pBack">← Provas</button><span></span></div>' +
    '<div class="card"><h2 style="margin:0 0 4px">' + esc(p.titulo) + '</h2><div class="muted">' + esc(p.semestre || '') + ' · criada em ' + A.fmtDate(p.criadoEm) + ' · ' + A.allQuestoes(p).length + ' questões · avaliadores: ' + (p.revisores || []).map(e => esc(nome(e))).join(', ') + '</div>';
  if (enviada) {
    h += '<div class="banner ok" style="margin-top:10px">✔ Enviada para impressão em ' + A.fmtDate(p.enviadaImpressaoEm) + ' por ' + esc(p.enviadaPor || '') + '.</div>' +
      '<button class="btn" id="pPrint">🖨 Imprimir prova</button> <button class="btn secondary" id="pGab">🖨 Imprimir gabarito comentado</button>';
  } else {
    h += '<div class="progress" style="margin:10px 0 4px"><div style="width:' + (s.total ? Math.round(100 * s.ok / s.total) : 0) + '%"></div></div><div class="muted" style="font-size:12.5px">' + s.ok + ' de ' + s.total + ' pareceres aprovados · ' + s.pend + ' pendentes · ' + s.bad + ' reprovados</div>' +
      '<div class="banner ' + (s.pronta ? 'ok' : 'warn') + '" style="margin-top:10px">' + (s.pronta ? 'Todas as questões foram aprovadas por todos os professores.' : '🔒 Impressão bloqueada até que todas as questões sejam aprovadas por todos os avaliadores.') + '</div>' +
      (A.isCoord() ? '<button class="btn" id="pSend"' + (s.pronta ? '' : ' disabled') + '>Enviar para impressão</button> <button class="btn secondary" id="pRevs">Editar avaliadores</button>' : '');
  }
  h += '</div>';
  let n = 0;
  secs.forEach(([tit, arr]) => {
    if (!arr.length) return;
    h += '<h3>' + tit + '</h3>';
    arr.forEach((q, i) => {
      n++;
      const rs = (p.revisores || []).map(e => ({e, r: A.revOf(p, q.id, e)}));
      const anyBad = rs.some(x => x.r && x.r.parecer === 'reprovada'), allOk = rs.length && rs.every(x => x.r && x.r.parecer === 'aprovada');
      h += '<div class="rev-card ' + (anyBad ? 'bad' : allOk ? 'ok' : 'pend') + '" data-q="' + esc(q.id) + '"><div class="meta muted" style="font-size:12px">Questão ' + (i + 1) + ' · ' + esc(q.tema || '') + ' · <span class="badge ' + esc(q.dificuldade) + '">' + A.difLabel(q.dificuldade) + '</span></div>' +
        A.qHtml(q, null, {gab: true}) +
        '<div class="chips">' + rs.map(x => '<span class="chip ' + (!x.r ? 'pend' : x.r.parecer === 'aprovada' ? 'ok' : 'bad') + '" title="' + esc(x.r && x.r.comentario || '') + '">' + esc(nome(x.e)) + ': ' + (!x.r ? 'pendente' : x.r.parecer === 'aprovada' ? 'aprovou' : 'reprovou') + '</span>').join('') + '</div>' +
        rs.filter(x => x.r && x.r.comentario && x.e !== me).map(x => '<div class="muted" style="font-size:13px">💬 <strong>' + esc(nome(x.e)) + ':</strong> ' + nl2br(x.r.comentario) + '</div>').join('');
      if (isRev && !enviada) {
        const mine = A.revOf(p, q.id, me), d = A.draft[dk(p, q)] || (A.draft[dk(p, q)] = {parecer: mine ? mine.parecer : '', comentario: mine ? mine.comentario || '' : ''});
        h += '<div class="rev-panel"><strong style="font-size:13px">Seu parecer</strong><div class="rev-opts" style="margin-top:6px">' +
          '<label><input type="radio" name="par-' + esc(q.id) + '" value="aprovada"' + (d.parecer === 'aprovada' ? ' checked' : '') + '> Aprovo (conteúdo foi dado em sala)</label>' +
          '<label><input type="radio" name="par-' + esc(q.id) + '" value="reprovada"' + (d.parecer === 'reprovada' ? ' checked' : '') + '> Reprovo / ajustar</label></div>' +
          '<textarea rows="2" data-com placeholder="Comentário (ex.: conteúdo não foi abordado em sala; redação ambígua…)" style="width:100%">' + esc(d.comentario) + '</textarea>' +
          '<div style="margin-top:6px"><button class="btn small" data-save>Salvar parecer</button>' + (mine ? ' <span class="save-status">salvo em ' + A.fmtDate(mine.atualizadoEm) + '</span>' : '') + '</div></div>';
      }
      if (A.isCoord() && !enviada && anyBad) h += '<div style="margin-top:8px"><button class="btn secondary small" data-swap>Substituir esta questão por outra do banco</button></div>';
      h += '</div>';
    });
  });
  v.innerHTML = h;
  A.hydrateImgs(v);
  const $ = s => A.$(s, v);
  $('#pBack').onclick = () => { A.openProvaId = null; A.render(); };
  A.$$('.rev-card', v).forEach(card => {
    const qid = card.dataset.q, q = A.allQuestoes(p).find(x => x.id === qid), key = dk(p, q);
    A.$$('input[type=radio]', card).forEach(r => r.onchange = () => { (A.draft[key] = A.draft[key] || {}).parecer = r.value; });
    const ta = A.$('[data-com]', card); if (ta) ta.oninput = () => { (A.draft[key] = A.draft[key] || {}).comentario = ta.value; };
    const sv = A.$('[data-save]', card);
    if (sv) sv.onclick = async () => {
      const d = A.draft[key] || {};
      if (!d.parecer) return A.toast('Escolha aprovar ou reprovar.');
      if (d.parecer === 'reprovada' && !(d.comentario || '').trim()) return A.toast('Explique o motivo da reprovação no comentário.');
      const prev = A.revOf(p, qid, me), now = new Date().toISOString();
      const row = {prova_id: p.id, questao_id: qid, professor: me, parecer: d.parecer, comentario: (d.comentario || '').trim(), atualizadoEm: now};
      const {data, error} = await A.sb.from(A.T().revisoes).upsert(row, {onConflict: 'prova_id,questao_id,professor'}).select();
      if (error) return A.toast('Erro: ' + error.message, 5000);
      const saved = (data && data[0]) || Object.assign({}, prev, row);
      if (prev) Object.assign(prev, saved); else A.revisoes.push(saved);
      A.render(); A.toast('Parecer salvo');
    };
    const sw = A.$('[data-swap]', card);
    if (sw) sw.onclick = async () => {
      if (!await A.confirm('Substituir esta questão por outra do mesmo tipo e dificuldade? Os pareceres dela deixam de contar.', 'Substituir')) return;
      const ids = new Set(A.allQuestoes(p).map(x => x.id));
      const cand = A.shuffle(A.questoes.filter(c => !ids.has(c.id) && (c.tipo || 'objetiva') === (q.tipo || 'objetiva') && c.dificuldade === q.dificuldade && !c.precisaRevisao));
      if (!cand.length) return A.toast('Não há outra questão disponível.');
      cand.sort((a, b) => (a.usadoAnteriormente ? 1 : 0) - (b.usadoAnteriormente ? 1 : 0));
      const ns = JSON.parse(JSON.stringify(cand[0]));
      if (ns.tipo !== 'discursiva') { const idx = A.shuffle(ns.alternativas.map((_, i) => i)); const o = cand[0]; ns.alternativas = idx.map(i => o.alternativas[i]); ns.corretaIndex = idx.indexOf(o.corretaIndex); }
      const k = (q.tipo === 'discursiva') ? 'questoesDiscursivas' : 'questoes';
      const arr = p[k].slice(); arr[arr.findIndex(x => x.id === qid)] = ns;
      const {error} = await A.sb.from(A.T().provas).update({[k]: arr}).eq('id', p.id);
      if (error) return A.toast('Erro: ' + error.message);
      p[k] = arr; A.render(); A.toast('Questão substituída — aguardando novos pareceres');
    };
  });
  const send = $('#pSend');
  if (send) send.onclick = async () => {
    if (!A.provaStatus(p).pronta) return A.toast('Ainda há questões sem aprovação.');
    if (!await A.confirm('Enviar para impressão? As questões serão marcadas como usadas e a prova não poderá mais ser alterada.', 'Enviar')) return;
    const now = new Date().toISOString(), T = A.T();
    const {error} = await A.sb.from(T.provas).update({enviadaImpressaoEm: now, enviadaPor: me}).eq('id', p.id);
    if (error) return A.toast('Erro: ' + error.message, 5000);
    p.enviadaImpressaoEm = now; p.enviadaPor = me;
    for (const q of A.allQuestoes(p)) {
      const orig = A.questoes.find(x => x.id === q.id); if (!orig) continue;
      const hist = (orig.historicoUso || []).concat([{provaId: p.id, titulo: p.titulo, semestre: p.semestre || '', data: now}]);
      const {error: e2} = await A.sb.from(T.questoes).update({usadoAnteriormente: true, historicoUso: hist}).eq('id', q.id);
      if (!e2) { orig.usadoAnteriormente = true; orig.historicoUso = hist; }
    }
    A.render(); A.toast('Prova liberada para impressão');
  };
  const rv = $('#pRevs');
  if (rv) rv.onclick = () => {
    const m = A.modal('<h2>Avaliadores</h2><div class="checklist">' + A.equipe.filter(x => x.ativo).map(x => '<label><input type="checkbox" value="' + esc(x.email) + '"' + ((p.revisores || []).includes(x.email) ? ' checked' : '') + '>' + esc(x.nome || x.email) + '</label>').join('') + '</div><br><button class="btn" id="okRv">Salvar</button>');
    m.querySelector('#okRv').onclick = async () => {
      const list = A.$$('input:checked', m).map(i => i.value);
      const {error} = await A.sb.from(A.T().provas).update({revisores: list}).eq('id', p.id);
      if (error) return A.toast('Erro: ' + error.message);
      p.revisores = list; A.closeModal(); A.render();
    };
  };
  if ($('#pPrint')) { $('#pPrint').onclick = () => A.imprimir(p, 'prova'); $('#pGab').onclick = () => A.imprimir(p, 'gabarito'); }
}

/* =============== IMPRESSÃO (só depois de enviada) =============== */
A.capaHtml = function(p){
  const d = A.disc, C = A.C, obj = p.questoes || [], nDisc = (p.questoesDiscursivas || []).length, nObj = obj.length;
  const maxAlts = Math.max(4, ...obj.map(q => (q.alternativas || []).length));
  const letras = Array.from({length: maxAlts}, (_, i) => String.fromCharCode(65 + i));
  const td = 'border:1px solid #333;padding:4px 8px;text-align:center;font-family:Georgia,serif';
  const comp = nDisc ? 'Esta prova é composta por duas partes: <strong>Parte I – objetiva, com ' + nObj + ' questões de múltipla escolha</strong>; <strong>Parte II – discursiva, com ' + nDisc + ' questões abertas</strong>.' : 'Esta prova é composta por <strong>' + nObj + ' questões de múltipla escolha</strong>.';
  return '<div class="page-break" style="font-family:Georgia,\'Times New Roman\',serif;color:#111;font-size:13px;line-height:1.45">' +
    '<div style="text-align:center;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:10px">' + C.cabecalho.map(l => '<div style="font-size:14px">' + esc(l) + '</div>').join('') +
    '<div style="font-size:14px;font-weight:bold">Disciplina de ' + esc(d.nome) + ' — ' + esc(d.sigla) + '</div></div>' +
    '<table style="width:100%;border-collapse:collapse;border:1px solid #333"><tr><td style="border:1px solid #333;padding:5px 8px;width:50%">Professor(a): ' + esc(p.professora || '') + '</td><td style="border:1px solid #333;padding:5px 8px">Turma: ' + esc(p.semestre || '') + '</td></tr>' +
    '<tr><td colspan="2" style="border:1px solid #333;padding:5px 8px">Nome:</td></tr><tr><td style="border:1px solid #333;padding:5px 8px">Matrícula:</td><td style="border:1px solid #333;padding:5px 8px">Valor: ' + esc(p.valor || '— pontos') + ' &nbsp;&nbsp;&nbsp; Nota:</td></tr></table>' +
    '<div style="text-align:center;font-weight:bold;text-decoration:underline;margin:18px 0 10px">ORIENTAÇÕES</div>' +
    '<p>' + comp + ' A duração da prova é de <strong>' + esc(p.duracao || '— horas') + '</strong>. Faça-a com tranquilidade, mas controle o seu tempo!</p>' +
    (nObj ? '<p>Para cada questão da Parte I são apresentadas alternativas classificadas com as letras ' + letras.join(', ') + ', e só uma responde da melhor forma ao quesito proposto. Você só deve assinalar <strong>UMA RESPOSTA</strong> no <strong>GABARITO</strong>. A marcação de nenhuma ou de mais de uma alternativa anula a questão, <strong>MESMO QUE UMA DAS RESPOSTAS SEJA A CORRETA</strong>.</p>' : '') +
    (nDisc ? '<p>As questões discursivas da Parte II têm espaço próprio para as respostas (não ultrapasse as linhas indicadas).</p>' : '') +
    '<p>O espaço da prova poderá ser usado para anotações, mas somente as respostas assinaladas no <strong>GABARITO</strong> (Parte I)' + (nDisc ? ' e escritas no espaço próprio (Parte II)' : '') + ' serão corrigidas.</p>' +
    (nObj ? '<p>No <strong>GABARITO</strong> a seguir, assinale a opção correta de cada questão da Parte I:</p><table style="border-collapse:collapse;margin:0 auto"><tr><td style="' + td + ';font-weight:bold">QUESTÃO</td><td colspan="' + letras.length + '" style="' + td + ';font-weight:bold">GABARITO</td></tr>' +
      obj.map((_, i) => '<tr><td style="' + td + '">' + (i + 1) + '</td>' + letras.map(l => '<td style="' + td + '">' + l + '</td>').join('') + '</tr>').join('') + '</table>' : '') + '</div>';
};
A.imprimir = async function(p, modo){
  if (!p.enviadaImpressaoEm) return A.toast('Impressão bloqueada: a prova ainda não foi aprovada e enviada.');
  const L = i => String.fromCharCode(65 + i), obj = p.questoes || [], disc = p.questoesDiscursivas || [];
  let h;
  if (modo === 'prova') {
    h = A.capaHtml(p) + (obj.length ? '<div class="page-break-before"><h3 style="font-family:Georgia,serif">Parte I — Questões objetivas</h3>' + obj.map((q, i) => A.qHtml(q, i + 1)).join('') + '</div>' : '') +
      (disc.length ? '<div class="page-break-before"><h3 style="font-family:Georgia,serif">Parte II — Questões discursivas</h3>' + disc.map((q, i) => A.qHtml(q, i + 1, {linhas: true})).join('') + '</div>' : '');
  } else {
    h = '<div style="font-family:Georgia,serif"><h2>Gabarito comentado — ' + esc(p.titulo) + ' (' + esc(p.semestre || '') + ')</h2>' +
      (obj.length ? '<p><strong>Parte I:</strong> ' + obj.map((q, i) => (i + 1) + '-' + L(q.corretaIndex)).join(' · ') + '</p>' + obj.map((q, i) => A.qHtml(q, i + 1, {gab: true})).join('') : '') +
      (disc.length ? '<h3>Parte II</h3>' + disc.map((q, i) => A.qHtml(q, i + 1, {gab: true})).join('') : '') + '</div>';
  }
  const pa = A.$('#printArea'); pa.innerHTML = h; await A.hydrateImgs(pa);
  setTimeout(() => window.print(), 100);
};

/* =============== EQUIPE (coordenação) =============== */
A.renderEquipe = function(v){
  const me = A.email();
  v.innerHTML = '<div class="card"><h2 style="margin-top:0">Equipe autorizada</h2>' +
    '<div class="banner">Para liberar um professor: (1) crie o usuário em <strong>Supabase → Authentication → Users → Add user</strong> (e-mail + senha, marcando <em>Auto Confirm User</em>); (2) cadastre o mesmo e-mail aqui. Sem estar nesta lista, ninguém acessa o banco — mesmo com senha válida.</div>' +
    '<div class="table-wrap"><table><thead><tr><th>E-mail</th><th>Nome</th><th>Papel</th><th>Avalia provas</th><th>Ativo</th><th></th></tr></thead><tbody>' +
    A.equipe.map(p => '<tr data-e="' + esc(p.email) + '"><td>' + esc(p.email) + '</td><td>' + esc(p.nome || '') + '</td><td><select data-f="papel"' + (p.email === me ? ' disabled' : '') + '><option value="professor"' + (p.papel === 'professor' ? ' selected' : '') + '>Professor</option><option value="coordenacao"' + (p.papel === 'coordenacao' ? ' selected' : '') + '>Coordenação</option></select></td>' +
      '<td><input type="checkbox" data-f="revisor"' + (p.revisor ? ' checked' : '') + '></td><td><input type="checkbox" data-f="ativo"' + (p.ativo ? ' checked' : '') + (p.email === me ? ' disabled' : '') + '></td>' +
      '<td>' + (p.email === me ? '' : '<button class="icon-btn danger" data-rm>🗑</button>') + '</td></tr>').join('') + '</tbody></table></div></div>' +
    '<div class="card"><strong>Adicionar professor</strong><div class="row" style="margin-top:8px"><div class="field grow"><label>E-mail</label><input type="text" id="eEmail"></div><div class="field grow"><label>Nome</label><input type="text" id="eNome"></div>' +
    '<div class="field"><label>Papel</label><select id="ePapel"><option value="professor">Professor</option><option value="coordenacao">Coordenação</option></select></div><button class="btn" id="eAdd">Adicionar</button></div></div>';
  v.onchange = async e => {
    const f = e.target.dataset.f; if (!f) return;
    const email = e.target.closest('tr').dataset.e;
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    const {error} = await A.sb.from('professores').update({[f]: val}).eq('email', email);
    if (error) return A.toast('Erro: ' + error.message);
    A.equipe.find(x => x.email === email)[f] = val; A.toast('Atualizado');
  };
  v.onclick = async e => {
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      const email = rm.closest('tr').dataset.e;
      if (!await A.confirm('Remover ' + email + ' da lista? (a conta de login continua existindo, mas sem acesso a dados)', 'Remover')) return;
      const {error} = await A.sb.from('professores').delete().eq('email', email);
      if (error) return A.toast('Erro: ' + error.message);
      A.equipe = A.equipe.filter(x => x.email !== email); A.render();
    }
    if (e.target.id === 'eAdd') {
      const email = A.$('#eEmail').value.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return A.toast('E-mail inválido.');
      const row = {email, nome: A.$('#eNome').value.trim(), papel: A.$('#ePapel').value, ativo: true, revisor: true};
      try { await A.upsert('professores', row); } catch (er) { return A.toast('Erro: ' + er.message); }
      const i = A.equipe.findIndex(x => x.email === email); if (i >= 0) A.equipe[i] = row; else A.equipe.push(row);
      A.render(); A.toast('Professor adicionado');
    }
  };
};
})();
