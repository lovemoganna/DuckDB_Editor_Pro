/**
 * OntologyReverseTutorialCard.tsx
 * 本体检视器反查对应教程/沉淀资产卡片
 * 
 * 作用：从本体节点动态反查相关的教程、代码片段与踩坑笔记
 */

import React, { useMemo } from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';
import { getAllKnowledgeAssets } from '../KnowledgeHub/services/knowledgeAssetStorage';
import { KnowledgeAsset } from '../KnowledgeHub/types';

export interface ReverseTutorialItem {
  assetId: string;
  title: string;
  type: string;
  summary?: string;
  matchedKeywords: string[];
  relevanceScore: number;
}

interface OntologyReverseTutorialCardProps {
  target: any;
  mode: string;
  onNavigateToAsset?: (assetId: string) => void;
}

export const OntologyReverseTutorialCard: React.FC<OntologyReverseTutorialCardProps> = ({
  target,
  mode: _mode,
  onNavigateToAsset,
}) => {
  const [allAssets, setAllAssets] = React.useState<KnowledgeAsset[]>([]);

  React.useEffect(() => {
    getAllKnowledgeAssets().then(data => setAllAssets(data)).catch(() => {});
  }, []);

  const relatedItems = useMemo<ReverseTutorialItem[]>(() => {
    if (!target || allAssets.length === 0) return [];
    const targetName = (target.name || '').toLowerCase();
    let targetProps = '';
    if (target.properties) {
      targetProps = typeof target.properties === 'string' ? target.properties : JSON.stringify(target.properties);
    }
    const cleanProps = targetProps.toLowerCase();

    const matches: ReverseTutorialItem[] = [];

    allAssets.forEach(asset => {
      const title = (asset.type === 'metric' ? asset.name : asset.title).toLowerCase();
      const summary = (asset.type === 'note' ? asset.summary : (asset as any).description || '').toLowerCase();
      const tags = (asset.tags || []).map(t => t.toLowerCase());

      const matchedKeywords: string[] = [];
      let score = 0;

      if (targetName && title.includes(targetName)) {
        score += 10;
        matchedKeywords.push(target.name);
      }

      if (targetName && targetName.length > 2 && summary.includes(targetName)) {
        score += 5;
        matchedKeywords.push(target.name);
      }

      tags.forEach(t => {
        if (targetName.includes(t) || cleanProps.includes(t)) {
          score += 3;
          matchedKeywords.push(t);
        }
      });

      if (cleanProps.includes(asset.id.toLowerCase())) {
        score += 15;
        matchedKeywords.push(asset.id);
      }

      if (score > 0) {
        matches.push({
          assetId: asset.id,
          title: asset.type === 'metric' ? asset.name : asset.title,
          type: asset.type,
          summary: asset.type === 'note' ? asset.summary : (asset as any).description,
          matchedKeywords: Array.from(new Set(matchedKeywords)),
          relevanceScore: score,
        });
      }
    });

    return matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }, [target, allAssets]);

  const handleJump = (assetId: string) => {
    if (onNavigateToAsset) {
      onNavigateToAsset(assetId);
    } else {
      window.dispatchEvent(
        new CustomEvent('duckdb_jump_to_knowledge_asset', {
          detail: { assetId },
        }),
      );
    }
  };

  if (!target || relatedItems.length === 0) {
    return (
      <div className="rounded-md border border-monokai-border bg-monokai-surface/60 p-2.5 text-xs font-sans">
        <div className="flex items-center gap-1.5 text-monokai-comment font-semibold text-[11px] mb-1">
          <BookOpen className="w-3.5 h-3.5" />
          <span>关联知识与沉淀笔记</span>
        </div>
        <p className="text-[10.5px] text-monokai-comment italic">
          该概念暂无直接绑定的教程或沉淀笔记。可在知识中心新建笔记并关联至此。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-monokai-border bg-monokai-surface/60 p-2.5 text-xs font-sans">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-monokai-fg font-semibold text-[11px]">
          <BookOpen className="w-3.5 h-3.5 text-monokai-cyan" />
          <span>关联知识与沉淀笔记</span>
        </div>
        <span className="text-[10px] font-mono text-monokai-cyan bg-monokai-cyan/10 px-1.5 py-0.2 rounded border border-monokai-cyan/30">
          {relatedItems.length} 篇相关
        </span>
      </div>

      <div className="space-y-1.5">
        {relatedItems.slice(0, 3).map(item => (
          <button
            key={item.assetId}
            type="button"
            onClick={() => handleJump(item.assetId)}
            className="w-full text-left p-2 rounded bg-monokai-elevated hover:bg-monokai-hover border border-monokai-border/80 transition-colors group cursor-pointer flex items-center justify-between gap-2"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-mono text-[9.5px] px-1 py-0.2 rounded bg-monokai-bg text-monokai-comment border border-monokai-border/60 uppercase">
                  {item.type}
                </span>
                <span className="text-[11px] font-semibold text-monokai-fg-muted group-hover:text-monokai-fg truncate">
                  {item.title}
                </span>
              </div>
              {item.summary && (
                <p className="text-[10px] text-monokai-comment truncate">
                  {item.summary}
                </p>
              )}
            </div>
            <ExternalLink className="w-3 h-3 text-monokai-comment group-hover:text-monokai-cyan shrink-0 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
};
