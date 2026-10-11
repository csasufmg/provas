/* banco.js — listagem, formulário, duplicação, imagens, exclusão */
(function(){
const A = window.App;
const {esc, nl2br} = A;
A.filtro = {q: '', tema: '', dif: '', tipo: '', de: '', ate: '', rev: false};
A.editing = null;

/* HTML de uma questão (visualização, prova, gabarito) */
A.figsHtml = q => (q.imagens || []).map(im => '<figure class="q-fig"><img data-path="' + esc(im.path) + '" alt="">' + (im.legenda ? '<figcaption>' + esc(im.legenda) + '</figcaption>' : '') + '</figure>').join('');
A.qHtml = function(q, num, o){
  o = o || {};
  const L = i => String.fromCharCode(65 + i);
  let h = '<div class="qblock"><div>' + (num != null ? '<strong>' + num + '.</strong> ' : '') + nl2br(q.enunciado) + '</div>' + A.figsHtml(q);
  if (q.tipo === 'discursiva') {
    if (o.linhas) h += '<div class="lines" style="margin-top:8px">' + '<div></div>'.repeat(q.linhasResposta || 6) + '</div>';
    if (o.gab) h += '<div class="resp-box"><strong>Resposta esperada:</strong><br>' + nl2br(q.discussao) + '</div>';
  } else {
    h += (q.alternativas || []).map((a, i) => '<div class="alt' + (o.gab && i === q.corretaIndex ? ' correct' : '') + '"><strong>' + L(i) + ')</strong> ' + nl2br(a) + (o.gab && i === q.corretaIndex ? ' ✔' : '') + '</div>').join('');
    if (o.gab) h += '<div class="resp-box"><strong>Gabarito: ' + L(q.corretaIndex) + '.</strong> ' + nl2br(q.discussao) + '</div>';
  }
  if (o.gab && q.referencia) h += '<div class="muted" style="font-size:12px;margin-top:4px">Ref.: ' + esc(q.referencia) + '</div>';
  return h + '</div>';
};

/* ---------- listagem ---------- */
function filtradas(){
  const f = A.filtro, s = f.q.trim().toLowerCase();
  return A.questoes.filter(q => {
    if (f.tema && q.tema !== f.tema) return false;
    if (f.dif && q.dificuldade !== f.dif) return false;
    if (f.tipo && (q.tipo || 'objetiva') !== f.tipo) return false;
    if (f.rev && !q.precisaRevisao) return false;
    const d = A.dateKey(q.criadoEm);
    if (f.de && d < f.de) return false;
    if (f.ate && d > f.ate) return false;
    if (s && !((q.enunciado || '') + ' ' + (q.tema || '') + ' ' + (q.alternativas || []).join(' ')).toLowerCase().includes(s)) return false;
    return true;
  });
}
A.temas = () => Array.from(new Set(A.questoes.map(q => q.tema).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt'));

A.renderBanco = function(v){
  const f = A.filtro, qs = A.questoes;
  const n = (t, d) => qs.filter(q => (q.tipo || 'objetiva') === t && q.dificuldade === d).length;
  v.innerHTML = '<div class="card"><div class="stat-grid">' +
    '<div class="stat"><div class="num">' + qs.length + '</div><div class="lbl">questões no banco</div></div>' +
    ['facil', 'medio', 'dificil'].map(d => '<div class="stat"><div class="num">' + n('objetiva', d) + '</div><div class="lbl">objetivas ' + A.difLabel(d).toLowerCase() + 's</div></div>').join('') +
    '<div class="stat"><div class="num">' + qs.filter(q => q.tipo === 'discursiva').length + '</div><div class="lbl">discursivas</div></div></div></div>' +
    '<div class="card"><div class="row">' +
    '<div class="field grow"><label>Buscar</label><input type="search" id="fQ" value="' + esc(f.q) + '" placeholder="enunciado, tema…"></div>' +
    '<div class="field"><label>Tema</label><select id="fTema"><option value="">Todos</option>' + A.temas().map(t => '<option' + (f.tema === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></div>' +
    '<div class="field"><label>Dificuldade</label><select id="fDif"><option value="">Todas</option>' + ['facil', 'medio', 'dificil'].map(d => '<option value="' + d + '"' + (f.dif === d ? ' selected' : '') + '>' + A.difLabel(d) + '</option>').join('') + '</select></div>' +
    '<div class="field"><label>Tipo</label><select id="fTipo"><option value="">Todos</option><option value="objetiva"' + (f.tipo === 'objetiva' ? ' selected' : '') + '>Objetiva</option><option value="discursiva"' + (f.tipo === 'discursiva' ? ' selected' : '') + '>Discursiva</option></select></div>' +
    '<div class="field"><label>Criada de</label><input type="date" id="fDe" value="' + f.de + '"></div>' +
    '<div class="field"><label>até</label><input type="date" id="fAte" value="' + f.ate + '"></div>' +
    '<label style="display:flex;gap:5px;align-items:center;padding-bottom:9px"><input type="checkbox" id="fRev"' + (f.rev ? ' checked' : '') + '> precisa revisão</label>' +
    '</div></div><div class="card"><div class="flex-between" style="margin-bottom:8px"><strong id="cnt"></strong><span>' +
    (A.isCoord() ? '<button class="btn secondary small" id="btnLote">Definir data de criação (filtradas)</button> ' : '') +
    (A.isCoord() ? '<button class="btn secondary small" id="btnImp">Importar JSON</button> ' : '') + '<button class="btn secondary small" id="btnExp">Exportar JSON</button></span></div><div class="table-wrap"><table><thead><tr><th>Tema</th><th>Questão</th><th>Tipo</th><th>Dif.</th><th>Criada em</th><th></th></tr></thead><tbody id="tbody"></tbody></table></div></div>';
  const body = () => {
    const list = filtradas(); A.$('#cnt').textContent = list.length + ' questão(ões)';
    const tb = A.$('#tbody');
    tb.innerHTML = list.length ? list.slice(0, 300).map(q =>
      '<tr><td>' + esc(q.tema || '') + '</td><td style="max-width:460px">' + esc((q.enunciado || '').slice(0, 170)) + ((q.enunciado || '').length > 170 ? '…' : '') +
      ((q.imagens || []).length ? ' 🖼' : '') + (q.precisaRevisao ? ' <span class="revisao-tag">⚠ revisar</span>' : '') + '</td>' +
      '<td><span class="pill">' + A.tipoLabel(q.tipo) + '</span></td><td><span class="badge ' + esc(q.dificuldade) + '">' + A.difLabel(q.dificuldade) + '</span></td>' +
      '<td>' + A.fmtDate(q.criadoEm) + '</td><td><div class="row-actions" data-id="' + esc(q.id) + '">' +
      '<button class="icon-btn" data-a="ver" title="Ver">👁</button><button class="icon-btn" data-a="edit" title="Editar">✎</button>' +
      '<button class="icon-btn" data-a="dup" title="Duplicar">⧉</button>' +
      (A.isCoord() ? '<button class="icon-btn danger" data-a="del" title="Excluir">🗑</button>' : '') + '</div></td></tr>').join('')
      : '<tr><td colspan="6" class="empty">Nenhuma questão com esses filtros.</td></tr>';
    if (list.length > 300) tb.insertAdjacentHTML('beforeend', '<tr><td colspan="6" class="muted">Mostrando 300 de ' + list.length + '. Refine os filtros.</td></tr>');
  };
  body();
  const bind = (id, k, ev) => A.$(id).addEventListener(ev || 'input', e => { f[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; body(); });
  bind('#fQ', 'q'); bind('#fTema', 'tema', 'change'); bind('#fDif', 'dif', 'change'); bind('#fTipo', 'tipo', 'change');
  bind('#fDe', 'de', 'change'); bind('#fAte', 'ate', 'change'); bind('#fRev', 'rev', 'change');
  A.$('#tbody').onclick = e => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const q = A.questoes.find(x => x.id === b.parentElement.dataset.id); if (!q) return;
    ({ver: viewQ, edit: x => openForm('edit', x), dup: x => openForm('dup', x), del: delQ}[b.dataset.a])(q);
  };
  A.$('#btnExp').onclick = () => A.download('banco-' + A.disc.id + '-' + A.today() + '.json', JSON.stringify(filtradas(), null, 1), 'application/json');
  const bl = A.$('#btnLote'); if (bl) bl.onclick = lote;
  const bi = A.$('#btnImp'); if (bi) bi.onclick = importar;
};

/* ---------- importar JSON (coordenação) ---------- */
const COLS = ['id','tema','tipo','dificuldade','enunciado','imagens','alternativas','corretaIndex','linhasResposta','discussao','referencia','elaboradoPor','provaOrigem','usadoAnteriormente','historicoUso','precisaRevisao','motivoRevisao','origem','numeroOriginal','idOriginal','duplicadaDe','criadoPor','criadoEm','atualizadoEm'];
A.importarRows = async function(rows){
  const clean = rows.filter(r => r && r.id && r.enunciado).map(r => { const o = {}; COLS.forEach(c => { if (r[c] !== undefined) o[c] = r[c]; }); o.imagens = []; return o; });
  for (let i = 0; i < clean.length; i += 200) {
    const {error} = await A.sb.from(A.T().questoes).upsert(clean.slice(i, i + 200));
    if (error) throw error;
  }
  await A.loadQuestoes();
  return clean.length;
};
function importar(){
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    let rows; try { rows = JSON.parse(await f.text()); if (!Array.isArray(rows)) rows = rows.questoes; if (!Array.isArray(rows)) throw 0; } catch (e) { return A.toast('Arquivo inválido: use um JSON exportado pelo sistema.', 4500); }
    if (!await A.confirm('Importar ' + rows.length + ' questões para ' + A.disc.sigla + '? Questões com o mesmo código são atualizadas (não duplicam). Imagens não são importadas.', 'Importar')) return;
    try { const n = await A.importarRows(rows); A.render(); A.toast(n + ' questões importadas', 4000); } catch (e) { A.toast('Erro: ' + e.message, 6000); }
  };
  inp.click();
}

function viewQ(q){
  A.modal('<h2>' + esc(q.tema || '') + ' <span class="badge ' + esc(q.dificuldade) + '">' + A.difLabel(q.dificuldade) + '</span></h2>' +
    '<div class="muted" style="font-size:12px;margin-bottom:8px">' + A.tipoLabel(q.tipo) + ' · criada em ' + A.fmtDate(q.criadoEm) + (q.criadoPor ? ' por ' + esc(q.criadoPor) : '') +
    (q.duplicadaDe ? ' · duplicada de ' + esc(q.duplicadaDe) : '') + (q.usadoAnteriormente ? ' · já usada' : '') + '</div>' +
    '<div class="q-preview">' + A.qHtml(q, null, {gab: true}) + '</div>' +
    (q.precisaRevisao ? '<div class="banner warn">⚠ Marcada para revisão: ' + esc(q.motivoRevisao || '') + '</div>' : ''), {wide: true});
}
async function delQ(q){
  if (!await A.confirm('Excluir esta questão do banco? Provas já geradas não são afetadas (guardam uma cópia).', 'Excluir')) return;
  const {error} = await A.sb.from(A.T().questoes).delete().eq('id', q.id);
  if (error) return A.toast('Erro: ' + error.message);
  A.questoes = A.questoes.filter(x => x.id !== q.id); A.render(); A.toast('Questão excluída');
}
function lote(){
  const n = filtradas().length;
  const m = A.modal('<h2>Definir data de criação</h2><p>Aplica a data às <strong>' + n + '</strong> questões atualmente filtradas (útil para as questões importadas, que ficaram com a data da importação).</p><div class="field"><label>Data</label><input type="date" id="dtLote" value="' + A.today() + '"></div><br><button class="btn" id="okLote">Aplicar</button>');
  m.querySelector('#okLote').onclick = async () => {
    const d = m.querySelector('#dtLote').value; if (!d) return;
    const ids = filtradas().map(q => q.id);
    for (let i = 0; i < ids.length; i += 200) {
      const {error} = await A.sb.from(A.T().questoes).update({criadoEm: d + 'T12:00:00Z'}).in('id', ids.slice(i, i + 200));
      if (error) return A.toast('Erro: ' + error.message);
    }
    await A.loadQuestoes(); A.closeModal(); A.render(); A.toast('Data aplicada a ' + ids.length + ' questões');
  };
}

/* ---------- formulário (nova / editar / duplicar) ---------- */
function openForm(mode, q){ A.editing = {mode, q}; A.tab = 'nova'; A.ui.formDirty = false; A.render(); }
A.openNew = () => { A.editing = null; };

A.renderForm = function(v){
  const ed = A.editing, src = ed ? ed.q : null, mode = ed ? ed.mode : 'new';
  const q = src ? JSON.parse(JSON.stringify(src)) : {tipo: 'objetiva', dificuldade: 'medio', alternativas: ['', '', '', ''], corretaIndex: 0, imagens: [], linhasResposta: 6};
  if (!q.alternativas || !q.alternativas.length) q.alternativas = ['', '', '', ''];
  const imgs = (q.imagens || []).slice();
  const criada = mode === 'edit' ? A.dateKey(q.criadoEm) : A.today();
  const titulo = mode === 'edit' ? 'Editar questão' : mode === 'dup' ? 'Nova questão a partir de ' + esc(src.id) + ' (duplicada)' : 'Nova questão';
  v.innerHTML = '<div class="card"><h2 style="margin-top:0">' + titulo + '</h2>' +
    (mode === 'dup' ? '<div class="banner">Os campos foram copiados. Altere o que for preciso e salve — a original permanece intacta.</div>' : '') +
    '<div class="row"><div class="field grow"><label>Tema</label><input type="text" id="fmTema" list="dlTemas" value="' + esc(q.tema || '') + '"><datalist id="dlTemas">' + A.temas().map(t => '<option value="' + esc(t) + '">').join('') + '</datalist></div>' +
    '<div class="field"><label>Tipo</label><select id="fmTipo"><option value="objetiva">Objetiva</option><option value="discursiva">Discursiva (aberta)</option></select></div>' +
    '<div class="field"><label>Dificuldade</label><select id="fmDif"><option value="facil">Fácil</option><option value="medio">Médio</option><option value="dificil">Difícil</option></select></div>' +
    '<div class="field"><label>Data de criação</label><input type="date" id="fmData" value="' + criada + '"></div></div><br>' +
    '<div class="field"><label>Enunciado</label><textarea id="fmEnun" rows="5">' + esc(q.enunciado || '') + '</textarea></div><br>' +
    '<div class="field"><label>Imagens do enunciado</label><div id="imgList"></div><input type="file" id="fmFile" accept="image/*" multiple><span class="muted" style="font-size:12px">As imagens ficam num armazenamento privado, visível só para professores logados.</span></div><br>' +
    '<div id="boxObj"><label>Alternativas (marque a correta — a ordem é embaralhada na prova)</label><div id="altList"></div><button class="btn secondary small" id="addAlt" type="button">+ alternativa</button></div>' +
    '<div id="boxDisc" style="display:none"><div class="field" style="max-width:220px"><label>Linhas de resposta na prova</label><input type="number" id="fmLinhas" min="2" max="40" value="' + (q.linhasResposta || 6) + '"></div></div><br>' +
    '<div class="field"><label id="lbDisc">Discussão / justificativa</label><textarea id="fmDisc" rows="4">' + esc(q.discussao || '') + '</textarea></div><br>' +
    '<div class="row"><div class="field grow"><label>Referência</label><input type="text" id="fmRef" value="' + esc(q.referencia || '') + '"></div>' +
    '<div class="field grow"><label>Elaborada por</label><input type="text" id="fmAut" value="' + esc(q.elaboradoPor || A.staff.nome || '') + '"></div></div><br>' +
    '<label style="display:flex;gap:6px;align-items:center;color:var(--text)"><input type="checkbox" id="fmRevChk"' + (q.precisaRevisao ? ' checked' : '') + '> Precisa de revisão</label>' +
    '<div class="field" style="margin-top:6px"><input type="text" id="fmMotivo" placeholder="motivo" value="' + esc(q.motivoRevisao || '') + '"></div><br>' +
    '<div class="err" id="fmErr"></div><button class="btn" id="fmSave">Salvar questão</button> <button class="btn secondary" id="fmCancel">Cancelar</button></div>';
  const $ = s => A.$(s, v);
  $('#fmTipo').value = q.tipo || 'objetiva'; $('#fmDif').value = q.dificuldade || 'medio';
  let alts = q.alternativas.slice(), correta = q.corretaIndex == null ? 0 : q.corretaIndex;
  const dirty = () => { A.ui.formDirty = true; };
  v.addEventListener('input', dirty);
  const drawImgs = () => {
    $('#imgList').innerHTML = imgs.map((im, i) => '<div class="img-item"><img data-path="' + esc(im.path) + '" alt=""><input type="text" data-cap="' + i + '" placeholder="legenda (opcional)" value="' + esc(im.legenda || '') + '"><button class="icon-btn danger" type="button" data-rm="' + i + '">✕</button></div>').join('');
    A.hydrateImgs($('#imgList'));
    A.$$('[data-cap]', v).forEach(i => i.oninput = () => imgs[+i.dataset.cap].legenda = i.value);
    A.$$('[data-rm]', v).forEach(b => b.onclick = () => { imgs.splice(+b.dataset.rm, 1); drawImgs(); dirty(); });
  };
  const drawAlts = () => {
    $('#altList').innerHTML = alts.map((a, i) => '<div class="alt-row"><span class="alt-letter">' + String.fromCharCode(65 + i) + '</span><textarea data-alt="' + i + '" rows="2">' + esc(a) + '</textarea>' +
      '<label style="display:flex;gap:4px;align-items:center;margin-top:8px;color:var(--text)"><input type="radio" name="corr" data-corr="' + i + '"' + (i === correta ? ' checked' : '') + '> correta</label>' +
      (alts.length > 2 ? '<button class="icon-btn danger" type="button" data-del="' + i + '">✕</button>' : '') + '</div>').join('');
    A.$$('[data-alt]', v).forEach(t => t.oninput = () => alts[+t.dataset.alt] = t.value);
    A.$$('[data-corr]', v).forEach(r => r.onchange = () => correta = +r.dataset.corr);
    A.$$('[data-del]', v).forEach(b => b.onclick = () => { const i = +b.dataset.del; alts.splice(i, 1); if (correta === i) correta = 0; else if (correta > i) correta--; drawAlts(); });
  };
  const tipoUI = () => {
    const d = $('#fmTipo').value === 'discursiva';
    $('#boxObj').style.display = d ? 'none' : ''; $('#boxDisc').style.display = d ? '' : 'none';
    $('#lbDisc').textContent = d ? 'Resposta esperada / critérios de correção' : 'Discussão / justificativa';
  };
  $('#fmTipo').onchange = tipoUI; tipoUI(); drawAlts(); drawImgs();
  $('#addAlt').onclick = () => { alts.push(''); drawAlts(); };
  $('#fmFile').onchange = async e => {
    for (const f of e.target.files) {
      try { A.toast('Enviando imagem…'); imgs.push({path: await A.uploadImage(f), legenda: ''}); } catch (er) { A.toast('Erro na imagem: ' + er.message, 4500); }
    }
    e.target.value = ''; drawImgs(); dirty();
  };
  $('#fmCancel').onclick = () => { A.editing = null; A.ui.formDirty = false; A.tab = 'banco'; A.render(); };
  $('#fmSave').onclick = async () => {
    const tipo = $('#fmTipo').value, enun = $('#fmEnun').value.trim(), err = $('#fmErr');
    if (!enun) { err.textContent = 'Preencha o enunciado.'; return; }
    if (!$('#fmTema').value.trim()) { err.textContent = 'Informe o tema.'; return; }
    let alternativas = [], ci = null;
    if (tipo === 'objetiva') {
      const keep = alts.map((a, i) => ({a: a.trim(), i})).filter(x => x.a);
      if (keep.length < 2) { err.textContent = 'Informe ao menos 2 alternativas.'; return; }
      const k = keep.findIndex(x => x.i === correta);
      if (k < 0) { err.textContent = 'A alternativa correta está vazia.'; return; }
      alternativas = keep.map(x => x.a); ci = k;
    }
    if (!$('#fmDisc').value.trim() && !await A.confirm('Sem discussão/resposta esperada. Salvar assim mesmo?', 'Salvar')) return;
    const now = new Date().toISOString();
    const base = mode === 'edit' ? src : {};
    const row = Object.assign({}, base, {
      id: mode === 'edit' ? src.id : A.disc.id + '-' + A.uid(),
      tema: $('#fmTema').value.trim(), tipo, dificuldade: $('#fmDif').value, enunciado: enun,
      imagens: imgs, alternativas, corretaIndex: ci, linhasResposta: +$('#fmLinhas').value || 6,
      discussao: $('#fmDisc').value.trim(), referencia: $('#fmRef').value.trim(), elaboradoPor: $('#fmAut').value.trim(),
      precisaRevisao: $('#fmRevChk').checked, motivoRevisao: $('#fmMotivo').value.trim(),
      criadoEm: ($('#fmData').value || A.today()) + 'T12:00:00Z', atualizadoEm: now,
    });
    if (mode !== 'edit') {
      Object.assign(row, {origem: mode === 'dup' ? 'duplicada' : 'manual', duplicadaDe: mode === 'dup' ? src.id : null, criadoPor: A.email(), usadoAnteriormente: false, historicoUso: []});
      delete row.idOriginal; delete row.numeroOriginal;
    }
    try { await A.upsert(A.T().questoes, row); } catch (e) { err.textContent = 'Erro ao salvar: ' + e.message; return; }
    const i = A.questoes.findIndex(x => x.id === row.id); if (i >= 0) A.questoes[i] = row; else A.questoes.push(row);
    A.editing = null; A.ui.formDirty = false; A.tab = 'banco'; A.render(); A.toast('Questão salva');
  };
};
})();
