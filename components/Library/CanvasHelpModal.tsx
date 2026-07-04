import React from 'react';
import { X, Check } from 'lucide-react';

interface CanvasHelpModalProps {
  show: boolean;
  onClose: () => void;
}

export const CanvasHelpModal: React.FC<CanvasHelpModalProps> = ({ show, onClose }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[500px] bg-[#12121e] border border-monokai-accent/20 rounded-2xl shadow-2xl p-6 overflow-hidden pointer-events-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-monokai-accent/10">
          <span className="text-sm font-bold text-slate-200">💡 画布重构版操作指南</span>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
        
        <div className="space-y-4 text-xs text-slate-300 leading-relaxed overflow-y-auto max-h-[60vh] custom-scrollbar pr-1">
          <p>
            重构后的<strong>高阶画布</strong>基于 <strong>React Flow</strong> 实现。这是一个高度优化的无环向导图（DAG）生成器，用于可视化构建数据提取、转换和输出的 SQL 流水线。
          </p>
          
          <div className="space-y-2">
            <h4 className="font-bold text-monokai-cyan">1. 画布控制</h4>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-400">
              <li><strong>拖拽画布</strong>：在空白处按住鼠标左键并拖拽以平移视口。</li>
              <li><strong>缩放视口</strong>：使用鼠标滚轮或双指在触摸板上缩放，或使用左下角缩放面板。</li>
              <li><strong>选择节点</strong>：单击选择节点，将激活属性编辑框；双击可直接定位到重要属性。</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-monokai-purple">2. 构建 DAG 管道</h4>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-400">
              <li><strong>增加节点</strong>：在顶部工具栏点击 Source/Transform/Filter/Sink，从弹出窗中选择物理对象即可实例化入场。</li>
              <li><strong>连接线</strong>：鼠标移到源节点 right Handle 上拖出一条线，连接到目标节点的 left Handle 即可创建依赖。</li>
              <li><strong>分组空间</strong>：新建 Group Space 框，可将任意节点拖入其中进行逻辑嵌套（联动移动）。</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-monokai-green">3. 实时 SQL 翻译机制</h4>
            <p className="text-slate-400 pl-2">
              任何节点、连线关系发生变动时，右下角的 SQL 编译预览看板都将实时生成 CTE (With 语法) 对齐的关系代码，支持一键直接载入 SQL 主编辑器执行。
            </p>
          </div>
        </div>
        
        <button onClick={onClose} className="mt-6 w-full py-2.5 bg-monokai-purple text-slate-900 rounded-xl font-bold hover:bg-monokai-purple/90 transition-all text-xs flex items-center justify-center gap-1.5">
          <Check className="w-4 h-4" /> 我明白了
        </button>
      </div>
    </div>
  );
};
