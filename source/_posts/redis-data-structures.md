---
title: Redis 数据结构是在为访问模式付钱
author: AVloger
date: 2026-08-17 12:20:00
draft: false
summary: String、Hash、List、Set、ZSet、Stream 看起来是五种类型，底层是 SDS、dict、listpack、skiplist 这些布局。选错类型，等于用错误的内存形状去硬扛访问模式。
description: 从 Redis 常见类型对应的底层编码出发，说明为什么 ZSet 用跳表、小 Hash 用 listpack，以及类型选择如何影响内存和延迟。
coverImage: /images/redis-data-structures/cover.jpg
cover: /images/redis-data-structures/cover.jpg
categories:
  - 技术笔记
  - Redis
tags:
  - Redis
  - 跳表
  - SDS
  - 数据结构
---

Redis 快，首先是因为数据在内存里，其次是因为每个 key 的布局贴近一种访问模式。把所有东西都塞进 String，能用，但会把本可以 O(1) 或对数级的操作，变成自己在客户端拼拆。

先记住类型和典型底层的对应，再谈集群和持久化。

```text
String -> SDS
Hash / ZSet 的小对象 -> listpack（老版本是 ziplist）
Hash / Set 大了 -> dict
ZSet 大了 -> dict + skiplist
Stream -> 按时间的 listpack 节点
```

编码会随元素数量和体积升级。小 Hash 紧凑存放，省指针；长大了改成哈希表，换随机访问。这是 Redis 自己做的空间换时间，不是两种 API。

---

## 1. String 远不止缓存一个 JSON

SDS 是带长度的字节数组，按长度取、按长度追加，不必每次 `strlen`。String 还能当计数器、当 bitmap、当位图过滤器的载体。`INCR`、`SETBIT`、`GETRANGE` 都建立在同一块连续内存上。

![SDS](/images/redis-data-structures/01-overview.webp)

把复杂结构 JSON 进一个 String，读写都是整块替换。字段局部更新、局部过期、局部计数，都会变笨。那是在用最通用的布局，逃避为访问模式建模。

---

## 2. Hash、List、Set 各自擅长的切法

Hash 适合“一个对象很多字段”。小对象紧凑；字段多了变成 dict，单字段 `HGET` 不必把整个对象拉回客户端。对象级过期仍然在 key 上，字段级 TTL 要自己设计，或者拆 key。

![Hash](/images/redis-data-structures/03-hash.webp)

List 是序列。它适合队列、最新 N 条、时间上有顺序的追加。不要拿它当随机访问的数组：中间插入和按值删除会随长度变差。老实现是 quicklist 串起压缩节点，目标仍是“两端操作快、内存紧”。

Set 是去重集合。成员测试、交并差，是它的正业。UV 统计、标签、互相关注，常常先看 Set 够不够；不够再考虑 HyperLogLog 或外部系统。成员一旦带分数或顺序，就该换 ZSet。

---

## 3. 跳表为什么出现在 ZSet 里

有序集合要同时回答两件事：这个 member 的 score 是多少，以及某个分数区间里有哪些 member。哈希表能解决第一件；区间遍历需要另一套有序结构。

跳表在多层链表上做概率平衡。平均查找、插入是对数级，范围扫描沿着底层链表走，实现比平衡树直观，对 Redis 这种单线程写路径也友好。ZSet 因此常常是 dict 加 skiplist：dict 管 member 到 score，skiplist 管顺序。

![ZSet](/images/redis-data-structures/04-zset.webp)

![跳表](/images/redis-data-structures/05-skiplist.jpg)

![跳表查找](/images/redis-data-structures/06-skiplist-search.png)

排行榜、延迟队列（score 当时间戳）、范围取 TopN，都是在吃这套布局。用 List 自己排序，或把所有 member 拉回客户端排，是在 Redis 外面重做一遍跳表已经提供的事。

Stream 面向的是“追加的事件”。它有 ID、有消费组、有 pending。它不是 List 的别名。日志、通知、简单的本地 MQ，可以先看 Stream 够不够；跨机可靠投递、堆积、回溯，通常还是消息系统的职责。

---

## 4. 可以复查的判断

给一个 Redis key，先写清访问模式：

1. 整块读写，还是字段 / 成员级？
2. 要不要顺序或分数？
3. 元素会不会从几十涨到几十万？编码升级后的复杂度你能不能接受？

类型选对了，持久化和集群才是在扩这份数据。类型选错了，后面做的分片和加内存，只是把错误布局复制到更多机器上。
