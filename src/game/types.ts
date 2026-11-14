export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type ToppingStyle =
  | 'strawberry'
  | 'matcha'
  | 'chocolate'
  | 'caramel'
  | 'blueberry'
  | 'starlight';

export interface StageTheme {
  id: string;
  tierIndex: number;
  minFloor: number;
  name: string;
  englishTag: string;
  description: string;
  spongeMain: string;
  spongeShadow: string;
  filling: string;
  frostingMain: string;
  frostingHighlight: string;
  frostingShadow: string;
  accentColor: string;
  topping: ToppingStyle;
  skyTop: string;
  skyBottom: string;
}

export interface CakeLayer {
  floor: number;
  x: number;
  y: number;
  width: number;
  height: number;
  theme: StageTheme;
  dripSeed: number;
  squash: number;
  flashTimer: number;
  isPerfect: boolean;
}

export interface ActiveCake {
  kind: 'cake' | 'bomb';
  state: 'SWINGING' | 'FALLING';
  x: number;
  y: number;
  width: number;
  height: number;
  vy: number;
  tilt: number;
  theme: StageTheme;
  dripSeed: number;
}

export interface FallingPiece {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  rotation: number;
  vr: number;
  theme: StageTheme;
  dripSeed: number;
  alpha: number;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  gravity: number;
  kind: 'crumb' | 'star' | 'confetti' | 'smoke';
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  subText?: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface HudSnapshot {
  score: number;
  bestScore: number;
  floor: number;
  bestFloor: number;
  combo: number;
  maxCombo: number;
  perfectCount: number;
  widthPercent: number;
  currentTheme: StageTheme;
  unlockedThemeIds: string[];
  milestoneBanner: StageTheme | null;
  bombActive: boolean;
  lastOutcome:
    | 'NONE'
    | 'PERFECT'
    | 'SLICE'
    | 'WIDTH_UP'
    | 'MISS'
    | 'BOMB_DODGED'
    | 'BOMB_HIT';
}

export interface SavedProgress {
  bestScore: number;
  bestFloor: number;
  unlockedThemeIds: string[];
  muted: boolean;
  bgmEnabled: boolean;
}
