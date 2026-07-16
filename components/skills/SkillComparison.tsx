/**
 * SkillComparison - Compare multiple skills side by side
 *
 * Shows detailed comparison of skill properties, usage stats, and outputs.
 */

import React, { useState, useMemo } from 'react';
import {
  GitCompare,
  X,
  CheckCircle2,
  AlertCircle,
  Star,
  Clock,
  Zap,
  ChevronDown,
  Columns,
} from 'lucide-react';
import { AISkill, SkillCategory } from '../../types';
import { CATEGORY_DESIGN, getSkillIcon } from '../theme/ai-skills';
import { findSimilarSkills } from '../../services/skillRegistry';
import { getSkillStat, isSkillFavorited, type SkillStats } from '../../services/skill/skillHistoryStorage';

interface SkillComparisonProps {
  skills: AISkill[];
  onClose: () => void;
  onSelectSkill?: (skill: AISkill) => void;
  className?: string;
}

export const SkillComparison: React.FC<SkillComparisonProps> = ({
  skills,
  onClose,
  onSelectSkill,
  className = '',
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Get stats for each skill
  const statsMap = useMemo(() => {
    const map: Record<string, SkillStats | null> = {};
    skills.forEach(skill => {
      map[skill.id] = getSkillStat(skill.id);
    });
    return map;
  }, [skills]);

  // Get similar skills for each skill
  const similarMap = useMemo(() => {
    const map: Record<string, AISkill[]> = {};
    skills.forEach(skill => {
      map[skill.id] = findSimilarSkills(skill.id, 3);
    });
    return map;
  }, [skills]);

  if (skills.length < 2) {
    return (
      <div className={`p-4 text-center text-monokai-comment ${className}`}>
        <GitCompare className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-xs">选择至少 2 个技能进行对比</p>
      </div>
    );
  }

  return (
    <div className={`bg-monokai-bg border border-monokai-accent rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-monokai-sidebar border-b border-monokai-accent">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-monokai-amethyst" />
          <span className="text-xs font-medium text-monokai-fg">技能对比</span>
          <span className="text-[10px] text-monokai-comment">{skills.length} 个技能</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-monokai-comment hover:text-monokai-fg transition-colors"
          >
            {showDetails ? '简化' : '详情'}
            <ChevronDown className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-monokai-comment hover:text-monokai-fg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Comparison grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-monokai-accent/30">
              <th className="text-left px-3 py-2 text-monokai-comment font-medium w-32">属性</th>
              {skills.map(skill => {
                const design = CATEGORY_DESIGN[skill.category];
                const Icon = getSkillIcon(skill.id);
                return (
                  <th key={skill.id} className="text-left px-3 py-2 min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 flex items-center justify-center border"
                        style={{
                          background: `${design?.colors.primary}20`,
                          borderColor: `${design?.colors.primary}40`,
                        }}
                      >
                        <Icon className="w-4 h-4" style={{ color: design?.colors.primary }} />
                      </div>
                      <div>
                        <div className="text-monokai-fg font-medium">{skill.name}</div>
                        <div className="text-[9px] text-monokai-comment">{design?.label}</div>
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-monokai-accent/20">
            {/* Description */}
            <tr>
              <td className="px-3 py-2 text-monokai-comment">描述</td>
              {skills.map(skill => (
                <td key={skill.id} className="px-3 py-2 text-monokai-fg">
                  <div className="line-clamp-2 text-[11px]">{skill.description}</div>
                </td>
              ))}
            </tr>

            {/* Requires Table */}
            <tr>
              <td className="px-3 py-2 text-monokai-comment">需要表</td>
              {skills.map(skill => (
                <td key={skill.id} className="px-3 py-2">
                  {skill.requiresTable ? (
                    <CheckCircle2 className="w-4 h-4 text-monokai-green" />
                  ) : (
                    <span className="text-monokai-comment">—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Requires Columns */}
            <tr>
              <td className="px-3 py-2 text-monokai-comment">需要列</td>
              {skills.map(skill => (
                <td key={skill.id} className="px-3 py-2">
                  {skill.requiresColumns ? (
                    <CheckCircle2 className="w-4 h-4 text-monokai-green" />
                  ) : (
                    <span className="text-monokai-comment">—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Favorite */}
            <tr>
              <td className="px-3 py-2 text-monokai-comment">已收藏</td>
              {skills.map(skill => (
                <td key={skill.id} className="px-3 py-2">
                  {isSkillFavorited(skill.id) ? (
                    <Star className="w-4 h-4 text-monokai-yellow fill-current" />
                  ) : (
                    <span className="text-monokai-comment">—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Usage Stats */}
            <tr>
              <td className="px-3 py-2 text-monokai-comment">使用次数</td>
              {skills.map(skill => {
                const stat = statsMap[skill.id];
                return (
                  <td key={skill.id} className="px-3 py-2 text-monokai-fg">
                    {stat ? (
                      <span className="font-mono">{stat.totalExecutions}次</span>
                    ) : (
                      <span className="text-monokai-comment">未使用</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Success Rate */}
            <tr>
              <td className="px-3 py-2 text-monokai-comment">成功率</td>
              {skills.map(skill => {
                const stat = statsMap[skill.id];
                return (
                  <td key={skill.id} className="px-3 py-2">
                    {stat && stat.totalExecutions > 0 ? (
                      <span className={`font-mono ${
                        (stat.successCount / stat.totalExecutions) >= 0.8
                          ? 'text-monokai-green'
                          : (stat.successCount / stat.totalExecutions) >= 0.5
                          ? 'text-monokai-yellow'
                          : 'text-monokai-red'
                      }`}>
                        {Math.round((stat.successCount / stat.totalExecutions) * 100)}%
                      </span>
                    ) : (
                      <span className="text-monokai-comment">—</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Avg Duration */}
            <tr>
              <td className="px-3 py-2 text-monokai-comment">平均耗时</td>
              {skills.map(skill => {
                const stat = statsMap[skill.id];
                return (
                  <td key={skill.id} className="px-3 py-2 text-monokai-fg">
                    {stat && stat.totalExecutions > 0 ? (
                      <span className="font-mono">
                        {Math.round(stat.totalDuration / stat.totalExecutions / 1000)}s
                      </span>
                    ) : (
                      <span className="text-monokai-comment">—</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Similar Skills (shown in detail mode) */}
            {showDetails && skills.map(skill => (
              <tr key={`similar-${skill.id}`}>
                <td className="px-3 py-2 text-monokai-comment">相似技能</td>
                {skills.map(s => {
                  const isCurrentSkill = s.id === skill.id;
                  if (!isCurrentSkill) return <td key={s.id} />;
                  
                  const similar = similarMap[skill.id] || [];
                  return (
                    <td key={skill.id} className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {similar.slice(0, 3).map(sim => (
                          <button
                            key={sim.id}
                            onClick={() => onSelectSkill?.(sim)}
                            className="px-1.5 py-0.5 text-[9px] bg-monokai-bg border border-monokai-accent/30 text-monokai-comment hover:text-monokai-amethyst hover:border-monokai-amethyst/40 rounded transition-colors"
                          >
                            {sim.name}
                          </button>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="px-4 py-2 border-t border-monokai-accent flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-[10px] border border-monokai-accent text-monokai-comment hover:text-monokai-fg hover:border-monokai-fg rounded transition-colors"
        >
          关闭
        </button>
        {skills.length === 2 && onSelectSkill && (
          <button
            onClick={() => onSelectSkill(skills[0])}
            className="px-3 py-1.5 text-[10px] bg-monokai-amethyst text-monokai-surface hover:bg-monokai-amethyst/80 rounded transition-colors"
          >
            使用第一个
          </button>
        )}
      </div>
    </div>
  );
};

export default SkillComparison;
