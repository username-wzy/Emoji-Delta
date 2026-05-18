// entities.js - All entity class definitions
import { WORLD_WIDTH, WORLD_HEIGHT } from './constants.js';

export class Player {
  constructor() {
    this.x = WORLD_WIDTH / 2;
    this.y = WORLD_HEIGHT / 2;
    this.size = 48;
    this.emoji = '🥷';

    this.maxHp = 100;
    this.hp = 100;
    this.maxArmor = 80;
    this.armor = 80;
    this.armorClass = 4;

    this.maxStamina = 100;
    this.stamina = 100;

    this.baseSpeed = 300;
    this.sprintMultiplier = 1.6;
    this.isSprinting = false;

    this.gun = {
      name: 'TAC-SMG',
      damage: 28,
      penetration: 35,
      fireRate: 0.08,
      cooldown: 0,
      magSize: 30,
      currentAmmo: 30,
      maxAmmo: 120,
      isReloading: false,
      reloadTime: 1.8,
      reloadTimer: 0
    };

    this.spread = 0.02;
    this.isExtracting = false;
    this.extractTimer = 0;
    this.extractDuration = 10.0;
    this.inventory = [];
    this.maxSlots = 12;
  }
}

export class Wall {
  constructor(x, y, w, h, emoji = '🧱', isBlockingLoS = true) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.emoji = emoji;
    this.isBlockingLoS = isBlockingLoS;
  }
}

export class Bot {
  constructor(x, y, type) {
    this.id = Math.random().toString();
    this.x = x;
    this.y = y;
    this.size = 48;
    this.type = type;
    this.emoji = type === 'melee' ? '🧟' : (type === 'boss' ? '👹' : '👮');
    this.hp = type === 'boss' ? 300 : 80;
    this.maxHp = this.hp;
    this.speed = type === 'melee' ? 180 : 140;
    this.state = 'patrol';
    this.targetX = x + (Math.random() - 0.5) * 300;
    this.targetY = y + (Math.random() - 0.5) * 300;
    this.patrolTimer = 0;
    this.fireCooldown = 0;
    // Phase 3: enhanced AI fields
    this.facingAngle = Math.random() * Math.PI * 2;
    this.reactionDelay = 0;       // 0.3s reaction before firing
    this.aggroLossTimer = 0;      // lose aggro after 5s out of sight
    this.aiTickTimer = 0;         // throttle AI decisions to 0.5s
    this.nextPathTarget = null;
  }
}

export class Loot {
  constructor(x, y, type) {
    this.id = Math.random().toString();
    this.x = x;
    this.y = y;
    this.size = 36;
    this.type = type;
    // Set by caller after construction, or use defaults
    this.emoji = '📦';
    this.name = '未知物品';
    this.value = 0;
    this.onPickup = null;
  }
}

/** Apply loot data to a Loot instance (resolved from lootdata.js) */
export function applyLootData(loot, def) {
  loot.emoji = def.emoji;
  loot.name = def.name;
  loot.value = def.value || 0;
  loot.onPickup = def.onPickup || null;
}

export class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.color = color;
    this.life = life; this.maxLife = life;
    this.size = size;
  }
}

export class SoundBlip {
  constructor(x, y, radius = 500) {
    this.x = x; this.y = y;
    this.radius = radius;
    this.life = 0.5; this.maxLife = 0.5;
  }
}
