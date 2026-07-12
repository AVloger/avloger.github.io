---
title: 别只看架构图：从商业模式看懂可观测日志平台选型
author: 巴马AI
date: 2026-07-12T00:00:00+08:00
draft: false
summary: 日志平台选型不只是倒排索引、列式存储和查询性能的比较，更是企业在授权费、云账单、机器成本、人力成本和迁移成本之间做权衡。
description: 本文从商业模式和成本结构出发，拆解 Splunk、Elastic、云日志服务、ClickHouse / Doris、Loki 等日志平台路线，帮助工程师用更专业的方式理解可观测日志平台选型。
coverImage: /images/log-platform-selection/01-infographic-cost-model.png
---

# 别只看架构图：从商业模式看懂可观测日志平台选型

很多技术新人第一次接触日志平台，通常会先被一堆名词砸晕：

ELK、Loki、ClickHouse、Doris、Splunk、SLS、CloudWatch、Databricks……

继续往下查，资料会很快进入技术细节：倒排索引、列式存储、向量化执行、冷热分层、对象存储、压缩率、查询优化器。

这些当然重要。但在真实公司里，日志平台选型往往不是一道纯技术题，而是一道成本题、组织题和商业模式题。

一个日志系统的真实成本，大致可以拆成：

```text
总成本 = 写入量成本 + 存储保留成本 + 查询计算成本 + 运维人力成本 + 迁移锁定成本
```

不同产品不是简单地“谁技术更先进”，而是把这些成本转移到了不同地方。

有人把成本打包成授权费，有人按写入流量收费，有人靠云生态绑定，有人把钱省下来但要求你自己养团队。

这篇文章不讲源码，换一个更接近真实决策的视角：从商业模式看懂可观测日志平台的几类主流路线。

![日志平台真实成本模型](/images/log-platform-selection/01-infographic-cost-model.png)

---

## 1. Splunk：把复杂性封装成高单价产品

代表产品：Splunk Enterprise / Splunk Cloud

Splunk 的核心商业逻辑很直接：它卖的是成熟的一体化能力。

从数据接入、索引、搜索、告警、仪表盘，到安全分析、SIEM、审计合规，Splunk 把很多企业级能力做成了相对完整的产品。对金融、政企、跨国公司来说，这很有价值。

它的价格模式也体现了这一点。Splunk 官方提供多种计费模型，包括按写入量、按 workload、按 entity、按 activity 等。其中按 ingest 计费的逻辑最容易理解：你每天写入多少日志数据，就对应相应成本。

这类模式适合什么公司？

适合“缺人但不缺预算”的组织。

尤其是安全、合规、审计要求很高的团队，他们更关心：

- 系统能不能快速落地
- 权限、审计、告警、报表是否成熟
- 出问题时有没有供应商兜底
- 能不能少养一支底层平台团队

它不适合什么场景？

当日志量进入每天几十 TB、上百 TB，而大量日志只是低价值排障数据时，按写入量付费会非常敏感。你会发现每多打一行日志，最后都会反映在账单上。

Splunk 的本质不是“技术不行”，而是“它把复杂性卖成了高单价服务”。

---

## 2. Elastic / ELK：用开源生态建立入口，再用企业能力变现

代表产品：Elasticsearch / Kibana / Elastic Cloud

ELK 之所以能成为很多工程师的默认选择，核心原因是它足够早、足够开放、生态足够大。

早期大家用 Elasticsearch 做日志检索，路径很自然：

```text
Logstash / Beats -> Elasticsearch -> Kibana
```

上手快、教程多、插件多、社区问题也多。对新手来说，这是巨大的优势。

但 Elastic 的商业模式不是“永久免费”。它的逻辑更像：

```text
基础能力扩大使用面
企业功能和托管服务负责商业化
```

Elastic 在 2021 年对 Elasticsearch 和 Kibana 的授权做过重要调整，从 Apache 2.0 变为 Elastic License 2.0 与 SSPL 双许可。后来 Elastic 又加入了 AGPL 选项，但企业使用时仍然需要认真看清 license、发行版、托管服务和高级功能边界。

这类模式的关键不在于“开源是不是骗局”，而在于：

**开源降低了你的启动成本，但不一定降低你的长期成本。**

当日志规模上来之后，你会遇到几个问题：

- Elasticsearch 对内存和磁盘比较敏感
- 分片、mapping、冷热生命周期管理需要经验
- 高可用、权限、安全、审计、告警等企业能力需要额外投入
- 自建省授权费，但不一定省人力

所以 ELK 的真实定位是：

中小规模、团队熟悉搜索技术、有一定运维能力时，它仍然很好用；但当日志量和组织复杂度上来后，它会从“免费工具”变成“需要平台工程能力的系统”。

---

## 3. 云厂商日志服务：用零运维换生态绑定

代表产品：阿里云 SLS、AWS CloudWatch Logs

云厂商日志服务的商业模式非常适合初创团队：

不用采购机器，不用搭集群，不用调 JVM，不用设计冷热分层，开通就能用。

阿里云 SLS、AWS CloudWatch Logs 这类服务通常采用按量计费。比如写入、存储、索引、查询、投递等功能分别计费。小规模阶段，这种模式非常舒服。

对一个创业公司来说，这很现实：

```text
少招一个基础设施工程师，可能比省几台机器更重要。
```

云日志服务的优势是：

- 开箱即用
- 和云上 ECS、容器、函数、网关、负载均衡天然集成
- 运维成本低
- 可用性由云厂商承担
- 前期成本可控

但代价也很清楚：

**你把复杂性外包给云厂商，同时也把架构选择权交出去了一部分。**

当日志量变大，账单会开始变得敏感。更麻烦的是 vendor lock-in：采集、索引、查询、告警、权限体系都绑定在某个云生态里，后续要迁移到自建或其他云，并不轻松。

所以云日志服务适合两类团队：

第一类是早期团队，核心诉求是快，不想把人力浪费在基础设施上。

第二类是高度云原生团队，已经全面绑定某个云，日志系统只是云平台的一部分。

但如果公司未来明确要多云、混合云、私有化交付，或者日志量极大，就要提前评估迁移成本。

---

## 4. ClickHouse / Doris：用工程能力换硬件成本下降

代表产品：ClickHouse、Apache Doris

过去几年，很多团队开始把日志分析从 Elasticsearch 或商业日志平台迁移到 ClickHouse、Doris 这类 OLAP 数据库。

原因很简单：日志本质上越来越像分析型数据。

大多数日志查询并不是全文搜索所有字段，而是：

```sql
WHERE service = 'payment'
  AND level = 'error'
  AND timestamp > now() - interval 1 hour
GROUP BY error_code
```

这类查询非常适合列式存储。

ClickHouse 是开源列式数据库，适合大规模实时分析。列式布局可以减少不必要的 I/O，并提升压缩率。Apache Doris 是基于 MPP 架构的实时分析数据库，也强调列式存储、向量化执行和高并发查询。

它们的商业逻辑不是“卖授权”，而是“帮你把物理成本打下来”。

原来用 ES 需要大量内存和磁盘的场景，迁移到列式 OLAP 后，可能在压缩率、查询吞吐、存储成本上获得明显改善。

但这里有一个新手很容易忽略的问题：

**省下来的软件授权费和机器成本，并不会凭空消失，它会转化为团队的工程能力要求。**

你需要有人能处理：

- 表模型设计
- 分区和排序键设计
- 写入吞吐控制
- 冷热数据分层
- 查询模式治理
- 集群扩容和故障恢复
- 日志 schema 演进
- 高基数字段和全文检索边界

所以 ClickHouse / Doris 路线适合有平台工程能力的公司。

如果团队里没有懂 OLAP、存储和运维的人，贸然上这类系统，很容易从“省钱”变成“把问题转移给值班工程师”。

![五类日志平台路线对比](/images/log-platform-selection/02-comparison-platform-tradeoffs.png)

---

## 5. Loki：少索引，低成本，但要接受查询模型变化

代表产品：Grafana Loki

Loki 值得单独提一下，因为它的思路和 ES/Splunk 很不一样。

传统日志系统往往倾向于索引更多内容，方便任意搜索。Loki 的思路更接近 Prometheus：只索引 labels，不对日志全文建立大索引。日志正文压缩后放到对象存储里。

这带来的结果是：

- 索引成本低
- 存储成本低
- 和 Prometheus / Grafana 生态结合自然
- 适合按服务、pod、namespace、env 等标签定位日志

但它也有代价：

如果你经常要对日志全文做复杂检索，或者把日志平台当搜索引擎用，Loki 不一定是最舒服的选择。

Loki 适合云原生监控体系已经围绕 Grafana / Prometheus 构建的团队。它的商业逻辑不是“全能搜索”，而是“用更少的索引满足大多数排障场景”。

---

## 6. 真正的选型问题：你到底想把成本放在哪里？

日志平台选型，不应该从“哪个技术最先进”开始，而应该从业务和组织约束开始。

你可以先问四个问题。

第一，日志量多大？

每天几十 GB、几百 GB、几十 TB，完全是不同问题。小规模时，省人力优先；大规模时，单位 GB 成本会成为核心变量。

第二，查询模式是什么？

如果主要是精确过滤、聚合分析，ClickHouse / Doris 很有优势。

如果主要是全文检索、任意字段搜索，Elasticsearch / Splunk 更自然。

如果主要是按服务、实例、标签排障，Loki 可能很合适。

第三，团队能力在哪里？

没有平台工程团队，就别轻易自建复杂底座。你省下来的云账单，可能会变成更贵的人力和事故成本。

第四，公司最怕什么？

- 怕安全审计不过：优先成熟商业产品
- 怕没人运维：优先云厂商服务
- 怕账单爆炸：考虑自建 OLAP 或 Loki
- 怕被云绑定：避免深度使用单一云厂商日志体系
- 怕迁移困难：优先开放协议、标准采集链路、对象存储归档

![日志平台选型四问](/images/log-platform-selection/03-framework-decision-matrix-v2.png)

---

## 7. 一句话选型建议

如果公司预算充足，核心诉求是安全、合规、成熟生态和低实施风险，Splunk 这类商业平台是合理选择。

如果团队已经深度使用某个云，且短期不想维护基础设施，SLS / CloudWatch 这类云日志服务是现实选择。

如果团队需要通用搜索能力，日志规模中等，并且有一定运维经验，ELK / Elastic 仍然是经典路线。

如果日志规模很大，查询偏分析型，且团队具备平台工程能力，可以认真评估 ClickHouse / Doris。

如果公司已经围绕 Prometheus / Grafana 建监控体系，日志查询主要依赖标签定位，Loki 是一个很有性价比的方向。

如果要做长期归档、离线分析、合规留存，可以把日志沉到对象存储或 lakehouse，再用 Databricks、Spark、Trino 等体系做后续分析；但这通常不是一线排障日志平台的替代品。

![日志平台选型路径](/images/log-platform-selection/04-flowchart-selection-path.png)

---

## 结尾：工程选型，本质是成本结构设计

技术选型不是信仰投票。

Splunk 不是因为贵就错，云日志不是因为绑定就不能用，开源数据库也不是因为免费就一定划算。

真正专业的选型，是看清每个系统把成本放在了哪里：

```text
Splunk：用钱买成熟产品和低风险
Elastic：用生态换启动效率，用授权/云服务商业化
SLS / CloudWatch：用零运维换云生态绑定
ClickHouse / Doris：用工程能力换硬件成本下降
Loki：用查询模型约束换低索引成本
```

所以，当老板或面试官问你“日志平台怎么选”时，不要只回答倒排索引、列式存储、压缩率。

更好的回答是：

**先看日志量，再看查询模式，再看团队能力，最后看公司愿意把成本放在账单里、机器里，还是工程师的人力里。**

这才是可观测日志平台选型背后的真实逻辑。

---

参考校准来源：

- [Splunk Pricing Models](https://www.splunk.com/en_us/products/pricing/pricing-models.html)
- [Elastic Licensing FAQ](https://www.elastic.co/pricing/faq/licensing)
- [AWS CloudWatch Pricing](https://aws.amazon.com/cloudwatch/pricing/)
- [Alibaba Cloud SLS Pay-as-you-go](https://www.alibabacloud.com/help/en/sls/pay-as-you-go)
- [ClickHouse 官方介绍](https://clickhouse.com/)
- [Apache Doris 官方介绍](https://doris.apache.org/docs/4.x/getting-started/what-is-apache-doris/)
- [Grafana Loki 官方文档](https://grafana.com/docs/loki/latest/)
