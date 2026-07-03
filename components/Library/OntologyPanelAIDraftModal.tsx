import React, { useState } from 'react';
import { Sparkles, Table2, Link2, Zap, Loader2, Check, X } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql as sqlLang } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { duckDBService } from '../../services/duckdbService';
import { validateDraftPayload } from '../../services/ontology/ontologyStorage';
import { ToastNotification } from '../ui/ToastNotification';

interface AIDraftModalProps {
  payload: any;
  jsonStr: string;
  onCommit: () => void;
  onCancel: () => void;
}

const AIDraftModal: React.FC<AIDraftModalProps> = ({ payload, jsonStr, onCommit, onCancel }) => {
  const [committing, setCommitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleCommit = async () => {
    setCommitting(true);
    try {
      const { valid, errors } = validateDraftPayload(payload);
      if (!valid) {
        setToast({ message: `数据验证失败: ${errors.join(', ')}`, type: 'error' });
        return;
      }
      await duckDBService.executeOntologyDraft(payload);
      onCommit();
    } catch (e: any) {
      setToast({ message: `提交失败: ${e.message}`, type: 'error' });
    } finally {
      setCommitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="w-[720px] max-h-[85vh] bg-monokai-bg border border-monokai-accent/20 rounded-2xl shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-6 py-5 border-b border-monokai-accent/10">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-monokai-purple/15 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-monokai-purple" />
              </div>
              <div>
                <h3 className="text-base font-bold text-monokai-fg">AI 生成预览</h3>
                <p className="text-xs text-monokai-comment mt-1">请审核并确认即将注入图谱的新知数据</p>
              </div>
            </div>
            <button onClick={onCancel} className="p-2 rounded-xl hover:bg-monokai-accent/10 text-monokai-comment hover:text-monokai-fg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-4 border-b border-monokai-accent/10 bg-monokai-sidebar/30 flex items-center gap-6 text-sm">
            {payload.objects?.length > 0 && <span className="text-monokai-blue flex items-center gap-2"><Table2 className="w-4 h-4" /> 对象 × {payload.objects.length}</span>}
            {payload.links?.length > 0 && <span className="text-monokai-purple flex items-center gap-2"><Link2 className="w-4 h-4" /> 关系 × {payload.links.length}</span>}
            {payload.actions?.length > 0 && <span className="text-monokai-yellow flex items-center gap-2"><Zap className="w-4 h-4" /> 行动 × {payload.actions.length}</span>}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <CodeMirror
              value={jsonStr}
              height="400px"
              theme={monokai}
              extensions={[sqlLang(), EditorView.lineWrapping, EditorView.theme({ "&": { fontSize: "14px" } })]}
              editable={false}
              basicSetup={false}
            />
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-monokai-accent/10">
            <button onClick={onCancel} className="px-5 py-2.5 text-sm rounded-xl text-monokai-comment hover:text-monokai-fg hover:bg-monokai-accent/10 transition-colors">
              取消
            </button>
            <button onClick={handleCommit} disabled={committing}
              className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl bg-monokai-purple/20 text-monokai-purple hover:bg-monokai-purple/30 transition-colors disabled:opacity-50 font-medium">
              {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              确认并注入
            </button>
          </div>
        </div>
      </div>

      {toast && <ToastNotification message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
};

export default AIDraftModal;
