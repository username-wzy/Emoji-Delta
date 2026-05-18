// ai.js - Enhanced Bot AI FSM (Phase 3: vision cone, reaction delay, tick-throttle)
import { hasLineOfSight } from './physics.js';

const VISION_RANGE = 450;
const VISION_CONE = Math.PI / 3;  // 60° (30° each side)
const REACTION_DELAY = 0.3;        // seconds before firing
const AGGRO_LOSS_TIME = 5.0;       // seconds out of sight → lose aggro
const AI_TICK_INTERVAL = 0.5;      // throttle AI decisions to save CPU
const INVESTIGATE_TIME = 3.0;      // stay at investigation point

function inVisionCone(bot, targetX, targetY) {
  const dx = targetX - bot.x;
  const dy = targetY - bot.y;
  const dist = Math.hypot(dx, dy);
  if (dist > VISION_RANGE) return false;
  const angleToTarget = Math.atan2(dy, dx);
  let diff = angleToTarget - bot.facingAngle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= VISION_CONE / 2;
}

export function updateBots(dt, bots, player, soundBlips, walls) {
  for (const bot of bots) {
    if (bot.hp <= 0) continue;

    const distToPlayer = Math.hypot(player.x - bot.x, player.y - bot.y);

    // Tick-throttled AI decisions
    bot.aiTickTimer -= dt;
    if (bot.aiTickTimer <= 0) {
      bot.aiTickTimer = AI_TICK_INTERVAL;

      // Does bot see the player? (vision cone + LoS)
      const seesPlayer = inVisionCone(bot, player.x, player.y) &&
        hasLineOfSight({ x: bot.x, y: bot.y }, { x: player.x, y: player.y }, walls);

      if (seesPlayer) {
        bot.state = 'aggro';
        bot.targetX = player.x;
        bot.targetY = player.y;
        bot.aggroLossTimer = AGGRO_LOSS_TIME;
        if (bot.reactionDelay <= 0) bot.reactionDelay = REACTION_DELAY;
      } else if (bot.state === 'aggro') {
        bot.aggroLossTimer -= AI_TICK_INTERVAL;
        if (bot.aggroLossTimer <= 0) {
          bot.state = 'patrol';
          bot.reactionDelay = 0;
        }
      }

      // Sound investigation
      if (soundBlips.length > 0 && bot.state !== 'aggro') {
        const latestBlip = soundBlips[soundBlips.length - 1];
        const blipDist = Math.hypot(latestBlip.x - bot.x, latestBlip.y - bot.y);
        if (blipDist <= latestBlip.radius) {
          bot.state = 'investigate';
          bot.targetX = latestBlip.x + (Math.random() - 0.5) * 100;
          bot.targetY = latestBlip.y + (Math.random() - 0.5) * 100;
          bot.investigateTimer = INVESTIGATE_TIME;
        }
      }
    }

    // Reaction delay for firing
    if (bot.reactionDelay > 0) {
      bot.reactionDelay -= dt;
    }

    // Patrol behavior
    if (bot.state === 'patrol') {
      bot.patrolTimer -= dt;
      if (bot.patrolTimer <= 0) {
        if (bot.patrolOrigin) {
          bot.targetX = bot.patrolOrigin.x + (Math.random() - 0.5) * (bot.patrolRadius || 200) * 2;
          bot.targetY = bot.patrolOrigin.y + (Math.random() - 0.5) * (bot.patrolRadius || 200) * 2;
        } else {
          bot.targetX = bot.x + (Math.random() - 0.5) * 400;
          bot.targetY = bot.y + (Math.random() - 0.5) * 400;
        }
        bot.patrolTimer = 2 + Math.random() * 3;
      }
    }

    // Investigate: move to sound source, then return to patrol
    if (bot.state === 'investigate') {
      bot.investigateTimer -= dt;
      if (bot.investigateTimer <= 0) {
        bot.state = 'patrol';
      }
    }

    // Movement towards target
    const moveDist = Math.hypot(bot.targetX - bot.x, bot.targetY - bot.y);
    if (moveDist > 30) {
      const angle = Math.atan2(bot.targetY - bot.y, bot.targetX - bot.x);
      bot.facingAngle = angle; // update facing direction
      let nextX = bot.x + Math.cos(angle) * bot.speed * dt;
      let nextY = bot.y + Math.sin(angle) * bot.speed * dt;

      let collides = false;
      for (const wall of walls) {
        if (wall.emoji === '🧱') {
          const bBox = { x: nextX - bot.size / 2, y: nextY - bot.size / 2, w: bot.size, h: bot.size };
          if (bBox.x < wall.x + wall.w && bBox.x + bBox.w > wall.x &&
              bBox.y < wall.y + wall.h && bBox.y + bBox.h > wall.y) {
            collides = true; break;
          }
        }
      }
      if (!collides) { bot.x = nextX; bot.y = nextY; }
      else { bot.targetX = bot.x + (Math.random() - 0.5) * 200; bot.targetY = bot.y + (Math.random() - 0.5) * 200; }
    }

    // Combat: fire only after reaction delay
    if (bot.fireCooldown > 0) bot.fireCooldown -= dt;
    if (bot.state === 'aggro' && bot.reactionDelay <= 0 &&
        distToPlayer < (bot.type === 'melee' ? 60 : 350) && bot.fireCooldown <= 0) {
      if (hasLineOfSight({ x: bot.x, y: bot.y }, { x: player.x, y: player.y }, walls)) {
        bot.fireCooldown = bot.type === 'melee' ? 1.0 : 0.6;
        const baseDmg = bot.type === 'melee' ? 30 : 20;
        const pen = bot.type === 'melee' ? 15 : 25;

        if (player.armor > 0) {
          if (pen >= player.armorClass * 10) {
            player.hp -= baseDmg * 0.8;
            player.armor -= baseDmg * 0.3;
          } else {
            player.armor -= baseDmg * 0.6;
            player.hp -= baseDmg * 0.15;
          }
        } else {
          player.hp -= baseDmg;
        }
        player.armor = Math.max(0, player.armor);
        player.hp = Math.max(0, player.hp);
        return { hit: true, bot };
      }
    }
  }
  return { hit: false, bot: null };
}
