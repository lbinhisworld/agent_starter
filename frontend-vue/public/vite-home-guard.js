/**
 * 探测「未走 Vite 却打开 frontend-vue 源码入口」的常见失败（static/* 404、main.ts 被静态站误标为 video/mp2t 等），并提示正确打开方式。
 * 由 home.html 以经典脚本引用；构建时随 publicDir 写入 dist/ 根目录。
 */
(function () {
  function show(html) {
    var d = document.createElement('div');
    d.setAttribute('role', 'alert');
    d.setAttribute(
      'style',
      'margin:12px;padding:12px 14px;border:1px solid #b00020;background:#ffebee;color:#333;font:14px/1.5 system-ui,sans-serif;border-radius:6px;max-width:52rem',
    );
    d.innerHTML = html;
    var app = document.getElementById('home-app');
    document.body.insertBefore(d, app || document.body.firstChild);
  }

  function checkModuleTsMime() {
    var mod = document.querySelector('script[type="module"]');
    if (!mod || !mod.src || !/\.ts($|[?#])/.test(mod.src)) return;
    fetch(mod.src, { cache: 'no-store' }).then(function (r) {
      var ct = (r.headers.get('content-type') || '').toLowerCase();
      if (r.ok && (ct.indexOf('javascript') !== -1 || ct.indexOf('ecmascript') !== -1)) return;
      show(
        '检测到 Vue 源码入口被服务器以非 JavaScript 类型返回（Content-Type: <code>' +
          (ct || '未知') +
          '</code>）。请在本仓库 <code>frontend-vue</code> 目录执行 <code>npm run dev</code> 后访问 <strong>http://localhost:5173/home.html</strong>，不要只用「静态服务器 / Live Server」直接打开本页。若使用构建产物，请打开 <code>frontend-vue/dist/home.html</code>（需先执行 <code>npm run build</code>）。',
      );
    }).catch(function () {});
  }

  function checkStaticConfig() {
    var list = document.querySelectorAll('script[src*="static/config.js"]');
    var cfg = list.length ? list[0] : null;
    if (!cfg || !cfg.src) return;
    fetch(cfg.src, { method: 'GET', cache: 'no-store' }).then(function (r) {
      if (r.ok) return;
      show(
        '无法加载 <code>' +
          cfg.src +
          '</code>（HTTP ' +
          r.status +
          '）。共享静态资源缺失：请在 <code>frontend-vue</code> 下执行 <code>npm run dev</code>（Vite 经 publicDir 提供 <code>static/*</code>），或确认构建产物 <code>frontend-vue/dist/static/</code> 完整（需先 <code>npm run build</code>）。',
      );
    }).catch(function () {});
  }

  checkStaticConfig();
  checkModuleTsMime();
})();
