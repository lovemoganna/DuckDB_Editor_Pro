/**
 * Ontology Templates for rapid modeling blueprints. [A2]
 */

export interface OntologyTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  sql: string[];
}

export const ONTOLOGY_TEMPLATES: OntologyTemplate[] = [
  {
    id: 'okr-mapping',
    name: 'OKR 战略图谱',
    description: '核心目标 -> 关键结果 -> 具体行动的层级驱动系统',
    icon: '🎯',
    color: '#ff003c',
    sql: [
      "INSERT INTO life_object_type VALUES (10, 'Objective', '核心目标'), (11, 'KeyResult', '关键结果')",
      "INSERT INTO life_object (id, object_type_id, name, properties) VALUES (100, 10, '成为全栈高手', '{\"priority\": \"High\"}'), (101, 11, '完成 5 个实战项目', '{\"progress\": \"20%\"}'), (102, 11, '阅读 10 本技术深度书籍', '{\"progress\": \"10%\"}')",
      "INSERT INTO life_link_type VALUES (10, '驱动', 'A 推动 B 的达成')",
      "INSERT INTO life_link VALUES (100, 10, 101, 100, 1.0), (101, 10, 102, 100, 0.8)",
      "INSERT INTO life_action (id, object_id, name, description, status) VALUES (100, 101, '开发 DuckDB 管理器', '当前正在进行的任务', 'pending')"
    ]
  },
  {
    id: 'gtd-loop',
    name: 'GTD 极简回路',
    description: '收集 -> 处理 -> 执行 -> 回顾的闭环流转',
    icon: '🔁',
    color: '#00f0ff',
    sql: [
      "INSERT INTO life_object_type VALUES (20, 'Inbox', '收集箱'), (21, 'Project', '项目')",
      "INSERT INTO life_object (id, object_type_id, name, properties) VALUES (200, 20, '杂事堆', '{\"count\": 15}'), (201, 21, '装修房子', '{\"status\": \"Doing\"}')",
      "INSERT INTO life_link_type VALUES (20, '转化为', 'A 经过处理变为 B')",
      "INSERT INTO life_link VALUES (200, 20, 200, 201, 1.0)"
    ]
  },
  {
    id: 'habit-reflector',
    name: '习惯追踪/反思器',
    description: '行为习惯 -> 精神反馈 -> 认知觉醒',
    icon: '🧠',
    color: '#ffbf00',
    sql: [
      "INSERT INTO life_object_type VALUES (30, 'Habit', '习惯')",
      "INSERT INTO life_object (id, object_type_id, name, properties) VALUES (300, 30, '晨间冥想', '{\"days\": 21}'), (301, 1, '平静心态', '{\"depth\": 8}')",
      "INSERT INTO life_link_type VALUES (30, '塑造', 'A 长期坚持塑造 B')",
      "INSERT INTO life_link VALUES (300, 30, 300, 301, 0.9)",
      "INSERT INTO life_introspection (id, object_id, question, answer) VALUES (300, 301, '冥想带给我最大的变化是什么？', '更从容的应对突发事件。', CURRENT_DATE)"
    ]
  }
];
