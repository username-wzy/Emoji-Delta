// renderer.js - Canvas rendering system
import { TILE_SIZE, BG_COLOR_DARK, BG_COLOR_LIGHT } from './constants.js';

export function render(ctx, canvas, camera, state) {
  const { player, walls, bots, loots, particles, soundBlips, helipad, mouse, shakeAmount } = state;

  ctx.save();

  if (shakeAmount > 0) {
    ctx.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount);
  }

  // 1. Checkerboard background
  drawCheckerboard(ctx, canvas, camera);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // 2. Floor grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 2;
  const startCol = Math.floor(camera.x / TILE_SIZE);
  const endCol = startCol + Math.floor(canvas.width / TILE_SIZE) + 2;
  const startRow = Math.floor(camera.y / TILE_SIZE);
  const endRow = startRow + Math.floor(canvas.height / TILE_SIZE) + 2;

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

  // 3. Helipad
  drawHelipad(ctx, helipad);

  // 4. Walls
  for (const wall of walls) {
    ctx.font = `${wall.w * 0.85}px sans-serif`;
    ctx.fillText(wall.emoji, wall.x + 6, wall.y + wall.h - 10);
  }

  // 5. Loot
  for (const loot of loots) {
    ctx.beginPath();
    ctx.arc(loot.x, loot.y, 28 + Math.sin(Date.now() / 200) * 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
    ctx.fill();
    ctx.font = `${loot.size}px sans-serif`;
    ctx.fillText(loot.emoji, loot.x - loot.size / 2, loot.y + loot.size / 2);
  }

  // 6. Bots
  for (const bot of bots) {
    ctx.beginPath();
    ctx.arc(bot.x, bot.y, bot.size * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.15)';
    ctx.fill();
    ctx.font = `${bot.size}px sans-serif`;
    ctx.fillText(bot.emoji, bot.x - bot.size / 2, bot.y + bot.size / 3);

    const barW = bot.size * 0.8;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bot.x - barW / 2, bot.y - bot.size / 2 - 12, barW, 6);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(bot.x - barW / 2, bot.y - bot.size / 2 - 12, barW * (bot.hp / bot.maxHp), 6);
  }

  // 7. Player
  ctx.font = `${player.size}px sans-serif`;
  ctx.fillText(player.emoji, player.x - player.size / 2, player.y + player.size / 3);

  // Laser sight
  const targetAngle = Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x);
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.25)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x + Math.cos(targetAngle) * 400, player.y + Math.sin(targetAngle) * 400);
  ctx.stroke();
  ctx.setLineDash([]);

  // 8. Particles
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
    ctx.fill();
  }

  // 9. Sound blips
  for (const b of soundBlips) {
    ctx.strokeStyle = `rgba(244, 63, 94, ${b.life / b.maxLife * 0.5})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * (1 - b.life / b.maxLife), 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore(); // camera transform

  // 10. Crosshair (screen space)
  drawCrosshair(ctx, mouse, player);

  ctx.restore(); // shake/root
}

function drawCheckerboard(ctx, canvas, camera) {
  const ts = TILE_SIZE;
  const startCol = Math.floor(camera.x / ts);
  const endCol = startCol + Math.ceil(canvas.width / ts) + 1;
  const startRow = Math.floor(camera.y / ts);
  const endRow = startRow + Math.ceil(canvas.height / ts) + 1;

  for (let r = startRow; r < endRow; r++) {
    for (let c = startCol; c < endCol; c++) {
      const x = c * ts - camera.x;
      const y = r * ts - camera.y;
      ctx.fillStyle = (c + r) % 2 === 0 ? BG_COLOR_DARK : BG_COLOR_LIGHT;
      ctx.fillRect(x, y, ts, ts);
    }
  }
}

function drawHelipad(ctx, helipad) {
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 4;
  ctx.fillRect(helipad.x, helipad.y, helipad.w, helipad.h);
  ctx.strokeRect(helipad.x, helipad.y, helipad.w, helipad.h);
  ctx.font = '72px sans-serif';
  ctx.fillText(helipad.emoji, helipad.x + helipad.w / 2 - 36, helipad.y + helipad.h / 2 + 24);
}

function drawCrosshair(ctx, mouse, player) {
  const screenMouseX = mouse.x;
  const screenMouseY = mouse.y;

  ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const distToMouse = Math.hypot(mouse.worldX - player.x, mouse.worldY - player.y);
  const spreadRadius = Math.max(12, distToMouse * Math.tan(player.spread));
  ctx.arc(screenMouseX, screenMouseY, spreadRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#06b6d4';
  ctx.beginPath();
  ctx.arc(screenMouseX, screenMouseY, 3, 0, Math.PI * 2);
  ctx.fill();
}
