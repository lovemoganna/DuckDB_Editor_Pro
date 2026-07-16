export interface WikiNodeRaw {
  id: string;
  categoryId: string;
  categoryTitle: string;
  title: string;
  iconName: string;
  brief: string;
  seedIds: string[];
  coreNodes: string[];
  principles: string[];
  bestPractices: string[];
  antiPatterns: { bad: string; good: string; title: string }[];
  description: string;
  layer: string;
  mermaid?: string;
}

export const DEFAULT_PATTERNS: WikiNodeRaw[] = [
  {
    id: 'oma-core',
    categoryId: 'foundational',
    categoryTitle: '1. 基础建模认知 (Foundational)',
    title: 'OMA 核心架构与数字孪生',
    iconName: 'BookOpen',
    brief: 'Palantir 的三大核心支柱：将真实世界的物理对象、关联与操作，完全抽象为 Object、Link 与 Action。',
    seedIds: ['ontology-lv1', 'ontology-lv2'],
    coreNodes: ['核心元', '控制元', '对象类型', '链接类型', '行动类型'],
    principles: [
      '物理对象数字孪生化：每一个现实世界的“物理实体”（如泵、飞控系统）或“概念”（如合同、订单）均应抽象为一个强内聚的 Object Type。',
      '语义化关联 (Strong Links)：禁止使用无语义的外键（如 user_id = 1）。必须显式声明 Link Type 承载业务行为（如“管理”、“执行”、“属于”）。',
      '事务化回写 Action：所有的写操作及模型状态变更，都必须封装在强类型的 Action 中，作为唯一的事务操作边界。'
    ],
    bestPractices: [
      '保持对象命名为单数名词，并且统一使用英文（如 Aircraft, Component），以保持良好的多语言元数据系统映射。',
      '每一个 Link 都必须配置双向自然语义标签（例如“A 是 B 的上游” / “B 是 A 的下游”），为后续的图谱路径计算提供图论支持。'
    ],
    antiPatterns: [
      {
        title: '扁平数据表直接映射 (Table Dumping)',
        bad: '将关系型数据库表原封不动地导出为本体对象，导致属性散乱、缺少语义连线，退化为只读查询系统。',
        good: '按业务边界重新聚合属性，消除物理表关联，提炼高内聚 of Object 节点并通过 Link 图谱化。'
      },
      {
        title: '行动与动作游离 (Orphan Actions)',
        bad: '修改本体属性时没有通过 Action，而是让前端脚本或存储过程直接强行修改，导致历史无法审计。',
        good: '为属性修改单独建立 Action Type 并指定受体 Object，操作时自动生成审计轨迹并更新对应实体。'
      }
    ],
    description: '在 Palantir 建模体系中，我们打破传统数据库“库表关系”的物理制约，将其升级为与业务用户理解相一致 of 数字孪生。每个对象都是一等公民，能直接感知并反映其所处的依赖关系与执行状态。',
    layer: 'foundation',
    mermaid: `graph TD\n  A[Object Type: 实体对象] -->|Link Type: 语义化关联| B[Object Type: 实体对象]\n  A -->|Action Type: 回写事务| C[Action: 业务操作]`
  },
  {
    id: 'properties-metadata',
    categoryId: 'foundational',
    categoryTitle: '1. 基础建模认知 (Foundational)',
    title: '属性特征化与类型约束',
    iconName: 'Sparkles',
    brief: '在强类型字段与半结构化数据 (JSON) 中取得架构平衡，以支持高性能的动态多态性建模。',
    seedIds: ['ontology-lv3'],
    coreNodes: ['属性特征化', 'JSON约束', '动态多态性'],
    principles: [
      '高频检索字段静态化：任何需要作为过滤、安全控制或图谱连接依据 of 属性（如 status, security_class），必须定义为强类型第一等属性。',
      '低频扩展属性半结构化：多变或长尾的业务配置可归入 JSON 特征字典，但在数据生成时需执行 JSON Schema 强校验。',
      '注解元数据注入：字段附加说明（Annotations）和显示标签（Meta Labels）以保证非技术分析人员能看懂建模逻辑。'
    ],
    bestPractices: [
      '对频繁修改和状态流转的字段，尽量抽取成单独的扩展属性对象，不要造成主对象的并发更新锁争抢。',
      '属性的物理类型（时序、数值、地理坐标等）应该精准设置，以使图表在大屏渲染时自动选择最佳可视化形态。'
    ],
    antiPatterns: [
      {
        title: '属性过度静态化 (Property Bloat)',
        bad: '为了满足多形态的属性记录，在单个对象上定义上百个可空属性，导致数据稀疏、读写性能严重下降。',
        good: '提炼核心属性为静态字段，其余长尾的多形态数据归入一个 JSON 字段，并注入 Schema 规约。'
      }
    ],
    description: '对象类型不仅要规定“有什么字段”，还要告诉系统“字段具备什么约束”。通过对地理空间、时序、多值等字段施加静态语义约束，系统能够自动进行多维分析 and 智能下钻。',
    layer: 'foundation',
    mermaid: `graph TD\n  Obj[Object Type: 业务实体] -->|强类型第一等字段| P1[ID / Status / Name]\n  Obj -->|半结构化特征| P2[Properties: JSON特征字典]\n  P2 -->|强约束规范| Schema[JSON Schema 校验]`
  },
  {
    id: 'hierarchy-links',
    categoryId: 'patterns',
    categoryTitle: '2. 核心建模模式 (Core Patterns)',
    title: '主从层级与树形目录',
    iconName: 'GitBranch',
    brief: '如何对自关联树形拓扑结构（如商品多级分类目录、部门组织树）进行优雅架构。',
    seedIds: ['product-catalog', 'project-tracker'],
    coreNodes: ['Catalog', 'Category', 'Product', 'Supplier'],
    principles: [
      '支配关系明确化：树形结构 Link 的方向必须由主指向从（如 Category -> Product），且保持层次自上而下属性可聚合。',
      '解除循环依赖：对于复杂拓扑，应避免在核心模型间建立直接的循环引用，而利用中介节点进行解耦。'
    ],
    bestPractices: [
      '设计树状或图状关系时，必须在 Link Type 上配置可回溯的反向语义（如“子分类”与“父分类”）。',
      '层级导航中应当提供“深度递归查询”的特殊连线，或在应用层使用图谱路径函数计算所有祖先节点。'
    ],
    antiPatterns: [
      {
        title: '循环继承死锁 (Circular Hierarchy)',
        bad: '树状节点之间存在无限制的双向自关联连线，导致树遍历算法陷入无限死循环。',
        good: '在 Link Type 上配置有向无环约束，并通过 Action 前置拦截逻辑防止写入循环链路。'
      }
    ],
    description: '树状结构与DAG（有向无环图）能支撑自底向上的数据卷算（Roll-up）和多维分析，使模型具备深度图谱下钻能力。',
    layer: 'relations',
    mermaid: `graph TD\n  Category[Category: 自关联节点] -->|1:N Parent Link| Category\n  Category -->|1:N Belong Link| Product[Product: 底层产品]`
  },
  {
    id: 'link-as-object',
    categoryId: 'patterns',
    categoryTitle: '2. 核心建模模式 (Core Patterns)',
    title: '连线实体化 (Link-as-Object)',
    iconName: 'Layers',
    brief: '当多对多关联线本身承载了关键业务特征（如合同期、分配权重）时，如何将其升级为中介物理实体。',
    seedIds: ['product-catalog'],
    coreNodes: ['Catalog', 'Category', 'Product', 'Supplier'],
    principles: [
      '带状态关系实体化：凡是多对多关系上的动态变更属性，不得作为冗余字段塞进任一侧实体，必须提炼为中间节点。',
      '双向一对多解耦：使用两个一比多的语义 Link，把原本的多对多连线变成两个单向引用。'
    ],
    bestPractices: [
      '为连线实体（Link Object）命名为两个实体的结合（如 SupplierProductLink）。',
      '在连线实体中包含审计字段，如关系创建人、启用状态等。'
    ],
    antiPatterns: [
      {
        title: '隐形关系桥接 (Silent Bridging)',
        bad: '仅用一条普通多对多连线表示供应商与商品关系，却将“供货比例”冗余存储在 Supplier 表中，导致当一个供应商给多个商品供货时数据冲突。',
        good: '创建 SupplierProductLink 中介对象，将“供货比例”定义在其上，通过两个 1:N Link 挂接两端。'
      }
    ],
    description: '在复杂 Ontology 建模中，关系往往不是静态的，而是有生命周期的事务。将 Link 升级为 Object，不仅能挂载属性，还能为其定义专属的 Action 操作。',
    layer: 'relations',
    mermaid: `graph TD\n  Supp[Supplier: 供应商] -->|1:N| LinkObj[SupplierProductLink: 连线实体]\n  Prod[Product: 商品] -->|1:N| LinkObj\n  LinkObj -->|携带专属特征| Detail[供货比例 / 合同期 / 合作状态]`
  },
  {
    id: 'state-machine-action',
    categoryId: 'patterns',
    categoryTitle: '2. 核心建模模式 (Core Patterns)',
    title: '有限状态机建模 (State Machine)',
    iconName: 'Activity',
    brief: '在本体中建立安全的流程状态流转约束，确保实体数据只能由合法行为触发跃迁。',
    seedIds: ['workflow'],
    coreNodes: ['Workflow', 'Task', 'Sprint', 'ActionLog'],
    principles: [
      '状态变更强制封装：禁止对状态属性执行自由 CRUD。必须为状态转换定义专用的 Action（如 AssignTask, CloseTask）。',
      '状态跃迁守卫：在 Action 的执行前置条件（Preconditions）中写入硬性流转规则。'
    ],
    bestPractices: [
      '使用状态转移矩阵设计模型，将合法跃迁关系以元数据形式写入控制元。',
      '在前端 UI 上，根据当前实体的状态动态禁用不合法的 Action 触发按钮。'
    ],
    antiPatterns: [
      {
        title: '状态自由落体 (Wild Status)',
        bad: '用户可以直接将任务状态从“待处理”更新为“已归档”，跳过了开发和测试审计流程。',
        good: '将状态设为只读，为每一次流转编写专属 Action，内置 Rules 校验，强制按 Todo -> Doing -> Done -> Archived 流转。'
      }
    ],
    description: '状态机模式赋予了静态模型以业务流控制力。所有的商业逻辑规则都沉淀在 Action 守卫中，形成了稳固的后门防护网。',
    layer: 'relations',
    mermaid: `graph LR\n  Todo(Todo 状态) -->|Action: StartWork| Doing(Doing 状态)\n  Doing -->|Action: FinishWork| Done(Done 状态)\n  style Todo fill:#f9f,stroke:#333\n  style Doing fill:#bbf,stroke:#333\n  style Done fill:#bfb,stroke:#333`
  },
  {
    id: 'event-sourcing-audit',
    categoryId: 'patterns',
    categoryTitle: '2. 核心建模模式 (Core Patterns)',
    title: '事件溯源与 Action Log 审计',
    iconName: 'Clock',
    brief: '利用流水日志型对象记录每一次操作痕迹，在本体拓扑中天然支持还原历史任意时刻快照。',
    seedIds: ['workflow', 'task-tracker'],
    coreNodes: ['Workflow', 'Task', 'Sprint', 'ActionLog'],
    principles: [
      '数据修改与日志沉淀孪生：每一次状态或核心字段变更动作，都必须自动实例化并插入一个 ActionLog 日志对象。',
      '时序关系连线：日志对象与被操作对象建立时间线 Link，串联成链条。'
    ],
    bestPractices: [
      'ActionLog 的 properties 中应当包括操作人、操作终端、操作前值和操作后值。',
      '配置日志自动归档与冷热存储策略，避免日志对象基数过大影响核心实体遍历性能。'
    ],
    antiPatterns: [
      {
        title: '历史蒸发 (History Evaporation)',
        bad: '直接在 Task 对象上 UPDATE 更新进度，导致上周的进度、流转过程、每次审批的修改说明全部丢失。',
        good: '每次更新通过 Action 在回写 Task 的同时，INSERT 一个 ActionLog，通过 1:N Link 挂接于该 Task 之下。'
      }
    ],
    description: '事件溯源是企业级 Ontology 的必修课。这使得业务大盘不仅能回溯“谁做了什么”，还能随时拉取任意任务的生命周期时间线视图。',
    layer: 'relations',
    mermaid: `graph TD\n  User[User Action] -->|触发事务| Act[Action: UpdateTask]\n  Act -->|1. 修改属性| Task[Task: 任务实体]\n  Act -->|2. 增量写入| Log[ActionLog: 审计日志]\n  Log -->|1:N Timestamp Link| Task`
  },
  {
    id: 'risk-propagation',
    categoryId: 'abstractions',
    categoryTitle: '3. 复杂业务抽象 (Complex Abstractions)',
    title: '路径传导与因果网络',
    iconName: 'AlertTriangle',
    brief: '模拟现实中的依赖关系与故障多米诺骨牌级联，分析风险如何在基础设施与业务层之间传递。',
    seedIds: ['risk-investigation'],
    coreNodes: ['RiskEvent', 'TechnicalComponent', 'ServiceIndicator'],
    principles: [
      '因果依赖关联化：在实体与指示器、服务之间建立影响线（Impact Link），标明依赖与传导权重。',
      '传导影响可计算：当最底层的“物理节点”发生报警时，图谱遍历算法应当能自动推演出它会威胁到哪些“业务模块”。',
      '根因定位链路化：当业务大盘指标报错，可沿有向 Link 拓扑反向搜寻，自动定位到故障根因节点。'
    ],
    bestPractices: [
      '在传导 Link Type 上定义“衰减/传导权重 (Weight)”，这能为后续的逆向因果计算提供因子。',
      '在物理资产上配置自愈（Hot-standby）属性，有助于图算法过滤无影响的虚警告警。'
    ],
    antiPatterns: [
      {
        title: '单体孤岛建模 (Operational Silo)',
        bad: '基础设施模型与业务逻辑层完全隔离，机房停电了但系统无法计算它影响了哪些商业合同，导致应急决策迟缓。',
        good: '打通“硬件设备 -> 技术服务 -> 核心产品 -> 商业指标”的全链路关联，构建动态因果网络模型。'
      }
    ],
    description: '路径依赖传导是 Palantir 式 Ontology 建模的关键体现。我们定义关联线不仅仅是为了“美观”，更是为了能够通过图算法计算物理事件级联引发的连锁反应。',
    layer: 'relations',
    mermaid: `graph TD\n  Risk[RiskEvent: 故障告警] -->|引发 1.0| Comp[Component: 核心组件]\n  Comp -->|引发 0.8| Srv[Service: 关联微服务]\n  Srv -->|级联影响| Biz[Indicator: 业务核心指标]`
  },
  {
    id: 'introspection-insight',
    categoryId: 'methodology',
    categoryTitle: '4. 高阶建模方法 (Advanced Methodology)',
    title: '模型自省与决策闭环',
    iconName: 'HelpCircle',
    brief: '定义“反思”与“洞察”为第一等公民，使本体论模型具备自我诊断、数据智能演进与决策回写能力。',
    seedIds: ['ontology-lv5'],
    coreNodes: ['Introspection', 'Insight', 'Action'],
    principles: [
      '决策实体一等化：系统做出的每一项诊断（Insight）、人类进行的反思（Introspection）均应建模为实体，使它们可关联、可被二层推理。',
      '持续修正闭环：自省与诊断结果可以触发相应的修正 Actions，并产生回写，调整模型的参数与连接关系。',
      '解释路径可视化：AI 推荐或系统判断，应当和支持这一决策的原始数据对象直接建立 Link，使其具备完全的可解释性。'
    ],
    bestPractices: [
      '利用 Agent 发现实体数据不一致或发现指标下降时，由系统自动实例化一个 Insight 节点挂接到该对象之下。',
      '在自进化模型中，使用反思机制存储每一次人类对 AI 建议的微调反馈，以此作为持续训练和微调的本地语料。'
    ],
    antiPatterns: [
      {
        title: '静态只读死模型 (Read-Only Dead Model)',
        bad: '本体系统仅作为大屏查看工具，无法让决策参与数据流动，系统退化为普通静态看板，对商业无实质赋能。',
        good: '通过 Action 实现操作回写，并在系统内闭环“诊断发现 -> 人机确认 -> 行动修正 -> 再次评估”的活体模型演进。'
      }
    ],
    description: '一个健康的本体系统一定是个自适应系统。通过将“自省/反思”与“决策”纳入对象连线网络，数据、AI 与人的智慧相互流转，支撑模型的持续自优化。',
    layer: 'methodology',
    mermaid: `graph TD\n  Obj[Target Object: 核心实体] -->|数据流异常| Ins[Insight: 异常诊断]\n  Ins -->|引发反思| Intro[Introspection: 人类反思/标记]\n  Intro -->|决策回写| Act[Action: 修正行动]\n  Act -->|自动调整关系| Obj`
  }
];
