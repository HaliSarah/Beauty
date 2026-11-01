/*
  Title: Lips QR Code Renderer
  Author: Hali Sarah Parsons
  Date: 2026-10-31
  Modified By: Claude
  Description: Draws a round, pink "kiss" QR code as SVG: every dark module is a lips shape
               (the same artwork as the I.Q. Productionz QR tool), the three corner eyes are
               rounded squares with a big lips in the middle, and decorative lips fill the circle.
               Needs qrcode-generator (window.qrcode) loaded first.
  Usage: LipsQR.svg('https://…', { size: 800 })  → SVG markup string
*/
(function(){
  // Lips artwork from the QR tool (72×72 box). Two parts: the lips and the line between them.
  var LIPS = 'M45.083,2.388c8.784,1.125,7.427,10.632,10.219,16.71 c4.639-0.188,7.613-2.387,13.836-0.655c5.456,15.43-12.391,42.274,2.989,51.438C43.801,72.59,5.188,71.554,0.249,39.45 c-1.79-11.63,6.514-26.311-0.2-39.368C13.196,7.691,32.266,6.787,45.083,2.388z M54.663,46.58 c-1.551-10.696-20.322-7.16-19.785-19.583c-2.935,0.798-9.863-3.235-9.935,1.025C26.938,39.579,45.014,47.333,54.663,46.58z';
  // WHY a solid version: scanners read the middle of each square, which the mouth line would
  // leave empty, so code squares use the filled outline; decorative ones keep the line.
  var LIPS_SOLID = LIPS.split(' M')[0];
  // WHY these colors: the flyer's light blush background and its deep-pink headline color
  var PINK = '#fbd3e0', INK = '#c93a62';

  /** Small repeatable random number generator.
      WHY seeded by the link: the same partner always gets the exact same design */
  function rng(seed){
    var h = 2166136261;
    for(var i = 0; i < seed.length; i++){ h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function(){ h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
  }

  /** One lips shape in a cell, turned one of four ways.
      WHY random turns: matches the tool's "orientation" look and breaks up the grid */
  function lip(x, y, s, turn, solid){
    var k = s / 72, c = s / 2;
    return '<use href="#' + (solid ? 'lips' : 'lip') + '" transform="translate(' + (x + c).toFixed(2) + ' ' + (y + c).toFixed(2) + ') rotate(' + (turn * 90) + ') scale(' + k.toFixed(4) + ') translate(-36 -36)"/>';
  }

  function svg(text, opts){
    opts = opts || {};
    // WHY level H: lips cover less of each square than plain dots, so maximum error correction keeps it scannable
    var qr = window.qrcode(0, 'H');
    qr.addData(text); qr.make();
    var n = qr.getModuleCount();
    var pad = Math.ceil(n * 0.25) + 2;        // decorative ring around the real code
    var g = n + pad * 2;                       // full grid size
    var cell = 10, W = g * cell, R = W / 2;
    var rand = rng(text);
    var out = [];
    var isEye = function(r, c){ return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7); };

    for(var r = -pad; r < n + pad; r++){
      for(var c = -pad; c < n + pad; c++){
        var x = (c + pad) * cell, y = (r + pad) * cell;
        var inCode = r >= 0 && c >= 0 && r < n && c < n;
        if(inCode){
          if(isEye(r, c)) continue;
          if(qr.isDark(r, c)) out.push(lip(x - 0.6, y - 0.6, cell + 1.2, Math.floor(rand() * 4), true));
          continue;
        }
        // WHY a one-cell gap: keeps a quiet border so phone cameras find the code's edge
        if(r >= -1 && c >= -1 && r <= n && c <= n) continue;
        var dx = x + cell / 2 - R, dy = y + cell / 2 - R;
        if(Math.sqrt(dx * dx + dy * dy) > R - cell * 0.9) continue;   // stay inside the circle
        if(opts.deco !== false && rand() < 0.42) out.push(lip(x + 0.6, y + 0.6, cell - 1.2, Math.floor(rand() * 4)));
      }
    }
    // Corner eyes: rounded ring + big lips, like the sample
    [[0, 0], [0, n - 7], [n - 7, 0]].forEach(function(p){
      var x = (p[1] + pad) * cell, y = (p[0] + pad) * cell, s = 7 * cell;
      out.push('<rect x="' + (x + cell / 2) + '" y="' + (y + cell / 2) + '" width="' + (s - cell) + '" height="' + (s - cell) + '" rx="' + (cell * 1.6) + '" fill="none" stroke="' + INK + '" stroke-width="' + cell + '"/>');
      // WHY a big solid lips in the eye (tested): it matches the sample and still scans with
      // the decoder phones use; a pink cut-out version did not scan
      out.push(lip(x + cell * 1.8, y + cell * 1.8, cell * 3.4, 0, true));
    });
    var size = opts.size || 800;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + W + '" width="' + size + '" height="' + size + '" role="img" aria-label="QR code">'
      + '<defs><path id="lip" d="' + LIPS + '" fill-rule="evenodd"/><path id="lips" d="' + LIPS_SOLID + '"/><clipPath id="circ"><circle cx="' + R + '" cy="' + R + '" r="' + R + '"/></clipPath></defs>'
      + '<circle cx="' + R + '" cy="' + R + '" r="' + (R - cell * 0.15) + '" fill="' + PINK + '" stroke="' + INK + '" stroke-width="' + (cell * 0.3) + '"/>'
      + '<g fill="' + INK + '" clip-path="url(#circ)">' + out.join('') + '</g></svg>';
  }

  /** Renders into an element. WHY also return a data URL: the printable flyer needs an image source */
  function render(el, text, opts){
    var s = svg(text, opts);
    el.innerHTML = s;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }

  window.LipsQR = { svg: svg, render: render };
})();
