---
title: 从Jeff Dean回看现代大规模计算基础设施的二十年
author: 巴马AI
date: 2026-08-08 21:00:00
draft: false
summary: Jeff Dean 离开 Google 创办 Discovery Loop，不只是一个 AI 圈人事新闻。沿着他和 Google 的系统工程线索，可以看到现代大规模计算基础设施如何从搜索引擎背后的分布式存储与批处理，发展到全球一致数据库、交互式分析、分布式机器学习和大模型训练底座。
description: 本文借 Jeff Dean 离开 Google 创业这一事件，回顾 Google 大规模计算基础设施的发展：GFS、MapReduce、Bigtable、Spanner、Dremel、DistBelief、TensorFlow、Pathways，以及它们对 Hadoop、Spark、Flink、BigQuery、现代 AI Infra 和执行引擎选型的影响。
coverImage: /images/jeff-dean-compute-engine-selection/01-jeff-dean-google-infra-cover.png
cover: /images/jeff-dean-compute-engine-selection/01-jeff-dean-google-infra-cover.png
categories:
  - 公众号
tags:
  - Jeff Dean
  - 基础设施
  - Google
  - AI Infra
channel: wechat
---
2026 年 8 月，Jeff Dean 离开 Google。

和他一起离开的，还有 Sanjay Ghemawat、Oriol Vinyals、Quoc Le。几个人创办了一家新的 AI 公司 Discovery Loop，方向是用 AI 自动化科学和工程研究。

这个新闻很容易被理解成“Google 又流失了一批 AI 大牛”。

但如果把镜头拉远一点，它更像是一个时代节点。

Jeff Dean 和 Sanjay Ghemawat 这组名字，几乎贯穿了 Google 大规模计算基础设施的黄金年代。很多今天看起来理所当然的数据系统概念：分布式文件系统、MapReduce、列式分析、NoSQL、全球一致数据库、参数服务器、分布式训练框架，都和 Google 当年的工程问题有关。

Google 不是最早做数据库的公司，也不是最早做分布式系统的公司。

但 Google 很特殊。

它在一个非常早的时间点，同时遇到了几个传统企业不常遇到的问题：

```text
网页规模太大
机器数量太多
硬件故障太频繁
索引更新太快
查询延迟要求太高
全球服务范围太广
机器学习模型越来越大
```

这些问题逼着 Google 不能只买更大的机器，也不能只依赖传统商业数据库。

它必须自己建设一整套基础设施。

所以，写 Jeff Dean，不只是写一个工程师的履历。

更有意思的是借这条线回顾：

**现代大规模计算基础设施是怎么一步步长出来的。**

![Jeff Dean 与 Google 基础设施回顾](/images/jeff-dean-compute-engine-selection/01-jeff-dean-google-infra-cover.png)

---

## 1. 搜索引擎先逼出了分布式基础设施

Google 早期最大的产品是搜索。

搜索看起来是一个用户输入关键词、系统返回网页的产品。

但从基础设施角度看，它背后至少有三类巨大工程问题。

第一，网页要持续抓取和存储。

互联网规模不断变大，网页内容不断变化。系统不能只保存少量结构化数据，而要保存海量半结构化内容、倒排索引、链接图、页面特征和中间计算结果。

第二，索引要不断计算和更新。

搜索质量依赖 PageRank、文本处理、反作弊、语言模型、排序特征。很多任务需要反复扫描大规模数据集，并生成新的索引和统计结果。

第三，服务必须高可用、低延迟。

用户查询不能等一个离线任务跑完。搜索服务要在全球范围内稳定响应，底层任何一台机器坏掉，都不应该让用户感知。

这三个问题共同指向一个事实：

**Google 需要的不是一个单点数据库，而是一套能在廉价机器集群上持续运行的数据基础设施。**

这就是 Google 大规模计算系统的起点。

后来行业常说 Hadoop 生态、大数据平台、数据湖、分布式计算，其实很多基本问题在这个阶段已经出现了：

```text
数据怎么存？
任务怎么跑？
失败怎么恢复？
状态怎么管理？
查询怎么加速？
全球服务怎么保持一致？
```

Jeff Dean 这一代工程师的贡献，就是把这些问题从“每个业务团队自己解决”，变成“由基础设施统一解决”。

---

## 2. GFS：先承认机器一定会坏

![GFS 能力简介](/images/jeff-dean-compute-engine-selection/03-node-gfs-capability.png)

虽然大家谈 Google 大数据时最常提 MapReduce，但真正的底座要从 GFS 说起。

GFS，全称 Google File System。

它解决的问题非常朴素：

```text
如果我们有成千上万台普通机器，
每台机器都可能坏，
还能不能把它们组织成一个可靠的大文件系统？
```

传统企业存储系统更强调昂贵硬件和单机可靠性。

Google 的思路不一样。

它默认硬件会失败。

磁盘会坏。

机器会掉线。

网络会抖。

机房会出问题。

系统设计不是试图消灭故障，而是把故障当成常态，然后通过复制、chunk、master 管理、自动恢复，把一堆普通机器组合成一个可用的分布式文件系统。

这件事后来深刻影响了 Hadoop HDFS。

很多企业第一次接触大数据平台，接触的其实就是这套思想：

```text
不要把可靠性完全寄托在单台机器上。
把数据切开、复制、分布到集群里。
让软件层承担容错。
```

从这个角度看，GFS 不是一个普通文件系统。

它代表的是 Google 对大规模基础设施的第一条基本判断：

**规模上来以后，失败不是异常，而是运行环境的一部分。**

---

## 3. MapReduce：把批处理变成一种编程模型

![MapReduce 能力简介](/images/jeff-dean-compute-engine-selection/04-node-mapreduce-capability.png)

有了 GFS，只是解决了数据存在哪里。

下一个问题是：

**这么多数据怎么计算？**

如果每个团队都自己写分布式程序，就会反复处理同样的细节：

- 数据切分
- 任务调度
- 数据本地性
- 中间结果落盘
- Shuffle
- 失败重试
- straggler 处理
- 最终结果合并

MapReduce 的厉害之处，是把这些复杂性收敛成一个极简模型：

```text
map：把输入记录变成中间 key-value
reduce：把同一个 key 的中间结果聚合起来
```

比如要统计全网网页里每个词出现了多少次。

如果只有一台机器，逻辑很简单：

```text
读网页 -> 拆词 -> 计数 -> 汇总
```

但 Google 面对的不是几万个网页，而是海量网页和日志。

这时真正困难的不是“计数”本身，而是：

```text
数据太大，一台机器读不完；
机器很多，任务必须自动切分；
中间结果要按词重新分组；
某台机器失败后，任务要能自动重跑；
尽量让计算发生在数据所在机器附近，减少网络搬运。
```

MapReduce 的执行路径大致是：

```text
原始网页 / 日志分片
  -> map：每台机器并行产生 (word, 1)
  -> shuffle：系统把相同 word 的中间结果拉到一起
  -> reduce：对同一个 word 求和
  -> 输出：word -> count
```

所以 MapReduce 表面上是 map / reduce 两个函数。

它真正高效的地方在系统层：

- **数据本地性**：尽量把计算调度到数据所在机器，少搬原始数据
- **自动分片**：把大输入拆成很多小任务，提高并行度
- **Shuffle 分组**：按 key 自动重排中间结果，用户不用自己写网络传输
- **失败重试**：某个 task 挂了可以重跑，不影响整体结果
- **Straggler 处理**：慢任务可以被重新调度，避免拖住整个 job

用户只要写 map 和 reduce。

系统负责调度、容错、数据移动和任务重试。

今天看，MapReduce 很笨重。

它不适合交互式分析，也不适合复杂迭代计算。多阶段任务要串多个 job，开发体验也很粗糙。

但 MapReduce 的历史意义不在于今天还应该手写 MapReduce，而在于它完成了一次关键抽象：

**让普通工程师也能在大规模集群上写数据处理程序。**

后来的 Hadoop MapReduce 基本继承了这个模型。

再往后，Spark 用 DAG 和内存计算提高了表达力和性能，Flink 把流处理和状态计算做成更核心的能力，Trino / Presto 把交互式 SQL 查询放到数据湖上。

但它们都继承了 MapReduce 打开的方向：

```text
用户描述计算逻辑；
系统负责分布式执行。
```

---

## 4. Bigtable：搜索之外，Google 还需要管理海量状态

![Bigtable 能力简介](/images/jeff-dean-compute-engine-selection/05-node-bigtable-capability.png)

MapReduce 解决的是批处理。

但 Google 不只有离线计算。

大量在线系统需要持续读写状态：

- 网页索引元数据
- 用户个性化数据
- Google Earth 数据
- 日志和监控数据
- 广告系统特征
- 各种在线服务的稀疏属性

这类数据不一定适合传统关系数据库。

它们规模巨大，结构稀疏，写入和读取吞吐要求很高，访问模式经常围绕 key、列族和时间戳展开。

Bigtable 的抽象是：

```text
一个分布式、持久化、多维排序的稀疏 map
```

它不像传统关系数据库那样强调完整 SQL、复杂 Join 和强事务。

它更关注：

- 水平扩展
- 高吞吐读写
- 自动分片
- 按 row key 排序
- 列族组织
- 多版本数据
- 和 GFS / Chubby 等基础设施配合

Bigtable 对行业影响很大。

HBase 明显受它影响，Cassandra、LevelDB / RocksDB 生态、很多宽列存储、时序存储和日志存储，也都能看到类似思想。

Bigtable 给大数据基础设施补上了另一块拼图：

```text
GFS 负责可靠保存大文件；
MapReduce 负责大规模批处理；
Bigtable 负责海量在线状态。
```

这三者合在一起，构成了 Google 早期数据基础设施的基本形态。

也是后来 Hadoop 生态早期形态的原型：

```text
GFS  -> HDFS
MapReduce -> Hadoop MapReduce
Bigtable -> HBase
```

---

## 5. Dremel：大数据开始走向交互式 SQL

![Dremel 能力简介](/images/jeff-dean-compute-engine-selection/06-node-dremel-capability.png)

GFS、MapReduce、Bigtable 解决了存储、批处理和在线状态。

但还有一个问题没有解决：

**人怎么快速查询海量数据？**

MapReduce 可以处理大数据，但它不是一个舒服的分析工具。

写一个 job，提交，等待，查看结果，再改代码，再提交，这个过程太慢。

对于分析师和工程师来说，更自然的方式是 SQL：

```sql
SELECT country, COUNT(*)
FROM logs
WHERE date = '2026-08-06'
GROUP BY country;
```

Dremel 就是在这个背景下出现的。

它面向的是交互式大规模分析。

Dremel 的关键思想包括：

- 列式存储
- 树形查询执行
- 嵌套数据模型
- 在超大规模数据上做秒级或准交互式聚合

后来 Google BigQuery 就深受 Dremel 影响。

这一步非常重要。

因为它意味着大数据基础设施从“工程师写程序处理数据”，进一步走向“用户用 SQL 直接分析数据”。

从此以后，大数据平台不再只是后台批处理系统。

它开始变成企业数据分析、BI、报表、实验分析、产品洞察的基础设施。

这一变化也解释了为什么后来 Spark SQL、Presto / Trino、ClickHouse、Doris、StarRocks、Snowflake、BigQuery 会成为主角。

大多数企业真正想要的，不是一个能跑分布式程序的平台。

而是：

```text
能不能让人用 SQL 快速、稳定、低成本地问数据问题？
```

---

## 6. Spanner：全球化之后，一致性也变成基础设施

![Spanner 能力简介](/images/jeff-dean-compute-engine-selection/07-node-spanner-capability.png)

如果说 Bigtable 是高可扩展存储，Spanner 则代表 Google 在数据库方向的另一种野心。

随着业务全球化，系统不只是要处理大数据，还要处理全球分布式事务。

跨数据中心复制会带来很多麻烦：

- 数据写到哪个地区？
- 副本之间如何同步？
- 用户读到的是不是最新结果？
- 跨地域事务如何提交？
- 某个机房故障时如何切换？
- 一致性和延迟如何取舍？

传统做法往往是业务系统自己处理一部分复杂性。

但 Spanner 试图把这些能力放进数据库里。

它通过 TrueTime 等基础设施，把时间不确定性显式纳入系统设计，从而在全球分布式场景下提供外部一致性和事务语义。

这件事对行业的意义不只是“Google 做了一个很强的数据库”。

它更像是一个范式变化：

```text
以前：应用自己处理跨地域复制和一致性。
现在：数据库把全球一致性做成基础能力。
```

当然，Spanner 不是所有企业都需要的答案。

如果系统只是单地域 OLTP，或者主要是离线分析，全球强一致反而可能是过度设计。

但 Spanner 的启发在于：

**当业务规模足够大，一致性模型本身也会变成基础设施能力。**

这也是现代数据系统选型容易被低估的一点。

性能不是唯一问题。

你真正买到的，可能是某种复杂度的封装：

```text
批处理复杂度
状态管理复杂度
交互查询复杂度
全球一致性复杂度
```

---

## 7. DistBelief：机器学习从算法问题变成系统问题

![DistBelief 能力简介](/images/jeff-dean-compute-engine-selection/08-node-distbelief-capability.png)

到了深度学习时代，Google 的基础设施问题又发生了一次迁移。

早期大数据系统主要处理网页、日志、索引、广告和在线服务数据。

但深度学习把新的压力带进来：

- 模型参数越来越多
- 训练数据越来越大
- 单机算力不够
- 多机通信成为瓶颈
- checkpoint 和容错变得复杂
- 数据输入管道影响训练效率

DistBelief 是 Google 早期的大规模分布式深度学习系统。

它引入了参数服务器等机制，让模型可以跨大量机器训练。

从今天看，DistBelief 不是一个大众熟悉的框架。

但它代表了一个非常重要的拐点：

**机器学习不再只是算法研究，而是大规模计算基础设施的一部分。**

训练一个大模型，不只是写一个 loss function。

还要处理数据读取、参数切分、梯度通信、分布式调度、故障恢复、模型保存、资源利用率。

这和 MapReduce 时代很像。

只不过 MapReduce 封装的是数据批处理的复杂性。

DistBelief 开始封装的是分布式训练的复杂性。

Google 从搜索公司变成 AI 公司，中间并不是突然跳过去的。

它是沿着大规模计算基础设施一路演进过去的。

---

## 8. TensorFlow：把 AI 计算抽象成图

![TensorFlow 能力简介](/images/jeff-dean-compute-engine-selection/09-node-tensorflow-capability.png)

TensorFlow 是 DistBelief 之后更成功、更开放的一代系统。

它把机器学习程序表示为计算图：

```text
节点是算子
边是 tensor
系统负责在 CPU / GPU / TPU / 多机环境中执行
```

这个抽象和 SQL 引擎很像。

SQL 用户描述“我要什么结果”，优化器决定怎么执行。

TensorFlow 用户描述“计算关系是什么”，运行时决定怎么放置、怎么执行、怎么求导、怎么调度设备。

从基础设施角度看，TensorFlow 的意义不只是一个机器学习框架。

它把 AI 计算推向了更工程化的阶段：

- 自动求导
- 分布式执行
- 异构设备支持
- 计算图优化
- 模型部署
- 训练和推理生态

TensorFlow 也体现了 Google 一贯的系统设计路径：

```text
先在内部遇到极端规模问题；
再抽象成统一系统；
最后影响整个行业。
```

GFS、MapReduce、Bigtable 是这样。

TensorFlow 也是这样。

---

## 9. Pathways：大模型时代，计算底座再次上移

![Pathways 能力简介](/images/jeff-dean-compute-engine-selection/10-node-pathways-capability.png)

Pathways 是 Google 面向下一代 AI 基础设施提出的方向。

如果说 TensorFlow 解决的是计算图和异构设备执行，那么 Pathways 面对的是更大的问题：

- 一个模型跨越大量 TPU / GPU
- 不同任务共享底层能力
- 稀疏激活和条件计算
- 多种并行策略组合
- 编译器、运行时、调度器、硬件拓扑协同

大模型训练和推理，不是简单把旧框架放大。

它已经变成一个更复杂的系统工程问题。

模型本身、数据管道、编译器、通信库、加速器拓扑、调度系统、容错机制，需要一起设计。

Pathways 想解决的，就是如何让一个计算任务跨越大量加速器，同时仍然让上层用户以较高层的方式描述模型和任务。

这和 MapReduce 的精神其实是一致的：

```text
MapReduce：不要让用户直接管理普通机器集群上的批处理失败。
Pathways：不要让用户直接管理超大规模加速器集群上的模型执行复杂度。
```

二十年过去，计算对象从网页和日志变成 tensor 和模型。

但基础设施的核心问题没有变：

**规模越大，越需要新的抽象层。**

---

## 10. Google 这条线给大数据选型什么启发？

回顾 Google 这条基础设施发展线，不是为了说所有公司都应该照搬 Google。

恰恰相反，大多数公司不应该照搬 Google。

Google 当年的很多系统，是被极端规模逼出来的。

如果没有类似规模、类似组织能力、类似工程投入，直接复制复杂架构，往往只会增加成本。

但它给今天的大数据和计算引擎选型提供了一个很好的判断框架：

**先看你要封装哪类复杂度。**

如果你要封装的是大规模离线批处理复杂度，Spark 仍然是最现实的选择之一。

它不一定是每个算子最快的系统，但它有成熟生态、调度能力、SQL / DataFrame API、数据湖集成和大量生产经验。

如果你要封装的是实时流和状态计算复杂度，Flink 更合适。

它把状态、checkpoint、事件时间、窗口、Exactly-once 这些问题放到框架内部处理。

如果你要封装的是跨数据源交互式 SQL 查询复杂度，Trino / Presto 这类引擎更自然。

它们擅长把多个数据源接到同一个 SQL 查询层里。

如果你要封装的是高并发 OLAP 和实时分析复杂度，ClickHouse、Doris、StarRocks 这类列式 OLAP 引擎更适合。

它们的核心优势在扫描、聚合、压缩、列式存储、向量化执行和查询延迟。

如果你要封装的是单机分析复杂度，DuckDB、Polars 这类系统越来越有吸引力。

很多过去默认上 Spark 的任务，其实数据量并没有大到必须分布式。

所以选型不是问：

```text
哪个引擎最先进？
```

而是问：

```text
我的复杂度主要在哪里？
我希望系统替我解决什么？
```

Google 的系统史最有价值的地方就在这里。

它不是一串产品名。

它是一串抽象层的迁移：

```text
GFS：封装机器故障和分布式文件存储
MapReduce：封装大规模批处理
Bigtable：封装海量稀疏状态
Dremel：封装交互式大规模分析
Spanner：封装全球一致事务
DistBelief：封装分布式训练
TensorFlow：封装计算图和异构执行
Pathways：封装大模型时代的跨设备执行
```

![Google 大规模计算基础设施演进](/images/jeff-dean-compute-engine-selection/02-google-infra-logo-timeline.png)

---

## 11. 为什么 Jeff Dean 离职创业这个节点值得写？

Jeff Dean 离开 Google 去做 Discovery Loop，并不是从基础设施转向一个完全无关的新方向。

从公开信息看，Discovery Loop 想做的是用 AI 自动化科学和工程研究。

这个方向听起来更像 AI for Science。

但从系统角度看，它仍然延续了同一条线：

```text
如何把复杂研究过程抽象成系统可以自动执行、评估和迭代的 loop？
```

过去 Google 的基础设施把很多工程复杂度封装掉：

机器故障、批处理、状态存储、全球一致性、分布式训练、异构加速器执行。

而 Discovery Loop 这个名字本身，就暗示了另一类复杂度：

```text
提出假设
设计实验
运行实验
评估结果
更新模型
继续下一轮探索
```

这已经不是传统意义上的“大数据处理”。

但它需要的底层能力，仍然离不开大规模计算基础设施：

- 数据管理
- 实验调度
- 模型训练
- 自动评估
- 资源编排
- 结果追踪
- 长周期状态管理

所以 Jeff Dean 这个节点值得写，不只是因为一个名人离职。

而是因为它刚好把两个时代接起来：

```text
上一个时代：Google 用基础设施自动化大规模互联网计算。
下一个时代：AI 系统尝试自动化科学和工程探索。
```

从搜索索引到大模型，从 MapReduce 到 Pathways，再到 Discovery Loop，这条线背后的主题一直没有变：

**把人类不该反复手工处理的复杂流程，沉淀成系统能力。**

---

## 结论：Google 的大数据史，本质是基础设施不断接管复杂度

Jeff Dean 的职业线索之所以值得回看，是因为它几乎就是现代大规模计算基础设施的一条缩影。

GFS 让 Google 能在普通机器上可靠存储海量数据。

MapReduce 让工程师能在大集群上写批处理程序。

Bigtable 让在线系统能管理海量稀疏状态。

Dremel 让大规模数据分析走向交互式 SQL。

Spanner 让全球一致事务成为数据库能力。

DistBelief 和 TensorFlow 让机器学习训练成为系统工程。

Pathways 则把问题推进到大模型和异构加速器时代。

这些系统共同说明了一件事：

**大规模计算的发展，不是单纯追求更快，而是不断把复杂度放进更底层、更通用、更可复用的基础设施里。**

今天我们做大数据平台选型，依然可以沿用这个思路。

不要只看新名词。

不要只看 benchmark。

不要只看谁用了 C++、谁用了 Rust、谁用了 JVM。

更关键的问题是：

```text
这个系统到底替我接管了哪类复杂度？
它的抽象，是否刚好匹配我的业务规模和工程能力？
```

这也许是 Jeff Dean 和 Google 这二十多年基础设施建设，留给行业最重要的启发。

---

## 参考资料

- [Jeff Dean and other top AI researchers are leaving Google to launch their own startup](https://techcrunch.com/2026/08/05/jeff-dean-and-other-top-ai-researchers-are-leaving-google-to-launch-their-own-startup/)
- [Google's Top AI Brains Are Leaving to Launch Discovery Loop](https://www.wired.com/story/jeff-dean-google-discovery-loop-startup/)
- [Google just announced a major shakeup of its top AI leadership](https://www.theverge.com/tech/975677/google-deepmind-ai-demis-hassabis-shakeup)
- [The Google File System](https://www.cs.princeton.edu/courses/archive/fall09/cos518/papers/gfs.pdf)
- [MapReduce: Simplified Data Processing on Large Clusters](https://www.usenix.org/conference/osdi-04/mapreduce-simplified-data-processing-large-clusters)
- [Bigtable: A Distributed Storage System for Structured Data](https://www.usenix.org/conference/osdi-06/bigtable-distributed-storage-system-structured-data)
- [Dremel / BigQuery: A Decade of Interactive SQL Analysis at Web Scale](https://www.vldb.org/pvldb/vol13/p3461-melnik.pdf)
- [Spanner: Google's Globally-Distributed Database](https://www.usenix.org/conference/osdi12/technical-sessions/presentation/corbett)
- [Large Scale Distributed Deep Networks](https://papers.nips.cc/paper_files/paper/2012/hash/6aca97005c68f1206823815f66102863-Abstract.html)
- [TensorFlow: Large-Scale Machine Learning on Heterogeneous Distributed Systems](https://arxiv.org/abs/1603.04467)
- [Pathways: Asynchronous Distributed Dataflow for ML](https://arxiv.org/abs/2203.12533)
- 图片素材参考：[Google Cloud Icons](https://cloud.google.com/icons)、[GCP Icons](https://gcpicons.com/)、[TensorFlow Logo](https://www.vectorlogo.zone/logos/tensorflow/)

<div class="wechat-follow">
  <p>原文首发微信公众号「巴马AI」。</p>
  <p>微信搜索「巴马AI」<button class="hub-copy" type="button" data-copy-wechat>复制名称</button></p>
  <img src="/images/wechat-qr.jpg" alt="关注公众号巴马AI">
</div>
