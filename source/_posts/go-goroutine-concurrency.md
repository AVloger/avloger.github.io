---
title: 从 Goroutine 到 GMP：把 Go 并发模型讲清楚
author: AVloger
date: 2026-07-21 22:40:00
draft: false
summary: Goroutine 不是“更小的线程”这么简单。理解 Go 并发模型，需要同时看语言设计、runtime 调度、阻塞唤醒、工程用法和常见风险。
description: 本文从 goroutine 的设计动机、goroutine 与 OS thread 的区别、GMP 调度模型、netpoller、GOMAXPROCS、context、channel、WaitGroup、worker pool 和常见并发问题出发，系统梳理 Go 并发模型。
coverImage: /images/go-concurrency/go-logo-blue.svg
cover: /images/go-concurrency/go-logo-blue.svg
categories:
  - 八股
tags:
  - Goroutine
  - Go 并发
  - GMP 调度
  - Runtime
---

Go 的并发模型经常被一句话概括成“Go 适合高并发”。这句话没错，但太粗了。

更准确地说，Go 把并发编程里很大一部分复杂性放到了 runtime：开发者用 goroutine 描述大量轻量级并发任务，用 channel、context、sync 等工具组织同步和取消；Go runtime 再负责把这些 goroutine 调度到少量 OS thread 上执行。

这篇文章不背结论，而是按下面这条线索把 goroutine 讲清楚：

```text
为什么需要 goroutine
-> goroutine 和 OS thread 有什么区别
-> GMP 模型怎么工作
-> runtime 到底在调度哪些资源
-> 工程里应该怎样使用 goroutine
-> 常见问题如何避免
```

![Go Logo](/images/go-concurrency/go-logo-blue.svg)

---

## 1. Go 的并发抽象解决了什么问题

传统服务端程序要同时处理大量请求、连接、定时任务和后台任务。如果直接把每个并发任务都映射成一个 OS thread，系统很快会遇到几个成本：

| 问题 | 说明 |
|------|------|
| 创建成本高 | OS thread 的创建和销毁需要内核参与 |
| 栈空间成本高 | 线程通常需要预留较大的栈空间 |
| 切换成本高 | 线程上下文切换依赖内核调度 |
| 编程模型复杂 | 异步回调或事件循环容易把业务逻辑拆散 |

Goroutine 的设计目标，是让并发成为一种低成本、接近同步代码风格的默认能力。

一个 goroutine 本质上是 Go runtime 管理的轻量级执行单元。它最终仍然要跑在 OS thread 上，但它的创建、栈管理、阻塞唤醒和调度主要由 Go runtime 接管。

这带来的结果是：

- 可以轻松创建成千上万个 goroutine。
- 初始栈很小，并且可以按需增长。
- 网络 I/O 阻塞时，runtime 可以挂起 goroutine，等 fd 就绪后再恢复。
- 开发者可以用看起来同步的方式写并发逻辑。

所以，goroutine 的关键不是“完全不依赖线程”，而是：

> Go runtime 用少量 OS thread 承载大量 goroutine，并在用户态完成大量调度工作。

---

## 2. Goroutine 和 OS Thread 的区别

| 维度 | goroutine | OS thread |
|------|-----------|-----------|
| 管理者 | Go runtime | 操作系统内核 |
| 栈空间 | 初始小，可动态增长 | 通常预留较大 |
| 创建成本 | 低 | 较高 |
| 调度位置 | runtime 用户态调度为主 | 内核调度 |
| 数量级 | 可以非常多 | 更容易受系统资源限制 |
| 阻塞处理 | runtime 可感知部分阻塞并切走 G | 线程阻塞时由内核挂起 |

这里最容易说错的一点是：goroutine 不是“脱离线程独立执行”的东西。

更准确的表达是：

```text
goroutine 是用户态轻量级执行单元；
OS thread 是内核调度的执行实体；
goroutine 最终由 Go runtime 调度到 OS thread 上执行。
```

---

## 3. GMP 模型：G、M、P 分别是什么

Go 调度器的核心模型通常叫 GMP。

- `G`：goroutine，表示一个待执行的任务。
- `M`：machine，对应一个 OS thread。
- `P`：processor，表示执行 Go 代码所需的调度上下文和资源。

真正执行 Go 代码时，需要满足：

```text
G 在 M 上运行，而 M 必须持有 P。
```

可以把它理解成：

- `G` 是任务。
- `M` 是干活的线程。
- `P` 是执行 Go 代码的许可和本地调度上下文。

每个 `P` 都有自己的本地运行队列。新创建的 goroutine 通常会进入当前 `P` 的本地队列；当某个 `P` 的本地队列空了，它可以从全局队列或其他 `P` 的本地队列偷 goroutine，这就是 work stealing。

Go runtime 源码里的 `runtime/proc.go` 也直接说明了这几个概念：`G` 是 goroutine，`M` 是 worker thread，`P` 是执行 Go 代码所需的资源，调度器负责把可运行的 goroutine 分发到 worker thread 上。

---

## 4. Runtime 调度的不是 CPU，而是执行机会

说“Go runtime 调度 CPU”并不严谨。CPU 最终仍然由操作系统调度线程来使用。

Go runtime 真正做的是：在用户态决定哪些 goroutine 可以获得执行机会，如何复用 OS thread，以及当 goroutine 阻塞或恢复时如何切换。

可以拆成几类资源来看。

### 4.1 CPU 执行机会

Runtime 要决定哪个 goroutine 先执行、哪个 goroutine 后执行。它会维护可运行队列，并通过本地队列、全局队列和 work stealing 平衡任务。

### 4.2 OS Thread 资源

Goroutine 最终必须运行在线程上。Runtime 会尽量用较少线程承载大量 goroutine。

当 goroutine 因为 channel、mutex、timer、网络 I/O 等 runtime 可感知的原因阻塞时，runtime 可以挂起当前 `G`，让 `M` 去执行其他可运行的 `G`。

### 4.3 P 的本地队列和全局队列

`P` 不只是数量计数，它还维护本地运行队列、缓存和调度上下文。

`GOMAXPROCS` 控制的是 `P` 的数量，也就是同一时刻最多有多少个 `P` 执行 Go 代码。它不是 goroutine 数量，也不是 OS thread 数量。

### 4.4 阻塞与唤醒

Runtime 需要处理很多状态变化：

- channel 读写阻塞。
- mutex 竞争。
- timer 到期。
- 网络 I/O 就绪。
- syscall 返回。
- goroutine 被抢占。

网络 I/O 是 Go 高并发能力里非常关键的一块。Go 的网络库与 runtime netpoller 结合，fd 未就绪时挂起 goroutine；等 fd 就绪后，再把 goroutine 放回可运行队列。

### 4.5 栈和运行时状态

Goroutine 的栈可以增长，runtime 还要维护抢占点、GC safepoint、调度状态等信息。

这也是为什么 goroutine 不是一个普通函数调用，它背后有完整的 runtime 状态机。

---

## 5. Goroutine 应该怎样用

启动 goroutine 很简单：

```go
go func() {
    // do something
}()
```

但真实工程里，不应该只会“裸起 goroutine”。一个可维护的并发任务，通常需要同时考虑生命周期、错误传递、并发度和共享状态。

常见工具可以这样分工：

| 工具 | 作用 |
|------|------|
| `channel` | goroutine 之间通信和同步 |
| `context` | 超时、取消、请求生命周期传递 |
| `sync.WaitGroup` | 等待一组 goroutine 完成 |
| `sync.Mutex` | 保护共享状态 |
| `sync.Once` | 只执行一次初始化 |
| `atomic` | 简单原子计数或状态更新 |
| worker pool | 控制并发度，避免无限制创建 goroutine |

一个更工程化的习惯是：

- 请求级 goroutine 跟随请求 `context` 退出。
- 批量任务用 worker pool 或 semaphore 控制并发度。
- 多个 goroutine 的错误结果要有收集和返回路径。
- channel 的关闭责任要清晰。
- 共享变量要用 mutex、atomic 或更明确的数据归属来保护。

---

## 6. Channel 不是万能同步工具

Go 有一句很有名的并发理念：

```text
Do not communicate by sharing memory; share memory by communicating.
```

这句话强调的是：优先用通信组织并发关系，而不是让多个 goroutine 随意争抢同一块共享内存。

但这不意味着所有同步都必须用 channel。

一般来说：

- 任务分发、结果传递、流水线处理，适合 channel。
- 保护一小段共享状态，mutex 往往更直接。
- 简单计数或状态位，可以用 atomic。
- 只执行一次初始化，用 `sync.Once`。

Channel 是表达并发关系的工具，不是替代所有锁的银弹。

---

## 7. 常见问题

### 7.1 Goroutine 泄漏

Goroutine 泄漏通常不是“内存没释放”这么简单，而是某些 goroutine 永远等不到退出条件。

典型场景包括：

- 一直阻塞在 channel 读写。
- 没有监听 `context` 取消。
- producer 已经退出，consumer 还在等。
- consumer 已经退出，producer 还在发。
- 后台 goroutine 没有明确生命周期。

避免方式：

- 所有长生命周期 goroutine 都要能被取消。
- 请求级 goroutine 绑定请求 `context`。
- channel 的生产方、消费方和关闭方要约定清楚。
- 批量并发任务要有超时和错误退出路径。

### 7.2 Data Race

多个 goroutine 同时读写共享变量，如果没有锁或原子保护，就可能发生 data race。

Go 提供了 race detector：

```bash
go test -race ./...
```

它不能替代设计层面的并发约束，但在测试阶段非常有价值。

### 7.3 无限制并发

最常见的写法是：

```go
for _, task := range tasks {
    go func(task Task) {
        handle(task)
    }(task)
}
```

如果 `tasks` 很大，这段代码会瞬间创建大量 goroutine，带来内存、调度和下游服务压力。

更稳妥的方式是：

- worker pool。
- semaphore。
- `errgroup` 加并发上限。
- 限流、超时和熔断。

### 7.4 阻塞一定会占住线程吗

要分情况。

Channel、mutex、timer、网络 I/O 等 runtime 可感知的阻塞，runtime 可以挂起当前 goroutine，并调度其他 goroutine。

某些 syscall 或 cgo 阻塞可能会占住 `M`。这种情况下，runtime 可能会创建或唤醒其他 `M`，让其他 goroutine 继续执行。

---

## 8. 一个简洁总结

理解 Go 并发模型，可以抓住三句话：

```text
goroutine 是 Go runtime 管理的轻量级执行单元；
GMP 模型负责把大量 G 调度到少量 M 上，P 提供执行 Go 代码所需的调度上下文；
工程上使用 goroutine 时，生命周期、并发度、错误处理和共享状态比“go 一下”更重要。
```

Goroutine 的价值不只是性能，更是把并发从“特殊技巧”变成普通工程代码的一部分。理解 runtime 的边界之后，写出来的并发代码才不会只在 demo 里好看。

---

## 延伸图解与资料

- [Go runtime/proc.go](https://go.dev/src/runtime/proc.go)：Go runtime 调度器源码，包含 `G`、`M`、`P` 的核心定义。
- [Scheduling In Go: Part II - Go Scheduler](https://www.ardanlabs.com/blog/2018/08/scheduling-in-go-part2.html)：Ardan Labs 的 Go 调度器图解文章，适合配合 GMP 模型阅读。
