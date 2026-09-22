/**
 * OntologyMethodologyView.tsx - 本体建模核心思考方法论全景视图
 * 
 * 核心设计目标：
 * 1. 彻底解答「为什么需要本体」与「传统表连接模型的根本缺陷」；
 * 2. 结构化传授「OPLA (Object / Property / Link / Action) 思考四步法」心智模型；
 * 3. 决策罗盘与反模式避坑指南；
 * 4. 4道工业级业务边界辨析互动速测；
 * 5. 一键直达独立建模工坊实操。
 */

import React, { useState } from 'react';
import { 
  Sparkles, ArrowRight, CheckCircle2, AlertTriangle, Zap,
  BookOpen, RefreshCw, Compass, Lightbulb, CheckSquare, Award
} from 'lucide-react';

interface OntologyMethodologyViewProps {
  onStartWorkshop: (presetCaseId?: string) => void;
  onExploreCurriculum: () => void;
}

export const OntologyMethodologyView: React.FC<OntologyMethodologyViewProps> = ({
  onStartWorkshop,
  onExploreCurriculum,
}) => {
  // 速测单选状态
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<number>>(new Set());

  // 4道工业级速测试题
  const quizQuestions = [
    {
      id: 1,
      title: '场景 1：冷链异常事件的身份确立',
      question: '冷链干线运输中，「车载温控传感器连续 15 分钟上报超温告警」，在本体建模中应如何抽象？',
      options: [
        'A. 直接作为货车表的一个 `is_alarm` 布尔属性 (Property)',
        'B. 抽象为一个独立的事件型对象 `TempAlertIncident` (Object)',
        'C. 记录为订单与传感器连线上的一个临时权重 (Link Property)',
        'D. 忽略它，等客户投诉后再在客服系统补录',
      ],
      correctIndex: 1,
      explanation: '【架构师解析】：温超事故本身具有不可篡改的发生时间、峰值温度、等级判定、关联的运单与责任司机，并且是后续「紧急排险 Action」和「保险理赔 Action」的直接证据源。它具备独立业务生命周期，必须建模为独立 Object，绝不能扁平化为一个单点布尔字段。',
    },
    {
      id: 2,
      title: '场景 2：实体关联的语义化',
      question: '业务材料显示「货运订单在干线阶段由重型冷藏车承运」，本体网络应该如何表达？',
      options: [
        'A. 在订单表无脑增加一个 `truck_name` 纯文字段',
        'B. 建立 `Order -> TRANSPORTED_BY -> Truck` 的有向语义 Link',
        'C. 建立一个无语义的 `RELATED_TO` 双向关联',
        'D. 把车辆当成订单的子属性合并为单张大宽表',
      ],
      correctIndex: 1,
      explanation: '【架构师解析】：本体网络拒绝没有业务语义的弱连接。使用强业务动词谓词 `TRANSPORTED_BY`，不仅清晰定义了实体间的承载关系，还支持随时间发生的换车、挂车中转因果追溯，这是传统外键做不到的。',
    },
    {
      id: 3,
      title: '场景 3：行动与业务闭环',
      question: '调度员发现车辆温度异常后，「下发紧急就近进中转冷库排险指令」，对应本体的什么要素？',
      options: [
        'A. 一个普通的数据库 UPDATE SQL 查询',
        'B. 一个只读的报表指标 (Metric)',
        'C. 一个封装了前置条件校验、状态机流转与审计日志的 Action',
        'D. 一个新的 Link 关系',
      ],
      correctIndex: 2,
      explanation: '【架构师解析】：Action 是本体区别于传统静态图谱的核心灵魂！它校验前置守卫（中转库是否有剩余库容）、触发状态迁移（车辆状态变为 DIVERTED），并固化不可变审计日志，打通从认知到决策执行的最后一公里。',
    },
    {
      id: 4,
      title: '场景 4：严禁脑补的未知边界',
      question: '运单材料写明「大连发往北京，14:00在高速发生温超」，材料完全未提副驾驶员姓名，新人工程师该怎么做？',
      options: [
        'A. 凭行业惯例推测长途货运必有副驾，填上"默认副驾"',
        'B. 将副驾姓名直接留空为 NULL，不做任何边界标记',
        'C. 显式建模未知边界，记录"副驾人员信息缺失/需调度回溯核实"',
        'D. 随便写一个公司调度员的名字充当副驾',
      ],
      correctIndex: 2,
      explanation: '【架构师解析】：本体建模第一铁律——「只写材料真正告诉你的事」。任何主观脑补都是沙上建塔。显式建模未知边界，才能指导后续 Action 自动发起数据补全任务，保持系统高置信度。',
    },
  ];

  const handleSelectQuiz = (qId: number, optIdx: number) => {
    setSelectedAnswers(prev => ({ ...prev, [qId]: optIdx }));
    setSubmittedQuestions(prev => new Set(prev).add(qId));
  };

  const handleResetQuiz = (qId: number) => {
    setSelectedAnswers(prev => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
    setSubmittedQuestions(prev => {
      const next = new Set(prev);
      next.delete(qId);
      return next;
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16 px-2">
      {/* 1. Hero 认知革命区 */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#12171f] via-[#0c1015] to-[#12171f] border border-zinc-800 p-8 shadow-2xl">
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>本体建模思维方法论 · The OPLA Paradigm</span>
          </div>

          <h2 className="text-2xl lg:text-3xl font-bold text-white tracking-tight leading-snug">
            从数据表孤岛到业务认知智能：
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 ml-2">
              OPLA 本体四步思考法
            </span>
          </h2>

          <p className="mt-3 text-sm lg:text-base text-zinc-400 max-w-3xl leading-relaxed">
            在传统开发中，我们习惯直接画 E-R 图或建 SQL 宽表。但随着业务复杂度剧增，多表多源割裂、JOIN 爆炸、缺乏因果关联、只有死数据没有业务行动。
            <strong className="text-zinc-200">本体（Ontology）</strong>是现实业务世界在数字空间的数字孪生镜像，通过
            <span className="text-cyan-400 font-semibold"> Object (实体)</span>、
            <span className="text-amber-400 font-semibold"> Property (属性)</span>、
            <span className="text-sky-400 font-semibold"> Link (关系拓扑)</span> 与
            <span className="text-emerald-400 font-semibold"> Action (闭环行动)</span>，
            让数据真正具备决策智能。
          </p>

          {/* 传统架构 vs 本体架构 对比矩阵 */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#0c1015]/80 border border-rose-500/30 relative">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>传统关系型数据库思维（痛点局限）</span>
              </div>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">✕</span>
                  <span><strong className="text-zinc-300">业务语义断层：</strong>冷冰冰的字段名，只有外键 ID 关联，丢失了现实业务因果与动词语境。</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">✕</span>
                  <span><strong className="text-zinc-300">查询维护爆炸：</strong>随着微服务扩展，跨 8 张甚至 15 张表 JOIN，性能劣化且难以理解。</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">✕</span>
                  <span><strong className="text-zinc-300">单向只读死图：</strong>只能用于事后出报表，无法在业务异常发生时执行安全的前置守卫与自动化写回。</span>
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-[#0c1015]/80 border border-cyan-500/30 relative">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Palantir 现代本体认知思维（OPLA 优势）</span>
              </div>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">✓</span>
                  <span><strong className="text-zinc-300">以业务主体为中心：</strong>每个 Object 拥有独立生命周期，事件也是一等公民，严禁主观经验脑补。</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">✓</span>
                  <span><strong className="text-zinc-300">强动词因果拓扑：</strong>有向加权的 Link 表达真实的业务互动（承运、监护、触发、溯源）。</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">✓</span>
                  <span><strong className="text-zinc-300">双向闭环 Action：</strong>集成硬约束校验与状态机迁移，让 AI 或业务人员能够基于语义安全下发操作。</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 快捷跳转实战工坊 */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onStartWorkshop('case-coldchain-shunda')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 text-black font-bold text-xs hover:opacity-95 transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>进入【顺达冷链】OPLA 独立建模工坊实操</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onExploreCurriculum}
              className="px-4 py-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span>查看 14 门体系化进阶课程</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. OPLA 四大核心要素认知体系 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-cyan-400" />
              <span>本体建模思考四步法：OPLA 核心要素精解</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              按照严格的认知因果顺序展开，从实体识别到双向闭环
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Object 卡片 */}
          <div className="p-5 rounded-xl bg-[#12171f] border border-cyan-500/30 flex flex-col justify-between hover:border-cyan-500/60 transition-all group">
            <div>
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-mono font-bold text-sm mb-3">
                O
              </div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors">
                  Object 实体
                </h4>
                <span className="text-[10px] text-cyan-400 bg-cyan-500/15 px-2 py-0.5 rounded">第 1 步</span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mb-2.5">
                Who & What · 业务主体与事件容器
              </p>
              <p className="text-xs text-zinc-300 leading-relaxed">
                现实世界中具备<strong className="text-white">独立业务生命周期</strong>、唯一身份标识的主体、物理载体或关键事件容器（如：运单、冷藏车、温超异常事故）。
              </p>
              <div className="mt-3 p-2.5 rounded bg-[#0c1015]/80 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
                <span className="text-cyan-400 font-semibold">【思考口诀】：</span>
                它能否脱离其他概念独立存在？是否有自己的状态变迁？如果是，必须立为 Object！
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800 text-[11px] text-cyan-400/80">
              典型范例：`ShipmentOrder`, `ReeferTruck`
            </div>
          </div>

          {/* Property 卡片 */}
          <div className="p-5 rounded-xl bg-[#12171f] border border-amber-500/30 flex flex-col justify-between hover:border-amber-500/60 transition-all group">
            <div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-mono font-bold text-sm mb-3">
                P
              </div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                  Property 属性
                </h4>
                <span className="text-[10px] text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded">第 2 步</span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mb-2.5">
                State & Measure · 静态特征与度量
              </p>
              <p className="text-xs text-zinc-300 leading-relaxed">
                依附于 Object 存在的特征维度与度量。分为<strong className="text-white">不可变身份</strong>（VIN码）、<strong className="text-white">时变状态机</strong>（进行中/已报废）与<strong className="text-white">实时派生指标</strong>（超时分钟数）。
              </p>
              <div className="mt-3 p-2.5 rounded bg-[#0c1015]/80 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
                <span className="text-amber-400 font-semibold">【思考口诀】：</span>
                不要把需要跨业务分析的独立实体扁平化成一串死字符串；不要把简单属性膨胀成孤立 Object。
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800 text-[11px] text-amber-400/80">
              典型范例：`max_temp`, `cargo_value`, `battery_pct`
            </div>
          </div>

          {/* Link 卡片 */}
          <div className="p-5 rounded-xl bg-[#12171f] border border-sky-500/30 flex flex-col justify-between hover:border-sky-500/60 transition-all group">
            <div>
              <div className="w-10 h-10 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 font-mono font-bold text-sm mb-3">
                L
              </div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-base font-bold text-white group-hover:text-sky-400 transition-colors">
                  Link 关系拓扑
                </h4>
                <span className="text-[10px] text-sky-400 bg-sky-500/15 px-2 py-0.5 rounded">第 3 步</span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mb-2.5">
                Network & Causality · 强动词与因果链
              </p>
              <p className="text-xs text-zinc-300 leading-relaxed">
                实体之间的<strong className="text-white">有向业务动词连接</strong>。严禁使用模糊的 `RELATED_TO`，必须使用具象动词（如 `TRANSPORTED_BY`, `MONITORED_BY`, `ESCALATED_FROM`），支持基数与事件溯源。
              </p>
              <div className="mt-3 p-2.5 rounded bg-[#0c1015]/80 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
                <span className="text-sky-400 font-semibold">【思考口诀】：</span>
                每一条线都必须能读成一个业务动作句子：“运单 [TRANSPORTED_BY] 冷藏车”。
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800 text-[11px] text-sky-400/80">
              典型范例：`TRANSPORTED_BY`, `MONITORED_BY`
            </div>
          </div>

          {/* Action 卡片 */}
          <div className="p-5 rounded-xl bg-[#12171f] border border-emerald-500/30 flex flex-col justify-between hover:border-emerald-500/60 transition-all group">
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-mono font-bold text-sm mb-3">
                A
              </div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Action 业务闭环
                </h4>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">第 4 步</span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mb-2.5">
                Mutation & Loop · 前置守卫与写操作
              </p>
              <p className="text-xs text-zinc-300 leading-relaxed">
                从静态查询迈向闭环决策的<strong className="text-white">业务扳机</strong>。包含执行角色、前置安全校验守卫 (Precondition)、状态机迁移 (Mutation) 与不可变审计日志。
              </p>
              <div className="mt-3 p-2.5 rounded bg-[#0c1015]/80 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
                <span className="text-emerald-400 font-semibold">【思考口诀】：</span>
                没有 Action 的本体是一张死图纸，有了 Action 才是能让 AI 执行现实业务的执行器！
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800 text-[11px] text-emerald-400/80">
              典型范例：`DispatchTruck`, `EmergencyReroute`
            </div>
          </div>
        </div>
      </section>

      {/* 3. 决策罗盘与四大反模式避坑指南 */}
      <section className="p-6 rounded-2xl bg-[#12171f] border border-zinc-800 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              <span>架构决策罗盘：如何准确做出建模判断？</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              规避 90% 新手常犯的传统表思维惯性与过度设计陷阱
            </p>
          </div>
        </div>

        {/* 决策维度一：Object vs Property 决策树 */}
        <div className="space-y-2 mb-6">
          <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>决策维度一 · Object vs Property 架构决策树</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#0c1015]/80 border border-zinc-800">
              <div className="text-xs font-bold text-cyan-400 mb-1.5">① 独立生命周期测试</div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                问：如果把关联的主实体删掉，这个概念是否在真实业务世界中仍然有记录价值？
                <br /><strong className="text-white">是 → Object</strong>（例如司机离职了，该货车实体依然存在）；
                <br /><strong className="text-white">否 → Property</strong>（例如司机的靴子尺码，随司机存在而存在）。
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#0c1015]/80 border border-zinc-800">
              <div className="text-xs font-bold text-amber-400 mb-1.5">② 跨域关联度测试</div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                问：这个概念是否需要被其他系统或不同的 Object 多次关联引用？
                <br /><strong className="text-white">是 → Object</strong>（例如"冷库"，不仅与运单关联，还与电力调度系统关联）；
                <br /><strong className="text-white">否 → Property</strong>（例如纯收货备注文字）。
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#0c1015]/80 border border-zinc-800">
              <div className="text-xs font-bold text-emerald-400 mb-1.5">③ 事件容器测试</div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                问：它是一次性的业务动作/事故吗？有具体的发生时间戳和多方牵连吗？
                <br /><strong className="text-white">是 → 事件型 Object</strong>（如"温超告警事件 INC-001"）；
                <br /><strong className="text-white">否 → 状态 Property</strong>（如单纯 status = ALERT）。
              </p>
            </div>
          </div>
        </div>

        {/* 决策维度二：Link vs Action 闭环决策 */}
        <div className="space-y-2 pt-4 border-t border-zinc-800/80">
          <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>决策维度二 · Link vs Action 闭环决策</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#0c1015]/80 border border-zinc-800">
              <div className="text-xs font-bold text-sky-400 mb-1.5">Link 的核心定位：描述关系与拓扑结构</div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Link 是<strong className="text-white">名词实体之间的有向谓词连线</strong>。
                它表达的是：“实体 A 与实体 B 目前存在某种经材料证实的结构化联系”。
                Link 可以带有生成时间，但它本身不负责验证前置条件，也不负责直接触发业务系统的写入副作用。
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#0c1015]/80 border border-zinc-800">
              <div className="text-xs font-bold text-emerald-400 mb-1.5">Action 的核心定位：改变世界的可信操作</div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Action 是<strong className="text-white">业务状态跃迁与写入指令</strong>。
                例如“派车发运”、“紧急改道”、“赔付打款”。它必须明确谁能触发 (Actor)、在什么硬条件下触发 (Preconditions)、修改了哪些 Object 的状态机，并生成一条不可被篡改的事件审计日志。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. 交互式业务边界辨析速测 (4道题) */}
      <section className="p-6 rounded-2xl bg-[#12171f] border border-zinc-800 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-cyan-400" />
              <span>直觉速测自检：你真正掌握本体建模心智了吗？</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              4 道工业级现场难题，点击选项即时获得架构师视角的深度辨析
            </p>
          </div>
          <div className="text-xs text-zinc-400">
            完成度：
            <span className="text-cyan-400 font-bold font-mono ml-1">
              {submittedQuestions.size}/4
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizQuestions.map(q => {
            const isAnswered = submittedQuestions.has(q.id);
            const userChoice = selectedAnswers[q.id];
            const isCorrect = userChoice === q.correctIndex;

            return (
              <div 
                key={q.id}
                className={`p-4 rounded-xl border transition-all ${
                  isAnswered
                    ? isCorrect
                      ? 'bg-emerald-500/10 border-emerald-500/40'
                      : 'bg-rose-500/10 border-rose-500/40'
                    : 'bg-[#0c1015]/80 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-cyan-400 bg-cyan-500/15 px-2 py-0.5 rounded">
                    {q.title}
                  </span>
                  {isAnswered && (
                    <button
                      onClick={() => handleResetQuiz(q.id)}
                      className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>重测</span>
                    </button>
                  )}
                </div>

                <p className="text-xs font-medium text-white mb-3 leading-relaxed">
                  {q.question}
                </p>

                <div className="space-y-1.5">
                  {q.options.map((opt, idx) => {
                    let btnStyle = 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:text-white hover:bg-zinc-800';
                    if (isAnswered) {
                      if (idx === q.correctIndex) {
                        btnStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-semibold';
                      } else if (idx === userChoice) {
                        btnStyle = 'bg-rose-500/20 border-rose-500 text-rose-400 line-through';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        disabled={isAnswered}
                        onClick={() => handleSelectQuiz(q.id, idx)}
                        className={`w-full text-left p-2 rounded-lg border text-xs transition-all cursor-pointer ${btnStyle}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {isAnswered && (
                  <div className="mt-3 pt-2.5 border-t border-zinc-800 text-[11px] leading-relaxed">
                    <div className={`font-semibold mb-1 flex items-center gap-1.5 ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      <span>{isCorrect ? '回答正确！' : '选择有误，请注意思考误区：'}</span>
                    </div>
                    <p className="text-zinc-400">{q.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. 验收标准号召卡片 */}
      <section className="p-6 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-sky-500/10 to-purple-500/10 border border-cyan-500/30 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Award className="w-4 h-4" />
            <span>最终验收标准目标达成通道</span>
          </div>
          <h4 className="text-lg font-bold text-white">
            准备好动手了吗？独立完成一个完整的 OPLA 建模 Case！
          </h4>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            理论看完只能建立感性认知。在「独立建模工坊」中，你将亲自动手提炼实体、定义属性、建立拓扑、编排 Action，并通过 DuckDB 实机执行检验！
          </p>
        </div>

        <button
          onClick={() => onStartWorkshop('case-coldchain-shunda')}
          className="px-6 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-sm transition-all flex items-center gap-2 shrink-0 shadow-lg shadow-cyan-500/20 cursor-pointer"
        >
          <span>立即启动 OPLA 独立建模工坊</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>
    </div>
  );
};

export default OntologyMethodologyView;
