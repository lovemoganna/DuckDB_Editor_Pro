/**
 * SpotlightSearch - Global AI Skill Search
 * 
 * Floating command palette specifically for AI Skills.
 * Triggered via Cmd+J or standard focus.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Search, Sparkles, Command } from 'lucide-react';
import { useSkillStore } from './store/useSkillStore';
import { AISkill } from '../../types';
import { searchSkills, getAllSkills } from '../../services/skillRegistry';

export const SpotlightSearch: React.FC = () => {
  const isSpotlightActive = useSkillStore(state => state.isSpotlightActive);
  const setIsSpotlightActive = useSkillStore(state => state.setIsSpotlightActive);
  const setSelectedSkill = useSkillStore(state => state.setSelectedSkill);
  
  const [localQuery, setLocalQuery] = useState('');
  const [results, setResults] = useState<AISkill[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut (Cmd+J)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setIsSpotlightActive(true);
      }
      if (e.key === 'Escape' && isSpotlightActive) {
        setIsSpotlightActive(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSpotlightActive, setIsSpotlightActive]);

  // Focus input when activated
  useEffect(() => {
    if (isSpotlightActive) {
      setLocalQuery('');
      setResults(getAllSkills().slice(0, 5));
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isSpotlightActive]);

  // Handle local searching
  useEffect(() => {
    if (localQuery.trim() === '') {
      setResults(getAllSkills().slice(0, 5));
    } else {
      setResults(searchSkills(localQuery).slice(0, 8));
    }
    setSelectedIndex(0);
  }, [localQuery]);

  const executeSelection = (skill: AISkill) => {
    setSelectedSkill(skill);
    setIsSpotlightActive(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        executeSelection(results[selectedIndex]);
      }
    }
  };

  if (!isSpotlightActive) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={() => setIsSpotlightActive(false)} />
      
      <div className="relative w-full max-w-2xl bg-monokai-bg border border-monokai-accent shadow-2xl rounded-lg overflow-hidden flex flex-col">
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-monokai-accent/50 bg-monokai-sidebar">
          <Search className="w-5 h-5 text-monokai-comment flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none text-monokai-fg px-3 py-2 text-lg focus:outline-none placeholder-monokai-comment"
            placeholder="搜寻 AI 赋能指令... (例如: 查询重复数据)"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <div className="flex items-center gap-1 opacity-50">
            <kbd className="px-2 py-1 rounded bg-monokai-bg text-monokai-comment text-xs font-mono border border-monokai-accent/30 flex items-center gap-1">
              <Command className="w-3 h-3" /> J
            </kbd>
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto custom-scrollbar p-2">
          {results.length === 0 ? (
            <div className="p-8 text-center text-monokai-comment flex flex-col items-center">
              <Sparkles className="w-8 h-8 mb-3 opacity-30" />
              <p>未能找到相关技能</p>
            </div>
          ) : (
            results.map((skill, idx) => (
              <div
                key={skill.id}
                onClick={() => executeSelection(skill)}
                className={`flex items-center gap-3 p-3 cursor-pointer border-l-2 transition-all duration-150 ${
                  idx === selectedIndex 
                    ? 'border-monokai-blue bg-monokai-accent/20' 
                    : 'border-transparent hover:bg-monokai-sidebar/50'
                }`}
              >
                <div className="w-8 h-8 rounded bg-monokai-sidebar/80 flex items-center justify-center flex-shrink-0 border border-monokai-accent/30">
                  <span className="text-xl">{skill.icon || '⚡'}</span>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-monokai-fg">{skill.name}</h4>
                  <p className="text-xs text-monokai-comment truncate max-w-lg mt-0.5">{skill.description}</p>
                </div>
                <div className="ml-auto text-[10px] uppercase font-mono text-monokai-comment px-2 py-0.5 rounded bg-monokai-sidebar border border-monokai-accent/20">
                  {skill.category}
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Footer */}
        <div className="bg-monokai-sidebar/80 px-4 py-2 border-t border-monokai-accent/30 flex items-center justify-between text-xs text-monokai-comment">
          <span>用 <span className="font-mono">↑</span> <span className="font-mono">↓</span> 导航，<span className="font-mono">Enter</span> 选择</span>
          <span>按 <span className="font-mono">Esc</span> 退出聚光灯</span>
        </div>
      </div>
    </div>
  );
};
