// main.js - Game entry point, world init, game loop (Phase 3)
import { WORLD_WIDTH, WORLD_HEIGHT, TILE_SIZE } from './constants.js';
import { Player, Wall, Bot, Loot, Particle, SoundBlip, applyLootData } from './entities.js';
import { keys, mouse, initInput } from './input.js';
import { aabb, getPlayerBox, raycastHitscan, movePlayer } from './physics.js';
import { updateBots } from './ai.js';
import { render } from './renderer.js';
import { initHUD, updateHUD, refreshInventoryGrid, pushNotification, getElements } from './hud.js';
import { showStartScreen, hideStartScreen, onDeploy, showGameOver, showVictory, onRestart, showLoginScreen, onLogin, initShopUI } from './ui.js';
import { loadShopData } from './shopdata.js';
import { loadMap, buildWorldFromMap } from './maploader.js';
import { playShootSound, playHitSound, playPickupSound, playExtractionBeep, playEnemyShootSound, playGrenadeSound } from './sound.js';
import { randomLootType, getLootDef, loadLootData } from './lootdata.js';
import { loadOperatorData, defaultOperator, getOperatorDef, allOperators } from './operatordata.js';
import { loadBotData } from './botdata.js';
import { addCoins, getCoins, addToStash, clearEquipped, getEquipped } from './economy.js';
import { loadWeaponData, getWeaponDef } from './weapondata.js';

// ---- Canvas setup ----
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('gameCanvas'));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

// ---- State ----
let selectedOpId = null;
let player = new Player(defaultOperator());
let walls = [];
let bots = [];
let loots = [];
let particles = [];
let soundBlips = [];
let nearestLoot = null;
let camera = { x: 0, y: 0 };
let isGameOver = false;
let gameStarted = false; // prevents update logic until deploy
let shakeAmount = 0;
let helipad = { x: WORLD_WIDTH - 400, y: 300, w: 220, h: 220, emoji: '🚁' };
let extractions = []; // multiple extraction points
let mapName = 'DELTA-01';
let extractionBeepTimer = 0;
let weaponSlots = [];  // weapons brought into raid
let selectedWeaponIdx = 0;

async function initWorld() {
  walls = []; bots = []; loots = []; particles = []; soundBlips = [];
  isGameOver = false;
  gameStarted = true; // unlock combat logic
  const opDef = getOperatorDef(selectedOpId || defaultOperator().id);
  player = new Player(opDef);
  player.coins = getCoins();

  // Load JSON map (Phase 3)
  const mapData = await loadMap('maps/factory_01.json');
  const world = buildWorldFromMap(mapData);

  walls = world.walls;
  bots = world.bots;
  loots = world.loots;
  extractions = world.extractions || [world.helipad];
  helipad = extractions[0] || world.helipad;
  mapName = world.mapName || 'DELTA-01';
  player.x = world.spawnX;
  player.y = world.spawnY;

  // Load weapon slots from equipped items (max 2 weapons)
  weaponSlots = [];
  const equipped = getEquipped();
  for (const item of equipped) {
    if (item.id && item.id.startsWith('weapon_') && weaponSlots.length < 2) {
      const def = getWeaponDef(item.id);
      weaponSlots.push({
        id: item.id, emoji: item.emoji, name: item.name,
        damage: def?.damage, penetration: def?.penetration,
        fireRate: def?.fireRate, magSize: def?.magSize,
        maxAmmo: def?.maxAmmo, reloadTime: def?.reloadTime,
        ammoType: def?.ammoType, currentAmmo: def?.magSize
      });
    }
  }
  // Fallback: at least the default gun
  if (weaponSlots.length === 0) {
    weaponSlots.push({ id: 'default', emoji: '🔫', name: player.gun.name });
  }
  selectedWeaponIdx = 0;
  applyWeaponStats();

  // Apply all equipped consumables/gear to player
  player.grenadeCount = 0;
  player.medkitCount = 0;
  for (const item of equipped) {
    if (item.id === 'grenade') player.grenadeCount++;
    if (item.id === 'medkit' || item.id === 'medkit_large') player.medkitCount++;
    // Armor: override operator default
    if (item.id === 'armor_light') {
      player.armor = Math.max(player.armor, 120);
      player.maxArmor = Math.max(player.maxArmor, 120);
      player.armorClass = Math.max(player.armorClass, 3);
    }
    if (item.id === 'armor_heavy') {
      player.armor = Math.max(player.armor, 220);
      player.maxArmor = Math.max(player.maxArmor, 220);
      player.armorClass = Math.max(player.armorClass, 5);
    }
    // Backpack: increase inventory capacity
    if (item.id === 'backpack') {
      player.maxSlots += 4;
    }
    // Ammo boxes: boost reserve ammo for matching weapon
    if (item.id === 'ammo_9mm' && player.gun.ammoType === '9mm') {
      player.gun.maxAmmo += 120;
    }
    if (item.id === 'ammo_rifle' && player.gun.ammoType === 'rifle') {
      player.gun.maxAmmo += 120;
    }
    if (item.id === 'ammo_shell' && player.gun.ammoType === 'shell') {
      player.gun.maxAmmo += 24;
    }
  }

  pushNotification(`⚡ 成功部署至 ${mapName}。寻找物资并前往直升机点撤离！`);
}

// ---- Actions ----
function fireWeapon() {
  if (player.gun.currentAmmo <= 0) {
    if (!player.gun.isReloading && player.gun.maxAmmo > 0) reloadWeapon();
    return;
  }
  player.gun.currentAmmo--;
  player.gun.cooldown = player.gun.fireRate;
  shakeAmount = 4;

  // Play shoot sound (try-catch silent if unavailable)
  playShootSound();

  const targetAngle = Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x);
  const finalAngle = targetAngle + (Math.random() - 0.5) * player.spread;

  const rayOrigin = { x: player.x, y: player.y };
  const rayDir = { x: Math.cos(finalAngle), y: Math.sin(finalAngle) };
  const closestHit = raycastHitscan(rayOrigin, rayDir, 1200, walls, bots);

  // Muzzle flash
  for (let k = 0; k < 5; k++) {
    const pAngle = finalAngle + (Math.random() - 0.5) * 0.4;
    const pSpeed = 200 + Math.random() * 300;
    particles.push(new Particle(
      rayOrigin.x + rayDir.x * 30, rayOrigin.y + rayDir.y * 30,
      Math.cos(pAngle) * pSpeed, Math.sin(pAngle) * pSpeed,
      '#f59e0b', 0.1, 4
    ));
  }

  soundBlips.push(new SoundBlip(rayOrigin.x, rayOrigin.y, 600));

  if (closestHit) {
    playHitSound();

    for (let k = 0; k < 8; k++) {
      const sparkAngle = finalAngle + Math.PI + (Math.random() - 0.5) * 1.2;
      const sparkSpeed = 100 + Math.random() * 250;
      particles.push(new Particle(
        closestHit.x, closestHit.y,
        Math.cos(sparkAngle) * sparkSpeed, Math.sin(sparkAngle) * sparkSpeed,
        closestHit.type === 'bot' ? '#ef4444' : '#e2e8f0',
        0.2, closestHit.type === 'bot' ? 6 : 3
      ));
    }

    if (closestHit.type === 'bot' && closestHit.entity) {
      const bot = closestHit.entity;
      const isHeadshot = Math.random() < 0.25;
      const dmg = isHeadshot ? player.gun.damage * 2 : player.gun.damage;
      bot.hp -= dmg;
      bot.state = 'aggro';
      bot.targetX = player.x;
      bot.targetY = player.y;
      bot.reactionDelay = 0; // instantly react when hit

      if (bot.hp <= 0) {
        const idx = bots.indexOf(bot);
        if (idx !== -1) bots.splice(idx, 1);
        pushNotification(`💥 击杀 ${bot.emoji} (获得 150 EXP)`);
        const dropType = randomLootType();
        const dropLoot = new Loot(bot.x, bot.y, dropType);
        applyLootData(dropLoot, getLootDef(dropType));
        loots.push(dropLoot);
      }
    }
  }
}

function reloadWeapon() {
  if (player.gun.isReloading || player.gun.currentAmmo === player.gun.magSize || player.gun.maxAmmo <= 0) return;
  player.gun.isReloading = true;
  player.gun.reloadTimer = player.gun.reloadTime;
}

function interactTarget() {
  if (nearestLoot && player.inventory.length < player.maxSlots) {
    player.inventory.push(nearestLoot);
    const idx = loots.indexOf(nearestLoot);
    if (idx !== -1) loots.splice(idx, 1);
    pushNotification(`📥 拾取了 ${nearestLoot.name}`);
    playPickupSound();

    // Apply onPickup effect
    const def = getLootDef(nearestLoot.type);
    if (def.onPickup === 'heal_50') {
      player.hp = Math.min(player.maxHp, player.hp + 50);
      pushNotification('❤️ 使用医疗包，恢复 50 HP');
    } else if (def.onPickup === 'heal_100') {
      player.hp = Math.min(player.maxHp, player.hp + 100);
      pushNotification('❤️ 使用外科手术包，恢复 100 HP');
    }
    // Ammo pickup: add to gun reserve if type matches
    if (def.ammoAmount && player.gun.ammoType === def.ammoType) {
      player.gun.maxAmmo += def.ammoAmount;
      pushNotification(`📦 弹药补给 +${def.ammoAmount} 发 (${def.ammoType})`);
    }

    nearestLoot = null;
    refreshInventoryGrid(player);
  } else if (nearestLoot && player.inventory.length >= player.maxSlots) {
    pushNotification('⚠️ 背包已满，无法拾取！');
  }
}

function toggleInventory() {
  getElements().inventoryDrawer.classList.toggle('hidden');
}

function throwGrenade() {
  if (player.grenadeCount <= 0) { pushNotification('⚠️ 没有手榴弹！'); return; }
  player.grenadeCount--;
  playGrenadeSound();
  pushNotification('💥 手榴弹投出！');

  // Explosion at cursor position
  const gx = mouse.worldX;
  const gy = mouse.worldY;
  const radius = 150;
  const dmg = 80;

  // Damage bots in range
  for (const bot of bots) {
    const dist = Math.hypot(bot.x - gx, bot.y - gy);
    if (dist <= radius) {
      bot.hp -= dmg * (1 - dist / radius);
      bot.state = 'aggro';
      bot.targetX = player.x;
      bot.targetY = player.y;
      bot.reactionDelay = 0;
    }
  }

  // Explosion particles
  for (let k = 0; k < 30; k++) {
    const pAngle = Math.random() * Math.PI * 2;
    const pSpeed = 100 + Math.random() * 300;
    particles.push(new Particle(gx, gy, Math.cos(pAngle) * pSpeed, Math.sin(pAngle) * pSpeed, '#f59e0b', 0.3 + Math.random() * 0.3, 5 + Math.random() * 8));
  }

  // Remove dead bots
  for (let i = bots.length - 1; i >= 0; i--) {
    if (bots[i].hp <= 0) {
      pushNotification(`💥 击杀 ${bots[i].emoji}`);
      loots.push(new Loot(bots[i].x, bots[i].y, randomLootType()));
      bots.splice(i, 1);
    }
  }

  soundBlips.push(new SoundBlip(gx, gy, 600));
  shakeAmount = 15;
}

function useMedkit() {
  if (player.medkitCount <= 0) { pushNotification('⚠️ 没有医疗用品！'); return; }
  if (player.hp >= player.maxHp) { pushNotification('⚠️ 生命值已满！'); return; }
  player.medkitCount--;
  player.hp = Math.min(player.maxHp, player.hp + 50);
  pushNotification(`❤️ 使用医疗包 +50 HP (剩余 ${player.medkitCount} 个)`);
}

function switchWeapon(idx) {
  if (idx < 0 || idx >= weaponSlots.length || idx === selectedWeaponIdx) return;
  // Save current weapon ammo state before switching
  const cur = weaponSlots[selectedWeaponIdx];
  if (cur && cur.id !== 'default') {
    cur.currentAmmo = player.gun.currentAmmo;
    cur.maxAmmo = player.gun.maxAmmo;
  }
  // Switch to new weapon
  selectedWeaponIdx = idx;
  applyWeaponStats();
  pushNotification(`🔫 切换至 ${weaponSlots[idx].name}`);
}

function applyWeaponStats() {
  const wp = weaponSlots[selectedWeaponIdx];
  if (!wp || wp.id === 'default') return;
  const def = getWeaponDef(wp.id) || wp; // fallback to slot data if no JSON def
  Object.assign(player.gun, {
    name: def.name || wp.name,
    damage: def.damage || 28,
    penetration: def.penetration || 35,
    fireRate: def.fireRate || 0.08,
    magSize: def.magSize || 30,
    currentAmmo: wp.currentAmmo != null ? wp.currentAmmo : (def.magSize || 30),
    maxAmmo: wp.maxAmmo != null ? wp.maxAmmo : (def.maxAmmo || 120),
    reloadTime: def.reloadTime || 1.8,
    ammoType: def.ammoType || '9mm'
  });
}

// ---- Update loop ----
function update(dt) {
  if (isGameOver || !gameStarted) return;
  if (shakeAmount > 0) shakeAmount = Math.max(0, shakeAmount - dt * 20);

  mouse.worldX = mouse.x + camera.x;
  mouse.worldY = mouse.y + camera.y;

  movePlayer(player, dt, keys, walls, WORLD_WIDTH, WORLD_HEIGHT);

  // Gun
  if (player.gun.cooldown > 0) player.gun.cooldown -= dt;
  if (player.gun.isReloading) {
    player.gun.reloadTimer -= dt;
    if (player.gun.reloadTimer <= 0) {
      player.gun.isReloading = false;
      const needed = player.gun.magSize - player.gun.currentAmmo;
      const available = Math.min(needed, player.gun.maxAmmo);
      player.gun.currentAmmo += available;
      player.gun.maxAmmo -= available;
      pushNotification('🔄 武器装弹完毕。');
    }
  } else if (mouse.isDown && player.gun.cooldown <= 0) {
    fireWeapon();
  }

  // Bots (Phase 3: enhanced AI)
  const botResult = updateBots(dt, bots, player, soundBlips, walls);
  if (botResult.fired) {
    playEnemyShootSound(); // enemy gunshot sound
  }
  if (botResult.hit) {
    shakeAmount = 10;
    playHitSound();
    pushNotification(`⚠️ 遭到 ${botResult.bot?.emoji || '🧟'} 攻击！`);
    if (player.hp <= 0) {
      isGameOver = true;
      clearEquipped();
      showGameOver();
    }
  }

  // Extraction — check all points
  const pBox = getPlayerBox(player, player.x, player.y);
  let inExtraction = false;
  for (const ext of extractions) {
    if (aabb(pBox.x, pBox.y, pBox.w, pBox.h, ext.x, ext.y, ext.w, ext.h)) {
      inExtraction = true;
      break;
    }
  }
  if (inExtraction) {
    if (!player.isExtracting) {
      player.isExtracting = true;
      player.extractTimer = player.extractDuration;
      getElements().extractionBanner.classList.remove('hidden');
      pushNotification('🚁 进入撤离区！保持存活 10 秒钟...');
    }
    player.extractTimer -= dt;
    // Extraction beep every second
    extractionBeepTimer -= dt;
    if (extractionBeepTimer <= 0) {
      extractionBeepTimer = 1.0;
      playExtractionBeep(1 - player.extractTimer / player.extractDuration);
    }
    if (player.extractTimer <= 0) {
      isGameOver = true;
      // Move loot to stash
      for (const item of player.inventory) {
        addToStash({ id: item.type, emoji: item.emoji, name: item.name, value: item.value || 0 });
      }
      const totalValue = player.inventory.reduce((sum, item) => sum + (item.value || 0), 0);
      const bonus = 5000;
      addCoins(totalValue + bonus);
      showVictory(player, totalValue, bonus);
      return;
    }
  } else if (player.isExtracting) {
    player.isExtracting = false;
    getElements().extractionBanner.classList.add('hidden');
    pushNotification('⚠️ 离开撤离区，撤离流程中断！');
  }

  // Nearest loot
  nearestLoot = null;
  let minDist = 60;
  for (const loot of loots) {
    const dist = Math.hypot(player.x - loot.x, player.y - loot.y);
    if (dist < minDist) { minDist = dist; nearestLoot = loot; }
  }

  // Particles & sound blips
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].x += particles[i].vx * dt;
    particles[i].y += particles[i].vy * dt;
    particles[i].life -= dt;
    if (particles[i].life <= 0) particles.splice(i, 1);
  }
  for (let i = soundBlips.length - 1; i >= 0; i--) {
    soundBlips[i].life -= dt;
    if (soundBlips[i].life <= 0) soundBlips.splice(i, 1);
  }

  // Camera
  const targetCamX = player.x - canvas.width / 2;
  const targetCamY = player.y - canvas.height / 2;
  camera.x += (targetCamX - camera.x) * 10 * dt;
  camera.y += (targetCamY - camera.y) * 10 * dt;

  // Sync weapon/grenade/med state to player for HUD
  player.weaponSlots = weaponSlots;
  player.selectedWeaponIdx = selectedWeaponIdx;
  updateHUD(player, nearestLoot);
}

// ---- Game loop ----
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  update(dt);
  render(ctx, canvas, camera, { player, walls, bots, loots, particles, soundBlips, helipad, extractions, mouse, shakeAmount });
  requestAnimationFrame(loop);
}

// ---- Init ----
initHUD();
initInput(canvas, camera, interactTarget, reloadWeapon, toggleInventory, throwGrenade, useMedkit, switchWeapon);

// ---- Operator picker on start screen ----
function initOperatorPicker() {
  const ops = allOperators();
  const container = document.getElementById('operator-cards');
  if (!container) return;
  container.innerHTML = '';

  ops.forEach((op, i) => {
    const card = document.createElement('div');
    card.className = 'op-card' + (i === 0 ? ' selected' : '');
    card.innerHTML = `<span class="op-emoji">${op.emoji}</span><span class="op-name">${op.name}</span><span class="op-desc">${op.description}</span>`;
    card.addEventListener('click', () => {
      container.querySelectorAll('.op-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedOpId = op.id;
    });
    container.appendChild(card);
  });

  if (ops.length > 0) selectedOpId = ops[0].id;
}

// Login → Start screen flow
Promise.all([loadLootData(), loadOperatorData(), loadBotData(), loadShopData(), loadWeaponData()]).then(() => {
  initOperatorPicker();
  showLoginScreen();
  onLogin((name) => {
    initShopUI([]);
    import('./shopdata.js').then(m => initShopUI(m.getShopItems()));
    showStartScreen();
  });
});

onDeploy(async () => {
  hideStartScreen();
  await initWorld();
  refreshInventoryGrid(player);
});

onRestart(async () => {
  await initWorld();
  refreshInventoryGrid(player);
  isGameOver = false;
});

// Start rendering
requestAnimationFrame(loop);
