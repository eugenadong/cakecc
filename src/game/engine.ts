import { retroAudio } from './audio';
import { renderGame } from './renderer';
import { getThemeForFloor, loadProgress, saveProgress } from './themes';
import {
  ActiveCake,
  CakeLayer,
  FallingPiece,
  FloatingText,
  GameState,
  HudSnapshot,
  Particle,
  StageTheme,
} from './types';

const BASE_CAKE_WIDTH = 92;
const CAKE_HEIGHT = 22;
const BOMB_WIDTH = 18;
const BOMB_HEIGHT = 20;
const PERFECT_TOLERANCE = 5.5;
const WIDTH_RECOVERY_AMOUNT = 6;
const GRAVITY = 1650;
const PARTICLE_POOL_SIZE = 160;

export class CakeStackEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private lastTimestamp: number = 0;

  private virtualW: number = 240;
  private virtualH: number = 420;

  private gameState: GameState = 'TITLE_MENU';
  private time: number = 0;
  private hitstopTimer: number = 0;
  private dropCooldown: number = 0;
  private gameOverDelayTimer: number = 0;
  private pendingGameOver: boolean = false;

  private cameraY: number = 0;
  private targetCameraY: number = 0;
  private shakeMag: number = 0;
  private shakeX: number = 0;
  private shakeY: number = 0;

  private pendulumPhase: number = 0;
  private pivotX: number = 0;
  private targetPivotX: number = 0;

  private layers: CakeLayer[] = [];
  private activeCake: ActiveCake | null = null;
  private fallingPieces: FallingPiece[] = [];
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];

  private score: number = 0;
  private bestScore: number = 0;
  private floor: number = 0;
  private bestFloor: number = 0;
  private combo: number = 0;
  private maxCombo: number = 0;
  private perfectCount: number = 0;
  private unlockedThemeIds: string[] = [];
  private milestoneBanner: StageTheme | null = null;
  private milestoneTimer: number = 0;
  private lastOutcome: HudSnapshot['lastOutcome'] = 'NONE';
  private dripCounter: number = 1;
  private turnCount: number = 0;
  private nextBombTurn: number = 5;

  private onHudChange: (snapshot: HudSnapshot) => void;
  private onStateChange: (state: GameState) => void;

  constructor(
    onHudChange: (snapshot: HudSnapshot) => void,
    onStateChange: (state: GameState) => void
  ) {
    this.onHudChange = onHudChange;
    this.onStateChange = onStateChange;

    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 2,
        color: '#FFFFFF',
        life: 0,
        maxLife: 1,
        gravity: 300,
        kind: 'crumb',
      });
    }

    const saved = loadProgress();
    this.bestScore = saved.bestScore;
    this.bestFloor = saved.bestFloor;
    this.unlockedThemeIds = saved.unlockedThemeIds;
    retroAudio.setMuted(saved.muted);
    retroAudio.setBgmEnabled(saved.bgmEnabled);

    this.setupTitleDemo();
  }

  public attachCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.resize();
    this.startLoop();
  }

  public detachCanvas(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    retroAudio.stopBgm();
    this.canvas = null;
    this.ctx = null;
  }

  public resize(): void {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    const cssW = parent ? parent.clientWidth : window.innerWidth;
    const cssH = parent ? parent.clientHeight : window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.max(1, Math.floor(cssW * dpr));
    this.canvas.height = Math.max(1, Math.floor(cssH * dpr));

    const pxScale = Math.min(cssW / 240, cssH / 380);
    this.virtualW = Math.max(240, cssW / pxScale);
    this.virtualH = Math.max(380, cssH / pxScale);
  }

  public getState(): GameState {
    return this.gameState;
  }

  public getSnapshot(): HudSnapshot {
    const topWidth =
      this.layers.length > 0 ? this.layers[this.layers.length - 1].width : BASE_CAKE_WIDTH;
    const nextFloorTheme = getThemeForFloor(Math.max(1, this.floor + 1));
    return {
      score: this.score,
      bestScore: this.bestScore,
      floor: this.floor,
      bestFloor: this.bestFloor,
      combo: this.combo,
      maxCombo: this.maxCombo,
      perfectCount: this.perfectCount,
      widthPercent: Math.round((topWidth / BASE_CAKE_WIDTH) * 100),
      currentTheme: nextFloorTheme,
      unlockedThemeIds: [...this.unlockedThemeIds],
      milestoneBanner: this.milestoneBanner,
      bombActive: this.activeCake?.kind === 'bomb',
      lastOutcome: this.lastOutcome,
    };
  }

  public setupTitleDemo(): void {
    this.gameState = 'TITLE_MENU';
    retroAudio.stopBgm();
    this.layers = [];
    this.fallingPieces = [];
    this.floatingTexts = [];
    this.clearParticles();
    this.cameraY = 0;
    this.targetCameraY = 0;
    this.pivotX = 0;
    this.targetPivotX = 0;
    this.pendulumPhase = 0;
    this.pendingGameOver = false;
    this.milestoneBanner = null;

    for (let i = 1; i <= 3; i++) {
      this.layers.push({
        floor: i,
        x: -BASE_CAKE_WIDTH / 2,
        y: -i * CAKE_HEIGHT,
        width: BASE_CAKE_WIDTH,
        height: CAKE_HEIGHT,
        theme: getThemeForFloor(i),
        dripSeed: i * 13,
        squash: 0,
        flashTimer: 0,
        isPerfect: true,
      });
    }

    this.activeCake = {
      kind: 'cake',
      state: 'SWINGING',
      x: -BASE_CAKE_WIDTH / 2,
      y: -180,
      width: BASE_CAKE_WIDTH,
      height: CAKE_HEIGHT,
      vy: 0,
      tilt: 0,
      theme: getThemeForFloor(1),
      dripSeed: 7,
    };

    this.emitHud();
    this.onStateChange('TITLE_MENU');
  }

  public startNewGame(): void {
    retroAudio.unlock();
    retroAudio.playUiClick();

    this.gameState = 'PLAYING';
    this.layers = [];
    this.fallingPieces = [];
    this.floatingTexts = [];
    this.clearParticles();

    this.score = 0;
    this.floor = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfectCount = 0;
    this.lastOutcome = 'NONE';
    this.milestoneBanner = null;
    this.milestoneTimer = 0;
    this.turnCount = 0;
    this.nextBombTurn = 5 + Math.floor(Math.random() * 2);

    this.cameraY = 0;
    this.targetCameraY = 0;
    this.shakeMag = 0;
    this.hitstopTimer = 0;
    this.dropCooldown = 0.18;
    this.pendingGameOver = false;
    this.gameOverDelayTimer = 0;
    this.pivotX = 0;
    this.targetPivotX = 0;
    this.pendulumPhase = (Math.random() > 0.5 ? 1 : -1) * 0.6;

    this.spawnNextCake();
    this.emitHud();
    this.onStateChange('PLAYING');
    retroAudio.startBgm(true);
  }

  public pauseGame(): void {
    if (this.gameState !== 'PLAYING' || this.pendingGameOver) return;
    this.gameState = 'PAUSED';
    retroAudio.stopBgm();
    retroAudio.playUiClick();
    this.onStateChange('PAUSED');
  }

  public resumeGame(): void {
    if (this.gameState !== 'PAUSED') return;
    this.gameState = 'PLAYING';
    this.lastTimestamp = performance.now();
    this.dropCooldown = 0.18;
    retroAudio.playUiClick();
    retroAudio.startBgm(false);
    this.onStateChange('PLAYING');
  }

  public returnToTitle(): void {
    retroAudio.stopBgm();
    retroAudio.playUiClick();
    this.setupTitleDemo();
  }

  public toggleMute(): boolean {
    const next = !retroAudio.isMuted();
    retroAudio.setMuted(next);
    if (!next) {
      retroAudio.unlock();
      retroAudio.playUiClick();
      if (this.gameState === 'PLAYING') {
        retroAudio.startBgm(false);
      }
    }
    this.persist();
    return next;
  }

  public toggleBgm(): boolean {
    const next = !retroAudio.isBgmEnabled();
    retroAudio.setBgmEnabled(next);
    retroAudio.playUiClick();
    if (next && this.gameState === 'PLAYING' && !retroAudio.isMuted()) {
      retroAudio.startBgm(false);
    }
    this.persist();
    return next;
  }

  public handleDropAction(): void {
    if (this.gameState !== 'PLAYING') return;
    if (this.pendingGameOver || this.dropCooldown > 0) return;
    if (!this.activeCake || this.activeCake.state !== 'SWINGING') return;

    retroAudio.unlock();
    this.activeCake.state = 'FALLING';
    this.activeCake.vy = 140;
    this.activeCake.tilt = 0;
    retroAudio.playDrop();
  }

  private getPendulumMetrics(): {
    pivotScreenY: number;
    pivotWorldY: number;
    ropeLen: number;
    maxAngle: number;
    omega: number;
  } {
    const pivotScreenY = 56;
    const groundScreenY = this.virtualH - 56;
    const pivotWorldY = this.cameraY - (groundScreenY - pivotScreenY);
    const ropeLen = Math.min(82, Math.max(60, this.virtualH * 0.17));
    const maxAngle = 1.18;
    const omega =
      this.gameState === 'TITLE_MENU'
        ? 1.5
        : Math.min(5.2, 2.05 + this.floor * 0.068);
    return { pivotScreenY, pivotWorldY, ropeLen, maxAngle, omega };
  }

  private spawnNextCake(): void {
    this.turnCount += 1;
    const shouldSpawnBomb =
      this.layers.length >= 4 && this.turnCount >= this.nextBombTurn;

    if (shouldSpawnBomb) {
      this.nextBombTurn = this.turnCount + 6 + Math.floor(Math.random() * 3);
    }

    const nextFloor = this.floor + 1;
    const prevLayer = this.layers[this.layers.length - 1];
    const width = shouldSpawnBomb
      ? BOMB_WIDTH
      : prevLayer
      ? prevLayer.width
      : BASE_CAKE_WIDTH;
    const height = shouldSpawnBomb ? BOMB_HEIGHT : CAKE_HEIGHT;
    const theme = getThemeForFloor(nextFloor);
    this.dripCounter += 1;

    if (prevLayer) {
      const center = prevLayer.x + prevLayer.width / 2;
      this.targetPivotX = Math.max(-40, Math.min(40, center * 0.72));
    } else {
      this.targetPivotX = 0;
    }

    const { pivotWorldY, ropeLen, maxAngle } = this.getPendulumMetrics();
    const angle = maxAngle * Math.sin(this.pendulumPhase);
    const ropeEndX = this.pivotX + Math.sin(angle) * ropeLen;
    const ropeEndY = pivotWorldY + Math.cos(angle) * ropeLen;

    this.activeCake = {
      kind: shouldSpawnBomb ? 'bomb' : 'cake',
      state: 'SWINGING',
      x: ropeEndX - width / 2,
      y: ropeEndY + 3,
      width,
      height,
      vy: 0,
      tilt: angle * 0.22,
      theme,
      dripSeed: this.dripCounter * 17,
    };
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();

    const tick = (now: number) => {
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      if (this.gameState !== 'PAUSED') {
        this.update(dt);
      }
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  private update(dt: number): void {
    this.time += dt;

    if (this.dropCooldown > 0) {
      this.dropCooldown = Math.max(0, this.dropCooldown - dt);
    }

    if (this.milestoneTimer > 0) {
      this.milestoneTimer -= dt;
      if (this.milestoneTimer <= 0) {
        this.milestoneBanner = null;
        this.emitHud();
      }
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateShake(dt);
      return;
    }

    if (this.pendingGameOver) {
      this.gameOverDelayTimer -= dt;
      if (this.gameOverDelayTimer <= 0) {
        this.pendingGameOver = false;
        this.gameState = 'GAME_OVER';
        retroAudio.stopBgm();
        this.onStateChange('GAME_OVER');
      }
    }

    this.cameraY += (this.targetCameraY - this.cameraY) * Math.min(1, dt * 6.5);
    this.pivotX += (this.targetPivotX - this.pivotX) * Math.min(1, dt * 5.0);

    this.updateShake(dt);

    const { pivotWorldY, ropeLen, maxAngle, omega } = this.getPendulumMetrics();
    this.pendulumPhase += omega * dt;
    const angle = maxAngle * Math.sin(this.pendulumPhase);
    const ropeEndX = this.pivotX + Math.sin(angle) * ropeLen;
    const ropeEndY = pivotWorldY + Math.cos(angle) * ropeLen;

    if (this.activeCake) {
      if (this.activeCake.state === 'SWINGING') {
        this.activeCake.x = ropeEndX - this.activeCake.width / 2;
        this.activeCake.y = ropeEndY + 3;
        this.activeCake.tilt = angle * 0.22;
      } else if (this.activeCake.state === 'FALLING') {
        this.activeCake.vy += GRAVITY * dt;
        this.activeCake.y += this.activeCake.vy * dt;
        this.activeCake.tilt *= Math.max(0, 1 - dt * 12);

        const targetSurfaceY =
          this.layers.length === 0 ? 0 : this.layers[this.layers.length - 1].y;

        if (this.activeCake.kind === 'bomb') {
          this.resolveBombFall(targetSurfaceY);
        } else if (this.activeCake.y + this.activeCake.height >= targetSurfaceY) {
          this.resolveLanding(targetSurfaceY);
        }
      }
    }

    for (const layer of this.layers) {
      if (layer.squash > 0) {
        layer.squash = Math.max(0, layer.squash - dt * 4.5);
      }
      if (layer.flashTimer > 0) {
        layer.flashTimer = Math.max(0, layer.flashTimer - dt);
      }
    }

    for (let i = this.fallingPieces.length - 1; i >= 0; i--) {
      const p = this.fallingPieces[i];
      p.vy += GRAVITY * 0.85 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vr * dt;
      if (p.y > this.cameraY + this.virtualH + 80) {
        this.fallingPieces.splice(i, 1);
      }
    }

    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y += ft.vy * dt;
      ft.vy *= Math.max(0, 1 - dt * 2.5);
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private resolveBombFall(targetSurfaceY: number): void {
    const bomb = this.activeCake;
    const prev = this.layers[this.layers.length - 1];
    if (!bomb || !prev) return;

    const overlapLeft = Math.max(bomb.x, prev.x);
    const overlapRight = Math.min(bomb.x + bomb.width, prev.x + prev.width);
    const hitsCakeHorizontally = overlapRight > overlapLeft + 1;

    // Case 1: Bomb hits the top cake layer
    if (hitsCakeHorizontally && bomb.y + bomb.height >= targetSurfaceY) {
      this.activeCake = null;
      this.combo = 0;
      this.lastOutcome = 'BOMB_HIT';
      this.hitstopTimer = 0.06;
      this.shakeMag = 7.5;
      retroAudio.playExplosion();

      const bx = bomb.x + bomb.width / 2;
      const by = targetSurfaceY;
      this.spawnBurst(bx, by, '#FFE066', 18, 'star');
      this.spawnBurst(bx, by, '#E63946', 14, 'crumb');
      this.spawnBurst(bx, by - 4, '#6E6A6F', 12, 'smoke');

      // Blast top layer into 2 flying cake halves
      const blasted = this.layers.pop();
      if (blasted) {
        const halfW = Math.max(6, blasted.width / 2);
        this.fallingPieces.push(
          {
            x: blasted.x,
            y: blasted.y,
            width: halfW,
            height: blasted.height,
            vx: -78,
            vy: -130,
            rotation: 0,
            vr: -5.2,
            theme: blasted.theme,
            dripSeed: blasted.dripSeed,
            alpha: 1,
          },
          {
            x: blasted.x + halfW,
            y: blasted.y,
            width: halfW,
            height: blasted.height,
            vx: 78,
            vy: -120,
            rotation: 0,
            vr: 5.2,
            theme: blasted.theme,
            dripSeed: blasted.dripSeed + 5,
            alpha: 1,
          }
        );
      }

      this.floor = this.layers.length;
      const newTop = this.layers[this.layers.length - 1];
      this.targetCameraY = newTop ? Math.min(0, newTop.y + 86) : 0;

      this.addFloatingText(bx, by - 18, 'BOOM!', '炸毀頂層 -1F', '#FF5964', 1.2);

      if (this.layers.length === 0) {
        this.pendingGameOver = true;
        this.gameOverDelayTimer = 0.6;
        this.persist();
        this.emitHud();
        return;
      }

      this.dropCooldown = 0.2;
      this.persist();
      this.spawnNextCake();
      this.emitHud();
      return;
    }

    // Case 2: Bomb passes safely beside the cake tower
    if (!hitsCakeHorizontally && bomb.y >= targetSurfaceY + 20) {
      const bx = bomb.x + bomb.width / 2;
      const by = bomb.y + bomb.height / 2;

      this.activeCake = null;
      this.score += 30;
      if (this.score > this.bestScore) this.bestScore = this.score;
      this.lastOutcome = 'BOMB_DODGED';
      this.shakeMag = 2.0;
      retroAudio.playBombDefused();

      this.spawnBurst(bx, by, '#FFE066', 12, 'star');
      this.spawnBurst(bx, by, '#D3D0CB', 8, 'smoke');
      this.addFloatingText(bx, by - 10, '閃避成功!', '+30', '#70E000', 1.1);

      this.dropCooldown = 0.18;
      this.persist();
      this.spawnNextCake();
      this.emitHud();
    }
  }

  private resolveLanding(targetSurfaceY: number): void {
    const ac = this.activeCake;
    if (!ac) return;

    const newFloor = this.floor + 1;
    const prev = this.layers[this.layers.length - 1];

    // Floor 1 lands cleanly on the bakery counter within playfield bounds
    if (!prev) {
      const minX = -this.virtualW / 2 + 10;
      const maxX = this.virtualW / 2 - ac.width - 10;
      const clampedX = Math.max(minX, Math.min(maxX, ac.x));
      this.layers.push({
        floor: newFloor,
        x: clampedX,
        y: -CAKE_HEIGHT,
        width: ac.width,
        height: CAKE_HEIGHT,
        theme: ac.theme,
        dripSeed: ac.dripSeed,
        squash: 1,
        flashTimer: 0.07,
        isPerfect: true,
      });

      this.floor = newFloor;
      this.score += 10;
      this.lastOutcome = 'NONE';
      this.shakeMag = 2.0;
      retroAudio.playLandSoft();
      this.spawnBurst(clampedX + ac.width / 2, 0, ac.theme.frostingMain, 10, 'crumb');
      this.finishTurn(newFloor);
      return;
    }

    const delta = ac.x - prev.x;
    const absDelta = Math.abs(delta);

    // 1. PERFECT ALIGNMENT
    if (absDelta <= PERFECT_TOLERANCE) {
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.perfectCount += 1;

      let placedW = prev.width;
      let placedX = prev.x;
      let recovered = false;

      if (this.combo >= 3 && placedW < BASE_CAKE_WIDTH) {
        const nextW = Math.min(BASE_CAKE_WIDTH, placedW + WIDTH_RECOVERY_AMOUNT);
        const added = nextW - placedW;
        placedW = nextW;
        placedX = prev.x - added / 2;
        recovered = added > 0;
      }

      this.layers.push({
        floor: newFloor,
        x: placedX,
        y: targetSurfaceY - CAKE_HEIGHT,
        width: placedW,
        height: CAKE_HEIGHT,
        theme: ac.theme,
        dripSeed: ac.dripSeed,
        squash: 1,
        flashTimer: 0.11,
        isPerfect: true,
      });

      const bonus = 10 + this.combo * 10;
      this.score += bonus;
      this.floor = newFloor;
      this.lastOutcome = recovered ? 'WIDTH_UP' : 'PERFECT';
      this.hitstopTimer = 0.035;
      this.shakeMag = 2.4;

      if (recovered) {
        retroAudio.playWidthUp();
      } else {
        retroAudio.playPerfect(this.combo);
      }

      const cx = placedX + placedW / 2;
      this.spawnBurst(cx, targetSurfaceY - CAKE_HEIGHT / 2, '#FFE066', 14, 'star');
      this.spawnBurst(cx, targetSurfaceY, ac.theme.frostingMain, 8, 'crumb');
      this.addFloatingText(
        cx,
        targetSurfaceY - CAKE_HEIGHT - 14,
        recovered ? 'WIDTH UP!' : this.combo > 1 ? `PERFECT x${this.combo}` : 'PERFECT!',
        recovered ? `+${bonus} · 寬度回復` : `+${bonus}`,
        recovered ? '#70E000' : '#FFE066',
        recovered ? 1.15 : 1.05
      );

      this.finishTurn(newFloor);
      return;
    }

    // 2. CHECK OVERLAP
    const overlapLeft = Math.max(ac.x, prev.x);
    const overlapRight = Math.min(ac.x + ac.width, prev.x + prev.width);
    const overlapW = overlapRight - overlapLeft;

    if (overlapW <= 1.5) {
      // MISS -> GAME OVER
      this.combo = 0;
      this.lastOutcome = 'MISS';
      this.activeCake = null;
      this.fallingPieces.push({
        x: ac.x,
        y: targetSurfaceY - CAKE_HEIGHT,
        width: ac.width,
        height: CAKE_HEIGHT,
        vx: delta > 0 ? 42 : -42,
        vy: 60,
        rotation: 0,
        vr: delta > 0 ? 3.2 : -3.2,
        theme: ac.theme,
        dripSeed: ac.dripSeed,
        alpha: 1,
      });

      this.hitstopTimer = 0.05;
      this.shakeMag = 5.5;
      retroAudio.playMiss();
      this.addFloatingText(
        ac.x + ac.width / 2,
        targetSurfaceY - CAKE_HEIGHT - 12,
        'MISS!',
        undefined,
        '#FF5964',
        1.15
      );

      this.pendingGameOver = true;
      this.gameOverDelayTimer = 0.55;
      this.persist();
      this.emitHud();
      return;
    }

    // 3. PARTIAL OVERLAP -> SLICE EXCESS
    this.combo = 0;
    this.layers.push({
      floor: newFloor,
      x: overlapLeft,
      y: targetSurfaceY - CAKE_HEIGHT,
      width: overlapW,
      height: CAKE_HEIGHT,
      theme: ac.theme,
      dripSeed: ac.dripSeed,
      squash: 0.9,
      flashTimer: 0.06,
      isPerfect: false,
    });

    const overhangLeft = ac.x < prev.x;
    const cutX = overhangLeft ? ac.x : prev.x + prev.width;
    const cutW = ac.width - overlapW;

    if (cutW > 0.5) {
      this.fallingPieces.push({
        x: cutX,
        y: targetSurfaceY - CAKE_HEIGHT,
        width: cutW,
        height: CAKE_HEIGHT,
        vx: overhangLeft ? -58 : 58,
        vy: -35,
        rotation: 0,
        vr: overhangLeft ? -4.5 : 4.5,
        theme: ac.theme,
        dripSeed: ac.dripSeed,
        alpha: 1,
      });
    }

    const cutLineX = overhangLeft ? overlapLeft : overlapRight;
    this.spawnBurst(cutLineX, targetSurfaceY - CAKE_HEIGHT / 2, ac.theme.spongeMain, 9, 'crumb');
    this.spawnBurst(cutLineX, targetSurfaceY - CAKE_HEIGHT + 3, ac.theme.frostingMain, 7, 'crumb');

    this.floor = newFloor;
    this.score += 10;
    this.lastOutcome = 'SLICE';
    this.hitstopTimer = 0.028;
    this.shakeMag = 3.0;
    retroAudio.playSlice();

    this.finishTurn(newFloor);
  }

  private finishTurn(newFloor: number): void {
    this.activeCake = null;
    this.dropCooldown = 0.14;

    const topY = this.layers[this.layers.length - 1].y;
    this.targetCameraY = Math.min(0, topY + 86);

    if (this.score > this.bestScore) this.bestScore = this.score;
    if (this.floor > this.bestFloor) this.bestFloor = this.floor;

    if (newFloor % 10 === 0) {
      const nextTierTheme = getThemeForFloor(newFloor + 1);
      if (!this.unlockedThemeIds.includes(nextTierTheme.id)) {
        this.unlockedThemeIds.push(nextTierTheme.id);
      }
      this.milestoneBanner = nextTierTheme;
      this.milestoneTimer = 3.0;
      retroAudio.playMilestone();
      this.spawnConfettiWave(topY - 25);
      this.addFloatingText(
        0,
        topY - 34,
        `${newFloor}F 達成！`,
        `解鎖：${nextTierTheme.name}`,
        '#FFE066',
        1.15
      );
    }

    this.persist();
    this.spawnNextCake();
    this.emitHud();
  }

  private persist(): void {
    saveProgress({
      bestScore: this.bestScore,
      bestFloor: this.bestFloor,
      unlockedThemeIds: this.unlockedThemeIds,
      muted: retroAudio.isMuted(),
      bgmEnabled: retroAudio.isBgmEnabled(),
    });
  }

  private emitHud(): void {
    this.onHudChange(this.getSnapshot());
  }

  private updateShake(dt: number): void {
    if (this.shakeMag > 0.05) {
      this.shakeX = (Math.random() - 0.5) * 2 * this.shakeMag;
      this.shakeY = (Math.random() - 0.5) * 2 * this.shakeMag;
      this.shakeMag *= Math.max(0, 1 - dt * 15);
    } else {
      this.shakeMag = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  private clearParticles(): void {
    for (const p of this.particles) {
      p.active = false;
    }
  }

  private spawnBurst(
    x: number,
    y: number,
    color: string,
    count: number,
    kind: Particle['kind']
  ): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      const angle = Math.random() * Math.PI * 2;
      const speed =
        kind === 'star'
          ? 40 + Math.random() * 95
          : kind === 'smoke'
          ? 18 + Math.random() * 48
          : 25 + Math.random() * 75;
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 6;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - (kind === 'star' ? 45 : kind === 'smoke' ? 36 : 30);
      p.size = kind === 'star' ? 2 : kind === 'smoke' ? 4 : 2 + Math.floor(Math.random() * 2);
      p.color = color;
      p.maxLife = kind === 'star' ? 0.55 : kind === 'smoke' ? 0.65 : 0.45;
      p.life = p.maxLife;
      p.gravity = kind === 'star' ? 140 : kind === 'smoke' ? -30 : 320;
      p.kind = kind;
      spawned++;
      if (spawned >= count) break;
    }
  }

  private spawnConfettiWave(centerY: number): void {
    const colors = ['#E63946', '#FFE066', '#70E000', '#4CC9F0', '#F72585', '#FFFDF7'];
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      p.active = true;
      p.x = (Math.random() - 0.5) * 170;
      p.y = centerY - 20 - Math.random() * 60;
      p.vx = (Math.random() - 0.5) * 90;
      p.vy = -80 - Math.random() * 110;
      p.size = 3;
      p.color = colors[spawned % colors.length];
      p.maxLife = 1.4 + Math.random() * 0.6;
      p.life = p.maxLife;
      p.gravity = 190;
      p.kind = 'confetti';
      spawned++;
      if (spawned >= 38) break;
    }
  }

  private addFloatingText(
    x: number,
    y: number,
    text: string,
    subText: string | undefined,
    color: string,
    scale: number
  ): void {
    this.floatingTexts.push({
      x,
      y,
      vy: -36,
      text,
      subText,
      color,
      life: 0.95,
      maxLife: 0.95,
      scale,
    });
  }

  private render(): void {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const scaleX = this.canvas.width / this.virtualW;
    const scaleY = this.canvas.height / this.virtualH;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.scale(scaleX, scaleY);

    const { pivotScreenY, pivotWorldY, ropeLen, maxAngle } = this.getPendulumMetrics();
    const angle = maxAngle * Math.sin(this.pendulumPhase);
    const ropeEndX = this.pivotX + Math.sin(angle) * ropeLen;
    const ropeEndY = pivotWorldY + Math.cos(angle) * ropeLen;

    renderGame(ctx, {
      virtualW: this.virtualW,
      virtualH: this.virtualH,
      cameraY: this.cameraY,
      shakeX: this.shakeX,
      shakeY: this.shakeY,
      time: this.time,
      pivotX: this.pivotX,
      pivotY: pivotScreenY,
      ropeEndX,
      ropeEndY,
      layers: this.layers,
      activeCake: this.activeCake,
      fallingPieces: this.fallingPieces,
      particles: this.particles,
      floatingTexts: this.floatingTexts,
      currentFloor: Math.max(1, this.floor + 1),
      cakeHeight: CAKE_HEIGHT,
      baseCakeWidth: BASE_CAKE_WIDTH,
      showTapGuide: this.gameState === 'PLAYING' && this.layers.length === 0,
    });

    ctx.restore();
  }
}
