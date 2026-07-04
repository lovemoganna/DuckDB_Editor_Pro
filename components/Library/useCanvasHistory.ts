import { useState, useCallback, useRef, useEffect } from 'react';
import { Node, Edge } from 'reactflow';

export interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

export function useCanvasHistory(
  nodes: Node[],
  edges: Edge[],
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
) {
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const isTransitioningRef = useRef(false);

  const initHistory = useCallback((initialNodes: Node[], initialEdges: Edge[]) => {
    setHistory([{ nodes: initialNodes, edges: initialEdges }]);
    setHistoryIndex(0);
  }, []);

  const pushHistory = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    if (isTransitioningRef.current) return;
    setHistory(prev => {
      const nextHistory = prev.slice(0, historyIndex + 1);
      const updated = [...nextHistory, { nodes: newNodes, edges: newEdges }];
      if (updated.length > 50) {
        updated.shift();
      }
      return updated;
    });
    setHistoryIndex(prev => {
      const nextIndex = prev + 1;
      return nextIndex > 49 ? 49 : nextIndex;
    });
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isTransitioningRef.current = true;
      const prevIndex = historyIndex - 1;
      const targetState = history[prevIndex];
      setNodes(targetState.nodes);
      setEdges(targetState.edges);
      setHistoryIndex(prevIndex);
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 50);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isTransitioningRef.current = true;
      const nextIndex = historyIndex + 1;
      const targetState = history[nextIndex];
      setNodes(targetState.nodes);
      setEdges(targetState.edges);
      setHistoryIndex(nextIndex);
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 50);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  // Global Ctrl+Z / Ctrl+Y keystroke listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  return {
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    pushHistory,
    initHistory,
    undo: handleUndo,
    redo: handleRedo,
  };
}
