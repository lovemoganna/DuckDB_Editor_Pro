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
    <CodeMirror
      value={code}
      extensions={[
        sql(),
        EditorView.theme({
          "&": { 
            fontSize: "11px", 
            backgroundColor: "#1e1f1c",
            maxHeight: maxHeight !== 'none' ? maxHeight : undefined
          },
          ".cm-content": { fontSize: "11px" },
          ".cm-line": { fontSize: "11px" },
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
      className={`text-[11px] rounded overflow-hidden ${className}`}
    />
  );
};

export default SqlCodeBlock;
