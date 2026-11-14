export function PixelLockup() {
  return (
    <div className="flex flex-col items-center text-center select-none">
      {/* Bespoke Inline Pixel-Art Cake Crest */}
      <svg
        width="76"
        height="68"
        viewBox="0 0 19 17"
        className="mb-3 drop-shadow-[0_4px_0_rgba(74,37,33,0.35)]"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        {/* Strawberry topping */}
        <rect x="8" y="0" width="3" height="1" fill="#52B788" />
        <rect x="7" y="1" width="5" height="3" fill="#4A2521" />
        <rect x="8" y="1" width="3" height="2" fill="#E63946" />
        <rect x="9" y="1" width="1" height="1" fill="#FF99A2" />

        {/* Top tier frosting & sponge */}
        <rect x="4" y="4" width="11" height="5" fill="#4A2521" />
        <rect x="5" y="5" width="9" height="3" fill="#F6CA83" />
        <rect x="5" y="5" width="9" height="1" fill="#FFFDF7" />
        <rect x="6" y="6" width="2" height="1" fill="#FFFDF7" />
        <rect x="10" y="6" width="2" height="1" fill="#FFFDF7" />

        {/* Bottom tier frosting & sponge */}
        <rect x="2" y="9" width="15" height="6" fill="#4A2521" />
        <rect x="3" y="10" width="13" height="4" fill="#F6CA83" />
        <rect x="3" y="12" width="13" height="1" fill="#E63946" />
        <rect x="3" y="10" width="13" height="1" fill="#FFFDF7" />
        <rect x="4" y="11" width="2" height="1" fill="#FFFDF7" />
        <rect x="8" y="11" width="3" height="1" fill="#FFFDF7" />
        <rect x="13" y="11" width="2" height="1" fill="#FFFDF7" />

        {/* Porcelain platter */}
        <rect x="1" y="15" width="17" height="2" fill="#4A2521" />
        <rect x="2" y="15" width="15" height="1" fill="#FFFDF7" />
        <rect x="5" y="16" width="9" height="1" fill="#E9C46A" />
      </svg>

      <p className="font-pixel-en text-[11px] tracking-[0.22em] text-[#8C4A3E] mb-1">
        PIXEL PATISSERIE
      </p>
      <h1 className="font-pixel-tc text-4xl sm:text-5xl font-bold tracking-wider text-[#4A2521] drop-shadow-[0_3px_0_#FFFDF7] [text-wrap:balance]">
        像素甜點塔
      </h1>
      <p className="mt-2 text-xs sm:text-sm text-[#6E443B] font-medium">
        鐘擺投落 · 精準切片 · 連擊回復寬度
      </p>
    </div>
  );
}
