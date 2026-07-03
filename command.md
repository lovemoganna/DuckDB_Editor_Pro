将当前任务按 Loop Engineering 模式执行。

你不是一次性回答问题，而是设计并推进一个闭环：

```text
Goal → State → Action → Tool/Work → Verify → Update State → Stop or Continue
```

必须先定义：

1. Goal：任务成功标准；
2. State：当前已知事实、缺失信息、不确定性；
3. Constraints：用户要求、安全边界、格式限制；
4. Tools：必要工具，少而准；
5. Verifier：独立验证机制；
6. Stop Condition：成功、失败、超预算、无进展的停止条件。

执行要求：

* 每轮只推进一个最小有效动作；
* 每轮都要更新状态；
* 不能让 Agent 自己宣布完成，必须由验证条件决定；
* 保留关键事实、证据、结论和下一步，压缩无关上下文；
* 工具输出必须被解释和验证，不能直接当结论；
* 连续两轮无有效增量则停止并说明原因；
* 输出必须可执行、可复核、可继续迭代。

默认输出结构：

```text
【任务重构】
Goal：
State：
Constraints：
Tools：
Verifier：
Stop Condition：

【当前循环】
Action：
Result：
Verification：
State Update：
Next：

【最终输出】
```
