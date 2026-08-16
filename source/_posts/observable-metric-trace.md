---
title: Metric 平台选型：基数、保留周期和全局查询才是关键
author: 巴马AI
date: 2026-07-14 21:00:00
draft: false
summary: Metric 平台的难点不在于把指标采上来或把图画出来，而在于控制 active series、写入吞吐、保留周期、查询告警和跨集群视图的成本。
description: 本文从 active series、写入吞吐、长期保留和全局查询出发，拆解 Prometheus、VictoriaMetrics、InfluxDB、Thanos 等时序数据库和监控体系路线，帮助工程师理解 Metric 平台选型背后的架构取舍。
coverImage: /images/observable-metric-trace/01-metric-cost-model-v2.png
cover: /images/observable-metric-trace/01-metric-cost-model-v2.png
categories:
  - 公众号
tags:
  - Metric
  - Prometheus
  - 可观测
channel: wechat
---
Metric 平台刚建起来的时候，通常不会让人觉得它很复杂。

一个 Prometheus，几个 exporter，一批 dashboard，再配几条告警规则，团队很快就能看到 QPS、错误率、延迟、CPU、内存、磁盘这些基础指标。

这也是 Metric 系统最迷人的地方：它的第一版往往非常轻。

真正的问题一般出现在第二阶段。

服务数量上来了，Kubernetes 集群变多了，exporter 越接越多，dashboard 开始跨业务线复用，告警规则从几十条变成几百条，历史指标从 15 天扩到半年。

这时候，Metric 平台的瓶颈通常不是“有没有图”，而是：

- active series 数量增长太快
- remote_write 写入压力变大
- PromQL 查询跨度一拉长就变慢
- recording rule 和 alert rule 开始互相抢资源
- 单集群看得清，多集群全局视图很难维护
- 短期指标很便宜，长期保留突然变贵

所以 Metric 平台选型，表面上是在比较 Prometheus、VictoriaMetrics、InfluxDB、Thanos、Mimir、Cortex、OpenTSDB 这些名字。

但更底层的问题其实是：

**你准备把 Metric 系统扩展到哪一层？**

一个 Metric 系统的真实成本，大致可以拆成：

```text
总成本 = 活跃时间序列成本
       + 写入吞吐成本
       + 存储保留成本
       + 查询与告警计算成本
       + 高可用成本
       + 运维复杂度成本
```

![Metric 平台成本结构](/images/observable-metric-trace/01-metric-cost-model.png)

这些成本不会因为换一个更快的 TSDB 就自动消失。

Prometheus 把采集、存储、查询、告警做成一个简单闭环，适合先把监控标准立起来。

VictoriaMetrics 把写入、存储、查询做成更强的后端能力，适合承接更大的指标规模。

Thanos 把长期数据放到对象存储里，同时补全跨集群查询和历史保留。

InfluxDB 则更像通用时序数据库，适合监控之外的 IoT、设备遥测、工业数据和业务时序分析。

本文不从产品清单开始，而从 Metric 平台的扩展路径开始：当你从单集群监控走向大规模指标平台时，哪些成本会先暴露出来，不同 TSDB 和监控体系又分别在解决哪一段问题。

---

## 1. 第一约束：active series

Metric 平台存的不是“表格数据”，而是时间序列。

一条时间序列通常由三部分组成：

```text
metric name + labels + samples
```

比如：

```text
http_requests_total{
  service="payment",
  method="POST",
  status="500",
  instance="10.0.1.23"
}
```

这不是一条数据，而是一条时间序列。

后续每隔 15 秒、30 秒或 60 秒写入一个 sample。

Metric 平台真正敏感的，不只是“每秒写多少点”，而是活跃时间序列数量，也就是常说的 cardinality。

可以粗略理解成：

```text
活跃时间序列数量 = 指标名数量 × label 组合数量
```

![Metric 数据模型与基数](/images/observable-metric-trace/02-metric-data-model-cardinality-v2.png)

如果你有 100 个服务、200 个接口、10 个状态码、5000 个实例，时间序列数量会很快膨胀。

如果再把 user_id、order_id、request_id 这类高基数字段放进 label，系统会直接从“监控平台”变成“基数爆炸现场”。

所以 Metric 平台选型前，先不要问“Prometheus 还是 VictoriaMetrics”。

更应该先问：

- 活跃时间序列有多少
- scrape interval 是多少
- 数据要保留多久
- 查询主要看最近 1 小时，还是经常查半年历史
- 告警和 recording rule 有多少
- 是单集群监控，还是多集群、多地域统一视图
- 团队能接受多复杂的运维组件

这些问题决定了你应该选一个简单单体，还是上分布式 TSDB，还是采用 Prometheus 加长期存储的组合。

---

## 2. Prometheus：监控事实标准，优先解决“简单可靠”

代表产品：Prometheus

Prometheus 是很多云原生监控体系的默认起点。

它的核心路径很清楚：

```text
Service Discovery -> Scrape -> Local TSDB -> PromQL -> Alertmanager / Grafana
```

![Prometheus 单体监控路径](/images/observable-metric-trace/03-prometheus-single-node-path.png)

Prometheus 的优势不是“无限扩展”，而是“把监控这件事做得足够标准、足够简单”。

它自己负责服务发现、指标拉取、本地存储、PromQL 查询、告警规则计算。

对一个中小规模 Kubernetes 集群来说，这种一体化非常舒服：

- 部署简单
- 生态成熟
- exporter 非常丰富
- PromQL 成为事实标准
- Grafana 支持完善
- 告警链路清晰
- 出问题时排查路径短

Prometheus 官方也很明确：本地存储受单节点扩展性和持久性限制。它没有试图在 Prometheus 本体里解决完整的分布式存储问题，而是通过 Remote Write、Remote Read 等接口和外部远程存储集成。

这就是 Prometheus 的真实定位：

**它首先是监控系统，其次才是一个本地 TSDB。**

适合什么场景？

适合单集群、中小规模、保留周期不长、团队想快速建立监控标准的公司。

尤其是 Kubernetes 场景，Prometheus Operator、ServiceMonitor、PodMonitor、Alertmanager、Grafana 这套组合已经非常成熟。

不适合什么场景？

当你遇到这些问题时，单体 Prometheus 会开始吃力：

- 单机存储压力太大
- 单机查询压力太大
- 活跃时间序列过多
- 需要跨多个集群统一查询
- 需要保留一年以上历史数据
- 需要多租户隔离
- 需要更强的数据高可用和灾备

所以 Prometheus 的本质不是“性能不够好”，而是它选择了简单可靠的单节点模型，把大规模长期存储问题交给生态解决。

---

## 3. VictoriaMetrics：用高压缩和兼容性降低大规模指标成本

代表产品：VictoriaMetrics Single-node / VictoriaMetrics Cluster

VictoriaMetrics 的定位很直接：做一个高性能、低资源占用、Prometheus 兼容的时序数据库和监控后端。

它常见的接入方式是：

```text
Prometheus / vmagent -> remote_write -> VictoriaMetrics -> Grafana / vmalert
```

VictoriaMetrics 支持单节点版本，也支持集群版本。

单节点版本适合部署简单、成本敏感、规模还没有大到必须拆分组件的场景。

集群版本会把能力拆成三个核心组件：

```text
vminsert  -> 写入入口
vmstorage -> 存储节点
vmselect  -> 查询入口
```

![VictoriaMetrics 集群架构](/images/observable-metric-trace/04-vm-cluster-architecture-v2.png)

这种架构带来的好处是：写入、存储、查询可以分别扩展。

对指标量比较大的团队来说，VictoriaMetrics 的吸引力通常在几个地方：

- Prometheus 兼容度高，迁移成本低
- 可以作为 Prometheus remote_write 后端
- 查询接口能直接被 Grafana 使用
- 单节点版本部署简单
- 集群版本适合更大规模写入和查询
- 资源占用和压缩率通常是它的核心卖点

这类路线适合什么公司？

适合“Prometheus 已经很好用，但本地存储和查询开始扛不住”的团队。

尤其是这些场景：

- Kubernetes 集群较多
- 活跃时间序列增长很快
- 希望保留更长周期的指标
- 希望继续使用 PromQL / Grafana 生态
- 不想引入太复杂的对象存储分层体系
- 希望用相对少的机器承载更多指标

但 VictoriaMetrics 也不是没有代价。

第一，集群模式会引入新的组件复杂度。

你需要理解 vminsert、vmstorage、vmselect 的职责，以及扩容、复制、故障恢复、查询负载的影响。

第二，它虽然兼容 Prometheus 生态，但不是 Prometheus 本体。

一些边界行为、函数支持、远程写协议版本、原生直方图等能力，需要结合当前版本认真验证。

第三，多租户、权限、安全、审计、跨地域容灾等企业能力，需要结合开源版、企业版或云服务边界评估。

所以 VictoriaMetrics 的本质是：

**用更强的 TSDB 后端能力，换取更低的单位指标成本，但要求团队理解新的存储和集群模型。**

---

## 4. Thanos：不替代 Prometheus，而是给 Prometheus 加长期存储和全局视图

代表产品：Thanos

Thanos 很容易被误解成“另一个 TSDB”。

更准确地说，它是一套围绕 Prometheus 的分布式组件，用来解决 Prometheus 在高可用、长期存储和跨集群查询上的问题。

典型架构是：

```text
Prometheus + Thanos Sidecar -> Object Storage
                              ^
Thanos Query -> Sidecar / Store Gateway / Ruler
```

![Prometheus 长期存储与全局查询](/images/observable-metric-trace/05-long-term-global-query.png)

Thanos 的关键思路是：保留 Prometheus 在边缘集群里的采集和本地查询能力，再把历史 block 上传到对象存储。

对象存储成为长期指标数据的主要存储层。

然后通过 Thanos Query、Store Gateway、Compactor、Ruler 等组件，提供统一查询、历史数据访问、降采样和规则计算。

这条路线的优点很明显：

- 不需要推翻已有 Prometheus
- 适合多集群统一查询
- 适合长期保留历史指标
- 对象存储成本相对低
- 可以保留每个集群本地 Prometheus 的自治能力
- 和 Prometheus block 格式、PromQL 生态结合自然

它适合什么公司？

适合已经有很多 Prometheus 实例，并且开始遇到这些问题的团队：

- 每个集群都有 Prometheus，但缺少全局视图
- 需要保留半年、一年甚至更久的指标
- 希望历史数据放到 S3、GCS、OSS、MinIO 等对象存储
- 不希望把所有采集链路都改成新系统
- 希望保留 Prometheus 作为边缘监控单元

但 Thanos 的代价也很清楚：

**它降低了长期存储成本，但提高了系统组件复杂度。**

你要维护 Sidecar、Query、Store Gateway、Compactor、Ruler，必要时还要考虑 Receive、Query Frontend、缓存、对象存储权限、bucket 生命周期、跨地域访问延迟。

对象存储便宜，但对象存储不是本地磁盘。

历史查询如果跨度大、series 多、缓存没设计好，查询体验可能会受到影响。

所以 Thanos 不是“让 Prometheus 无限扩展的魔法”。

它更像是：

**用对象存储和分布式查询组件，为已有 Prometheus 体系补上长期存储和全局视图。**

---

## 5. InfluxDB：更通用的时序数据库，不只服务云原生监控

代表产品：InfluxDB 1.x / 2.x / 3.x

InfluxDB 和 Prometheus 系路线的气质不太一样。

Prometheus 更像“监控系统自带 TSDB”。

InfluxDB 更像“面向时序数据的通用数据库”。

它的典型场景不只包括应用监控，也包括：

- IoT 设备数据
- 工业传感器
- 网络设备指标
- 能源和电力数据
- 金融行情
- 用户行为时间序列
- 实时看板和交互式分析

InfluxDB 的数据模型、写入协议、查询语言也经历过多代演进。

InfluxDB 1.x 时代，很多人熟悉的是 measurement、tag、field、InfluxQL。

InfluxDB 2.x 强调 bucket、Flux、任务和平台化能力。

InfluxDB 3.x 则转向更现代的数据底座，比如 Parquet、对象存储、SQL / InfluxQL，以及面向实时查询和事件处理的能力。

这说明一个问题：

**InfluxDB 的核心定位不是成为 Prometheus 的附属后端，而是服务更广泛的时序数据场景。**

它适合什么团队？

适合那些指标数据不只是基础设施监控，而是已经变成业务时序数据的团队。

比如：

- 设备每秒上报温度、电压、转速
- 需要按设备、站点、区域做长期趋势分析
- 查询不只是 PromQL 风格告警，还需要更通用的 SQL / InfluxQL 分析
- 时序数据要进入业务系统、报表系统或数据分析链路
- 数据模型更接近“时序数据库”，而不是“Prometheus 监控后端”

它不适合什么场景？

如果你的核心诉求就是 Kubernetes 监控、PromQL 告警、Grafana dashboard、exporter 生态，那么 Prometheus 系路线通常更自然。

如果你只是想给 Prometheus 找一个长期存储后端，也需要认真比较 InfluxDB 与 VictoriaMetrics、Thanos、Mimir、Cortex 这类 Prometheus-native 方案的生态匹配度。

所以 InfluxDB 的本质是：

**用更通用的时序数据库能力，换取更广泛的数据分析场景，但不一定是云原生监控体系里的最短路径。**

---

## 6. 真正的选型问题：你到底在扩展哪一层？

Metric 平台选型，不应该从“哪个 TSDB 最快”开始。

更好的方式，是先判断你到底卡在哪一层。

第一，卡在采集层吗？

如果你只是 scrape target 太多，Prometheus 配置复杂，或者边缘采集需要更轻量，可以考虑 vmagent、OpenTelemetry Collector、Prometheus Agent 模式等采集层方案。

这时候不一定要立刻换存储。

第二，卡在本地存储吗？

如果 Prometheus 单机磁盘、内存、WAL、block compaction 压力变大，可以考虑缩短本地保留周期，并通过 remote_write 接入 VictoriaMetrics、Thanos Receive、Mimir 等远程后端。

第三，卡在长期保留吗？

如果主要问题是历史数据要保留一年，且查询频率不高，对象存储路线会很有吸引力。

Thanos 的优势就在这里。

第四，卡在全局查询吗？

如果每个集群都有自己的 Prometheus，但团队需要一个跨集群视图，可以考虑 Thanos Query、VictoriaMetrics Cluster、Mimir / Cortex 这类方案。

第五，卡在查询和告警计算吗？

如果 dashboard 很慢，recording rule 很多，PromQL 查询跨度大，就要关注 query frontend、缓存、预聚合、降采样、rule 分层，而不只是换一个存储引擎。

第六，卡在数据模型吗？

如果你的时序数据已经超出监控指标，比如 IoT、工业、业务事件、设备遥测，那么 InfluxDB 这类通用 TSDB 可能比 Prometheus-native 路线更合适。

![Metric 平台选型路径](/images/observable-metric-trace/06-metric-platform-selection-map.png)

---

## 7. 一句话选型建议

如果团队刚开始建设云原生监控，规模不大，优先选择 Prometheus。

它的生态、文档、PromQL、exporter、Grafana、Alertmanager 都足够成熟，能让团队先建立监控标准。

如果 Prometheus 已经跑起来，但指标量、保留周期、查询压力开始上来，同时团队希望继续使用 PromQL / Grafana 生态，可以认真评估 VictoriaMetrics。

尤其是先用单节点版本承接 remote_write，再根据规模演进到集群，是一条比较平滑的路线。

如果公司已经有大量 Prometheus 实例，核心问题是跨集群统一查询和长期历史保留，可以评估 Thanos。

它不是替代 Prometheus，而是把 Prometheus 体系扩展成多集群、长周期、对象存储友好的架构。

如果你的时序数据不只是监控指标，而是 IoT、设备遥测、工业数据、金融行情或业务时序分析，可以评估 InfluxDB。

它的价值不在于“替代 Prometheus”，而在于提供更通用的时序数据库能力。

如果你还没搞清楚自己的瓶颈，只是听说某个系统更快，不要急着迁移。

先把这几个数字摸清楚：

```text
active series 数量
samples per second
scrape interval
retention period
query p95 / p99
rule 数量和执行耗时
单条查询扫描的 series 数量
高基数 label 排名
```

没有这些数字，所谓选型很容易变成架构审美。

---

## 结尾：Metric 平台选型，本质是规模路径设计

Metric 平台不是越分布式越好，也不是越简单越落后。

Prometheus 的价值，是让监控先标准化。

VictoriaMetrics 的价值，是在 Prometheus 生态里降低大规模指标存储和查询成本。

Thanos 的价值，是给已有 Prometheus 体系补上长期存储和全局视图。

InfluxDB 的价值，是服务更广泛的时序数据分析场景。

所以，当老板或面试官问你“Metric 平台怎么选”时，不要只回答 Prometheus、VM、InfluxDB、Thanos 谁性能更好。

更好的回答是：

**先看活跃时间序列和保留周期，再看查询模式和告警计算，最后看你要扩展的是采集层、本地存储、长期存储、全局查询，还是通用时序分析能力。**

这才是 Metric 平台选型背后的真实逻辑。

---

参考校准来源：

- [Prometheus Storage 文档](https://prometheus.io/docs/prometheus/latest/storage/)
- [VictoriaMetrics 官方文档](https://docs.victoriametrics.com/)
- [VictoriaMetrics Prometheus 集成](https://docs.victoriametrics.com/victoriametrics/integrations/prometheus/)
- [VictoriaMetrics Cluster 文档](https://docs.victoriametrics.com/victoriametrics/cluster-victoriametrics/)
- [Thanos Object Storage & Data Format](https://thanos.io/tip/thanos/storage.md/)
- [Thanos Store Gateway 文档](https://thanos.io/tip/components/store.md/)
- [Prometheus Operator Thanos 文档](https://prometheus-operator.dev/docs/platform/thanos/)
- [InfluxDB 3 Core 文档](https://docs.influxdata.com/influxdb3/core/)

<div class="wechat-follow">
  <p>原文首发微信公众号「巴马AI」。</p>
  <p>微信搜索「巴马AI」<button class="hub-copy" type="button" data-copy-wechat>复制名称</button></p>
  <img src="/images/wechat-qr.jpg" alt="关注公众号巴马AI">
</div>
