(() => {
  const storageKey = "avloger-theme";
  const root = document.documentElement;
  const toggle = document.querySelector("[data-theme-toggle]");

  const applyTheme = (theme) => {
    root.setAttribute("data-theme", theme);
    if (!toggle) return;
    const isDark = theme === "dark";
    toggle.setAttribute("aria-pressed", isDark ? "true" : "false");
    toggle.textContent = isDark ? "浅色" : "深色";
  };

  const stored = (() => {
    try {
      return localStorage.getItem(storageKey);
    } catch (error) {
      return null;
    }
  })();
  const initial = stored || "dark";
  applyTheme(initial);

  toggle?.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(storageKey, next);
    } catch (error) {}
    applyTheme(next);
  });

  const wechatName = "巴马AI";
  document.querySelectorAll("[data-copy-wechat]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(wechatName);
        const previous = button.textContent;
        button.textContent = "已复制";
        button.classList.add("is-copied");
        window.setTimeout(() => {
          button.textContent = previous;
          button.classList.remove("is-copied");
        }, 1600);
      } catch (error) {
        window.prompt("复制公众号名称", wechatName);
      }
    });
  });
})();
