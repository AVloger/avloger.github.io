---
title: Trajectory 数据调研：AI 后训练的新燃料，还没有标准答案
author: 巴马AI
date: 2026-07-22 21:00:00
draft: false
summary: 在 reasoning model 和 agent 训练里，trajectory 正在从“推理过程记录”变成后训练数据资产。但它还没有形成统一标准，各家公开方案更多是在 rollout、verifier、filter、distill、RL 之间摸索。
description: 本文调研 AI 后训练中的 trajectory 数据：它是什么、on-policy 与 off-policy 为什么都需要它、ShareGPT 这类对话格式能表达什么、各家公开路线如何处理，以及未来可能形成哪些数据工程范式。
coverImage: /images/ai-trajectory-post-training/01-trajectory-data-model.png
cover: /images/ai-trajectory-post-training/01-trajectory-data-model.png
categories:
  - 公众号
tags:
  - Trajectory
  - 后训练
  - RL
  - Agent
channel: wechat
---
这篇文章先把结论放在前面：

**Trajectory 数据很重要，但现在还没有真正意义上的主流标准方案。**

它不像日志平台，有 Splunk、Elastic、Loki、ClickHouse 这些相对明确的工程路线。

也不像 Metric 平台，有 Prometheus、VictoriaMetrics、Thanos、Mimir 这些已经被大规模生产环境反复验证的体系。

甚至也不像 Trace 平台，至少大家已经知道 Jaeger、Tempo、SkyWalking、OpenTelemetry 各自站在哪一层。

Trajectory 数据还处在更早的阶段。

大家都知道它会变成下一代 AI 后训练的关键数据资产，但怎么定义、怎么采集、怎么清洗、怎么打分、怎么回流训练，现在仍然在摸索中。

尤其是在 reasoning model、agent、tool use、多轮任务、on-policy / off-policy distillation 这些场景里，trajectory 已经不再只是“模型输出的一段文本”。

它更像一次完整的行为轨迹：

```text
任务输入
  -> 模型思考
  -> 中间决策
  -> 工具调用
  -> 环境反馈
  -> 失败重试
  -> 最终答案
  -> verifier / reward / human preference
```

如果说传统 SFT 数据是“题目 + 标准答案”，那 trajectory 数据更接近：

**题目 + 解题过程 + 行动路径 + 反馈信号 + 最终结果。**

这也是为什么它开始成为 AI 后训练的新燃料。

---

## 1. 这里的 Trajectory，不是可观测里的 Trace

前面讲 Trace 时，我们说 Trace 是分布式系统里一次请求的调用链。

而 AI 后训练里的 trajectory，不是这个意思。

这里的 trajectory 指的是模型完成一个任务时的行为路径。

它可以包含：

- prompt
- system instruction
- user message
- model response
- reasoning steps
- tool call
- tool observation
- intermediate answer
- self-reflection
- retry / correction
- final answer
- reward score
- verifier result
- human preference
- policy version
- sampling parameters

也就是说，trajectory 不只是最终答案。

它记录的是模型“怎么走到这个答案”的过程。

一个更工程化的结构大概长这样：

```json
{
  "trajectory_id": "traj_20260728_0001",
  "task_id": "math_001",
  "policy_version": "model_v12",
  "prompt": "...",
  "steps": [
    {
      "type": "reasoning",
      "content": "internal reasoning or summarized reasoning"
    },
    {
      "type": "tool_call",
      "tool": "python",
      "arguments": "...",
      "observation": "..."
    },
    {
      "type": "answer",
      "content": "..."
    }
  ],
  "evaluation": {
    "verifier": "math_checker_v3",
    "pass": true,
    "score": 0.94,
    "failure_type": null
  },
  "metadata": {
    "temperature": 0.8,
    "seed": 123,
    "created_at": "2026-07-28"
  }
}
```

真实系统会比这个复杂得多。

因为一条 trajectory 不一定是单轮问答。

它可能是一段多轮对话，一个 agent 操作浏览器的过程，一次代码修复任务，一次数学证明，一次工具链编排，甚至是一组模型之间的 self-play。

这也是它难处理的原因。

![Trajectory 数据模型](/images/ai-trajectory-post-training/01-trajectory-data-model.png)

---

## 2. 为什么后训练都需要 trajectory

传统模型训练里，数据多半是静态的。

先收集一批人类标注数据或高质量问答数据，再做 SFT。

这类数据有一个优点：稳定、可复用、容易管理。

但它也有一个越来越明显的问题：

**数据不是当前模型自己产生的。**

在强化学习和后训练里，这会引出 off-policy 和 on-policy 的差异。

off-policy 数据来自旧模型、人类专家、外部数据集或更强模型。

on-policy 数据来自当前正在训练的模型自己。

但要注意，这并不意味着 off-policy 不需要 trajectory。

off-policy 同样需要 trajectory。

区别在于：

```text
off-policy trajectory:
  来自旧 policy、人类专家、更强模型、历史 agent 日志、公开数据集

on-policy trajectory:
  来自当前正在训练的 policy 自己 rollout
```

两者都可能包含完整行为路径。

只是训练含义不同。

off-policy trajectory 更像“别人已经走过的路”，适合做 SFT、rejection sampling、preference pair、reward model、verifier training 或 cold start。

on-policy trajectory 更像“当前模型自己真实会走的路”，适合暴露当前 policy 的错误模式，并形成下一轮 RL 或 distillation 信号。

所以更准确的说法不是：

```text
on-policy 需要 trajectory，off-policy 不需要
```

而是：

```text
off-policy 和 on-policy 都需要 trajectory
差别在于 trajectory 由谁产生，以及如何被训练算法消费
```

![On-policy 与 Off-policy 都需要轨迹数据](/images/ai-trajectory-post-training/02-on-policy-off-policy-trajectory.png)

为什么这个区别重要？

因为模型真正的问题，往往藏在它自己的分布里。

一个模型会在哪些题上想偏？

会在哪些步骤自信犯错？

会在哪些工具调用里重复失败？

会在哪些长任务里偏离目标？

这些问题很难只靠静态人类数据发现。

你需要让当前模型自己跑任务，记录它的完整行为，再用 verifier、reward model、human preference 或更强模型去评价这些行为。

这就是 on-policy trajectory 的价值。

它不是为了“多攒一点语料”。

它是为了观察当前 policy 在真实任务分布里的行为，再把这些行为变成下一轮训练信号。

可以抽象成一个循环：

```text
当前模型 policy
  -> rollout 生成 trajectories
  -> verifier / reward / preference 打分
  -> filter / rank / relabel / distill
  -> SFT / DPO / RL / distillation
  -> 新 policy
  -> 再 rollout
```

这也是为什么 trajectory 数据处理，本质上不是“日志存储问题”，而是“训练闭环问题”。

---

## 3. ShareGPT 格式：事实上的对话数据格式，但不是 trajectory 标准

如果你做过开源大模型微调，大概率会见过 ShareGPT 格式。

它不是一个严格标准，更像社区和训练框架里逐渐形成的事实约定。

最常见的 ShareGPT 样子大概是这样：

```json
{
  "id": "sample_001",
  "conversations": [
    {
      "from": "human",
      "value": "解释一下什么是 trajectory 数据"
    },
    {
      "from": "gpt",
      "value": "trajectory 数据记录的是模型完成任务时的行为路径..."
    }
  ]
}
```

也有一些变体会加入 system：

```json
{
  "conversations": [
    {
      "from": "system",
      "value": "你是一个严谨的技术助手。"
    },
    {
      "from": "human",
      "value": "帮我修复这段代码。"
    },
    {
      "from": "gpt",
      "value": "可以，问题出在..."
    }
  ]
}
```

很多训练框架会把它映射成更接近 OpenAI chat messages 的格式：

```json
{
  "messages": [
    {
      "role": "system",
      "content": "你是一个严谨的技术助手。"
    },
    {
      "role": "user",
      "content": "帮我修复这段代码。"
    },
    {
      "role": "assistant",
      "content": "可以，问题出在..."
    }
  ]
}
```

这类格式很适合表达多轮对话。

但它还不是完整 trajectory 格式。

原因很简单：ShareGPT 主要描述的是“谁说了什么”，而 trajectory 还需要描述“模型做了什么、环境返回了什么、结果如何评价”。

比如 agent 任务里，光有 human / gpt 对话是不够的。

你还需要：

- tool call
- tool arguments
- tool observation
- environment state
- reward score
- verifier result
- policy version
- sampling parameters
- failure type
- dataset lineage

有些框架会在 ShareGPT 的 `from` 里扩展出 `function`、`tool`、`observation` 之类角色。

例如：

```json
{
  "conversations": [
    {
      "from": "human",
      "value": "运行测试并修复失败用例。"
    },
    {
      "from": "gpt",
      "value": "我先查看测试失败信息。"
    },
    {
      "from": "tool",
      "value": "pytest failed: test_order_total ..."
    },
    {
      "from": "gpt",
      "value": "失败原因是折扣计算顺序错误，下面修改..."
    }
  ]
}
```

但这已经不是纯 ShareGPT 原始语义了，而是在借用它的对话容器。

所以可以这样理解：

```text
ShareGPT 格式：
  适合存多轮对话和 SFT 样本

Trajectory 格式：
  需要额外存工具、环境、评价、奖励、版本和数据血缘
```

ShareGPT 可以作为 trajectory 的一个子集。

但如果要做后训练数据闭环，它不够。

它缺少最关键的训练治理字段：这条轨迹是谁生成的、在什么环境下生成的、是否成功、为什么成功或失败、能不能进入下一轮训练。

![ShareGPT 与完整轨迹 Schema 的关系](/images/ai-trajectory-post-training/03-sharegpt-vs-trajectory-schema.png)

---

## 4. 现在公开资料里的几类路线

严格说，没有哪家公司公开了一套完整、可复制的 trajectory 数据平台方案。

但从论文和公开材料里，可以看到几条正在收敛的路线。

### 路线一：OpenAI o1 代表的 reasoning RL

OpenAI 在 o1 相关公开材料里明确提到，大规模强化学习会教模型利用 chain of thought 更有效地思考；随着训练时计算和测试时思考时间增加，模型表现会提升。

它还提到，模型会学习识别和纠正错误、把困难步骤拆小、在当前方法不工作时尝试其他路径。

这些表述没有公开具体数据管线，但它指向一个很清楚的方向：

**reasoning model 的能力提升，不只是靠答案监督，而是靠对推理过程和策略的训练。**

不过 OpenAI 同时也强调，不向用户展示原始 chain of thought，而是展示模型生成的摘要。

这说明 trajectory 数据有两面：

- 训练侧，它可能是非常重要的内部信号
- 产品侧，它不一定适合原样暴露

这对行业很有启发。

未来 trajectory 数据很可能会分成两套视图：

- 内部训练视图：保留更丰富的过程、分数、失败原因
- 外部解释视图：只展示摘要、证据、关键步骤和可审计结果

### 路线二：DeepSeek-R1 代表的 RL + distillation

DeepSeek-R1 的公开论文更直接。

它展示了通过强化学习激发推理能力的路线，并强调不依赖人类标注的 reasoning trajectories，也能出现自我反思、验证和动态策略调整等推理模式。

同时，论文也提到这些大模型中涌现出的 reasoning patterns 可以被系统性地用于增强小模型推理能力。

这条路线的重要性在于：

**trajectory 不一定来自人类专家，也可以来自模型自身在 RL 中产生的成功行为。**

对于后训练数据工程来说，这意味着数据来源开始发生变化。

过去我们想要“高质量标注数据”。

现在我们开始想要：

- 当前模型的 rollout
- verifier 能判定对错的任务
- 高奖励 trajectory
- 失败但有价值的 trajectory
- 可以蒸馏给小模型的 reasoning pattern

这是一种非常典型的“生成—筛选—蒸馏”范式。

大模型或当前 policy 先生成大量候选 trajectory，再通过规则 verifier、模型 judge、reward model 或执行结果过滤，最后把高质量行为回流到模型训练里。

### 路线三：ReST 代表的 generate-filter-finetune 循环

Reinforced Self-Training，也就是 ReST，提供了一个很清晰的抽象。

它从初始语言模型 policy 生成样本，构造训练数据，再用离线 RL 方法改进模型。

它的核心不是某个具体模型，而是一个循环：

```text
Grow：当前模型生成数据
Improve：根据奖励或偏好筛选并训练
```

这和 trajectory 数据处理很接近。

先让模型自己产生候选行为，再把这些行为变成可复用的数据集，最后用训练算法消化它们。

ReST 的价值在于，它把在线 RLHF 中昂贵、复杂、不稳定的部分，转化为相对可复用的离线数据循环。

从工程角度看，这很像后训练版的数据湖：

- rollout 产生原始样本
- reward / verifier 产生标签
- filter 形成训练集
- 下一轮模型继续生成新样本

### 路线四：Anthropic Constitutional AI / RLAIF 代表的 AI feedback

Anthropic 的 Constitutional AI 论文里，有一个非常关键的思路：用 AI 反馈减少人类标签依赖。

它先让模型生成回答、自我批评和修订，再用修订后的回答做 supervised learning。

在 RL 阶段，它让模型生成多个样本，再用模型评价哪个更好，由此构造 AI preference 数据，并训练 preference model，最后用这个 preference model 作为 reward signal 做 RL。

这条路线和 trajectory 数据的关系也很直接。

它说明后训练数据不一定只来自人类标注。

它可以来自：

- 模型自我批评
- 模型自我修订
- AI judge 比较两个样本
- preference model 提供 reward
- RL 进一步优化 policy

这类数据未必都是完整 trajectory，但它已经具备 trajectory 数据的雏形：生成过程、评价过程、修订过程和训练反馈形成了闭环。

### 路线五：DPO / preference optimization 代表的偏好数据消费方式

DPO 本身不一定要求完整 trajectory。

它更常见的输入是 preference pair：

```text
prompt
chosen response
rejected response
```

但在 trajectory 场景里，DPO 仍然很重要。

因为 trajectory 最后未必总是以“全路径监督”的形式进入训练。

很多时候，它会被压缩成偏好对：

```text
同一个任务下：
trajectory A 成功、简洁、工具调用正确
trajectory B 失败、绕远、工具调用错误

训练数据：
chosen = A 的最终回答或压缩过程
rejected = B 的最终回答或压缩过程
```

这说明 trajectory 数据不一定原样训练。

它可能先被加工成：

- SFT 样本
- preference pair
- reward model 样本
- verifier 训练样本
- failure taxonomy
- agent benchmark case

换句话说，trajectory 是原材料，DPO / SFT / RL / distillation 是消费方式。

---

## 5. 现在工程上大概率会怎么处理

虽然没有统一标准，但一个相对合理的 trajectory 数据管线，通常会包含六层。

### 第一层：任务与环境定义

trajectory 必须先绑定任务。

任务可以是数学题、代码题、客服对话、浏览器操作、数据库分析、办公自动化、IDE 修复、网页搜索、多工具 agent 任务。

每类任务都需要定义：

- input schema
- allowed tools
- environment state
- success criteria
- evaluation method
- safety boundary

没有任务定义，trajectory 就只是一堆过程日志。

有了任务定义，它才可能变成训练数据。

### 第二层：rollout 采集

rollout 是让当前 policy 生成行为轨迹。

这里必须记录：

- policy version
- prompt version
- system instruction
- sampling parameters
- tool version
- environment snapshot
- model outputs
- tool observations
- latency and cost
- failure status

尤其是 on-policy 场景，policy version 很关键。

同一条 trajectory 是哪个模型版本产生的，直接决定它能不能用于下一轮训练分析。

### 第三层：评价与打分

trajectory 不能只存下来。

它必须被评价。

常见评价方式包括：

- rule-based verifier
- unit test
- code execution
- math answer checker
- LLM-as-judge
- reward model
- human preference
- environment success signal
- safety classifier

这里会出现一个非常现实的问题：

**可验证任务会先爆发。**

数学、代码、结构化工具任务之所以适合 reasoning RL，不只是因为它们难，而是因为它们有相对明确的 verifier。

开放问答、创意写作、复杂咨询也能做 trajectory，但评价成本会高很多，也更容易引入 judge bias。

### 第四层：清洗与过滤

原始 trajectory 不能直接进训练。

它里面会有大量噪声：

- 失败轨迹
- reward hacking
- 工具调用错误
- 过程冗长
- 自我重复
- 幻觉推理
- 敏感信息
- 隐私数据
- 非法或危险操作
- 与当前 policy 分布不匹配的数据

所以需要过滤和标注：

- success / failure
- failure type
- reward score
- difficulty
- novelty
- diversity
- safety risk
- tool error type
- human review status

真正有价值的不是“全收”，而是把 trajectory 变成可训练、可解释、可追溯的数据资产。

### 第五层：数据变换

同一条 trajectory，可以变成多种训练样本。

比如一条成功的代码修复 trajectory，可以变成：

- SFT 样本：输入任务，输出最终补丁
- process supervision 样本：每一步决策是否合理
- preference pair：成功轨迹优于失败轨迹
- verifier 样本：哪些输出能通过测试
- tool-use 样本：什么时候该调用搜索、终端、编辑器
- distillation 样本：把复杂过程压缩成小模型可学的步骤

这一步很关键。

因为模型训练未必吃得下完整原始 trajectory。

原始 trajectory 可能太长、太乱、隐私风险太高，也可能包含不适合暴露的内部推理。

所以未来真正值钱的，可能不是“谁存了最多 trajectory”，而是：

**谁能把 trajectory 变成稳定提升模型能力的训练样本。**

### 第六层：训练回流

最后一步才是训练。

可能的训练方式包括：

- SFT
- rejection sampling fine-tuning
- DPO / IPO / preference optimization
- reward model training
- PPO / GRPO / REINFORCE
- verifier training
- small model distillation
- agent policy learning

不同方法消耗的数据形态不同。

SFT 更喜欢干净的 chosen trajectory、ShareGPT 对话样本或最终答案。

DPO 更喜欢 chosen / rejected 对。

RL 更需要 reward 和 policy logprob。

verifier 训练需要输入、候选输出和可判定标签。

agent 训练则可能还需要环境状态、工具调用和 observation。

这也是 trajectory 平台难标准化的原因：上游是行为轨迹，下游是多种训练算法，中间需要大量转换。

![Trajectory 数据闭环](/images/ai-trajectory-post-training/04-trajectory-training-loop.png)

---

## 6. 为什么现在还没有主流方案

第一个原因：数据模型没有统一。

文本问答 trajectory、代码 agent trajectory、浏览器 agent trajectory、机器人 trajectory、数学 reasoning trajectory，结构都不一样。

有的有工具，有的没有。

有的是多轮，有的是单轮。

有的 reward 来自单元测试，有的来自模型 judge。

有的需要保留完整过程，有的只能保留摘要。

第二个原因：评价信号不稳定。

trajectory 数据最难的不是存储，而是判断它有没有价值。

一个答案正确，不代表过程值得学习。

一个过程看起来漂亮，不代表最终可靠。

一个 LLM judge 打高分，不代表人类真的满意。

一个 reward model 喜欢的行为，也可能只是 reward hacking。

第三个原因：隐私和安全风险高。

agent trajectory 里可能包含用户输入、工具返回、网页内容、代码仓库、数据库查询结果、内部系统状态。

如果这些数据直接进入训练集，会带来严重的数据泄漏和合规风险。

第四个原因：chain of thought 不是普通日志。

推理过程对训练有价值，但对外展示、存储、标注和再训练都非常敏感。

OpenAI 在 o1 公开材料里就明确区分了原始 chain of thought 和对用户展示的摘要。

这意味着 trajectory 平台未来很可能需要权限分层：

- 原始内部轨迹
- 训练用压缩轨迹
- 审计用摘要轨迹
- 产品侧可见解释

第五个原因：成本很高。

trajectory 比普通 SFT 样本更贵。

它需要模型生成，需要工具执行，需要环境隔离，需要 verifier，需要反复采样，有时还需要人工审核。

它的成本公式大致可以写成：

```text
Trajectory 成本 =
任务数量
× 每个任务 rollout 次数
× 平均轨迹长度
× 工具执行成本
× verifier / judge 成本
× 清洗标注成本
× 存储与回放成本
```

这比“存一些问答对”复杂得多。

---

## 7. 未来可能形成的几类平台能力

虽然没有标准答案，但可以看出几个方向。

### 方向一：Trajectory Lake

未来 AI 公司可能会像建设数据湖一样建设 trajectory lake。

它不只是存 prompt 和 response，而是存完整行为轨迹：

- task
- policy
- rollout
- tool call
- observation
- reward
- preference
- verifier result
- training lineage

它要支持追溯：

某个模型能力提升，来自哪一批 trajectory？

某个 safety regression，是否来自某类错误轨迹？

某个 agent 学会了错误工具调用，是哪轮数据污染的？

这会变成 AI 后训练里的数据血缘问题。

### 方向二：Verifier-first 数据生产

未来 trajectory 数据生产会优先选择可验证任务。

不是因为开放任务不重要，而是因为没有 verifier 的 trajectory 很难规模化。

数学、代码、SQL、表格、浏览器任务、游戏环境、模拟器环境，会天然更适合先爆发。

原因很简单：

这些任务能自动判断成败。

只要能自动判断成败，就能低成本地产生大量 on-policy trajectory。

### 方向三：从答案蒸馏走向过程蒸馏

过去蒸馏更多是模仿最终答案。

未来会越来越多地蒸馏过程：

- 如何拆解问题
- 什么时候调用工具
- 如何检查中间结果
- 如何从失败中恢复
- 如何停止无效探索
- 如何把长推理压缩成短策略

DeepSeek-R1 这类工作已经说明，大模型中涌现出的推理模式可以被用来增强小模型。

但怎么蒸馏，仍然没有最终答案。

直接蒸馏完整 chain of thought，可能带来长度、噪声和安全问题。

蒸馏摘要，又可能损失关键学习信号。

未来更可能出现的是“结构化过程蒸馏”：

```text
原始 trajectory
  -> 去敏
  -> 压缩
  -> 标注关键决策点
  -> 提取失败类型
  -> 生成偏好对
  -> 形成训练样本
```

### 方向四：Trajectory Observability 和 Training Data 会合流

今天很多 agent 平台已经会记录 trace、tool call、latency、token cost、error。

这些数据最初是为了调试和观测。

但下一步，它们会被拿来做训练数据。

这会带来一个新问题：

**调试用 trace 和训练用 trajectory，不是同一个数据产品。**

调试关注复现问题。

训练关注可学习信号。

前者需要完整上下文，后者需要清洗、打分、去敏、抽样、转格式。

所以未来可能会出现一条新的数据管道：

```text
Agent Trace
  -> Trajectory Store
  -> Evaluator / Verifier
  -> Dataset Builder
  -> Post-training Pipeline
```

OpenTelemetry 的 GenAI semantic conventions 这类工作，可能会帮助统一观测侧字段。

但训练侧 trajectory schema，大概率还会继续演化。

### 方向五：从人工标注转向混合监督

完全人工标注太贵。

完全 AI judge 又不可靠。

未来更现实的是混合监督：

- 规则 verifier 负责可判定任务
- LLM judge 负责初筛和解释
- reward model 负责大规模排序
- 人类负责高价值样本和争议样本
- 安全模型负责红线过滤
- 训练回归测试负责最终兜底

trajectory 数据的价值，不在于省掉所有人类，而在于把人类放到最关键的位置。

![Trajectory 平台能力展望](/images/ai-trajectory-post-training/05-trajectory-platform-outlook.png)

---

## 8. 一个阶段性判断

如果用一句话总结现在的状态：

**Trajectory 数据正在成为 AI 后训练的核心资产，但它还处在“方法多、标准少、工程体系未定型”的阶段。**

短期内，最可落地的不是建设一个“大而全的 trajectory 平台”。

更现实的路线是：

先从可验证任务开始。

比如数学、代码、SQL、工具调用、浏览器操作、结构化问答。

然后建立最小闭环：

```text
rollout
  -> verifier
  -> filter
  -> dataset
  -> SFT / DPO / RL
  -> eval
  -> next rollout
```

等这个闭环跑通，再逐步补齐：

- trajectory schema
- policy versioning
- reward versioning
- dataset lineage
- privacy redaction
- failure taxonomy
- replay environment
- human review workflow
- training/eval dashboard

不要一上来就追求“统一所有 trajectory”。

这个领域还太早。

真正重要的是先把一个任务域里的数据闭环跑起来。

谁能把模型自己产生的行为轨迹，稳定加工成下一轮能力提升的训练信号，谁就掌握了后训练时代最核心的数据飞轮。

---

## 参考资料

- [OpenAI：Learning to reason with LLMs](https://openai.com/index/learning-to-reason-with-llms/)
- [DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948)
- [Reinforced Self-Training (ReST) for Language Modeling](https://arxiv.org/abs/2308.08998)
- [Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073)
- [Direct Preference Optimization: Your Language Model is Secretly a Reward Model](https://arxiv.org/abs/2305.18290)
- [DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models](https://arxiv.org/abs/2402.03300)
- [Self-Play Fine-Tuning Converts Weak Language Models to Strong Language Models](https://arxiv.org/abs/2401.01335)
- [OpenTelemetry Generative AI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)

<div class="wechat-follow">
  <p>原文首发微信公众号「巴马AI」。</p>
  <p>微信搜索「巴马AI」<button class="hub-copy" type="button" data-copy-wechat>复制名称</button></p>
  <img src="/images/wechat-qr.jpg" alt="关注公众号巴马AI">
</div>
