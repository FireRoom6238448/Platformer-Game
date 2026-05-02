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
  }

  update() {
    // Determine justPressed by comparing current keys with previous frame's keys
    for (const key in this.keys) {
      if (this.keys[key] && !this.previousKeys[key]) {
        this.justPressed[key] = true;
      } else {
        this.justPressed[key] = false;
      }
    }
    // Update previous keys
    this.previousKeys = { ...this.keys };
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
