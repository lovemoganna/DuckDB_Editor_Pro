/**
 * EdgePropertyDialog - 连线属性编辑对话框
 * 
 * MECE设计原则：
 * - 互斥性：每个属性编辑操作独立
 * - 穷尽性：覆盖所有连线属性编辑场景
 * 
 * 功能范围：
 * - 连线标签编辑
 * - 连线权重调整 (0-1滑块)
 * - 连线颜色选择
 * - 动画开关
 * - 连线类型选择
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  X,
  Check,
  Link2,
  Palette,
  Gauge,
  Zap,
  Layers,
  RotateCcw,
  Trash2,
  Loader2,
} from 'lucide-react';

// ============================================================
// Types & Interfaces
// ============================================================

/** 连线类型 */
export interface LinkType {
  id: number;
  name: string;
  color: string;
}

/** 连线属性 */
export interface EdgeProperties {
  id: string;
  label: string;
  weight: number;
  color: string;
  animated: boolean;
  linkTypeId: number;
}

/** 连线属性更新 */
export interface EdgePropertyUpdates {
  label?: string;
  weight?: number;
  color?: string;
  animated?: boolean;
  linkTypeId?: number;
}

/** 对话框属性 */
export interface EdgePropertyDialogProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 当前连线属性 */
  edge: EdgeProperties | null;
  /** 可用的连线类型 */
  linkTypes: LinkType[];
  /** 保存回调 */
  onSave: (edgeId: string, updates: EdgePropertyUpdates) => void;
  /** 删除回调 */
  onDelete?: (edgeId: string) => void;
  /** 关闭回调 */
  onClose: () => void;
}

// ============================================================
// Constants
// ============================================================

/** 预设颜色选项 */
const PRESET_COLORS = [
  { id: 'default', color: '#64748b', label: '默认灰' },
  { id: 'cyan', color: '#06b6d4', label: '青色' },
  { id: 'blue', color: '#3b82f6', label: '蓝色' },
  { id: 'green', color: '#10b981', label: '绿色' },
  { id: 'yellow', color: '#eab308', label: '黄色' },
  { id: 'orange', color: '#f97316', label: '橙色' },
  { id: 'pink', color: '#ec4899', label: '粉色' },
  { id: 'purple', color: '#8b5cf6', label: '紫色' },
  { id: 'red', color: '#ef4444', label: '红色' },
  { id: 'teal', color: '#14b8a6', label: '青色' },
];

/** 权重预设 */
const WEIGHT_PRESETS = [
  { value: 0.1, label: '极弱' },
  { value: 0.25, label: '弱' },
  { value: 0.5, label: '中等' },
  { value: 0.75, label: '强' },
  { value: 1.0, label: '极强' },
];

// ============================================================
// Sub-Components
// ============================================================

/** 颜色选择器项 */
interface ColorSwatchProps {
  color: string;
  label?: string;
  isSelected: boolean;
  onClick: () => void;
}

const ColorSwatch: React.FC<ColorSwatchProps> = ({ color, label, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`
      relative w-8 h-8 rounded-lg transition-all duration-150
      hover:scale-110 hover:ring-2 hover:ring-white/50
      ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-monokai-bg scale-110' : ''}
    `}
    style={{ backgroundColor: color }}
    title={label || color}
  >
    {isSelected && (
      <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow-lg" />
    )}
  </button>
);

/** 滑块组件 */
interface WeightSliderProps {
  value: number;
  onChange: (value: number) => void;
}

const WeightSlider: React.FC<WeightSliderProps> = ({ value, onChange }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-xs text-monokai-comment">权重</span>
      <span className="text-xs font-mono text-monokai-accent">{value.toFixed(2)}</span>
    </div>
    <input
      type="range"
      min="0"
      max="1"
      step="0.05"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="
        w-full h-2 bg-monokai-bg rounded-full appearance-none cursor-pointer
        [&::-webkit-slider-thumb]:appearance-none
        [&::-webkit-slider-thumb]:w-4
        [&::-webkit-slider-thumb]:h-4
        [&::-webkit-slider-thumb]:rounded-full
        [&::-webkit-slider-thumb]:bg-monokai-accent
        [&::-webkit-slider-thumb]:cursor-pointer
        [&::-webkit-slider-thumb]:shadow-lg
        [&::-webkit-slider-thumb]:transition-transform
        [&::-webkit-slider-thumb]:hover:scale-110
      "
      style={{
        background: `linear-gradient(to right, var(--monokai-accent) 0%, var(--monokai-accent) ${value * 100}%, var(--monokai-bg) ${value * 100}%, var(--monokai-bg) 100%)`,
      }}
    />
    <div className="flex justify-between text-[10px] text-monokai-comment">
      <span>弱</span>
      <span>强</span>
    </div>
  </div>
);

/** 切换开关 */
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label, description }) => (
  <label className="flex items-center justify-between cursor-pointer">
    <div>
      <div className="text-xs text-monokai-fg">{label}</div>
      {description && (
        <div className="text-[10px] text-monokai-comment">{description}</div>
      )}
    </div>
    <div
      onClick={() => onChange(!checked)}
      className={`
        relative w-10 h-5 rounded-full transition-colors duration-200
        ${checked ? 'bg-monokai-accent' : 'bg-monokai-border'}
      `}
    >
      <div
        className={`
          absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md
          transition-transform duration-200
          ${checked ? 'translate-x-5' : 'translate-x-0.5'}
        `}
      />
    </div>
  </label>
);

// ============================================================
// Main Component
// ============================================================

export const EdgePropertyDialog: React.FC<EdgePropertyDialogProps> = ({
  isOpen,
  edge,
  linkTypes,
  onSave,
  onDelete,
  onClose,
}) => {
  // 本地状态
  const [label, setLabel] = useState('');
  const [weight, setWeight] = useState(0.5);
  const [color, setColor] = useState('#64748b');
  const [animated, setAnimated] = useState(false);
  const [linkTypeId, setLinkTypeId] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 同步外部属性到本地状态
  useEffect(() => {
    if (edge) {
      setLabel(edge.label || '');
      setWeight(edge.weight ?? 0.5);
      setColor(edge.color || '#64748b');
      setAnimated(edge.animated ?? false);
      setLinkTypeId(edge.linkTypeId || 0);
    }
  }, [edge]);

  // 检测变化
  const hasChanges = edge && (
    label !== (edge.label || '') ||
    weight !== (edge.weight ?? 0.5) ||
    color !== (edge.color || '#64748b') ||
    animated !== (edge.animated ?? false) ||
    linkTypeId !== (edge.linkTypeId || 0)
  );

  // 保存处理
  const handleSave = useCallback(async () => {
    if (!edge) return;
    
    setIsSaving(true);
    try {
      await onSave(edge.id, {
        label: label.trim() || undefined,
        weight,
        color,
        animated,
        linkTypeId: linkTypeId || undefined,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  }, [edge, label, weight, color, animated, linkTypeId, onSave, onClose]);

  // 删除处理
  const handleDelete = useCallback(async () => {
    if (!edge || !onDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete(edge.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  }, [edge, onDelete, onClose]);

  // 重置处理
  const handleReset = useCallback(() => {
    setLabel(edge?.label || '');
    setWeight(0.5);
    setColor('#64748b');
    setAnimated(false);
    setLinkTypeId(edge?.linkTypeId || 0);
  }, [edge]);

  // ESC键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !edge) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 对话框 */}
      <div className="
        fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101]
        w-[420px] max-h-[85vh] flex flex-col
        bg-monokai-sidebar border border-monokai-border rounded-2xl
        shadow-2xl overflow-hidden
        animate-in fade-in zoom-in-95 duration-200
      ">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-monokai-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-monokai-cyan/20 flex items-center justify-center">
              <Link2 className="w-4 h-4 text-monokai-cyan" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-monokai-fg">编辑关系属性</h2>
              <p className="text-[10px] text-monokai-comment">ID: {edge.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
          
          {/* 连线类型 */}
          {linkTypes.length > 0 && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-monokai-fg font-medium">
                <Layers className="w-4 h-4 text-monokai-comment" />
                关系类型
              </label>
              <div className="grid grid-cols-2 gap-2">
                {linkTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setLinkTypeId(type.id)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left
                      ${linkTypeId === type.id
                        ? 'border-monokai-accent bg-monokai-accent/10 text-monokai-accent'
                        : 'border-monokai-border text-monokai-fg hover:border-monokai-border-strong'
                      }
                    `}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: type.color || '#64748b' }}
                    />
                    <span className="text-xs truncate">{type.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 标签编辑 */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-monokai-fg font-medium">
              <Link2 className="w-4 h-4 text-monokai-comment" />
              关系标签
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="输入关系标签..."
              className="
                w-full px-3 py-2 rounded-lg
                bg-monokai-bg border border-monokai-border
                text-xs text-monokai-fg placeholder-monokai-comment/60
                focus:outline-none focus:border-monokai-accent
                transition-colors
              "
            />
            <p className="text-[10px] text-monokai-comment">
              标签将显示在连线中央
            </p>
          </div>

          {/* 颜色选择 */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-monokai-fg font-medium">
              <Palette className="w-4 h-4 text-monokai-comment" />
              连线颜色
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((preset) => (
                <ColorSwatch
                  key={preset.id}
                  color={preset.color}
                  label={preset.label}
                  isSelected={color === preset.color}
                  onClick={() => setColor(preset.color)}
                />
              ))}
            </div>
            {/* 自定义颜色输入 */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-monokai-comment">自定义:</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-monokai-border bg-transparent"
              />
              <span className="text-[10px] font-mono text-monokai-comment">{color}</span>
            </div>
            {/* 预览 */}
            <div className="mt-2 h-2 rounded-full transition-colors" style={{ backgroundColor: color }} />
          </div>

          {/* 权重调整 */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs text-monokai-fg font-medium">
              <Gauge className="w-4 h-4 text-monokai-comment" />
              关系权重
            </label>
            <WeightSlider value={weight} onChange={setWeight} />
            {/* 预设快捷选择 */}
            <div className="flex flex-wrap gap-1.5">
              {WEIGHT_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setWeight(preset.value)}
                  className={`
                    px-2 py-1 rounded text-[10px] transition-all
                    ${weight === preset.value
                      ? 'bg-monokai-accent/20 text-monokai-accent border border-monokai-accent/30'
                      : 'bg-monokai-bg text-monokai-comment border border-monokai-border hover:text-monokai-fg'
                    }
                  `}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* 动画开关 */}
          <div className="space-y-2">
            <ToggleSwitch
              checked={animated}
              onChange={setAnimated}
              label="连线动画"
              description="启用后连线将有流动效果"
            />
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="px-4 py-3 border-t border-monokai-border bg-monokai-bg/50">
          <div className="flex items-center justify-between">
            {/* 左侧: 删除按钮 */}
            <div>
              {onDelete && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                    text-xs text-monokai-danger hover:bg-monokai-danger/10
                    transition-colors disabled:opacity-50
                  "
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  删除连线
                </button>
              )}
            </div>

            {/* 右侧: 取消 + 重置 + 保存 */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                disabled={!hasChanges}
                className="
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                  text-xs text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface
                  transition-colors disabled:opacity-40
                "
              >
                <RotateCcw className="w-3.5 h-3.5" />
                重置
              </button>
              <button
                onClick={onClose}
                className="
                  px-3 py-1.5 rounded-lg
                  text-xs text-monokai-comment hover:text-monokai-fg hover:bg-monokai-surface
                  transition-colors
                "
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="
                  flex items-center gap-1.5 px-4 py-1.5 rounded-lg
                  bg-monokai-accent text-monokai-bg text-xs font-medium
                  hover:brightness-110 transition-all
                  disabled:opacity-50
                "
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EdgePropertyDialog;
