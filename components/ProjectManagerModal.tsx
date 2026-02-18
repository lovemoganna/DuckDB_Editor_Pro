import React, { useState, useEffect } from 'react';
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

    useEffect(() => {
        if (isOpen) {
            loadProjects();
        }
    }, [isOpen]);

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Database className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Projects Workspace</h2>
                            <p className="text-xs text-gray-500">Persistent DuckDB-WASM Storage (OPFS)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-between">
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
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                        <button
                            onClick={handleCreate}
                            disabled={loading || !newProjectName.trim()}
                            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? 'Creating...' : <><Plus className="w-4 h-4" /> Create</>}
                        </button>
                    </div>

                    {/* Project List */}
                    <div className="space-y-3">
                        {projects.length === 0 ? (
                            <div className="text-center py-10 border-2 border-dashed border-gray-100 rounded-xl">
                                <Database className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                <p className="text-gray-400">No projects yet. Create one to get started.</p>
                            </div>
                        ) : (
                            projects.map(p => (
                                <div key={p} className={`group flex items-center justify-between p-4 rounded-xl border transition-all ${currentProject === p
                                        ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                                        : 'border-gray-100 hover:border-blue-200 hover:shadow-sm bg-white'
                                    }`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${currentProject === p ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-500'
                                            }`}>
                                            <FolderOpen className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className={`font-medium ${currentProject === p ? 'text-blue-700' : 'text-gray-700'}`}>{p}</h3>
                                            <span className="text-xs text-gray-400">Local Database</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {currentProject === p ? (
                                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">Active</span>
                                        ) : (
                                            <button
                                                onClick={() => handleSelect(p)}
                                                disabled={loading}
                                                className="px-4 py-1.5 text-sm text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg border border-gray-200 transition-colors"
                                            >
                                                Open
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleDelete(p)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
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
