/**
 * HandbookViewer.tsx
 * Renders Markdown handbook with Mermaid diagrams and SQL highlighting
 * Part of AI Handbook Generation Architecture (Phase 8.3)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { HandbookBatch, HandbookResult } from '../../services/HandbookGenerator';
import { MermaidChart } from '../../components/MermaidChart';
import { Play, Clipboard, Check, ChevronRight, Menu, Download } from 'lucide-react';

// =========================================================================
// Styles
// =========================================================================

const styles = {
    container: {
        backgroundColor: 'var(--bg-secondary, #1a1a2e)',
        borderRadius: '12px',
        padding: '24px',
        color: 'var(--text-primary, #e0e0e0)',
        fontFamily: 'var(--font-sans, system-ui)',
        maxHeight: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '20px',
    },
    mainLayout: {
        display: 'flex',
        gap: '24px',
        flex: 1,
        minHeight: 0,
    },
    sidebar: {
        width: '240px',
        flexShrink: 0,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: '8px',
        padding: '16px',
        overflowY: 'auto' as const,
        border: '1px solid var(--border-color, #333)',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
    },
    tocItem: {
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '13px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: 'var(--text-secondary, #aaa)',
        border: '1px solid transparent',
    },
    tocItemActive: {
        backgroundColor: 'rgba(79, 70, 229, 0.15)',
        color: 'var(--accent-primary, #818cf8)',
        borderColor: 'rgba(79, 70, 229, 0.3)',
    },
    scrollArea: {
        flex: 1,
        overflowY: 'auto' as const,
        paddingRight: '4px',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border-color, #333)',
    },
    title: {
        fontSize: '24px',
        fontWeight: 700,
        color: 'var(--text-primary, #fff)',
    },
    actions: {
        display: 'flex',
        gap: '8px',
    },
    button: {
        padding: '8px 16px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
        transition: 'all 0.2s ease',
    },
    downloadBtn: {
        backgroundColor: 'var(--accent-primary, #4f46e5)',
        color: '#fff',
    },
    copyBtn: {
        backgroundColor: 'transparent',
        border: '1px solid var(--border-color, #444)',
        color: 'var(--text-secondary, #aaa)',
    },
    batchProgress: {
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
    },
    batchChip: {
        padding: '6px 12px',
        borderRadius: '16px',
        fontSize: '12px',
        fontWeight: 500,
    },
    batchPending: {
        backgroundColor: 'var(--gray-700, #374151)',
        color: 'var(--gray-400, #9ca3af)',
    },
    batchGenerating: {
        backgroundColor: 'var(--amber-600, #d97706)',
        color: '#fff',
        animation: 'pulse 1.5s infinite',
    },
    batchComplete: {
        backgroundColor: 'var(--green-600, #059669)',
        color: '#fff',
    },
    batchError: {
        backgroundColor: 'var(--red-600, #dc2626)',
        color: '#fff',
    },
    content: {
        lineHeight: 1.7,
    },
    codeBlock: {
        backgroundColor: 'var(--bg-tertiary, #0d0d1a)',
        padding: '16px',
        borderRadius: '8px',
        overflowX: 'auto' as const,
        fontFamily: 'var(--font-mono, "Fira Code", monospace)',
        fontSize: '13px',
        position: 'relative' as const,
        marginBottom: '16px',
    },
    copyCodeBtn: {
        position: 'absolute' as const,
        top: '8px',
        right: '8px',
        padding: '4px 8px',
        backgroundColor: 'rgba(255,255,255,0.1)',
        border: 'none',
        borderRadius: '4px',
        color: 'var(--text-secondary, #888)',
        cursor: 'pointer',
        fontSize: '11px',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse' as const,
        marginBottom: '16px',
    },
    th: {
        backgroundColor: 'var(--bg-tertiary, #0d0d1a)',
        padding: '12px',
        textAlign: 'left' as const,
        borderBottom: '2px solid var(--border-color, #333)',
        fontWeight: 600,
    },
    td: {
        padding: '10px 12px',
        borderBottom: '1px solid var(--border-color, #222)',
    },
    moduleContainer: {
        marginBottom: '16px',
        border: '1px solid var(--border-color, #333)',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    moduleHeader: {
        padding: '12px 16px',
        backgroundColor: 'rgba(255,255,255,0.05)',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        userSelect: 'none' as const,
    },
    moduleContent: {
        padding: '16px',
        borderTop: '1px solid var(--border-color, #333)',
    },
};

// =========================================================================
// Props
// =========================================================================

interface HandbookViewerProps {
    result: HandbookResult | null;
    batches: HandbookBatch[];
    isGenerating: boolean;
    progressMessage?: string;
    onDownload?: () => void;
    onGenerate?: () => void;
    onExecuteSql?: (sql: string) => void; // Added for running tutorial examples
}

// =========================================================================
// Component
// =========================================================================

export const HandbookViewer: React.FC<HandbookViewerProps> = ({
    result,
    batches,
    isGenerating,
    progressMessage,
    onDownload,
    onGenerate,
    onExecuteSql,
}) => {
    const [copiedSql, setCopiedSql] = useState<string | null>(null);
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

    // Auto-expand the first module on load
    useEffect(() => {
        if (batches.length > 0 && Object.keys(expandedModules).length === 0) {
            setExpandedModules({ [batches[0].id]: true });
        }
    }, [batches]);

    const toggleModule = (id: string) => {
        setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const scrollToModule = (id: string) => {
        setExpandedModules(prev => ({ ...prev, [id]: true }));
        const element = document.getElementById(`module-${id}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleCopyCode = useCallback(async (code: string) => {
        await navigator.clipboard.writeText(code);
        setCopiedSql(code.slice(0, 50));
        setTimeout(() => setCopiedSql(null), 2000);
    }, []);

    const downloadHandbook = useCallback(() => {
        if (!result?.fullContent) return;

        const element = document.createElement("a");
        const file = new Blob([result.fullContent], { type: 'text/markdown' });
        element.href = URL.createObjectURL(file);
        element.download = `${result.tableName}_handbook.md`;
        document.body.appendChild(element); // Required for this to work in FireFox
        element.click();
        document.body.removeChild(element);
        URL.revokeObjectURL(element.href);

        onDownload?.();
    }, [result, onDownload]);

    const downloadDebugInfo = useCallback(() => {
        if (!result) return;

        const debugData = {
            tableName: result.tableName,
            generatedAt: result.generatedAt,
            batches: result.batches.map(b => ({
                id: b.id,
                status: b.status,
                prompt: b.debugPrompt,
                contentLength: b.content.length
            }))
        };
        const element = document.createElement("a");
        const file = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
        element.href = URL.createObjectURL(file);
        element.download = `${result.tableName}_handbook_debug.json`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        URL.revokeObjectURL(element.href);
    }, [result]);

    const getBatchStyle = (status: HandbookBatch['status']) => {
        switch (status) {
            case 'pending': return styles.batchPending;
            case 'generating': return styles.batchGenerating;
            case 'complete': return styles.batchComplete;
            case 'error': return styles.batchError;
            default: return styles.batchPending;
        }
    };

    const getBatchIcon = (status: HandbookBatch['status']) => {
        switch (status) {
            case 'pending': return '⏳';
            case 'generating': return '🔄';
            case 'complete': return '✅';
            case 'error': return '❌';
            default: return '⏳';
        }
    };

    // Combine completed batch contents for display
    const displayContent = batches
        .filter(b => b.status === 'complete' || b.status === 'error')
        .map(b => b.content)
        .join('\n\n---\n\n');

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <h2 style={styles.title}>
                    📖 {result?.tableName ? `${result.tableName} 手册` : 'DuckDB 教程生成中...'}
                </h2>
                <div style={styles.actions}>
                    {result?.fullContent && (
                        <>
                            <button
                                style={{ ...styles.button, ...styles.downloadBtn }}
                                onClick={downloadHandbook}
                                title="Download Markdown"
                            >
                                <Download size={16} style={{ marginRight: '6px' }} />
                                下载手册
                            </button>
                            <button
                                style={{ ...styles.button, backgroundColor: '#374151', color: '#9ca3af' }}
                                onClick={downloadDebugInfo}
                                title="Download AI Debug Info (Prompts & Context)"
                            >
                                <div className="flex items-center gap-1">
                                    <span>🐞</span>
                                    <span className="text-xs">Debug</span>
                                </div>
                            </button>
                            <button
                                style={{ ...styles.button, ...styles.copyBtn }}
                                onClick={() => handleCopyCode(result?.fullContent || '')}
                            >
                                📋 复制全部
                            </button>
                        </>
                    )}
                </div>

                {/* Batch Progress */}
                <div style={styles.batchProgress}>
                    {batches.map((batch) => (
                        <div
                            key={batch.id}
                            style={{ ...styles.batchChip, ...getBatchStyle(batch.status) }}
                        >
                            {getBatchIcon(batch.status)} {batch.title}
                        </div>
                    ))}
                </div>

                {/* Progress Message */}
                {isGenerating && progressMessage && (
                    <div style={{ marginBottom: '16px', color: 'var(--accent-primary, #818cf8)' }}>
                        {progressMessage}
                    </div>
                )}

                {/* Empty State - Show Generate Button */}
                {!result && !isGenerating && batches.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        padding: '60px 20px',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        borderRadius: '12px',
                        border: '2px dashed var(--border-color, #333)',
                        marginBottom: '20px',
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📖</div>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: '#fff' }}>
                            生成 DuckDB 教程手册
                        </h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary, #888)', marginBottom: '24px' }}>
                            基于当前数据表生成完整的 SQL 教程手册 (13 模块, ~3000行)
                        </p>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary, #666)', marginBottom: '16px' }}>
                            ⚠️ 生成需要约 30-45 秒，分 3 批次调用 AI API
                        </p>
                        <button
                            onClick={onGenerate}
                            disabled={!onGenerate}
                            style={{
                                padding: '12px 32px',
                                fontSize: '16px',
                                fontWeight: 600,
                                backgroundColor: 'var(--accent-primary, #4f46e5)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: onGenerate ? 'pointer' : 'not-allowed',
                                opacity: onGenerate ? 1 : 0.5,
                            }}
                        >
                            🚀 开始生成手册
                        </button>
                    </div>
                )}

                {/* Main Layout with Sidebar and Content */}
                <div style={styles.mainLayout}>
                    {/* Left TOC Sidebar */}
                    {batches.length > 0 && (
                        <div style={styles.sidebar}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                目录 / Contents
                            </div>
                            {batches.map((batch) => (
                                <div
                                    key={batch.id}
                                    style={{
                                        ...styles.tocItem,
                                        ...(expandedModules[batch.id] ? styles.tocItemActive : {})
                                    }}
                                    onClick={() => scrollToModule(batch.id)}
                                >
                                    <span style={{ opacity: 0.5 }}>{batch.id}</span>
                                    <span style={{ truncate: true } as any}>{batch.title}</span>
                                    {batch.status === 'generating' && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse ml-auto"></div>}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Right Content Area */}
                    <div style={styles.scrollArea}>
                        <div style={styles.content}>
                            {batches.filter(b => b.status === 'complete' || b.status === 'error').map((batch) => (
                                <div key={batch.id} id={`module-${batch.id}`} style={styles.moduleContainer}>
                                    <div style={styles.moduleHeader} onClick={() => toggleModule(batch.id)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <ChevronRight
                                                size={18}
                                                style={{
                                                    transform: expandedModules[batch.id] ? 'rotate(90deg)' : 'rotate(0deg)',
                                                    transition: 'transform 0.2s ease'
                                                }}
                                            />
                                            <span style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>{batch.title}</span>
                                        </div>
                                        <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase' }}>
                                            {batch.id.startsWith('A') ? 'Basic' : batch.id.startsWith('B') ? 'Advanced' : 'Core'}
                                        </span>
                                    </div>

                                    {expandedModules[batch.id] && (
                                        <div style={styles.moduleContent}>
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    code: ({ node, className, children, ...props }: any) => {
                                                        const isInline = !className;
                                                        const code = String(children).replace(/\n$/, '');
                                                        const language = className?.replace('language-', '') || '';

                                                        if (isInline) {
                                                            return (
                                                                <code style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.9em' }}>
                                                                    {children}
                                                                </code>
                                                            );
                                                        }

                                                        if (language === 'mermaid') {
                                                            return <div style={{ marginBottom: '16px', borderRadius: '8px', overflow: 'hidden' }}><MermaidChart chart={code} /></div>;
                                                        }

                                                        return (
                                                            <div style={styles.codeBlock}>
                                                                <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '8px' }}>
                                                                    <button style={styles.copyCodeBtn} onClick={() => handleCopyCode(code)}>
                                                                        {copiedSql === code.slice(0, 50) ? <Check size={12} /> : <Clipboard size={12} />}
                                                                    </button>
                                                                    {onExecuteSql && (
                                                                        <button
                                                                            style={{ ...styles.copyCodeBtn, backgroundColor: '#059669', color: '#fff' }}
                                                                            onClick={() => onExecuteSql(code)}
                                                                        >
                                                                            <Play size={12} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <pre style={{ margin: 0, overflow: 'auto' }}>
                                                                    <code className={className} {...props}>{children}</code>
                                                                </pre>
                                                            </div>
                                                        );
                                                    },
                                                    table: ({ children }: any) => <table style={styles.table}>{children}</table>,
                                                    th: ({ children }: any) => <th style={styles.th}>{children}</th>,
                                                    td: ({ children }: any) => <td style={styles.td}>{children}</td>,
                                                    h1: ({ children }: any) => <h1 style={{ display: 'none' }}>{children}</h1>, // Hide duplicated titles
                                                    h2: ({ children }: any) => <h2 style={{ display: 'none' }}>{children}</h2>,
                                                    h3: ({ children }: any) => <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#818cf8', marginBottom: '12px' }}>{children}</h3>,
                                                }}
                                            >
                                                {batch.content}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {isGenerating && batches.filter(b => b.status === 'complete').length === 0 && (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-sm">正在生成第一阶段模块...</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Copy Notification */}
                    {copiedSql && (
                        <div
                            style={{
                                position: 'fixed',
                                bottom: '20px',
                                right: '20px',
                                backgroundColor: 'var(--green-600, #059669)',
                                color: '#fff',
                                padding: '12px 20px',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                zIndex: 9999,
                            }}
                        >
                            ✓ 已复制到剪贴板
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HandbookViewer;
