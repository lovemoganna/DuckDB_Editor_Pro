import React from 'react';
import { X, Plus, Sparkles } from 'lucide-react';
import { NodeType } from './CanvasTopologyManager';

interface CanvasObjectPickerProps {
  show: boolean;
  onClose: () => void;
  pickerNodeType: NodeType;
  objects: any[];
  objectTypes: any[];
  onSelectObject: (objectId: number) => void;
  onSelectPipeline?: (objectId: number) => void;
}

export const CanvasObjectPicker: React.FC<CanvasObjectPickerProps> = ({
  show,
  onClose,
  pickerNodeType,
  objects,
  objectTypes,
  onSelectObject,
  onSelectPipeline
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[440px] bg-[#12121e] border border-monokai-accent/20 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-monokai-accent/10 flex items-center justify-between bg-monokai-sidebar/35">
          <div>
            <span className="text-sm font-bold text-slate-200">关联物理对象到画布</span>
            <p className="text-[10px] text-slate-400 mt-1">选择一个数据库或本体对象绑定到新建的 {pickerNodeType} 节点</p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="max-h-[360px] overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {objects.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              物理本体库为空，请先在“实体库”中创建对象。
            </div>
          ) : (
            objects.map(obj => (
              <div
                key={obj.id}
                className="w-full px-4 py-3 rounded-xl bg-slate-800/35 border border-slate-700/60 flex items-center justify-between hover:border-slate-600 transition-all"
              >
                <div>
                  <span className="text-xs font-bold text-slate-200 block">{obj.name}</span>
                  <span className="text-[9px] text-monokai-purple/80 bg-monokai-purple/10 px-1.5 py-0.5 rounded mt-1.5 inline-block">
                    {objectTypes.find((ot: any) => ot.id === obj.object_type_id)?.name || '未定义类型'}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  {onSelectPipeline && (
                    <button
                      onClick={() => onSelectPipeline(obj.id)}
                      className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-monokai-purple/10 border border-monokai-purple/20 hover:bg-monokai-purple/25 text-monokai-purple flex items-center gap-1 transition-all"
                      title="自动创建 Source -> Transform -> Filter -> Sink 完整流程"
                    >
                      <Sparkles className="w-3 h-3" />
                      全流水线
                    </button>
                  )}
                  <button
                    onClick={() => onSelectObject(obj.id)}
                    className="p-1.5 text-xs font-bold rounded-lg bg-monokai-cyan/15 hover:bg-monokai-cyan/25 border border-monokai-cyan/20 text-monokai-cyan flex items-center gap-1 transition-all"
                    title="添加单个源节点"
                  >
                    <Plus className="w-4 h-4" />
                    单节点
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
