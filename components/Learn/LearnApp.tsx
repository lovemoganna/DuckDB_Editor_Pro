/**
 * LearnApp.tsx - 知识沉淀顶层包装器 (兼容退役重定向至全新的 KnowledgeHubApp)
 */
import React from 'react';
import { KnowledgeHubApp, KnowledgeHubAppProps } from '../KnowledgeHub';

export type LearnAppProps = KnowledgeHubAppProps;

export const LearnApp: React.FC<LearnAppProps> = (props) => {
  return <KnowledgeHubApp {...props} />;
};

export default LearnApp;
