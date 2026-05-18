// ui.js - Start screen, game over modal, victory screen
const resultModal = document.getElementById('result-modal');
const resultTitle = document.getElementById('result-title');
const resultDesc = document.getElementById('result-desc');
const summaryLootContainer = document.getElementById('summary-loot-container');
const restartBtn = document.getElementById('restart-btn');
const startScreen = document.getElementById('start-screen');
const deployBtn = document.getElementById('deploy-btn');
const hudOverlay = document.getElementById('hud');

export function showStartScreen() {
  startScreen.classList.remove('hidden');
  hudOverlay.classList.add('hidden');
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
  restartBtn.innerText = '重新部署';
}

export function showVictory(player) {
  resultModal.classList.remove('hidden');
  resultTitle.innerText = '撤离成功';
  resultTitle.style.color = '#10b981';
  resultDesc.innerText = '你已安全撤离。以下是带出的珍贵战利品：';
  summaryLootContainer.innerHTML = '';
  if (player.inventory.length === 0) {
    summaryLootContainer.innerHTML = '<span style="color:#94a3b8;">空空如也</span>';
  } else {
    for (const item of player.inventory) {
      const sp = document.createElement('span');
      sp.style.fontSize = '2rem';
      sp.innerText = item.emoji;
      sp.title = item.name;
      summaryLootContainer.appendChild(sp);
    }
  }
  restartBtn.innerText = '开始新对局';
}

export function onRestart(callback) {
  restartBtn.addEventListener('click', () => {
    resultModal.classList.add('hidden');
    callback();
  });
}
