"use strict";

hexo.extend.helper.register("page_title", function () {
  const site = this.config.title;
  const subtitle = this.config.subtitle;
  if (this.page.layout === "home") {
    return subtitle ? `${site} · ${subtitle}` : site;
  }
  if (this.page.title) {
    return `${this.page.title} · ${site}`;
  }
  return site;
});

hexo.extend.helper.register("nav_active", function (href) {
  const target = String(href || "")
    .replace(/^\//, "")
    .replace(/\/$/, "");
  const current = String(this.page.path || "")
    .replace(/index\.html$/, "")
    .replace(/\/$/, "");

  if (this.is_post()) {
    return target === "writing";
  }
  if (!target) {
    return current === "" || this.page.path === "index.html";
  }
  return current === target || current.startsWith(`${target}/`);
});

hexo.extend.helper.register("cat_posts", function (name) {
  let found = null;
  this.site.categories.forEach((cat) => {
    if (cat.name === name) found = cat;
  });
  if (!found) return [];
  return found.posts.sort("date", -1).toArray();
});

hexo.extend.helper.register("has_category", function (post, name) {
  if (!post || !post.categories || !post.categories.length) return false;
  return post.categories.toArray().some((cat) => cat.name === name);
});

hexo.extend.helper.register("post_cover", function (post) {
  return (post && (post.cover || post.coverImage)) || "";
});

hexo.extend.helper.register("post_blurb", function (post) {
  if (!post) return "";
  return post.summary || post.description || "";
});

hexo.extend.helper.register("date_short", function (value) {
  return this.date(value, "MM.DD");
});

hexo.extend.helper.register("date_month", function (value) {
  return this.date(value, "YYYY.MM");
});

hexo.extend.helper.register("group_posts_by_month", function (posts) {
  const groups = [];
  (posts || []).forEach((post) => {
    const key = this.date(post.date, "YYYY.MM");
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = { key, posts: [] };
      groups.push(group);
    }
    group.posts.push(post);
  });
  return groups;
});

hexo.extend.helper.register("og_image", function () {
  const cover = this.page.cover || this.page.coverImage || this.theme.avatar;
  return this.full_url_for(cover);
});

hexo.extend.helper.register("note_groups", function () {
  const names = ["操作系统", "MySQL", "Redis", "内存", "大数据"];
  const grouped = new Set();
  const groups = names
    .map((name) => {
      const posts = this.cat_posts(name);
      posts.forEach((post) => grouped.add(post._id));
      return { name, posts };
    })
    .filter((group) => group.posts.length);
  const leftover = this.cat_posts("技术笔记").filter((post) => !grouped.has(post._id));
  if (leftover.length) {
    groups.push({ name: "其他", posts: leftover });
  }
  return groups;
});

hexo.extend.helper.register("site_counts", function () {
  const projects = (this.site.data.projects && this.site.data.projects.items) || [];
  const noteIds = new Set();
  ["技术笔记", "操作系统", "MySQL", "Redis", "内存", "大数据"].forEach((name) => {
    this.cat_posts(name).forEach((post) => noteIds.add(post._id));
  });
  return {
    wechat: this.cat_posts("公众号").length,
    notes: noteIds.size,
    projects: projects.length,
  };
});
