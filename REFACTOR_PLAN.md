# Full Refactor SkillPanel

**Goal:** Transform the 1,118-line `SkillPanel.tsx` into a well-organized component architecture by extracting sub-components and moving data to proper locations.

## Target File Structure

```
components/
  SkillPanel.tsx          (simplified: ~200 lines, state + modal + view routing)
  constants/
    skills.ts             (existing: CATEGORY_CONFIG, INTENT_LABELS, CATEGORY_HELP)
    skill-background-info.ts  (NEW: SKILL_BACKGROUND_INFO + helpers)
  skills/
    (existing files: IntentResultCard.tsx, SkillHelpPanel.tsx, ExecutionResultPanel.tsx)
    SmartMode.tsx         (extracted: lines 475-877 from SkillPanel)
    BrowseMode.tsx        (extracted: lines 879-1114 from SkillPanel)
    SkillList.tsx         (extracted: left panel of BrowseMode)
    ValidationPopup.tsx  (extracted: lines 399-471 from SkillPanel)
    index.ts              (barrel exports)
```

## Implementation Steps

### Step 1: Move SKILL_BACKGROUND_INFO to `components/constants/skill-background-info.ts`

Create new file with:
- `SKILL_BACKGROUND_INFO` constant (copy from lines 88-236)
- `getCategoryTagColors()` helper (lines 238-248)
- `getSkillIcon()` helper (lines 250-264)
- Re-export from `skills.ts` for backward compatibility

### Step 2: Extract ValidationPopup to `components/skills/ValidationPopup.tsx`

The validation result popup (lines 399-471) is a self-contained modal overlay.

**Props:**
```ts
interface ValidationPopupProps {
  validationResult: SkillTestResult;
  diagnosticReport: DiagnosticReport | null;
  selectedSkill: AISkill;
  isValidating: boolean;
  onClose: () => void;
  onShowTestPanel: () => void;
  onAutoFix: (skill: AISkill) => void;
  onDiagnose: (skill: AISkill) => void;
}
```

### Step 3: Extract SmartMode to `components/skills/SmartMode.tsx`

Smart mode (lines 475-877) handles NL input, intent analysis, and execution results.

**Props:**
```ts
interface SmartModeProps {
  currentTable?: string;
  currentColumns?: { name: string; type: string }[];
  onExecuteSql?: (sql: string) => void;
  router: ReturnType<typeof useSkillRouter>;
  onSwitchToBrowse: (skill?: AISkill) => void;
}
```

**Inlined sub-components within SmartMode.tsx:**
- `IntentAnalysisCard` - renders intent analysis block (lines 672-727)
- `ExecutionResultCard` - renders the result (lines 730-816)
- `TableContextBar` - renders table/column info (lines 586-603)
- `SmartModeFooter` - renders footer (lines 853-875)

### Step 4: Extract SkillList to `components/skills/SkillList.tsx`

The left panel of Browse mode (lines 883-1059) — search, category tabs, skill card list, and footer actions.

**Props:**
```ts
interface SkillListProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: SkillCategory | 'all';
  setSelectedCategory: (c: SkillCategory | 'all') => void;
  selectedSkill: AISkill | null;
  onSkillSelect: (skill: AISkill) => void;
  filteredSkills: AISkill[];
  skillsByCategory: Record<SkillCategory, AISkill[]>;
  expandedCategories: Set<SkillCategory>;
  onToggleCategory: (category: SkillCategory) => void;
  currentTable?: string;
  onShowImportModal: () => void;
  onShowTestPanel: () => void;
  onSwitchToSmart: () => void;
}
```

### Step 5: Extract BrowseMode to `components/skills/BrowseMode.tsx`

Browse mode wrapper (lines 879-1114) that composes SkillList + SkillDetail side by side.

**Props:**
```ts
interface BrowseModeProps {
  selectedSkill: AISkill | null;
  browseResult: SkillResult | null;
  isExecuting: boolean;
  setIsExecuting: (v: boolean) => void;
  setBrowseResult: (r: SkillResult | null) => void;
  onExecuteSql?: (sql: string) => void;
  currentTable?: string;
  currentColumns?: { name: string; type: string }[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: SkillCategory | 'all';
  setSelectedCategory: (c: SkillCategory | 'all') => void;
  filteredSkills: AISkill[];
  skillsByCategory: Record<SkillCategory, AISkill[]>;
  expandedCategories: Set<SkillCategory>;
  onToggleCategory: (c: SkillCategory) => void;
  onSkillSelect: (skill: AISkill) => void;
  onSwitchToSmart: () => void;
  onShowImportModal: () => void;
  onShowTestPanel: () => void;
}
```

### Step 6: Simplify `SkillPanel.tsx`

**Keep in SkillPanel.tsx (~220 lines):**
- Props + interface
- All 15 state variables
- `useSkillRouter` hook
- `useMemo` filtered skills
- Event handlers
- `if (!isOpen) return null` early return
- Three modal overlays
- One-line switch between SmartMode and BrowseMode

**Remove from SkillPanel.tsx:**
- All extracted sub-components
- `SKILL_BACKGROUND_INFO` constant
- `getCategoryTagColors()` function
- `getSkillIcon()` function
- ~900 lines of JSX

### Step 7: Create `components/skills/index.ts`

```ts
export { SmartMode } from './SmartMode';
export { BrowseMode } from './BrowseMode';
export { SkillList } from './SkillList';
export { ValidationPopup } from './ValidationPopup';
```

## Order of Implementation

1. Create `components/constants/skill-background-info.ts` + update `skills.ts`
2. Create `components/skills/ValidationPopup.tsx`
3. Create `components/skills/SmartMode.tsx`
4. Create `components/skills/SkillList.tsx`
5. Create `components/skills/BrowseMode.tsx`
6. Simplify `components/SkillPanel.tsx`
7. Create `components/skills/index.ts`
8. Verify no TypeScript errors
