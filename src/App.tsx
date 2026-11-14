import { useEffect, useRef, useState } from 'react';
import {
  Bomb,
  BookOpen,
  Music,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { FlavorCodexModal } from './components/FlavorCodexModal';
import { PixelLockup } from './components/PixelLockup';
import { retroAudio } from './game/audio';
import { CakeStackEngine } from './game/engine';
import { getThemeForFloor, loadProgress } from './game/themes';
import { GameState, HudSnapshot } from './game/types';

const INITIAL_SAVE = loadProgress();

const INITIAL_HUD: HudSnapshot = {
  score: 0,
  bestScore: INITIAL_SAVE.bestScore,
  floor: 0,
  bestFloor: INITIAL_SAVE.bestFloor,
  combo: 0,
  maxCombo: 0,
  perfectCount: 0,
  widthPercent: 100,
  currentTheme: getThemeForFloor(1),
  unlockedThemeIds: INITIAL_SAVE.unlockedThemeIds,
  milestoneBanner: null,
  bombActive: false,
  lastOutcome: 'NONE',
};

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CakeStackEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState<boolean>(INITIAL_SAVE.muted);
  const [bgmEnabled, setBgmEnabled] = useState<boolean>(INITIAL_SAVE.bgmEnabled);
  const [codexOpen, setCodexOpen] = useState<boolean>(false);

  useEffect(() => {
    const engine = new CakeStackEngine(
      (snapshot) => setHud(snapshot),
      (nextState) => setGameState(nextState)
    );
    engineRef.current = engine;

    if (canvasRef.current) {
      engine.attachCanvas(canvasRef.current);
    }

    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);

    let observer: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => engine.resize());
      observer.observe(containerRef.current);
    }

    const handleBlur = () => {
      if (engine.getState() === 'PLAYING') {
        engine.pauseGame();
      }
    };

    const handleVisibility = () => {
      if (document.hidden && engine.getState() === 'PLAYING') {
        engine.pauseGame();
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
      observer?.disconnect();
      engine.detachCanvas();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      if (codexOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          retroAudio.playUiClick();
          setCodexOpen(false);
        }
        return;
      }

      if (e.code === 'KeyM') {
        e.preventDefault();
        setMuted(engine.toggleMute());
        return;
      }

      if (e.key === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        const st = engine.getState();
        if (st === 'PLAYING') {
          engine.pauseGame();
        } else if (st === 'PAUSED') {
          engine.resumeGame();
        }
        return;
      }

      if (e.code === 'Space' || e.key === 'Enter') {
        if (e.repeat) return;
        e.preventDefault();
        const st = engine.getState();
        if (st === 'TITLE_MENU' || st === 'GAME_OVER') {
          engine.startNewGame();
        } else if (st === 'PLAYING') {
          engine.handleDropAction();
        } else if (st === 'PAUSED') {
          engine.resumeGame();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [codexOpen]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (gameState !== 'PLAYING' || codexOpen) return;
    engineRef.current?.handleDropAction();
  };

  const handleToggleMute = () => {
    if (!engineRef.current) return;
    setMuted(engineRef.current.toggleMute());
  };

  const handleToggleBgm = () => {
    if (!engineRef.current) return;
    setBgmEnabled(engineRef.current.toggleBgm());
  };

  const isNewRecord = hud.score > 0 && hud.score >= hud.bestScore;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-dvh overflow-hidden bg-[#2B1918] select-none"
    >
      {/* Dedicated Isolated 60fps Game Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        className="pixel-canvas block w-full h-full cursor-pointer touch-manipulation"
        aria-label="像素甜點塔遊戲畫布"
      />

      {/* Top HUD Overlay (pointer-events-none except compact controls) */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-4 pt-3 sm:px-6 sm:pt-4">
        {gameState === 'PLAYING' || gameState === 'PAUSED' ? (
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2.5">
              <span className="font-pixel-num text-3xl sm:text-4xl font-bold text-[#4A2521] drop-shadow-[0_2px_0_rgba(255,253,247,0.95)] leading-none">
                {hud.score}
              </span>
              {hud.combo > 0 && (
                <span className="font-pixel-num text-xs sm:text-sm font-bold text-[#D9480F] drop-shadow-[0_1px_0_rgba(255,253,247,0.9)] whitespace-nowrap">
                  COMBO x{hud.combo}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[#4A2521] drop-shadow-[0_1px_0_rgba(255,253,247,0.9)]">
              <span className="font-pixel-num font-bold">{hud.floor}F</span>
              <span aria-hidden="true">·</span>
              <span className="font-pixel-tc font-bold truncate max-w-[120px] sm:max-w-none">
                {hud.currentTheme.name}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-pixel-num">寬度 {hud.widthPercent}%</span>
            </div>
            {hud.combo === 2 && hud.widthPercent < 100 && (
              <div className="mt-0.5 text-[11px] font-bold text-[#2F7D32] drop-shadow-[0_1px_0_rgba(255,253,247,0.9)]">
                再 1 次完美對齊可回復寬度
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-bold text-[#4A2521] drop-shadow-[0_1px_0_rgba(255,253,247,0.9)] pt-2">
            <span className="font-pixel-tc">最高紀錄</span>
            <span className="font-pixel-num">{hud.bestScore} 分</span>
            <span aria-hidden="true">·</span>
            <span className="font-pixel-num">{hud.bestFloor}F</span>
          </div>
        )}

        {/* Top-Right Compact Controls (>= 44x44px hitboxes) */}
        <div className="pointer-events-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleMute}
            className="pixel-btn-secondary min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
            aria-label={muted ? '開啟音效與音樂' : '靜音'}
            title={muted ? '開啟音效與音樂 (M)' : '靜音 (M)'}
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
            <button
              type="button"
              onClick={() =>
                gameState === 'PLAYING'
                  ? engineRef.current?.pauseGame()
                  : engineRef.current?.resumeGame()
              }
              className="pixel-btn-secondary min-h-[44px] px-3 flex items-center justify-center gap-1.5 font-pixel-tc text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
              aria-label={gameState === 'PLAYING' ? '暫停遊戲' : '繼續遊戲'}
              title={gameState === 'PLAYING' ? '暫停 (Esc / P)' : '繼續 (Esc / P)'}
            >
              {gameState === 'PLAYING' ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>暫停</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>繼續</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Little Bomb Warning Banner */}
      {gameState === 'PLAYING' && hud.bombActive && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex justify-center px-4">
          <div className="pixel-panel px-4 py-2 flex items-center gap-2 border-[#E63946] bg-[#FFF0F1]">
            <Bomb className="w-4 h-4 text-[#E63946] shrink-0" />
            <span className="font-pixel-tc text-xs sm:text-sm font-bold text-[#B0212D] whitespace-nowrap">
              小炸彈！請丟在蛋糕外側閃避 (+30)
            </span>
          </div>
        </div>
      )}

      {/* 10-Floor Stage Unlock Milestone Banner */}
      {gameState === 'PLAYING' && hud.milestoneBanner && (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-20 flex justify-center px-4">
          <div className="pixel-panel px-4 py-2 text-center">
            <p className="font-pixel-en text-[10px] tracking-widest text-[#E63946]">
              STAGE UNLOCKED · {hud.milestoneBanner.englishTag}
            </p>
            <p className="font-pixel-tc text-sm font-bold text-[#4A2521]">
              解鎖新口味：{hud.milestoneBanner.name}
            </p>
          </div>
        </div>
      )}

      {/* First-Drop Onboarding Hint */}
      {gameState === 'PLAYING' && hud.floor === 0 && !hud.bombActive && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex justify-center px-4">
          <p className="font-pixel-tc text-xs sm:text-sm font-bold text-[#FFFDF7] drop-shadow-[0_2px_0_#4A2521] tracking-wide">
            點擊螢幕任意處或按空白鍵投放蛋糕
          </p>
        </div>
      )}

      {/* TITLE SCREEN OVERLAY */}
      {gameState === 'TITLE_MENU' && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-between px-6 pt-16 pb-8 pointer-events-none">
          <div className="pointer-events-auto mt-4 sm:mt-8">
            <PixelLockup />
          </div>

          <div className="pointer-events-auto w-full max-w-xs flex flex-col items-center gap-3 mb-2">
            <button
              type="button"
              onClick={() => engineRef.current?.startNewGame()}
              className="pixel-btn-primary w-full min-h-[52px] px-6 py-3 flex items-center justify-center gap-2 font-pixel-tc text-lg font-bold tracking-wider cursor-pointer whitespace-nowrap"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>開始烘焙</span>
            </button>

            <button
              type="button"
              onClick={() => {
                retroAudio.playUiClick();
                setCodexOpen(true);
              }}
              className="pixel-btn-secondary w-full min-h-[46px] px-5 py-2.5 flex items-center justify-center gap-2 font-pixel-tc text-sm font-bold cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4" />
              <span>
                口味圖鑑 ({hud.unlockedThemeIds.length}/6)
              </span>
            </button>

            <p className="mt-1 text-center text-xs font-bold text-[#FFFDF7] drop-shadow-[0_2px_0_#4A2521] whitespace-nowrap">
              點擊畫面或空白鍵投放 · 避開小炸彈 · Esc/P 暫停
            </p>
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {gameState === 'PAUSED' && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-5 bg-[#2B1918]/65"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-title"
        >
          <div className="pixel-panel w-full max-w-xs p-6 text-center">
            <h2 id="pause-title" className="font-pixel-tc text-2xl font-bold text-[#4A2521]">
              遊戲暫停
            </h2>
            <p className="mt-1 text-xs text-[#7C4D3A] font-pixel-num">
              目前進度：{hud.floor}F · {hud.score} 分
            </p>

            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => engineRef.current?.resumeGame()}
                className="pixel-btn-primary w-full min-h-[48px] px-5 py-2.5 flex items-center justify-center gap-2 font-pixel-tc text-base font-bold cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>繼續遊戲</span>
              </button>

              <button
                type="button"
                onClick={handleToggleBgm}
                className="pixel-btn-secondary w-full min-h-[44px] px-4 py-2 flex items-center justify-center gap-2 font-pixel-tc text-sm font-bold cursor-pointer whitespace-nowrap"
              >
                <Music className="w-4 h-4" />
                <span>
                  背景音樂（獻給愛麗絲）：{bgmEnabled ? '開' : '關'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => engineRef.current?.startNewGame()}
                className="pixel-btn-secondary w-full min-h-[44px] px-5 py-2 flex items-center justify-center gap-2 font-pixel-tc text-sm font-bold cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span>重新開始</span>
              </button>

              <button
                type="button"
                onClick={() => engineRef.current?.returnToTitle()}
                className="pixel-btn-secondary w-full min-h-[44px] px-5 py-2 font-pixel-tc text-sm font-bold cursor-pointer whitespace-nowrap"
              >
                返回主畫面
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER MODAL */}
      {gameState === 'GAME_OVER' && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-5 bg-[#2B1918]/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gameover-title"
        >
          <div className="pixel-panel w-full max-w-sm p-6 text-center">
            <p className="font-pixel-en text-[11px] tracking-[0.2em] text-[#E63946] font-bold">
              {isNewRecord ? 'NEW RECORD!' : 'GAME OVER'}
            </p>
            <h2 id="gameover-title" className="mt-1 font-pixel-tc text-2xl font-bold text-[#4A2521]">
              {isNewRecord ? '破紀錄甜點塔！' : '甜點塔完工！'}
            </h2>

            <div className="mt-4 py-3 px-4 border-2 border-[#4A2521] bg-[#FFF4E0]">
              <div className="text-xs text-[#7C4D3A] font-pixel-tc">本局總分</div>
              <div className="font-pixel-num text-4xl font-bold text-[#4A2521] mt-0.5">
                {hud.score}
              </div>
              <div className="mt-1 text-xs text-[#8C4A3E] font-pixel-num">
                歷史最佳 {hud.bestScore} 分 · {hud.bestFloor}F
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 border-2 border-[#4A2521]/25 bg-[#FFFDF7]">
                <div className="text-[11px] text-[#7C4D3A]">疊高樓層</div>
                <div className="font-pixel-num text-base font-bold text-[#4A2521] mt-0.5">
                  {hud.floor}F
                </div>
              </div>
              <div className="p-2.5 border-2 border-[#4A2521]/25 bg-[#FFFDF7]">
                <div className="text-[11px] text-[#7C4D3A]">最高連擊</div>
                <div className="font-pixel-num text-base font-bold text-[#4A2521] mt-0.5">
                  x{hud.maxCombo}
                </div>
              </div>
              <div className="p-2.5 border-2 border-[#4A2521]/25 bg-[#FFFDF7]">
                <div className="text-[11px] text-[#7C4D3A]">完美次數</div>
                <div className="font-pixel-num text-base font-bold text-[#4A2521] mt-0.5">
                  {hud.perfectCount}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => engineRef.current?.startNewGame()}
                className="pixel-btn-primary w-full min-h-[50px] px-6 py-2.5 flex items-center justify-center gap-2 font-pixel-tc text-base font-bold cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span>再玩一次</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    retroAudio.playUiClick();
                    setCodexOpen(true);
                  }}
                  className="pixel-btn-secondary min-h-[44px] px-3 py-2 flex items-center justify-center gap-1.5 font-pixel-tc text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>口味圖鑑</span>
                </button>
                <button
                  type="button"
                  onClick={() => engineRef.current?.returnToTitle()}
                  className="pixel-btn-secondary min-h-[44px] px-3 py-2 font-pixel-tc text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  主畫面
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLAVOR CODEX MODAL */}
      {codexOpen && (
        <FlavorCodexModal
          unlockedIds={hud.unlockedThemeIds}
          bestFloor={hud.bestFloor}
          onClose={() => {
            retroAudio.playUiClick();
            setCodexOpen(false);
          }}
        />
      )}
    </div>
  );
}
