import React from 'react';
import { ArrowRight, Database, FileInput, Layers3, SquareTerminal, ChartNoAxesCombined, HardDrive } from 'lucide-react';

interface WorkspaceWelcomeProps {
  hasTables: boolean;
  onImport: () => void;
  onNewQuery: () => void;
  onManageDatabases: () => void;
}

/** An honest first-run state: explain the workflow without inventing data. */
export const WorkspaceWelcome: React.FC<WorkspaceWelcomeProps> = ({ hasTables, onImport, onNewQuery, onManageDatabases }) => (
  <section className="workspace-welcome" aria-labelledby="workspace-welcome-title">
    <div className="welcome-intro">
      <div className="welcome-eyebrow"><span /> YOUR DATA. YOUR WORKSPACE.</div>
      <h2 id="workspace-welcome-title">{hasTables ? <>结构已就绪，<br /><em>让数据入场。</em></> : <>从数据，<br /><em>走向洞察。</em></>}</h2>
      <p className="welcome-description">把文件变成可探索的数据，用 SQL 找到答案，<br className="hidden sm:block" />再将值得保留的发现，汇成你的分析工作台。</p>
      <div className="welcome-actions">
        <button type="button" className="welcome-primary" onClick={onImport}><FileInput size={17} aria-hidden="true" />导入数据<ArrowRight size={17} aria-hidden="true" /></button>
        <button type="button" className="welcome-secondary" onClick={onNewQuery}><SquareTerminal size={17} aria-hidden="true" />新建查询</button>
      </div>
      <p className="welcome-file-hint">CSV / Excel / JSON / Parquet · 在浏览器中探索</p>
    </div>

    <div className="welcome-diagram" aria-hidden="true">
      <div className="welcome-orbit welcome-orbit-outer" /><div className="welcome-orbit welcome-orbit-inner" />
      <svg className="welcome-connections" viewBox="0 0 480 360" fill="none"><path d="M80 105 H185 Q240 105 240 170 V195 Q240 255 300 255 H400" /><path d="M80 255 H180 Q240 255 240 195 V170 Q240 105 300 105 H400" /></svg>
      <div className="welcome-node welcome-node-source"><Database size={21} /><span>DATA</span><div className="welcome-node-lines"><i /><i /><i /></div></div>
      <div className="welcome-node welcome-node-file"><Layers3 size={21} /><span>FILES</span></div>
      <div className="welcome-query"><SquareTerminal size={26} /><span>SQL</span><small>探索 · 理解 · 连接</small></div>
      <div className="welcome-node welcome-node-chart"><ChartNoAxesCombined size={26} /><span>INSIGHT</span></div>
      <div className="welcome-node welcome-node-board"><span className="welcome-board-grid"><i /><i /><i /><i /></span><span>WORKSPACE</span></div>
      <span className="welcome-diagram-caption">从一份数据，到一个答案</span>
    </div>

    <div className="welcome-workflow" aria-label="分析工作流程">
      <div className="welcome-step"><span className="welcome-step-number">01</span><div><h3>连接你的数据</h3><p>导入本地文件，或挂载已有数据库。</p></div><FileInput size={20} aria-hidden="true" /></div>
      <div className="welcome-step"><span className="welcome-step-number">02</span><div><h3>提出一个好问题</h3><p>查询、筛选与透视，逐步理解数据。</p></div><SquareTerminal size={20} aria-hidden="true" /></div>
      <div className="welcome-step"><span className="welcome-step-number">03</span><div><h3>让发现成为资产</h3><p>保存查询与图表，构建可复用的分析。</p></div><ChartNoAxesCombined size={20} aria-hidden="true" /></div>
    </div>

    <div className="welcome-footer"><span><HardDrive size={15} aria-hidden="true" />从已有数据库继续</span><button type="button" onClick={onManageDatabases}>打开数据库管理<ArrowRight size={15} aria-hidden="true" /></button></div>
  </section>
);
