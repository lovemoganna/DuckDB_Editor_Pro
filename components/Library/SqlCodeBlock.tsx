/**
 * SqlCodeBlock - SQL 代码显示组件
 * 
 * 使用 CodeMirror 实现与 Learn 板块一致的语法高亮
 */

import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { EditorView } from '@codemirror/view';

interface SqlCodeBlockProps {
  code: string;
  className?: string;
  maxHeight?: string;
}

export const SqlCodeBlock: React.FC<SqlCodeBlockProps> = ({ 
  code, 
  className = '',
  maxHeight = 'none'
}) => {
  return (
    <div className={`rounded-md border border-monokai-border/60 overflow-hidden bg-monokai-bg ${className}`}>
      <CodeMirror
        value={code}
        extensions={[
          sql(),
          EditorView.lineWrapping,
          EditorView.theme({
            "&": { 
              fontSize: "11.5px", 
              backgroundColor: "transparent",
              maxHeight: maxHeight !== 'none' ? maxHeight : undefined
            },
            ".cm-content": { 
              fontSize: "11.5px",
              fontFamily: "var(--font-mono)",
              lineHeight: "1.55",
              padding: "8px 10px"
            },
            ".cm-line": { 
              fontSize: "11.5px",
              fontFamily: "var(--font-mono)"
            },
            ".cm-scroller": { 
              overflow: maxHeight !== 'none' ? 'auto' : undefined,
              maxHeight: maxHeight !== 'none' ? maxHeight : undefined
            }
          })
        ]}
        theme={monokai}
        editable={false}
        basicSetup={{ 
          lineNumbers: false, 
          foldGutter: false, 
          highlightActiveLine: false 
        }}
      />
    </div>
  );
};

export default SqlCodeBlock;
