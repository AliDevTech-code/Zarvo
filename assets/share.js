/* Product page share button — native share sheet on mobile, copy link on desktop. */
(function () {
  var btn = document.querySelector('[data-share]');
  if (!btn) return;

  var label = btn.querySelector('[data-share-label]');
  var originalLabel = label ? label.textContent : '';
  var meta = function (sel) {
    var el = document.querySelector(sel);
    return el ? el.getAttribute('content') || '' : '';
  };
  var h1 = document.querySelector('.product h1');
  var url = (document.querySelector('link[rel="canonical"]') || {}).href || location.href;
  var name = h1 ? h1.textContent.trim() : (meta('meta[property="og:title"]') || document.title);
  var title = meta('meta[property="og:title"]') || name;
  var text = 'Check out ' + name + ' on Zarvo';

  function fallbackCopy(value) {
    return new Promise(function (resolve) {
      var ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
      resolve();
    });
  }

  function copy(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value).catch(function () { return fallbackCopy(value); });
    }
    return fallbackCopy(value);
  }

  function flash(message) {
    if (!label) return;
    label.textContent = message;
    clearTimeout(flash.timer);
    flash.timer = setTimeout(function () {
      label.textContent = originalLabel;
    }, 1800);
  }

  btn.addEventListener('click', function () {
    var data = { title: title, text: text, url: url };
    if (navigator.share) {
      navigator.share(data).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        copy(url).then(function () { flash('Link copied'); });
      });
      return;
    }
    copy(url).then(function () { flash('Link copied'); });
  });
})();
