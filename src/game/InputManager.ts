export class InputManager {
  public keys: Record<string, boolean> = {};
  public justPressed: Record<string, boolean> = {};
  private previousKeys: Record<string, boolean> = {};

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    window.addEventListener('blur', () => {
      this.keys = {};
      this.justPressed = {};
    });
  }

  update() {
    // Determine justPressed by comparing current keys with previous frame's keys
    for (const key in this.keys) {
      if (this.keys[key] && !this.previousKeys[key]) {
        this.justPressed[key] = true;
      } else {
        this.justPressed[key] = false;
      }
      this.previousKeys[key] = this.keys[key];
    }
    for (const key in this.previousKeys) {
      if (!this.keys[key]) {
        this.previousKeys[key] = false;
      }
    }
  }

  isDown(code: string) {
    return !!this.keys[code];
  }

  isJustPressed(code: string) {
    return !!this.justPressed[code];
  }

  // Mobile interface
  setKey(code: string, pressed: boolean) {
    this.keys[code] = pressed;
  }
}
