(() => {
  const CACHE = 'floating-island-offline-v1';
  const required = [
    'index.html', 'offline.js', 'manifest.json',
    'icon-192.png', 'icon-512.png', 'media/cover.jpg', 'media/back-cover.jpg',
    'media/elmer-p-tw.ttf',
    ...Array.from({length: 12}, (_, i) => `media/${i + 1}.mov`)
  ];
  const optional = ['media/ambient.mp3', 'media/flip.wav'];
  const url = path => new URL(path, document.baseURI).href;
  const choices = document.querySelector('#intro .choices');
  if (!choices) return;
  const style = document.createElement('style');
  style.textContent = `
    @media (any-pointer: coarse) {
      #app nav button, #intro .choices button { min-height: 48px; min-width: 48px; touch-action: manipulation; }
      #app nav { padding-left: max(10px, env(safe-area-inset-left)); padding-right: max(10px, env(safe-area-inset-right)); }
    }
  `;
  document.head.append(style);
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '下載離線版本';
  button.disabled = true;
  const status = document.createElement('p');
  status.style.cssText = 'font-size:1rem;margin:12px 0 0;line-height:1.5';
  status.setAttribute('role', 'status');
  choices.append(button);
  choices.after(status);
  const ready = async () => {
    if (!('serviceWorker' in navigator) || !('caches' in window)) throw new Error('請使用 Chrome 開啟 HTTPS 網站');
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve, reject) => {
        const changed = () => { if (navigator.serviceWorker.controller) { clearTimeout(timer); navigator.serviceWorker.removeEventListener('controllerchange', changed); resolve(); } };
        const timer = setTimeout(() => { navigator.serviceWorker.removeEventListener('controllerchange', changed); reject(new Error('請重新整理網頁後再試')); }, 15000);
        navigator.serviceWorker.addEventListener('controllerchange', changed);
        changed();
      });
    }
  };
  async function check() {
    const cache = await caches.open(CACHE);
    const present = await Promise.all(required.map(path => cache.match(url(path))));
    return present.every(r => r && r.status === 200);
  }
  function done() {
    status.textContent = '離線下載完成！可關閉網路測試閱讀。';
    button.textContent = '重新下載離線版本';
  }
  async function download(cache, path) {
    // Page requests marked cache: reload must bypass the service worker cache below.
    const response = await fetch(url(path) + '?offline-refresh=1', {cache: 'reload'});
    if (response.status !== 200 || response.redirected) throw new Error(path + ' 無法下載（HTTP ' + response.status + '）');
    await cache.put(url(path), response);
  }
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await ready();
      if (navigator.storage?.persist) await navigator.storage.persist().catch(() => false);
      const cache = await caches.open(CACHE);
      for (let i = 0; i < required.length; i++) {
        status.textContent = `正在下載 ${i + 1} / ${required.length}：${required[i]}，請勿關閉畫面`;
        await download(cache, required[i]);
      }
      for (const path of optional) {
        try { await download(cache, path); } catch { /* optional sound file may not exist */ }
      }
      if (!(await check())) throw new Error('部分資源尚未完整下載');
      done();
    } catch (error) {
      status.textContent = '下載未完成：' + error.message + '。請確認網路及儲存空間後重試。';
    } finally { button.disabled = false; }
  });
  ready().then(async () => {
    button.disabled = false;
    if (await check()) done();
    else status.textContent = '展覽前請先下載所有離線資源。';
  }).catch(error => { status.textContent = '離線功能尚未啟用：' + error.message; });
})();
