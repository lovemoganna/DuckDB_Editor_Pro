# Enhancement Plan: DuckDB Editor Pro

## 1. Goal
Enhance the existing DuckDB Editor with professional features:
- **Left Sidebar**: Tree view for Tables -> Columns (Click to insert).
- **SQL Editor**: Syntax highlighting (replace textarea with Monaco/Codemirror).
- **Result Area**: Formatted table, execution metrics (time, rows).
- **Error Handling**: Friendly error UI (no white screen).
- **History/Saved Queries**: Robust management.

## 2. Technical Approach

### Phase 1: Sidebar & Tree View (`components/Sidebar.tsx` + `components/TableTree.tsx`)
- **Current**: `App.tsx` has basic command palette and list.
- **New**: 
    - Create `components/TableTree.tsx`:
        - Fetch tables on mount.
        - Expandable rows (Accordion style).
        - Fetch columns on expand (`duckdbService.getTableSchema`).
        - `onClick` implies "Insert Name into Editor" (needs callback prop).
    - Update `App.tsx` layout to include a dedicated Left Sidebar.

### Phase 2: SQL Editor Upgrade (`components/SqlEditor.tsx`)
- **Current**: Unverified (likely `textarea`).
- **New**:
    - Install `react-codemirror` or `monaco-editor` (recommend `react-codemirror` for lighter weight).
    - Props: `value`, `onChange`, `onRun`, `extensions={[sql()]}`.
    - Theme: Dark mode (matched to Monokai).

### Phase 3: Results & History Enhancement
- **Results**:
    - enhance `SqlEditor.tsx` render section.
    - Show `Execution Time: X ms` | `Rows: Y`.
    - Virtualized Table for large results (`react-window` or just simple pagination which exists).
- **History**:
    - Create `components/QueryHistory.tsx`.
    - Persist to `localStorage` (already exists, but refine UI).
    - "Save Query" modal (already exists, verify usage).

### Phase 4: Error Handling
- Wrap `SqlEditor` execution block in `try/catch` (already there, but ensure UI feedback).
- Add specific `ErrorBoundary` component for the Editor section.

## 3. Step-by-Step Implementation

### Step 1: Dependencies
- `npm install @uiw/react-codemirror @codemirror/lang-sql --save`

### Step 2: Sidebar Component
- Create `components/TableTree.tsx`.
- Integreate into `App.tsx` (Left Panel).

### Step 3: Editor Upgrade
- Replace `<textarea>` in `SqlEditor.tsx` with `<CodeMirror />`.

### Step 4: Verification
- **Functional**:
    - Load page -> See tables.
    - Click table -> See columns.
    - Click column -> Text appears in editor.
    - Type SQL -> Colors appear.
    - Run SQL -> Results table + Time/Count.
    - Run Bad SQL -> Red error message (not crash).

## 4. User Verification Instructions
1. **Reload**: Refresh browser.
2. **Check Sidebar**: Verify table list is visible.
3. **Check Editor**: Type `SELECT * FROM` and check coloring.
4. **Run Query**: Execute `SELECT 1` and check status bar.
