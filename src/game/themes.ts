import { SavedProgress, StageTheme } from './types';

export const STAGE_THEMES: StageTheme[] = [
  {
    id: 'strawberry_shortcake',
    tierIndex: 0,
    minFloor: 1,
    name: '草莓鮮奶油',
    englishTag: 'Lv.1 · 1–10F',
    description: '鬆軟香草海綿夾著酸甜草莓果醬與現打生乳霜。',
    spongeMain: '#F6CA83',
    spongeShadow: '#D99E4E',
    filling: '#E63946',
    frostingMain: '#FFF9F2',
    frostingHighlight: '#FFFFFF',
    frostingShadow: '#F2DCDC',
    accentColor: '#E63946',
    topping: 'strawberry',
    skyTop: '#FCE6C9',
    skyBottom: '#FFF5E6',
  },
  {
    id: 'uji_matcha',
    tierIndex: 1,
    minFloor: 11,
    name: '宇治抹茶紅豆',
    englishTag: 'Lv.2 · 11–20F',
    description: '石臼研磨抹茶蛋糕體搭配蜜漬紅豆與微苦茶香奶蓋。',
    spongeMain: '#8AB858',
    spongeShadow: '#648F3A',
    filling: '#7B3438',
    frostingMain: '#E3F2C1',
    frostingHighlight: '#F5FCE6',
    frostingShadow: '#B8D98E',
    accentColor: '#5B8C2A',
    topping: 'matcha',
    skyTop: '#FFE0B5',
    skyBottom: '#FFF1D6',
  },
  {
    id: 'dark_ganache',
    tierIndex: 2,
    minFloor: 21,
    name: '濃醇黑巧甘納許',
    englishTag: 'Lv.3 · 21–30F',
    description: '70% 厄瓜多爾可可海綿淋上絲滑鏡面甘納許與脆片。',
    spongeMain: '#7D4B3A',
    spongeShadow: '#542F23',
    filling: '#E9C46A',
    frostingMain: '#3B211B',
    frostingHighlight: '#5C382F',
    frostingShadow: '#26130F',
    accentColor: '#D97736',
    topping: 'chocolate',
    skyTop: '#F9B89D',
    skyBottom: '#FFDDC9',
  },
  {
    id: 'salted_caramel',
    tierIndex: 3,
    minFloor: 31,
    name: '焦糖海鹽布蕾',
    englishTag: 'Lv.4 · 31–40F',
    description: '烤布蕾香濃蛋奶層淋覆琥珀焦糖與海鹽金箔碎片。',
    spongeMain: '#F2C166',
    spongeShadow: '#C78E32',
    filling: '#8C431C',
    frostingMain: '#E07A2B',
    frostingHighlight: '#F7A95C',
    frostingShadow: '#A84E14',
    accentColor: '#E07A2B',
    topping: 'caramel',
    skyTop: '#C98FA8',
    skyBottom: '#F7B79C',
  },
  {
    id: 'blueberry_lavender',
    tierIndex: 4,
    minFloor: 41,
    name: '藍莓薰衣草',
    englishTag: 'Lv.5 · 41–50F',
    description: '暮色藍莓慕斯夾心與淡雅薰衣草紫鮮奶油。',
    spongeMain: '#B9A7DE',
    spongeShadow: '#8B74BD',
    filling: '#4A3B8F',
    frostingMain: '#ECE6FA',
    frostingHighlight: '#FFFFFF',
    frostingShadow: '#CEC2EB',
    accentColor: '#6D5BD0',
    topping: 'blueberry',
    skyTop: '#45518A',
    skyBottom: '#A67FB0',
  },
  {
    id: 'golden_starlight',
    tierIndex: 5,
    minFloor: 51,
    name: '黃金星空派對',
    englishTag: 'Lv.6 · 51F+',
    description: '傳說級主廚特製！夜空絲絨蛋糕撒滿糖霜星星。',
    spongeMain: '#2E3B6B',
    spongeShadow: '#1D254A',
    filling: '#F4C95D',
    frostingMain: '#FFF4C7',
    frostingHighlight: '#FFFFFF',
    frostingShadow: '#E5CE81',
    accentColor: '#F4A261',
    topping: 'starlight',
    skyTop: '#161B33',
    skyBottom: '#333F70',
  },
];

export function getThemeForFloor(floor: number): StageTheme {
  const safeFloor = Math.max(1, floor);
  let selected = STAGE_THEMES[0];
  for (const theme of STAGE_THEMES) {
    if (safeFloor >= theme.minFloor) {
      selected = theme;
    }
  }
  return selected;
}

const STORAGE_KEY = 'pixel_cake_stack_save_v1';

export function loadProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        bestScore: 0,
        bestFloor: 0,
        unlockedThemeIds: [STAGE_THEMES[0].id],
        muted: false,
        bgmEnabled: true,
      };
    }
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    const unlocked = Array.isArray(parsed.unlockedThemeIds) && parsed.unlockedThemeIds.length > 0
      ? parsed.unlockedThemeIds
      : [STAGE_THEMES[0].id];
    if (!unlocked.includes(STAGE_THEMES[0].id)) {
      unlocked.unshift(STAGE_THEMES[0].id);
    }
    return {
      bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : 0,
      bestFloor: typeof parsed.bestFloor === 'number' ? parsed.bestFloor : 0,
      unlockedThemeIds: unlocked,
      muted: Boolean(parsed.muted),
      bgmEnabled: parsed.bgmEnabled !== undefined ? Boolean(parsed.bgmEnabled) : true,
    };
  } catch {
    return {
      bestScore: 0,
      bestFloor: 0,
      unlockedThemeIds: [STAGE_THEMES[0].id],
      muted: false,
      bgmEnabled: true,
    };
  }
}

export function saveProgress(progress: SavedProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors in restricted sandboxes
  }
}
