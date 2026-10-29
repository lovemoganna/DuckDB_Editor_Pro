/**
 * Multi-Tab Concurrency Coordinator
 *
 * Coordinates between multiple browser tabs to prevent OPFS and IndexedDB
 * storage locking conflicts when DuckDB is open in more than one tab simultaneously.
 */

export interface TabMessage {
  type: 'PING' | 'PONG' | 'CLAIM_LEADERSHIP' | 'RELEASE_LEADERSHIP' | 'HEARTBEAT';
  senderId: string;
  timestamp: number;
}

export type ConflictListener = (hasConflict: boolean, peerCount: number) => void;

class MultiTabCoordinator {
  private channel: BroadcastChannel | null = null;
  private tabId: string;
  private knownPeers: Map<string, number> = new Map();
  private heartbeatTimer: any = null;
  private pruneTimer: any = null;
  private listeners: Set<ConflictListener> = new Set();
  private hasConflict: boolean = false;

  constructor() {
    this.tabId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.init();
  }

  public getTabId(): string {
    return this.tabId;
  }

  public getActivePeersCount(): number {
    return this.knownPeers.size;
  }

  public getHasConflict(): boolean {
    return this.hasConflict;
  }

  public onConflictChange(callback: ConflictListener): () => void {
    this.listeners.add(callback);
    callback(this.hasConflict, this.knownPeers.size);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    const conflict = this.knownPeers.size > 0;
    if (conflict !== this.hasConflict) {
      this.hasConflict = conflict;
      for (const listener of this.listeners) {
        try {
          listener(this.hasConflict, this.knownPeers.size);
        } catch (e) {
          console.error('[MultiTabCoordinator] Listener error:', e);
        }
      }
    }
  }

  private init(): void {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      return;
    }

    try {
      this.channel = new BroadcastChannel('duckdb_tab_coordinator_v1');
      this.channel.onmessage = (event: MessageEvent<TabMessage>) => {
        this.handleMessage(event.data);
      };

      // Broadcast entry ping
      this.broadcast({
        type: 'PING',
        senderId: this.tabId,
        timestamp: Date.now()
      });

      // Periodic heartbeat every 4 seconds
      this.heartbeatTimer = setInterval(() => {
        this.broadcast({
          type: 'HEARTBEAT',
          senderId: this.tabId,
          timestamp: Date.now()
        });
      }, 4000);

      // Prune inactive peers every 3 seconds
      this.pruneTimer = setInterval(() => {
        this.pruneStalePeers();
      }, 3000);

      // Clean departure
      window.addEventListener('beforeunload', () => {
        this.destroy();
      });
    } catch (e) {
      console.warn('[MultiTabCoordinator] BroadcastChannel unavailable or failed to initialize:', e);
    }
  }

  private handleMessage(msg: TabMessage): void {
    if (!msg || msg.senderId === this.tabId) return;

    const now = Date.now();
    switch (msg.type) {
      case 'PING':
        this.knownPeers.set(msg.senderId, now);
        this.broadcast({
          type: 'PONG',
          senderId: this.tabId,
          timestamp: now
        });
        this.notifyListeners();
        break;

      case 'PONG':
      case 'HEARTBEAT':
        this.knownPeers.set(msg.senderId, now);
        this.notifyListeners();
        break;

      case 'RELEASE_LEADERSHIP':
        this.knownPeers.delete(msg.senderId);
        this.notifyListeners();
        break;
    }
  }

  private pruneStalePeers(): void {
    const now = Date.now();
    let changed = false;
    for (const [peerId, lastSeen] of this.knownPeers.entries()) {
      if (now - lastSeen > 9000) {
        this.knownPeers.delete(peerId);
        changed = true;
      }
    }
    if (changed) {
      this.notifyListeners();
    }
  }

  private broadcast(msg: TabMessage): void {
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (e) {
        console.warn('[MultiTabCoordinator] Failed to broadcast message:', e);
      }
    }
  }

  public destroy(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.broadcast({
      type: 'RELEASE_LEADERSHIP',
      senderId: this.tabId,
      timestamp: Date.now()
    });
    if (this.channel) {
      try {
        this.channel.close();
      } catch {
        /* ignore */
      }
      this.channel = null;
    }
    this.knownPeers.clear();
    this.notifyListeners();
  }
}

export const multiTabCoordinator = new MultiTabCoordinator();
