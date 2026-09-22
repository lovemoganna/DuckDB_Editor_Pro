/**
 * useSkillStore — Spotlight search UI state
 *
 * Zustand-compatible selector hook pattern.
 * initSkillStore() connects this store's setters to SkillContext.
 *
 * Usage:
 *   const isActive = useSkillStore(s => s.isSpotlightActive);
 *   const setActive = useSkillStore(s => s.setIsSpotlightActive);
 */

import { AISkill } from '../../../types';

// ─── Store shape ─────────────────────────────────────────────
export interface SkillStore {
  isSpotlightActive: boolean;
  setIsSpotlightActive: (v: boolean) => void;
  setSelectedSkill: (skill: AISkill) => void;
}

// ─── Module-level mutable singleton ──────────────────────────
const _state: SkillStore = {
  isSpotlightActive: false,
  setIsSpotlightActive: () => {},
  setSelectedSkill: () => {},
};

// ─── Update helpers ──────────────────────────────────────────
function _updateSpotlight(v: boolean) {
  _state.isSpotlightActive = v;
}

// ─── Selector-based hook (Zustand-compatible) ─────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useSkillStore = <T>(selector: (state: SkillStore) => T): T => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return selector(_state as any);
};

// ─── Bootstrap: connect to SkillContext ────────────────────
export function initSkillStore(setters: {
  setSpotlight: (v: boolean) => void;
  setSkill: (skill: AISkill) => void;
}) {
  _state.setIsSpotlightActive = (v: boolean) => {
    _updateSpotlight(v);
    setters.setSpotlight(v);
  };
  _state.setSelectedSkill = (skill: AISkill) => {
    setters.setSkill(skill);
  };
}

// ─── Direct imperative setters ──────────────────────────────
export const setSpotlightActive = (v: boolean) => {
  _updateSpotlight(v);
  _state.setIsSpotlightActive(v);
};

export const selectSkill = (skill: AISkill) => {
  _state.setSelectedSkill(skill);
};
