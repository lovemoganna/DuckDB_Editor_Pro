export interface Position {
  x: number;
  y: number;
}

export interface SavedPositions {
  [key: number]: Position;
}

export interface ComputeLinkPathResult {
  smoothPath: string;
  labelX: number;
  labelY: number;
  arrowheadPath: string;
}

export const GRID_SIZE = 20;

export const TYPE_COLORS = [
  { border: 'border-zinc-800/80 hover:border-zinc-400/60', bg: 'bg-zinc-400/10', text: 'text-zinc-400', glow: '' },
  { border: 'border-zinc-800/80 hover:border-monokai-blue/60', bg: 'bg-monokai-blue/10', text: 'text-monokai-blue', glow: '' },
  { border: 'border-zinc-800/80 hover:border-monokai-green/60', bg: 'bg-monokai-green/10', text: 'text-monokai-green', glow: '' },
  { border: 'border-zinc-800/80 hover:border-monokai-yellow/60', bg: 'bg-monokai-yellow/10', text: 'text-monokai-yellow', glow: '' },
  { border: 'border-zinc-800/80 hover:border-monokai-orange/60', bg: 'bg-monokai-orange/10', text: 'text-monokai-orange', glow: '' },
  { border: 'border-zinc-800/80 hover:border-monokai-pink/60', bg: 'bg-monokai-pink/10', text: 'text-monokai-pink', glow: '' }
];

export const getTypeStyles = (typeId: number) => {
  const idx = typeId % TYPE_COLORS.length;
  return TYPE_COLORS[idx];
};

export const resolveCollisions = (
  droppedId: number,
  currentPositions: SavedPositions,
  expandedNodeIds?: Set<number>
): SavedPositions => {
  const updated = { ...currentPositions };
  const droppedPos = updated[droppedId];
  if (!droppedPos) return currentPositions;

  const isExpanded = (id: number) => expandedNodeIds?.has(id) ?? false;
  const getWidth = (id: number) => 220;
  const getHeight = (id: number) => isExpanded(id) ? 145 : 82;

  const marginX = 30; // Horizontal gap between cards
  const marginY = 30; // Vertical gap between cards

  let hasCollision = true;
  let attempts = 0;
  const maxAttempts = 100;

  while (hasCollision && attempts < maxAttempts) {
    hasCollision = false;
    const Aw = getWidth(droppedId) + marginX;
    const Ah = getHeight(droppedId) + marginY;

    for (const idStr of Object.keys(updated)) {
      const id = parseInt(idStr, 10);
      if (id === droppedId) continue;

      const otherPos = updated[id];
      if (!otherPos) continue;

      const Bw = getWidth(id) + marginX;
      const Bh = getHeight(id) + marginY;

      // AABB Bounding Box overlap check
      const overlapX = droppedPos.x < otherPos.x + Bw && droppedPos.x + Aw > otherPos.x;
      const overlapY = droppedPos.y < otherPos.y + Bh && droppedPos.y + Ah > otherPos.y;

      if (overlapX && overlapY) {
        hasCollision = true;
        
        // Calculate displacement along the axis of minimum penetration
        const overlapWidth = Math.min(droppedPos.x + Aw - otherPos.x, otherPos.x + Bw - droppedPos.x);
        const overlapHeight = Math.min(droppedPos.y + Ah - otherPos.y, otherPos.y + Bh - droppedPos.y);

        if (overlapWidth < overlapHeight) {
          const pushX = droppedPos.x >= otherPos.x ? overlapWidth : -overlapWidth;
          droppedPos.x = Math.round((droppedPos.x + pushX) / GRID_SIZE) * GRID_SIZE;
        } else {
          const pushY = droppedPos.y >= otherPos.y ? overlapHeight : -overlapHeight;
          droppedPos.y = Math.round((droppedPos.y + pushY) / GRID_SIZE) * GRID_SIZE;
        }
        attempts++;
        break;
      }
    }
  }
  return updated;
};

export const computeLinkPath = (
  linkId: number,
  srcId: number,
  tgtId: number,
  srcPos: Position,
  tgtPos: Position,
  zoomVal: number,
  isExpandedSrc: boolean,
  isExpandedTgt: boolean,
  linkCurvatures: { [key: number]: number }
): ComputeLinkPathResult => {
  const dx = tgtPos.x - srcPos.x;
  const dy = tgtPos.y - srcPos.y;
  const angle = Math.atan2(dy, dx);
  
  const isCompact = zoomVal < 0.65;
  const isDetailed = zoomVal >= 0.95;
  
  const getDim = (isComp: boolean, isExp: boolean, isDet: boolean) => {
    if (isComp) return { w: 80, h: 21 };
    if (isExp || isDet) return { w: 110, h: 72.5 };
    return { w: 110, h: 41 };
  };
  
  const srcDim = getDim(isCompact, isExpandedSrc, isDetailed);
  const tgtDim = getDim(isCompact, isExpandedTgt, isDetailed);
  
  const cosA = Math.abs(Math.cos(angle));
  const sinA = Math.abs(Math.sin(angle));
  
  const srcOffset = Math.min(srcDim.w / (cosA || 0.001), srcDim.h / (sinA || 0.001));
  const tgtOffset = Math.min(tgtDim.w / (cosA || 0.001), tgtDim.h / (sinA || 0.001));
  
  const sourceX = srcPos.x + Math.cos(angle) * (srcOffset + 10);
  const sourceY = srcPos.y + Math.sin(angle) * (srcOffset + 10);
  const targetX = tgtPos.x - Math.cos(angle) * (tgtOffset + 10);
  const targetY = tgtPos.y - Math.sin(angle) * (tgtOffset + 10);
  
  const factor = linkCurvatures[linkId] ?? 0;
  const cpDist = Math.max(80, Math.abs(targetX - sourceX) * 0.4);
  const offset = factor * 160;
  
  const cp1X = sourceX + cpDist;
  const cp1Y = sourceY - offset;
  const cp2X = targetX - cpDist;
  const cp2Y = targetY - offset;
  
  const smoothPath = `M ${sourceX} ${sourceY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${targetX} ${targetY}`;
  
  const labelX = 0.125 * sourceX + 0.375 * cp1X + 0.375 * cp2X + 0.125 * targetX;
  const labelY = 0.125 * sourceY + 0.375 * cp1Y + 0.375 * cp2Y + 0.125 * targetY;

  const arrowSize = 7;
  const arrowAngle = Math.PI / 6;
  const endAngle = Math.atan2(targetY - cp2Y, targetX - cp2X);
  const ax1 = targetX - arrowSize * Math.cos(endAngle - arrowAngle);
  const ay1 = targetY - arrowSize * Math.sin(endAngle - arrowAngle);
  const ax2 = targetX - arrowSize * Math.cos(endAngle + arrowAngle);
  const ay2 = targetY - arrowSize * Math.sin(endAngle + arrowAngle);
  const arrowheadPath = `M ${targetX} ${targetY} L ${ax1} ${ay1} L ${ax2} ${ay2} Z`;

  if (
    isNaN(sourceX) || isNaN(sourceY) ||
    isNaN(targetX) || isNaN(targetY) ||
    isNaN(cp1X) || isNaN(cp1Y) ||
    isNaN(cp2X) || isNaN(cp2Y) ||
    isNaN(ax1) || isNaN(ay1) ||
    isNaN(ax2) || isNaN(ay2)
  ) {
    return { smoothPath: '', labelX: 0, labelY: 0, arrowheadPath: '' };
  }
  
  return { smoothPath, labelX, labelY, arrowheadPath };
};

export const computeAutoAlignLayout = (
  objects: any[],
  links: any[],
  canvasHeight: number,
  currentPositions: SavedPositions,
  lockedNodeIds: Set<number>
): SavedPositions => {
  const updated = { ...currentPositions };
  
  // 1. Build adjacency lists and compute in-degrees
  const adj: { [key: number]: number[] } = {};
  const inDegree: { [key: number]: number } = {};
  
  objects.forEach((obj: any) => {
    adj[obj.id] = [];
    inDegree[obj.id] = 0;
  });
  
  links.forEach((link: any) => {
    const src = link.source_object_id;
    const tgt = link.target_object_id;
    if (adj[src] !== undefined && adj[tgt] !== undefined) {
      adj[src].push(tgt);
      inDegree[tgt]++;
    }
  });
  
  // 2. Queue-based level calculation (longest-path/layering BFS)
  const levels: { [key: number]: number } = {};
  const queue: number[] = [];
  
  // Initialize sources at Level 0
  objects.forEach((obj: any) => {
    if (inDegree[obj.id] === 0) {
      levels[obj.id] = 0;
      queue.push(obj.id);
    } else {
      levels[obj.id] = -1; // unvisited
    }
  });
  
  // BFS to find layer levels (depth of node in DAG)
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currLevel = levels[curr];
    adj[curr].forEach((neighbor) => {
      if (levels[neighbor] < currLevel + 1) {
        levels[neighbor] = currLevel + 1;
        queue.push(neighbor);
      }
    });
  }
  
  // For nodes in cycles or disconnected components without 0 in-degree:
  // Resolve any unvisited nodes by starting from them at Level 0
  let hasUnvisited = objects.some((obj: any) => levels[obj.id] === -1);
  while (hasUnvisited) {
    const nextUnvisited = objects.find((obj: any) => levels[obj.id] === -1);
    if (!nextUnvisited) break;
    
    levels[nextUnvisited.id] = 0;
    queue.push(nextUnvisited.id);
    
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currLevel = levels[curr];
      adj[curr].forEach((neighbor) => {
        if (levels[neighbor] < currLevel + 1) {
          levels[neighbor] = currLevel + 1;
          queue.push(neighbor);
        }
      });
    }
    hasUnvisited = objects.some((obj: any) => levels[obj.id] === -1);
  }
  
  // 3. Group nodes by their calculated levels
  const levelGroups: { [key: number]: any[] } = {};
  objects.forEach((obj: any) => {
    const lvl = levels[obj.id];
    if (!levelGroups[lvl]) {
      levelGroups[lvl] = [];
    }
    levelGroups[lvl].push(obj);
  });
  
  // 4. Assign positions based on levels, centered symmetrically
  const cy = canvasHeight / 2 || 350;
  const sortedLevels = Object.keys(levelGroups).map(Number).sort((a, b) => a - b);
  sortedLevels.forEach((level) => {
    const list = levelGroups[level];
    const count = list.length;
    // Adjust vertical spacing: closer if there are more nodes, wider if fewer, min 90px, max 150px
    const verticalSpacing = Math.max(90, Math.min(150, 450 / count));
    list.forEach((obj: any, idx: number) => {
      // Skip locked nodes to preserve their user-defined positions
      if (lockedNodeIds.has(obj.id)) {
        return;
      }
      const offset = (idx - (count - 1) / 2) * verticalSpacing;
      updated[obj.id] = {
        x: Math.round((180 + level * 280) / GRID_SIZE) * GRID_SIZE,
        y: Math.round((cy + offset) / GRID_SIZE) * GRID_SIZE
      };
    });
  });
  
  return updated;
};


