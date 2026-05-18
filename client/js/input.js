// input.js - Keyboard and mouse input state
export const keys = { w: false, a: false, s: false, d: false, shift: false };
export const mouse = { x: 0, y: 0, worldX: 0, worldY: 0, isDown: false };

export function initInput(canvas, cameraRef, onInteract, onReload, onToggleInventory, onGrenade, onMedkit, onSwitchWeapon) {
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

    if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') onInteract();
    if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R') onReload();
    if (e.code === 'Tab' || e.key === 'Tab') { e.preventDefault(); onToggleInventory(); }
    if (e.code === 'KeyG' || e.key === 'g' || e.key === 'G') { e.preventDefault(); if (onGrenade) onGrenade(); }
    if (e.code === 'KeyH' || e.key === 'h' || e.key === 'H') { e.preventDefault(); if (onMedkit) onMedkit(); }
    if (e.code === 'Digit1' || e.key === '1') { e.preventDefault(); if (onSwitchWeapon) onSwitchWeapon(0); }
    if (e.code === 'Digit2' || e.key === '2') { e.preventDefault(); if (onSwitchWeapon) onSwitchWeapon(1); }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW' || e.key === 'w' || e.key === 'W') keys.w = false;
    if (e.code === 'KeyA' || e.key === 'a' || e.key === 'A') keys.a = false;
    if (e.code === 'KeyS' || e.key === 's' || e.key === 'S') keys.s = false;
    if (e.code === 'KeyD' || e.key === 'd' || e.key === 'D') keys.d = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false;
  });

  window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mousedown', (e) => { if (e.button === 0) mouse.isDown = true; });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.isDown = false; });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
}
