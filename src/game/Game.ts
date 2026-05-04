import { InputManager } from './InputManager';
import { levels, LevelData, TILE_SIZE } from './Levels';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Camera {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Callbacks {
  onStateChange: (state: 'MENU' | 'PLAYING' | 'WIN' | 'GAMEOVER' | 'ALL_CLEARED' | 'PAUSED' | 'LEVEL_SELECT' | 'SHOP', level?: number, data?: any) => void;
}

export class Game {
  public currentLevel: number = 1;
  public totalScore: number = 0;
  public levelStartScore: number = 0;
  public timer: number = 0;
  public totalCoins: number = 0;
  public levelCoins: number = 0;
  public gameStateData: any = null; // Store final level stats

  public unlockedLevels: number = 1;
  public aesthetics: { playerColor: string, trailColor: string } = { playerColor: '#00FFFF', trailColor: 'rgba(0, 255, 255, 0.5)' };

  private state: 'MENU' | 'PLAYING' | 'PAUSED' | 'WIN' | 'GAMEOVER' | 'ALL_CLEARED' | 'LEVEL_SELECT' | 'SHOP' = 'MENU';

  
  private player = {
    x: 0, y: 0, w: 24, h: 24,
    vx: 0, vy: 0,
    isGrounded: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    canDoubleJump: true,
    isDashing: false,
    isSliding: false,
    dashTime: 0,
    dashCooldown: 0,
    comboScore: 0,
    comboMultiplier: 0,
    comboTimer: 0,
    slideTrickCooldown: 0,
    tricksThisAir: new Set<string>(),
    wallTouch: null as 'left' | 'right' | null,
    facing: 1, // 1 for right, -1 for left
    dead: false,
    stamina: 100,
    isBouncing: false,
  };

  private levelData: LevelData | null = null;
  private camera: Camera = { x: 0, y: 0, w: 800, h: 600 };
  
  private lastTime = 0;
  
  // Customization variables
  private gravity = 1800;
  private moveSpeed = 300; // max horizontal speed
  private accel = 2000;
  private friction = 1500;
  private jumpForce = -650;
  private doubleJumpForce = -550;
  private dashSpeed = 900;
  private maxFallSpeed = 800;
  private wallSlideSpeed = 150;
  private wallJumpVx = 400;
  private wallJumpVy = -600;

  private particles: {x: number, y: number, vx: number, vy: number, life: number, maxLife: number, color: string}[] = [];
  private floatingTexts: {x: number, y: number, text: string, color: string, life: number, maxLife: number}[] = [];
  private coinsData: {x: number, y: number, gathered: boolean}[] = [];
  private enemiesData: {x: number, y: number, w: number, h: number, vx: number, dir: number, startX: number, dead: boolean}[] = [];
  private levelGrid: string[][] = []; // We will parse it to remove C and E

  constructor(private input: InputManager, private callbacks: Callbacks) {
    this.loadSaveData();
  }

  public loadSaveData() {
    try {
      const saved = localStorage.getItem('parkour_save');
      if (saved) {
        const data = JSON.parse(saved);
        this.unlockedLevels = data.unlockedLevels || 1;
        this.totalCoins = data.totalCoins || 0;
        if (data.aesthetics) this.aesthetics = data.aesthetics;
      }
    } catch(e) {}
  }

  public saveGame() {
    try {
      localStorage.setItem('parkour_save', JSON.stringify({
        unlockedLevels: this.unlockedLevels,
        totalCoins: this.totalCoins,
        aesthetics: this.aesthetics
      }));
    } catch(e) {}
  }

  resize(w: number, h: number) {
    this.camera.w = w;
    this.camera.h = h;
  }

  startLevel(levelNum: number) {
    if (levelNum > levels.length) {
      if (this.currentLevel > this.unlockedLevels) {
        this.unlockedLevels = this.currentLevel;
        this.saveGame();
      }
      this.setState('ALL_CLEARED');
      return;
    }
    
    if (levelNum === 1) {
      this.totalScore = 0;
      this.levelStartScore = 0;
    } else {
      this.totalScore = this.levelStartScore;
    }
    
    this.currentLevel = levelNum;
    if (levelNum > this.unlockedLevels) {
      this.unlockedLevels = levelNum;
      this.saveGame();
    }
    this.levelData = levels[levelNum - 1];
    this.timer = 0;
    this.levelCoins = 0;
    this.resetPlayer();
    this.setState('PLAYING', levelNum);
  }

  startCustomLevel(grid: string[]) {
    this.currentLevel = -1;
    this.levelData = { width: grid[0].length, height: grid.length, grid };
    this.timer = 0;
    this.levelCoins = 0; // Coins collected here won't be saved if we add logic for it.
    this.resetPlayer();
    this.setState('PLAYING', -1);
  }

  private resetPlayer() {
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.isGrounded = false;
    this.player.coyoteTimer = 0;
    this.player.jumpBufferTimer = 0;
    this.player.canDoubleJump = true;
    this.player.isDashing = false;
    this.player.isSliding = false;
    this.player.dashTime = 0;
    this.player.dashCooldown = 0;
    this.player.comboScore = 0;
    this.player.comboMultiplier = 0;
    this.player.comboTimer = 0;
    this.player.slideTrickCooldown = 0;
    this.player.tricksThisAir.clear();
    this.player.wallTouch = null;
    this.player.dead = false;
    this.player.facing = 1;
    this.player.stamina = 100;
    this.player.isBouncing = false;
    this.player.w = 24;
    this.player.h = 24;
    this.particles = [];
    this.floatingTexts = [];
    this.coinsData = [];
    this.enemiesData = [];
    this.levelGrid = [];

    // Parse level grid
    if (this.levelData) {
      for (let y = 0; y < this.levelData.height; y++) {
        const row = this.levelData.grid[y] || '';
        const parsedRow = [];
        for (let x = 0; x < row.length; x++) {
          const tile = row[x];
          if (tile === '@') {
            this.player.x = x * TILE_SIZE + (TILE_SIZE - this.player.w) / 2;
            this.player.y = y * TILE_SIZE + (TILE_SIZE - this.player.h);
            parsedRow.push('.'); // Replace spawn with empty
          } else if (tile === 'C') {
            this.coinsData.push({ x: x * TILE_SIZE + TILE_SIZE/2, y: y * TILE_SIZE + TILE_SIZE/2, gathered: false });
            parsedRow.push('.'); 
          } else if (tile === 'E') {
            this.enemiesData.push({ 
              x: x * TILE_SIZE, y: y * TILE_SIZE + TILE_SIZE - 24, 
              w: 24, h: 24, vx: 100, dir: 1, startX: x * TILE_SIZE, dead: false 
            });
            parsedRow.push('.');
          } else {
            parsedRow.push(tile);
          }
        }
        this.levelGrid.push(parsedRow);
      }
    }
  }

  public setState(state: typeof this.state, level?: number, data?: any) {
    this.state = state;
    this.callbacks.onStateChange(state, level, data);
  }

  private spawnParticles(x: number, y: number, count: number, color: string, speedMult: number = 1) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 200 * speedMult;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        color
      });
    }
  }

  private spawnFloatingText(x: number, y: number, text: string, color: string = '#ffffff') {
    this.floatingTexts.push({
      x, y, text, color, life: 1.0, maxLife: 1.0
    });
  }

  private audioCtx: AudioContext | null = null;

  private getAudioCtx() {
    if (!this.audioCtx) {
      try {
        const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextCtor) {
          this.audioCtx = new AudioContextCtor();
        }
      } catch (e) {}
    }
    return this.audioCtx;
  }

  private playSynthBeep(pitchMult: number) {
    try {
      const audioCtx = this.getAudioCtx();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(440 * pitchMult, audioCtx.currentTime); 
      oscillator.frequency.exponentialRampToValueAtTime(880 * pitchMult, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      // Ignore audio errors
    }
  }

  private isRectColliding(rect: Rect): boolean {
    if (!this.levelData || !this.levelGrid) return false;
    const startX = Math.floor(rect.x / TILE_SIZE);
    const endX = Math.floor((rect.x + rect.w) / TILE_SIZE);
    const startY = Math.floor(rect.y / TILE_SIZE);
    const endY = Math.floor((rect.y + rect.h) / TILE_SIZE);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (y < 0 || y >= this.levelData.height || x < 0 || x >= this.levelData.width) continue;
        const row = this.levelGrid[y];
        if (!row) continue;
        const tile = row[x];
        if (tile === '#') {
          const tileRect = { x: x * TILE_SIZE, y: y * TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE };
          if (this.isAABB(rect, tileRect)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private addTrick(name: string, points: number) {
    // Limits
    if (name.includes('Slide')) {
      if (this.player.slideTrickCooldown > 0) return;
      this.player.slideTrickCooldown = 1.0;
    } else {
      if (this.player.tricksThisAir.has(name)) return;
      this.player.tricksThisAir.add(name);
    }

    if (this.player.comboTimer <= 0) {
      this.player.comboScore = 0;
      this.player.comboMultiplier = 0;
    }
    
    this.player.comboMultiplier += 1;
    this.player.comboScore += points;
    this.player.comboTimer = 2.0;

    this.spawnFloatingText(this.player.x + this.player.w / 2, this.player.y - 10, `${name} +${points}`, '#FFFF00');
    this.playSynthBeep(1 + this.player.comboMultiplier * 0.1);
  }

  update(dt: number) {
    this.input.update();

    if (this.input.isJustPressed('Escape') && this.state === 'PLAYING') {
      this.setState('PAUSED', this.currentLevel);
      return;
    } else if (this.input.isJustPressed('Escape') && this.state === 'PAUSED') {
      this.setState('PLAYING', this.currentLevel);
      return;
    }
    
    if (this.state !== 'PLAYING') return;

    const p = this.player;

    if (p.dead) {
      this.setState('GAMEOVER', this.currentLevel);
      return;
    }

    this.timer += dt;

    // Coins logic
    for (const c of this.coinsData) {
      if (!c.gathered) {
        const dx = (p.x + p.w/2) - c.x;
        const dy = (p.y + p.h/2) - c.y;
        if (Math.hypot(dx, dy) < 20) {
          c.gathered = true;
          this.levelCoins++;
          this.spawnParticles(c.x, c.y, 10, '#FFD700');
          this.addTrick('Coin!', 50);
        }
      }
    }

    // Enemies logic
    if (this.levelGrid) {
      for (const e of this.enemiesData) {
        if (!e.dead) {
          e.x += e.vx * e.dir * dt;
          if (Math.abs(e.x - e.startX) > TILE_SIZE * 3) { // Patrol 3 tiles
            e.dir *= -1;
            e.x += e.vx * e.dir * dt; // prevent stuck
          }
          const eRect = {x: e.x, y: e.y, w: e.w, h: e.h};
          if (this.isAABB(p, eRect)) {
            p.dead = true;
            this.spawnParticles(p.x + p.w/2, p.y + p.h/2, 30, '#ff0000', 2);
          }
        }
      }
    }

    // Dash logic
    if (p.dashCooldown > 0) p.dashCooldown -= dt;
    if (p.slideTrickCooldown > 0) p.slideTrickCooldown -= dt;
    
    // Update floating texts
    for (const ft of this.floatingTexts) {
      ft.y -= 40 * dt; // float up
      ft.life -= dt;
    }
    this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);

    if (p.comboTimer > 0) {
      if (p.isGrounded && !p.isSliding) {
        p.comboTimer -= dt * 2.5; // combo decays faster on ground
      } else {
        p.comboTimer -= dt;
      }

      if (p.comboTimer <= 0) {
        const total = p.comboScore * p.comboMultiplier;
        if (total > 0) {
          this.totalScore += total;
          this.spawnFloatingText(p.x + p.w / 2, p.y - 30, `CASHED x${p.comboMultiplier} = ${total}`, '#00FF00');
        }
        p.comboScore = 0;
        p.comboMultiplier = 0;
      }
    }
    
    let moveDir = 0;
    if (p.isDashing) {
      p.dashTime -= dt;
      p.vx = p.facing * this.dashSpeed;
      p.vy = 0; // nullify gravity while dashing
      
      this.spawnParticles(p.x + p.w / 2, p.y + p.h / 2, 1, '#00ffff', 0.2);

      if (p.dashTime <= 0) {
        p.isDashing = false;
      }
    } else {
      // Horizontal movement
      if (!p.isSliding) {
        if (this.input.isDown('ArrowLeft') || this.input.isDown('KeyA')) moveDir -= 1;
        if (this.input.isDown('ArrowRight') || this.input.isDown('KeyD')) moveDir += 1;
      }

      if (moveDir !== 0) {
        p.facing = moveDir;
        p.vx += moveDir * this.accel * dt;
        if (Math.abs(p.vx) > this.moveSpeed) {
          p.vx = moveDir * this.moveSpeed;
        }
      } else {
        // Friction
        const currentFriction = p.isSliding ? this.friction * 0.2 : this.friction;
        if (p.vx > 0) {
          p.vx = Math.max(0, p.vx - currentFriction * dt);
        } else if (p.vx < 0) {
          p.vx = Math.min(0, p.vx + currentFriction * dt);
        }
      }

      // Vertical movement / Gravity
      if (p.wallTouch && p.vy > 0 && moveDir === (p.wallTouch === 'left' ? -1 : 1)) {
        // Wall Slide
        p.vy = this.wallSlideSpeed;
        this.spawnParticles(p.wallTouch === 'left' ? p.x : p.x + p.w, p.y + p.h, 1, '#ffffff', 0.1);
      } else {
        p.vy += this.gravity * dt;
        if (p.vy > this.maxFallSpeed) p.vy = this.maxFallSpeed;
      }

      if (p.isGrounded) {
        p.coyoteTimer = 0.1; // 100ms
      } else {
        p.coyoteTimer -= dt;
      }

      p.jumpBufferTimer -= dt;
      if (this.input.isJustPressed('Space') || this.input.isJustPressed('ArrowUp')) {
        p.jumpBufferTimer = 0.15; // 150ms buffer
      }

      // Jumping
      if (p.jumpBufferTimer > 0) {
        if (p.coyoteTimer > 0) {
          p.vy = this.jumpForce;
          p.coyoteTimer = 0;
          p.jumpBufferTimer = 0;
          p.isGrounded = false;
          this.spawnParticles(p.x + p.w/2, p.y + p.h, 10, '#ffffff');
          // No points for simple jump, to prevent spam
        } else if (p.wallTouch && p.stamina >= 20) {
          // Wall Jump
          p.vx = p.wallTouch === 'left' ? this.wallJumpVx : -this.wallJumpVx;
          p.vy = this.wallJumpVy;
          p.facing = p.wallTouch === 'left' ? 1 : -1;
          p.canDoubleJump = true; // Refresh double jump on wall touch
          p.stamina -= 20;
          p.jumpBufferTimer = 0;
          this.spawnParticles(p.wallTouch === 'left' ? p.x : p.x + p.w, p.y + p.h/2, 15, '#ffffff');
          const wallName = p.wallTouch === 'left' ? 'Wall Jump L' : 'Wall Jump R';
          this.addTrick(wallName, 100);
        } else if (p.canDoubleJump && p.stamina >= 30) {
          // Double Jump
          p.vy = this.doubleJumpForce;
          p.canDoubleJump = false;
          p.stamina -= 30;
          p.jumpBufferTimer = 0;
          this.spawnParticles(p.x + p.w/2, p.y + p.h, 10, '#00ffff');
          this.addTrick('Double Jump', 50);
        }
      }

      // Slide logic
      if (p.isGrounded && (this.input.isDown('ArrowDown') || this.input.isDown('KeyS'))) {
        if (!p.isSliding && Math.abs(p.vx) > 100 && p.comboMultiplier > 0) {
          p.isSliding = true;
          p.h = 12;
          p.y += 12; // move down to ground
          this.addTrick('Slide', 20);
        } else if (!p.isSliding && Math.abs(p.vx) > 100) {
          // Just start sliding without score if no combo exists
          p.isSliding = true;
          p.h = 12;
          p.y += 12;
        }
        if (p.isSliding) {
           this.spawnParticles(p.x + p.w / 2, p.y + p.h, 1, '#ffffff', 0.2);
        }
      } else {
        if (p.isSliding) {
          const standRect = { x: p.x, y: p.y - 12, w: p.w, h: 24 };
          if (!this.isRectColliding(standRect)) {
            p.isSliding = false;
            p.h = 24;
            p.y -= 12; // stand up
          }
        }
      }
    }

    // Handle variable jump height
    if (!this.input.isDown('Space') && !this.input.isDown('ArrowUp') && !this.input.isDown('KeyW') && p.vy < -200 && !p.isDashing && !p.isBouncing) {
       p.vy += this.gravity * 2 * dt;
    }
    
    // Clear bouncing flag if falling
    if (p.vy > 0) p.isBouncing = false;

    // Determine dash
    if ((this.input.isJustPressed('ShiftLeft') || this.input.isJustPressed('ShiftRight')) && !p.isDashing && p.dashCooldown <= 0 && p.stamina >= 30) {
      p.isDashing = true;
      p.dashTime = 0.15;
      p.dashCooldown = 0.8;
      p.stamina -= 30;
      this.spawnParticles(p.x + p.w/2, p.y + p.h/2, 20, '#00ffff');
      this.addTrick('Dash', 50);
    }
    
    // Stamina recovery
    if (p.isGrounded && !p.isSliding && !Math.abs(p.vx) && moveDir === 0 ) {
       p.stamina += 80 * dt;
    } else if (p.isGrounded) {
       p.stamina += 40 * dt;
    }
    if (p.stamina > 100) p.stamina = 100;

    this.applyPhysics(dt);

    if (p.y > (this.levelData?.height || 0) * TILE_SIZE + 100) {
      p.dead = true;
    }

    // Update Particles
    for (const part of this.particles) {
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    // Update Camera
    let lookaheadY = 50;
    if (this.input.isDown('ArrowDown') || this.input.isDown('KeyS')) {
      lookaheadY += 200; // Look down
    } else if (p.vy > 100) {
      lookaheadY += (p.vy - 100) * 0.3; // Look ahead when falling
    }
    
    let targetCamX = p.x + p.w/2 - this.camera.w/2 + (p.vx * 0.2);
    let targetCamY = p.y + p.h/2 - this.camera.h/2 + lookaheadY;
    
    // Clamp camera
    const maxCamX = (this.levelData?.width || 0) * TILE_SIZE - this.camera.w;
    const maxCamY = (this.levelData?.height || 0) * TILE_SIZE - this.camera.h;
    
    if (targetCamX < 0) targetCamX = 0;
    if (targetCamX > maxCamX) targetCamX = maxCamX;
    
    // Smooth camera
    this.camera.x += (targetCamX - this.camera.x) * 5 * dt;
    this.camera.y += (targetCamY - this.camera.y) * 5 * dt;
  }

  private applyPhysics(dt: number) {
    const p = this.player;
    p.isGrounded = false;
    p.wallTouch = null;

    // Move X
    p.x += p.vx * dt;
    this.checkCollisions(true);

    // Move Y
    p.y += p.vy * dt;
    this.checkCollisions(false);
  }

  private checkCollisions(dx: boolean) {
    if (!this.levelData || !this.levelGrid) return;
    const p = this.player;
    
    const startX = Math.floor(p.x / TILE_SIZE);
    const endX = Math.floor((p.x + p.w) / TILE_SIZE);
    const startY = Math.floor(p.y / TILE_SIZE);
    const endY = Math.floor((p.y + p.h) / TILE_SIZE);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (y < 0 || y >= this.levelGrid.length || x < 0 || x >= this.levelGrid[0].length) continue;
        
        const row = this.levelGrid[y];
        if (!row) continue;
        const tile = row[x];
        
        if (tile === '#') { // Solid block
          const tileRect = { x: x * TILE_SIZE, y: y * TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE };
          
          if (this.isAABB(p, tileRect)) {
            if (dx) {
              if (p.vx > 0) {
                p.x = tileRect.x - p.w;
                p.wallTouch = 'right';
              } else if (p.vx < 0) {
                p.x = tileRect.x + tileRect.w;
                p.wallTouch = 'left';
              }
              p.vx = 0;
            } else {
              if (p.vy > 0) {
                p.y = tileRect.y - p.h;
                p.isGrounded = true;
                p.tricksThisAir.clear();
                p.canDoubleJump = true;
                // Landing particles
                if (p.vy > 400) this.spawnParticles(p.x + p.w/2, p.y + p.h, 5, '#ffffff');
              } else if (p.vy < 0) {
                p.y = tileRect.y + tileRect.h;
              }
              p.vy = 0;
            }
          }
        } else if (tile === 'L') {
          // Goal
          const tileRect = { x: x * TILE_SIZE, y: y * TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE };
          if (this.isAABB(p, tileRect)) {
            if (p.comboMultiplier > 0) {
              this.totalScore += p.comboScore * p.comboMultiplier;
              p.comboMultiplier = 0;
            }
            this.levelStartScore = this.totalScore;
            if (this.currentLevel !== -1) {
              this.totalCoins += this.levelCoins;
              if (this.currentLevel >= this.unlockedLevels) {
                this.unlockedLevels = this.currentLevel + 1;
              }
              this.saveGame();
            }
            
            this.gameStateData = {
              timeTaken: this.timer.toFixed(2),
              score: this.totalScore,
              coinsCollected: this.levelCoins
            };
            this.setState('WIN', this.currentLevel, this.gameStateData);
          }
        } else if (tile === 'b') {
          // Bounce pad
          const tileRect = { x: x * TILE_SIZE, y: y * TILE_SIZE + TILE_SIZE / 2, w: TILE_SIZE, h: TILE_SIZE / 2 };
          if (this.isAABB(p, tileRect)) {
            p.vy = this.jumpForce * 1.5;
            p.isBouncing = true;
            p.isGrounded = false;
            p.canDoubleJump = true;
            this.spawnParticles(p.x + p.w / 2, tileRect.y, 20, '#FF00FF');
            this.addTrick('Big Air', 150);
          }
        } else if (tile === '^' || tile === 'v' || tile === '<' || tile === '>') {
          const tileRect = this.getSpikeRect(x, y, tile);
          if (this.isAABB(p, tileRect)) {
            p.dead = true;
            this.spawnParticles(p.x + p.w/2, p.y + p.h/2, 30, '#ff0000', 2);
          }
        }
      }
    }
  }

  private getSpikeRect(x: number, y: number, dir: string): Rect {
    const s = TILE_SIZE;
    const sm = 8; // hitbox margin
    if (dir === '^') return { x: x*s + 4, y: y*s + s/2, w: s - 8, h: s/2 };
    if (dir === 'v') return { x: x*s + 4, y: y*s, w: s - 8, h: s/2 };
    if (dir === '<') return { x: x*s + s/2, y: y*s + 4, w: s/2, h: s - 8 };
    if (dir === '>') return { x: x*s, y: y*s + 4, w: s/2, h: s - 8 };
    return { x: x*s, y: y*s, w: s, h: s };
  }

  private isAABB(r1: Rect, r2: Rect) {
    return r1.x < r2.x + r2.w &&
           r1.x + r1.w > r2.x &&
           r1.y < r2.y + r2.h &&
           r1.y + r1.h > r2.y;
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // Fill background
    ctx.fillStyle = '#050505'; // very dark
    ctx.fillRect(0, 0, width, height);

    if (this.state === 'MENU' || !this.levelData) return;

    ctx.save();
    
    // Add some subpixel smoothing to camera
    const cx = Math.floor(this.camera.x);
    const cy = Math.floor(this.camera.y);

    // Parallax Backgrounds
    ctx.save();
    
    // Background glow
    const grad = ctx.createLinearGradient(0, height, 0, 0);
    grad.addColorStop(0, '#100520'); // Purpleish dark city bottom
    grad.addColorStop(1, '#050510'); // Dark blue sky
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Far layer (moves 0.1x speed of camera)
    const px1 = cx * 0.1;
    ctx.fillStyle = '#0f0a1f';
    for (let i = -2; i < width / 50 + 2; i++) {
        let bx = i * 50 - (px1 % 50);
        let by = height - 100 - Math.abs(Math.sin((i + Math.floor(px1/50)) * 12.5) * 200);
        ctx.fillRect(bx, by, 51, height - by);
    }
    
    // Mid layer: more detailed buildings
    const px2 = cx * 0.3;
    ctx.fillStyle = '#18102a';
    for (let i = -2; i < width / 80 + 2; i++) {
        let bID = i + Math.floor(px2/80);
        let bx = i * 80 - (px2 % 80);
        let bh = 150 + Math.abs(Math.sin(bID * 43.1) * 300);
        let by = height - bh;
        
        ctx.fillRect(bx, by, 60, bh);
        
        // Windows
        ctx.fillStyle = '#2a1a4a';
        for (let wy = by + 20; wy < height - 20; wy += 30) {
            for (let wx = bx + 10; wx < bx + 50; wx += 20) {
                if (Math.sin(bID + wy + wx) > 0) {
                    ctx.fillStyle = Math.sin(wx*wy) > 0.8 ? '#00FFFF' : '#2a1a4a'; 
                    ctx.fillRect(wx, wy, 10, 15);
                }
            }
        }
        ctx.fillStyle = '#18102a';
    }
    ctx.restore();

    ctx.translate(-cx, -cy);

    // Grid details (optional background style)
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;

    // Draw level
    const startX = Math.max(0, Math.floor(cx / TILE_SIZE));
    const endX = Math.min(this.levelData.width, Math.ceil((cx + width) / TILE_SIZE));
    const startY = Math.max(0, Math.floor(cy / TILE_SIZE));
    const endY = Math.min(this.levelData.height, Math.ceil((cy + height) / TILE_SIZE));

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (y < 0 || y >= this.levelGrid.length || x < 0 || x >= this.levelGrid[0].length) continue;
        const row = this.levelGrid[y];
        if (!row) continue;
        const tile = row[x];
        const tx = x * TILE_SIZE;
        const ty = y * TILE_SIZE;

        if (tile === '#') {
          // Inner block
          ctx.fillStyle = '#00FF00'; // Neon accent outer
          ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#141414'; // Dark inner
          ctx.fillRect(tx + 2, ty + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        } else if (tile === 'L') {
          // Glow portal
          ctx.shadowColor = '#FF00FF';
          ctx.shadowBlur = 15;
          ctx.fillStyle = '#FF00FF';
          ctx.beginPath();
          ctx.ellipse(tx + TILE_SIZE/2, ty + TILE_SIZE - 20, TILE_SIZE/3, TILE_SIZE/2 + Math.sin(Date.now() / 200) * 5, 0, 0, Math.PI*2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (['^', 'v', '<', '>'].includes(tile)) {
          ctx.fillStyle = '#FF4444';
          ctx.beginPath();
          if (tile === '^') {
            ctx.moveTo(tx, ty + TILE_SIZE);
            ctx.lineTo(tx + TILE_SIZE/2, ty + TILE_SIZE/2);
            ctx.lineTo(tx + TILE_SIZE, ty + TILE_SIZE);
          } else if (tile === 'v') {
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + TILE_SIZE/2, ty + TILE_SIZE/2);
            ctx.lineTo(tx + TILE_SIZE, ty);
          } else if (tile === '<') {
            ctx.moveTo(tx + TILE_SIZE, ty);
            ctx.lineTo(tx + TILE_SIZE/2, ty + TILE_SIZE/2);
            ctx.lineTo(tx + TILE_SIZE, ty + TILE_SIZE);
          } else if (tile === '>') {
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + TILE_SIZE/2, ty + TILE_SIZE/2);
            ctx.lineTo(tx, ty + TILE_SIZE);
          }
          ctx.fill();
        } else if (tile === 'b') {
          ctx.fillStyle = '#FF00FF';
          ctx.fillRect(tx, ty + TILE_SIZE/2, TILE_SIZE, TILE_SIZE/2);
          ctx.strokeStyle = '#FFFFFF';
          ctx.strokeRect(tx, ty + TILE_SIZE/2, TILE_SIZE, TILE_SIZE/2);
        }
      }
    }

    // Draw coins
    for (const c of this.coinsData) {
      if (!c.gathered) {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(c.x, c.y + Math.sin(Date.now()/150)*3, 10, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#DAA520';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#FFF8DC';
        ctx.beginPath();
        ctx.arc(c.x - 3, c.y - 3 + Math.sin(Date.now()/150)*3, 3, 0, Math.PI*2);
        ctx.fill();
      }
    }

    // Draw enemies
    for (const e of this.enemiesData) {
      if (!e.dead) {
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = '#fff';
        ctx.fillRect(e.x + (e.dir === 1 ? 16 : 4), e.y + 4, 4, 4); // eye
      }
    }

    // Draw particles
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.globalAlpha = 1.0;
    }
    
    // Draw string floating texts
    for (const ft of this.floatingTexts) {
      ctx.fillStyle = '#000'; // shadow
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = ft.life / ft.maxLife;
      ctx.fillText(ft.text, ft.x + 2, ft.y + 2);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.globalAlpha = 1.0;
    }

    // Draw Tutorials
    if (this.levelData.tutorials) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 20px monospace';
        for (const tut of this.levelData.tutorials) {
            const tx = tut.x * TILE_SIZE;
            const ty = tut.y * TILE_SIZE;
            ctx.fillStyle = '#000';
            ctx.fillText(tut.text, tx + 2, ty + 2);
            ctx.fillStyle = '#00FFFF';
            ctx.fillText(tut.text, tx, ty);
        }
    }

    // Draw player
    if (!this.player.dead) {
      const px = this.player.x;
      const py = this.player.y;
      
      // Shadow/Trail if dashing
      if (this.player.isDashing || this.player.comboMultiplier > 2) {
        ctx.fillStyle = this.aesthetics.trailColor;
        ctx.fillRect(px - this.player.vx * 0.05, py, this.player.w, this.player.h);
      }
      
      ctx.fillStyle = this.aesthetics.playerColor; // Custom player color
      // Stretch depending on velocity
      let squeezeX = 1;
      let squeezeY = 1;

      if (!this.player.isGrounded && !this.player.wallTouch && !this.player.isDashing) {
        squeezeY = 1 + Math.min(Math.abs(this.player.vy) / 1500, 0.4);
        squeezeX = 1 - Math.min(Math.abs(this.player.vy) / 1500, 0.4);
      } else if (this.player.isDashing) {
        squeezeX = 1.4;
        squeezeY = 0.6;
      } else if (this.player.wallTouch) {
        squeezeY = 1.2;
        squeezeX = 0.8;
      }

      const drawW = this.player.w * squeezeX;
      const drawH = this.player.h * squeezeY;
      const drawX = px + (this.player.w - drawW)/2;
      const drawY = py + (this.player.h - drawH);

      ctx.fillRect(drawX, drawY, drawW, drawH);

      // Eye
      ctx.fillStyle = '#000';
      const eyeOffset = this.player.facing === 1 ? 4 : -10;
      ctx.fillRect(drawX + drawW/2 + eyeOffset, drawY + 4, 6, 6);
    }

    ctx.restore(); // Pop camera

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Anton, sans-serif';
    ctx.textAlign = 'right';
    let displayScore = this.totalScore;
    if (this.player.comboMultiplier > 0) displayScore += this.player.comboScore * this.player.comboMultiplier;
    
    ctx.fillText(`SCORE: ${displayScore}`, width - 20, 30);
    ctx.font = 'bold 16px Anton, sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`COINS: ${this.levelCoins} / ${this.totalCoins}`, width - 20, 50);
    ctx.fillStyle = '#A8A8A8';
    ctx.fillText(`TIME: ${this.timer.toFixed(1)}s`, width - 20, 70);

    // Stamina Bar
    const stamW = Math.min(200, width - 40);
    const stamH = 8;
    const stamX = width / 2 - stamW / 2;
    const stamY = height - 20;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(stamX, stamY, stamW, stamH);
    ctx.fillStyle = this.player.stamina > 30 ? '#00FF00' : '#FF0000';
    ctx.fillRect(stamX, stamY, stamW * (this.player.stamina / 100), stamH);

    ctx.textAlign = 'center';
    if (this.player.comboMultiplier > 0) {
      ctx.fillStyle = '#FF00FF';
      ctx.font = 'bold 24px Anton, sans-serif';
      ctx.fillText(`x${this.player.comboMultiplier} COMBO`, width / 2, stamY - 30);
      
      // Combo bar
      const barW = Math.min(150, width - 40);
      const barH = 6;
      const fill = Math.max(0, this.player.comboTimer / 2.0);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect((width - barW) / 2, stamY - 20, barW, barH);
      ctx.fillStyle = `hsl(${fill * 120}, 100%, 50%)`;
      ctx.fillRect((width - barW) / 2, stamY - 20, barW * fill, barH);
    }
  }
}
