import React, { useState } from 'react';

export const CollapsibleJsonViewer: React.FC<{ data: any; depth?: number }> = ({ data, depth = 0 }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCollapse = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (data === null) return <span className="text-monokai-comment">null</span>;
  if (data === undefined) return <span className="text-monokai-comment">undefined</span>;

  if (typeof data !== 'object') {
    if (typeof data === 'string') {
      return <span className="text-[#FF9D00]">"{data}"</span>;
    }
    if (typeof data === 'number') {
      return <span className="text-[#66D9EF]">{data}</span>;
    }
    if (typeof data === 'boolean') {
      return <span className="text-[#F92672]">{String(data)}</span>;
    }
    return <span>{String(data)}</span>;
  }

  const isArray = Array.isArray(data);
  const keys = Object.keys(data);

  if (keys.length === 0) {
    return <span>{isArray ? '[]' : '{}'}</span>;
  }

  const indentClass = depth > 0 ? 'pl-3 border-l border-white/5 ml-1.5' : '';

  return (
    <div className="font-mono text-xs select-none">
      <span>{isArray ? '[' : '{'}</span>
      <div className={indentClass}>
        {keys.map((key, index) => {
          const value = data[key];
          const isValueObject = typeof value === 'object' && value !== null;
          const isCollapsed = collapsed[key];
          const hasMore = index < keys.length - 1;

          return (
            <div key={key} className="py-0.5">
              {isValueObject ? (
                <div className="flex items-start">
                  <button
                    onClick={() => toggleCollapse(key)}
                    className="mr-1 text-[10px] text-monokai-comment hover:text-white transition-colors focus:outline-none"
                  >
                    {isCollapsed ? '▶' : '▼'}
                  </button>
                  <span className="text-monokai-cyan font-semibold mr-1">{isArray ? '' : `"${key}": `}</span>
                  {isCollapsed ? (
                    <span className="text-monokai-comment cursor-pointer" onClick={() => toggleCollapse(key)}>
                      {Array.isArray(value) ? `[...${value.length} items]` : '{...}'}
                    </span>
                  ) : (
                    <CollapsibleJsonViewer data={value} depth={depth + 1} />
                  )}
                  {hasMore && <span className="text-monokai-comment">,</span>}
                </div>
              ) : (
                <div className="flex items-center">
                  <span className="text-monokai-cyan font-semibold mr-1">{isArray ? '' : `"${key}": `}</span>
                  <CollapsibleJsonViewer data={value} depth={depth + 1} />
                  {hasMore && <span className="text-monokai-comment">,</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <span>{isArray ? ']' : '}'}</span>
    </div>
  );
};
