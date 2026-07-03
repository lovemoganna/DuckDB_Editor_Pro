/**
 * slices/navigationSlice.ts — Navigation and App-level state
 */

import { Tab } from '../../../types';

export interface NavigationSlice {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;

  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;

  isZenMode: boolean;
  setIsZenMode: (v: boolean) => void;
}

export const createNavigationSlice = (set: (partial: Partial<NavigationSlice>) => void): NavigationSlice => ({
  activeTab: Tab.DASHBOARD,
  setActiveTab: (tab) => set({ activeTab: tab }),

  isSidebarCollapsed: false,
  setIsSidebarCollapsed: (v) => set({ isSidebarCollapsed: v }),

  isZenMode: false,
  setIsZenMode: (v) => set({ isZenMode: v }),
});
