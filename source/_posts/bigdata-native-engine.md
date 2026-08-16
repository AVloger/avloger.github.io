---
title: 为什么 Spark 还没过时，但执行引擎正在被重写？
author: 巴马AI
date: 2026-08-11 21:00:00
draft: false
summary: Spark、Flink、Trino 这一代大数据引擎解决的是平台化问题：SQL / DataFrame、调度、容错、Shuffle、状态管理和生态集成。但现代硬件和 AI / Python 数据链路把瓶颈推向了执行层：CPU 利用率、内存布局、序列化、向量化和跨语言数据交换。Arrow、Velox、DataFusion、Gluten 的兴起，不是要简单替代 Spark，而是让控制面继续平台化，执行面开始 Native 化。
description: 本文讨论现代计算引擎的分层演进：为什么 Spark / Flink / Trino 仍然重要，为什么 JVM 执行层开始遇到硬件效率瓶颈，Apache Arrow、Velox、DataFusion、Gluten、DuckDB、Polars 分别解决什么问题，以及企业做大数据引擎选型时应该看哪一层。
coverImage: /images/bigdata-native-engine/01-cover-control-execution-plane.png
cover: /images/bigdata-native-engine/01-cover-control-execution-plane.png
categories:
  - 公众号
tags:
  - Spark
  - Arrow
  - Velox
  - 执行引擎
channel: wechat
---
大数据技术圈里有一个很容易被误解的现象。

一边，Spark 仍然在大量企业生产环境里跑核心任务。

离线 ETL、湖仓批处理、特征工程、数据清洗、报表加工，很多团队仍然离不开 Spark。

另一边，新的计算执行项目又越来越热：

```text
Apache Arrow
Velox
DataFusion
Gluten
DuckDB
Polars
```

看起来像是新旧两代系统在交替。

但真实情况没有这么简单。

Spark 没有突然过时。

Velox / DataFusion 也不是简单要把 Spark 替代掉。

真正发生变化的是：

**大数据计算栈开始重新分层。**

Spark、Flink、Trino 这一代系统已经把大规模计算平台化做得足够成熟。企业不再缺一个能跑 SQL、能调度任务、能接数据湖、能做容错的大数据平台。

新的瓶颈开始下沉到更底层：

```text
CPU 有没有吃满？
内存是不是连续？
数据是不是列式？
跨语言交换有没有反复序列化？
Join / Aggregation 有没有充分利用缓存和 SIMD？
Python、JVM、C++、Rust 之间能不能少搬数据？
```

这些东西看起来很杂。

但它们背后其实是同一个趋势：

**控制面继续复用成熟分布式系统，执行面开始向 Native、列式、向量化、可复用内核迁移。**

这不是“Spark 要被淘汰了”。

更准确地说，是：

**Spark 解决的是平台化问题；Velox / DataFusion 解决的是执行层效率问题。**

这篇就从这个角度聊聊：

为什么 Spark 还没过时，但执行引擎正在被重写？

<!--
IMAGE_PROMPT_01_COVER
用途：文章封面图。
位置：标题后或作为 coverImage。
画面：一个现代数据计算栈剖面图，左侧是 Spark/Flink/Trino 代表的控制面，右侧是 Velox/DataFusion/Arrow 代表的执行面，中间有一条清晰分界线。底部是 CPU、内存、SIMD、NVMe、对象存储等硬件元素。标题文字：“控制面继续平台化，执行面开始 Native 化”。
风格：专业科技公众号封面，白底，浅蓝/深灰主色，少量绿色和橙色强调，干净、工程化，不要卡通，不要夸张渐变。
尺寸：16:9。
-->

![现代数据计算栈：控制面与执行面](/images/bigdata-native-engine/01-cover-control-execution-plane.png)

---

## 1. Spark 这一代解决的是平台化，不只是执行速度

很多讨论大数据引擎的人，容易把问题简化成：

```text
Spark 快不快？
Flink 快不快？
Trino 快不快？
ClickHouse 快不快？
```

但这不是最重要的问题。

Spark、Flink、Trino 这一代系统真正解决的，是大规模计算的平台化问题。

以 Spark 为例。

它不只是一个 SQL 执行器，也不只是一个 DataFrame API。

它同时承担了很多平台能力：

- SQL / DataFrame / Dataset 接口
- Catalyst 优化器
- 分布式任务调度
- Shuffle
- 容错和重试
- 资源管理
- 数据源连接
- Hive Metastore / Catalog 集成
- Parquet / ORC / Iceberg / Delta / Hudi 等湖仓生态
- 企业权限、审计、调度、监控链路集成

这些能力不是单机数据库可以轻易替代的。

一个企业用了多年 Spark，积累的往往不是几段 SQL，而是一整套生产体系：

```text
调度平台
数据湖表格式
元数据系统
权限和治理
作业监控
失败重跑
成本核算
团队经验
```

所以 Spark 没有过时。

它仍然很适合处理：

- 大规模离线 ETL
- 湖仓批处理
- 特征工程
- 多阶段 Shuffle
- 复杂数据清洗
- 企业级生产调度
- 需要和既有 Hadoop / Hive 生态深度集成的场景

Flink 也是类似逻辑。

Flink 的价值不是“比 Spark 更新”，而是它把流处理、状态、事件时间、checkpoint、Exactly-once 这些能力做成了一等公民。

Trino / Presto 解决的又是另一类问题：

```text
如何用一个 SQL 层跨多个数据源做交互式查询？
```

它们的核心能力是 connector 生态、联邦查询、数据湖交互式 SQL，而不是重型 ETL 调度。

所以，评价这一代系统，不能只看单条 query 的 benchmark。

它们真正的价值是：

**把分布式计算、调度、容错、生态和治理封装成平台能力。**

<!--
IMAGE_PROMPT_02_PLATFORM_LAYER
用途：解释 Spark/Flink/Trino 这一代的价值。
位置：第 1 节末尾。
画面：一张“平台能力地图”。中心是 Spark/Flink/Trino 三个大节点，周围连接 SQL/DataFrame、Scheduler、Shuffle、Fault Tolerance、Catalog、Lakehouse、Governance、Monitoring、Resource Manager。底部标注“平台化能力，不只是算子执行速度”。
风格：架构图，白底，线条清晰，节点不要太多，适合手机阅读。中文标签为主，英文技术词保留。
尺寸：16:9。
-->

![Spark / Flink / Trino 平台能力地图](/images/bigdata-native-engine/02-platform-layer-map.png)

---

## 2. 为什么新的瓶颈开始出现在执行层

早期大数据系统的瓶颈，常常在磁盘、网络、调度和容错。

那时机器容易坏，磁盘慢，网络带宽有限，任务能稳定跑完就已经很重要。

但现在硬件环境变了。

很多生产环境已经有：

- NVMe SSD
- 100G 网络
- 大内存机器
- 多核 CPU
- 云对象存储
- 高速缓存层
- GPU / TPU 等加速器

硬件变强之后，一个尴尬的问题出现了：

**系统能跑大规模任务，不代表它能榨干现代硬件。**

对于分析型负载，真正烧 CPU 的地方往往集中在执行层：

- Scan
- Filter
- Project
- Expression evaluation
- Hash Join
- Aggregation
- Sort
- TopN
- Encode / decode
- Compression / decompression
- UDF 调用
- 跨语言数据交换

这些操作对底层实现非常敏感。

优秀的执行引擎需要关心：

```text
数据是不是连续内存？
能不能批量处理？
能不能减少对象分配？
能不能提高 CPU cache 命中率？
能不能减少分支和虚函数调用？
能不能利用 SIMD？
能不能减少序列化和拷贝？
```

JVM 生态并不是不能做优化。

Spark 很早就做了 Tungsten、UnsafeRow、Whole-stage Codegen、ColumnarBatch 等工作，目的就是减少 Java 对象、降低 GC 压力、改善内存布局，并通过代码生成减少解释执行开销。

但 JVM 的对象模型、GC、运行时边界、跨语言交互，仍然让它很难像从底层围绕 columnar / vectorized / native execution 设计的系统那样贴近硬件。

这就是现代计算引擎演进的关键背景：

```text
平台层已经成熟；
新的性能红利在执行层。
```

以前的问题是：

```text
如何让一万个节点一起把任务跑完？
```

现在的问题变成：

```text
每个节点上的 CPU cycle 有没有被有效利用？
```

<!--
IMAGE_PROMPT_03_HARDWARE_BOTTLENECK
用途：说明瓶颈从平台层下沉到执行层。
位置：第 2 节末尾。
画面：左右对比图。左侧“早期大数据瓶颈”：Disk、Network、Failure、Scheduler；右侧“现代执行层瓶颈”：CPU cache、SIMD、Memory layout、Serialization、Vectorized operators。中间箭头写“硬件变强后，瓶颈下沉”。
风格：技术对比图，专业、克制，避免太花。用浅灰背景和蓝/橙重点色。
尺寸：16:9。
-->

![现代硬件下的执行层瓶颈迁移](/images/bigdata-native-engine/03-hardware-bottleneck-shift.png)

---

## 3. Arrow：先统一内存里的数据长什么样

执行层重写之前，还有一个更基础的问题要解决：

**不同系统之间，内存里的数据长得不一样。**

JVM 有自己的对象模型。

Python 有自己的对象系统。

Pandas / NumPy 有自己的数组结构。

C++ / Rust 引擎有自己的 vector。

数据库结果集又可能是一套格式。

如果这些系统互相传数据，每次都要：

```text
对象 -> 序列化 -> 字节流 -> 反序列化 -> 另一个对象
```

CPU 很容易浪费在“打包和拆包”上。

PySpark 就是典型例子。

用户在 Python 里写 Spark，但 Spark 的核心执行在 JVM 中。数据从 Spark 传到 Pandas / NumPy，再传回来，传统路径里会经过多次序列化、反序列化和拷贝。

Apache Arrow 解决的不是计算问题。

它解决的是：

**分析型数据在内存里应该用什么统一格式表示。**

Arrow 定义了一套语言无关的列式内存格式。

这带来三个价值。

第一，列式布局。

分析查询往往只访问部分列，并对大量行做批量运算。列式内存更适合缓存局部性、压缩、向量化和 SIMD。

第二，跨语言一致性。

Java、Python、C++、Rust 可以围绕同一种内存结构交换数据，减少格式转换成本。

第三，零拷贝友好。

在共享内存、进程内嵌入、结果集传递等场景，如果生产方和消费方都理解 Arrow，就可以减少重复构造对象和反复序列化。

需要注意：

Arrow 不是数据库。

Arrow 也不是完整计算引擎。

它更像分析系统之间的“内存协议”。

可以这样理解：

```text
Parquet：数据落盘时的列式格式
Arrow：数据在内存里交换和计算时的列式格式
```

所以 Arrow 的意义不是“让所有计算自动变快”。

它的意义是：

**现代数据系统终于可以围绕同一种内存格式协作。**

这也是 Polars、DataFusion、PySpark Arrow 优化、数据库结果集传输、AI 特征数据交换都关注 Arrow 的原因。

<!--
IMAGE_PROMPT_04_ARROW_MEMORY_PROTOCOL
用途：解释 Arrow 不是数据库，而是内存协议。
位置：第 3 节末尾。
画面：中间是 Apache Arrow Columnar Memory，左侧连接 JVM/Spark，Python/Pandas，C++，Rust；右侧连接 Polars、DataFusion、Database Result、AI Feature Pipeline。底部对比：Parquet = on disk columnar format；Arrow = in memory columnar format。
风格：协议层架构图，白底，列式内存可以画成多列数组块。专业清爽。
尺寸：16:9。
-->

![Apache Arrow 内存列式协议架构](/images/bigdata-native-engine/04-arrow-memory-protocol.png)

---

## 4. Velox / DataFusion：执行内核开始从系统里拆出来

Arrow 统一了内存格式，但不直接解决执行问题。

真正决定查询性能的，仍然是算子怎么写。

典型热点包括：

- 表达式求值
- Filter
- Project
- Hash Join
- Aggregation
- Sort
- 字符串函数
- 复杂类型处理
- 内存分配
- Spill
- 编码和解码
- 函数语义

过去每个系统都要自己维护一套执行实现。

Spark 有一套。

Presto / Trino 有一套。

流处理系统有一套。

特征工程平台有一套。

新数据库可能还要再写一套。

这会带来两个问题。

第一，重复建设。

Filter、Join、Aggregation、表达式、函数库、内存管理，这些底层能力并不会因为上层系统不同而完全不同。

第二，底层语义和性能难统一。

每个系统各写一套，就容易出现函数行为不一致、复杂类型处理不一致、内存行为不一致、性能边界不一致。

Velox 和 DataFusion 代表了一个新的方向：

**把高性能执行内核从完整系统里拆出来，做成可复用组件。**

Velox 是 Meta 开源的 C++ 执行引擎库。

它不是完整数据库，也不是独立分布式 SQL 系统。

它更像一个高性能执行内核，提供：

- vector 数据结构
- 表达式执行
- Filter / Project
- Hash Join
- Aggregation
- Sort
- 函数库
- 内存管理
- connector 接口

上层系统负责 SQL、优化器、调度、资源管理、容错、catalog 和生态。

Velox 负责把具体算子执行得更快、更贴近硬件。

DataFusion 则是 Rust / Arrow 生态的查询引擎。

它使用 Arrow 作为内存模型，提供 SQL、DataFrame、逻辑计划、物理计划、优化器和执行框架。

它更适合被嵌入到新系统里，例如：

- 新一代日志分析系统
- 时序数据库
- 数据湖查询服务
- 嵌入式 OLAP
- 自定义数据平台
- AI 数据处理组件

Velox 和 DataFusion 的共同点是：

```text
它们不急着替代整个大数据平台；
而是先把执行内核变成可复用能力。
```

这是大数据计算栈的一次重要分层。

<!--
IMAGE_PROMPT_05_EXECUTION_KERNEL
用途：解释 Velox / DataFusion 的定位。
位置：第 4 节末尾。
画面：上层是多个系统：Spark、Trino、Streaming、Feature Platform、Custom Database。中间是 shared native execution kernel，分成 Velox(C++) 和 DataFusion(Rust/Arrow)。底层是 operators：Filter、Project、Hash Join、Aggregation、Sort、Functions、Memory。强调“不是完整数据库，而是可复用执行内核”。
风格：分层架构图，C++ 和 Rust 用不同色块，整体专业、清楚。
尺寸：16:9。
-->

![Velox / DataFusion 可复用执行内核](/images/bigdata-native-engine/05-execution-kernel-reuse.png)

---

## 5. Gluten：不是替代 Spark，而是给 Spark 换执行层

如果 Velox 是执行内核，那么 Gluten 更像 Spark 和 Native 后端之间的适配层。

Gluten 的目标，是把 JVM-based SQL engine 的执行下推到 native engine。

最典型的场景，就是 Spark SQL / DataFrame 加速。

很多文章会把它讲成：

```text
Spark 被 C++ 替代了
```

这个说法不准确。

更准确的结构是：

```text
Spark：SQL / DataFrame、Catalyst、调度、Shuffle、容错、生态
Gluten：把 Spark physical plan 转成 native plan，处理 columnar 交换和 fallback
Velox：执行 CPU 密集型算子
```

也就是说，Spark 仍然保留它最有价值的平台能力。

Gluten 尝试替换的是一部分执行层。

这条路线为什么现实？

因为大型企业已经有大量 Spark 资产：

- Spark SQL 作业
- DataFrame 代码
- 调度平台
- 数据湖表格式
- 权限系统
- 元数据系统
- 运维经验
- 成本核算体系

完全迁移到一个新计算系统，成本很高。

但如果能尽量不改用户 SQL / DataFrame，把 CPU 密集型执行下沉到 Velox 这类 native backend，就可能获得性能收益。

这就是 Gluten 的工程价值：

**不推翻 Spark 平台层，只替换一部分数据平面。**

但它不是万能性能开关。

适合它的场景通常是：

- Spark SQL 占比高
- 算子标准化程度高
- Filter / Join / Aggregation 等 CPU 密集型负载多
- UDF 不复杂
- 数据已经能走 columnar path
- 平台团队有能力维护 native 依赖

不适合的场景包括：

- 主要瓶颈在 Shuffle、IO、数据倾斜，而不是 CPU 算子
- 大量复杂 UDF
- Spark 版本和 SQL 方言兼容成本高
- fallback 频繁导致 JVM / Native 来回转换
- 团队缺少 native backend 的调试和运维能力

所以 Gluten + Velox 的定位要讲清楚：

```text
它不是用 C++ 重写 Spark；
它是给 Spark SQL 的一部分物理执行换发动机。
```

<!--
IMAGE_PROMPT_06_GLUTEN_SPARK_OFFLOAD
用途：解释 Gluten + Velox 如何给 Spark 换执行层。
位置：第 5 节末尾。
画面：一条 Spark SQL 查询执行链路。左侧 Spark SQL / DataFrame，进入 Catalyst Optimizer，再到 Spark Physical Plan。中间 Gluten Adapter 把可支持的 plan 转成 Native Plan。右侧 Velox C++ Engine 执行 Filter/Join/Aggregation。下方画 fallback path 回到 Spark JVM，标注“不是所有算子都能下推”。
风格：流程图，箭头清晰，fallback 用虚线，颜色克制。
尺寸：16:9。
-->

![Gluten 将 Spark Plan 下推到 Velox](/images/bigdata-native-engine/06-gluten-spark-offload.png)

---

## 6. DuckDB / Polars：不是所有分析都需要分布式

这一轮执行层变化，不只发生在大数据集群里。

单机分析也在变化。

过去很多数据分析任务默认上 Spark。

但原因有时候不是数据真的大到必须分布式，而是过去缺少足够好的单机分析引擎。

现在 DuckDB 和 Polars 改变了这个判断。

DuckDB 是嵌入式 OLAP 数据库。

它适合在单机上高效处理 Parquet、CSV、本地文件和中等规模分析任务。

它的优势是：

- 嵌入式
- 列式向量化执行
- SQL 体验好
- 直接读 Parquet
- 不需要启动大集群

Polars 是 Rust 实现的 DataFrame 引擎。

它面向 Python 数据分析生态，但底层不是 Python 对象驱动，而是更接近 Arrow / columnar / vectorized 的执行模型。

它适合很多 Pandas 过去吃力的场景：

- 更大数据量的单机 DataFrame
- 更强多线程能力
- 更低 Python 解释器开销
- 更好的 lazy execution
- 更自然的 Arrow / Parquet 互通

这说明一个很重要的变化：

**分布式不是默认答案。**

分布式系统有成本：

- 调度成本
- Shuffle 成本
- 网络成本
- 启动成本
- 运维成本
- 调试成本
- 多租户资源成本

如果单机 native vectorized engine 能在合理时间内完成任务，它可能比上 Spark 更简单、更快、更便宜。

所以现代数据平台会越来越强调按任务规模选择执行位置：

```text
小到中等规模分析：DuckDB / Polars
大规模 ETL 和复杂 Shuffle：Spark
持续流和状态计算：Flink
跨数据源交互 SQL：Trino
高并发 OLAP 服务：ClickHouse / Doris / StarRocks
```

<!--
IMAGE_PROMPT_07_DISTRIBUTED_NOT_DEFAULT
用途：解释不是所有分析都要上分布式。
位置：第 6 节末尾。
画面：横轴是数据规模/并发/状态复杂度，从 Local 到 Cluster 到 OLAP Service。左侧 DuckDB/Polars，中间 Spark/Flink/Trino，右侧 ClickHouse/Doris/StarRocks。标注“分布式是一种成本，不是默认答案”。
风格：选型坐标图，简单清楚，适合公众号横图。
尺寸：16:9。
-->

![分布式不是默认答案的选型坐标](/images/bigdata-native-engine/07-distributed-not-default.png)

---

## 7. 现代计算引擎选型：先判断要替换哪一层

面对这么多名字，最怕的是把它们放在一个表里横向比较：

```text
Spark vs Velox
Flink vs Arrow
Trino vs DataFusion
DuckDB vs Gluten
```

这些比较本身就不太成立。

因为它们不在同一层。

更好的方式，是先问：

**我到底要替换哪一层？**

可以粗略分成五层。

第一层，平台层。

代表是 Spark、Flink、Trino。

它们解决的是 SQL / DataFrame、调度、容错、Shuffle、状态、connector、数据湖生态和生产治理。

如果你的问题是 PB 级 ETL、复杂流状态、跨数据源查询、企业调度和治理，平台层仍然是核心。

第二层，内存协议层。

代表是 Arrow。

它解决的是跨语言、跨系统、跨进程的数据表示和交换问题。

如果你的问题是 PySpark / Pandas、UDF、数据库结果集、AI 特征链路之间的数据搬运，Arrow 是重点。

第三层，执行内核层。

代表是 Velox、DataFusion。

它们解决的是表达式、过滤、投影、Join、聚合、排序、函数、内存管理这些底层算子的复用和效率问题。

如果你在构建新系统，或者想让多个系统复用一套高性能执行层，就应该关注这一层。

第四层，适配层。

代表是 Gluten。

它解决的是如何把既有 Spark plan 下推到 native backend。

如果你已经有大量 Spark SQL 资产，又确认瓶颈主要在 CPU 执行层，可以评估这一层。

第五层，单机分析和 OLAP 服务层。

代表是 DuckDB、Polars、ClickHouse、Doris、StarRocks。

它们解决的是更具体的分析体验：

- 单机交互分析
- Python DataFrame 加速
- 高并发 OLAP 查询
- 明细聚合
- 实时看板

所以选型时不要问：

```text
谁替代谁？
```

而要问：

```text
我的瓶颈在哪一层？
这一层是否值得被替换？
替换之后，上层生态和生产体系还能不能承接？
```

<!--
IMAGE_PROMPT_08_SELECTION_LAYER_MAP
用途：最终选型总图。
位置：第 7 节末尾或结论前。
画面：五层架构图。平台层：Spark/Flink/Trino；内存协议层：Arrow；执行内核层：Velox/DataFusion；适配层：Gluten；单机/OLAP 层：DuckDB/Polars/ClickHouse/Doris/StarRocks。每层旁边写“解决什么问题”。底部结论：“不是谁替代谁，而是哪一层该被替换”。
风格：高密度但清晰的信息图，白底，蓝灰主色，每层一个浅色带。
尺寸：16:9。
-->

![现代计算引擎分层选型图](/images/bigdata-native-engine/08-selection-layer-map-v2.png)

---

## 结论：控制面继续平台化，执行面开始 Native 化

现代计算引擎的演进，不是一条“新引擎消灭旧引擎”的直线。

Spark、Flink、Trino 没有失去价值。

它们仍然承担着平台层能力：

```text
SQL / DataFrame
调度
容错
Shuffle
状态
数据湖生态
元数据
权限治理
生产运维
```

但现代硬件和现代数据工作负载，把新的性能问题推向了执行层：

```text
内存布局
对象分配
序列化
CPU cache
SIMD
列式批处理
跨语言数据交换
Native 算子
```

Arrow、Velox、DataFusion、Gluten、DuckDB、Polars 的意义，就在于它们分别拆解了这一层的问题。

Arrow 统一内存格式。

Velox 提供 C++ native 执行内核。

DataFusion 提供 Rust / Arrow-native 查询框架。

Gluten 尝试把 Spark 的部分执行下推到 native backend。

DuckDB 和 Polars 证明很多分析任务可以在单机 native 引擎里完成。

所以这轮变化的本质是：

**控制面继续平台化，执行面开始 Native 化。**

这也是为什么 Spark 还没过时，但执行引擎正在被重写。

真正成熟的架构，不是把所有东西换成一个新引擎。

而是判断清楚：

```text
哪一层应该复用成熟平台；
哪一层应该引入新的执行能力。
```

---

## 参考资料

- [Apache Arrow 官方介绍](https://arrow.apache.org/)
- [Apache Arrow Columnar Format](https://arrow.apache.org/docs/format/Columnar.html)
- [Apache Arrow in PySpark](https://spark.apache.org/docs/latest/api/python/tutorial/sql/arrow_pandas.html)
- [Apache Spark SQL Performance Tuning](https://spark.apache.org/docs/latest/sql-performance-tuning.html)
- [Velox 官方文档](https://velox-lib.io/)
- [Meta Engineering: Introducing Velox](https://engineering.fb.com/2023/03/09/open-source/velox-open-source-execution-engine/)
- [Apache Gluten 官方介绍](https://gluten.apache.org/)
- [Apache DataFusion 官方文档](https://datafusion.apache.org/)
- [DuckDB: Why DuckDB](https://duckdb.org/why_duckdb.html)
- [Polars User Guide](https://docs.pola.rs/)

<div class="wechat-follow">
  <p>原文首发微信公众号「巴马AI」。</p>
  <p>微信搜索「巴马AI」<button class="hub-copy" type="button" data-copy-wechat>复制名称</button></p>
  <img src="/images/wechat-qr.jpg" alt="关注公众号巴马AI">
</div>
