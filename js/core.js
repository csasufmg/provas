/* core.js — estado, utilitários, autenticação, dados, imagens */
(function(){
const C = window.APP_CONFIG;
const App = window.App = {
  C, sb: null, user: null, staff: null,
  disc: null, tab: 'banco',
  questoes: [], provas: [], revisoes: [], equipe: [],
  draft: {},          // rascunhos de pareceres (não perder ao re-renderizar)
  gen: null,          // rascunho de geração de prova
  ui: { modalOpen: false, formDirty: false },
};

/* ---------- utilitários ---------- */
App.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
App.nl2br = s => App.esc(s).replace(/\n/g, '<br>');
App.uid = () => (crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14));
App.shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
App.today = () => new Date().toISOString().slice(0, 10);
App.fmtDate = d => { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('pt-BR'); };
App.dateKey = d => { if (!d) return ''; const x = new Date(d); if (isNaN(x)) return ''; return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
App.difLabel = d => ({facil: 'Fácil', medio: 'Médio', dificil: 'Difícil'}[d] || d || '—');
App.tipoLabel = t => t === 'discursiva' ? 'Discursiva' : 'Objetiva';
App.$ = (s, r) => (r || document).querySelector(s);
App.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
App.isCoord = () => !!App.staff && App.staff.papel === 'coordenacao';
App.email = () => (App.user && App.user.email || '').toLowerCase();
App.T = () => App.disc.tabelas;

let toastT;
App.toast = (m, ms) => { const t = App.$('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms || 2600); };

App.modal = function(html, opts){
  const root = App.$('#modalRoot');
  root.innerHTML = '<div class="modal-backdrop"><div class="modal" style="' + ((opts && opts.wide) ? 'max-width:900px' : '') + '"><button class="close-x" data-close>×</button>' + html + '</div></div>';
  App.ui.modalOpen = true;
  const el = root.firstElementChild;
  el.addEventListener('mousedown', e => { if (e.target === el) App.closeModal(); });
  App.$$('[data-close]', el).forEach(b => b.addEventListener('click', App.closeModal));
  App.hydrateImgs(el);
  return el.firstElementChild;
};
App.closeModal = () => { App.$('#modalRoot').innerHTML = ''; App.ui.modalOpen = false; };
App.confirm = (msg, okLabel) => new Promise(res => {
  const m = App.modal('<h2>Confirmar</h2><p>' + App.esc(msg) + '</p><div class="flex-between"><span></span><span><button class="btn secondary" data-no>Cancelar</button> <button class="btn danger" data-yes>' + App.esc(okLabel || 'Confirmar') + '</button></span></div>');
  m.querySelector('[data-no]').onclick = () => { App.closeModal(); res(false); };
  m.querySelector('[data-close]').addEventListener('click', () => res(false));
  m.querySelector('[data-yes]').onclick = () => { App.closeModal(); res(true); };
});

App.download = function(filename, content, mime){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], {type: mime || 'text/plain'}));
  a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
};

/* ---------- Supabase / autenticação ---------- */
App.init = function(){
  App.sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {auth: {persistSession: true, autoRefreshToken: true}});
};

App.login = async function(email, pass){
  const {error} = await App.sb.auth.signInWithPassword({email: email.trim().toLowerCase(), password: pass});
  if (error) throw error;
};
App.logout = async function(){
  App.unsubscribe();
  await App.sb.auth.signOut();
  App.user = null; App.staff = null; App.questoes = []; App.provas = []; App.revisoes = []; App.equipe = [];
};

// retorna true se há sessão e o e-mail está autorizado
App.checkSession = async function(){
  const {data} = await App.sb.auth.getSession();
  if (!data.session) return {ok: false};
  App.user = data.session.user;
  const {data: rows, error} = await App.sb.from('professores').select('*').eq('email', App.email()).limit(1);
  if (error) return {ok: false, msg: 'Erro ao verificar autorização: ' + error.message + ' (o SQL de segurança já foi executado?)'};
  const p = rows && rows[0];
  if (!p || !p.ativo) {
    await App.sb.auth.signOut(); App.user = null;
    return {ok: false, msg: 'Este e-mail não está autorizado a usar o banco. Fale com a coordenação.'};
  }
  App.staff = p;
  return {ok: true};
};

/* ---------- carga de dados ---------- */
async function fetchAll(table, order){
  let all = [], from = 0; const step = 1000;
  for (;;) {
    let q = App.sb.from(table).select('*').range(from, from + step - 1);
    if (order) q = q.order(order, {ascending: true});
    const {data, error} = await q;
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < step) break;
    from += step;
  }
  return all;
}
App.loadAll = async function(){
  const t = App.T();
  const [q, p, r] = await Promise.all([fetchAll(t.questoes, 'id'), fetchAll(t.provas, 'criadoEm'), fetchAll(t.revisoes, 'criadoEm')]);
  App.questoes = q; App.provas = p; App.revisoes = r;
  if (App.isCoord()) App.equipe = await fetchAll('professores', 'email');
};
App.loadQuestoes = async () => { App.questoes = await fetchAll(App.T().questoes, 'id'); };
App.loadProvas = async () => { App.provas = await fetchAll(App.T().provas, 'criadoEm'); };
App.loadRevisoes = async () => { App.revisoes = await fetchAll(App.T().revisoes, 'criadoEm'); };
App.loadEquipe = async () => { if (App.isCoord()) App.equipe = await fetchAll('professores', 'email'); };

App.upsert = async function(table, row){
  const {error} = await App.sb.from(table).upsert(row);
  if (error) throw error;
};

/* ---------- tempo real ---------- */
let channel = null, rtTimer = null;
App.unsubscribe = () => { if (channel) { App.sb.removeChannel(channel); channel = null; } };
App.subscribe = function(){
  App.unsubscribe();
  const t = App.T();
  channel = App.sb.channel('rt-' + App.disc.id);
  [t.questoes, t.provas, t.revisoes].forEach(tb => channel.on('postgres_changes', {event: '*', schema: 'public', table: tb}, () => {
    clearTimeout(rtTimer);
    rtTimer = setTimeout(async () => {
      if (App.ui.modalOpen || App.ui.formDirty) { App.pendingReload = true; return; }
      try { await App.loadAll(); App.render(true); } catch (e) { console.warn(e); }
    }, 600);
  }));
  channel.subscribe();
};

/* ---------- imagens (bucket privado, URLs assinadas) ---------- */
const urlCache = {};
App.signedUrl = async function(path){
  const c = urlCache[path];
  if (c && c.exp > Date.now()) return c.url;
  const {data, error} = await App.sb.storage.from(C.bucket).createSignedUrl(path, 3600);
  if (error || !data) return '';
  urlCache[path] = {url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000};
  return data.signedUrl;
};
// preenche <img data-path="..."> dentro de um elemento e espera carregar
App.hydrateImgs = async function(root){
  const imgs = App.$$('img[data-path]', root).filter(i => !i.getAttribute('src'));
  await Promise.all(imgs.map(async img => {
    const u = await App.signedUrl(img.dataset.path);
    if (!u) return;
    await new Promise(r => { img.onload = img.onerror = r; img.src = u; });
  }));
};
async function reduce(file){
  if (file.size < 2.5e6 || /gif|svg/.test(file.type)) return file;
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return await new Promise(r => cv.toBlob(b => r(b), 'image/jpeg', .88));
}
App.uploadImage = async function(file){
  if (!/^image\//.test(file.type)) throw new Error('Arquivo não é imagem.');
  const blob = await reduce(file);
  const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const path = App.disc.id + '/' + App.uid() + '.' + ext;
  const {error} = await App.sb.storage.from(C.bucket).upload(path, blob, {contentType: blob.type, upsert: false});
  if (error) throw error;
  return path;
};

/* ---------- navegação ---------- */
App.tabs = function(){
  const t = [['banco', 'Banco'], ['nova', 'Nova questão']];
  if (App.isCoord()) t.push(['gerar', 'Gerar prova']);
  t.push(['provas', 'Provas']);
  if (App.isCoord()) t.push(['equipe', 'Equipe']);
  return t;
};
App.pendenciasMinhas = function(){
  // número de questões a avaliar por mim em provas ainda não enviadas
  const me = App.email(); let n = 0;
  App.provas.forEach(p => {
    if (p.enviadaImpressaoEm || !(p.revisores || []).includes(me)) return;
    allQuestoes(p).forEach(q => { if (!App.revisoes.some(r => r.prova_id === p.id && r.questao_id === q.id && r.professor === me)) n++; });
  });
  return n;
};
function allQuestoes(p){ return (p.questoes || []).concat(p.questoesDiscursivas || []); }
App.allQuestoes = allQuestoes;

App.renderTabs = function(){
  const nav = App.$('#tabs'); const pend = App.pendenciasMinhas();
  nav.innerHTML = App.tabs().map(([id, l]) => '<button data-tab="' + id + '" class="' + (App.tab === id ? 'active' : '') + '">' + l + (id === 'provas' && pend ? '<span class="tab-count">' + pend + '</span>' : '') + '</button>').join('');
  App.$$('button', nav).forEach(b => b.onclick = () => { App.tab = b.dataset.tab; if (App.tab === 'nova') App.editing = null; App.openProvaId = null; App.ui.formDirty = false; App.render(); });
};
App.render = function(soft){
  App.renderTabs();
  const v = App.$('#view'); v.onclick = null; v.onchange = null;
  const fn = {banco: App.renderBanco, nova: App.renderForm, gerar: App.renderGerar, provas: App.renderProvas, equipe: App.renderEquipe}[App.tab];
  if (soft && (App.tab === 'nova' || App.tab === 'gerar')) return; // não apaga o que está sendo digitado
  if (fn) fn(v);
};
})();
