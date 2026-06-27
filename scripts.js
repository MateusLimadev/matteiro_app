/* ============================================================
   MATTEIRO — scripts.js  (Supabase edition)
   Banco de dados: Supabase (PostgreSQL)
   Auth: Supabase Auth (email/senha com confirmação)
   ============================================================ */

// --- Supabase client ----------------------------------------
const SUPABASE_URL = 'https://bmdeefzvunqxmbxprgds.supabase.co';
const SUPABASE_KEY = 'sb_publishable_kdor7kz8Mj0LeLz-EhJ80g_QzQy9FR8';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- State --------------------------------------------------
const S = {
  user:   null,   // { id, email, nome }
  month:  new Date().getMonth() + 1,
  year:   new Date().getFullYear(),
  cats:   [],
  rate:   null,
  charts: {}
};

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

const DEFAULT_CATEGORIES = [
  { nome: 'Salário',          tipo: 'entrada', cor: '#4CAF50' },
  { nome: 'Freelance',        tipo: 'entrada', cor: '#8BC34A' },
  { nome: 'Investimentos',    tipo: 'entrada', cor: '#009688' },
  { nome: 'João',             tipo: 'entrada', cor: '#EC4899' },
  { nome: 'Outros (entrada)', tipo: 'entrada', cor: '#00BCD4' },
  { nome: 'Moradia',          tipo: 'saida',   cor: '#EF5350' },
  { nome: 'Alimentação',      tipo: 'saida',   cor: '#FF5722' },
  { nome: 'Transporte',       tipo: 'saida',   cor: '#FF9800' },
  { nome: 'Saúde',            tipo: 'saida',   cor: '#E91E63' },
  { nome: 'Educação',         tipo: 'saida',   cor: '#9C27B0' },
  { nome: 'Lazer',            tipo: 'saida',   cor: '#3F51B5' },
  { nome: 'Assinaturas',      tipo: 'saida',   cor: '#2196F3' },
  { nome: 'Cartão de Crédito', tipo: 'saida',  cor: '#0EA5E9' },
  { nome: 'Pets',             tipo: 'saida',   cor: '#F59E0B' },
  { nome: 'João',             tipo: 'saida',   cor: '#EC4899' },
  { nome: 'Outros (saída)',   tipo: 'saida',   cor: '#607D8B' },
];

// --- Init ---------------------------------------------------
window.addEventListener('load', async () => {
  // Timeout de segurança — se travar por mais de 6s, mostra auth
  const safetyTimer = setTimeout(() => {
    console.warn('Timeout na inicialização — verifique se está rodando em http:// e não em file://');
    showAuth();
  }, 6000);

  try {
    const { data: { session }, error } = await sb.auth.getSession();

    clearTimeout(safetyTimer);

    if (error) throw error;

    if (session) {
      _setUser(session.user);
      showApp();
    } else {
      showAuth();
    }

    // Reage a mudanças de auth (ex: sessão expirada)
    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        S.user = null;
        S.cats = [];
        showAuth();
      }
    });

  } catch (err) {
    clearTimeout(safetyTimer);
    console.error('Erro ao inicializar:', err);
    showAuth();
  }
});

function _setUser(user) {
  S.user = {
    id:    user.id,
    email: user.email,
    nome:  user.user_metadata?.nome || user.email.split('@')[0]
  };
}

// --- Auth ---------------------------------------------------

function showAuth() {
  hide('loading');
  show('auth-wrap');
  hide('app-wrap');
  showScreen('screen-login');
}

function showApp() {
  hide('loading');
  hide('auth-wrap');
  show('app-wrap');
  const nome = S.user.nome.split(' ')[0];
  const nameEl = el('user-name-dash');
  if (nameEl) nameEl.textContent = nome;
  const sbName = el('sb-user-name');
  if (sbName) sbName.textContent = nome;
  const sbAvatar = el('sb-user-avatar');
  if (sbAvatar) sbAvatar.textContent = (S.user.nome || nome).split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase().slice(0,2);
  updateMonthLabel();
  loadCategories(() => loadDashboard());
  _applyTheme(localStorage.getItem('matteiro-theme') || 'dark');
}

function showScreen(id) {
  qsa('.auth-screen').forEach(s => s.classList.add('hidden'));
  el(id).classList.remove('hidden');
}

// --- Theme --------------------------------------------------

const _SVG_MOON = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
const _SVG_SUN  = `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`;

function _applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('matteiro-theme', theme);
  const isDark  = theme === 'dark';
  const svgPath = isDark ? _SVG_MOON : _SVG_SUN;
  const label   = isDark ? 'Modo escuro' : 'Modo claro';

  const sbIcon  = el('sb-theme-icon');
  const sbLabel = el('sb-theme-label');
  const mobIcon = el('mobile-theme-icon');

  if (sbIcon)  sbIcon.innerHTML  = svgPath;
  if (sbLabel) sbLabel.textContent = label;
  // Mobile: show opposite (sun when dark, moon when light)
  if (mobIcon) mobIcon.innerHTML = isDark ? _SVG_SUN : _SVG_MOON;
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  _applyTheme(current === 'dark' ? 'light' : 'dark');
}

// Register
async function handleRegister(e) {
  e.preventDefault();
  const nome   = el('reg-nome').value.trim();
  const email  = el('reg-email').value.trim();
  const senha  = el('reg-senha').value;
  const senha2 = el('reg-senha2').value;
  const btn    = el('btn-register');

  hideError('reg-error');

  if (senha !== senha2) { showError('reg-error', 'As senhas não coincidem.'); return; }
  if (senha.length < 8)  { showError('reg-error', 'A senha deve ter pelo menos 8 caracteres.'); return; }

  btn.disabled = true;
  btn.textContent = 'Criando conta…';

  const { error } = await sb.auth.signUp({
    email,
    password: senha,
    options: { data: { nome } }
  });

  btn.disabled = false;
  btn.textContent = 'Criar conta';

  if (error) {
    showError('reg-error', _authError(error.message));
    return;
  }

  toast('Conta criada! Verifique seu email para confirmar o acesso.', 6000);
  showScreen('screen-login');
  el('form-register').reset();
}

// Login
async function handleLogin(e) {
  e.preventDefault();
  const email = el('login-email').value.trim();
  const senha = el('login-senha').value;
  const btn   = el('btn-login');

  hideError('login-error');
  btn.disabled = true;
  btn.textContent = 'Entrando…';

  const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });

  btn.disabled = false;
  btn.textContent = 'Entrar';

  if (error) {
    showError('login-error', _authError(error.message));
    return;
  }

  _setUser(data.user);
  showApp();
}

// Logout
async function handleLogout() {
  await sb.auth.signOut();
  // onAuthStateChange cuida de mostrar a tela de auth
}

// Forgot password
async function handleForgot(e) {
  e.preventDefault();
  const email = el('forgot-email').value.trim();
  const btn   = el('btn-forgot');

  btn.disabled = true;
  btn.textContent = 'Enviando…';

  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });

  btn.disabled = false;
  btn.textContent = 'Enviar link';

  const msgEl = el('forgot-msg');
  msgEl.textContent = error
    ? _authError(error.message)
    : 'Se este email existir, você receberá as instruções.';
  msgEl.className = error ? 'form-error' : 'form-success';
  msgEl.classList.remove('hidden');
}

// Traduz erros do Supabase para português
function _authError(msg) {
  const map = {
    'Invalid login credentials':                   'Email ou senha incorretos.',
    'Email not confirmed':                         'Email não confirmado. Verifique sua caixa de entrada.',
    'User already registered':                     'Este email já está cadastrado.',
    'Password should be at least 6 characters':    'A senha deve ter pelo menos 8 caracteres.',
    'Unable to validate email address: invalid format': 'Email inválido.',
    'For security purposes, you can only request this once every 60 seconds':
      'Aguarde 60 segundos antes de tentar novamente.',
    'Internal Server Error':                       'Erro no servidor. Tente novamente em instantes.',
  };
  const str = typeof msg === 'string' ? msg : (msg ? String(msg) : '');
  return map[str] || str || 'Erro inesperado. Tente novamente.';
}

// --- Navigation ---------------------------------------------

function switchTab(name, btn) {
  qsa('.tab-screen').forEach(s => s.classList.remove('active'));
  qsa('.nav-item, .sb-item').forEach(b => b.classList.remove('active'));
  el('tab-' + name).classList.add('active');
  qsa(`[data-tab="${name}"]`).forEach(b => b.classList.add('active'));

  if (typeof _updateTopbar === 'function') _updateTopbar(name);

  if (name === 'dashboard')   loadDashboard();
  if (name === 'nova')        prepareNovaForm();
  if (name === 'recorrentes') loadRecorrentes();
  if (name === 'relatorio')   loadRelatorio();
}

// --- Month navigation ---------------------------------------

function changeMonth(delta) {
  S.month += delta;
  if (S.month > 12) { S.month = 1;  S.year++; }
  if (S.month < 1)  { S.month = 12; S.year--; }
  updateMonthLabel();

  const active = document.querySelector('.tab-screen.active');
  if (active?.id === 'tab-dashboard') loadDashboard();
  if (active?.id === 'tab-relatorio') loadRelatorio();
}

function updateMonthLabel() {
  const label = `${MONTHS[S.month - 1]} ${S.year}`;
  ['month-label', 'rel-month-label'].forEach(id => {
    const e = el(id);
    if (e) e.textContent = label;
  });
  const ry = el('rel-year');
  if (ry) ry.textContent = S.year;
}

// --- Dashboard ----------------------------------------------

let _allTxs    = [];   // cache das transações do mês
let _txFilter  = 'todos'; // 'todos' | 'entrada' | 'saida'

async function loadDashboard() {
  const txs = await _fetchTransactions(S.month, S.year);
  if (txs === null) return;

  _allTxs = txs;

  let totalEntradas = 0, totalSaidas = 0;

  txs.forEach(t => {
    const v = parseFloat(t.valor_brl) || 0;
    if (t.tipo === 'entrada') totalEntradas += v;
    else                      totalSaidas   += v;
  });

  const saldo = totalEntradas - totalSaidas;

  el('stat-saldo').textContent    = fmt(saldo);
  el('stat-saldo').className      = 'hero-amount ' + (saldo >= 0 ? 'positive' : 'negative');
  el('stat-entradas').textContent = fmt(totalEntradas);
  el('stat-saidas').textContent   = fmt(totalSaidas);

  // Hero badge: mostra % de economia
  const badgeEl = el('hero-badge');
  if (badgeEl && totalEntradas > 0) {
    const pct = Math.round((saldo / totalEntradas) * 100);
    badgeEl.textContent = (pct >= 0 ? '▲ ' : '▼ ') + Math.abs(pct) + '% guardado';
    badgeEl.className = 'hero-badge' + (pct >= 0 ? '' : ' negative');
    badgeEl.classList.remove('hidden');
  } else if (badgeEl) {
    badgeEl.classList.add('hidden');
  }

  // Upcoming bills (next 7 days)
  const recs  = await _fetchRecorrentes();
  const today = new Date().getDate();
  const upcoming = (recs || []).filter(r => r.ativo
    && parseInt(r.dia_vencimento) >= today
    && parseInt(r.dia_vencimento) <= today + 7);

  const upWrap = el('upcoming-wrap');
  if (upcoming.length > 0) {
    upWrap.classList.remove('hidden');
    el('upcoming-list').innerHTML = upcoming.map(r => `
      <div class="upcoming-item">
        <span>${esc(r.descricao)}</span>
        <span class="up-dia">Dia ${r.dia_vencimento} · ${fmt(r.valor)}</span>
      </div>
    `).join('');
  } else {
    upWrap.classList.add('hidden');
  }

  _renderTxList();
}

function filterTx(tipo) {
  _txFilter = tipo;

  // Atualiza botões ativos
  ['todos', 'saida', 'entrada'].forEach(t => {
    const btn = el('filter-' + t);
    if (btn) btn.classList.toggle('active', t === tipo);
  });

  _renderTxList();
}

function _renderTxList() {
  const list = el('recent-list');

  const visible = _txFilter === 'todos'
    ? _allTxs
    : _allTxs.filter(t => t.tipo === _txFilter);

  if (!visible.length) {
    const msg = _txFilter === 'todos'
      ? 'Nenhuma transação neste mês.'
      : _txFilter === 'saida'
        ? 'Nenhuma saída neste mês.'
        : 'Nenhuma entrada neste mês.';
    list.innerHTML = `<p class="empty-state">${msg}</p>`;
    return;
  }

  list.innerHTML = visible.map(txRow).join('');
}

function txRow(t) {
  const initials = (t.descricao || '?').slice(0, 2).toUpperCase();
  return `
    <div class="tx-item" id="txrow-dash-${t.id}">
      <div class="tx-avatar ${t.tipo}">${initials}</div>
      <div class="tx-info">
        <div class="tx-desc">${esc(t.descricao)}</div>
        <div class="tx-meta">${esc(t.categoria)} · ${fmtDate(t.data)}</div>
      </div>
      <div class="tx-right">
        <span class="tx-valor ${t.tipo}">${t.tipo === 'entrada' ? '+' : '-'} ${fmt(t.valor_brl)}</span>
        <button class="tx-edit-btn" onclick="startEditTx('${t.id}','${esc(t.descricao)}','${esc(t.categoria)}','${t.tipo}','${t.data}')" title="Editar">✎</button>
        <button class="tx-del" onclick="deleteTx('${t.id}')" title="Excluir">✕</button>
      </div>
    </div>
  `;
}

function startEditTx(id, descricao, categoria, tipo, data) {
  const row = el('txrow-dash-' + id);
  if (!row) return;

  const catOptions = S.cats
    .filter(c => c.tipo === tipo)
    .map(c => `<option value="${esc(c.nome)}" ${c.nome === categoria ? 'selected' : ''}>${esc(c.nome)}</option>`)
    .join('');

  // data vem como 'YYYY-MM-DD'
  const dataVal = data ? data.split('T')[0] : '';

  row.classList.add('tx-item--editing');
  row.innerHTML = `
    <div class="tx-edit-form">
      <input type="text" class="tx-edit-input" id="tx-edit-desc-${id}"
        value="${esc(descricao)}" placeholder="Descrição"
        onkeydown="if(event.key==='Enter') saveTxEdit('${id}','${tipo}'); if(event.key==='Escape') cancelTxEdit('${id}')">
      <div class="tx-edit-row2">
        <select class="cat-inline-select tx-edit-cat" id="tx-edit-cat-${id}">
          ${catOptions}
        </select>
        <input type="date" class="tx-edit-input tx-edit-date" id="tx-edit-data-${id}" value="${dataVal}">
      </div>
      <div class="tx-edit-actions">
        <button class="valor-save-btn" onclick="saveTxEdit('${id}','${tipo}')">Salvar</button>
        <button class="tx-edit-cancel" onclick="cancelTxEdit('${id}')">Cancelar</button>
      </div>
    </div>
  `;

  el('tx-edit-desc-' + id)?.focus();
}

async function saveTxEdit(id, tipo) {
  const descEl = el('tx-edit-desc-' + id);
  const catEl  = el('tx-edit-cat-'  + id);
  const dataEl = el('tx-edit-data-' + id);
  if (!descEl || !catEl) return;

  const newDesc = descEl.value.trim();
  const newCat  = catEl.value;
  const newData = dataEl ? dataEl.value : null;

  if (!newDesc) { toast('Descrição não pode ser vazia.'); return; }
  if (!newData) { toast('Data não pode ser vazia.'); return; }

  descEl.disabled = catEl.disabled = true;
  if (dataEl) dataEl.disabled = true;

  const updates = { descricao: newDesc, categoria: newCat, data: newData };

  const { error } = await sb.from('transacoes')
    .update(updates)
    .eq('id', id);

  if (error) {
    toast('Erro ao salvar.');
    descEl.disabled = catEl.disabled = false;
    if (dataEl) dataEl.disabled = false;
    return;
  }

  // Atualiza caches
  for (const cache of [_allTxs, _relMonthTxs]) {
    const tx = cache.find(t => t.id === id);
    if (tx) { tx.descricao = newDesc; tx.categoria = newCat; tx.data = newData; }
  }

  toast('Atualizado. ✓');
  _renderTxList();
}

function cancelTxEdit(id) {
  _renderTxList();
}

async function deleteTx(id) {
  if (!confirm('Excluir esta transação?')) return;
  const { error } = await sb.from('transacoes').delete().eq('id', id);
  if (!error) { toast('Transação excluída.'); loadDashboard(); }
  else toast('Erro ao excluir.');
}

// --- Nova Transação -----------------------------------------

let _tipo = 'saida';

function setTipo(tipo) {
  _tipo = tipo;
  ['entrada', 'saida'].forEach(t =>
    el('btn-tipo-' + t).classList.toggle('active', t === tipo)
  );
  populateCatSelect('tx-categoria', tipo);
}

function prepareNovaForm() {
  el('tx-data').value = new Date().toISOString().split('T')[0];
  setTipo('saida');
  el('usd-preview').classList.add('hidden');
}

function onMoedaChange() {
  const isUsd = el('tx-moeda').value === 'USD';
  el('usd-preview').classList.toggle('hidden', !isUsd);
  if (isUsd) updateUsdPreview();
}

async function updateUsdPreview() {
  if (!S.rate) S.rate = await getExchangeRate();
  const valor = parseFloat(el('tx-valor').value) || 0;
  if (!valor) return;
  el('usd-converted').textContent = `≈ ${fmt(valor * S.rate)} (cotação: ${S.rate.toFixed(4)})`;
}

el('tx-valor').addEventListener('input', () => {
  if (el('tx-moeda').value === 'USD') updateUsdPreview();
});

async function handleAddTransaction(e) {
  e.preventDefault();
  hideError('nova-error');
  const btn = el('btn-nova');
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  const moeda = el('tx-moeda').value;
  const valor = parseFloat(el('tx-valor').value);
  const rate  = moeda === 'USD' ? (S.rate || await getExchangeRate()) : 1;

  const { error } = await sb.from('transacoes').insert({
    user_id:    S.user.id,
    data:       el('tx-data').value,
    tipo:       _tipo,
    descricao:  el('tx-descricao').value.trim(),
    categoria:  el('tx-categoria').value,
    valor,
    moeda,
    valor_brl:  parseFloat((valor * rate).toFixed(2)),
    recorrente: el('tx-recorrente').checked
  });

  btn.disabled = false;
  btn.textContent = 'Salvar transação';

  if (error) { showError('nova-error', 'Erro ao salvar: ' + error.message); return; }

  toast('Transação salva! ✓');
  el('form-nova').reset();
  prepareNovaForm();
}

// --- Recorrentes --------------------------------------------

function toggleAddRecorrente() {
  const wrap = el('form-rec-wrap');
  wrap.classList.toggle('hidden');
  if (!wrap.classList.contains('hidden')) populateCatSelect('rec-categoria', 'saida');
}

async function loadRecorrentes() {
  const list = await _fetchRecorrentes();
  renderRecorrentes(list || []);
}

function renderRecorrentes(list) {
  const container = el('rec-list');
  if (!list.length) {
    container.innerHTML = '<p class="empty-state">Nenhuma conta fixa cadastrada.</p>';
    return;
  }
  container.innerHTML = list.map(r => `
    <div class="rec-item ${r.ativo ? '' : 'inactive'}">
      <div class="rec-info">
        <div class="rec-desc">${esc(r.descricao)}</div>
        <div class="rec-meta">${esc(r.categoria)} · Todo dia ${r.dia_vencimento}</div>
      </div>
      <span class="rec-valor">${fmt(r.valor)}</span>
      <button class="toggle-btn ${r.ativo ? 'on' : ''}"
        onclick="toggleRec('${r.id}', ${!r.ativo}, this)"></button>
      <button class="rec-del" onclick="deleteRec('${r.id}')">✕</button>
    </div>
  `).join('');
}

async function toggleRec(id, newAtivo, btn) {
  const { error } = await sb.from('recorrentes').update({ ativo: newAtivo }).eq('id', id);
  if (!error) {
    btn.classList.toggle('on', newAtivo);
    btn.closest('.rec-item').classList.toggle('inactive', !newAtivo);
    btn.setAttribute('onclick', `toggleRec('${id}', ${!newAtivo}, this)`);
  }
}

async function deleteRec(id) {
  if (!confirm('Excluir esta conta fixa?')) return;
  const { error } = await sb.from('recorrentes').delete().eq('id', id);
  if (!error) { toast('Conta fixa excluída.'); loadRecorrentes(); }
}

async function handleAddRecorrente(e) {
  e.preventDefault();
  hideError('rec-error');
  const btn = e.submitter;
  btn.disabled = true;

  const { error } = await sb.from('recorrentes').insert({
    user_id:         S.user.id,
    descricao:       el('rec-descricao').value.trim(),
    categoria:       el('rec-categoria').value,
    valor:           parseFloat(el('rec-valor').value),
    dia_vencimento:  parseInt(el('rec-dia').value),
    ativo:           true
  });

  btn.disabled = false;

  if (error) { showError('rec-error', 'Erro ao salvar.'); return; }

  toast('Conta fixa salva! ✓');
  el('form-recorrente').reset();
  el('form-rec-wrap').classList.add('hidden');
  loadRecorrentes();
}

// --- Relatório ----------------------------------------------

let _relMonthTxs = []; // cache para filtro por categoria

async function loadRelatorio() {
  el('rel-year').textContent = S.year;
  closeCatDetail();

  const [monthTxs, yearTxs] = await Promise.all([
    _fetchTransactions(S.month, S.year),
    _fetchTransactionsYear(S.year)
  ]);

  _relMonthTxs = monthTxs || [];

  // Category donut (saidas only)
  const byCategory = {};
  _relMonthTxs.filter(t => t.tipo === 'saida').forEach(t => {
    byCategory[t.categoria] = (byCategory[t.categoria] || 0) + parseFloat(t.valor_brl);
  });
  renderCatChart(byCategory);

  // Yearly bar
  const monthly = {};
  for (let m = 1; m <= 12; m++) monthly[m] = { entradas: 0, saidas: 0 };
  (yearTxs || []).forEach(t => {
    const m = parseInt(t.data.split('-')[1], 10); // evita bug de fuso horário
    const v = parseFloat(t.valor_brl) || 0;
    if (t.tipo === 'entrada') monthly[m].entradas += v;
    else                      monthly[m].saidas   += v;
  });
  renderAnualChart(monthly);
}

let _relCurrentCat    = null;
let _relDetailFilter  = 'todos'; // 'todos' | 'entrada' | 'saida'

function showCatDetail(catName) {
  _relCurrentCat   = catName;
  _relDetailFilter = 'todos';
  _syncRelFilterBtns();
  _renderCatDetail();
  el('rel-cat-detail').classList.remove('hidden');
  el('rel-cat-detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function relFilterTx(tipo) {
  _relDetailFilter = tipo;
  _syncRelFilterBtns();
  _renderCatDetail();
}

function _syncRelFilterBtns() {
  ['todos', 'saida', 'entrada'].forEach(t => {
    const btn = el('rel-filter-' + t);
    if (btn) btn.classList.toggle('active', t === _relDetailFilter);
  });
}

function _renderCatDetail() {
  const catName = _relCurrentCat;

  let txs = _relMonthTxs.filter(t => t.categoria === catName);
  if (_relDetailFilter !== 'todos') txs = txs.filter(t => t.tipo === _relDetailFilter);

  const totalEntradas = txs.filter(t => t.tipo === 'entrada').reduce((s, t) => s + (parseFloat(t.valor_brl) || 0), 0);
  const totalSaidas   = txs.filter(t => t.tipo === 'saida'  ).reduce((s, t) => s + (parseFloat(t.valor_brl) || 0), 0);

  el('rel-detail-title').textContent = catName;
  el('rel-detail-list').innerHTML = txs.length
    ? txs.map(txRowEditable).join('')
    : '<p class="empty-state">Sem transações.</p>';

  // Total dinâmico conforme filtro
  const totalEl = el('rel-detail-total');
  if (_relDetailFilter === 'entrada') {
    totalEl.textContent = `Total entradas: ${fmt(totalEntradas)}`;
    totalEl.style.color = 'var(--green)';
  } else if (_relDetailFilter === 'saida') {
    totalEl.textContent = `Total saídas: ${fmt(totalSaidas)}`;
    totalEl.style.color = 'var(--red)';
  } else {
    const saldo = totalEntradas - totalSaidas;
    totalEl.innerHTML = `
      <span style="color:var(--green)">↓ ${fmt(totalEntradas)}</span>
      &nbsp;·&nbsp;
      <span style="color:var(--red)">↑ ${fmt(totalSaidas)}</span>
      &nbsp;·&nbsp;
      Saldo: <span style="color:${saldo >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(saldo)}</span>
    `;
    totalEl.style.color = '';
  }
}

function txRowEditable(t) {
  const initials = (t.descricao || '?').slice(0, 2).toUpperCase();
  const catOptions = S.cats
    .filter(c => c.tipo === t.tipo)
    .map(c => `<option value="${esc(c.nome)}" ${c.nome === t.categoria ? 'selected' : ''}>${esc(c.nome)}</option>`)
    .join('');

  return `
    <div class="tx-item" id="txrow-${t.id}">
      <div class="tx-avatar ${t.tipo}">${initials}</div>
      <div class="tx-info">
        <div class="tx-desc">${esc(t.descricao)}</div>
        <div class="tx-meta tx-meta--edit">
          <select class="cat-inline-select" onchange="saveTxCategory('${t.id}', this.value, this)"
            title="Alterar categoria">
            ${catOptions}
          </select>
          <span class="tx-meta-date">· ${fmtDate(t.data)}</span>
        </div>
      </div>
      <div class="tx-right">
        <span id="valor-display-${t.id}" class="tx-valor ${t.tipo} valor-editable"
          onclick="startEditValor('${t.id}', ${parseFloat(t.valor_brl)})"
          title="Clique para editar">
          ${t.tipo === 'entrada' ? '+' : '-'} ${fmt(t.valor_brl)}
        </span>
        <button class="tx-del" onclick="deleteTx('${t.id}')" title="Excluir">✕</button>
      </div>
    </div>
  `;
}

function startEditValor(id, currentVal) {
  const display = el('valor-display-' + id);
  if (!display) return;

  const tx = _relMonthTxs.find(t => t.id === id);
  const sinal = tx?.tipo === 'entrada' ? '+' : '-';

  display.outerHTML = `
    <span class="valor-edit-wrap" id="valor-display-${id}">
      <input type="number" class="valor-inline-input" id="valor-input-${id}"
        value="${currentVal}" step="0.01" min="0.01"
        onkeydown="handleValorKey(event, '${id}')"
        onblur="cancelEditValor('${id}', ${currentVal}, '${tx?.tipo || 'saida'}')"
      />
      <button class="valor-save-btn" onmousedown="event.preventDefault()" onclick="saveValorEdit('${id}', '${tx?.tipo || 'saida'}')">✓</button>
    </span>
  `;

  const inp = el('valor-input-' + id);
  if (inp) { inp.focus(); inp.select(); }
}

function handleValorKey(e, id) {
  const tx = _relMonthTxs.find(t => t.id === id);
  if (e.key === 'Enter')  saveValorEdit(id, tx?.tipo || 'saida');
  if (e.key === 'Escape') cancelEditValor(id, parseFloat(el('valor-input-' + id)?.dataset.orig || 0), tx?.tipo || 'saida');
}

function cancelEditValor(id, originalVal, tipo) {
  const wrap = el('valor-display-' + id);
  if (!wrap || wrap.tagName !== 'SPAN' || !wrap.classList.contains('valor-edit-wrap')) return;
  const sinal = tipo === 'entrada' ? '+' : '-';
  wrap.outerHTML = `
    <span id="valor-display-${id}" class="tx-valor ${tipo} valor-editable"
      onclick="startEditValor('${id}', ${originalVal})"
      title="Clique para editar">
      ${sinal} ${fmt(originalVal)}
    </span>
  `;
}

async function saveValorEdit(id, tipo) {
  const inp = el('valor-input-' + id);
  if (!inp) return;

  const newVal = parseFloat(inp.value);
  if (!newVal || newVal <= 0) { toast('Valor inválido.'); return; }

  inp.disabled = true;

  const { error } = await sb.from('transacoes')
    .update({ valor: newVal, valor_brl: newVal })
    .eq('id', id);

  if (error) {
    toast('Erro ao atualizar valor.');
    cancelEditValor(id, newVal, tipo);
    return;
  }

  // Atualiza caches locais
  const tx = _relMonthTxs.find(t => t.id === id);
  if (tx) { tx.valor = newVal; tx.valor_brl = newVal; }
  const txDash = _allTxs.find(t => t.id === id);
  if (txDash) { txDash.valor = newVal; txDash.valor_brl = newVal; }

  toast('Valor atualizado. ✓');

  // Atualiza gráfico e painel
  const byCategory = {};
  _relMonthTxs.filter(t => t.tipo === 'saida').forEach(t => {
    byCategory[t.categoria] = (byCategory[t.categoria] || 0) + parseFloat(t.valor_brl);
  });
  renderCatChart(byCategory);
  _renderCatDetail();
}

async function saveTxCategory(id, newCat, selectEl) {
  selectEl.disabled = true;

  const { error } = await sb.from('transacoes')
    .update({ categoria: newCat })
    .eq('id', id);

  selectEl.disabled = false;

  if (error) {
    toast('Erro ao atualizar categoria.');
    return;
  }

  // Atualiza o cache local
  const tx = _relMonthTxs.find(t => t.id === id);
  if (tx) tx.categoria = newCat;

  // Atualiza também o cache do dashboard
  const txDash = _allTxs.find(t => t.id === id);
  if (txDash) txDash.categoria = newCat;

  toast('Categoria atualizada. ✓');

  // Re-renderiza o gráfico e mantém o painel aberto na categoria anterior
  const byCategory = {};
  _relMonthTxs.filter(t => t.tipo === 'saida').forEach(t => {
    byCategory[t.categoria] = (byCategory[t.categoria] || 0) + parseFloat(t.valor_brl);
  });
  renderCatChart(byCategory);

  // Re-renderiza o painel com a categoria atual (pode ter mudado)
  _renderCatDetail();
}

function closeCatDetail() {
  const panel = el('rel-cat-detail');
  if (panel) panel.classList.add('hidden');
  _relCurrentCat = null;
}

function renderCatChart(data) {
  const labels = Object.keys(data);
  const values = Object.values(data);
  const colors = labels.map(l => (S.cats.find(c => c.nome === l) || {}).cor || '#607D8B');
  const legend = el('chart-cat-legend');

  if (!labels.length) {
    legend.innerHTML = '<span style="color:var(--dim);font-size:.82rem">Sem gastos neste mês.</span>';
    if (S.charts.cat) { S.charts.cat.destroy(); S.charts.cat = null; }
    return;
  }

  if (S.charts.cat) S.charts.cat.destroy();
  S.charts.cat = new Chart(el('chart-categoria'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#060D08' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)}` } }
      }
    }
  });

  const total = values.reduce((a, b) => a + b, 0);
  legend.innerHTML = labels.map((l, i) => `
    <button class="legend-item legend-item--btn" onclick="showCatDetail('${esc(l)}')">
      <span class="legend-dot" style="background:${colors[i]}"></span>
      <span>${esc(l)}: ${fmt(values[i])} (${total ? Math.round(values[i]/total*100) : 0}%)</span>
    </button>
  `).join('');
}

function renderAnualChart(monthly) {
  const labels   = MONTHS.map(m => m.slice(0, 3));
  const entradas = Object.values(monthly).map(m => m.entradas);
  const saidas   = Object.values(monthly).map(m => m.saidas);

  if (S.charts.anual) S.charts.anual.destroy();
  S.charts.anual = new Chart(el('chart-anual'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Entradas', data: entradas, backgroundColor: 'rgba(16,185,129,0.7)',  borderRadius: 4 },
        { label: 'Saídas',   data: saidas,   backgroundColor: 'rgba(244,63,94,0.7)',  borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8B99B0', font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)}` } }
      },
      scales: {
        x: { ticks: { color: '#8B99B0' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#8B99B0', callback: v => fmtShort(v) }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

// --- Categories ---------------------------------------------

async function loadCategories(cb) {
  const { data } = await sb.from('categorias').select('*').order('nome');

  if (!data || data.length === 0) {
    // Seed defaults for new user
    const defaults = DEFAULT_CATEGORIES.map(c => ({ ...c, user_id: S.user.id }));
    const { data: seeded } = await sb.from('categorias').insert(defaults).select();
    S.cats = seeded || DEFAULT_CATEGORIES;
  } else {
    S.cats = data;
  }

  if (cb) cb();
}

function populateCatSelect(selectId, tipo) {
  const sel = el(selectId);
  sel.innerHTML = S.cats
    .filter(c => c.tipo === tipo)
    .map(c => `<option value="${esc(c.nome)}">${esc(c.nome)}</option>`)
    .join('');
}

// --- Data helpers -------------------------------------------

async function _fetchTransactions(month, year) {
  const pad     = n => String(n).padStart(2, '0');
  const from    = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to      = `${year}-${pad(month)}-${pad(lastDay)}`;

  const { data, error } = await sb.from('transacoes')
    .select('*')
    .gte('data', from)
    .lte('data', to)
    .order('data', { ascending: false });

  if (error) { toast('Erro ao carregar transações.'); return null; }
  return data;
}

async function _fetchTransactionsYear(year) {
  const { data, error } = await sb.from('transacoes')
    .select('data, tipo, valor_brl')
    .gte('data', `${year}-01-01`)
    .lte('data', `${year}-12-31`);

  if (error) return null;
  return data;
}

async function _fetchRecorrentes() {
  const { data, error } = await sb.from('recorrentes')
    .select('*')
    .order('dia_vencimento');
  if (error) return null;
  return data;
}

// --- Exchange rate ------------------------------------------

async function getExchangeRate() {
  if (S.rate) return S.rate;
  try {
    const res  = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await res.json();
    S.rate = data.rates.BRL;
    return S.rate;
  } catch {
    return 5.75; // fallback
  }
}

// --- Utilities ----------------------------------------------

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function fmtShort(v) {
  return Math.abs(v) >= 1000 ? 'R$' + (v/1000).toFixed(1) + 'k' : 'R$' + (v||0).toFixed(0);
}

function fmtDate(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}`;
}

function esc(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function el(id)   { return document.getElementById(id); }
function qsa(sel) { return document.querySelectorAll(sel); }
function show(id) { el(id).classList.remove('hidden'); }
function hide(id) { el(id).classList.add('hidden'); }

function showError(id, msg) { const e = el(id); e.textContent = msg; e.classList.remove('hidden'); }
function hideError(id)      { el(id).classList.add('hidden'); }

function togglePwd(id) {
  const inp = el(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

let _toastTimer;
function toast(msg, ms = 3000) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}
