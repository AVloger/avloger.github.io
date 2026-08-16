---
title: AI Agent 的语义层之争：是理解数据，还是建模世界？
author: 巴马AI
date: 2026-07-28 21:00:00
draft: false
summary: 纯 LLM 生成 SQL 在真实企业场景里会遇到准确率断崖：SQL 语法可能对，但业务口径经常错。问题不在 SQL，而在模型缺少企业业务上下文。Snowflake、Databricks 和 Palantir 正在走出两条不同路线：一条是数据语义层，一条是业务世界建模。
description: 本文讨论 AI Agent 时代的语义层与世界建模：为什么 Text-to-SQL 会遇到准确率断崖，Snowflake / Databricks 的 Data Agent 路线和 Palantir Ontology 路线有什么区别，以及企业 AI 落地时该如何理解这两种架构选择。
coverImage: /images/ai-semantic-layer-world-modeling/01-text-to-sql-semantic-layer.png
cover: /images/ai-semantic-layer-world-modeling/01-text-to-sql-semantic-layer.png
categories:
  - 公众号
tags:
  - 语义层
  - Text-to-SQL
  - Ontology
  - AI Agent
channel: wechat
---
很多企业做 AI Agent，第一反应是从 Text-to-SQL 开始。

用户用自然语言提问，模型自动生成 SQL，查完数仓，再把结果解释成一段经营分析。

这个 demo 很容易惊艳。

但一进入真实业务系统，问题马上出现：

**SQL 可以生成，业务却经常理解错。**

这背后不是 SQL 能力问题，而是一个更底层的问题：

**Agent 理解的世界是什么。**

一个企业里的 Agent，不是在真空中完成任务。

它要理解客户、订单、设备、库存、合同、指标、权限、工单、审批流程、供应链节点、风险等级。

它要知道哪些数据能查，哪些动作能做，哪些口径不能混用，哪些决策需要人类确认。

所以，AI Agent 真正进入企业之后，问题不再只是：

```text
模型够不够聪明？
上下文窗口够不够长？
工具调用准不准？
```

而是：

```text
企业世界有没有被建模成 Agent 能理解、能推理、能行动的形式？
```

这就是为什么最近大厂都在围绕语义层、数据 Agent、本体论、企业知识图谱、业务对象模型做文章。

表面上看，大家都在说 “AI for Enterprise”。

但如果拆开看，其实有两条路线正在分化：

```text
Snowflake / Databricks：让 AI 正确理解企业数据
Palantir：让 AI 理解并操作企业世界
```

这篇文章就聊这个冲突点：

**AI 到底应该先理解数据，还是先建模世界？**

![从 Text-to-SQL 到语义层](/images/ai-semantic-layer-world-modeling/01-text-to-sql-semantic-layer.png)

---

## 1. The Text-to-SQL Accuracy Cliff

先从一个最容易被低估的问题说起：

**纯 LLM 生成 SQL，在真实企业场景里会遇到准确率断崖。**

不是说大模型不会写 SQL。

恰恰相反，大模型很会写 SQL。

只要你把表结构、字段名、几条样例数据塞给它，它往往可以生成一段语法正确、结构像样、甚至看起来很专业的 SQL。

问题在于：

**企业数据分析的难点，从来不只是 SQL 语法。**

真正难的是业务上下文。

比如用户问：

```text
这个季度华东区重点客户的真实风险怎么样？
```

纯 LLM 可能会很自然地生成一段 SQL：

```sql
SELECT
  account_id,
  account_name,
  SUM(order_amount) AS revenue,
  COUNT(ticket_id) AS ticket_count,
  MAX(days_overdue) AS max_days_overdue
FROM crm_accounts a
LEFT JOIN sales_orders o ON a.account_id = o.account_id
LEFT JOIN support_tickets t ON a.account_id = t.account_id
LEFT JOIN payment_records p ON a.account_id = p.account_id
WHERE a.region = '华东'
  AND o.created_at >= '2026-04-01'
  AND o.created_at < '2026-07-01'
GROUP BY account_id, account_name
ORDER BY max_days_overdue DESC;
```

这段 SQL 看起来没什么问题。

但在真实公司里，它可能从第一行业务假设就错了。

因为 Agent 不知道：

- “华东区”到底按客户归属地、销售团队、交付区域，还是合同签约主体划分
- “这个季度”到底是自然季度、财务季度，还是公司内部经营周期
- “重点客户”是按 ARR、战略等级、行业标签，还是客户成功团队维护名单
- “真实风险”是回款风险、流失风险、舆情风险、交付风险，还是多维风险模型
- `order_amount` 是否包含退款、税费、折扣、渠道分成和未确认收入
- support ticket 多是否一定代表坏事，还是上线初期的正常高频交互
- overdue payment 是否要排除已经签了延期协议的客户

这些东西不会自然出现在表名和字段名里。

它们藏在企业内部的指标口径、组织规则、业务流程、权限边界和历史约定里。

所以纯 LLM 的 Text-to-SQL 很容易出现一种危险状态：

```text
SQL 是对的
业务是错的
```

这比语法错误更麻烦。

语法错误会直接报错。

业务错误往往会生成一张看起来很合理的表、一段很顺滑的解释、一个很自信的结论。

这就是所谓的 **Text-to-SQL Accuracy Cliff**。

这个判断并不是单纯的主观判断。

业界最近几类公开资料，其实都在指向同一个问题。

第一类是 benchmark。

Spider 2.0 这类更接近真实企业工作流的 Text-to-SQL benchmark，已经不只是考“给定 schema 后生成一条 SQL”。

它会把问题放进更真实的数据环境里：复杂 schema、多步查询、外部知识、数据清洗、结果验证。

论文里的结果很有代表性：在 Spider 2.0 上，强模型的表现会显著低于传统 Text-to-SQL benchmark。

这说明 Text-to-SQL 一旦从“干净题库”走向“真实企业数据任务”，难度会陡然上升。

第二类是工程团队的经验。

Omni Analytics 在讨论 Text-to-SQL 的局限时，指出没有语义层时，LLM 缺少业务上下文和 guardrails，容易在 join、指标定义、权限范围、业务术语上犯错，而且这些错误经常是“安静地失败”。

也就是说，它不会像 SQL 语法错误那样直接报错，而是给出一个看似合理但业务错误的答案。

第三类是数据建模团队的反向验证。

MotherDuck 的工程实践里有一个很重要的观点：Text-to-SQL 不是纯 LLM 问题，更像数据建模问题。

当底层数据模型足够干净、命名清楚、语义明确时，Text-to-SQL 准确率可以大幅提高。

这恰好反过来证明：模型不是不会写 SQL，而是在缺少业务语义时不知道该写哪一种“正确 SQL”。

第四类是语义层厂商自己的 benchmark。

dbt Labs 在语义层相关实验里也强调，纯 Text-to-SQL 会把语义推断交给 LLM，而 LLM 可能在没有报错的情况下给出“看起来对、实际上错”的查询。

Semantic Layer 的价值，就是把指标、维度、实体关系这些业务定义前置成确定性约束，而不是让模型每次临场猜。

所以，Text-to-SQL Accuracy Cliff 背后的核心不是：

```text
LLM 不会 SQL
```

而是：

```text
LLM 不懂企业内部默认省略掉的业务上下文
```

在 demo 场景里，只要数据库 schema 干净、问题边界清晰、指标口径简单，LLM 生成 SQL 的效果会显得非常惊艳。

但一进入真实企业环境，准确率会突然掉下去。

因为模型缺的不是 SQL 能力，而是业务语义。

它不知道一个字段能不能用。

不知道一个指标该怎么算。

不知道两个表能不能这样 join。

不知道某个异常是不是业务上真的异常。

更不知道查询结果之后能不能触发动作。

所以，Text-to-SQL 的问题最后会逼出语义层。

Snowflake / Databricks 这类数据平台要补 semantic model，是为了解决：

```text
AI 如何正确读懂企业数据
```

Palantir 强调 Ontology，是进一步追问：

```text
AI 如何理解企业世界，并在这个世界里正确行动
```

也就是说，Text-to-SQL 的准确率断崖不是一个小功能问题。

它是 AI Agent 进入企业之后遇到的第一个架构问题。

![Text-to-SQL Accuracy Cliff](/images/ai-semantic-layer-world-modeling/02-text-to-sql-accuracy-cliff-v3.png)

---

## 2. 为什么 Text-to-SQL 会逼出语义层

Text-to-SQL 解决的是“怎么把问题翻译成查询”。

语义层解决的是“这些东西是什么意思”。

举个很简单的例子。

用户问一个销售 Agent：

```text
华东区这个季度的重点客户风险怎么样？
```

一个没有语义层的 Agent，看到的可能只是几张表：

```text
crm_accounts
sales_orders
payment_records
support_tickets
customer_success_notes
```

它可以查表，可以 join，可以总结。

但它未必知道：

- “华东区”在组织架构里怎么定义
- “重点客户”是按 ARR、战略等级、行业，还是客户成功团队标签划分
- “风险”是回款风险、流失风险、舆情风险，还是交付风险
- 工单数量变多到底是坏事，还是上线阶段的正常现象
- 某个客户能不能被 Agent 自动加入预警名单
- 某个动作是不是必须经过销售负责人确认

如果没有这些语义，Agent 可能仍然能给出一段看起来合理的回答。

但那只是“语言上合理”。

企业真正需要的是“业务上可靠”。

这就是 AI Agent 进入生产环境之后，语义层突然变得重要的原因。

过去，语义层更多是 BI 和数据仓库里的概念。

它解决的是指标口径统一：

```text
GMV 怎么算？
活跃用户怎么定义？
收入确认口径是什么？
这个字段是不是能被销售团队看？
```

但到了 Agent 时代，语义层的范围被迫扩大。

它不只要解释“数据是什么意思”。

它还要解释：

```text
这个业务对象是什么？
这个对象和其他对象有什么关系？
Agent 对这个对象能做什么？
做这个动作需要满足什么约束？
动作之后会影响哪些系统？
```

这就是 Snowflake / Databricks 和 Palantir 分歧的起点。

---

## 3. Snowflake / Databricks：从数据平台长出来的语义层

先看 Snowflake 和 Databricks。

它们的出发点很清楚：

**企业数据已经在我这里了，所以 AI 应该先从可信数据开始。**

Snowflake 这条线，现在可以大致拆成几块：

- Cortex Analyst：让用户用自然语言问结构化数据问题
- Cortex Search：面向非结构化数据的检索
- Cortex Agents：把 Analyst、Search 和工具调用编排起来
- Semantic Views / semantic model：描述表、指标、维度和业务术语

Databricks 的方向也类似：

- Unity Catalog 负责数据治理、权限、血缘
- Genie 负责自然语言数据分析
- MLflow Tracing 负责 GenAI / Agent trace
- Lakehouse 作为底层数据和模型平台

它们的共同逻辑是：

```text
先治理数据
再定义指标和语义
然后让 Agent 基于这些语义去查询、分析、回答
```

这是一条非常自然的路线。

因为大多数企业引入 AI 的第一个需求，不是让 Agent 控制工厂，也不是让 Agent 重构供应链。

而是先问：

```text
我能不能直接问公司的数据？
为什么收入下降？
哪个区域异常？
哪些客户可能流失？
本周运营指标有什么变化？
```

这类问题，本质上还是数据分析问题。

只不过交互方式从 dashboard、SQL、报表，变成了自然语言。

所以 Snowflake / Databricks 的优势非常明确：

**它们离数据最近。**

它们知道表在哪里，字段是什么，权限怎么管，血缘怎么追，指标怎么定义。

这让它们天然适合做 Data Agent。

但这条路线也有边界。

它很擅长回答：

```text
数据说明了什么？
指标为什么变化？
这个问题可以从哪些表里查？
```

但当问题从“查询数据”变成“理解业务世界并采取行动”时，数据语义层就开始不够用了。

比如：

```text
这个客户是否应该进入高风险名单？
这个订单是否应该暂停发货？
这个设备是否应该安排提前检修？
这个供应商是否应该触发替代方案？
```

这些问题不是简单查数。

它们需要理解业务对象、流程状态、动作权限和后果。

也就是说，Agent 不只是要读懂数据。

它还要知道自己身处一个怎样的业务世界。

![数据语义层架构](/images/ai-semantic-layer-world-modeling/03-data-semantic-layer-architecture.png)

---

## 4. Palantir：Ontology 不是普通语义层

Palantir 的路线不太一样。

它经常讲 Ontology。

中文可以翻译成本体论，但如果只把它理解成“知识图谱”或者“数据模型”，就会低估它的野心。

Palantir 的 Ontology 更像是一个企业操作层。

它不是只回答：

```text
这张表是什么意思？
这个字段叫什么？
这个指标怎么算？
```

它更关心：

```text
企业里有哪些真实对象？
这些对象之间是什么关系？
这些对象有哪些状态？
人和系统能对这些对象执行什么动作？
动作之后会触发哪些流程？
哪些动作需要权限、审批或人工确认？
```

比如在制造业场景里，Ontology 里可能不是一堆表，而是：

```text
工厂
产线
设备
工单
库存
供应商
订单
交付计划
质量异常
维护动作
```

这些对象之间有关系，也有动作。

设备可以关联到维护计划。

订单可以关联到客户、库存和交付风险。

供应商可以关联到延迟概率和替代方案。

Agent 看到的就不只是 SQL 表，而是一个已经被业务语义组织过的世界。

这就是 Palantir 和 Snowflake / Databricks 最大的差别。

Snowflake / Databricks 更像是说：

```text
我帮 AI 读懂企业数据。
```

Palantir 更像是说：

```text
我帮 AI 进入企业的业务世界。
```

这听起来只是表达不同，但架构含义差很多。

数据语义层的中心是数据。

Ontology 的中心是业务对象和动作。

前者适合回答问题。

后者更适合参与决策和执行流程。

所以 Palantir 的 AIP 才会强调把大模型接入企业里的对象、工具、工作流和权限体系。

这不是简单的 “chat with your data”。

它更接近：

```text
让 AI 在一个被建模、被约束、可审计的企业操作环境里工作。
```

![Ontology 世界建模](/images/ai-semantic-layer-world-modeling/04-ontology-world-model.png)

---

## 5. 冲突点：Data Semantic Layer vs World Model

现在可以把两条路线放在一起看。

**数据语义层问的是：**

```text
这张表是什么意思？
这个字段是不是可用？
这个指标怎么算？
这个口径是否一致？
这个用户有没有权限看？
```

**世界建模问的是：**

```text
这个业务对象是什么？
它现在处于什么状态？
它和其他对象是什么关系？
Agent 能对它执行什么动作？
执行动作前需要满足什么约束？
动作之后会改变什么？
```

这就是这一轮企业 AI 平台竞争里很关键的分叉。

如果你认为企业 AI 的核心场景是数据分析，那么 Snowflake / Databricks 的路线更顺。

因为它们的强项是：

- 数据治理
- 权限控制
- 指标口径
- SQL / BI 生态
- 数据工程工作流
- 结构化和非结构化数据统一查询

但如果你认为企业 AI 的核心场景是参与运营决策，甚至进入执行系统，那么 Palantir 的路线更像终局。

因为它的强项是：

- 业务对象建模
- 操作流程建模
- 权限和动作约束
- 人机协同决策
- 行动结果可审计
- 复杂组织里的业务闭环

不过这里不能简单得出“谁更高级”的结论。

这两条路线面对的是不同落地阶段。

大多数企业会先需要 Data Semantic Layer。

因为没有统一口径，Agent 连数据都读不准。

但只靠 Data Semantic Layer，Agent 很难真正变成企业操作系统的一部分。

因为真实业务不是一堆表。

真实业务是对象、关系、状态、动作和责任边界。

可以这样理解：

```text
Data Semantic Layer:
  让 Agent 正确读懂数据

World Model / Ontology:
  让 Agent 正确理解业务世界，并知道能做什么
```

![Data Semantic Layer 与 Ontology 对比](/images/ai-semantic-layer-world-modeling/05-semantic-layer-vs-ontology-matrix.png)

---

## 6. 为什么这和可观测性有关

这篇文章虽然在讲语义层，但它其实仍然属于 AI 可观测性系列。

原因是：没有语义，就没有真正可解释的 Agent 行为记录。

传统 trace 里，一个 span 至少知道：

```text
服务名
接口名
耗时
状态码
错误信息
上下游调用
```

但 Agent 的行为记录里，如果只有：

```text
prompt
response
tool_call
observation
```

仍然不够。

因为你不知道这些行为在业务上意味着什么。

比如一个 Agent 调用了 `update_customer_risk_level`。

如果没有语义层，你只能看到：

```text
它调用了一个工具
参数是什么
返回是否成功
耗时多少
```

但如果有业务语义和世界模型，你可以继续追问：

```text
它为什么认为这个客户有风险？
它参考了哪些对象和指标？
这个动作是否符合权限边界？
这个风险等级会影响哪些后续流程？
有没有触发人工审核？
最后业务结果是否改善？
```

这才是 AI Agent 时代真正有价值的可观测性。

不是只看“调用成功了没有”。

而是看：

```text
Agent 是否在正确的业务语义里行动。
```

所以 Agent 行为记录和语义层是前后相连的。

行为记录是证据。

语义层是解释行为的上下文。

没有行为记录，Agent 的行为不可追踪。

没有语义层，行为记录只是流水账。

---

## 7. 企业落地时，可能不是二选一

从工程落地看，我不认为未来只有一种答案。

更现实的架构可能是分层的。

第一层，是数据治理和数据语义。

企业需要先把数据资产、权限、指标口径、血缘关系治理好。

这一层是 Snowflake、Databricks 这类数据平台的主场。

第二层，是业务对象和流程建模。

企业需要把客户、订单、设备、供应商、合同、风险、审批、动作这些东西抽象出来。

这一层更接近 Palantir Ontology 的方向。

第三层，是 Agent 行为记录。

Agent 的每次计划、检索、工具调用、决策、失败、重试、最终结果，都要被记录下来。

第四层，是评估和反馈闭环。

这时系统就可以形成一个持续改进循环：

```text
agent behavior
  -> evaluation
  -> failure analysis
  -> policy / prompt / tool / workflow update
  -> new behavior
```

这样看，数据语义层和世界建模并不是谁消灭谁。

它们更像是企业 AI 的两个连续阶段：

```text
先让 Agent 读懂数据
再让 Agent 理解业务世界
最后让 Agent 在反馈闭环里持续改进
```

---

## 8. 小结

这一篇想表达的核心其实很简单：

**AI Agent 不是只需要更多上下文，它需要一个可理解、可约束、可行动的语义世界。**

Snowflake / Databricks 代表的是数据平台路线。

它们解决的是：

```text
AI 如何正确读懂企业数据。
```

Palantir 代表的是世界建模路线。

它解决的是：

```text
AI 如何在企业业务世界里正确行动。
```

这两者的冲突，不是营销话术之争，而是架构中心的不同：

```text
一个以数据为中心
一个以业务对象和行动为中心
```

最后用一句话收束：

**Data Semantic Layer 解决的是“AI 如何正确读懂数据”；Ontology 解决的是“AI 如何在企业世界里正确行动”。**

---

## 参考资料

- Palantir Foundry Ontology Overview: https://palantir.com/docs/foundry/ontology/overview/
- Palantir AIP: https://www.palantir.com/platforms/aip/
- Snowflake Cortex Agents: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents
- Snowflake Cortex Analyst: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst
- Snowflake Semantic Views: https://docs.snowflake.com/en/user-guide/views-semantic/overview
- Databricks AI/BI Genie: https://docs.databricks.com/aws/en/genie/
- Databricks MLflow Tracing for GenAI: https://docs.databricks.com/aws/en/mlflow3/genai/tracing/
- Spider 2.0: Evaluating Language Models on Real-World Enterprise Text-to-SQL Workflows: https://arxiv.org/abs/2411.07763
- Omni Analytics, Why text-to-SQL fails: https://omni.co/blog/why-text-to-sql-fails
- MotherDuck, Your Data Model Is the Semantic Layer: https://motherduck.com/blog/bird-bench-and-data-models/
- dbt Labs, Text-to-SQL vs Semantic Layer: https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026

<div class="wechat-follow">
  <p>原文首发微信公众号「巴马AI」。</p>
  <p>微信搜索「巴马AI」<button class="hub-copy" type="button" data-copy-wechat>复制名称</button></p>
  <img src="/images/wechat-qr.jpg" alt="关注公众号巴马AI">
</div>
