import { X, Lock, Check } from 'lucide-react';
import { STAGE_THEMES } from '../game/themes';

interface FlavorCodexModalProps {
  unlockedIds: string[];
  bestFloor: number;
  onClose: () => void;
}

export function FlavorCodexModal({
  unlockedIds,
  bestFloor,
  onClose,
}: FlavorCodexModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B1918]/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="codex-title"
    >
      <div className="pixel-panel w-full max-w-md max-h-[85dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b-2 border-[#4A2521]/15 bg-[#FFF4E0]">
          <div>
            <h2 id="codex-title" className="font-pixel-tc text-lg font-bold text-[#4A2521]">
              甜點口味圖鑑
            </h2>
            <p className="text-xs text-[#7C4D3A] font-pixel-num">
              已解鎖 {unlockedIds.length} / {STAGE_THEMES.length} · 最高 {bestFloor}F
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pixel-btn-secondary min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
            aria-label="關閉圖鑑"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {STAGE_THEMES.map((theme) => {
            const isUnlocked = unlockedIds.includes(theme.id);
            return (
              <div
                key={theme.id}
                className={`flex items-center gap-3.5 p-3 border-2 ${
                  isUnlocked
                    ? 'border-[#4A2521] bg-[#FFFDF7]'
                    : 'border-[#4A2521]/25 bg-[#F5ECE0] opacity-75'
                }`}
              >
                {/* Mini Pixel Cake Swatch */}
                <div
                  className="w-12 h-11 shrink-0 border-2 border-[#4A2521] flex flex-col overflow-hidden"
                  aria-hidden="true"
                >
                  <div
                    className="h-3.5 w-full border-b-2 border-[#4A2521]/30"
                    style={{
                      backgroundColor: isUnlocked ? theme.frostingMain : '#D5C7B8',
                    }}
                  />
                  <div
                    className="flex-1 w-full relative"
                    style={{
                      backgroundColor: isUnlocked ? theme.spongeMain : '#C4B5A5',
                    }}
                  >
                    <div
                      className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5"
                      style={{
                        backgroundColor: isUnlocked ? theme.filling : '#A89888',
                      }}
                    />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-pixel-tc text-sm font-bold text-[#4A2521] truncate">
                      {isUnlocked ? theme.name : '未解鎖神秘口味'}
                    </span>
                    <span className="font-pixel-num text-[11px] text-[#8C4A3E] whitespace-nowrap shrink-0 flex items-center gap-1">
                      {isUnlocked ? (
                        <Check className="w-3.5 h-3.5 text-[#3B873E]" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-[#8C4A3E]" />
                      )}
                      {theme.englishTag}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#6E443B] leading-relaxed">
                    {isUnlocked
                      ? theme.description
                      : `疊高至第 ${theme.minFloor - 1} 層即可解鎖此甜點主題。`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
