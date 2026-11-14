import { getThemeForFloor } from './themes';
import {
  ActiveCake,
  CakeLayer,
  FallingPiece,
  FloatingText,
  Particle,
  StageTheme,
} from './types';

export interface RenderContextData {
  virtualW: number;
  virtualH: number;
  cameraY: number; // Negative values as camera pans upward
  shakeX: number;
  shakeY: number;
  time: number;
  pivotX: number;
  pivotY: number; // Screen-space Y of pendulum pivot
  ropeEndX: number; // World X
  ropeEndY: number; // World Y
  layers: CakeLayer[];
  activeCake: ActiveCake | null;
  fallingPieces: FallingPiece[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  currentFloor: number;
  cakeHeight: number;
  baseCakeWidth: number;
  showTapGuide: boolean;
}

const OUTLINE = '#4A2521';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function lerpColor(a: string, b: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * clamped);
  const g = Math.round(g1 + (g2 - g1) * clamped);
  const bl = Math.round(b1 + (b2 - b1) * clamped);
  return `rgb(${r}, ${g}, ${bl})`;
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  data: RenderContextData
): void {
  const { virtualW, virtualH, cameraY, shakeX, shakeY, time } = data;
  const groundScreenY = virtualH - 56;
  const worldToScreenY = (wy: number) => groundScreenY + wy - cameraY;
  const worldToScreenX = (wx: number) => virtualW / 2 + wx;

  const theme = getThemeForFloor(Math.max(1, data.currentFloor));
  const nextTheme = getThemeForFloor(Math.max(1, data.currentFloor) + 10);
  const tierProgress = ((Math.max(1, data.currentFloor) - 1) % 10) / 10;

  // 1. Sky / Background Gradient
  const topColor = lerpColor(theme.skyTop, nextTheme.skyTop, tierProgress * 0.45);
  const botColor = lerpColor(theme.skyBottom, nextTheme.skyBottom, tierProgress * 0.45);
  const grad = ctx.createLinearGradient(0, 0, 0, virtualH);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, botColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, virtualW, virtualH);

  ctx.save();
  ctx.translate(Math.round(shakeX), Math.round(shakeY));

  // 2. High-altitude twinkling pixel stars (visible as tower climbs)
  const starVisibility = Math.max(0, Math.min(1, (-cameraY - 120) / 360));
  if (starVisibility > 0.02) {
    ctx.save();
    for (let i = 0; i < 32; i++) {
      const sx = ((i * 73 + 19) % Math.max(240, Math.floor(virtualW))) ;
      const sy = ((i * 47 + 11) % Math.floor(virtualH * 0.78));
      const twinkle = 0.45 + 0.55 * Math.sin(time * 2.5 + i * 1.7);
      ctx.globalAlpha = starVisibility * twinkle;
      ctx.fillStyle = i % 5 === 0 ? '#FFE885' : '#FFFFFF';
      const sz = i % 7 === 0 ? 2 : 1;
      ctx.fillRect(Math.round(sx), Math.round(sy), sz, sz);
      if (i % 7 === 0) {
        ctx.fillRect(Math.round(sx - 1), Math.round(sy + 0.5), 4, 1);
        ctx.fillRect(Math.round(sx + 0.5), Math.round(sy - 1), 1, 4);
      }
    }
    ctx.restore();
  }

  // 3. Drifting pixel clouds (mid-to-high altitude)
  const cloudAlpha = Math.max(0.2, 0.85 - starVisibility * 0.45);
  ctx.save();
  ctx.globalAlpha = cloudAlpha;
  for (let i = 0; i < 6; i++) {
    const baseCloudY = -120 - i * 110;
    const screenCloudY = worldToScreenY(baseCloudY) * 0.55 + (i % 2) * 28;
    if (screenCloudY > -40 && screenCloudY < virtualH + 40) {
      const speed = 6 + (i % 3) * 3;
      const span = virtualW + 80;
      const cx = (((i * 97 + time * speed) % span) + span) % span - 40;
      drawPixelCloud(ctx, Math.round(cx), Math.round(screenCloudY), 1 + (i % 2) * 0.25);
    }
  }
  ctx.restore();

  // 4. Patisserie Shop Interior Backdrop (around ground level)
  const shopWallTopY = worldToScreenY(-220);
  const counterTopY = worldToScreenY(0);

  if (counterTopY > -60) {
    drawPatisserieInterior(ctx, virtualW, virtualH, shopWallTopY, counterTopY);
  }

  // 5. Base Cake Doily / Platter on the Counter (once Floor 1 lands or guide centered)
  if (data.layers.length > 0 && counterTopY < virtualH + 40) {
    const first = data.layers[0];
    const platterW = first.width + 24;
    const platterX = worldToScreenX(first.x + first.width / 2 - platterW / 2);
    drawCakePlatter(ctx, Math.round(platterX), Math.round(counterTopY), Math.round(platterW));
  }

  // 6. Stacked Cake Layers
  for (const layer of data.layers) {
    const sy = worldToScreenY(layer.y);
    if (sy > virtualH + 40 || sy + layer.height < -60) continue;

    const sx = worldToScreenX(layer.x);
    const squashFactor = layer.squash > 0 ? Math.sin(layer.squash * Math.PI) * 0.16 : 0;
    const drawW = Math.round(layer.width * (1 + squashFactor * 0.6));
    const drawH = Math.max(8, Math.round(layer.height * (1 - squashFactor)));
    const drawX = Math.round(sx - (drawW - layer.width) / 2);
    const drawY = Math.round(sy + (layer.height - drawH));

    drawPixelCake(
      ctx,
      drawX,
      drawY,
      drawW,
      drawH,
      layer.theme,
      layer.dripSeed,
      layer.flashTimer > 0,
      layer.isPerfect
    );
  }

  // 7. Pendulum Rope + Tongs + Active Swinging/Falling Cake
  const pivotScreenX = Math.round(worldToScreenX(data.pivotX));
  const pivotScreenY = Math.round(data.pivotY);

  // Brass ceiling rail
  ctx.fillStyle = '#4A2521';
  ctx.fillRect(0, pivotScreenY - 6, virtualW, 6);
  ctx.fillStyle = '#8C583A';
  ctx.fillRect(0, pivotScreenY - 5, virtualW, 3);
  // Pivot wheel
  ctx.fillStyle = '#4A2521';
  ctx.fillRect(pivotScreenX - 6, pivotScreenY - 7, 12, 10);
  ctx.fillStyle = '#E9C46A';
  ctx.fillRect(pivotScreenX - 4, pivotScreenY - 5, 8, 6);
  ctx.fillStyle = '#FFF5CC';
  ctx.fillRect(pivotScreenX - 3, pivotScreenY - 4, 3, 2);

  // Rope end in screen space
  const ropeScreenX = Math.round(worldToScreenX(data.ropeEndX));
  const ropeScreenY = Math.round(worldToScreenY(data.ropeEndY));
  drawPixelRope(ctx, pivotScreenX, pivotScreenY + 2, ropeScreenX, ropeScreenY);

  // Pastry claw / tongs at rope end
  const isHolding = data.activeCake?.state === 'SWINGING';
  drawPastryTongs(ctx, ropeScreenX, ropeScreenY, isHolding);

  if (data.activeCake) {
    const ac = data.activeCake;
    const acScreenX = Math.round(worldToScreenX(ac.x));
    const acScreenY = Math.round(worldToScreenY(ac.y));

    ctx.save();
    const cx = acScreenX + ac.width / 2;
    const cy = acScreenY + ac.height / 2;
    ctx.translate(Math.round(cx), Math.round(cy));
    if (Math.abs(ac.tilt) > 0.002) {
      ctx.rotate(ac.tilt);
    }
    if (ac.kind === 'bomb') {
      drawPixelBomb(
        ctx,
        Math.round(-ac.width / 2),
        Math.round(-ac.height / 2),
        Math.round(ac.width),
        Math.round(ac.height),
        time
      );
    } else {
      drawPixelCake(
        ctx,
        Math.round(-ac.width / 2),
        Math.round(-ac.height / 2),
        Math.round(ac.width),
        Math.round(ac.height),
        ac.theme,
        ac.dripSeed,
        false,
        false
      );
    }
    ctx.restore();

    // Gentle onboarding vertical dashed hint only on Floor 1 before dropping
    if (data.showTapGuide && ac.state === 'SWINGING' && data.layers.length === 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(74, 37, 33, 0.25)';
      const guideX = Math.round(acScreenX + ac.width / 2);
      for (let py = acScreenY + ac.height + 6; py < counterTopY - 4; py += 8) {
        ctx.fillRect(guideX, Math.round(py), 1, 4);
      }
      ctx.restore();
    }
  }

  // 8. Falling Sliced Pieces
  for (const piece of data.fallingPieces) {
    const px = Math.round(worldToScreenX(piece.x));
    const py = Math.round(worldToScreenY(piece.y));
    if (py > virtualH + 60) continue;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, piece.alpha));
    ctx.translate(Math.round(px + piece.width / 2), Math.round(py + piece.height / 2));
    ctx.rotate(piece.rotation);
    drawPixelCake(
      ctx,
      Math.round(-piece.width / 2),
      Math.round(-piece.height / 2),
      Math.max(3, Math.round(piece.width)),
      Math.round(piece.height),
      piece.theme,
      piece.dripSeed,
      false,
      false
    );
    ctx.restore();
  }

  // 9. Pooled Particles
  for (const p of data.particles) {
    if (!p.active) continue;
    const px = Math.round(worldToScreenX(p.x));
    const py = Math.round(worldToScreenY(p.y));
    const lifeRatio = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = Math.min(1, lifeRatio * 1.4);
    ctx.fillStyle = p.color;
    if (p.kind === 'star') {
      const s = Math.max(1, Math.round(p.size));
      ctx.fillRect(px - s, py, s * 2 + 1, 1);
      ctx.fillRect(px, py - s, 1, s * 2 + 1);
    } else if (p.kind === 'confetti') {
      ctx.fillRect(px, py, Math.round(p.size), Math.max(2, Math.round(p.size * 0.6)));
    } else if (p.kind === 'smoke') {
      const s = Math.max(2, Math.round(p.size * (1.8 - lifeRatio * 0.8)));
      ctx.fillRect(px - Math.floor(s / 2), py - Math.floor(s / 2), s, s);
    } else {
      ctx.fillRect(px, py, Math.round(p.size), Math.round(p.size));
    }
    ctx.restore();
  }

  // 10. Floating Pixel Popups
  for (const ft of data.floatingTexts) {
    const fx = Math.round(worldToScreenX(ft.x));
    const fy = Math.round(worldToScreenY(ft.y));
    const alpha = Math.min(1, (ft.life / ft.maxLife) * 1.6);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = Math.round(10 * ft.scale);
    ctx.font = `700 ${fontSize}px "Silkscreen", "DotGothic16", monospace`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#3B1E1A';
    ctx.strokeText(ft.text, fx, fy);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, fx, fy);

    if (ft.subText) {
      ctx.font = `700 7px "Silkscreen", "DotGothic16", monospace`;
      ctx.strokeText(ft.subText, fx, fy + 11);
      ctx.fillStyle = '#FFFDF7';
      ctx.fillText(ft.subText, fx, fy + 11);
    }
    ctx.restore();
  }

  ctx.restore();
}

function drawPixelCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number
): void {
  const s = scale;
  ctx.fillStyle = '#FFFDF9';
  ctx.fillRect(x, y, Math.round(28 * s), Math.round(8 * s));
  ctx.fillRect(x + Math.round(4 * s), y - Math.round(5 * s), Math.round(18 * s), Math.round(5 * s));
  ctx.fillRect(x + Math.round(8 * s), y - Math.round(8 * s), Math.round(10 * s), Math.round(4 * s));
  ctx.fillStyle = '#EDE2D5';
  ctx.fillRect(x + Math.round(2 * s), y + Math.round(6 * s), Math.round(24 * s), Math.round(2 * s));
}

function drawPatisserieInterior(
  ctx: CanvasRenderingContext2D,
  virtualW: number,
  virtualH: number,
  wallTopY: number,
  counterTopY: number
): void {
  // Subtle cream bakery wallpaper behind lower portion
  if (counterTopY > wallTopY) {
    const startY = Math.max(0, Math.round(wallTopY));
    const wallH = Math.round(counterTopY - startY);
    if (wallH > 0) {
      ctx.fillStyle = '#FFF2DF';
      ctx.fillRect(0, startY, virtualW, wallH);

      // Vertical pastel bakery stripes
      ctx.fillStyle = '#FCE6CB';
      for (let sx = 0; sx < virtualW; sx += 16) {
        ctx.fillRect(sx, startY, 8, wallH);
      }

      // Wainscoting wood paneling near counter
      const wainscotH = 44;
      const wainscotY = Math.round(counterTopY - wainscotH);
      if (wainscotY < virtualH) {
        ctx.fillStyle = '#EBD3B8';
        ctx.fillRect(0, wainscotY, virtualW, wainscotH);
        ctx.fillStyle = '#C9A887';
        ctx.fillRect(0, wainscotY, virtualW, 2);
        for (let px = 8; px < virtualW; px += 28) {
          ctx.fillStyle = '#DFC2A2';
          ctx.fillRect(px, wainscotY + 6, 20, wainscotH - 12);
          ctx.fillStyle = '#F5E4CE';
          ctx.fillRect(px + 1, wainscotY + 7, 18, 2);
        }
      }

      // Cafe Window Frame in background if tall enough
      const winY = Math.round(counterTopY - 148);
      if (winY + 72 > 0 && winY < virtualH) {
        const winW = 76;
        const winX = Math.round(virtualW / 2 - winW / 2);
        // Window sky
        ctx.fillStyle = '#CBE8F6';
        ctx.fillRect(winX, winY, winW, 68);
        // Window highlight streaks
        ctx.fillStyle = '#E9F7FE';
        ctx.fillRect(winX + 6, winY + 6, 8, 50);
        ctx.fillRect(winX + 18, winY + 6, 4, 34);
        // Window wood frame
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(winX - 2, winY - 2, winW + 4, 2);
        ctx.fillRect(winX - 2, winY + 68, winW + 4, 3);
        ctx.fillRect(winX - 2, winY, 2, 68);
        ctx.fillRect(winX + winW, winY, 2, 68);
        // Crossbars
        ctx.fillStyle = '#A66E4E';
        ctx.fillRect(winX, winY + 33, winW, 3);
        ctx.fillRect(winX + winW / 2 - 1, winY, 3, 68);
      }

      // Red & cream striped patisserie awning at wallTopY
      const awningY = Math.round(wallTopY);
      if (awningY > -30 && awningY < virtualH) {
        const stripeW = 14;
        for (let ax = 0; ax < virtualW; ax += stripeW) {
          const isRed = Math.floor(ax / stripeW) % 2 === 0;
          ctx.fillStyle = isRed ? '#E63946' : '#FFFDF7';
          ctx.fillRect(ax, awningY, stripeW, 14);
          ctx.fillStyle = isRed ? '#B82531' : '#EAD9C7';
          ctx.fillRect(ax, awningY + 14, stripeW, 4);
        }
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(0, awningY + 18, virtualW, 2);
      }

      // Decorative shelf items on wide screens (desktop)
      if (virtualW > 340) {
        const shelfY = Math.round(counterTopY - 102);
        const leftShelfX = 24;
        const rightShelfX = virtualW - 76;
        [leftShelfX, rightShelfX].forEach((sx) => {
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(sx, shelfY, 52, 4);
          ctx.fillStyle = '#A66E4E';
          ctx.fillRect(sx + 1, shelfY + 1, 50, 2);
          // Tiny pixel jam jars
          ctx.fillStyle = '#E63946';
          ctx.fillRect(sx + 6, shelfY - 10, 8, 10);
          ctx.fillStyle = '#FFFDF7';
          ctx.fillRect(sx + 7, shelfY - 12, 6, 2);
          ctx.fillStyle = '#E9C46A';
          ctx.fillRect(sx + 20, shelfY - 12, 9, 12);
          ctx.fillStyle = '#8AB858';
          ctx.fillRect(sx + 35, shelfY - 9, 8, 9);
        });
      }
    }
  }

  // Bakery Wooden Countertop & Checkered Floor below ground (y >= 0)
  const cy = Math.round(counterTopY);
  if (cy < virtualH) {
    // Top trim highlight
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(0, cy, virtualW, 2);
    ctx.fillStyle = '#D99B66';
    ctx.fillRect(0, cy + 2, virtualW, 4);
    ctx.fillStyle = '#A86B3E';
    ctx.fillRect(0, cy + 6, virtualW, 10);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(0, cy + 16, virtualW, 2);

    // Checkered patisserie floor tiles beneath counter lip
    const tileSize = 12;
    const floorStart = cy + 18;
    for (let ty = floorStart; ty < virtualH; ty += tileSize) {
      const row = Math.floor((ty - floorStart) / tileSize);
      for (let tx = 0; tx < virtualW; tx += tileSize) {
        const col = Math.floor(tx / tileSize);
        ctx.fillStyle = (row + col) % 2 === 0 ? '#784438' : '#572E26';
        ctx.fillRect(tx, ty, tileSize, tileSize);
      }
    }
  }
}

function drawCakePlatter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number
): void {
  // Golden-trimmed porcelain cake stand lip right on the counter
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x, y - 3, width, 4);
  ctx.fillStyle = '#FFFDF7';
  ctx.fillRect(x + 1, y - 2, width - 2, 2);
  ctx.fillStyle = '#E9C46A';
  ctx.fillRect(x + 4, y, width - 8, 2);
}

function drawPixelRope(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = Math.round(x1 + dx * t);
    const py = Math.round(y1 + dy * t);
    ctx.fillStyle = '#4A2521';
    ctx.fillRect(px - 1, py, 3, 1);
    ctx.fillStyle = i % 4 < 2 ? '#D9A066' : '#B87C44';
    ctx.fillRect(px, py, 1, 1);
  }
}

function drawPastryTongs(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  closed: boolean
): void {
  const spread = closed ? 5 : 9;
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - 3, y - 2, 6, 4);
  ctx.fillStyle = '#E9C46A';
  ctx.fillRect(x - 2, y - 1, 4, 2);

  // Left & Right claw arms
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - spread - 1, y + 1, 3, 5);
  ctx.fillRect(x + spread - 2, y + 1, 3, 5);
  ctx.fillStyle = '#C9D1D9';
  ctx.fillRect(x - spread, y + 2, 1, 3);
  ctx.fillRect(x + spread - 1, y + 2, 1, 3);
}

function drawPixelCake(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: StageTheme,
  dripSeed: number,
  flash: boolean,
  isPerfect: boolean
): void {
  if (w < 2 || h < 4) return;

  // Outer pixel border
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x, y, w, h);

  const innerX = x + 1;
  const innerY = y + 1;
  const innerW = Math.max(1, w - 2);
  const innerH = Math.max(2, h - 2);

  // Sponge body
  ctx.fillStyle = flash ? '#FFF8D6' : theme.spongeMain;
  ctx.fillRect(innerX, innerY, innerW, innerH);

  // Right & Bottom sponge shading
  if (innerW > 4 && !flash) {
    ctx.fillStyle = theme.spongeShadow;
    ctx.fillRect(innerX + innerW - 2, innerY, 2, innerH);
    ctx.fillRect(innerX, innerY + innerH - 2, innerW, 2);
  }

  // Middle filling stripe (jam / cream)
  const fillingY = innerY + Math.floor(innerH * 0.56);
  const fillingH = Math.max(2, Math.floor(innerH * 0.16));
  if (innerH >= 8) {
    ctx.fillStyle = flash ? '#FFFFFF' : theme.filling;
    ctx.fillRect(innerX, fillingY, innerW, fillingH);
  }

  // Subtle sponge crumb speckles
  if (innerW >= 12 && !flash) {
    ctx.fillStyle = theme.spongeShadow;
    for (let cx = innerX + 3; cx < innerX + innerW - 3; cx += 7) {
      const cy = innerY + Math.floor(innerH * 0.8);
      if (cy < innerY + innerH - 2) {
        ctx.fillRect(cx, cy, 1, 1);
      }
    }
  }

  // Top frosting cap
  const frostH = Math.max(3, Math.floor(innerH * 0.34));
  ctx.fillStyle = flash ? '#FFFFFF' : theme.frostingMain;
  ctx.fillRect(innerX, innerY, innerW, frostH);

  // Frosting highlight top row
  if (!flash) {
    ctx.fillStyle = theme.frostingHighlight;
    ctx.fillRect(innerX, innerY, innerW, 1);
  }

  // Wavy frosting drips along bottom of frosting cap
  if (innerW >= 6 && !flash) {
    const dripStep = 5;
    for (let dx = 1; dx < innerW - 2; dx += dripStep) {
      const hash = ((dx * 17 + dripSeed * 31) % 7);
      const dripLen = hash < 2 ? 3 : hash < 5 ? 2 : 1;
      ctx.fillStyle = theme.frostingMain;
      ctx.fillRect(innerX + dx, innerY + frostH, 2, dripLen);
      ctx.fillStyle = theme.frostingShadow;
      ctx.fillRect(innerX + dx + 1, innerY + frostH + dripLen - 1, 1, 1);
    }
  }

  // Thematic Pixel Toppings sitting along top edge
  if (innerW >= 10 && !flash) {
    drawToppings(ctx, innerX, y, innerW, theme, dripSeed);
  }

  // Subtle golden corner glint on perfect layers
  if (isPerfect && !flash && innerW >= 12) {
    ctx.fillStyle = '#FFE066';
    ctx.fillRect(innerX + 1, innerY + 1, 2, 1);
  }
}

function drawToppings(
  ctx: CanvasRenderingContext2D,
  innerX: number,
  topY: number,
  innerW: number,
  theme: StageTheme,
  seed: number
): void {
  const step = 14;
  for (let offset = 4; offset < innerW - 5; offset += step) {
    const tx = innerX + offset + ((seed + offset) % 2);
    switch (theme.topping) {
      case 'strawberry': {
        // Pixel strawberry with green leaf
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(tx - 1, topY - 4, 6, 5);
        ctx.fillStyle = '#E63946';
        ctx.fillRect(tx, topY - 3, 4, 3);
        ctx.fillStyle = '#FF99A2';
        ctx.fillRect(tx + 1, topY - 2, 1, 1);
        ctx.fillStyle = '#52B788';
        ctx.fillRect(tx + 1, topY - 4, 2, 1);
        break;
      }
      case 'matcha': {
        // Azuki red bean & cream rosette
        ctx.fillStyle = '#FFFDF7';
        ctx.fillRect(tx, topY - 3, 4, 3);
        ctx.fillStyle = '#7B3438';
        ctx.fillRect(tx + 1, topY - 4, 2, 2);
        break;
      }
      case 'chocolate': {
        // Chocolate square / curl
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(tx, topY - 4, 5, 4);
        ctx.fillStyle = '#5C382F';
        ctx.fillRect(tx + 1, topY - 3, 3, 2);
        ctx.fillStyle = '#E9C46A';
        ctx.fillRect(tx + 2, topY - 3, 1, 1);
        break;
      }
      case 'caramel': {
        // Caramelized amber shard & sea salt sparkle
        ctx.fillStyle = '#B85D19';
        ctx.fillRect(tx, topY - 4, 4, 4);
        ctx.fillStyle = '#FFD166';
        ctx.fillRect(tx + 1, topY - 3, 2, 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(tx + 3, topY - 2, 1, 1);
        break;
      }
      case 'blueberry': {
        // Blueberry trio
        ctx.fillStyle = '#2B2D42';
        ctx.fillRect(tx, topY - 3, 3, 3);
        ctx.fillStyle = '#6D5BD0';
        ctx.fillRect(tx + 1, topY - 2, 2, 2);
        ctx.fillStyle = '#B8B8FF';
        ctx.fillRect(tx + 1, topY - 2, 1, 1);
        break;
      }
      case 'starlight': {
        // Golden starlight sugar crystal
        ctx.fillStyle = '#F4A261';
        ctx.fillRect(tx + 1, topY - 4, 2, 4);
        ctx.fillRect(tx, topY - 3, 4, 2);
        ctx.fillStyle = '#FFF6B3';
        ctx.fillRect(tx + 1, topY - 3, 2, 2);
        break;
      }
    }
  }
}

function drawPixelBomb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  time: number
): void {
  const blink = Math.floor(time * 9) % 2 === 0;
  const cx = x + Math.floor(w / 2);
  const cy = y + Math.floor(h / 2) + 2;

  // Brass fuse collar
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(cx - 4, y + 1, 8, 4);
  ctx.fillStyle = '#E9C46A';
  ctx.fillRect(cx - 3, y + 2, 6, 2);

  // Fuse cord & sizzling animated spark
  ctx.fillStyle = '#D9A066';
  ctx.fillRect(cx + 1, y - 2, 2, 3);
  ctx.fillRect(cx + 3, y - 3, 3, 2);

  const sparkX = cx + 6;
  const sparkY = y - 3;
  ctx.fillStyle = blink ? '#FFE066' : '#E63946';
  ctx.fillRect(sparkX - 1, sparkY - 1, 3, 3);
  ctx.fillStyle = blink ? '#FFFFFF' : '#FFE066';
  ctx.fillRect(sparkX, sparkY, 1, 1);
  if (blink) {
    ctx.fillStyle = '#E63946';
    ctx.fillRect(sparkX - 2, sparkY, 1, 1);
    ctx.fillRect(sparkX + 2, sparkY, 1, 1);
    ctx.fillRect(sparkX, sparkY - 2, 1, 1);
    ctx.fillRect(sparkX, sparkY + 2, 1, 1);
  }

  // Round pixel iron body (stepped pixel circle)
  const bodyTop = cy - 8;
  ctx.fillStyle = blink ? '#E63946' : '#1A1B2E';
  ctx.fillRect(cx - 6, bodyTop, 12, 16);
  ctx.fillRect(cx - 8, bodyTop + 2, 16, 12);
  ctx.fillRect(cx - 9, bodyTop + 4, 18, 8);

  ctx.fillStyle = '#2B2D42';
  ctx.fillRect(cx - 5, bodyTop + 1, 10, 14);
  ctx.fillRect(cx - 7, bodyTop + 3, 14, 10);
  ctx.fillRect(cx - 8, bodyTop + 5, 16, 6);

  // Metallic highlight
  ctx.fillStyle = '#8D99AE';
  ctx.fillRect(cx - 5, bodyTop + 3, 3, 3);
  ctx.fillStyle = '#EDF2F4';
  ctx.fillRect(cx - 5, bodyTop + 3, 2, 1);

  // Cute/ominous pixel danger X on bomb belly
  ctx.fillStyle = blink ? '#FFE066' : '#E63946';
  ctx.fillRect(cx - 2, cy - 1, 1, 1);
  ctx.fillRect(cx + 1, cy - 1, 1, 1);
  ctx.fillRect(cx - 1, cy, 2, 2);
  ctx.fillRect(cx - 2, cy + 2, 1, 1);
  ctx.fillRect(cx + 1, cy + 2, 1, 1);
}

