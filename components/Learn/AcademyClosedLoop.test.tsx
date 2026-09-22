import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AcademyApp } from './AcademyApp';
import { AcademyResultVerification } from './AcademyResultVerification';
import { AcademyNotesDrawer } from './AcademyNotesDrawer';
import { AcademySnippetsDrawer } from './AcademySnippetsDrawer';
import { duckDBService } from '../../services/duckDBService';
import * as notesStorage from '../../services/learnNotesStorage';
import * as snippetsStorage from '../../services/codeSnippetsStorage';

// Mock duckDBService
vi.mock('../../services/duckDBService', () => ({
  duckDBService: {
    executeAndAuditWithMetadata: vi.fn().mockResolvedValue({
      columns: ['id', 'name', 'score', 'status'],
      columnTypes: ['INTEGER', 'VARCHAR', 'DOUBLE', 'VARCHAR'],
      columnTypeMap: { id: 'INTEGER', name: 'VARCHAR', score: 'DOUBLE', status: 'VARCHAR' },
      rows: [
        { id: 1, name: 'Item_1', score: 85.5, status: 'Active' },
        { id: 2, name: 'Item_2', score: 92.0, status: 'Active' }
      ],
      executionTime: 3.5,
      error: null,
    }),
  }
}));

// Mock userTutorialStorage
vi.mock('../../services/userTutorialStorage', () => ({
  getAllUserTutorials: vi.fn().mockResolvedValue([]),
  deleteUserTutorial: vi.fn().mockResolvedValue(undefined),
  saveUserTutorial: vi.fn().mockResolvedValue(undefined),
}));

// Mock toastService
vi.mock('../../services/toastService', () => ({
  toastService: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }
}));

describe('Academy 5-Step Closed-Loop Verification (发现 → 理解 → 实践 → 验证 → 沉淀)', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
    vi.clearAllMocks();
  });

  it('Step 1: 发现内容 - supports switching between Catalog and Roadmap views and status filtering', async () => {
    render(<AcademyApp />);

    // Default view has Catalog (精选货架)
    expect(screen.getByText('精选货架')).toBeTruthy();
    expect(screen.getByText('学习路径图')).toBeTruthy();

    // Click "学习路径图" to enter Roadmap view
    const roadmapBtn = screen.getByRole('button', { name: /学习路径图/ });
    fireEvent.click(roadmapBtn);

    // Verify roadmap stages are rendered
    expect(screen.getByText('第一阶段 · 启航基石')).toBeTruthy();
    expect(screen.getByText('第二阶段 · 数据清洗与规范')).toBeTruthy();
    expect(screen.getByText('第三阶段 · 高级分析与窗口')).toBeTruthy();
    expect(screen.getByText('第四阶段 · 复合结构与透视')).toBeTruthy();
    expect(screen.getByText('第五阶段 · 本体建模与工业实战')).toBeTruthy();

    // Switch back to Catalog
    const catalogBtn = screen.getByRole('button', { name: /精选货架/ });
    fireEvent.click(catalogBtn);

    // Status filter "未通关"
    const uncompletedBtn = screen.getByRole('button', { name: '未通关' });
    fireEvent.click(uncompletedBtn);
    expect(screen.getByText('基础 SELECT 检索与多维条件过滤')).toBeTruthy();
  });

  it('Step 2 & 3: 学习理解与动手实践 - structured guide, step template injection into runner', async () => {
    render(<AcademyApp />);

    // Enter first course
    const firstCourseCard = screen.getByText('基础 SELECT 检索与多维条件过滤');
    fireEvent.click(firstCourseCard);

    // Step 2: 学习理解
    expect(screen.getByText('为什么这一步至关重要？')).toBeTruthy();
    expect(screen.getByText(/循序渐进 · 分步演练/)).toBeTruthy();
    expect(screen.getByText(/实战挑战目标/)).toBeTruthy();

    // Step 3: 动手实践 - click "Step 2" button in runner tabs
    const step2Btn = screen.getByRole('button', { name: 'Step 2' });
    fireEvent.click(step2Btn);

    const textarea = screen.getByPlaceholderText(/在此键入 DuckDB SQL 代码/);
    expect((textarea as HTMLTextAreaElement).value).toContain('CASE WHEN');

    // Click "载入挑战模板" in the left guide
    const loadChallengeBtn = screen.getByRole('button', { name: /载入挑战模板/ });
    fireEvent.click(loadChallengeBtn);

    expect((textarea as HTMLTextAreaElement).value).toContain('WHERE status = \'Active\'');
  });

  it('Step 4: 验证结果 - challenge validation and smart error diagnostics', async () => {
    // 1. Success validation test with AcademyResultVerification
    const { rerender } = render(
      <AcademyResultVerification
        columns={['id', 'score', 'status']}
        rows={[{ id: 1, score: 95, status: 'Active' }]}
        executionTime={5.2}
        errorMessage={null}
        isRunning={false}
        hasRun={true}
        executedSql="SELECT id, score, status FROM range(10) WHERE status = 'Active' ORDER BY score DESC LIMIT 3"
        challenge={{
          question: '输出 score 列且至少 1 行',
          targetColumn: 'score',
          targetMinRows: 1,
          keywords: ['WHERE', 'LIMIT']
        }}
      />
    );

    // Should display pass message
    expect(screen.getByText('🎉 完美达成挑战目标！逻辑与预期指标完全吻合。')).toBeTruthy();
    expect(screen.getByText('匹配度 100%')).toBeTruthy();

    // 2. Diagnostic test when SQL errors out
    rerender(
      <AcademyResultVerification
        columns={[]}
        rows={[]}
        executionTime={1.0}
        errorMessage="Binder Error: column 'score' must appear in the GROUP BY clause or be used in an aggregate function"
        isRunning={false}
        hasRun={true}
        executedSql="SELECT score FROM t"
      />
    );

    // Should display plain language diagnostic
    expect(screen.getByText('聚合分组字段遗漏 (GROUP BY Mismatch)')).toBeTruthy();
    expect(screen.getByText(/普通维度列必须全数列在 GROUP BY 子句中/)).toBeTruthy();
  });

  it('Step 5: 沉淀复用 - notes drawer saves note to IndexedDB and snippets drawer collects code', async () => {
    const saveNoteSpy = vi.spyOn(notesStorage, 'saveNote').mockResolvedValue();
    const getNotesSpy = vi.spyOn(notesStorage, 'getNotesByTutorial').mockResolvedValue([]);
    const saveSnippetSpy = vi.spyOn(snippetsStorage, 'saveSnippet').mockResolvedValue();
    const getAllSnippetsSpy = vi.spyOn(snippetsStorage, 'getAllSnippets').mockResolvedValue([]);

    // 1. Test Notes Drawer
    const { unmount } = render(
      <AcademyNotesDrawer
        isOpen={true}
        onClose={vi.fn()}
        currentCourseId="sql_basics_01"
        currentCourseTitle="基础 SELECT 查询"
      />
    );

    expect(screen.getByText('随堂笔记与沉淀')).toBeTruthy();

    // Click "写笔记"
    const writeBtn = screen.getByRole('button', { name: /写笔记/ });
    fireEvent.click(writeBtn);

    const noteInput = screen.getByPlaceholderText(/记录关键知识点/);
    fireEvent.change(noteInput, { target: { value: '掌握了 WHERE 过滤与 LIMIT 语法' } });

    const saveNoteBtn = screen.getByRole('button', { name: /保存笔记/ });
    fireEvent.click(saveNoteBtn);

    await waitFor(() => {
      expect(saveNoteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          noteContent: '掌握了 WHERE 过滤与 LIMIT 语法',
          tutorialId: 'sql_basics_01'
        })
      );
    });

    unmount();

    // 2. Test Snippets Drawer
    render(
      <AcademySnippetsDrawer
        isOpen={true}
        onClose={vi.fn()}
        currentSql="SELECT * FROM range(10);"
        currentCourseId="sql_basics_01"
        currentCourseTitle="基础 SELECT"
      />
    );

    expect(screen.getByText('代码片段库 (Snippets)')).toBeTruthy();

    // Click "收藏当前"
    const bookmarkBtn = screen.getByRole('button', { name: /收藏当前/ });
    fireEvent.click(bookmarkBtn);

    const descInput = screen.getByPlaceholderText(/片段名称\/用途/);
    fireEvent.change(descInput, { target: { value: '极速内存生成10行' } });

    const saveSnippetBtn = screen.getByRole('button', { name: /保存到库/ });
    fireEvent.click(saveSnippetBtn);

    await waitFor(() => {
      expect(saveSnippetSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          description: '极速内存生成10行',
          code: 'SELECT * FROM range(10);'
        })
      );
    });
  });

  it('Step 1.2: 发现内容 - supports switching to 认知方法论 and navigating to OPLA workshop', async () => {
    render(<AcademyApp />);

    // Click "认知方法论" in the segmented control
    const methodologyBtn = screen.getByRole('button', { name: /认知方法论/ });
    fireEvent.click(methodologyBtn);

    // Verify OPLA methodology is displayed
    expect(screen.getByText(/OPLA 本体四步思考法/i)).toBeTruthy();
    expect(screen.getByText('Object 实体')).toBeTruthy();
    expect(screen.getByText('Property 属性')).toBeTruthy();

    // Click CTA to jump to Shunda workshop
    const ctaBtns = screen.getAllByText(/进入【顺达冷链】OPLA 独立建模工坊实操/i);
    expect(ctaBtns.length).toBeGreaterThan(0);
    fireEvent.click(ctaBtns[0]);

    // Should navigate into trial studio for the case
    expect(screen.getAllByText(/顺达冷链/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/1\. Objects 实体/i)).toBeTruthy();
    expect(screen.getByText(/2\. Properties 属性度量/i)).toBeTruthy();
  });

  it('Step 2.2: 理解知识与实践 - OPLA 工业工坊 renders 4-pillar columns and compiles to SQL', async () => {
    render(<AcademyApp />);

    // Switch to catalog
    const catalogBtn = screen.getByRole('button', { name: /精选货架/ });
    fireEvent.click(catalogBtn);

    // Search for cold chain case
    const searchInput = screen.getByPlaceholderText(/搜索课程、SQL关键字或标签/);
    fireEvent.change(searchInput, { target: { value: '冷链' } });

    const caseCard = screen.getByText(/工坊实战：顺达冷链/);
    fireEvent.click(caseCard);

    // Verify 4 pillars are present
    expect(screen.getByText(/1\. Objects 实体/i)).toBeTruthy();
    expect(screen.getByText(/4\. Actions 闭环/i)).toBeTruthy();
    expect(screen.getByText(/OPLA 拓扑实时渲染视窗/i)).toBeTruthy();

    // Click "编译并在试炼场运行"
    const compileBtn = screen.getByRole('button', { name: /编译并在试炼场运行/ });
    fireEvent.click(compileBtn);

    const textarea = screen.getByPlaceholderText(/在此键入 DuckDB SQL 代码/);
    expect((textarea as HTMLTextAreaElement).value).toContain('CREATE OR REPLACE TABLE');
  });

  it('Step 3.3: 动手实践增强 - Cheat Sheet toggle inserts analytical snippets', async () => {
    render(<AcademyApp />);

    const firstCourseCard = screen.getByText('基础 SELECT 检索与多维条件过滤');
    fireEvent.click(firstCourseCard);

    // Toggle cheat sheet
    const cheatSheetBtn = screen.getByRole('button', { name: /语法速查/ });
    fireEvent.click(cheatSheetBtn);

    expect(screen.getByText(/点击一键追加常用 DuckDB 分析语法/)).toBeTruthy();
    expect(screen.getByText('QUALIFY排名')).toBeTruthy();

    // Click QUALIFY snippet
    const qualifyBtn = screen.getByRole('button', { name: /QUALIFY排名/ });
    fireEvent.click(qualifyBtn);

    const textarea = screen.getByPlaceholderText(/在此键入 DuckDB SQL 代码/);
    expect((textarea as HTMLTextAreaElement).value).toContain('QUALIFY row_number()');
  });

  it('Step 5.2: 沉淀复用 - Workbench direct bridge opens current SQL in main workbench', async () => {
    const onTryCodeMock = vi.fn();
    render(<AcademyApp onTryCode={onTryCodeMock} />);

    const firstCourseCard = screen.getByText('基础 SELECT 检索与多维条件过滤');
    fireEvent.click(firstCourseCard);

    // Click "在工作台实战" button in topbar
    const workbenchBtn = screen.getByRole('button', { name: /在工作台实战/ });
    fireEvent.click(workbenchBtn);

    expect(onTryCodeMock).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
  });
});
