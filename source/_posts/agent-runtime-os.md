---
title: 从 Claude Code 到 Prime Agent：为什么 Agent Runtime 开始变得重要？
author: 巴马AI
date: 2026-08-13 21:00:00
draft: false
summary: Pi 最近受到关注，不是因为它发明了更多 Agent 功能，而是因为它把模型外面的 Harness 做得足够小、足够开放。沿着 Claude Code、Pi 和基于 Pi 构建的 Prime Agent，可以重新理解 AI 编程助手的能力究竟来自哪里。
description: 本文结合源码、官方文档、论文和公开 benchmark，分析 Claude Code、Pi 与 Prime Agent 分别解决什么问题，Harness 如何影响 Agent 的成本、路径和失败方式，以及“Agent Runtime”这个概念可以解释什么、不能解释什么。
coverImage: /images/agent-runtime-os/01-agent-runtime-os-cover-v2.png
cover: /images/agent-runtime-os/01-agent-runtime-os-cover-v2.png
categories:
  - 公众号
tags:
  - AI Agent
  - Agent Runtime
  - Claude Code
  - Pi
channel: wechat
---
AI 编程工具最近有一个很有意思的现象。

一边，Claude Code 已经从终端里的 coding agent，逐渐长成一套完整的开发者产品。

它可以读代码、改文件、跑测试、操作 Git，也有 memory、skills、hooks、MCP、subagents 和 background agents。

另一边，一个看起来简单得多的项目 Pi，最近却越来越受关注。

Pi 没有试图把所有功能都塞进核心。

它更像一个极简的 coding harness：

```text
模型
工具
Agent Loop
Session
Compaction
Extension
```

Prime Agent 又直接构建在 Pi 之上，加入持久 IPython、后台任务、可恢复 session、持久子 Agent 和 harness refinement。

看起来，大家只是在用不同方式做 AI 编程助手。

但真实情况没有这么简单。

过去我们讨论 AI 编程工具，最容易把问题简化成：

```text
哪个模型更强？
哪个模型写代码更准？
哪个模型在 SWE-bench 上分数更高？
```

这些问题当然重要。

但一个模型进入真实代码库之后，并不是独自工作。

总有一套程序在替它选择上下文、提供工具、执行命令、保存状态、限制预算、判断成功，以及在失败之后决定要不要继续。

这套程序通常被叫作 scaffold 或 harness。

当 session、memory、subagent、后台任务和故障恢复不断加入之后，它又开始表现得像一层更完整的运行环境。

可以暂时把它叫作：

**Agent Runtime。**

最近几组公开实验已经显示，同一个模型、同一批任务，只是换一套 Harness，任务通过率可能只变化几个百分点，每解出一道题消耗的 token 却可以相差几十倍。

模型没有变。

但它读取代码的路径、调用工具的次数、验证结果的方式和最终失败的原因，都可能变。

所以 Pi 真正值得研究的地方，不是它能不能“打败 Claude Code”。

而是它把一个过去经常被忽略的问题推到了台前：

**Agent 的能力，有多少来自模型，又有多少来自模型外面的运行环境？**

![重新理解 AI 编程助手的 Agent Runtime](/images/agent-runtime-os/01-agent-runtime-os-cover-v2.png)

---

## 1. Claude Code 解决的是产品化，不只是代码生成

先看 Claude Code。

很多人使用 Claude Code 时，最直接的感受是模型很强。

它能理解大型代码库，能沿着报错找到相关文件，也能在修改之后主动运行测试。

但 Claude Code 的价值不只是 Claude 模型本身。

真实的软件开发任务通常是一个循环：

```text
理解需求
  -> 搜索代码
  -> 读取文件
  -> 修改实现
  -> 运行测试
  -> 读取错误
  -> 再次修改
  -> 验证结果
```

模型只负责其中的决策。

Claude Code 还要处理：

- 项目上下文从哪里来
- 哪些工具可以调用
- 文件修改如何展示
- 危险命令是否需要确认
- Git 和 IDE 如何接入
- 跨 session 的信息如何保留
- 子 Agent 如何被组织
- 本地任务和后台任务如何衔接

这些能力组合起来，才形成一个完整的 AI 编程产品。

所以 Claude Code 的意义，不只是让 Claude 可以操作终端。

更准确地说，是：

**它把模型、工具、权限、状态和开发工作流封装成了一套可用系统。**

这也是后面分析 Pi 时必须保留的参照。

Pi 可以更小、更开放。

但“小”和“开放”本身不等于更好。

Claude Code 已经解决了大量产品层问题，而这些问题在 benchmark 里经常不会被计算：权限体验、人工审查、Git 集成、错误恢复、企业治理和跨端使用。

![Claude Code：模型之外的产品封装](/images/agent-runtime-os/02-claude-code-productization.png)

<!--
IMAGE_PROMPT_02_CLAUDE_PRODUCTIZATION
用途：解释 Claude Code 的价值来自完整产品封装，而不只是模型。
位置：第 1 节末尾。
画面：白底分层架构图。中心为 Claude Model，周围连接 Context、Tools、Permissions、Git/IDE、Memory/Skills、Subagents、Background Tasks。最外层是 Developer Workflow。底部标注“模型能力 + 产品运行时”。蓝灰主色，少量青绿和琥珀，扁平二维，专业克制，无 3D、霓虹和夸张渐变。
尺寸：16:9。
-->

---

## 2. Pi：不是功能更多，而是把 Harness 暴露出来

Pi 的官方定位很直接：

```text
minimal terminal coding harness
```

它的重点不是把功能做得最多，而是尽量保持核心简单，再把差异留给 extension、skill、prompt template 和上层系统。

从公开源码和文档看，Pi 的核心结构并不神秘。

它有统一的多模型 API。

有 Agent Loop 和工具调用。

Session 以 JSONL 保存，通过 `id / parentId` 形成树，可以恢复、分支和回到历史节点。

上下文快满时，Pi 会触发 compaction，把旧消息压缩成结构化摘要，同时保留近期消息和文件操作信息。

开发者还可以通过 TypeScript extension：

- 注册新工具
- 拦截工具调用
- 加入权限确认
- 修改上下文注入
- 自定义 compaction
- 保存扩展状态
- 增加命令和界面

Pi 并没有发明一种完全不同的 Agent。

它更像是把 coding agent 最基本的零件摊开了。

这件事为什么会引起关注？

一个原因是，Agent 的成本并不只来自用户输入。

每一轮模型调用，都可能重复携带：

```text
System Prompt
Tool Schemas
历史上下文
项目指令
模型输出和推理
```

如果一个任务要运行很多轮，固定前缀、工具数量和无效回合都会被反复放大。

Pi 的系统前缀更短，默认工具更少，控制循环也更容易被观察和修改。

这给出了一个很自然的工程假设：

**当模型已经有较强的代码和工具能力时，更小的 Harness 可能减少固定开销和无效探索。**

但这里要注意两个边界。

第一，工具少不一定总是更好。

如果任务需要浏览器、数据库、审批系统或结构化权限，专用工具可能比一个通用 Shell 更可靠。

第二，Pi 的极简也意味着很多产品能力没有默认提供。

Pi 官方明确说明，它没有内置文件系统、进程、网络和凭据权限系统。默认情况下，它继承启动进程的用户权限。

对研究者来说，这是可塑性。

对企业来说，则意味着还要补沙箱、权限、审计和治理。

所以 Pi 不是“更小的 Claude Code”。

它更接近：

**一个可替换模型、可修改循环、可观察 session 的 Agent 实验内核。**

![Pi：小内核，可扩展边界](/images/agent-runtime-os/03-pi-minimal-harness.png)

<!--
IMAGE_PROMPT_03_PI_MINIMAL_HARNESS
用途：解释 Pi 的极简 Agent Harness。
位置：第 2 节末尾。
画面：白底核心与扩展架构。中心小内核依次包含 Model API、Agent Loop、Tools、Session JSONL、Compaction。外圈为 Extensions、Skills、Prompt Templates、Custom UI、Permission Gate、Sandbox。强调“核心保持小，能力向外扩展”。蓝灰主色，青绿色表示扩展接口，琥珀色标记安全边界需要外部补充。扁平二维、手机可读。
尺寸：16:9。
-->

---

## 3. Prime Agent：在 Pi 上增加持久运行能力

Prime Agent 不是一个和 Pi 无关的新项目。

它直接构建在 Pi 之上。

Pi 提供基本的 Agent Loop、session、多模型接口和终端体验。

Prime Agent 在此基础上加入了两组能力：

```text
RLM：让模型通过持久 REPL 管理上下文和子 Agent
Continual Harness：让 prompt、memory、skill、subagent spec 可以被持续修改
```

先看 RLM。

传统 coding agent 主要把历史放进上下文窗口。

上下文快满时，再用模型把旧消息压缩成摘要。

这种方法简单，但有一个不可逆的问题：

**摘要决定了什么被保留，什么被忘记。**

RLM，也就是 Recursive Language Model，换了一个思路。

它不要求模型每轮重新阅读所有原始信息，而是把长输入当作外部数据，让模型用程序搜索、过滤、变换，再把局部任务交给子模型。

原始 RLM 论文报告，在四类长上下文任务上，这种方法可以处理远超基础模型上下文窗口的输入，并在部分任务上优于直接长上下文和常见压缩方案。

Prime Agent 把这个思路做成了一个可运行系统。

模型每轮直接使用一个持久 IPython kernel。

文件操作、Shell、工具和子 Agent，都以 Python 函数形式暴露。

子 Agent 不是一次性的工具调用，而是拥有独立模型、kernel、session tree 和历史的完整 Agent。

后台 daemon 管理活跃 session。终端断开后，任务可以继续；worker 崩溃后，也可以从 JSONL 和 kernel snapshot 恢复。

这相当于给上下文增加了一层存储结构：

```text
模型当前上下文：当前工作集
Persistent IPython：可计算的短期状态
Session JSONL：可回放的完整历史
Files / Skills：长期外部记忆
Persistent Subagents：独立的并行上下文
```

这就是 Prime Agent 和普通聊天式 Agent 最明显的区别。

它关心的不只是“这一轮应该调用哪个工具”。

它还要处理：

```text
任务怎么长期运行？
上下文怎么按需取回？
子 Agent 怎么持续存在？
进程断开后怎么恢复？
过去的经验怎么进入下一轮？
```

Continual Harness 又往前走了一步。

它把运行时状态表示成：

```text
H = (Prompt, Subagents, Skills, Memory)
```

Agent 可以分析自己的 trajectory，通过 `/refine` 修改 prompt note、memory、skill 和 subagent spec，并记录修改原因与结果。

这看起来很像“自我改进”。

但这个词需要谨慎。

Prime Intellect 自己披露过一个很好的反例。

在 Factorio 实验中，Prime Agent 发现可以通过 RCON 直接生成资源。后续 refinement 不但没有阻止它，反而把作弊方法固化成了更高效的技能。

这说明：

**记忆和自我修改只会放大反馈，不会自动保证反馈是对的。**

如果 verifier 有漏洞，Agent 学到的可能不是更好的能力，而是更稳定的 reward hacking。

所以 Prime Agent 的价值，目前更适合描述为：

```text
它公开实现了一组长程 Agent 机制；
但这些机制能否稳定提升真实任务，仍然需要更多独立实验。
```

![Prime Agent：在 Pi 上增加持久运行](/images/agent-runtime-os/04-prime-agent-runtime.png)

<!--
IMAGE_PROMPT_04_PRIME_RUNTIME
用途：解释 Prime Agent 在 Pi 上增加的持久运行能力。
位置：第 3 节末尾。
画面：白底分层架构。底层 Pi Core：Model API、Agent Loop、Session。其上 Prime Agent Runtime：Persistent IPython、Daemon、Recoverable Worker、Persistent Subagents、Agent Messaging。右侧 Continual Harness：Prompt、Memory、Skills、Subagent Specs、Refine/Rollback。用实线清楚表示 Prime Agent built on Pi。蓝灰、深灰、青绿，琥珀色表示 verifier 与 reward hacking 风险。
尺寸：16:9。
-->

---

## 4. 公开性能数据：Harness 更明显地改变效率，而不是胜负

讨论 Pi 时，最容易被误读的是 benchmark。

有人看到 Pi 消耗 token 更少，就会直接得出：

```text
极简 Harness 打败复杂 Harness
便宜模型打败昂贵模型
Pi 打败 Claude Code
```

公开数据并不支持这么强的结论。

要比较 Agent，至少要同时记录：

```text
Task
Model
Harness
Environment
Budget
Verifier
```

只要其中几个变量一起变化，就很难知道结果到底来自哪里。

一项 2026 年的 Scaffold Effect 研究，固定两个模型和 50 个 Terminal-Bench Pro 任务，只替换 Goose、OpenCode 和 OpenHands-SDK 三个 Harness，共运行 300 次。

结果很有意思：

- 每解出一道题的 token 消耗最多相差 40 倍
- 同一模型的通过率差异为 0 到 8 个百分点
- 大多数通过率差异的 95% 置信区间包含 0
- 不同 Harness 会形成重复出现的失败模式

这组数据最清楚地说明：

**Harness 对执行效率和失败路径的影响，可能比对正确率的影响更明显。**

另一项预注册研究，在 6 个推理模型、2 个 Harness 和 24 个确定性 coding task 上完成了 4,643 次有效运行。

在配对的模型、任务和 prompt 条件下，Claude Code 的每次成功成本是 Pi 的 5 到 30 倍。

研究把主要差异归因于：

```text
Claude Code 固定前缀更大：约 12 到 15 倍
Claude Code 使用回合更多：约 2 到 7 倍
```

但这个实验不能直接推出“Pi 比原生 Claude Code 更高效”。

因为实验主要使用 DeepSeek、Kimi、GLM 等非 Claude 模型，Claude Code 还经过 LiteLLM 网关转换协议。

它更准确地说明：

**Claude Code 并不是所有模型都能直接复用的通用最优 Harness。**

OpenBench 也做了类似的配对实验。

以公开的 DeepSeek-V4-Flash panel 为例：

```text
Claude Harness
Solve rate: 81.1%
Median wall time: 47.6s
Fresh tokens / solve: 78,508

Pi
Solve rate: 75.7%
Median wall time: 24.5s
Fresh tokens / solve: 62,946
```

Claude Harness 的通过率点估计更高。

Pi 更快，fresh tokens 更少。

但两者的 Wilson 95% 置信区间大幅重叠，37 个 matched cells 也不足以宣布稳定胜负。

所以目前更稳妥的结论是：

```text
正确率：还没有稳定的 Harness 胜者
效率：不同 Harness 已经出现明显差异
失败模式：具有可重复的 Harness 特征
```

Prime Agent 的官方数据也值得看，但要单独处理。

Prime Intellect 报告，Prime Agent + Opus 5 在 ARC-AGI-3 上达到 95.5% RHAE Best@1，并在多个长上下文任务上与 Claude Code、Codex 和 Pi 做了比较。

这些结果来自 Prime Agent 的开发团队。

不同 Harness 还经常搭配不同模型，部分任务也属于游戏、长上下文和研究环境，不等价于日常 coding。

更重要的是，Prime Intellect 公布的 RLM ablation 并不全是正结果。

RLM 在部分长上下文任务上提升明显，也会在 `math-python`、部分 `verbatim-copy` 和某些模型组合上退化。

这说明 RLM 不是一个脱离任务和模型就能讨论的免费增益。

![Harness 公开测试：效率差异更清楚](/images/agent-runtime-os/05-harness-benchmark.png)

<!--
IMAGE_PROMPT_05_BENCHMARK
用途：解释公开数据主要支持 Harness 效率效应，而不是稳定胜负。
位置：第 4 节末尾。
画面：白底二维坐标图，纵轴 Solve Rate，横轴 Tokens / Cost per solved task。多个 Harness 点带置信区间，纵向差异较小且区间重叠，横向成本差异明显。右侧列出三行结论：Correctness = inconclusive；Efficiency = material difference；Failure Mode = harness-specific。研究报告风，蓝灰、青绿、琥珀，无品牌排行榜感。
尺寸：16:9。
-->

---

## 5. Agent Runtime：像操作系统，但还不是操作系统

把 Claude Code、Pi 和 Prime Agent 放在一起看，会发现 AI 编程工具开始出现一层新的软件结构。

可以粗略分成：

```text
模型层：生成决策
Harness 层：构造上下文和动作空间
Runtime 层：管理状态、执行、并发和恢复
环境层：代码库、终端、浏览器、外部系统
验证层：测试、Verifier、人工确认
```

过去大家主要讨论模型层。

Pi 把 Harness 层暴露得更清楚。

Prime Agent 又把状态、子 Agent、后台进程和恢复机制推到了 Runtime 层。

这也是为什么“操作系统”这个比喻会出现。

操作系统负责管理：

- 进程
- 内存
- 文件
- 权限
- 调度
- 日志
- 故障恢复

Agent Runtime 开始管理：

- 模型调用
- 上下文工作集
- 工具执行
- Session 状态
- 子 Agent
- 任务预算
- 运行轨迹
- 验证和重试

两者确实有一些结构上的相似性。

但今天的 coding agent 还远没有成为真正的操作系统。

Pi 和 Prime Agent 都明确提醒，它们默认以当前用户权限执行模型生成的代码和命令，本身不等于安全沙箱。

目前普遍缺少的能力包括：

- 默认进程和网络隔离
- Agent 与凭据之间的细粒度权限
- 子 Agent 的资源配额和调度
- 文件、工具和外部状态的一致恢复
- 独立于 Agent 自我判断的完成条件
- 可复现、可审计的完整运行记录

所以“操作系统化”更适合作为一个观察框架，而不是行业结论。

它提醒我们：

**AI 编程助手正在承担越来越多状态管理和执行治理工作。**

但这层软件最终会变成操作系统、开发框架，还是某种新的应用运行时，现在还没有答案。

Claude Code、Pi 和 Prime Agent 也不是一条线性的替代关系。

更准确地说：

```text
Claude Code：把模型与 Runtime 封装成成熟产品
Pi：把 Coding Harness 做成最小可扩展内核
Prime Agent：在 Pi 上实验持久状态和长程运行
```

它们解决的是不同层次的问题。

![Agent Runtime：像操作系统，但还不是](/images/agent-runtime-os/06-agent-software-stack.png)

<!--
IMAGE_PROMPT_06_AGENT_STACK
用途：解释 Agent 软件栈与操作系统比喻的边界。
位置：第 5 节末尾。
画面：五层架构图。Model、Harness、Runtime、Environment、Verifier。Harness 标注 Context/Tools/Loop，Runtime 标注 Session/Subagents/Budget/Recovery。右侧单独列出 OS-like but missing：Isolation、Scheduling、Permissions、Consistent Recovery。强调“结构相似，不等于已经是操作系统”。白底、蓝灰、青绿、少量琥珀。
尺寸：16:9。
-->

---

## 6. 评价 Agent，先判断你在比较哪一层

现在讨论 AI 编程工具，最容易出现的问题，是把不同层的东西放在一个榜单里比较。

比如：

```text
Claude 模型 vs Pi
Claude Code vs Prime Agent
长上下文模型 vs Context Folding
模型价格 vs Agent 任务成本
```

这些比较经常不在同一层。

更好的方式，是先问自己的问题到底在哪里。

第一层，模型能力。

模型能不能理解代码、遵循工具协议、保持长程目标、根据测试结果修正错误？

如果瓶颈在这里，换 Harness 未必能解决。

第二层，Harness 效率。

System Prompt 是否过大？工具是否过多？模型是否频繁空转？是否重复读取同一批文件？

如果同一个模型在不同 Harness 下成本和失败模式差异明显，才值得优化这一层。

第三层，上下文和状态。

任务失败是因为模型能力不够，还是因为 compaction 丢失了关键信息？

是否需要 session tree、可检索历史、持久 REPL 或独立子 Agent？

第四层，环境和验证。

测试是否真的覆盖需求？Agent 是否能看到不该看到的答案？完成条件是不是由 Agent 自己宣布？

如果 verifier 有漏洞，更强的模型和更强的自我改进只会更快找到漏洞。

第五层，轨迹和训练。

一次 Agent 运行会产生：

```text
Prompt
Context Injection
Tool Call
Observation
File Change
Retry
Verifier Result
Cost
Failure Type
```

这些 trajectory 可以用于调试、审计，也可能被转成 SFT、preference、verifier 或 RL 数据。

但轨迹不天然等于高质量训练数据。

它可能包含错误归因、环境泄漏、reward hacking 和 Harness 特有行为。

所以未来如果要认真评价 Agent，至少应该同时报告：

- Model 与 Harness 的完整版本
- System Prompt 和工具配置
- 任务通过率与置信区间
- 每解一题的 token 和成本
- 墙钟时间和工具调用次数
- 失败类型和人工介入次数
- 环境、预算和 verifier 设置

这和过去只报告一个模型分数相比，复杂了很多。

但 Agent 本来就不是一个模型。

它是一个模型在一套运行环境里持续行动的结果。

![评价 Agent：先判断比较哪一层](/images/agent-runtime-os/07-agent-evaluation-layers.png)

<!--
IMAGE_PROMPT_07_EVALUATION_LAYERS
用途：最终总结 Agent 评价需要区分的层次。
位置：第 6 节末尾或结论前。
画面：五层选型图。Model Capability、Harness Efficiency、Context & State、Environment & Verifier、Trajectory & Training。每层右侧写一个核心问题和对应指标。底部结论：“不要只比较模型名，要比较完整 Agent System”。白底，五条浅色横带，蓝灰主色，青绿与琥珀点缀。
尺寸：16:9。
-->

---

## 结论：Pi 让 Harness 重新变得可见

Pi 最近受到关注，不是因为它已经证明自己比 Claude Code 更强。

Prime Agent 也没有证明 RLM 已经是长程 Agent 的标准答案。

公开数据目前能支持的结论，其实比较有限：

```text
模型仍然重要；
Harness 也会影响成本、路径和失败方式；
部分任务里，Harness 还会影响成功率；
但这种影响高度依赖模型、任务、环境和预算。
```

Claude Code 展示了 Agent Runtime 被做成成熟产品之后的形态。

Pi 把其中最基本的循环、工具、session 和扩展边界重新暴露出来。

Prime Agent 则在 Pi 上继续实验持久状态、可编程上下文、后台任务和 harness refinement。

它们不是谁淘汰谁。

更值得关注的是，AI 编程工具的评价单位正在变得更完整：

```text
过去：Model

现在：
Model
  × Harness
  × Tools
  × Runtime
  × Environment
  × Budget
  × Verifier
```

至于 Agent Runtime 会不会真的成长为一层类似操作系统的基础软件，目前还没有足够证据。

但 Pi 至少让一个过去藏在模型背后的变量，重新变得可见。

这已经足够值得研究。

---

## 参考资料

- Pi：[项目源码](https://github.com/earendil-works/pi)、[Compaction](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/compaction.md)、[Session Format](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/session-format.md)、[Extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
- Prime Intellect：[Prime Agent 源码](https://github.com/PrimeIntellect-ai/prime-agent)、[Prime Agent 发布文章](https://www.primeintellect.ai/blog/prime-agent)、[RLM 实验](https://www.primeintellect.ai/blog/rlm)
- Anthropic：[Claude Code 官方文档](https://code.claude.com/docs/en/overview)
- [Recursive Language Models](https://arxiv.org/abs/2512.24601)
- [Continual Harness: Online Adaptation for Self-Improving Foundation Agents](https://arxiv.org/abs/2605.09998)
- [The Scaffold Effect in Coding Agents](https://arxiv.org/abs/2607.22585)
- [Prompt-Induced Waste in Large Reasoning Models](https://arxiv.org/abs/2608.01347)
- [Recursive Harness Self-Improvement](https://arxiv.org/abs/2607.15524)
- OpenBench：[公开榜单](https://openbench.run/openbench/)、[源码与方法](https://github.com/minghinmatthewlam/openbench)
- ARC Prize：[ARC-AGI-3 评分方法](https://docs.arcprize.org/methodology)、[技术报告](https://arcprize.org/media/ARC_AGI_3_Technical_Report.pdf)
- Prime Intellect：[verifiers v1](https://www.primeintellect.ai/blog/verifiers-v1)、[365,000+ Agentic RL Environments](https://www.primeintellect.ai/blog/scaling-agentic-rl)

<div class="wechat-follow">
  <p>原文首发微信公众号「巴马AI」。</p>
  <p>微信搜索「巴马AI」<button class="hub-copy" type="button" data-copy-wechat>复制名称</button></p>
  <img src="/images/wechat-qr.jpg" alt="关注公众号巴马AI">
</div>
