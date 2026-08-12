import type { CompositionNode, SemanticReconstruction } from './deductionTypes';

const treeLines = (node: CompositionNode, prefix = '', isLast = true): string[] => {
  const connector = prefix ? (isLast ? '└── ' : '├── ') : '';
  const line = `${prefix}${connector}${node.label}`;
  const childPrefix = `${prefix}${prefix ? (isLast ? '    ' : '│   ') : ''}`;
  return [line, ...node.children.flatMap((child, index) => treeLines(child, childPrefix, index === node.children.length - 1))];
};

export function formatDeductionMarkdown(result: SemanticReconstruction): string {
  const sections: string[] = [
    `## 1. 原始输入\n\n\`\`\`text\n${result.input}\n\`\`\``,
    `## 2. 特征\n\n${result.features.map(feature =>
      `- **${feature.id}**（${feature.classification === 'fact' ? '事实' : '判断'}；${feature.certainty === 'confirmed' ? '确定' : '待确认'}）：${feature.statement}\n  - 原文证据：${feature.evidence.map(item => `「${item.quote}」`).join('、')}`,
    ).join('\n')}`,
    `## 3. 关系\n\n${result.relations.length > 0 ? result.relations.map(relation =>
      `- **${relation.id}** ${relation.fromFeatureIds.join('+')} → ${relation.toFeatureIds.join('+')}：${relation.statement}${relation.operator ? `（${relation.operator}）` : ''}${relation.certainty === 'uncertain' ? '【待确认】' : ''}\n  - 原文证据：${relation.evidence.map(item => `「${item.quote}」`).join('、')}`,
    ).join('\n') : '- 未发现明确关系。'}`,
    `## 4. 结构\n\n\`\`\`text\n${treeLines(result.structure).join('\n')}\n\`\`\``,
    `## 5. 核心语义\n\n> ${result.coreMeaning.text}`,
  ];

  if (result.externalMappings) {
    sections.push(`## 6. 外部映射\n\n${result.externalMappings.map(mapping =>
      `- **对应对象：** ${mapping.correspondingObject || mapping.targetId}\n  - **对应内容：** ${mapping.correspondingContent || '未找到直接对应内容'}\n  - **匹配程度：** ${mapping.matchLevel}\n  - **依据：** ${mapping.basis ? `「${mapping.basis.quote}」` : '未找到直接对应内容'}\n  - **验证：** ${mapping.validationNote}`,
    ).join('\n')}`);
  }

  sections.push(`## 7. 一针见血解读\n\n> ${result.punchline.text}`);
  return `# 特征组合与语义还原结果\n\n${sections.join('\n\n')}`;
}
