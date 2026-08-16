(() => {
  const name = "巴马AI";

  document.querySelectorAll("[data-copy-wechat]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(name);
        const previous = button.textContent;
        button.textContent = "已复制";
        button.classList.add("is-copied");
        window.setTimeout(() => {
          button.textContent = previous;
          button.classList.remove("is-copied");
        }, 1600);
      } catch (error) {
        window.prompt("复制公众号名称", name);
      }
    });
  });
})();
