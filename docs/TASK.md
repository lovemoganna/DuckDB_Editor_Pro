# DuckDB Editor Enhancement Tasks

- [x] **Phase 1: Sidebar & Tree View**
    - [x] Install dependencies (`react-codemirror`, `lang-sql`) <!-- id: 0 -->
    - [x] Create `components/TableTree.tsx` (Tree structure for tables/columns) <!-- id: 1 -->
    - [x] Integrate `TableTree` into `App.tsx` Sidebar <!-- id: 2 -->
    - [x] Verify Sidebar functionality <!-- id: 3 -->

- [x] **Phase 2: SQL Editor Upgrade**
    - [x] Replace `<textarea>` in `SqlEditor.tsx` with `<CodeMirror />` <!-- id: 4 -->
    - [x] Configure Monokai theme for CodeMirror <!-- id: 5 -->
    - [x] Verify Syntax Highlighting <!-- id: 6 -->

- [x] **Phase 3: Results & History**
    - [x] Refactor Result Table in `SqlEditor.tsx` <!-- id: 7 -->
    - [x] Add Status Bar (Time, Rows) <!-- id: 8 -->
    - [x] Implement `QueryHistory` persistence logic <!-- id: 9 -->

- [x] **Phase 4: Error Handling**
    - [x] Improve Error UI validation <!-- id: 10 -->
