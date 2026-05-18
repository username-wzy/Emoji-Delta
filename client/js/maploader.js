// maploader.js - Load and parse JSON fixed maps (Phase 3)
import { WORLD_WIDTH, WORLD_HEIGHT, TILE_SIZE } from './constants.js';
import { Wall, Bot, Loot, applyLootData } from './entities.js';
import { randomLootType, getLootDef } from './lootdata.js';
import { randomBotType, randomBossType, getBotDef } from './botdata.js';

export async function loadMap(path) {
  try {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (e) {
    console.warn('Map load failed, using procedural fallback:', e.message);
    return null;
  }
}

export function buildWorldFromMap(mapData) {
  const walls = [];
  const bots = [];
  const loots = [];
  const helipad = { x: 0, y: 0, w: 0, h: 0, emoji: '🚁' };

  if (!mapData) return { walls, bots, loots, helipad, spawnX: 400, spawnY: WORLD_HEIGHT - 400 };

  const ts = mapData.tileSize || TILE_SIZE;
  const tiles = mapData.tiles || [];

  // Parse tiles into walls AND build a lookup grid for validation
  /** @type {number[][]} */
  const grid = [];
  for (let r = 0; r < tiles.length; r++) {
    const row = tiles[r].split(',').map(s => parseInt(s.trim()));
    grid.push(row);
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 1) {
        walls.push(new Wall(c * ts, r * ts, ts, ts, '🧱', true));
      } else if (row[c] === 2) {
        walls.push(new Wall(c * ts, r * ts, ts, ts, '🌲', true));
      }
    }
  }

  // Helper: check if a tile position is on a wall
  const isWallAt = (col, row) => {
    if (row < 0 || row >= grid.length || col < 0 || col >= (grid[row]?.length || 0)) return true;
    return grid[row][col] !== 0;
  };

  // Parse spawns → bot generation
  const spawns = mapData.spawns || [];
  for (const sp of spawns) {
    if (sp.team === 'scav') {
      // Skip spawns on walls
      if (isWallAt(sp.x, sp.y)) {
        console.warn(`Skipping scav spawn at (${sp.x},${sp.y}) — tile is wall`);
        continue;
      }
      const botType = Math.random() < 0.15 ? randomBossType() : randomBotType();
      const botDef = getBotDef(botType);
      const bot = new Bot(sp.x * ts + ts / 2, sp.y * ts + ts / 2, botDef);
      bot.patrolOrigin = { x: bot.x, y: bot.y };
      bot.patrolRadius = 200;
      bots.push(bot);
    }
  }

  // If too few scav spawns generated, supplement with random bots on empty tiles
  const MIN_BOTS = 10;
  if (bots.length < MIN_BOTS) {
    for (let i = bots.length; i < MIN_BOTS; i++) {
      let bx, by, col, row, attempts = 0;
      do {
        bx = 300 + Math.random() * (WORLD_WIDTH - 600);
        by = 300 + Math.random() * (WORLD_HEIGHT - 600);
        col = Math.floor(bx / ts);
        row = Math.floor(by / ts);
        attempts++;
      } while (isWallAt(col, row) && attempts < 50);
      if (attempts < 50) {
        const botType = i === 0 ? randomBossType() : randomBotType();
        bots.push(new Bot(bx, by, getBotDef(botType)));
      }
    }
  }

  // Parse patrol nodes → assign to bots without origins
  const patrolNodes = mapData.patrolNodes || [];
  for (let i = 0; i < bots.length && i < patrolNodes.length; i++) {
    if (!bots[i].patrolOrigin) {
      bots[i].patrolOrigin = { x: patrolNodes[i].x * ts, y: patrolNodes[i].y * ts };
      bots[i].patrolRadius = patrolNodes[i].radius || 200;
    }
  }

  // Parse loot points (skip those on walls)
  const lootPoints = mapData.lootPoints || [];
  for (const lp of lootPoints) {
    if (isWallAt(lp.x, lp.y)) {
      console.warn(`Skipping loot at (${lp.x},${lp.y}) — tile is wall`);
      continue;
    }
    if (Math.random() < (lp.weight || 10) / 30) {
      const type = lp.type || randomLootType();
      const loot = new Loot(lp.x * ts + ts / 2, lp.y * ts + ts / 2, type);
      applyLootData(loot, getLootDef(type));
      loots.push(loot);
    }
  }

  // Ensure minimum loot on empty tiles
  const MIN_LOOT = 12;
  if (loots.length < MIN_LOOT) {
    for (let i = loots.length; i < MIN_LOOT + 5; i++) {
      let lx, ly, col, row, attempts = 0;
      do {
        lx = 200 + Math.random() * (WORLD_WIDTH - 400);
        ly = 200 + Math.random() * (WORLD_HEIGHT - 400);
        col = Math.floor(lx / ts);
        row = Math.floor(ly / ts);
        attempts++;
      } while (isWallAt(col, row) && attempts < 50);
      if (attempts < 50) {
        const type = randomLootType();
        const loot = new Loot(lx, ly, type);
        applyLootData(loot, getLootDef(type));
        loots.push(loot);
      }
    }
  }

  // Parse extraction point
  const ext = mapData.extraction;
  if (ext) {
    helipad.x = ext.x * ts;
    helipad.y = ext.y * ts;
    helipad.w = (ext.w || 3) * ts;
    helipad.h = (ext.h || 3) * ts;
  } else {
    helipad.x = WORLD_WIDTH - 400;
    helipad.y = 300;
    helipad.w = 220;
    helipad.h = 220;
  }

  // Parse player spawn
  const pmcSpawn = spawns.find(s => s.team === 'pmc');
  const spawnX = pmcSpawn ? pmcSpawn.x * ts + ts / 2 : 400;
  const spawnY = pmcSpawn ? pmcSpawn.y * ts + ts / 2 : WORLD_HEIGHT - 400;

  return { walls, bots, loots, helipad, spawnX, spawnY, mapName: mapData.name };
}
