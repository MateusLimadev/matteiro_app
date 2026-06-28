/* ============================================================
   MATTEIRO — scripts.js  (Supabase edition)
   Banco de dados: Supabase (PostgreSQL)
   Auth: Supabase Auth (email/senha com confirmação)
   ============================================================ */

// --- Supabase client ----------------------------------------
const SUPABASE_URL = 'https://bmdeefzvunqxmbxprgds.supabase.co';
const SUPABASE_KEY = 'sb_publishable_kdor7kz8Mj0LeLz-EhJ80g_QzQy9FR8';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Gemini API key (carregada do Supabase após login) ------
let GROQ_KEY = '';

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
  // Detecta redirecionamento de confirmação de email
  const hash = window.location.hash;
  const hashParams = new URLSearchParams(hash.slice(1));
  const hashType       = hashParams.get('type');
  const isEmailConfirm = hashType === 'signup' || hashType === 'email_change';
  const isRecovery     = hashType === 'recovery';
  const isHashError    = hashParams.has('error');

  history.replaceState(null, '', window.location.pathname); // sempre limpa o hash

  if (isHashError) {
    const code = hashParams.get('error_code') || '';
    const desc = hashParams.get('error_description') || '';
    hide('loading');
    // Exibe mensagem de erro amigável na tela de auth
    showAuth();
    const errEl = el('login-error');
    if (errEl) {
      let msg = 'Erro ao confirmar email.';
      if (code === 'otp_expired') msg = 'O link de confirmação expirou. Cadastre-se novamente ou solicite um novo email.';
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
    }
    return;
  }

  if (isEmailConfirm) {
    hide('loading');
    el('email-confirmed').classList.remove('hidden');
    return;
  }

  if (isRecovery) {
    // Supabase já processou o token via getSession abaixo — só mostrar a tela
    // mas precisamos garantir que a sessão seja carregada primeiro
    hide('loading');
    show('auth-wrap');
    showScreen('screen-reset');
    return;
  }

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
  loadPlanejamento();
  _applyTheme(localStorage.getItem('matteiro-theme') || 'dark');
  _loadAppConfig();
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

// Reset password (chegou pelo link do email)
async function handleReset(e) {
  e.preventDefault();
  const senha  = el('reset-senha').value;
  const senha2 = el('reset-senha2').value;
  const btn    = el('btn-reset');
  const errEl  = el('reset-error');

  errEl.classList.add('hidden');

  if (senha !== senha2) {
    errEl.textContent = 'As senhas não coincidem.';
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Salvando…';

  const { error } = await sb.auth.updateUser({ password: senha });

  btn.disabled = false;
  btn.textContent = 'Salvar nova senha';

  if (error) {
    errEl.textContent = _authError(error.message);
    errEl.classList.remove('hidden');
    return;
  }

  // Desloga e manda pro login com mensagem de sucesso
  await sb.auth.signOut();
  showScreen('screen-login');
  const loginErr = el('login-error');
  if (loginErr) {
    loginErr.textContent = '✅ Senha alterada com sucesso! Faça login com a nova senha.';
    loginErr.className = 'form-success';
    loginErr.classList.remove('hidden');
  }
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
  if (name === 'planejamento') loadPlanejamento();
  if (name === 'definicoes')  renderDefLists();
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
  // Verifica impacto nos planos após salvar saída
  if (tipo === 'saida' && _plans.length) setTimeout(_checkPlanAlerts, 500);
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

// --- Definições (category management) -----------------------

let _defTipo = 'saida';

function defSetTipo(tipo) {
  _defTipo = tipo;
  el('def-tipo-saida').classList.toggle('active', tipo === 'saida');
  el('def-tipo-entrada').classList.toggle('active', tipo === 'entrada');
}

function renderDefLists() {
  ['saida', 'entrada'].forEach(tipo => {
    const container = el('def-list-' + tipo);
    if (!container) return;
    const cats = S.cats.filter(c => c.tipo === tipo);
    if (!cats.length) {
      container.innerHTML = '<p class="empty-state" style="padding:1rem 0">Nenhuma categoria.</p>';
      return;
    }
    container.innerHTML = cats.map(c => `
      <div class="def-cat-item">
        <span class="def-cat-dot" style="background:${c.cor || '#607D8B'}"></span>
        <span class="def-cat-nome">${esc(c.nome)}</span>
        <button class="def-cat-del" onclick="defDeleteCat('${c.id}','${esc(c.nome)}')" title="Excluir">✕</button>
      </div>
    `).join('');
  });
}

async function defAddCat() {
  const nome = (el('def-nome').value || '').trim();
  const cor  = el('def-cor').value || '#22C55E';
  if (!nome) { toast('Digite um nome para a categoria.'); return; }
  if (S.cats.find(c => c.nome === nome && c.tipo === _defTipo)) {
    toast('Categoria já existe.'); return;
  }

  const { data, error } = await sb.from('categorias')
    .insert({ nome, tipo: _defTipo, cor, user_id: S.user.id })
    .select().single();

  if (error) { toast('Erro ao criar categoria.'); return; }

  S.cats.push(data);
  el('def-nome').value = '';
  renderDefLists();
  toast('Categoria criada. ✓');
}

async function defDeleteCat(id, nome) {
  if (!confirm(`Excluir categoria "${nome}"?`)) return;

  const { error } = await sb.from('categorias').delete().eq('id', id);
  if (error) { toast('Erro ao excluir.'); return; }

  S.cats = S.cats.filter(c => c.id !== id);
  renderDefLists();
  toast('Categoria excluída.');
}

async function _loadAppConfig() {
  const { data } = await sb.from('app_config').select('key, value');
  if (!data) return;
  data.forEach(row => {
    if (row.key === 'groq_key') GROQ_KEY = row.value;
  });
}

function _getGroqKey() {
  return GROQ_KEY;
}

// --- Importar extrato PDF -----------------------------------

let _pdfText = '';
let _extratoTxs = [];

async function defHandlePdf(input) {
  const file = input.files[0];
  if (!file) return;

  const label = el('def-upload-label');
  const text  = el('def-upload-text');
  text.textContent = '⏳ Lendo PDF…';
  label.classList.add('has-file');

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(s => s.str).join(' ') + '\n';
    }
    _pdfText = fullText;
    text.textContent = `✅ ${file.name} (${pdf.numPages} páginas)`;
    el('def-analisar-btn').disabled = false;
  } catch (err) {
    text.textContent = '❌ Erro ao ler PDF. Tente outro arquivo.';
    label.classList.remove('has-file');
    console.error(err);
  }
}

async function defAnalisarExtrato(fromMattia = false) {
  const key = _getGroqKey();
  if (!key) {
    if (fromMattia) _mattiaAddMsg('Chave de IA não configurada.', 'ai');
    else toast('Chave do Groq não configurada. Contacte o suporte.');
    return;
  }
  if (!_pdfText) { toast('Selecione um PDF primeiro.'); return; }

  const btn = el('def-analisar-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analisando com IA…'; }

  const catNames = S.cats.map(c => `${c.nome} (${c.tipo})`).join(', ');

  const prompt = `Você é um assistente financeiro. Analise o texto abaixo de um extrato bancário e extraia TODAS as transações.

Para cada transação, retorne um JSON array com objetos no formato:
{
  "descricao": "nome da transação",
  "valor": 123.45,
  "tipo": "saida" ou "entrada",
  "data": "YYYY-MM-DD",
  "categoria": "categoria sugerida"
}

Categorias disponíveis: ${catNames}

Regras:
- Use exatamente o nome da categoria disponível mais adequada
- "tipo" deve ser "entrada" para recebimentos/depósitos e "saida" para pagamentos/compras
- "valor" deve ser positivo sempre (número sem sinal)
- "data" no formato YYYY-MM-DD
- Se não souber a categoria exata, use "Outros (saída)" ou "Outros (entrada)"
- Retorne APENAS o JSON array, sem texto extra, sem markdown

Texto do extrato:
${_pdfText.slice(0, 15000)}`;

  try {
    const resp = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      }
    );

    const data = await resp.json();

    if (!resp.ok) {
      const msg = data?.error?.message || 'Erro na API do Groq.';
      throw new Error(msg);
    }

    const raw = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    // Groq com json_object retorna { "transacoes": [...] } ou direto array
    _extratoTxs = Array.isArray(parsed) ? parsed : (parsed.transacoes || parsed.transactions || Object.values(parsed)[0] || []);

    if (!_extratoTxs.length) {
      if (fromMattia) _mattiaAddMsg('Nenhuma transação encontrada no extrato.', 'ai');
      else toast('Nenhuma transação encontrada no extrato.');
      if (btn) { btn.disabled = false; btn.textContent = 'Analisar com IA'; }
      return;
    }

    renderExtratoPreview();
    if (fromMattia) {
      mattiaToggle(); // fecha o painel
      setTimeout(() => switchTab('extrato', null), 300);
    } else {
      switchTab('extrato', null);
    }

  } catch (err) {
    if (fromMattia) _mattiaAddMsg('Erro ao analisar: ' + err.message, 'ai');
    else toast('Erro: ' + err.message);
    console.error(err);
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Analisar com IA'; }
}

function renderExtratoPreview() {
  const container = el('extrato-list');
  if (!container) return;

  const catSaidaOptions  = S.cats.filter(c => c.tipo === 'saida').map(c => `<option value="${esc(c.nome)}">${esc(c.nome)}</option>`).join('');
  const catEntOptions    = S.cats.filter(c => c.tipo === 'entrada').map(c => `<option value="${esc(c.nome)}">${esc(c.nome)}</option>`).join('');

  container.innerHTML = _extratoTxs.map((t, i) => {
    const catOptions = t.tipo === 'entrada' ? catEntOptions : catSaidaOptions;
    const valClass   = t.tipo === 'entrada' ? 'entrada' : 'saida';
    const valSign    = t.tipo === 'entrada' ? '+' : '-';
    return `
      <div class="extrato-item">
        <div class="extrato-row1">
          <input class="extrato-desc-input" type="text" value="${esc(t.descricao)}"
            onchange="_extratoTxs[${i}].descricao = this.value">
          <span class="extrato-valor ${valClass}">${valSign} ${fmt(t.valor)}</span>
        </div>
        <div class="extrato-row2">
          <input type="date" class="tx-edit-input tx-edit-date" value="${t.data || ''}"
            onchange="_extratoTxs[${i}].data = this.value" style="width:130px">
          <select class="cat-inline-select" style="flex:1"
            onchange="_extratoTxs[${i}].categoria = this.value">
            ${catOptions.replace(`value="${esc(t.categoria)}"`, `value="${esc(t.categoria)}" selected`)}
          </select>
          <button class="def-cat-del" onclick="_extratoTxs.splice(${i},1); renderExtratoPreview()" title="Remover">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

async function importarExtrato() {
  if (!_extratoTxs.length) { toast('Nenhuma transação para importar.'); return; }

  const btn = el('btn-importar-extrato');
  btn.disabled = true;
  btn.textContent = '⏳ Importando…';

  const rows = _extratoTxs.map(t => ({
    user_id:   S.user.id,
    descricao: t.descricao,
    valor:     t.valor,
    valor_brl: t.valor,
    moeda:     'BRL',
    tipo:      t.tipo,
    categoria: t.categoria,
    data:      t.data,
    recorrente: false
  }));

  const { error } = await sb.from('transacoes').insert(rows);

  btn.disabled = false;
  btn.textContent = 'Importar tudo';

  if (error) { toast('Erro ao importar: ' + error.message); return; }

  toast(`✅ ${rows.length} transações importadas!`);
  _extratoTxs = [];
  _pdfText = '';
  // Reset PDF state
  _pdfText = '';
  const pdfInp = el('mattia-pdf-input');
  if (pdfInp) pdfInp.value = '';

  switchTab('dashboard', document.querySelector('[data-tab="dashboard"]'));
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

// --- Planejamento -------------------------------------------

let _plans = [];

async function loadPlanejamento() {
  const { data, error } = await sb.from('planejamentos')
    .select('*').eq('ativo', true).order('criado_em', { ascending: true });
  if (error) { console.error(error); return; }
  _plans = data || [];
  renderPlanejamento();
}

async function renderPlanejamento() {
  const list    = el('plan-list');
  const empty   = el('plan-empty');
  if (!list) return;

  if (!_plans.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const hoje = new Date();
  const pad2 = n => String(n).padStart(2,'0');

  const cards = await Promise.all(_plans.map(async p => {
    // Busca dados mensais do período do plano para o gráfico
    const dataIniPlan = new Date(p.data_inicio);
    const dataFimPlan = new Date(p.data_fim);
    const iniMesPlan  = `${dataIniPlan.getFullYear()}-${pad2(dataIniPlan.getMonth()+1)}-01`;
    const fimMesPlan  = `${dataFimPlan.getFullYear()}-${pad2(dataFimPlan.getMonth()+1)}-${pad2(new Date(dataFimPlan.getFullYear(), dataFimPlan.getMonth()+1, 0).getDate())}`;

    const { data: txsPlan } = await sb.from('transacoes')
      .select('data, tipo, valor_brl')
      .gte('data', iniMesPlan)
      .lte('data', fimMesPlan);

    // Agrupa por mês
    const porMesPlan = {};
    (txsPlan || []).forEach(t => {
      const k = t.data.slice(0, 7);
      if (!porMesPlan[k]) porMesPlan[k] = { e: 0, s: 0 };
      if (t.tipo === 'entrada') porMesPlan[k].e += parseFloat(t.valor_brl) || 0;
      else porMesPlan[k].s += parseFloat(t.valor_brl) || 0;
    });

    // Gera lista de meses do período
    const mesesLabels = [], mesesSaldos = [];
    let cur = new Date(dataIniPlan.getFullYear(), dataIniPlan.getMonth(), 1);
    while (cur <= dataFimPlan) {
      const k = `${cur.getFullYear()}-${pad2(cur.getMonth()+1)}`;
      const nome = cur.toLocaleString('pt-BR', { month: 'short' });
      const v = porMesPlan[k] || { e: 0, s: 0 };
      mesesLabels.push(nome);
      mesesSaldos.push(+(v.e - v.s).toFixed(2));
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    const chartId = `plan-chart-${p.id.slice(0,8)}`;

    // Totais do mês atual (dashboard)
    const lista = _allTxs || [];
    const entradas = lista.filter(t => t.tipo === 'entrada').reduce((a,t)=>a+(parseFloat(t.valor_brl)||0),0);
    const saidas   = lista.filter(t => t.tipo === 'saida').reduce((a,t)=>a+(parseFloat(t.valor_brl)||0),0);
    const saldoReal = entradas - saidas;

    const dataFim   = new Date(p.data_fim);
    const dataIni   = new Date(p.data_inicio);
    const mesesTotal = Math.max(1, Math.round((dataFim - dataIni) / (1000*60*60*24*30)));
    const mesesRest  = Math.max(0, Math.round((dataFim - hoje) / (1000*60*60*24*30)));
    const metaMensal = p.valor_meta / mesesTotal;

    const progresso  = Math.min(100, Math.max(0, (saldoReal / p.valor_meta) * 100));
    const barClass   = progresso >= 66 ? '' : progresso >= 33 ? 'warn' : 'danger';

    const prazoStr   = dataFim.toLocaleDateString('pt-BR', { month:'short', year:'numeric' });

    // Alerta: se falta pouco tempo e progresso baixo
    let alertHtml = '';
    if (mesesRest <= 1 && progresso < 80) {
      alertHtml = `<div class="plan-alert">⚠️ Menos de 1 mês restante e você está em ${progresso.toFixed(0)}%. Reduza gastos agora.</div>`;
    } else if (saldoReal < 0) {
      alertHtml = `<div class="plan-alert">🚨 Saldo negativo no período. Esse plano está em risco.</div>`;
    } else if (progresso < 30 && mesesRest < mesesTotal * 0.5) {
      alertHtml = `<div class="plan-alert warn">⚡ Você está na metade do prazo mas com só ${progresso.toFixed(0)}% concluído.</div>`;
    }

    // Guarda dados para renderizar após inserir no DOM
    return { chartId, mesesLabels, mesesSaldos, metaMensal,
      _html: `
      <div class="plan-card">
        <div class="plan-card-header">
          <div>
            <div class="plan-card-title">${esc(p.titulo)}</div>
            <div class="plan-card-prazo">Prazo: ${prazoStr} · ${mesesRest} ${mesesRest===1?'mês':'meses'} restante${mesesRest===1?'':'s'}</div>
          </div>
          <button class="plan-card-del" onclick="planDeletar('${p.id}')" title="Remover">✕</button>
        </div>
        <div class="plan-progress-row">
          <div class="plan-progress-bar-wrap">
            <div class="plan-progress-bar ${barClass}" style="width:${progresso.toFixed(1)}%"></div>
          </div>
          <span class="plan-progress-pct">${progresso.toFixed(0)}%</span>
        </div>
        <div class="plan-stats">
          <div class="plan-stat">
            <div class="plan-stat-label">Meta</div>
            <div class="plan-stat-value">${fmt(p.valor_meta)}</div>
          </div>
          <div class="plan-stat">
            <div class="plan-stat-label">Guardado</div>
            <div class="plan-stat-value" style="color:${saldoReal>=0?'var(--positive)':'var(--red-dim)'}">${fmt(Math.abs(saldoReal))}</div>
          </div>
          <div class="plan-stat">
            <div class="plan-stat-label">Meta/mês</div>
            <div class="plan-stat-value">${fmt(metaMensal)}</div>
          </div>
        </div>
        ${alertHtml}
        <div class="plan-chart-wrap">
          <div class="plan-chart-title">Saldo guardado por mês</div>
          <canvas id="${chartId}" height="90"></canvas>
        </div>
      </div>`
    };
  }));

  list.innerHTML = cards.map(c => c._html).join('');

  // Renderiza os gráficos após o DOM ser atualizado
  cards.forEach(({ chartId, mesesLabels, mesesSaldos, metaMensal }) => {
    const canvas = document.getElementById(chartId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const positivo = 'rgba(74,222,128,0.85)';
    const negativo  = 'rgba(239,68,68,0.75)';
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: mesesLabels,
        datasets: [
          {
            label: 'Saldo do mês',
            data: mesesSaldos,
            backgroundColor: mesesSaldos.map(v => v >= 0 ? positivo : negativo),
            borderRadius: 4,
            borderSkipped: false,
          },
          {
            label: 'Meta/mês',
            data: mesesLabels.map(() => metaMensal),
            type: 'line',
            borderColor: 'rgba(255,255,255,0.25)',
            borderWidth: 1.5,
            borderDash: [4, 3],
            segment: { borderDash: ctx => [4,3] },
            pointRadius: 0,
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.parsed.y;
                return ` ${fmt(v)}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#9ca3af', font: { size: 11 } },
            grid: { display: false },
            border: { display: false }
          },
          y: {
            ticks: {
              color: '#9ca3af',
              font: { size: 11 },
              callback: v => `R$${(v/1000).toFixed(0)}k`
            },
            grid: { color: 'rgba(255,255,255,0.05)' },
            border: { display: false }
          }
        }
      }
    });
  });
}

function planNovo() {
  // Pré-preencher data limite com 3 meses
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  el('plan-data').value = d.toISOString().slice(0,10);
  el('plan-titulo').value = '';
  el('plan-valor').value = '';
  el('plan-renda').value = '';
  el('plan-matt-tip').classList.add('hidden');
  el('plan-modal').classList.remove('hidden');
  el('plan-modal-overlay').classList.remove('hidden');

  // Gerar dica do Matt após digitar
  ['plan-valor','plan-data','plan-renda'].forEach(id => {
    el(id).addEventListener('change', _planAtualizarDica, { once: false });
  });
}

function planModalClose() {
  el('plan-modal').classList.add('hidden');
  el('plan-modal-overlay').classList.add('hidden');
}

async function _planAtualizarDica() {
  const valor = parseFloat(el('plan-valor').value);
  const renda = parseFloat(el('plan-renda').value);
  const dataFim = el('plan-data').value;
  if (!valor || !dataFim) return;

  const hoje = new Date();
  const fim  = new Date(dataFim);
  const meses = Math.max(1, Math.round((fim - hoje) / (1000*60*60*24*30)));
  const metaMensal = valor / meses;

  const tip = el('plan-matt-tip');
  tip.classList.remove('hidden');

  if (renda && metaMensal > renda * 0.8) {
    tip.innerHTML = `⚠️ Guardar <strong>${fmt(metaMensal)}/mês</strong> representa mais de 80% da sua renda — muito apertado. Considere aumentar o prazo ou reduzir a meta.`;
  } else if (renda) {
    const sobra = renda - metaMensal;
    tip.innerHTML = `✅ Você vai precisar guardar <strong>${fmt(metaMensal)}/mês</strong>. Com renda de ${fmt(renda)}, vão sobrar ${fmt(sobra)} por mês para outras despesas.`;
  } else {
    tip.innerHTML = `📊 Você vai precisar guardar <strong>${fmt(metaMensal)}/mês</strong> por ${meses} ${meses===1?'mês':'meses'}.`;
  }
}

async function planSalvar() {
  const titulo  = el('plan-titulo').value.trim();
  const valor   = parseFloat(el('plan-valor').value);
  const dataFim = el('plan-data').value;

  if (!titulo) { toast('Digite o objetivo do plano.'); return; }
  if (!valor || valor <= 0) { toast('Digite o valor da meta.'); return; }
  if (!dataFim) { toast('Escolha uma data limite.'); return; }

  const { error } = await sb.from('planejamentos').insert({
    user_id:     S.user.id,
    titulo,
    valor_meta:  valor,
    data_inicio: new Date().toISOString().slice(0, 10),
    data_fim:    dataFim,
    ativo:       true
  });

  if (error) { toast('Erro ao salvar plano.'); console.error(error); return; }

  toast('✅ Plano criado!');
  planModalClose();
  loadPlanejamento();
}

async function planDeletar(id) {
  if (!confirm('Remover este plano?')) return;
  await sb.from('planejamentos').update({ ativo: false }).eq('id', id);
  _plans = _plans.filter(p => p.id !== id);
  renderPlanejamento();
  toast('Plano removido.');
}

async function _checkPlanAlerts() {
  if (!_plans.length) return;
  const hoje = new Date();
  for (const p of _plans) {
    const dataFim  = new Date(p.data_fim);
    const dataIni  = new Date(p.data_inicio);
    const mesesTotal = Math.max(1, Math.round((dataFim - dataIni) / (1000*60*60*24*30)));
    const mesesRest  = Math.max(0, Math.round((dataFim - hoje) / (1000*60*60*24*30)));

    const lista2   = _allTxs || [];
    const entradas = lista2.filter(t=>t.tipo==='entrada').reduce((a,t)=>a+(parseFloat(t.valor_brl)||0),0);
    const saidas   = lista2.filter(t=>t.tipo==='saida').reduce((a,t)=>a+(parseFloat(t.valor_brl)||0),0);
    const saldoReal  = entradas - saidas;
    const progresso  = saldoReal / p.valor_meta;
    const esperado   = 1 - (mesesRest / mesesTotal);

    if (progresso < esperado - 0.15) {
      toast(`⚠️ Atenção: o plano "${p.titulo}" está atrasado. Você tem ${(progresso*100).toFixed(0)}% mas deveria ter ${(esperado*100).toFixed(0)}%.`, 6000);
      break; // Um alerta por vez
    }
  }
}

// --- MattIA -------------------------------------------------

let _mattiaOpen = false;

function mattiaToggle() {
  _mattiaOpen = !_mattiaOpen;
  el('mattia-panel').classList.toggle('open', _mattiaOpen);
  el('mattia-overlay').classList.toggle('open', _mattiaOpen);
  if (_mattiaOpen) setTimeout(() => el('mattia-input').focus(), 300);
}

function mattiaUploadClick() {
  el('mattia-pdf-input').click();
}

function _mattiaAddMsg(text, role) {
  const box = el('mattia-messages');
  const div = document.createElement('div');
  div.className = `mattia-msg mattia-msg--${role}`;
  div.innerHTML = text.replace(/\n/g, '<br>');
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

function _mattiaLoading() {
  const box = el('mattia-messages');
  const div = document.createElement('div');
  div.className = 'mattia-msg mattia-msg--loading';
  div.innerHTML = '<div class="mattia-dots"><span></span><span></span><span></span></div>';
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

async function mattiaEnviar() {
  const input = el('mattia-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  _mattiaAddMsg(text, 'user');
  el('mattia-quick').style.display = 'none';
  await _mattiaChat(text);
}

async function mattiaAcao(tipo) {
  el('mattia-quick').style.display = 'none';
  let prompt = '';
  if (tipo === 'resumo') {
    prompt = 'Me dê um resumo financeiro do meu mês atual com base nas minhas transações.';
  } else if (tipo === 'maiores') {
    prompt = 'Quais foram meus maiores gastos este mês? Liste os 5 maiores com valor e categoria.';
  } else if (tipo === 'plano') {
    mattiaToggle();
    switchTab('planejamento', document.querySelector('[data-tab="planejamento"]'));
    return;
  }
  _mattiaAddMsg(prompt, 'user');
  await _mattiaChat(prompt);
}

async function _mattiaChat(userMsg) {
  const key = _getGroqKey();
  if (!key) { _mattiaAddMsg('Chave de IA não configurada. Contacte o suporte.', 'ai'); return; }

  // Detectar intenção de criar plano — age diretamente
  const msgLow = userMsg.toLowerCase();
  const planIntent = ['crie o plano','criar plano','cria o plano','cria um plano','criar um plano',
    'novo plano','abrir planejamento','aba planejamento','planejamento e crie','cria na aba'];
  if (planIntent.some(k => msgLow.includes(k))) {
    _mattiaAddMsg('Abrindo o planejamento agora! 🎯', 'ai');
    setTimeout(() => {
      mattiaToggle();
      switchTab('planejamento', document.querySelector('[data-tab="planejamento"]'));
      setTimeout(planNovo, 350);
    }, 500);
    return;
  }

  // Usa os mesmos dados do card do dashboard — sem query separada
  const now = new Date();
  const lista = _allTxs || [];
  const mesNome = MONTHS[S.month - 1];
  const anoVis  = S.year;

  // Totais exatos (mesmos do card)
  let totalEntradas = 0, totalSaidas = 0;
  const cats = {};
  lista.forEach(t => {
    const v = parseFloat(t.valor_brl) || 0;
    if (t.tipo === 'entrada') totalEntradas += v;
    else {
      totalSaidas += v;
      const c = t.categoria || 'Outros';
      cats[c] = (cats[c] || 0) + v;
    }
  });
  const saldo = totalEntradas - totalSaidas;

  const topCats = Object.entries(cats)
    .sort((a,b) => b[1]-a[1]).slice(0,6)
    .map(([c,v]) => `${c}: R$${v.toFixed(2)}`).join('\n  ');

  const todayStr = now.toLocaleDateString('pt-BR');

  const systemMsg = `Você é o Matt, assistente financeiro do app Matteiro. Personalidade: direto, descontraído, fala como um amigo que entende de dinheiro. Sem enrolação, sem formalidade.

REGRA CRÍTICA: use EXATAMENTE os números abaixo. Nunca recalcule nem invente valores.

Hoje: ${todayStr}
Mês em foco: ${mesNome} ${anoVis}

DADOS DO MÊS (exatos):
- Receitas: R$${totalEntradas.toFixed(2)}
- Despesas: R$${totalSaidas.toFixed(2)}
- Saldo:    R$${saldo.toFixed(2)}

Gastos por categoria:
  ${topCats || 'nenhum dado'}

${_plans.length ? `Planos ativos:\n${_plans.map(p => {
  const fim = new Date(p.data_fim);
  const mr = Math.max(0, Math.round((fim - now) / (1000*60*60*24*30)));
  return `- ${p.titulo}: meta R$${p.valor_meta}, prazo ${fim.toLocaleDateString('pt-BR',{month:'short',year:'numeric'})} (${mr} meses)`;
}).join('\n')}` : ''}

Regras de resposta:
- Máximo 2 parágrafos ou lista de 5 itens
- Português BR informal, sem enrolação
- Emoji só quando fizer sentido

${_plans.length ? `Planos ativos:
${_plans.map(p => {
  const fim = new Date(p.data_fim);
  const mesesRest = Math.max(0, Math.round((fim - now) / (1000*60*60*24*30)));
  return `- ${p.titulo}: meta R$${p.valor_meta} até ${fim.toLocaleDateString('pt-BR',{month:'short',year:'numeric'})} (${mesesRest} meses restantes)`;
}).join('\n')}` : ''}`.trim();

  const loading = _mattiaLoading();

  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userMsg }
        ],
        temperature: 0.5
      })
    });
    const data = await resp.json();
    loading.remove();
    if (!resp.ok) throw new Error(data?.error?.message || 'Erro na IA');
    const reply = data.choices?.[0]?.message?.content || 'Não consegui responder.';
    _mattiaAddMsg(reply, 'ai');
  } catch (err) {
    loading.remove();
    _mattiaAddMsg('Erro ao conectar com a IA: ' + err.message, 'ai');
  }
}

async function mattiaHandlePdf(input) {
  const file = input.files[0];
  if (!file) return;
  _mattiaAddMsg(`📄 Lendo **${file.name}**…`, 'ai');
  el('mattia-quick').style.display = 'none';

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(s => s.str).join(' ') + '\n';
    }
    _pdfText = fullText;
    _mattiaAddMsg(`✅ PDF lido (${pdf.numPages} páginas). Analisando transações com IA…`, 'ai');
    await defAnalisarExtrato(true);
  } catch (err) {
    _mattiaAddMsg('❌ Erro ao ler o PDF. Tente outro arquivo.', 'ai');
  }
}

let _toastTimer;
function toast(msg, ms = 3000) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}
