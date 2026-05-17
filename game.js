// game.js - Authoritative Client Engine for Emoji Delta (Phase 1 MVP)
// Built with vanilla ES Modules, HTML5 Canvas, and strict architecture adherence.

// ============================================================================
// 1. CONSTANTS & WORLD SETUP
// ============================================================================
const WORLD_WIDTH = 3200;
const WORLD_HEIGHT = 2400;
const TILE_SIZE = 64;

/** @type {HTMLCanvasElement} */
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('gameCanvas'));
/** @type {CanvasRenderingContext2D} */
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

// HUD DOM Elements
const hudHpText = document.getElementById('hp-text');
const hudHpFill = document.getElementById('hp-fill');
const hudArmorText = document.getElementById('armor-text');
const hudArmorFill = document.getElementById('armor-fill');
const hudStaminaText = document.getElementById('stamina-text');
const hudStaminaFill = document.getElementById('stamina-fill');
const hudAmmoCurrent = document.getElementById('ammo-current');
const hudAmmoMax = document.getElementById('ammo-max');
const hudReloadingMsg = document.getElementById('reloading-msg');
const hudInteractionPrompt = document.getElementById('interaction-prompt');
const hudInteractionText = document.getElementById('interaction-text');
const hudExtractionBanner = document.getElementById('extraction-banner');
const hudExtractProgressBar = document.getElementById('extract-progress-bar');
const hudExtractTimeText = document.getElementById('extract-time-text');
const hudInventoryDrawer = document.getElementById('inventory-drawer');
const hudLootGrid = document.getElementById('loot-grid');
const hudLootCount = document.getElementById('loot-count');
const hudNotificationFeed = document.getElementById('notification-feed');
const resultModal = document.getElementById('result-modal');
const resultTitle = document.getElementById('result-title');
const resultDesc = document.getElementById('result-desc');
const summaryLootContainer = document.getElementById('summary-loot-container');
const restartBtn = document.getElementById('restart-btn');

// ============================================================================
// 2. INPUT STATE & EVENT LISTENERS
// ============================================================================
const keys = { w: false, a: false, s: false, d: false, shift: false };
const mouse = { x: 0, y: 0, worldX: 0, worldY: 0, isDown: false };

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
window.dispatchEvent(new Event('resize'));

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW' || e.key === 'w' || e.key === 'W') keys.w = true;
  if (e.code === 'KeyA' || e.key === 'a' || e.key === 'A') keys.a = true;
  if (e.code === 'KeyS' || e.key === 's' || e.key === 'S') keys.s = true;
  if (e.code === 'KeyD' || e.key === 'd' || e.key === 'D') keys.d = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true;
  
  if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
    interactTarget();
  }
  if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R') {
    reloadWeapon();
  }
  if (e.code === 'Tab' || e.key === 'Tab') {
    e.preventDefault();
    hudInventoryDrawer.classList.toggle('hidden');
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW' || e.key === 'w' || e.key === 'W') keys.w = false;
  if (e.code === 'KeyA' || e.key === 'a' || e.key === 'A') keys.a = false;
  if (e.code === 'KeyS' || e.key === 's' || e.key === 'S') keys.s = false;
  if (e.code === 'KeyD' || e.key === 'd' || e.key === 'D') keys.d = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false;
});

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

window.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouse.isDown = true;
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouse.isDown = false;
});

// Prevent context menu
window.addEventListener('contextmenu', (e) => e.preventDefault());

// ============================================================================
// 3. ENTITY & STATE DEFINITIONS
// ============================================================================
class Player {
  constructor() {
    this.x = WORLD_WIDTH / 2;
    this.y = WORLD_HEIGHT / 2;
    this.size = 48;
    this.emoji = '🥷'; // Ninja/Light-armor fast operator
    
    this.maxHp = 100;
    this.hp = 100;
    this.maxArmor = 80;
    this.armor = 80;
    this.armorClass = 4;
    
    this.maxStamina = 100;
    this.stamina = 100;
    
    this.baseSpeed = 300; // px / sec
    this.sprintMultiplier = 1.6;
    this.isSprinting = false;
    
    // Gun specs
    this.gun = {
      name: 'TAC-SMG',
      damage: 28,
      penetration: 35, // Penetrates up to class 3 armor easily
      fireRate: 0.08, // seconds per shot (750 RPM)
      cooldown: 0,
      magSize: 30,
      currentAmmo: 30,
      maxAmmo: 120,
      isReloading: false,
      reloadTime: 1.8, // seconds
      reloadTimer: 0
    };
    
    // Spread calculation
    this.spread = 0.02; // minimum spread in radians
    
    // Extraction state
    this.isExtracting = false;
    this.extractTimer = 0;
    this.extractDuration = 10.0; // seconds
    
    // Inventory
    this.inventory = [];
    this.maxSlots = 12;
  }
}

class Wall {
  constructor(x, y, w, h, emoji = '🧱', isBlockingLoS = true) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.emoji = emoji;
    this.isBlockingLoS = isBlockingLoS; // Trees 🌲 block LoS but not bullets
  }
}

class Bot {
  constructor(x, y, type) {
    this.id = Math.random().toString();
    this.x = x;
    this.y = y;
    this.size = 48;
    this.type = type; // 'melee' | 'ranged' | 'boss'
    this.emoji = type === 'melee' ? '🧟' : (type === 'boss' ? '👹' : '👮');
    this.hp = type === 'boss' ? 300 : 80;
    this.maxHp = this.hp;
    this.speed = type === 'melee' ? 180 : 140;
    
    // State machine: 'patrol' | 'investigate' | 'aggro'
    this.state = 'patrol';
    this.targetX = x + (Math.random() - 0.5) * 300;
    this.targetY = y + (Math.random() - 0.5) * 300;
    this.patrolTimer = 0;
    this.fireCooldown = 0;
  }
}

class Loot {
  constructor(x, y, type) {
    this.id = Math.random().toString();
    this.x = x;
    this.y = y;
    this.size = 36;
    this.type = type; // 'cash' | 'gem' | 'box' | 'backpack'
    this.emoji = type === 'cash' ? '💵' : type === 'gem' ? '💎' : type === 'box' ? '📦' : '🎒';
    this.name = type === 'cash' ? '大捆现金 ($5,000)' : type === 'gem' ? '高价值蓝钻 ($35,000)' : type === 'box' ? '军用物资箱 (Tactical Box)' : '遗落的特工背包';
  }
}

class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size;
  }
}

class SoundBlip {
  constructor(x, y, radius = 500) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.life = 0.5; // seconds
    this.maxLife = 0.5;
  }
}

// ============================================================================
// 4. GAME STATE INSTANTIATION
// ============================================================================
let player = new Player();
/** @type {Wall[]} */
let walls = [];
/** @type {Bot[]} */
let bots = [];
/** @type {Loot[]} */
let loots = [];
/** @type {Particle[]} */
let particles = [];
/** @type {SoundBlip[]} */
let soundBlips = [];
/** @type {Loot|null} */
let nearestLoot = null;

let camera = { x: 0, y: 0 };
let isGameOver = false;
let shakeAmount = 0;

// Helipad / Extraction Zone
const helipad = {
  x: WORLD_WIDTH - 400,
  y: 300,
  w: 220,
  h: 220,
  emoji: '🚁'
};

function initWorld() {
  walls = [];
  bots = [];
  loots = [];
  particles = [];
  soundBlips = [];
  isGameOver = false;

  player = new Player();
  player.x = 400;
  player.y = WORLD_HEIGHT - 400;

  // Generate World Borders
  walls.push(new Wall(-TILE_SIZE, -TILE_SIZE, WORLD_WIDTH + TILE_SIZE*2, TILE_SIZE));
  walls.push(new Wall(-TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH + TILE_SIZE*2, TILE_SIZE));
  walls.push(new Wall(-TILE_SIZE, 0, TILE_SIZE, WORLD_HEIGHT));
  walls.push(new Wall(WORLD_WIDTH, 0, TILE_SIZE, WORLD_HEIGHT));

  // Cellular / Grid style random obstacle generation with tactical layouts
  const cols = Math.floor(WORLD_WIDTH / TILE_SIZE);
  const rows = Math.floor(WORLD_HEIGHT / TILE_SIZE);

  for (let r = 2; r < rows - 2; r++) {
    for (let c = 2; c < cols - 2; c++) {
      // Keep extraction zone clear
      if (c * TILE_SIZE > helipad.x - 100 && r * TILE_SIZE < helipad.y + helipad.h + 100) continue;
      // Keep player spawn clear
      if (Math.hypot(c*TILE_SIZE - player.x, r*TILE_SIZE - player.y) < 300) continue;

      if (Math.random() < 0.12) {
        // Brick wall (blocks LoS and bullets)
        walls.push(new Wall(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE, '🧱', true));
      } else if (Math.random() < 0.08) {
        // Tree obstacle (blocks LoS, doesn't block bullets)
        walls.push(new Wall(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE, '🌲', true));
      }
    }
  }

  // Spawn Bots
  for (let i = 0; i < 16; i++) {
    let bx = 300 + Math.random() * (WORLD_WIDTH - 600);
    let by = 300 + Math.random() * (WORLD_HEIGHT - 600);
    let type = Math.random() < 0.5 ? 'melee' : 'ranged';
    if (i === 0) type = 'boss'; // One boss entity
    bots.push(new Bot(bx, by, type));
  }

  // Spawn Loot
  for (let i = 0; i < 20; i++) {
    let lx = 200 + Math.random() * (WORLD_WIDTH - 400);
    let ly = 200 + Math.random() * (WORLD_HEIGHT - 400);
    let type = Math.random() < 0.4 ? 'cash' : (Math.random() < 0.7 ? 'box' : 'gem');
    loots.push(new Loot(lx, ly, type));
  }

  pushNotification('⚡ 成功部署至 DELTA-01 区域。寻找物资并前往直升机点撤离！');
}

// Notification push
function pushNotification(text) {
  const item = document.createElement('div');
  item.className = 'feed-item';
  item.innerHTML = `<span>💬</span><span>${text}</span>`;
  hudNotificationFeed.appendChild(item);
  setTimeout(() => {
    if (item.parentElement) item.parentElement.removeChild(item);
  }, 4000);
}

// ============================================================================
// 5. PHYSICS & COLLISION HELPERS
// ============================================================================
function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function getPlayerBox(px, py) {
  // Bounding box centered on player
  return { x: px - player.size*0.4, y: py - player.size*0.4, w: player.size*0.8, h: player.size*0.8 };
}

// ============================================================================
// 6. MAIN UPDATE LOOP
// ============================================================================
function update(dt) {
  if (isGameOver) return;

  // Screen shake decay
  if (shakeAmount > 0) shakeAmount = Math.max(0, shakeAmount - dt * 20);

  // Update Mouse World Position
  mouse.worldX = mouse.x + camera.x;
  mouse.worldY = mouse.y + camera.y;

  // 1. Stamina & Movement Calculation
  let moveX = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  let moveY = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
  let moveLen = Math.hypot(moveX, moveY);

  player.isSprinting = keys.shift && moveLen > 0 && player.stamina > 0;
  let speed = player.baseSpeed;
  
  if (player.isSprinting) {
    speed *= player.sprintMultiplier;
    player.stamina = Math.max(0, player.stamina - dt * 35); // drain stamina
  } else {
    // Regenerate stamina
    let regenRate = moveLen > 0 ? 15 : 35;
    player.stamina = Math.min(player.maxStamina, player.stamina + dt * regenRate);
  }

  // Dynamic Spread Modifier based on movement
  if (player.isSprinting) player.spread = 0.16;
  else if (moveLen > 0) player.spread = 0.08;
  else player.spread = 0.02;

  // 2. Predict Collision (AABB) & Slide along walls
  if (moveLen > 0) {
    let normX = moveX / moveLen;
    let normY = moveY / moveLen;
    
    let vx = normX * speed * dt;
    let vy = normY * speed * dt;

    // Check X axis
    let boxX = getPlayerBox(player.x + vx, player.y);
    let collideX = false;
    for (const wall of walls) {
      if (aabb(boxX.x, boxX.y, boxX.w, boxX.h, wall.x, wall.y, wall.w, wall.h)) {
        collideX = true;
        break;
      }
    }
    if (!collideX) player.x += vx;

    // Check Y axis
    let boxY = getPlayerBox(player.x, player.y + vy);
    let collideY = false;
    for (const wall of walls) {
      if (aabb(boxY.x, boxY.y, boxY.w, boxY.h, wall.x, wall.y, wall.w, wall.h)) {
        collideY = true;
        break;
      }
    }
    if (!collideY) player.y += vy;

    // Clamp to map boundaries
    player.x = Math.max(player.size/2, Math.min(WORLD_WIDTH - player.size/2, player.x));
    player.y = Math.max(player.size/2, Math.min(WORLD_HEIGHT - player.size/2, player.y));
  }

  // 3. Gun Cooldown & Reloading
  if (player.gun.cooldown > 0) player.gun.cooldown -= dt;
  if (player.gun.isReloading) {
    player.gun.reloadTimer -= dt;
    if (player.gun.reloadTimer <= 0) {
      player.gun.isReloading = false;
      let needed = player.gun.magSize - player.gun.currentAmmo;
      let available = Math.min(needed, player.gun.maxAmmo);
      player.gun.currentAmmo += available;
      player.gun.maxAmmo -= available;
      pushNotification('🔄 武器装弹完毕。');
    }
  } else if (mouse.isDown && player.gun.cooldown <= 0) {
    fireWeapon();
  }

  // 4. Update Bots (AI FSM)
  updateBots(dt);

  // 5. Check Extraction
  let pBox = getPlayerBox(player.x, player.y);
  if (aabb(pBox.x, pBox.y, pBox.w, pBox.h, helipad.x, helipad.y, helipad.w, helipad.h)) {
    if (!player.isExtracting) {
      player.isExtracting = true;
      player.extractTimer = player.extractDuration;
      hudExtractionBanner.classList.remove('hidden');
      pushNotification('🚁 进入撤离区！保持存活 10 秒钟...');
    }
    player.extractTimer -= dt;
    if (player.extractTimer <= 0) {
      triggerVictory();
    }
  } else if (player.isExtracting) {
    player.isExtracting = false;
    hudExtractionBanner.classList.add('hidden');
    pushNotification('⚠️ 离开撤离区，撤离流程中断！');
  }

  // 6. Interaction Check (Nearest Loot)
  nearestLoot = null;
  let minDist = 60; // interact distance
  for (const loot of loots) {
    let dist = Math.hypot(player.x - loot.x, player.y - loot.y);
    if (dist < minDist) {
      minDist = dist;
      nearestLoot = loot;
    }
  }

  // 7. Update Particles & Sound Blips
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (let i = soundBlips.length - 1; i >= 0; i--) {
    let b = soundBlips[i];
    b.life -= dt;
    if (b.life <= 0) soundBlips.splice(i, 1);
  }

  // 8. Smooth Camera Follow
  let targetCamX = player.x - canvas.width / 2;
  let targetCamY = player.y - canvas.height / 2;
  camera.x += (targetCamX - camera.x) * 10 * dt;
  camera.y += (targetCamY - camera.y) * 10 * dt;

  // Update HUD DOM
  updateHUD();
}

function fireWeapon() {
  if (player.gun.currentAmmo <= 0) {
    if (!player.gun.isReloading && player.gun.maxAmmo > 0) reloadWeapon();
    return;
  }

  player.gun.currentAmmo--;
  player.gun.cooldown = player.gun.fireRate;
  shakeAmount = 4; // screen shake

  // Calculate Angle + Spread
  let targetAngle = Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x);
  let finalAngle = targetAngle + (Math.random() - 0.5) * player.spread;

  // Instant Raycast Hitscan
  let rayOrigin = { x: player.x, y: player.y };
  let rayDir = { x: Math.cos(finalAngle), y: Math.sin(finalAngle) };
  
  let closestHit = raycastHitscan(rayOrigin, rayDir, 1200);

  // Muzzle flash particles
  for (let k = 0; k < 5; k++) {
    let pAngle = finalAngle + (Math.random() - 0.5) * 0.4;
    let pSpeed = 200 + Math.random() * 300;
    particles.push(new Particle(
      rayOrigin.x + rayDir.x * 30, rayOrigin.y + rayDir.y * 30,
      Math.cos(pAngle) * pSpeed, Math.sin(pAngle) * pSpeed,
      '#f59e0b', 0.1, 4
    ));
  }

  // Add sound blip (audible sensor for AI)
  soundBlips.push(new SoundBlip(rayOrigin.x, rayOrigin.y, 600));

  if (closestHit) {
    // Spawn hit sparks
    for (let k = 0; k < 8; k++) {
      let sparkAngle = finalAngle + Math.PI + (Math.random() - 0.5) * 1.2;
      let sparkSpeed = 100 + Math.random() * 250;
      particles.push(new Particle(
        closestHit.x, closestHit.y,
        Math.cos(sparkAngle) * sparkSpeed, Math.sin(sparkAngle) * sparkSpeed,
        closestHit.type === 'bot' ? '#ef4444' : '#e2e8f0',
        0.2, closestHit.type === 'bot' ? 6 : 3
      ));
    }

    // Damage Bot
    if (closestHit.type === 'bot' && closestHit.entity) {
      let bot = closestHit.entity;
      // Headshot simulation if close to top
      let isHeadshot = Math.random() < 0.25;
      let dmg = isHeadshot ? player.gun.damage * 2 : player.gun.damage;
      bot.hp -= dmg;
      bot.state = 'aggro'; // aggro instantly on hit
      bot.targetX = player.x;
      bot.targetY = player.y;

      if (bot.hp <= 0) {
        // Kill bot
        let idx = bots.indexOf(bot);
        if (idx !== -1) bots.splice(idx, 1);
        pushNotification(`💥 击杀 ${bot.emoji} (获得 150 EXP)`);
        // Drop loot
        loots.push(new Loot(bot.x, bot.y, Math.random() < 0.5 ? 'cash' : 'gem'));
      }
    }
  }
}

function raycastHitscan(origin, dir, maxDist) {
  let minT = maxDist;
  let hitInfo = null;

  // Check walls
  for (const wall of walls) {
    if (wall.emoji === '🌲') continue; // Bullets pass through trees
    let res = rayBoxIntersect(origin, dir, wall);
    if (res && res < minT) {
      minT = res;
      hitInfo = {
        x: origin.x + dir.x * minT,
        y: origin.y + dir.y * minT,
        type: 'wall',
        entity: wall
      };
    }
  }

  // Check bots
  for (const bot of bots) {
    let bBox = { x: bot.x - bot.size/2, y: bot.y - bot.size/2, w: bot.size, h: bot.size };
    let res = rayBoxIntersect(origin, dir, bBox);
    if (res && res < minT) {
      minT = res;
      hitInfo = {
        x: origin.x + dir.x * minT,
        y: origin.y + dir.y * minT,
        type: 'bot',
        entity: bot
      };
    }
  }

  return hitInfo;
}

function rayBoxIntersect(o, d, box) {
  let invDx = 1.0 / (d.x === 0 ? 0.00001 : d.x);
  let invDy = 1.0 / (d.y === 0 ? 0.00001 : d.y);

  let t1 = (box.x - o.x) * invDx;
  let t2 = (box.x + box.w - o.x) * invDx;
  let t3 = (box.y - o.y) * invDy;
  let t4 = (box.y + box.h - o.y) * invDy;

  let tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4));
  let tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4));

  if (tmax < 0 || tmin > tmax) return null;
  return tmin < 0 ? tmax : tmin;
}

function reloadWeapon() {
  if (player.gun.isReloading || player.gun.currentAmmo === player.gun.magSize || player.gun.maxAmmo <= 0) return;
  player.gun.isReloading = true;
  player.gun.reloadTimer = player.gun.reloadTime;
}

function interactTarget() {
  if (nearestLoot && player.inventory.length < player.maxSlots) {
    player.inventory.push(nearestLoot);
    let idx = loots.indexOf(nearestLoot);
    if (idx !== -1) loots.splice(idx, 1);
    pushNotification(`📥 拾取了 ${nearestLoot.name}`);
    nearestLoot = null;
    refreshInventoryGrid();
  } else if (nearestLoot && player.inventory.length >= player.maxSlots) {
    pushNotification('⚠️ 背包已满，无法拾取！');
  }
}

function updateBots(dt) {
  for (const bot of bots) {
    let distToPlayer = Math.hypot(player.x - bot.x, player.y - bot.y);

    // AI Sensory check (Vision & Sound)
    if (distToPlayer < 400 && hasLineOfSight({ x: bot.x, y: bot.y }, { x: player.x, y: player.y })) {
      bot.state = 'aggro';
      bot.targetX = player.x;
      bot.targetY = player.y;
    } else if (soundBlips.length > 0) {
      let latestBlip = soundBlips[soundBlips.length - 1];
      if (Math.hypot(latestBlip.x - bot.x, latestBlip.y - bot.y) <= latestBlip.radius) {
        if (bot.state !== 'aggro') {
          bot.state = 'investigate';
          bot.targetX = latestBlip.x + (Math.random() - 0.5)*100;
          bot.targetY = latestBlip.y + (Math.random() - 0.5)*100;
        }
      }
    }

    // State machine logic
    if (bot.state === 'patrol') {
      bot.patrolTimer -= dt;
      if (bot.patrolTimer <= 0) {
        bot.targetX = bot.x + (Math.random() - 0.5) * 400;
        bot.targetY = bot.y + (Math.random() - 0.5) * 400;
        bot.patrolTimer = 3 + Math.random() * 4;
      }
    }

    // Movement towards target
    let moveDist = Math.hypot(bot.targetX - bot.x, bot.targetY - bot.y);
    if (moveDist > 30) {
      let angle = Math.atan2(bot.targetY - bot.y, bot.targetX - bot.x);
      let nextX = bot.x + Math.cos(angle) * bot.speed * dt;
      let nextY = bot.y + Math.sin(angle) * bot.speed * dt;

      // Simple wall check for bot
      let bBox = { x: nextX - bot.size/2, y: nextY - bot.size/2, w: bot.size, h: bot.size };
      let collides = false;
      for (const wall of walls) {
        if (wall.emoji === '🧱' && aabb(bBox.x, bBox.y, bBox.w, bBox.h, wall.x, wall.y, wall.w, wall.h)) {
          collides = true;
          break;
        }
      }
      if (!collides) {
        bot.x = nextX;
        bot.y = nextY;
      } else {
        // Change target if stuck
        bot.targetX = bot.x + (Math.random() - 0.5) * 200;
        bot.targetY = bot.y + (Math.random() - 0.5) * 200;
      }
    }

    // Combat (Fire or Melee)
    if (bot.fireCooldown > 0) bot.fireCooldown -= dt;
    if (bot.state === 'aggro' && distToPlayer < (bot.type === 'melee' ? 60 : 350) && bot.fireCooldown <= 0) {
      if (hasLineOfSight({ x: bot.x, y: bot.y }, { x: player.x, y: player.y })) {
        bot.fireCooldown = bot.type === 'melee' ? 1.0 : 0.6;
        
        // Damage formula to armor & health
        let baseDmg = bot.type === 'melee' ? 30 : 20;
        let pen = bot.type === 'melee' ? 15 : 25; // low pen
        
        // Hardcore Armor formula check
        if (player.armor > 0) {
          if (pen >= player.armorClass * 10) {
            // Penetrates armor
            player.hp -= baseDmg * 0.8;
            player.armor -= baseDmg * 0.3;
          } else {
            // Armor stops it, deal blunt damage
            player.armor -= baseDmg * 0.6;
            player.hp -= baseDmg * 0.15;
          }
        } else {
          player.hp -= baseDmg;
        }

        player.armor = Math.max(0, player.armor);
        player.hp = Math.max(0, player.hp);
        shakeAmount = 10;
        pushNotification(`⚠️ 遭到 ${bot.emoji} 攻击！`);

        if (player.hp <= 0) triggerGameOver();
      }
    }
  }
}

function hasLineOfSight(p1, p2) {
  let dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  let dir = { x: (p2.x - p1.x) / dist, y: (p2.y - p1.y) / dist };
  
  for (const wall of walls) {
    if (!wall.isBlockingLoS) continue;
    let hitT = rayBoxIntersect(p1, dir, wall);
    if (hitT !== null && hitT < dist) {
      return false; // occluded
    }
  }
  return true;
}

// ============================================================================
// 7. RENDERING SYSTEM & FOG OF WAR (LoS Raycasting)
// ============================================================================
function render() {
  ctx.save();
  
  // Screen shake
  if (shakeAmount > 0) {
    ctx.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount);
  }

  // 1. Clear background & Floor grid
  ctx.fillStyle = '#0a0f1d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // Subtle floor grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 2;
  let startCol = Math.floor(camera.x / TILE_SIZE);
  let endCol = startCol + Math.floor(canvas.width / TILE_SIZE) + 2;
  let startRow = Math.floor(camera.y / TILE_SIZE);
  let endRow = startRow + Math.floor(canvas.height / TILE_SIZE) + 2;
  
  ctx.beginPath();
  for (let c = startCol; c <= endCol; c++) {
    ctx.moveTo(c * TILE_SIZE, camera.y);
    ctx.lineTo(c * TILE_SIZE, camera.y + canvas.height);
  }
  for (let r = startRow; r <= endRow; r++) {
    ctx.moveTo(camera.x, r * TILE_SIZE);
    ctx.lineTo(camera.x + canvas.width, r * TILE_SIZE);
  }
  ctx.stroke();

  // 2. Draw Helipad / Extraction
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 4;
  ctx.fillRect(helipad.x, helipad.y, helipad.w, helipad.h);
  ctx.strokeRect(helipad.x, helipad.y, helipad.w, helipad.h);
  ctx.font = '72px sans-serif';
  ctx.fillText(helipad.emoji, helipad.x + helipad.w/2 - 36, helipad.y + helipad.h/2 + 24);

  // 3. Draw Loot
  for (const loot of loots) {
    ctx.font = `${loot.size}px sans-serif`;
    ctx.fillText(loot.emoji, loot.x - loot.size/2, loot.y + loot.size/2);
    // Glow bounce
    ctx.beginPath();
    ctx.arc(loot.x, loot.y, 25 + Math.sin(Date.now() / 200) * 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 4. Draw Bots
  for (const bot of bots) {
    ctx.font = `${bot.size}px sans-serif`;
    ctx.fillText(bot.emoji, bot.x - bot.size/2, bot.y + bot.size/3);
    
    // Health bar above bot
    let barW = bot.size * 0.8;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bot.x - barW/2, bot.y - bot.size/2 - 12, barW, 6);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(bot.x - barW/2, bot.y - bot.size/2 - 12, barW * (bot.hp / bot.maxHp), 6);
  }

  // 5. Draw Static Walls
  for (const wall of walls) {
    ctx.font = `${wall.w * 0.85}px sans-serif`;
    ctx.fillText(wall.emoji, wall.x + 6, wall.y + wall.h - 10);
  }

  // 6. Draw Player
  ctx.font = `${player.size}px sans-serif`;
  ctx.fillText(player.emoji, player.x - player.size/2, player.y + player.size/3);

  // Draw Gun direction laser sight / line
  let targetAngle = Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x);
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.25)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x + Math.cos(targetAngle)*400, player.y + Math.sin(targetAngle)*400);
  ctx.stroke();
  ctx.setLineDash([]); // reset

  // 7. Draw Particles & Sound blips
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
    ctx.fill();
  }

  for (const b of soundBlips) {
    ctx.strokeStyle = `rgba(244, 63, 94, ${b.life / b.maxLife * 0.5})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * (1 - b.life / b.maxLife), 0, Math.PI * 2);
    ctx.stroke();
  }

  // 8. FOG OF WAR & LIGHTING (LoS Raycasting Poly Mask)
  renderFogOfWar();

  // 9. Draw Crosshair / Spread Circle directly on Canvas view
  ctx.restore(); // Restore camera translation to render screen-space HUD on canvas

  let screenMouseX = mouse.x;
  let screenMouseY = mouse.y;

  ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Calculate spread radius in pixels at cursor distance
  let distToMouse = Math.hypot(mouse.worldX - player.x, mouse.worldY - player.y);
  let spreadRadius = Math.max(12, distToMouse * Math.tan(player.spread));
  ctx.arc(screenMouseX, screenMouseY, spreadRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshair center dot
  ctx.fillStyle = '#06b6d4';
  ctx.beginPath();
  ctx.arc(screenMouseX, screenMouseY, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // Restore root save
}

function renderFogOfWar() {
  // Create full shadow mask
  let maskCanvas = document.createElement('canvas');
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;
  let mCtx = maskCanvas.getContext('2d');
  if (!mCtx) return;

  mCtx.fillStyle = 'rgba(4, 7, 15, 0.94)';
  mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

  // Cast 360 rays from player to build visibility polygon
  let origin = { x: player.x, y: player.y };
  let points = [];
  const rayCount = 180; // 2 deg steps is perfectly smooth and extremely fast

  for (let i = 0; i < rayCount; i++) {
    let angle = (i / rayCount) * Math.PI * 2;
    let dir = { x: Math.cos(angle), y: Math.sin(angle) };
    
    let maxDist = 1400; // Sight range
    let minT = maxDist;

    for (const wall of walls) {
      if (!wall.isBlockingLoS) continue;
      let res = rayBoxIntersect(origin, dir, wall);
      if (res !== null && res < minT) minT = res;
    }

    points.push({ x: origin.x + dir.x * minT - camera.x, y: origin.y + dir.y * minT - camera.y });
  }

  // Punch out visibility polygon using destination-out
  mCtx.globalCompositeOperation = 'destination-out';
  mCtx.fillStyle = 'black';
  mCtx.beginPath();
  mCtx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    mCtx.lineTo(points[i].x, points[i].y);
  }
  mCtx.closePath();
  mCtx.fill();

  // Add subtle light gradient in the visible zone
  let grad = mCtx.createRadialGradient(origin.x - camera.x, origin.y - camera.y, 20, origin.x - camera.x, origin.y - camera.y, 800);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0.2)');
  mCtx.fillStyle = grad;
  mCtx.fill();

  // Draw the resulting mask onto main canvas
  ctx.drawImage(maskCanvas, camera.x, camera.y, canvas.width, canvas.height, camera.x, camera.y, canvas.width, canvas.height);
}

// ============================================================================
// 8. HUD & UI MANAGEMENT
// ============================================================================
function updateHUD() {
  hudHpText.innerText = `${Math.round(player.hp)}/${player.maxHp}`;
  hudHpFill.style.width = `${(player.hp / player.maxHp) * 100}%`;

  hudArmorText.innerText = `${Math.round(player.armor)}/${player.maxArmor}`;
  hudArmorFill.style.width = `${(player.armor / player.maxArmor) * 100}%`;

  hudStaminaText.innerText = `${Math.round(player.stamina)}%`;
  hudStaminaFill.style.width = `${(player.stamina / player.maxStamina) * 100}%`;

  hudAmmoCurrent.innerText = `${player.gun.currentAmmo}`;
  hudAmmoMax.innerText = `${player.gun.maxAmmo}`;

  if (player.gun.isReloading) {
    hudReloadingMsg.classList.remove('hidden');
  } else {
    hudReloadingMsg.classList.add('hidden');
  }

  if (nearestLoot) {
    hudInteractionPrompt.classList.remove('hidden');
    hudInteractionText.innerText = `拾取 ${nearestLoot.name}`;
  } else {
    hudInteractionPrompt.classList.add('hidden');
  }

  if (player.isExtracting) {
    hudExtractProgressBar.style.width = `${(player.extractTimer / player.extractDuration) * 100}%`;
    hudExtractTimeText.innerText = `${player.extractTimer.toFixed(1)}s`;
  }

  hudLootCount.innerText = `${player.inventory.length} / ${player.maxSlots}`;
}

function refreshInventoryGrid() {
  hudLootGrid.innerHTML = '';
  for (const loot of player.inventory) {
    const slot = document.createElement('div');
    slot.className = 'loot-slot';
    slot.innerText = loot.emoji;
    slot.title = loot.name;
    hudLootGrid.appendChild(slot);
  }
}

function triggerGameOver() {
  isGameOver = true;
  resultModal.classList.remove('hidden');
  resultTitle.innerText = 'OPERATOR KILLED IN ACTION';
  resultTitle.style.color = '#f43f5e';
  resultDesc.innerText = 'You were eliminated in Delta-01. All your unextracted loot has been lost.';
  summaryLootContainer.innerHTML = '';
  restartBtn.innerText = 'REDEPLOY (RESPAWN)';
}

function triggerVictory() {
  isGameOver = true;
  resultModal.classList.remove('hidden');
  resultTitle.innerText = 'RAID SUCCESSFUL';
  resultTitle.style.color = '#10b981';
  resultDesc.innerText = 'You extracted safely. Here is the valuable loot you secured:';
  
  summaryLootContainer.innerHTML = '';
  if (player.inventory.length === 0) {
    summaryLootContainer.innerHTML = '<span style="color:#94a3b8;">空空如也 (No loot extracted)</span>';
  } else {
    for (const item of player.inventory) {
      const sp = document.createElement('span');
      sp.style.fontSize = '2rem';
      sp.innerText = item.emoji;
      sp.title = item.name;
      summaryLootContainer.appendChild(sp);
    }
  }

  restartBtn.innerText = 'START NEW MATCH';
}

restartBtn.addEventListener('click', () => {
  resultModal.classList.add('hidden');
  initWorld();
  refreshInventoryGrid();
});

// ============================================================================
// 9. GAME ENGINE START
// ============================================================================
let lastTime = performance.now();
function loop(now) {
  let dt = (now - lastTime) / 1000;
  if (dt > 0.1) dt = 0.1; // Cap dt to prevent tunneling on lag/tab switch
  lastTime = now;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

// Initialize and Kickoff
initWorld();
requestAnimationFrame(loop);
