import React from 'react';

/**
 * 仪表盘全局微网格背景组件
 * 采用低开销的 SVG Pattern 与径向渐变遮罩，带来具有深邃科技感的深空网格底纹
 */
export const CyberGridBackground: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none z-0 ${className}`}
    >
      {/* 渐变氛围光斑 (Ambient Multi-Spectrum Glow Spots) */}
      <div className="absolute -top-32 left-1/4 h-[420px] w-[420px] rounded-full bg-monokai-cyan/12 blur-[130px] will-change-transform" />
      <div className="absolute top-48 right-10 h-96 w-96 rounded-full bg-monokai-accent/10 blur-[120px] will-change-transform" />
      <div className="absolute bottom-20 left-10 h-80 w-80 rounded-full bg-monokai-purple/10 blur-[120px] will-change-transform" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[700px] rounded-full bg-monokai-orange/5 blur-[160px] will-change-transform" />

      {/* SVG 科技微网格与点阵底纹 (Core Micro Grid) */}
      <svg
        className="absolute inset-0 h-full w-full opacity-60 [mask-image:radial-gradient(ellipse_at_top,white,transparent_85%)]"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern id="cyber-grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(255, 255, 255, 0.04)"
              strokeWidth="1"
            />
            <circle cx="0" cy="0" r="1" fill="rgba(166, 226, 46, 0.28)" />
            <circle cx="40" cy="40" r="0.75" fill="rgba(102, 217, 239, 0.25)" />
          </pattern>

          <pattern id="cyber-circuit-pattern" width="160" height="160" patternUnits="userSpaceOnUse">
            {/* 科技大网格边界 */}
            <path d="M 160 0 L 0 0 0 160" fill="none" stroke="rgba(102, 217, 239, 0.05)" strokeWidth="1.2" />
            {/* 交叉点十字光标 */}
            <path d="M 0 5 L 0 -5 M 5 0 L -5 0" stroke="rgba(166, 226, 46, 0.35)" strokeWidth="1" />
            <path d="M 160 165 L 160 155 M 165 160 L 155 160" stroke="rgba(102, 217, 239, 0.3)" strokeWidth="1" />
            {/* 电路走线折线 (Circuit Traces) */}
            <path
              d="M 40 40 L 60 40 L 80 60 L 120 60"
              fill="none"
              stroke="rgba(174, 129, 255, 0.08)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <circle cx="120" cy="60" r="2" fill="rgba(174, 129, 255, 0.25)" />
            <path
              d="M 160 100 L 130 100 L 110 120 L 70 120"
              fill="none"
              stroke="rgba(253, 151, 31, 0.07)"
              strokeWidth="1"
            />
            <circle cx="70" cy="120" r="1.5" fill="rgba(253, 151, 31, 0.25)" />
          </pattern>

          {/* 动态脉冲流动线性渐变 */}
          <linearGradient id="cyber-stream-accent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a6e22e" stopOpacity="0" />
            <stop offset="50%" stopColor="#a6e22e" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#66d9ef" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 底层微网格 */}
        <rect width="100%" height="100%" fill="url(#cyber-grid-pattern)" />
        {/* 上层大电路走线 */}
        <rect width="100%" height="100%" fill="url(#cyber-circuit-pattern)" />

        {/* 顶部与边缘动态环境发光导线 (Ambient Conduit Lines) */}
        <path
          d="M 0 100 Q 300 120 600 80 T 1200 90 T 1800 60"
          fill="none"
          stroke="url(#cyber-stream-accent)"
          strokeWidth="1.5"
          opacity="0.3"
        />
      </svg>
    </div>
  );
};

/**
 * Hero 展台右侧沉浸式深空数据流矢量插画
 * 呈现立体数据拓扑流动、几何环轨与 DuckDB 核心光芒
 */
export const HeroDeepSpaceIllustration: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute right-0 top-0 bottom-0 w-80 sm:w-96 select-none overflow-hidden ${className}`}
    >
      <svg
        className="w-full h-full object-cover"
        viewBox="0 0 400 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="hero-stream-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#66d9ef" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#a6e22e" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#fd971f" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hero-stream-purple" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ae81ff" stopOpacity="0.6" />
            <stop offset="70%" stopColor="#f92672" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#66d9ef" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="hero-core-glow" cx="65%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#a6e22e" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#66d9ef" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#272822" stopOpacity="0" />
          </radialGradient>
          <filter id="glow-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 核心光晕底衬 */}
        <circle cx="280" cy="95" r="90" fill="url(#hero-core-glow)" />

        {/* 环形数据轨道 (Orbit Rings) */}
        <ellipse
          cx="280"
          cy="95"
          rx="110"
          ry="45"
          stroke="rgba(102, 217, 239, 0.2)"
          strokeWidth="1.2"
          strokeDasharray="4 6"
          transform="rotate(-15 280 95)"
        />
        <ellipse
          cx="280"
          cy="95"
          rx="85"
          ry="32"
          stroke="rgba(166, 226, 46, 0.25)"
          strokeWidth="1"
          transform="rotate(12 280 95)"
        />

        {/* 流畅立体贝塞尔数据曲线 (Fluid Bezier Streams) */}
        <path
          d="M 20 180 C 120 160, 160 50, 280 95 C 330 115, 360 80, 410 40"
          stroke="url(#hero-stream-cyan)"
          strokeWidth="2.5"
          fill="none"
          filter="url(#glow-blur)"
        />
        <path
          d="M 60 20 C 150 40, 200 150, 280 95 C 320 65, 370 120, 420 110"
          stroke="url(#hero-stream-purple)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          fill="none"
        />

        {/* 几何数据节点与悬浮粒子 */}
        <g filter="url(#glow-blur)">
          <circle cx="280" cy="95" r="5" fill="#a6e22e" />
          <circle cx="280" cy="95" r="10" stroke="rgba(166, 226, 46, 0.5)" strokeWidth="1" />
        </g>
        <circle cx="170" cy="80" r="3" fill="#66d9ef" opacity="0.8" />
        <circle cx="220" cy="130" r="2.5" fill="#fd971f" opacity="0.7" />
        <circle cx="340" cy="65" r="3.5" fill="#ae81ff" opacity="0.8" />
        <circle cx="370" cy="115" r="2" fill="#f92672" opacity="0.6" />

        {/* 科技刻度十字标记 */}
        <path d="M 275 95 L 285 95 M 280 90 L 280 100" stroke="#a6e22e" strokeWidth="1" opacity="0.9" />
        <path d="M 167 80 L 173 80 M 170 77 L 170 83" stroke="#66d9ef" strokeWidth="0.8" opacity="0.6" />
        <path d="M 337 65 L 343 65 M 340 62 L 340 68" stroke="#ae81ff" strokeWidth="0.8" opacity="0.6" />
      </svg>
    </div>
  );
};

/**
 * KPI 卡片半透明浮雕矢量水印 (Watermark)
 */
export const KpiWatermark: React.FC<{
  type: 'tables' | 'rows' | 'queries' | 'latency' | 'engine' | 'memory';
  className?: string;
}> = ({ type, className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute right-1.5 bottom-1.5 opacity-[0.07] transition-opacity duration-300 group-hover:opacity-[0.16] select-none ${className}`}
    >
      {type === 'tables' && (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <ellipse cx="24" cy="12" rx="16" ry="6" stroke="currentColor" strokeWidth="2.5" />
          <path d="M8 12 V24 C8 27.5 15.2 30 24 30 C32.8 30 40 27.5 40 24 V12" stroke="currentColor" strokeWidth="2.5" />
          <path d="M8 24 V36 C8 39.5 15.2 42 24 42 C32.8 42 40 39.5 40 36 V24" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      )}

      {type === 'rows' && (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="6" y="8" width="36" height="32" rx="4" stroke="currentColor" strokeWidth="2.5" />
          <line x1="6" y1="18" x2="42" y2="18" stroke="currentColor" strokeWidth="2" />
          <line x1="6" y1="28" x2="42" y2="28" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
          <line x1="18" y1="8" x2="18" y2="40" stroke="currentColor" strokeWidth="2" />
        </svg>
      )}

      {type === 'queries' && (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path
            d="M 6 26 L 14 26 L 19 14 L 25 34 L 30 22 L 34 26 L 42 26"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="19" cy="14" r="2.5" fill="currentColor" />
          <circle cx="25" cy="34" r="2.5" fill="currentColor" />
        </svg>
      )}

      {type === 'latency' && (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="2.5" strokeDasharray="6 3" />
          <path d="M 24 14 V 24 L 31 29" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="24" cy="24" r="3" fill="currentColor" />
        </svg>
      )}

      {type === 'engine' && (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="12" y="12" width="24" height="24" rx="3" stroke="currentColor" strokeWidth="2.5" />
          <rect x="18" y="18" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.3" />
          {/* Pins */}
          <line x1="16" y1="6" x2="16" y2="12" stroke="currentColor" strokeWidth="2" />
          <line x1="24" y1="6" x2="24" y2="12" stroke="currentColor" strokeWidth="2" />
          <line x1="32" y1="6" x2="32" y2="12" stroke="currentColor" strokeWidth="2" />
          <line x1="16" y1="36" x2="16" y2="42" stroke="currentColor" strokeWidth="2" />
          <line x1="24" y1="36" x2="24" y2="42" stroke="currentColor" strokeWidth="2" />
          <line x1="32" y1="36" x2="32" y2="42" stroke="currentColor" strokeWidth="2" />
        </svg>
      )}

      {type === 'memory' && (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="2.5" />
          <path d="M 12 24 C 16 20, 20 28, 24 24 C 28 20, 32 28, 36 24" stroke="currentColor" strokeWidth="2" />
          <path d="M 12 30 C 16 26, 20 34, 24 30 C 28 26, 32 34, 36 30" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" />
        </svg>
      )}

      {type === 'quality' && (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path
            d="M 24 6 L 38 12 V 24 C 38 33 24 42 24 42 C 24 42 10 33 10 24 V 12 Z"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M 18 24 L 22 28 L 30 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}

      {type === 'throughput' && (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M 6 36 L 16 24 L 26 30 L 42 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 32 12 H 42 V 22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="16" cy="24" r="2.5" fill="currentColor" />
          <circle cx="26" cy="30" r="2.5" fill="currentColor" />
        </svg>
      )}
    </div>
  );
};

/**
 * 空数据表与初始接入态科技插画
 */
export const EmptyCockpitIllustration: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`relative mx-auto flex items-center justify-center select-none ${className}`}
    >
      <svg width="140" height="110" viewBox="0 0 140 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="empty-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#66d9ef" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#a6e22e" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* 悬浮底台光环 */}
        <ellipse cx="70" cy="85" rx="55" ry="18" fill="url(#empty-glow)" opacity="0.3" />
        <ellipse cx="70" cy="85" rx="42" ry="12" stroke="rgba(102, 217, 239, 0.4)" strokeWidth="1.5" strokeDasharray="4 4" />

        {/* 数据立方体投影 */}
        <g transform="translate(42, 20)">
          {/* Top Face */}
          <polygon points="28,0 56,12 28,24 0,12" fill="#3e3d32" stroke="#66d9ef" strokeWidth="1.5" opacity="0.9" />
          {/* Left Face */}
          <polygon points="0,12 28,24 28,52 0,40" fill="#272822" stroke="#66d9ef" strokeWidth="1.5" opacity="0.8" />
          {/* Right Face */}
          <polygon points="28,24 56,12 56,40 28,52" fill="#1e1f1c" stroke="#a6e22e" strokeWidth="1.5" opacity="0.85" />
          {/* Center glowing dot */}
          <circle cx="28" cy="12" r="3" fill="#a6e22e" />
        </g>

        {/* 向上吸入流光箭头 */}
        <path d="M 70 8 L 70 20 M 66 12 L 70 8 L 74 12" stroke="#a6e22e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

/**
 * DuckDB 数据处理与向量引擎流动示意图 (Pipeline Stream Illustration)
 */
export const DataPipelineStreamIllustration: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div aria-hidden="true" className={`pointer-events-none select-none ${className}`}>
      <svg viewBox="0 0 500 70" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="pipe-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#66d9ef" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#a6e22e" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#fd971f" stopOpacity="0.8" />
          </linearGradient>
          <filter id="pipe-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 核心流通导管 */}
        <path
          d="M 20 35 H 480"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M 20 35 H 480"
          stroke="url(#pipe-gradient)"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#pipe-glow)"
        />

        {/* 节点 1: 数据源 (Parquet/CSV/Arrow) */}
        <g transform="translate(60, 35)">
          <circle r="14" fill="#1e1f1c" stroke="#66d9ef" strokeWidth="1.8" />
          <circle r="6" fill="#66d9ef" />
          <text y="-20" textAnchor="middle" fill="#66d9ef" fontSize="9" fontFamily="monospace" fontWeight="bold">
            数据接入
          </text>
        </g>

        {/* 节点 2: DuckDB 向量计算核心 */}
        <g transform="translate(250, 35)">
          <circle r="18" fill="#1e1f1c" stroke="#a6e22e" strokeWidth="2.2" filter="url(#pipe-glow)" />
          <polygon points="-6,-6 6,-6 6,6 -6,6" fill="#a6e22e" />
          <text y="-25" textAnchor="middle" fill="#a6e22e" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
            DuckDB 向量化执行
          </text>
        </g>

        {/* 节点 3: 聚合洞察 / OLAP 分析 */}
        <g transform="translate(440, 35)">
          <circle r="14" fill="#1e1f1c" stroke="#fd971f" strokeWidth="1.8" />
          <circle r="6" fill="#fd971f" />
          <text y="-20" textAnchor="middle" fill="#fd971f" fontSize="9" fontFamily="monospace" fontWeight="bold">
            OLAP 洞察
          </text>
        </g>

        {/* 导管上的流动脉冲点 */}
        <circle cx="150" cy="35" r="3" fill="#a6e22e" opacity="0.9" />
        <circle cx="350" cy="35" r="3" fill="#fd971f" opacity="0.9" />
      </svg>
    </div>
  );
};
