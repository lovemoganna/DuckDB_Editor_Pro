/**
 * AcademyApp.tsx - DuckDB 数据实战学堂顶层统筹与主工作台
 * 
 * 职责：
 * 1. 统筹学堂大厅 (AcademyHub) 与双栏沉浸式试炼台 (AcademyTrialStudio) 的无缝流转；
 * 2. 统一聚合三阶全谱系课程（SQL基石、14课本体、工业大案、官方讲义、自建教程）；
 * 3. 驱动学习进度、通关勋章与上次访问记录的持久化；
 * 4. 联动自定义教程上传与删除管理；
 * 5. 全局随堂笔记抽屉与代码片段库抽屉总控。
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  AcademyCourseItem, getAllAcademyCourses, getCourseById 
} from './data/academyCurriculum';
import { AcademyHub } from './AcademyHub';
import { AcademyTrialStudio } from './AcademyTrialStudio';
import { UploadTutorialModal } from './UploadTutorialModal';
import { AcademyNotesDrawer } from './AcademyNotesDrawer';
import { AcademySnippetsDrawer } from './AcademySnippetsDrawer';
import { getAllUserTutorials, deleteUserTutorial, UserTutorial } from '../../services/userTutorialStorage';
import { toastService } from '../../services/toastService';

interface AcademyAppProps {
  onTryCode?: (code: string) => void;
  onOpenTable?: (tableName: string) => void;
}

const STORAGE_KEY_COMPLETED = 'duckdb_academy_completed';
const STORAGE_KEY_LAST_COURSE = 'duckdb_academy_last_course';

export const AcademyApp: React.FC<AcademyAppProps> = ({ onTryCode, onOpenTable }) => {
  // 自定义用户教程列表
  const [customTutorials, setCustomTutorials] = useState<UserTutorial[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isHubNotesOpen, setIsHubNotesOpen] = useState(false);
  const [isHubSnippetsOpen, setIsHubSnippetsOpen] = useState(false);

  // 加载自建教程
  const loadCustomTutorials = useCallback(async () => {
    try {
      const list = await getAllUserTutorials();
      setCustomTutorials(list);
    } catch (e) {
      console.warn('[AcademyApp] Failed to load user tutorials:', e);
    }
  }, []);

  useEffect(() => {
    loadCustomTutorials();
  }, [loadCustomTutorials]);

  // 全量课程列表 (内置 + 自建)
  const allCourses = useMemo(() => {
    return getAllAcademyCourses(customTutorials);
  }, [customTutorials]);

  // 已通关的课程 ID 列表
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COMPLETED);
      if (saved) return JSON.parse(saved);

      // 兼容迁移：合并旧版 tutorials 进度
      const legacyTutorials = localStorage.getItem('duckdb_tutorials_progress');
      const list: string[] = [];
      if (legacyTutorials) {
        const parsed = JSON.parse(legacyTutorials);
        if (Array.isArray(parsed)) list.push(...parsed);
      }
      return list;
    } catch {
      return [];
    }
  });

  // 上次学习的课程 ID
  const [lastCourseId, setLastCourseId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_LAST_COURSE) || '';
    } catch {
      return '';
    }
  });

  // 当前视图状态：'hub' (学堂大厅) | 'studio' (双栏试炼台)
  const [activeView, setActiveView] = useState<'hub' | 'studio'>('hub');
  const [activeCourseId, setActiveCourseId] = useState<string>('');

  // 根据 URL Hash 同步视图与课程
  const syncHashToView = useCallback(() => {
    const hash = window.location.hash.slice(1);
    if (!hash || hash === 'academy/hub') {
      setActiveView('hub');
      return;
    }
    if (hash.startsWith('academy/')) {
      const courseId = hash.replace('academy/', '');
      if (courseId && courseId !== 'hub') {
        setActiveCourseId(courseId);
        setActiveView('studio');
        return;
      }
    }
    // 兼容原有的 #ontology/ 或 #tutorial/
    if (hash.startsWith('ontology/')) {
      const refId = hash.replace('ontology/', '');
      const matched = allCourses.find(c => c.refId === refId);
      if (matched) {
        setActiveCourseId(matched.id);
        setActiveView('studio');
      }
    }
  }, [allCourses]);

  // 初始化与监听浏览器前进/后退 hashchange
  useEffect(() => {
    syncHashToView();
    window.addEventListener('hashchange', syncHashToView);
    return () => window.removeEventListener('hashchange', syncHashToView);
  }, [syncHashToView]);

  // 选择并进入课程
  const handleSelectCourse = useCallback((courseId: string) => {
    setActiveCourseId(courseId);
    setActiveView('studio');
    setLastCourseId(courseId);
    try {
      localStorage.setItem(STORAGE_KEY_LAST_COURSE, courseId);
    } catch {}
    window.history.pushState(null, '', `#academy/${courseId}`);
  }, []);

  // 返回大厅
  const handleBackToHub = useCallback(() => {
    setActiveView('hub');
    window.history.pushState(null, '', '#academy/hub');
  }, []);

  // 切换通关状态
  const handleToggleComplete = useCallback((courseId: string) => {
    setCompletedIds(prev => {
      let updated: string[];
      if (prev.includes(courseId)) {
        updated = prev.filter(id => id !== courseId);
        toastService.info('已取消标记');
      } else {
        updated = [...prev, courseId];
        toastService.success('🎉 恭喜通关本门实战课程！已点亮技能节点。');
      }
      try {
        localStorage.setItem(STORAGE_KEY_COMPLETED, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  // 删除自定义教程
  const handleDeleteCustomCourse = useCallback(async (courseId: string) => {
    const target = allCourses.find(c => c.id === courseId);
    if (!target || !target.refId) return;

    try {
      await deleteUserTutorial(target.refId);
      toastService.success('自定义教程已删除');
      await loadCustomTutorials();
      if (activeCourseId === courseId) {
        handleBackToHub();
      }
    } catch (err) {
      toastService.error('删除自定义教程失败');
    }
  }, [allCourses, activeCourseId, handleBackToHub, loadCustomTutorials]);

  // 当前激活的课程对象
  const currentCourse = useMemo(() => {
    if (!activeCourseId) return allCourses[0];
    return getCourseById(activeCourseId, allCourses) || allCourses[0];
  }, [activeCourseId, allCourses]);

  return (
    <div className="w-full h-full flex flex-col bg-monokai-bg text-monokai-fg overflow-hidden font-sans select-none relative">
      
      {/* 1. 大厅模式 */}
      {activeView === 'hub' && (
        <AcademyHub
          courses={allCourses}
          completedCourseIds={completedIds}
          lastAccessedCourseId={lastCourseId}
          onSelectCourse={handleSelectCourse}
          onOpenUploadModal={() => setIsUploadModalOpen(true)}
          onDeleteCustomCourse={handleDeleteCustomCourse}
          onOpenNotes={() => setIsHubNotesOpen(true)}
          onOpenSnippets={() => setIsHubSnippetsOpen(true)}
        />
      )}

      {/* 2. 双栏沉浸试炼台模式 */}
      {activeView === 'studio' && currentCourse && (
        <AcademyTrialStudio
          course={currentCourse}
          allCourses={allCourses}
          isCompleted={completedIds.includes(currentCourse.id)}
          onToggleComplete={handleToggleComplete}
          onBackToHub={handleBackToHub}
          onNavigateToCourse={handleSelectCourse}
          onOpenInGlobalSql={onTryCode}
        />
      )}

      {/* 3. 导入 Markdown 教程弹窗 */}
      <UploadTutorialModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={async () => {
          setIsUploadModalOpen(false);
          await loadCustomTutorials();
          toastService.success('自定义教程导入成功！已归入对应难度货架。');
        }}
      />

      {/* 4. 大厅全局笔记抽屉 */}
      <AcademyNotesDrawer
        isOpen={isHubNotesOpen}
        onClose={() => setIsHubNotesOpen(false)}
      />

      {/* 5. 大厅全局代码片段抽屉 */}
      <AcademySnippetsDrawer
        isOpen={isHubSnippetsOpen}
        onClose={() => setIsHubSnippetsOpen(false)}
        onOpenInGlobalSql={onTryCode}
      />

    </div>
  );
};

export default AcademyApp;
