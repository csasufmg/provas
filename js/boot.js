/* boot.js — inicialização, login, troca de disciplina */
(function(){
const A = window.App, $ = s => document.querySelector(s);
function showLogin(msg){ $('#app').style.display = 'none'; $('#login').style.display = 'flex'; $('#lgErr').textContent = msg || ''; }
async function start(){
  const sel = $('#discSel');
  sel.innerHTML = A.C.disciplinas.map(d => '<option value="' + d.id + '">' + d.sigla + '</option>').join('');
  let saved = null; try { saved = localStorage.getItem('disc'); } catch (e) {}
  A.disc = A.C.disciplinas.find(d => d.id === saved) || A.C.disciplinas[0]; sel.value = A.disc.id;
  $('#who').textContent = (A.staff.nome || A.email()) + ' · ' + (A.isCoord() ? 'coordenação' : 'professor');
  $('#login').style.display = 'none'; $('#app').style.display = 'block';
  A.tab = 'banco';
  try { await A.loadAll(); } catch (e) { A.toast('Erro ao carregar: ' + e.message, 6000); }
  A.subscribe(); A.render();
}
async function boot(){
  A.init();
  const r = await A.checkSession();
  if (r.ok) start(); else showLogin(r.msg);
}
document.addEventListener('DOMContentLoaded', () => {
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); $('#lgErr').textContent = '';
    try { await A.login($('#lgEmail').value, $('#lgPass').value); } catch (er) { return $('#lgErr').textContent = 'E-mail ou senha incorretos.'; }
    const r = await A.checkSession();
    if (r.ok) start(); else showLogin(r.msg);
  });
  $('#btnOut').onclick = async () => { await A.logout(); showLogin(''); };
  $('#discSel').onchange = async e => {
    A.disc = A.C.disciplinas.find(d => d.id === e.target.value);
    try { localStorage.setItem('disc', A.disc.id); } catch (er) {}
    A.gen = null; A.openProvaId = null; A.editing = null; A.draft = {}; A.tab = 'banco';
    try { await A.loadAll(); } catch (er) { A.toast('Erro: ' + er.message, 5000); }
    A.subscribe(); A.render();
  };
  boot();
});
})();
