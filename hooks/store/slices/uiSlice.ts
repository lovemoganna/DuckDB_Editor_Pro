/**
 * slices/uiSlice.ts — UI state (modals, notifications, cross-tab communication)
 */

export interface NotificationEntry {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface UISlice {
  // Cross-tab communication
  pendingSql: string;
  setPendingSql: (sql: string) => void;
  pendingChartConfig: any;
  setPendingChartConfig: (config: any) => void;
  clearPending: () => void;

  // Modals
  showCreateModal: boolean;
  setShowCreateModal: (v: boolean) => void;
  showDuplicateModal: boolean;
  setShowDuplicateModal: (v: boolean) => void;
  showImportModal: boolean;
  setShowImportModal: (v: boolean) => void;
  showSettingsModal: boolean;
  setShowSettingsModal: (v: boolean) => void;
  showExportModal: boolean;
  setShowExportModal: (v: boolean) => void;

  // Notifications
  notifications: NotificationEntry[];
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeNotification: (id: string) => void;
}

let notifCounter = 0;

export const createUISlice = (set: (partial: Partial<UISlice> | ((state: UISlice) => Partial<UISlice>)) => void): UISlice => ({
  // Cross-tab
  pendingSql: '',
  setPendingSql: (sql) => set({ pendingSql: sql }),
  pendingChartConfig: null,
  setPendingChartConfig: (config) => set({ pendingChartConfig: config }),
  clearPending: () => set({ pendingSql: '', pendingChartConfig: null }),

  // Modals
  showCreateModal: false,
  setShowCreateModal: (v) => set({ showCreateModal: v }),
  showDuplicateModal: false,
  setShowDuplicateModal: (v) => set({ showDuplicateModal: v }),
  showImportModal: false,
  setShowImportModal: (v) => set({ showImportModal: v }),
  showSettingsModal: false,
  setShowSettingsModal: (v) => set({ showSettingsModal: v }),
  showExportModal: false,
  setShowExportModal: (v) => set({ showExportModal: v }),

  // Notifications
  notifications: [],
  addNotification: (message, type = 'info') => {
    const id = `notif_${++notifCounter}_${Date.now()}`;
    set((state: UISlice) => ({
      notifications: [...state.notifications, { id, message, type }],
    }));
    setTimeout(() => {
      set((state: UISlice) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    }, 5000);
  },
  removeNotification: (id) =>
    set((state: UISlice) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
});
