/**
 * SkillHeader - Skill info header with icon, name, description, and context badges
 *
 * Part of the SkillInvoker refactor (formerly part of SkillInvoker.tsx).
 * Displays skill identity and current context (table, column count).
 */

import React from 'react';
import { Table, Columns, Hash } from 'lucide-react';
import { AISkill, SkillCategory } from '../../types';
import {
  CATEGORY_THEME,
} from '../theme/monokai';

interface SkillHeaderProps {
  skill: AISkill;
  currentTable?: string;
  currentColumns?: { name: string; type: string }[];
}

export const SkillHeader: React.FC<SkillHeaderProps> = ({
  skill,
  currentTable,
  currentColumns,
}) => {
  const theme = CATEGORY_THEME[skill.category];
  const c = theme.colors;

  return (
    <div className="flex items-start gap-4">
      {/* Skill icon - larger and more prominent */}
      <div
        className={[
          'w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0',
          'border-2',
        ].join(' ')}
        style={{
          background: `linear-gradient(135deg, ${c.primary}20, ${c.primary}08)`,
          borderColor: `${c.primary}40`,
        }}
      >
        <span className="text-3xl">{skill.icon || '✨'}</span>
      </div>

      {/* Skill name + description */}
      <div className="flex-1 min-w-0">
        {/* Skill name with category accent underline */}
        <div className="relative mb-1">
          <h2
            className="text-base font-bold text-monokai-fg leading-tight"
            style={{ color: c.primary }}
          >
            {skill.name}
          </h2>
        </div>

        {/* Description */}
        <p className="text-[11px] text-monokai-comment leading-relaxed mb-3">
          {skill.description}
        </p>

        {/* Context badges - enhanced with icons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category badge */}
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-semibold rounded-lg border"
            style={{
              background: `${c.primary}12`,
              color: c.primary,
              borderColor: `${c.primary}30`,
            }}
          >
            <span className="text-base leading-none">{theme.emoji}</span>
            {theme.label}
          </span>

          {currentTable && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-medium rounded-lg border"
              style={{
                background: 'rgba(253, 151, 31, 0.08)',
                color: '#fd971f',
                borderColor: 'rgba(253, 151, 31, 0.25)',
              }}
            >
              <Table className="w-3 h-3" />
              <span className="font-mono font-semibold">{currentTable}</span>
            </span>
          )}
          {currentColumns && currentColumns.length > 0 && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-medium rounded-lg border"
              style={{
                background: 'rgba(166, 226, 46, 0.08)',
                color: '#a6e22e',
                borderColor: 'rgba(166, 226, 46, 0.25)',
              }}
            >
              <Columns className="w-3 h-3" />
              <span className="font-mono font-semibold">{currentColumns.length}</span>
              <span className="opacity-70">列</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SkillHeader;
