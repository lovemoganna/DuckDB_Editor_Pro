import React, { useState, useEffect, useCallback } from 'react';
import { duckDBService } from '../services/duckdbService';
import { X, Database, Plus, Trash2, FolderOpen } from 'lucide-react';

interface ProjectManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProjectSelected: (name: string) => void;
    currentProject: string | null;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({ isOpen, onClose, onProjectSelected, currentProject }) => {
    const [projects, setProjects] = useState<string[]>([]);
    const [newProjectName, setNewProjectName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ESC key to close modal - Critical fix for UX accessibility
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            loadProjects();
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, handleKeyDown]);

    const loadProjects = async () => {
        try {
            const list = await duckDBService.listProjects();
            setProjects(list);
        } catch (e) {
            console.error(e);
            setError("Failed to load projects");
        }
    };

    const handleCreate = async () => {
        if (!newProjectName.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const name = newProjectName.trim();
            if (projects.includes(name)) {
                throw new Error("Project already exists");
            }
            // Attach = Create if not exists in our logic
            await duckDBService.attachProject(name);
            await loadProjects();
            setNewProjectName('');
            // Auto select? Maybe not
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async (name: string) => {
        setLoading(true);
        try {
            // If we are already attached, just USE? 
            // Safe to call attach again, it's idempotent-ish or we can check
            // For simplicity, we ensure it's attached then USE it.
            await duckDBService.attachProject(name);
            await duckDBService.useProject(name);
            onProjectSelected(name);
            onClose();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (name: string) => {
        if (!confirm(`Are you sure you want to delete project "${name}"? This cannot be undone.`)) return;
        try {
            await duckDBService.detachProject(name);
            await duckDBService.deleteProject(name);
            await loadProjects();
            if (currentProject === name) {
                onProjectSelected(''); // Deselect
            }
        } catch (e: any) {
            setError(e.message);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] backdrop-blur-sm">
            <div className="bg-monokai-surface rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col border border-monokai-border">
                {/* Header */}
                <div className="p-6 border-b border-monokai-border flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-monokai-blue/20 rounded-lg">
                            <Database className="w-5 h-5 text-monokai-blue" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-monokai-fg">Projects Workspace</h2>
                            <p className="text-xs text-monokai-comment">Persistent DuckDB-WASM Storage (OPFS)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-monokai-sidebar rounded-full transition-colors">
                        <X className="w-5 h-5 text-monokai-comment" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="mb-4 p-3 bg-monokai-red/10 text-monokai-red text-sm rounded-lg flex items-center justify-between">
                            <span>{error}</span>
                            <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
                        </div>
                    )}

                    {/* Create New */}
                    <div className="flex gap-3 mb-6">
                        <input
                            type="text"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="New Project Name..."
                            className="flex-1 px-4 py-2 border border-monokai-border rounded-lg focus:outline-none focus:border-monokai-accent bg-monokai-bg text-monokai-fg placeholder-monokai-comment/50 text-xs transition-colors"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                        <button
                            onClick={handleCreate}
                            disabled={loading || !newProjectName.trim()}
                            className="px-5 py-2 bg-monokai-accent text-monokai-bg font-bold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs transition-all shadow-xs cursor-pointer"
                        >
                            {loading ? 'Creating...' : <><Plus className="w-4 h-4" /> Create</>}
                        </button>
                    </div>

                    {/* Project List */}
                    <div className="space-y-3">
                        {projects.length === 0 ? (
                            <div className="text-center py-10 border border-dashed border-monokai-border rounded-xl">
                                <Database className="w-12 h-12 text-monokai-comment/30 mx-auto mb-3" />
                                <p className="text-monokai-comment text-xs">No projects yet. Create one to get started.</p>
                            </div>
                        ) : (
                            projects.map(p => (
                                <div key={p} className={`group flex items-center justify-between p-4 rounded-xl border transition-all ${currentProject === p
                                        ? 'border-monokai-accent bg-monokai-surface shadow-xs'
                                        : 'border-monokai-border hover:border-monokai-accent/60 hover:shadow-xs bg-monokai-bg'
                                    }`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${currentProject === p ? 'bg-monokai-accent/20 text-monokai-accent' : 'bg-monokai-sidebar text-monokai-comment group-hover:bg-monokai-accent/10 group-hover:text-monokai-accent transition-colors'
                                            }`}>
                                            <FolderOpen className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className={`text-xs font-semibold ${currentProject === p ? 'text-monokai-accent' : 'text-monokai-fg'}`}>{p}</h3>
                                            <span className="text-xs text-monokai-comment">Local Database</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {currentProject === p ? (
                                            <span className="px-2.5 py-1 bg-monokai-accent/15 text-monokai-accent text-xs font-bold rounded-md">Active</span>
                                        ) : (
                                            <button
                                                onClick={() => handleSelect(p)}
                                                disabled={loading}
                                                className="px-4 py-1.5 text-xs text-monokai-fg bg-monokai-sidebar hover:bg-monokai-elevated hover:border-monokai-accent/60 hover:text-monokai-accent rounded-lg border border-monokai-border transition-colors cursor-pointer"
                                            >
                                                Open
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleDelete(p)}
                                            className="p-2 text-monokai-comment hover:text-monokai-red hover:bg-monokai-red/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                            title="Delete Project"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
