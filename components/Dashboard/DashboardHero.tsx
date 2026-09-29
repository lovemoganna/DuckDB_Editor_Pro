import React, { useMemo } from 'react';
import {
  Play,
  Upload,
  PlusSquare,
  Table,
  Database,
  HardDrive,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { Tab } from '../../types';
import { type DashboardDbMetrics } from '../../hooks/useDashboardWorkflow';
import { DB } from './dashboardUi';

interface DashboardHeroProps {
  onNavigate: (tab: Tab) => void;
  onOpenImport: () => void;
  onOpenCreate: () => void;
  onOpenSettings?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastRefreshedTime?: string;
  metrics?: DashboardDbMetrics;
  runtimeInfo?: { version?: string; persistent?: boolean; ready?: boolean };
}

export const DashboardHero: React.FC<DashboardHeroProps> = ({
  onNavigate,
  onOpenImport,
  onOpenCreate,
  onOpenSettings,
  onRefresh,
  isRefreshing = false,
  lastRefreshedTime,
  metrics,
  runtimeInfo,
}) => {
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return '早上好';
    if (hour >= 12 && hour < 18) return '下午好';
    return '晚上好';
  }, []);

  const engineVersion = runtimeInfo?.version ? `v${runtimeInfo.version}` : 'v1.33.1';
  const dbName =
    metrics?.isPersistent && metrics?.databaseName === 'memory'
      ? 'main'
      : metrics?.databaseName || 'main';

  return (
    <div className={`relative w-full overflow-hidden shrink-0 ${DB.shell} p-3.5 group`}>
      {/* High-Fidelity Panoramic Alpine Sunrise Horizon SVG Atmosphere */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <svg
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.01]"
          viewBox="0 0 1200 140"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* 1. Panoramic Sky Twilight Gradient */}
            <linearGradient id="classic-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#050916" />
              <stop offset="35%" stopColor="#0a1329" />
              <stop offset="65%" stopColor="#162345" />
              <stop offset="85%" stopColor="#2d203a" />
              <stop offset="100%" stopColor="#6b343d" />
            </linearGradient>

            {/* 2. Sunrise Ambient Halo */}
            <radialGradient id="classic-sun-halo" cx="81.6%" cy="35.7%" r="45%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
              <stop offset="25%" stopColor="#fbbf24" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#f97316" stopOpacity="0.3" />
              <stop offset="80%" stopColor="#e11d48" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#050916" stopOpacity="0" />
            </radialGradient>

            {/* 3. Brilliant Sun Core */}
            <radialGradient id="classic-sun-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="40%" stopColor="#fffbeb" stopOpacity="1" />
              <stop offset="75%" stopColor="#fde047" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>

            {/* 4. Panoramic Crepuscular God Rays */}
            <linearGradient id="classic-ray-1" x1="0.816" y1="0.357" x2="0.68" y2="0">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.4" />
              <stop offset="60%" stopColor="#fbbf24" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="classic-ray-2" x1="0.816" y1="0.357" x2="0.78" y2="0">
              <stop offset="0%" stopColor="#fffbeb" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#fef08a" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="classic-ray-3" x1="0.816" y1="0.357" x2="0.92" y2="0">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.45" />
              <stop offset="70%" stopColor="#f97316" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="classic-ray-4" x1="0.816" y1="0.357" x2="1" y2="0.1">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </linearGradient>

            {/* 5. Rim Lighting for Crests */}
            <linearGradient id="classic-ridge-gold" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
              <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="60%" stopColor="#fbbf24" stopOpacity="0.85" />
              <stop offset="80%" stopColor="#fffbeb" stopOpacity="1" />
              <stop offset="92%" stopColor="#f59e0b" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ea580c" stopOpacity="0.8" />
            </linearGradient>

            <linearGradient id="classic-ridge-distant" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.3" />
              <stop offset="60%" stopColor="#fde047" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.6" />
            </linearGradient>

            {/* 6. Alpine Peaks Facets */}
            <linearGradient id="classic-far-lit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4d6185" />
              <stop offset="50%" stopColor="#2c3a54" />
              <stop offset="100%" stopColor="#141d2f" />
            </linearGradient>
            <linearGradient id="classic-far-shadow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#23314a" />
              <stop offset="50%" stopColor="#151e30" />
              <stop offset="100%" stopColor="#0a101c" />
            </linearGradient>

            {/* 7. Midground & Foreground Ridges */}
            <linearGradient id="classic-mid-mountain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#182642" />
              <stop offset="50%" stopColor="#0f182c" />
              <stop offset="100%" stopColor="#060a14" />
            </linearGradient>

            <linearGradient id="classic-fore-mountain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0b1220" />
              <stop offset="60%" stopColor="#070b14" />
              <stop offset="100%" stopColor="#04060c" />
            </linearGradient>

            {/* 8. Valley Mist Bands */}
            <linearGradient id="classic-mist-1" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
              <stop offset="30%" stopColor="#93c5fd" stopOpacity="0.15" />
              <stop offset="70%" stopColor="#fed7aa" stopOpacity="0.25" />
              <stop offset="85%" stopColor="#fde047" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="classic-mist-2" x1="0" y1="0" x2="1" y2="0">
              <stop offset="15%" stopColor="#38bdf8" stopOpacity="0" />
              <stop offset="60%" stopColor="#fef08a" stopOpacity="0.18" />
              <stop offset="88%" stopColor="#818cf8" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>

            {/* Soft Glow Filter */}
            <filter id="classic-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 1. Twilight Panoramic Sky */}
          <rect width="1200" height="140" fill="url(#classic-sky)" />

          {/* 2. Starfield & Data Navigation Constellation */}
          <circle cx="50" cy="18" r="1.1" fill="#fff" opacity="0.85" />
          <circle cx="120" cy="35" r="0.7" fill="#93c5fd" opacity="0.6" />
          <circle cx="190" cy="15" r="1.3" fill="#fff" opacity="0.9" />
          <circle cx="250" cy="30" r="0.8" fill="#bae6fd" opacity="0.5" />
          <circle cx="320" cy="12" r="1.4" fill="#fde047" opacity="0.9" />
          <circle cx="410" cy="24" r="0.9" fill="#93c5fd" opacity="0.75" />
          <circle cx="520" cy="16" r="1.2" fill="#fff" opacity="0.8" />
          <circle cx="630" cy="28" r="0.8" fill="#bae6fd" opacity="0.6" />
          <circle cx="710" cy="14" r="1.3" fill="#fde047" opacity="0.85" />
          <circle cx="830" cy="22" r="1" fill="#fff" opacity="0.7" />

          {/* Constellation Data Nodes & Links */}
          <line x1="190" y1="15" x2="250" y2="25" stroke="#38bdf8" strokeWidth="0.7" strokeDasharray="2 3" opacity="0.5" />
          <line x1="250" y1="25" x2="320" y2="12" stroke="#38bdf8" strokeWidth="0.7" strokeDasharray="2 3" opacity="0.5" />
          <circle cx="250" cy="25" r="1.2" fill="#38bdf8" opacity="0.9" />

          <line x1="630" y1="28" x2="710" y2="14" stroke="#38bdf8" strokeWidth="0.7" strokeDasharray="2 3" opacity="0.5" />
          <circle cx="630" cy="28" r="1.2" fill="#38bdf8" opacity="0.9" />

          {/* Twinkle Cross Stars */}
          <g transform="translate(320, 12)">
            <path d="M0,-4 L0,4 M-4,0 L4,0" stroke="#fef08a" strokeWidth="0.8" opacity="0.9" />
          </g>
          <g transform="translate(710, 14)">
            <path d="M0,-3.5 L0,3.5 M-3.5,0 L3.5,0" stroke="#ffffff" strokeWidth="0.7" opacity="0.85" />
          </g>

          {/* 3. Golden Dawn Sun (at x=980, y=50) */}
          <circle cx="980" cy="50" r="115" fill="url(#classic-sun-halo)" opacity="0.95" />

          {/* Crepuscular Rays */}
          <polygon points="980,50 780,0 840,0" fill="url(#classic-ray-1)" opacity="0.55" />
          <polygon points="980,50 890,0 950,0" fill="url(#classic-ray-2)" opacity="0.65" />
          <polygon points="980,50 1020,0 1090,0" fill="url(#classic-ray-3)" opacity="0.55" />
          <polygon points="980,50 1130,0 1200,15" fill="url(#classic-ray-4)" opacity="0.45" />

          {/* Sun Disc */}
          <circle cx="980" cy="50" r="24" fill="url(#classic-sun-core)" filter="url(#classic-glow)" />
          <circle cx="980" cy="50" r="8" fill="#ffffff" opacity="0.98" />

          {/* 4. Distant Alpine Peaks (Low on left, towering on right) */}
          <polygon points="260,95 340,65 390,95" fill="url(#classic-far-lit)" opacity="0.85" />
          <polygon points="180,95 260,74 300,95" fill="url(#classic-far-shadow)" opacity="0.8" />

          <polygon points="560,95 640,52 700,95" fill="url(#classic-far-lit)" opacity="0.9" />
          <polygon points="480,95 560,65 600,95" fill="url(#classic-far-shadow)" opacity="0.85" />
          <polyline points="480,95 560,65 640,52 700,95" fill="none" stroke="url(#classic-ridge-distant)" strokeWidth="1.2" strokeLinecap="round" />

          {/* Alpine Peak by the Sun */}
          <polygon points="930,95 955,34 990,95" fill="url(#classic-far-lit)" />
          <polygon points="860,95 930,50 955,95" fill="url(#classic-far-shadow)" />
          <polyline points="860,95 930,50 955,34 990,95" fill="none" stroke="url(#classic-ridge-distant)" strokeWidth="1.4" strokeLinecap="round" />

          <polygon points="1020,95 1070,44 1130,95" fill="url(#classic-far-lit)" opacity="0.9" />
          <polygon points="1080,95 1130,58 1180,95" fill="url(#classic-far-shadow)" opacity="0.85" />
          <polyline points="1020,95 1070,44 1130,95" fill="none" stroke="url(#classic-ridge-distant)" strokeWidth="1.2" strokeLinecap="round" />

          {/* 5. Valley Mist Layer 1 */}
          <path
            d="M150,82 Q420,68 700,78 T1200,72 L1200,98 L150,98 Z"
            fill="url(#classic-mist-1)"
          />

          {/* 6. Midground Sweeping Ridge with Golden Rim */}
          <path
            d="M0,118 L0,92 Q140,86 280,96 T560,82 Q720,64 880,56 T1060,62 Q1130,70 1200,58 L1200,130 L0,130 Z"
            fill="url(#classic-mid-mountain)"
          />
          <path
            d="M0,92 Q140,86 280,96 T560,82 Q720,64 880,56 T1060,62 Q1130,70 1200,58"
            fill="none"
            stroke="url(#classic-ridge-gold)"
            strokeWidth="1.7"
            strokeLinecap="round"
            filter="url(#classic-glow)"
            opacity="0.9"
          />

          {/* 7. Valley Mist Layer 2 */}
          <path
            d="M0,105 Q300,90 600,100 T1200,94 L1200,122 L0,122 Z"
            fill="url(#classic-mist-2)"
          />

          {/* 8. Foreground Foothills Silhouette */}
          <path
            d="M0,135 L0,108 Q180,98 360,110 T780,96 Q960,88 1080,102 T1200,92 L1200,140 L0,140 Z"
            fill="url(#classic-fore-mountain)"
          />
          <path
            d="M0,108 Q180,98 360,110 T780,96 Q960,88 1080,102 T1200,92"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="0.8"
            strokeOpacity="0.35"
            strokeLinecap="round"
          />
        </svg>

        {/* Soft vignette to guarantee button & text legibility in Monokai theme */}
        <div className="absolute inset-0 bg-gradient-to-r from-monokai-surface/80 via-monokai-surface/35 to-transparent pointer-events-none" />
      </div>

      <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 max-w-3xl flex-col gap-2.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={DB.iconBox}>
                <Database className="h-3.5 w-3.5 text-monokai-accent" />
              </span>
              <h1 className="text-sm font-semibold tracking-tight text-monokai-fg">
                {greeting}，欢迎使用{' '}
                <span className="text-monokai-accent">DuckDB Studio</span>
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 pl-9">
              <p className={DB.meta}>本地高性能分析数据库 · 简单、快速、开放</p>
              <span className="hidden text-monokai-border sm:inline" aria-hidden>
                |
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={DB.chip} title="当前连接数据库">
                  <HardDrive className="h-3 w-3 text-monokai-comment" />
                  <span>库: {dbName}</span>
                </span>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  title="点击查看或配置持久化模式"
                  className={`${DB.chip} hover:border-monokai-border-strong hover:text-monokai-fg ${DB.focus}`}
                >
                  <span
                    className={
                      metrics?.isPersistent ? DB.statusDotOk : DB.statusDotWarn
                    }
                  />
                  <span>{metrics?.modeLabel || '内存数据库'}</span>
                </button>
                <span className={DB.chip}>
                  <CheckCircle2 className="h-3 w-3 text-monokai-accent" />
                  <span>DuckDB {engineVersion} 就绪</span>
                </span>
              </div>
            </div>
          </div>

          {/* Primary path: SQL + core data ops. Module nav lives in QuickActions. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onNavigate(Tab.SQL)}
              className={`${DB.btnPrimary} ${DB.focus}`}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>打开 SQL 编辑器</span>
            </button>

            <button
              type="button"
              onClick={onOpenImport}
              className={`${DB.btnSecondary} ${DB.focus}`}
            >
              <Upload className="h-3.5 w-3.5 text-monokai-comment" />
              <span>导入数据</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreate}
              className={`${DB.btnSecondary} ${DB.focus}`}
            >
              <PlusSquare className="h-3.5 w-3.5 text-monokai-comment" />
              <span>新建数据集</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate(Tab.DATA)}
              className={`${DB.btnSecondary} ${DB.focus}`}
            >
              <Table className="h-3.5 w-3.5 text-monokai-comment" />
              <span>浏览数据</span>
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-monokai-border pt-2 lg:border-t-0 lg:pt-0">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`${DB.btnSecondary} ${DB.focus} text-monokai-fg-muted hover:text-monokai-fg`}
              title="手动刷新仪表盘数据统计"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-monokai-accent' : ''}`}
              />
              <span>{isRefreshing ? '刷新中…' : '刷新'}</span>
            </button>
          )}
          {lastRefreshedTime && (
            <span className={DB.sectionMeta}>同步于 {lastRefreshedTime}</span>
          )}
        </div>
      </div>
    </div>
  );
};
