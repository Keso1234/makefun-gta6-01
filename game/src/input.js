// Keyboard and mouse state. main.js polls `keys` and `mouse` each frame; menus
// and one-shot actions read the edge-triggered `pressed` set, cleared each frame.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mousePressed: false,
    wheel: 0,
  };

  const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'KeyE', 'KeyM', 'KeyH', 'KeyR', 'KeyP', 'ShiftLeft', 'ShiftRight']);

  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    // A click can land without a preceding mousemove (touch taps, scripted
    // input), so the click itself must place the pointer.
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
    if (e.button === 0) {
      input.mouseDown = true;
      input.mousePressed = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { input.wheel = e.deltaY; }, { passive: true });
  return input;
}

export function endFrameInput(input) {
  input.pressed.clear();
  input.mousePressed = false;
  input.wheel = 0;
}

export function keyDown(input, code) { return input.keys.has(code); }
export function keyPressed(input, code) { return input.pressed.has(code); }

// WASD / arrows as a normalised movement vector.
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (keyDown(input, 'KeyA') || keyDown(input, 'ArrowLeft')) x -= 1;
  if (keyDown(input, 'KeyD') || keyDown(input, 'ArrowRight')) x += 1;
  if (keyDown(input, 'KeyW') || keyDown(input, 'ArrowUp')) y -= 1;
  if (keyDown(input, 'KeyS') || keyDown(input, 'ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y };
}
