// ui.js - Start screen, game over modal, victory screen, login
import { getCoins, setUsername, getUsername, loadProfile, getStash, sellStashItem, equipItem, unequipItem, getEquipped, clearEquipped, setPassword, checkPassword, hasPassword, resetProfile } from './economy.js';

const resultModal = document.getElementById('result-modal');
const resultTitle = document.getElementById('result-title');
const resultDesc = document.getElementById('result-desc');
const summaryLootContainer = document.getElementById('summary-loot-container');
const restartBtn = document.getElementById('restart-btn');
const startScreen = document.getElementById('start-screen');
const deployBtn = document.getElementById('deploy-btn');
const hudOverlay = document.getElementById('hud');
const loginScreen = document.getElementById('login-screen');
const loginCard = loginScreen.querySelector('.login-card');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const passwordToggle = document.getElementById('password-toggle');
const passwordError = document.getElementById('password-error');
const loginGreeting = document.getElementById('login-greeting');
const loginBtn = document.getElementById('login-btn');
const clearAccount = document.getElementById('clear-account');

// ---- Login ----
export function showLoginScreen() {
  startScreen.classList.add('hidden');
  hudOverlay.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  loginScreen.classList.remove('exiting');
  loginCard.classList.remove('shake');
  loadProfile();
  const existing = getUsername();
  if (existing) {
    usernameInput.value = existing;
    loginGreeting.innerText = `欢迎回来，${existing}`;
  } else {
    usernameInput.value = '';
    loginGreeting.innerText = '首次任务 · 创建你的特工档案';
  }
  if (passwordInput) {
    passwordInput.value = '';
    passwordInput.classList.remove('input-error');
  }
  if (hasPassword()) {
    passwordInput.placeholder = '输入密码';
  } else {
    passwordInput.placeholder = '设置密码（首次登录）';
  }
  if (passwordError) passwordError.classList.add('hidden');
}

export function hideLoginScreen() {
  loginScreen.classList.add('exiting');
  setTimeout(() => {
    loginScreen.classList.add('hidden');
    loginScreen.classList.remove('exiting');
  }, 350);
}

export function onLogin(callback) {
  // Password visibility toggle
  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      passwordToggle.innerText = isPassword ? '👁‍🗨' : '👁';
    });
  }

  // Clear account
  if (clearAccount) {
    clearAccount.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('确定清除本地所有账号数据？此操作不可撤销！')) {
        resetProfile();
        showLoginScreen();
      }
    });
  }

  const doLogin = () => {
    const name = usernameInput.value.trim() || '特工';
    const pass = passwordInput?.value || '';
    if (hasPassword() && !checkPassword(pass)) {
      loginCard.classList.remove('shake');
      void loginCard.offsetWidth; // reflow to restart animation
      loginCard.classList.add('shake');
      if (passwordInput) { passwordInput.classList.add('input-error'); passwordInput.value = ''; }
      if (passwordError) { passwordError.innerText = '密码错误，请重试'; passwordError.classList.remove('hidden'); }
      return;
    }
    if (!hasPassword() && pass) {
      setPassword(pass);
    }
    setUsername(name);
    if (passwordInput) passwordInput.classList.remove('input-error');
    if (passwordError) passwordError.classList.add('hidden');
    // Success flash before transition
    loginBtn.classList.add('success-flash');
    setTimeout(() => {
      loginBtn.classList.remove('success-flash');
      hideLoginScreen();
      callback(name);
    }, 400);
  };
  loginBtn.addEventListener('click', doLogin);
  usernameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') passwordInput?.focus(); });
  if (passwordInput) {
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doLogin();
      else { passwordInput.classList.remove('input-error'); if (passwordError) { passwordError.classList.add('hidden'); } }
    });
  }
}

// ---- Start screen ----
export function showStartScreen() {
  startScreen.classList.remove('hidden');
  hudOverlay.classList.add('hidden');
  refreshStashUI();
}

let selectedStashIdx = -1;

function refreshStashUI() {
  const grid = document.getElementById('stash-grid');
  const coinsEl = document.getElementById('stash-coins');
  const equipGrid = document.getElementById('equipped-grid');
  const sellBtn = document.getElementById('sell-btn');
  const equipBtn = document.getElementById('equip-btn');
  if (!grid) return;

  const stash = getStash();
  const coins = getCoins();
  const equipped = getEquipped();

  if (coinsEl) coinsEl.innerText = `💰 ${coins.toLocaleString()}`;
  grid.innerHTML = '';
  selectedStashIdx = -1;
  if (sellBtn) sellBtn.disabled = true;
  if (equipBtn) equipBtn.disabled = true;

  if (stash.length === 0) {
    grid.innerHTML = '<span class="stash-empty">仓库空空如也</span>';
  } else {
    const display = stash.slice(0, 32);
    for (let i = 0; i < display.length; i++) {
      const item = display[i];
      const el = document.createElement('div');
      el.className = 'stash-item';
      el.innerText = item.emoji || '📦';
      el.title = `${item.name || '物品'} (价值 $${(item.value || 0).toLocaleString()})`;
      el.addEventListener('click', () => {
        grid.querySelectorAll('.stash-item').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        selectedStashIdx = i;
        if (sellBtn) sellBtn.disabled = false;
        if (equipBtn) equipBtn.disabled = equipped.length >= 4;
      });
      grid.appendChild(el);
    }
  }

  // Equipped loadout
  if (equipGrid) {
    equipGrid.innerHTML = '';
    if (equipped.length === 0) {
      equipGrid.innerHTML = '<span class="stash-empty">未装备物品 — 从仓库中选择装备</span>';
    } else {
      for (let i = 0; i < equipped.length; i++) {
        const item = equipped[i];
        const el = document.createElement('div');
        el.className = 'stash-item';
        el.innerText = item.emoji || '📦';
        el.title = `${item.name} (点击卸下)`;
        el.addEventListener('click', () => {
          unequipItem(i);
          refreshStashUI();
        });
        equipGrid.appendChild(el);
      }
    }
  }

  // Sell button
  if (sellBtn) {
    sellBtn.onclick = () => {
      if (selectedStashIdx >= 0) {
        const price = sellStashItem(selectedStashIdx);
        if (price > 0) {
          refreshStashUI();
          refreshShopUI();
        }
      }
    };
  }

  // Equip button
  if (equipBtn) {
    equipBtn.onclick = () => {
      if (selectedStashIdx >= 0) {
        if (equipItem(selectedStashIdx)) {
          refreshStashUI();
        }
      }
    };
  }
}

let shopItems = [];
export function initShopUI(items) {
  shopItems = items;
  refreshShopUI();
}

function refreshShopUI() {
  const grid = document.getElementById('shop-grid');
  if (!grid || !shopItems.length) return;
  const coins = getCoins();

  grid.innerHTML = '';
  for (let i = 0; i < shopItems.length; i++) {
    const item = shopItems[i];
    const el = document.createElement('div');
    el.className = 'shop-item';
    const canAfford = coins >= item.price;
    el.style.opacity = canAfford ? '1' : '0.4';
    el.innerHTML = `
      <span class="shop-emoji">${item.emoji}</span>
      <span class="shop-name">${item.name}</span>
      <span class="shop-price">$${item.price.toLocaleString()}</span>
    `;
    el.title = canAfford ? `购买 ${item.name}` : '金币不足';
    el.addEventListener('click', async () => {
      const { buyItem } = await import('./shopdata.js');
      const result = buyItem(i);
      if (result.success) {
        refreshShopUI();
        refreshStashUI();
      }
    });
    grid.appendChild(el);
  }
}

export function hideStartScreen() {
  startScreen.classList.add('hidden');
  hudOverlay.classList.remove('hidden');
}

export function onDeploy(callback) {
  deployBtn.addEventListener('click', callback);
}

export function showGameOver() {
  resultModal.classList.remove('hidden');
  resultTitle.innerText = '特工阵亡';
  resultTitle.style.color = '#f43f5e';
  resultDesc.innerText = '你在 DELTA-01 区域被消灭。所有未带出的战利品已遗失。';
  summaryLootContainer.innerHTML = '';
  restartBtn.innerText = '返回大厅';
}

export function showVictory(player, totalValue = 0, bonus = 0) {
  resultModal.classList.remove('hidden');
  resultTitle.innerText = '撤离成功';
  resultTitle.style.color = '#10b981';
  resultDesc.innerText = `你已安全撤离。战利品价值: $${totalValue.toLocaleString()} + 撤离奖励: $${bonus.toLocaleString()}`;
  summaryLootContainer.innerHTML = '';
  if (player.inventory.length === 0) {
    summaryLootContainer.innerHTML = '<span style="color:#94a3b8;">空空如也</span>';
  } else {
    for (const item of player.inventory) {
      const sp = document.createElement('span');
      sp.style.fontSize = '2rem';
      sp.innerText = item.emoji;
      sp.title = `${item.name} ($${item.value?.toLocaleString() || 0})`;
      summaryLootContainer.appendChild(sp);
    }
  }
  const coinInfo = document.createElement('div');
  coinInfo.style.cssText = 'width:100%;margin-top:8px;font-family:var(--font-mono);color:var(--accent-amber);font-size:0.9rem;';
  coinInfo.innerText = `💰 获得 $${(totalValue + bonus).toLocaleString()} (当前余额: $${getCoins().toLocaleString()})`;
  summaryLootContainer.appendChild(coinInfo);
  restartBtn.innerText = '返回大厅';
}

export function onRestart(callback) {
  restartBtn.addEventListener('click', () => {
    resultModal.classList.add('hidden');
    callback();
  });
}
