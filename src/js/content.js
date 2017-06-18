'use strict';

(() => {
  var WRAPPER = 'imageundercursor-wrapper';
  var ARROW_SIZE = 11, ARROW_Y_OFF = 2, BOX_MARGIN = 10;

  var mousePos = {};
  var imgs = [];
  var w, warrow, wbody;

  function findImages(x, y) {
    return document.elementsFromPoint(x, y).map(el => {
      if (el.tagName === 'IMG')
        return {
          s: el.src,
          w: el.width,
          h: el.height,
        };
      if (el.tagName === 'CANVAS')
        return {
          s: el.toDataURL('png'),
          w: el.width,
          h: el.height,
        }
      if (el.tagName === 'VIDEO')
        return {
          s: el.src,
          t: 'video',
        }
      var bg = window.getComputedStyle(el).backgroundImage;
      if (String.prototype.indexOf.call(bg, 'url(') !== -1)
        return {
          s: bg.replace(/^url\(['"]?([^'"]+)['"]?\)/, '$1')
        };
    }).filter(el => !!el);
  }

  document.addEventListener('mousedown', (e) => {
    if (e.button !== 2)
      return;
    mousePos = {
      x: e.pageX,
      y: e.pageY,
    };
    imgs = findImages(e.clientX, e.clientY);
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request !== 'show')
      return;
    var x = mousePos.x, y = mousePos.y;
    if (!imgs.length) {
      // display "nope" icon
      var nope = document.createElement('div');
      nope.className = WRAPPER + '-nope';
      nope.addEventListener('webkitAnimationEnd', (e) => {
        nope.remove();
      });
      document.body.appendChild(nope);
      nope.style.left = x - nope.clientWidth / 2 + 'px';
      nope.style.top = y - nope.clientHeight / 2 + 'px';
      nope.className += " fade";
      return;
    }
    wbody.innerHTML = ''; // empty wbody
    // build wbody items
    for (var img of imgs) {
      var li = document.createElement('li');
      var pic = document.createElement('div');
      pic.className = 'img';
      if (img.t === 'video') {
        var vid = document.createElement('video');
        vid.src = img.s;
        vid.muted = true;
        vid.autoplay = true;
        vid.controls = false;
        vid.className = 'video';
        pic.appendChild(vid);
      } else {
        pic.style.backgroundImage = 'url("' + img.s + '")';
      }
      var a = document.createElement('a');
      a.className = 'link';
      a.href = img.s;
      a.textContent = img.s.substring(0, 128);
      var pica = document.createElement('a');
      pica.href = img.s;
      pica.appendChild(pic);
      li.appendChild(pica);
      li.appendChild(a);
      var info = document.createElement('span');
      info.className = 'info';
      if (img.t === 'video')
        info.textContent = chrome.i18n.getMessage('video');
      else if (img.w !== undefined && img.h !== undefined)
        info.textContent = '' + img.w + '×' + img.h;
      else
        info.textContent = chrome.i18n.getMessage('bg_image');
      li.appendChild(info);
      wbody.appendChild(li);
    }
    w.style.display = 'block'; // display before computations so geometry is computed
    var l = Math.min(window.innerWidth - w.clientWidth - BOX_MARGIN * 2, Math.max(BOX_MARGIN, x - w.clientWidth / 2));
    warrow.style.left = Math.min(window.innerWidth - BOX_MARGIN, Math.max(BOX_MARGIN, x - l - ARROW_SIZE / 2)) + 'px';
    w.style.left = l + 'px';
    w.style.top = y + ARROW_SIZE + ARROW_Y_OFF + 'px';
  });

  // build the popover
  w = document.createElement('div');
  w.className = WRAPPER;
  w.style.display = 'none';
  // don't hide popover on self-click
  w.addEventListener('click', e => e.stopPropagation());

  warrow = document.createElement('div');
  warrow.className = 'arrow';
  w.appendChild(warrow);

  wbody = document.createElement('ul');
  wbody.className = 'body';
  w.appendChild(wbody);

  document.body.appendChild(w);

  document.body.addEventListener('click', e => {
    // hide popover on page click
    w.style.display = 'none';
  });

})();
