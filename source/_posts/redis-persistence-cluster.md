---
title: Redis 持久化、复制和集群：内存状态如何活过进程
author: AVloger
date: 2026-08-17 12:40:00
draft: false
summary: Redis 把状态放在内存里，持久化回答崩溃后怎么回来，复制回答另一台怎么跟上，集群回答单机内存不够时怎么切开。三件事都能丢数据，只是丢掉的位置不同。
description: 说明 RDB 与 AOF、fork 造成的复制内存、主从复制与 Sentinel，以及 Cluster 的 hash slot 在切什么。
coverImage: /images/redis-persistence-cluster/cover.jpg
cover: /images/redis-persistence-cluster/cover.jpg
categories:
  - 技术笔记
  - Redis
tags:
  - Redis
  - RDB
  - AOF
  - Cluster
---

进程退出，内存就没了。Redis 要在“尽量快”和“尽量还能回来”之间做显式取舍。持久化、复制、集群看起来是三套功能，其实是三层失败模型。

```text
进程崩溃 -> RDB / AOF
机器宕机 -> 复制到另一台
单机内存 / QPS 不够 -> 分槽
```

---

## 1. RDB 是快照，AOF 是写日志

RDB 把某一时刻的内存字典写成二进制快照。恢复快，文件紧，丢掉的是快照之后的全部写入。`BGSAVE` 会 `fork` 出子进程去写盘。fork 瞬间的页表复制很便宜，之后父进程继续写，触发 copy-on-write，内存会短暂涨起来。写入很密时，这个涨幅能把机器打到 OOM。所以“开了 RDB 就安全”不成立：它安全的是恢复速度，不安全的是 fork 窗口和快照间隔。

AOF 把写命令追加到日志。`always` 每条都刷盘，最慢最稳；`everysec` 最多丢约一秒；`no` 交给操作系统，崩溃能丢更多。AOF 会胀，需要重写：子进程根据当前内存生成一份更短的日志，替换旧文件。重写同样会 fork，同样会 COW。

两者可以一起开。常见组合是：日常靠 AOF 把丢失窗口收到秒级，RDB 作为更快的冷启动和备份。要的是丢失窗口和 fork 成本之间的数，不是“哪种更高级”。

![RDB 与恢复](/images/redis-persistence-cluster/01-save-restore.png)

![RDB 文件结构](/images/redis-persistence-cluster/02-rdb.png)

![AOF](/images/redis-persistence-cluster/03-aof.png)

---

## 2. 复制不是事务，Sentinel 不是强一致

从节点把主节点的数据持续跟上，用于容错和读扩展。全量同步往往要一次 RDB 传送；增量靠 replication backlog。主从延迟期间读从库，会读到旧值。这和 MySQL 异步复制是同一类承诺。

Sentinel 盯着主节点活着没有，必要时选一个从节点顶上。它降低的是“人去改配置”的成本，不提供跨节点事务。脑裂、网络分区时，仍可能出现两个写入点。要写安全，得把客户端的路由、等待确认的副本数、以及降级策略一起设计。只部署 Sentinel，不等于写入已经多数派提交。

![主从复制](/images/redis-persistence-cluster/04-replication.png)

![复制过程](/images/redis-persistence-cluster/05-replication-detail.png)

---

## 3. Cluster 切的是槽，不是业务键的语义

Redis Cluster 把 16384 个 hash slot 分给不同节点。key 先算槽，再落到节点。单机内存不够时，加节点、迁槽，就是在搬这些槽。

跨槽的事务和多 key 操作会变难。`{user1000}.profile` 这种 hash tag 可以把相关 key 钉在同一槽，换来的是倾斜：热 tag 会把压力打到单节点。集群能水平扩展平均负载，不能消灭热点 key。

持久化在每个节点上仍各自做。集群恢复不等于“整个键空间原子回到同一时刻”。运维上要按节点看 RDB/AOF，按槽看迁移是否完成。

---

## 4. 可以复查的判断

Redis 丢数据时，先定位丢在哪一层：

1. 只开了 RDB，丢的是快照间隔。
2. AOF `everysec`，丢的是大约一秒。
3. 主挂了、从还没跟上，丢的是复制延迟里的写入。
4. 集群迁槽或脑裂，丢的是路由和双主。

层定位清楚，才谈改刷盘策略、改副本数，还是改分片键。把三层混成“Redis 不可靠”，下一步会改错旋钮。
