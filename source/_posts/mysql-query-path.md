---
title: 一条 SQL 在 MySQL 里怎么走完
author: AVloger
date: 2026-08-17 11:20:00
draft: false
summary: 查询不是“把 SQL 丢给存储引擎”。连接器、分析器、优化器、执行器先在 Server 层把语句变成执行计划，InnoDB 再通过缓冲池、索引和日志把行读出来或写回去。
description: 按连接、解析、优化、执行的顺序说明 SELECT 和 UPDATE 在 MySQL 中的路径，以及缓冲池、undo、redo、binlog 分别出现在哪一步。
coverImage: /images/mysql-query-path/cover.jpg
cover: /images/mysql-query-path/cover.jpg
categories:
  - 技术笔记
  - MySQL
tags:
  - MySQL
  - 执行器
  - Buffer Pool
  - redo log
---

一条 SQL 进 MySQL，先碰到的不是磁盘上的 `.ibd` 文件。它要经过一串 Server 层组件，最后才进入存储引擎。把这条路径画清楚，后面的索引、事务和复制才有挂点。

```text
连接器
-> 分析器（词法 / 语法）
-> 优化器（选索引、选连接顺序）
-> 执行器
-> 存储引擎（InnoDB）
```

查询缓存这条老路已经从 MySQL 8.0 拿掉。现在不要再把“先查缓存再执行”当成默认路径。

![MySQL 架构：Server 层与存储引擎](/images/mysql-query-path/01-mysql-architecture.png)

---

## 1. 连接器只解决“你是谁”

客户端用用户名、密码、数据库名连上来。连接器做认证、做权限，然后把这个会话留下来。连接本身占内存、占文件描述符。短连接把建连成本摊到每条语句上；长连接要小心会话级状态和内存膨胀。

权限失败、库不存在、连接数打满，都会在这一层就返回。它们看起来像 SQL 问题，其实还没走到解析。

---

## 2. 分析器和优化器把语句变成计划

分析器认出这是 `SELECT` 还是 `UPDATE`，表名、列名是否存在。语法错在这里报。语义上“表不存在”也常在这一层被发现。

优化器决定怎么拿数据。同一条 `WHERE a = 1 AND b = 2`，可能走 `a` 的二级索引，可能走 `(a, b)` 联合索引，也可能扫主键。它参考的是统计信息，不是你的直觉。统计过期时，它会选错，慢查询就从这里开始。

`EXPLAIN` 看的就是优化器交出的计划：访问类型、用了哪把索引、要不要回表、预计扫描多少行。执行器大体上按这份计划去调存储引擎接口。

![一条查询的执行路径](/images/mysql-query-path/02-query-path.png)

---

## 3. SELECT：缓冲池命中才是常态

InnoDB 读页先问 Buffer Pool。页在内存里就直接用；不在，才从磁盘读进缓冲池再返回。所以“查一次磁盘”往往是错觉：热数据反复打的是内存页，冷数据才打盘。

二级索引找到的是主键值，还要拿主键再定位整行，这就是回表。覆盖索引能在二级索引里凑齐所需列，就少一次主键查找。这是查询路径上最常见的空间换时间。

---

## 4. UPDATE：内存改页，日志保命

更新更绕。执行器先把行读出来（同样可能走索引和缓冲池），改 Buffer Pool 里的页，写 undo（回滚和 MVCC 要靠它），写 redo（崩溃后把页恢复到足够新），提交时再保证 binlog 也落稳。

可以记成两条线：

```text
数据页：先改内存，脏页之后再刷盘
日志：redo 保证崩溃恢复，binlog 保证复制和备份
```

redo 是物理日志，记的是页上做了什么修改。binlog 是逻辑日志，记的是这一条语句或这一行变成了什么。两者格式不同、时机不同，所以提交时要两阶段：redo 先准备，binlog 写完，redo 再提交。这个配合一旦乱掉，主从和崩溃恢复会对不上。

![一条 UPDATE 的执行过程](/images/mysql-query-path/03-update-process.png)

![prepare 阶段](/images/mysql-query-path/04-prepare.png)

![commit 阶段](/images/mysql-query-path/05-commit.png)

一条 update 慢，不一定是“SQL 写得丑”。可能是行锁等、可能是 redo 刷盘、可能是脏页太多触发了激烈刷盘。路径清楚了，才能判断慢在 Server 层、引擎层，还是磁盘。

---

## 5. 可以复查的判断

拿到一条慢 SQL，按路径问：

1. 有没有连上、有没有权限？
2. 优化器选的索引是不是你以为的那把？
3. 读是打了 Buffer Pool 还是打了盘？
4. 写是卡在锁、redo，还是 binlog？

“先优化 SQL”只有在第 2 步被证实之后才成立。更前面和更后面的问题，改语句解决不了。
