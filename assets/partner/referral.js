/*
  Title: Mary Kay Partner Referral Tracker
  Author: Hali Sarah Parsons
  Date: 2026-10-30
  Modified By: Claude
  Description: Remembers which partner business referred a visitor (from the /Partners/Referrals/ page
               or a ?ref=CODE link) and adds a "Referred By" section to every email the
               assessment pages send to the consultant inbox. Also labels each product link in
               those consultant-only emails with the real catalog name, read from the link itself.
*/
(function(){
  var KEY = 'mk_referral';
  var CONSULTANT_FALLBACK = 'sistahaymarykay@gmail.com';
  var DATA_URL = '/Partners/Referrals/partners.json';
  var MAX_AGE_DAYS = 90; // WHY: credit a partner for a sale window, not forever

  /* WHY try/catch on every storage call: private browsing and blocked cookies throw */
  function read(){
    var raw = null;
    try{ raw = localStorage.getItem(KEY); }catch(e){}
    if(!raw){ try{ raw = sessionStorage.getItem(KEY); }catch(e){} }
    if(!raw) return null;
    try{
      var r = JSON.parse(raw);
      if(r && r.ts && (Date.now() - r.ts) > MAX_AGE_DAYS * 864e5) return null;
      return r;
    }catch(e){ return null; }
  }
  function save(r){
    r.ts = r.ts || Date.now();
    var s = JSON.stringify(r);
    try{ localStorage.setItem(KEY, s); }catch(e){}
    try{ sessionStorage.setItem(KEY, s); }catch(e){}
  }

  /* WHY escape: the business name can be typed freely on the Partner page and lands in email HTML */
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }

  /* Capture ?ref=CODE before the page's own script rewrites the URL to ?sid=...
     WHY: printed QR codes / partner links can point straight at /Assess/?ref=CODE */
  try{
    var p = new URLSearchParams(location.search);
    var code = (p.get('ref') || '').trim().toUpperCase();
    if(code && /^[A-Z0-9]{4,12}$/.test(code)){
      var cur = read();
      if(!cur || cur.code !== code) save({ code: code, name: '', source: 'link' });
    }
  }catch(e){}

  /* WHY lookup: a link only carries the code, so fetch the business name once in the background */
  (function fillName(){
    var r = read();
    if(!r || !r.code || r.name || !window.fetch) return;
    fetch(DATA_URL).then(function(res){ return res.json(); }).then(function(list){
      for(var i = 0; i < list.length; i++){
        if(list[i][2] === r.code){ r.name = list[i][0]; r.city = list[i][1]; save(r); break; }
      }
    }).catch(function(){ /* name stays blank; the code alone still identifies the partner */ });
  })();

  window.MKReferral = { get: read, set: save };

  /* Builds the block added to consultant emails */
  function block(r){
    var when = r.ts ? new Date(r.ts).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : '';
    return '<div style="background:#fff8f0;border-left:3px solid #c9a96e;border-radius:8px;padding:14px 18px;margin:0 0 22px;">'
      + '<div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#c9a96e;margin-bottom:6px;">Referred By (Partner Program)</div>'
      + '<div style="font-size:15px;color:#2a1a20;font-weight:600;">' + esc(r.name || 'Unknown business') + (r.city ? ' <span style="font-weight:400;color:#8a7a80;">· ' + esc(r.city) + '</span>' : '') + '</div>'
      + '<div style="font-size:12px;color:#8a7a80;margin-top:3px;">'
      + (r.code ? 'Referral code: <strong style="color:#e8507a;">' + esc(r.code) + '</strong>' : 'Not on partner list (typed by customer)')
      + (when ? ' &nbsp;·&nbsp; Referred ' + esc(when) : '')
      + '</div></div>';
  }

  /* Adds the real catalog name after each product link, e.g.
     "Bright-Eyed Renewal Eye Cream (Timewise Eye Cream)".
     WHY read it from the link's URL: the site's code never has to contain the trademarked
     names, and only Hali's own inbox copy gets the label (customer emails are untouched). */
  function labelProducts(html){
    return String(html).replace(/(<a\b[^>]*href="(https?:\/\/www\.marykay\.com\/[^"]+)"[^>]*>[\s\S]*?<\/a>)/gi, function(all, a, url){
      var parts = url.split('?')[0].split('/').filter(Boolean);
      // WHY second-to-last: product URLs end in ".../<name-slug>-<id>/<sku>.html"
      var seg = parts.length > 1 ? parts[parts.length - 2] : '';
      if(!/-\d{5,}$/.test(seg)) return all;
      var name = seg.replace(/-\d{5,}$/, '').split('-').map(function(w){
        return w.length ? w.charAt(0).toUpperCase() + w.slice(1) : w;
      }).join(' ');
      return a + ' <span style="color:#8a7a80;font-size:12px;font-weight:400;">(' + esc(name) + ')</span>';
    });
  }

  /* WHY wrap emailjs.send instead of editing each email: the assessment has several consultant
     emails (samples, personal assessment, saved results), and one wrapper covers them all. */
  function patch(){
    if(!window.emailjs || !emailjs.send || emailjs.send._mkRef) return;
    var orig = emailjs.send.bind(emailjs);
    var wrapped = function(service, template, params){
      try{
        var r = read();
        var consultant = (typeof CONSULTANT_EMAIL !== 'undefined') ? CONSULTANT_EMAIL : CONSULTANT_FALLBACK;
        var toMe = params && params.to_email && String(params.to_email).toLowerCase() === String(consultant).toLowerCase();
        if(toMe){
          params = Object.assign({}, params);
          params.message = labelProducts(params.message || '');
        }
        if(r && toMe){
          var b = block(r);
          var msg = String(params.message || '');
          // WHY after the first body div: puts the referral right under the pink header where it's seen first
          params.message = msg.indexOf('<div class="body">') > -1
            ? msg.replace('<div class="body">', '<div class="body">' + b)
            : b + msg;
          params.subject = (params.subject || '') + ' [Ref: ' + (r.name || r.code || 'Partner') + ']';
          params.referral_name = r.name || '';
          params.referral_code = r.code || '';
        }
      }catch(e){ /* never block a real send because of referral info */ }
      return orig(service, template, params);
    };
    wrapped._mkRef = true;
    emailjs.send = wrapped;
  }
  // WHY on load: this file runs before the EmailJS library is loaded
  window.addEventListener('load', patch);
  document.addEventListener('DOMContentLoaded', patch);
})();
