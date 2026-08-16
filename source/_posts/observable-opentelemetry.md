---
title: Trace 平台选型：Log 看细节，Metric 看状态，Trace 看因果
author: 巴马AI
date: 2026-07-16 21:00:00
draft: false
summary: Trace 平台选型不只是选择 Jaeger、Tempo 或 SkyWalking，更关键的是先确定埋点标准、上下文传播、采样策略和 Collector 管道。OpenTelemetry 不是 Trace 后端，而是采集标准和管道入口。
description: 本文从 Log、Metric、Trace 三类可观测信号的边界出发，拆解 Trace 为什么是分布式系统里的因果链路数据，以及企业在 Jaeger、Tempo、SkyWalking、商业 APM 与 OpenTelemetry 之间应该如何做技术选型。
coverImage: /images/observable-opentelemetry/01-log-metric-trace-boundary.png
cover: /images/observable-opentelemetry/01-log-metric-trace-boundary.png
categories:
  - 公众号
tags:
  - Trace
  - OpenTelemetry
  - 可观测
channel: wechat
---
前面两篇分别讲了 Log 和 Metric。

这不是为了把可观测性的三个名词按顺序念一遍，而是因为它们解决的是三类完全不同的问题。

Log 解决的是细节问题。

某个进程、某个线程、某段业务逻辑，在某个时间点到底发生了什么。

Metric 解决的是状态问题。

系统现在是不是异常，异常范围有多大，趋势是在变好还是变坏。

Trace 解决的是路径和因果问题。

一次请求从入口进来，经过哪些服务、哪些 RPC、哪些数据库、哪些消息队列，最后是在哪里变慢、在哪里失败、从哪个下游开始扩散。

这就是为什么从 Log 写到 Metric 之后，第三篇必须写 Trace。

因为当系统还是单体应用时，日志通常足够定位大部分问题；当服务拆多了以后，Metric 可以告诉你“支付服务 P99 延迟高了”，但它不一定能告诉你这一次请求到底卡在库存、风控、支付网关，还是数据库连接池。

日志有细节，但缺少全局路径。

Metric 有全局状态，但缺少单次请求的上下文。

Trace 要补的，正是这块空白。

![Log、Metric、Trace 的问题边界](/images/observable-opentelemetry/01-log-metric-trace-boundary.png)

所以 Trace 平台选型的核心，不是“Jaeger 和 Tempo 谁更快”这么简单。

更准确地说，Trace 选型要同时回答四个问题：

```text
1. 应用如何埋点
2. trace context 如何跨服务传播
3. span 数据如何采样、清洗和路由
4. Trace 后端如何存储、查询和展示
```

也正是在这里，OpenTelemetry 会成为绕不开的角色。

下文配图里会用 OTel 作为 OpenTelemetry 的缩写。

它不是 Trace 后端，但它正在成为 Trace 体系的采集标准和管道入口。

---

## 1. Trace 到底是什么数据

Trace 描述的是一次请求的完整调用路径。

一次用户下单请求，可能经过 API Gateway、订单服务、库存服务、优惠券服务、风控服务、支付服务、消息队列和数据库。

在 Trace 里，这次请求会被表示成一个 trace。

trace 下面由多个 span 组成。

每个 span 表示一次局部操作，比如一次 HTTP 调用、一次 RPC 调用、一次 SQL 查询、一次消息投递、一次缓存访问。

```text
trace_id = 一次完整请求
span_id  = 请求中的一次局部操作

HTTP /checkout
  ├─ order.create
  │   ├─ inventory.reserve
  │   ├─ coupon.apply
  │   └─ risk.check
  ├─ payment.charge
  └─ message.publish
```

一个 span 通常包含：

- service name
- operation name
- start time / duration
- parent span
- status / error
- attributes
- events
- resource metadata

Trace 和 Metric 的区别就在这里。

Metric 是聚合后的时间序列。

Trace 是保留上下文的请求执行图。

Metric 更适合回答：

```text
支付服务的错误率是不是升高了？
P99 延迟是不是超过阈值？
这次发布后整体趋势是否变差？
```

Trace 更适合回答：

```text
这一次慢请求慢在哪里？
错误是从哪个服务开始出现的？
某个用户请求为什么经过了异常分支？
跨服务调用链是不是符合预期？
```

所以 Trace 不是 Metric 的附属品。

它是分布式系统里专门描述因果链路的数据。

![Trace 数据模型](/images/observable-opentelemetry/02-trace-data-model.png)

---

## 2. Trace 平台选型，第一层选的是埋点标准

很多团队第一次做 Trace，会直接从后端开始选：

- Jaeger
- Zipkin
- Grafana Tempo
- Apache SkyWalking
- Elastic APM
- Datadog
- New Relic
- 云厂商 APM

这个顺序很自然，但不够完整。

因为 Trace 的第一个难点不是存储，而是埋点。

如果应用没有正确生成 span，没有把 trace_id 传到下游，没有统一 service name、env、version、region、cluster 这些资源字段，再强的后端也只能展示一堆断裂的调用片段。

Trace 平台真正怕的不是“没有 UI”。

它怕的是：

- Java、Go、Python、Node.js 各接一套 SDK
- HTTP、gRPC、MQ、数据库的 span 语义不一致
- trace_id 在异步消息里断掉
- service name 命名混乱
- 错误状态没有统一规范
- 业务关键字段没有打进 span
- 高基数字段被无节制写入

这就是 OpenTelemetry 出现的核心原因。

OpenTelemetry 的定位不是替代 Jaeger 或 Tempo。

它主要解决的是：

```text
应用如何以统一方式产生 Trace
上下文如何跨进程、跨语言、跨协议传播
Trace、Metric、Log 如何拥有统一的资源描述
数据如何通过统一协议进入采集管道
```

也就是说，在现代 Trace 选型里，第一层通常不再是“先选 Jaeger SDK 还是 Zipkin SDK”。

更专业的路径是：

```text
应用侧：OpenTelemetry API / SDK / Auto Instrumentation
协议层：OTLP
管道层：OpenTelemetry Collector
后端层：Jaeger / Tempo / SkyWalking / APM
```

这样做的好处很直接：

应用不被某一个 Trace 后端绑定。

后端未来从 Jaeger 换到 Tempo，或者接入商业 APM，不需要全公司重新改埋点。

![Trace 选型分层](/images/observable-opentelemetry/03-trace-selection-layer-model.png)

---

## 3. Jaeger、Tempo、SkyWalking 分别适合什么

Trace 后端主要负责接收、存储、查询和展示 span。

这部分才是大家通常说的“Trace 平台选型”。

### Jaeger：经典开源 Trace 后端

Jaeger 是分布式追踪领域的经典开源项目。

它的优势是概念清晰、生态成熟、资料多，适合作为团队理解 Trace 的第一套系统。

如果你的目标是把 Trace 能力先立起来，看清调用链、错误 span、耗时分布、服务依赖关系，Jaeger 是很自然的选择。

它适合：

- 中小规模微服务 Trace
- 以排障和链路查看为主
- 团队希望使用成熟开源方案
- 对复杂 APM 产品能力要求不高

但 Jaeger 不是万能答案。

当 span 量很大、保留周期很长、查询维度很多时，后端存储、索引成本和运维复杂度会变成主要问题。

### Grafana Tempo：低索引成本的 Trace 后端

Tempo 的思路和传统 Trace 后端不太一样。

它更强调用对象存储承接大规模 Trace 数据，并尽量降低索引成本。

如果团队已经使用 Grafana、Loki、Prometheus、Mimir 或 Prometheus 生态，Tempo 的吸引力会更强。

它适合：

- 已经使用 Grafana 体系的团队
- 希望压低 Trace 长期存储成本
- 希望把 Trace 和 Metric、Log 在 Grafana 里联动
- 能接受通过 trace_id、exemplar、日志关联等方式进入 Trace 查询

Tempo 的关键不是“全字段任意检索”，而是把 Trace 当成可以低成本保存和关联分析的数据。

这条路线适合对成本敏感、规模较大的云原生团队。

### SkyWalking：更偏完整 APM 体验

SkyWalking 不只是 Trace 后端，它更接近完整的开源 APM 平台。

它提供链路追踪、指标、拓扑、告警、服务关系分析等能力。

如果团队希望开箱即用地获得 APM 体验，而不是自己拼 SDK、Collector、后端、UI、告警和关联分析，SkyWalking 会更顺手。

它适合：

- 希望快速获得完整 APM 体验
- Java 体系占比较高
- 需要服务拓扑、性能分析和告警能力
- 平台团队不想从零拼装一套可观测产品

代价是，它更像平台型产品。

你获得更多一体化能力，也会接受更多体系内的架构约束。

### 商业 APM：买完整体验和责任边界

Datadog、New Relic、Elastic Observability、Dynatrace、云厂商 APM 这一类产品，卖的不是单个 Trace 存储。

它们卖的是完整体验：

- 自动埋点
- Trace 查询
- 服务拓扑
- Metric、Log、Trace 关联
- 告警
- SLO
- 异常检测
- 权限与审计
- 多云和多语言接入
- 支持服务

适合什么团队？

适合缺平台工程人力、但愿意用预算换成熟产品的组织。

不适合什么场景？

如果调用量极大、span 量极高、保留周期长，商业 APM 的账单会非常敏感。

这和日志平台的商业逻辑有点像：越完整的一体化体验，越要认真计算长期规模成本。

![Trace 后端路线对比](/images/observable-opentelemetry/04-trace-backend-comparison.png)

---

## 4. OpenTelemetry Collector 是 Trace 平台的治理层

如果只在应用里接入 OpenTelemetry SDK，然后直接把数据打到后端，确实也能跑起来。

但企业级 Trace 平台不能只停在这一步。

真正重要的是 Collector。

Collector 位于应用和后端之间，负责接收、处理、采样、路由和导出。

```text
App
  ↓
OpenTelemetry SDK
  ↓ OTLP
OpenTelemetry Collector
  ↓
Jaeger / Tempo / SkyWalking / APM
```

Collector 的价值在于把治理能力从业务代码里抽出来。

它可以做：

- batch：批量发送，降低后端压力
- memory_limiter：限制采集端内存风险
- attributes：增加、删除、重命名属性
- resource：补充 service、env、cluster、region 等资源信息
- tail_sampling：按错误、延迟、业务属性决定是否保留 Trace
- routing：按业务线、环境、租户导向不同后端
- transform：统一字段和协议转换

这也是 OpenTelemetry 在 Trace 选型里最关键的一点。

SDK 是埋点入口。

Collector 是治理入口。

后端是查询和存储入口。

这三层不能混在一起选。

![Collector 治理管道](/images/observable-opentelemetry/05-collector-governance-pipeline.png)

---

## 5. 采样策略决定 Trace 成本

Trace 平台最容易失控的地方是数据量。

Metric 的主要成本来自 active series 和 sample 写入。

Trace 的主要成本来自请求量、平均 span 数、属性大小、采样率和保留周期。

可以粗略理解成：

```text
Trace 成本 =
请求量 × 平均 span 数 × 单 span 大小 × 采样率 × 保留周期
```

![Trace 成本与采样策略](/images/observable-opentelemetry/06-trace-cost-sampling-model.png)

一个外部请求在单体应用里可能只有几个 span。

但在微服务系统里，它可能穿过十几个服务，产生几十个 span。

如果还有数据库、缓存、MQ、外部 HTTP、内部 RPC 的自动埋点，span 数量会继续放大。

所以 Trace 平台不应该默认长期全量采集。

更合理的做法是分层采样：

- 正常请求低比例采样
- 错误请求提高采样
- 慢请求提高采样
- 核心业务链路提高采样
- 新版本发布期间临时提高采样
- 故障排查期间临时提高采样

这里要注意一个细节。

head sampling 在请求刚开始时决定是否采样，成本低，但它不知道后面会不会报错或变慢。

tail sampling 在请求结束后根据完整 Trace 决定是否保留，判断更准，但 Collector 压力更大，架构也更复杂。

小规模系统可以先从 head sampling 开始。

中大型系统如果希望“错误和慢请求尽量保留，正常请求低比例保留”，就需要认真设计 tail sampling。

---

## 6. Trace 选型的几个硬约束

第一，看调用规模。

如果只是几十个服务、调用量不大、主要用于研发排障，Jaeger 或 SkyWalking 就能满足很多需求。

如果是大规模云原生系统，每天 span 量巨大，Tempo 这类强调低索引成本和对象存储的路线会更有吸引力。

第二，看查询方式。

Trace 查询和日志查询不是一回事。

有些系统擅长按 trace_id 精确查，有些系统支持更强的字段检索和服务拓扑分析，有些系统更依赖 Metric、Log、exemplar 跳转到 Trace。

如果你希望像查日志一样随意按任意字段查所有 Trace，成本会非常高。

第三，看语言和框架复杂度。

如果公司是 Java 单栈，很多 APM 工具都比较顺。

如果是 Java、Go、Python、Node.js、Rust 混合，OpenTelemetry 的标准化价值会明显上升。

第四，看是否需要多后端。

有些公司会同时存在开源后端、云厂商 APM、安全审计平台和内部数据湖。

这种情况下，Collector 的路由和导出能力比单个后端更重要。

第五，看组织能力。

Trace 平台不是装一个 UI 就结束。

它需要制定 service 命名规范、属性规范、采样规范、接入规范、排障流程和成本预算。

如果没有平台团队治理，Trace 很容易变成“大家都接了，但关键时候查不到想要的数据”。

---

## 7. 常见错误选型

第一种错误：把 Trace 当日志用。

Trace 不适合承载大量业务明细，也不适合把每个变量都塞进 span attribute。

它的核心是路径、耗时、错误、上下文和关键业务节点。

第二种错误：把 Metric label 和 Trace attribute 混用。

`user_id`、`order_id`、`request_id` 这类字段，在 Trace 里可能很有价值。

但如果进入 Metric label，会直接制造高基数问题。

OpenTelemetry 同时支持 Trace 和 Metric，不代表字段可以无脑复用。

第三种错误：只接自动埋点，不做业务 span。

自动埋点能给你 HTTP、RPC、SQL、MQ 这些技术路径。

但真正关键的排障信息，往往来自业务语义：

- 订单是否创建成功
- 库存是否扣减
- 风控是否拒绝
- 支付渠道是哪一个
- 消息是否投递
- 是否命中降级逻辑

Trace 平台的价值，不只是把调用链画出来，而是把业务关键路径解释清楚。

第四种错误：应用直连后端，绕过 Collector。

早期这样做最省事。

但后期一旦要改采样、换后端、做字段清洗、按业务分流、接入多个平台，就会发现所有策略都散在应用配置里。

Collector 不是一开始必须上得很重，但在公司级 Trace 平台里，它应该尽早进入架构设计。

---

## 8. 一个更清晰的 Trace 选型图谱

如果用一句话总结：

**Trace 平台选型不是只选后端，而是同时选埋点标准、采集管道、采样策略和存储查询系统。**

可以按下面这张图理解：

```text
【埋点标准层】
OpenTelemetry API / SDK / Auto Instrumentation
  - 统一跨语言埋点
  - 统一 trace context
  - 统一 resource attributes

【协议与治理层】
OTLP + OpenTelemetry Collector
  - 接收
  - 批处理
  - 清洗
  - 采样
  - 路由
  - 导出

【Trace 后端层】
Jaeger
  - 经典开源 Trace 后端

Tempo
  - Grafana 体系
  - 低索引成本
  - 对象存储友好

SkyWalking
  - 开源 APM 平台
  - 拓扑、指标、告警体验更完整

商业 / 云 APM
  - 产品体验完整
  - 成本和厂商绑定需要评估
```

所以，为什么从 Log 到 Metric 之后，要写 Trace？

因为这三者不是同一类数据的不同名字。

Log 让你看到事件细节。

Metric 让你看到系统状态。

Trace 让你看到请求因果链。

当业务系统走向微服务、异步消息、多语言、多集群、多云之后，只有 Log 和 Metric，排障经常会停在“知道出事了，但不知道这一单请求到底走到哪里坏了”。

Trace 要解决的就是这个问题。

而为什么写 Trace 又绕不开 OpenTelemetry？

因为现代 Trace 平台不能再把应用埋点直接绑死在某个后端上。

Jaeger、Tempo、SkyWalking、商业 APM 都是在后端层解决问题。

OpenTelemetry 解决的是更前面的问题：

**让所有应用先用同一种方式产生 Trace，再决定这些 Trace 最后送到哪里。**

这就是今天 Trace 选型的真正分水岭。

小团队可以先选一个开源后端把链路看起来。

中大型团队应该尽早把 OpenTelemetry SDK、OTLP、Collector、采样策略和后端存储拆开设计。

否则 Trace 平台越往后做，越容易从排障工具变成另一套难治理、难迁移、难控成本的数据系统。

---

## 参考校准来源

- [OpenTelemetry 官方文档：What is OpenTelemetry](https://opentelemetry.io/docs/what-is-opentelemetry/)
- [OpenTelemetry 官方文档：Signals](https://opentelemetry.io/docs/concepts/signals/)
- [OpenTelemetry 官方文档：Context propagation](https://opentelemetry.io/docs/concepts/context-propagation/)
- [OpenTelemetry 官方文档：Collector](https://opentelemetry.io/docs/collector/)
- [OpenTelemetry 官方规范：OTLP](https://opentelemetry.io/docs/specs/otel/protocol/)
- [Jaeger 官方文档](https://www.jaegertracing.io/docs/)
- [Grafana Tempo 官方文档](https://grafana.com/docs/tempo/latest/)

<div class="wechat-follow">
  <p>原文首发微信公众号「巴马AI」。</p>
  <p>微信搜索「巴马AI」<button class="hub-copy" type="button" data-copy-wechat>复制名称</button></p>
  <img src="/images/wechat-qr.jpg" alt="关注公众号巴马AI">
</div>
