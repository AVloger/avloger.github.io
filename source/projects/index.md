---
title: 项目经历
date: 2026-07-12 23:30:00
description: AVloger 参与过的项目经历，包括 SLS SQL/SPL Copilot 和新版数据加工，包含项目介绍与内嵌视频演示。
---

<style>
.projects-page {
  display: grid;
  gap: 28px;
}

.projects-intro {
  margin: 0 0 6px;
  color: var(--font-color);
  line-height: 1.9;
}

.project-block {
  overflow: hidden;
  border: 1px solid rgba(120, 130, 150, 0.22);
  border-radius: 8px;
  background: var(--card-bg);
  box-shadow: 0 10px 32px rgba(20, 30, 50, 0.08);
}

.project-body {
  padding: 22px 24px 8px;
}

.project-kicker {
  margin: 0 0 8px;
  color: #1683d8;
  font-size: 0.86rem;
  font-weight: 700;
}

.project-title {
  margin: 0 0 12px;
  font-size: 1.55rem;
  line-height: 1.35;
}

.project-summary {
  margin: 0 0 16px;
  line-height: 1.9;
}

.project-points {
  margin: 0;
  padding-left: 1.2em;
  line-height: 1.85;
}

.project-video {
  padding: 0 24px 24px;
}

.video-frame {
  overflow: hidden;
  border-radius: 8px;
  background: #0b1020;
  aspect-ratio: 16 / 9;
}

.video-frame iframe,
.video-frame video {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

.project-refs {
  border-top: 1px solid rgba(120, 130, 150, 0.2);
  padding-top: 18px;
}

.project-refs h2 {
  margin-top: 0;
}

.project-refs ul {
  margin-bottom: 0;
  line-height: 1.9;
}
</style>

<div class="projects-page">
  <p class="projects-intro">这里记录一些我参与过、愿意公开展示的工程项目。重点不只是功能本身，也包括背后的产品判断、工程复杂度和落地场景。</p>

  <section class="project-block">
    <div class="project-body">
      <p class="project-kicker">日志服务 · AI Copilot · 查询分析</p>
      <h2 class="project-title">SLS SQL/SPL Copilot</h2>
      <p class="project-summary">面向日志服务 SLS 查询与分析场景的智能辅助能力，目标是降低用户从自然语言意图到可执行 SQL/SPL 查询的门槛。</p>
      <p class="project-summary">这个项目的核心价值在于把日志分析里的“语法理解、字段理解、查询构造、结果解释”串成更顺滑的工作流。对用户来说，它不是简单生成一段查询语句，而是帮助用户更快完成排障、检索、聚合分析和探索式查询。</p>
      <ul class="project-points">
        <li>理解 SLS 场景下的日志字段、索引配置和查询约束。</li>
        <li>在 SQL 与 SPL 两种表达体系之间处理用户意图。</li>
        <li>让 AI 生成结果更接近可执行、可解释、可迭代的工程输出。</li>
        <li>把 Copilot 能力嵌入真实控制台工作流，而不是停留在 demo。</li>
      </ul>
    </div>
    <div class="project-video">
      <div class="video-frame">
        <iframe src="https://player.bilibili.com/player.html?bvid=BV1JiVyzCEmq&autoplay=0" scrolling="no" allowfullscreen="true"></iframe>
      </div>
    </div>
  </section>

  <section class="project-block">
    <div class="project-body">
      <p class="project-kicker">日志服务 · 数据加工 · 实时处理</p>
      <h2 class="project-title">新版数据加工</h2>
      <p class="project-summary">新版数据加工是面向日志清洗、转换、富化和分发的处理能力升级，目标是让用户以更低的学习成本完成稳定、可观测、可维护的数据处理链路。</p>
      <p class="project-summary">它解决的是日志进入存储和分析系统之前的关键问题：原始数据往往格式不统一、字段不规范、上下文缺失，直接查询和分析成本很高。通过新版数据加工，用户可以对日志进行解析、字段提取、条件分支、数据清洗、投递转换等处理，让下游检索、分析、告警和报表更可靠。</p>
      <ul class="project-points">
        <li>把复杂的数据处理能力设计成更容易理解和调试的产品体验。</li>
        <li>兼顾实时处理性能、规则表达能力和稳定性。</li>
        <li>服务不同规模用户，从简单字段清洗到复杂加工链路。</li>
        <li>让加工过程具备更好的可观测性，方便定位规则和数据问题。</li>
      </ul>
    </div>
    <div class="project-video">
      <div class="video-frame">
        <video controls preload="metadata">
          <source src="https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20240627/aoptgz/%E4%BB%8B%E7%BB%8D%E5%92%8C%E6%BC%94%E7%A4%BA.mp4" type="video/mp4">
          当前浏览器不支持内嵌视频播放。
        </video>
      </div>
    </div>
  </section>

  <section class="project-refs">
    <h2>参考链接</h2>
    <ul>
      <li><a href="https://www.bilibili.com/video/BV1JiVyzCEmq/?spm_id_from=333.337.search-card.all.click&amp;vd_source=b62d1e297b9c26eac4de904df5c71b73" target="_blank" rel="noopener">SLS SQL/SPL Copilot 演示视频</a></li>
      <li><a href="https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20240627/aoptgz/%E4%BB%8B%E7%BB%8D%E5%92%8C%E6%BC%94%E7%A4%BA.mp4" target="_blank" rel="noopener">新版数据加工官网演示视频</a></li>
      <li><a href="https://help.aliyun.com/zh/sls/data-processing-new-edition-overview?spm=a2c4g.11186623.help-menu-28958.d_3_3_0_0.7d5f308clLY9qK" target="_blank" rel="noopener">新版数据加工官方文档</a></li>
    </ul>
  </section>
</div>
