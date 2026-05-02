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
  onStateChange: (state: 'MENU' | 'PLAYING' | 'WIN' | 'GAMEOVER' | 'ALL_CLEARED', level?: number) => void;
}

export class Game {
  public currentLevel: number = 1;
  public totalScore: number = 0;
  public levelStartScore: number = 0;
  private state: 'MENU' | 'PLAYING' | 'WIN' | 'GAMEOVER' | 'ALL_CLEARED' = 'MENU';
  
  private player = {
    x: 0, y: 0, w: 24, h: 24,
    vx: 0, vy: 0,
    isGrounded: false,
    canDoubleJump: true,
    isDashing: false,
    isSliding: false,
    dashTime: 0,
    dashCooldown: 0,
    comboScore: 0,
    comboMultiplier: 0,
    comboTimer: 0,
    wallTouch: null as 'left' | 'right' | null,
    facing: 1, // 1 for right, -1 for left
    dead: false,
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

  constructor(private input: InputManager, private callbacks: Callbacks) {}

  resize(w: number, h: number) {
    this.camera.w = w;
    this.camera.h = h;
  }

  startLevel(levelNum: number) {
    if (levelNum > levels.length) {
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
    this.levelData = levels[levelNum - 1];
    this.resetPlayer();
    this.setState('PLAYING', levelNum);
  }

  private resetPlayer() {
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.isGrounded = false;
    this.player.canDoubleJump = true;
    this.player.isDashing = false;
    this.player.isSliding = false;
    this.player.dashTime = 0;
    this.player.dashCooldown = 0;
    this.player.comboScore = 0;
    this.player.comboMultiplier = 0;
    this.player.comboTimer = 0;
    this.player.wallTouch = null;
    this.player.dead = false;
    this.player.facing = 1;
    this.player.w = 24;
    this.player.h = 24;
    this.particles = [];
    this.floatingTexts = [];

    // Find spawn
    if (this.levelData) {
      for (let y = 0; y < this.levelData.height; y++) {
        const row = this.levelData.grid[y];
        if(!row) continue;
        for (let x = 0; x < row.length; x++) {
          if (row[x] === '@') {
            this.player.x = x * TILE_SIZE + (TILE_SIZE - this.player.w) / 2;
            this.player.y = y * TILE_SIZE + (TILE_SIZE - this.player.h);
            return;
          }
        }
      }
    }
  }

  private setState(state: typeof this.state, level?: number) {
    this.state = state;
    this.callbacks.onStateChange(state, level);
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
    if (!this.levelData) return false;
    const startX = Math.floor(rect.x / TILE_SIZE);
    const endX = Math.floor((rect.x + rect.w) / TILE_SIZE);
    const startY = Math.floor(rect.y / TILE_SIZE);
    const endY = Math.floor((rect.y + rect.h) / TILE_SIZE);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (y < 0 || y >= this.levelData.height || x < 0 || x >= this.levelData.width) continue;
        const tile = this.levelData.grid[y][x];
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
    
    if (this.state !== 'PLAYING') return;

    const p = this.player;

    if (p.dead) {
      this.setState('GAMEOVER', this.currentLevel);
      return;
    }

    // Dash logic
    if (p.dashCooldown > 0) p.dashCooldown -= dt;
    
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
      let moveDir = 0;
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

      // Jumping
      if (this.input.isJustPressed('Space') || this.input.isJustPressed('ArrowUp')) {
        if (p.isGrounded) {
          p.vy = this.jumpForce;
          p.isGrounded = false;
          this.spawnParticles(p.x + p.w/2, p.y + p.h, 10, '#ffffff');
          if (p.comboMultiplier > 0) this.addTrick('Jump', 10);
        } else if (p.wallTouch) {
          // Wall Jump
          p.vx = p.wallTouch === 'left' ? this.wallJumpVx : -this.wallJumpVx;
          p.vy = this.wallJumpVy;
          p.facing = p.wallTouch === 'left' ? 1 : -1;
          p.canDoubleJump = true; // Refresh double jump on wall touch
          this.spawnParticles(p.wallTouch === 'left' ? p.x : p.x + p.w, p.y + p.h/2, 15, '#ffffff');
          this.addTrick('Wall Jump', 100);
        } else if (p.canDoubleJump) {
          // Double Jump
          p.vy = this.doubleJumpForce;
          p.canDoubleJump = false;
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

    // Determine dash
    if ((this.input.isJustPressed('ShiftLeft') || this.input.isJustPressed('ShiftRight')) && !p.isDashing && p.dashCooldown <= 0) {
      p.isDashing = true;
      p.dashTime = 0.15;
      p.dashCooldown = 0.8;
      this.spawnParticles(p.x + p.w/2, p.y + p.h/2, 20, '#00ffff');
      this.addTrick('Dash', 50);
    }

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
    let targetCamX = p.x + p.w/2 - this.camera.w/2;
    let targetCamY = p.y + p.h/2 - this.camera.h/2 + 50;
    
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
    if (!this.levelData) return;
    const p = this.player;
    
    const startX = Math.floor(p.x / TILE_SIZE);
    const endX = Math.floor((p.x + p.w) / TILE_SIZE);
    const startY = Math.floor(p.y / TILE_SIZE);
    const endY = Math.floor((p.y + p.h) / TILE_SIZE);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (y < 0 || y >= this.levelData.height || x < 0 || x >= this.levelData.width) continue;
        
        const tile = this.levelData.grid[y][x];
        
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
            this.setState('WIN', this.currentLevel);
          }
        } else if (tile === 'b') {
          // Bounce pad
          const tileRect = { x: x * TILE_SIZE, y: y * TILE_SIZE + TILE_SIZE / 2, w: TILE_SIZE, h: TILE_SIZE / 2 };
          if (this.isAABB(p, tileRect)) {
            p.vy = this.jumpForce * 1.5;
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
        const tile = this.levelData.grid[y][x];
        const tx = x * TILE_SIZE;
        const ty = y * TILE_SIZE;

        if (tile === '#') {
          // Inner block
          ctx.fillStyle = '#141414';
          ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
          
          // Edges (neon brutalist look)
          ctx.strokeStyle = '#00FF00'; // Neon accent
          ctx.lineWidth = 2;
          ctx.strokeRect(tx, ty, TILE_SIZE, TILE_SIZE);
        } else if (tile === 'L') {
          // Goal portal
          ctx.fillStyle = '#FF00FF';
          ctx.beginPath();
          ctx.arc(tx + TILE_SIZE/2, ty + TILE_SIZE/2, TILE_SIZE/3 + Math.sin(Date.now() / 150) * 5, 0, Math.PI*2);
          ctx.fill();
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

    // Draw player
    if (!this.player.dead) {
      const px = this.player.x;
      const py = this.player.y;
      
      // Shadow/Trail if dashing
      if (this.player.isDashing) {
        ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.fillRect(px - this.player.vx * 0.05, py, this.player.w, this.player.h);
      }
      
      ctx.fillStyle = '#00FFFF'; // Player cyan
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
    ctx.font = 'bold 24px Anton, sans-serif';
    ctx.textAlign = 'right';
    let displayScore = this.totalScore;
    if (this.player.comboMultiplier > 0) displayScore += this.player.comboScore * this.player.comboMultiplier;
    ctx.fillText(`SCORE: ${displayScore}`, width - 20, 40);

    if (this.player.comboMultiplier > 0) {
      ctx.fillStyle = '#FF00FF';
      ctx.font = 'bold 36px Anton, sans-serif';
      ctx.fillText(`x${this.player.comboMultiplier} COMBO`, width - 20, 80);
      
      // Combo bar
      const barW = 150;
      const barH = 8;
      const fill = Math.max(0, this.player.comboTimer / 2.0);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(width - 20 - barW, 95, barW, barH);
      ctx.fillStyle = `hsl(${fill * 120}, 100%, 50%)`;
      ctx.fillRect(width - 20 - barW, 95, barW * fill, barH);
    }
  }
}
