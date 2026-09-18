const fs = require('fs');

/**
 * Extract domain from register URL
 */
function extractDomain(registerUrl) {
  try {
    const u = new URL(registerUrl);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return String(registerUrl).split('/')[2]?.replace(/^www\./, '') || '';
  }
}

function isDhaniUrl(url) {
  if (!url) return false;
  const u = String(url).trim().toLowerCase();
  if (u.includes('dhani')) return true;
  if (!u.includes('#/')) {
    if (u.includes('invitecode') || u.includes('invite_code') || u.includes('/register') || u.includes('/wallet') || u.includes('/wingo')) {
      return true;
    }
  }
  return false;
}

function buildUrls(registerUrl, isDhani = false) {
  let base;
  try {
    base = new URL(registerUrl).origin;
  } catch {
    base = String(registerUrl).split('#')[0].replace(/\/+$/, '');
  }
  const dhani = Boolean(isDhani || isDhaniUrl(registerUrl));
  if (dhani) {
    return {
      deposit: base + '/wallet/recharge',
      wingo: base + '/WinGo/WinGo_30S'
    };
  }
  return {
    deposit: base + '/#/wallet/Recharge',
    wingo: base + '/#/saasLottery/WinGo?gameCode=WinGo_30S&lottery=WinGo'
  };
}

function buildRtdbShimScript(liveBase, livePath) {
  const base = JSON.stringify(String(liveBase).replace(/\/+$/, ''));
  const root = JSON.stringify(String(livePath));
  const L = [];
  L.push('<script>');
  L.push('/* MIZANMOD RTDB SHIM V1 — server live mode (no Firebase in APK) — dual bridge ZAYRO+MIZANMOD */');
  L.push('(function(){');
  L.push('  if(window.rtdb && (window.rtdb.__zayroShim || window.rtdb.__mizanmodShim)) return;');
  L.push('  var BASE=' + base + ', ROOT=' + root + ';');
  L.push('  function aj(url,opt,cb){');
  L.push('    try{');
  L.push('      fetch(BASE+url,Object.assign({cache:"no-store",headers:{"Content-Type":"application/json"}},opt||{}))');
  L.push('        .then(function(r){ return r.ok?r.json():null; })');
  L.push('        .then(function(j){ cb(j); })');
  L.push('        .catch(function(){ cb(null); });');
  L.push('    }catch(e){ cb(null); }');
  L.push('  }');
  L.push('  function Snap(v){ this._v=(v===undefined?null:v); }');
  L.push('  Snap.prototype.exists=function(){ return this._v!==null&&this._v!==undefined; };');
  L.push('  Snap.prototype.val=function(){ return this._v; };');
  L.push('  function norm(p){ p=String(p===undefined?"":p); if(p.indexOf(ROOT+"/")===0)p=p.slice(ROOT.length+1); if(p===ROOT)p=""; return p.replace(/^\\/+|\\/+$/g,""); }');
  L.push('  function Ref(p){ this.__p=norm(p); }');
  L.push('  Ref.prototype.__url=function(){ return "/api/rtdb/"+encodeURIComponent(ROOT)+"/"+encodeURIComponent(this.__p); };');
  L.push('  Ref.prototype.on=function(ev,cb){');
  L.push('    if(ev!=="value"||typeof cb!=="function") return this;');
  L.push('    var p=this.__p, self=this, last;');
  L.push('    if(p.indexOf("users")===0){ try{ cb(new Snap(null)); }catch(e){} return this; }');
  L.push('    var iv=(p==="config"||p.indexOf("config/")===0)?20000:8000;');
  L.push('    function tick(){ aj(self.__url(),null,function(v){ var s=JSON.stringify(v===undefined?null:v); if(s!==last){ last=s; try{ cb(new Snap(v===null?null:v)); }catch(e){} } }); }');
  L.push('    tick(); setInterval(tick,iv); return this;');
  L.push('  };');
  L.push('  Ref.prototype.once=function(ev,cb){ var self=this; if(this.__p.indexOf("users")===0){ try{ if(typeof cb==="function") cb(new Snap(null)); }catch(e){} return this; } aj(this.__url(),null,function(v){ try{ if(typeof cb==="function") cb(new Snap(v===null?null:v)); }catch(e){} }); return this; };');
  L.push('  Ref.prototype.set=function(v,cb){ if(this.__p.indexOf("users")===0){ if(typeof cb==="function")try{cb();}catch(e){} return this; } aj(this.__url(),{method:"PUT",body:JSON.stringify(v===undefined?null:v)},function(){ if(typeof cb==="function")try{cb();}catch(e){} }); return this; };');
  L.push('  Ref.prototype.update=function(v,cb){ if(this.__p.indexOf("users")===0){ if(typeof cb==="function")try{cb();}catch(e){} return this; } aj(this.__url(),{method:"PATCH",body:JSON.stringify(v||{})},function(){ if(typeof cb==="function")try{cb();}catch(e){} }); return this; };');
  L.push('  Ref.prototype.remove=function(cb){ if(this.__p.indexOf("users")===0){ if(typeof cb==="function")try{cb();}catch(e){} return this; } aj(this.__url(),{method:"DELETE"},function(){ if(typeof cb==="function")try{cb();}catch(e){} }); return this; };');
  L.push('  Ref.prototype.child=function(c){ return new Ref((this.__p?this.__p+"/":"")+String(c)); };');
  L.push('  Ref.prototype.off=function(){ return this; };');
  L.push('  window.rtdb={ __zayroShim:true, __mizanmodShim:true, ref:function(p){ return new Ref(p); } };');
  L.push('  if(!window.MIZANMOD) window.MIZANMOD=window.rtdb;');
  L.push('  if(!window.ZAYRO) window.ZAYRO=window.rtdb;');
  L.push('  if(typeof window.firebase==="undefined"){');
  L.push('    window.firebase={ apps:[], initializeApp:function(){ return {}; }, app:function(){ return {}; }, database:function(){ return window.rtdb; } };');
  L.push('  }');
  L.push('})();');
  L.push('</script>');
  return L.join('');
}

function injectParams(htmlContent, params) {
  let {
    registerUrl,
    depositUrl,
    wingoUrl,
    domain,
    firebasePath,
    minDeposit,
    brandTitle,
    appIconBase64,
    isDhani,
    liveMode,
    liveBase
  } = params;

  let html = htmlContent;

  // ── SERVER LIVE MODE (fake / no-Firebase builds) ──
  // Correct logic: only when liveMode === 'server' and liveBase is https
  const serverMode = liveMode === 'server' && /^https?:\/\//i.test(String(liveBase || ''));
  if (serverMode) {
    html = html.replace(
      /<script[^>]*src=["'][^"']*firebase-(app|database)-compat[^"']*["'][^>]*><\/script>/gi,
      ''
    );
  }

  // ── NORMALIZE GAME FRAME ──
  const hadGameFrame = /<iframe\b[^>]*\bid=["'](?:target-game-frame|gameIframe)["']/i.test(html);
  if (!hadGameFrame) {
    const frameCss = '<style id="mizanmod-auto-frame-style">#target-game-frame{position:fixed;inset:0;width:100%;height:100%;border:0;background:#000;z-index:0}</style>';
    const frameHtml = '<iframe id="target-game-frame" src="about:blank" allow="autoplay" title="Game"></iframe>';
    if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, `${frameCss}</head>`);
    else html = frameCss + html;
    if (/<body\b[^>]*>/i.test(html)) html = html.replace(/<body\b[^>]*>/i, match => match + frameHtml);
    else html = frameHtml + html;
  }

  // ── REGISTER URL ──
  html = html.replace(
    /(var\s+REGISTER_URL\s*=\s*["'])([^"']+)(["'])/g,
    `$1${registerUrl}$3`
  );
  html = html.replace(
    /((?:gameFrame|gameIframe)\.src\s*=\s*["'])https?:\/\/[^"']+(["'])/g,
    `$1${registerUrl}$2`
  );
  html = html.replace(
    /(<iframe\b[^>]*\bid=["'](?:target-game-frame|gameIframe)["'][^>]*\bsrc=["'])[^"']+(["'])/gi,
    `$1${registerUrl}$2`
  );

  // ── DEPOSIT URL ──
  html = html.replace(
    /(var\s+DEPOSIT_URL\s*=\s*["'])([^"']+)(["'])/g,
    `$1${depositUrl}$3`
  );

  // ── WINGO URL ──
  html = html.replace(
    /(var\s+WINGO_URL\s*=\s*["'])([^"']+)(["'])/g,
    `$1${wingoUrl}$3`
  );

  // ── UNIVERSAL ROUTE NORMALIZATION ──
  html = html.replace(
    /isOnRegisterPage\s*=\s*hash\.indexOf\(['"]\/register['"]\)\s*>=\s*0\s*\|\|\s*hash\.indexOf\(['"]invitationcode['"]\)\s*>=\s*0\s*\|\|\s*hash\.indexOf\(['"]invitecode['"]\)\s*>=\s*0(?!\s*\|\|\s*u\.indexOf);?/g,
    "isOnRegisterPage=hash.indexOf('/register')>=0||hash.indexOf('invitationcode')>=0||hash.indexOf('invitecode')>=0||u.indexOf('/register')>=0||u.indexOf('invitecode')>=0||u.indexOf('invitationcode')>=0;"
  );
  html = html.replace(
    /var\s+isReg\s*=\s*hash\.indexOf\(['"]\/register['"]\)\s*>=\s*0\s*\|\|\s*hash\.indexOf\(['"]invitationcode['"]\)\s*>=\s*0\s*\|\|\s*hash\.indexOf\(['"]invitecode['"]\)\s*>=\s*0(?!\s*\|\|\s*u\.indexOf);?/g,
    "var isReg=hash.indexOf('/register')>=0||hash.indexOf('invitationcode')>=0||hash.indexOf('invitecode')>=0||u.indexOf('/register')>=0||u.indexOf('invitecode')>=0||u.indexOf('invitationcode')>=0;"
  );
  html = html.replace(
    /var\s+isLogin\s*=\s*hash\.indexOf\(['"]\/login['"]\)\s*>=\s*0(?!\s*\|\|\s*u\.indexOf);?/g,
    "var isLogin=(hash.indexOf('/login')>=0||u.indexOf('/login')>=0) && !isOnRegisterPage;"
  );
  html = html.replace(
    /var\s+isWingo\s*=\s*hash\.indexOf\(['"]\/saaslottery['"]\)\s*>=\s*0\s*\|\|\s*hash\.indexOf\(['"]wingo['"]\)\s*>=\s*0\s*\|\|\s*hash\.indexOf\(['"]lottery['"]\)\s*>=\s*0(?!\s*\|\|\s*u\.indexOf);?/g,
    "var isWingo=hash.indexOf('/saaslottery')>=0||hash.indexOf('wingo')>=0||hash.indexOf('lottery')>=0||u.indexOf('/wingo')>=0||u.indexOf('wingo')>=0||u.indexOf('lottery')>=0;"
  );

  // ── FIREBASE DB PATH ──
  const pathMatch = html.match(/rtdb\.ref\(["']([a-zA-Z0-9_]+)\/(config|users)/);
  const oldPrefix = pathMatch ? pathMatch[1] : null;

  if (oldPrefix && oldPrefix !== firebasePath) {
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedOld = escapeRegex(oldPrefix);
    html = html.replace(
      new RegExp(`(rtdb\\.ref\\(["'])${escapedOld}(\\/(?:config|users))`, 'g'),
      `$1${firebasePath}$2`
    );
    // Also replace any hardcoded old prefix like zayrolivesunny globally if it's the old one
    // This handles templates that have hardcoded path strings outside rtdb.ref
    if (oldPrefix === 'zayrolivesunny' || oldPrefix.startsWith('zayro') || oldPrefix.startsWith('mizanmod')) {
      const globalOld = new RegExp(escapeRegex(oldPrefix), 'g');
      html = html.replace(globalOld, firebasePath);
    }
  }

  // ── MIN DEPOSIT ──
  html = html.replace(
    /(\b(?:fbMinDeposit|minDeposit)\s*=\s*)(\d+)/g,
    (m, g1) => g1 + minDeposit
  );
  html = html.replace(
    /(<span\s+id=["']rechargeAmt["'][^>]*>)[^<]*/g,
    `$1&#8377;${minDeposit}`
  );

  // ── BRAND TITLE ──
  const brandAttrPatterns = [
    /class=["'][^"']*brand-name[^"']*["']/,
    /class=["'][^"']*card-title-line1[^"']*["']/,
    /class=["'][^"']*card-title(?=[\s"'])[^"']*["']/,
    /id=["']mainBrandText["']/,
    /class=["'][^"']*wo-title[^"']*["']/,
    /id=["']woTitle["']/
  ];
  for (const attr of brandAttrPatterns) {
    html = html.replace(
      new RegExp(`(<div[^>]+(?:${attr.source})[^>]*>)[\\s\\S]*?<\\/div>`, 'g'),
      (m, g1) => g1 + brandTitle + '</div>'
    );
  }
  html = html.replace(
    /(<(?:span|div)[^>]*class=["'][^"']*cb-main[^"']*["'][^>]*>)([\s\S]*?)(<\/(?:span|div)>)/g,
    (m, g1, g2, g3) => g1 + brandTitle + g3
  );
  html = html.replace(
    /(<div[^>]+class=["'][^"']*wo-head-title[^"']*["'][^>]*>)(?![^<]*<[^>]*cb-main)([\s\S]*?)<\/div>/g,
    (m, g1, g2) => g1 + brandTitle + '</div>'
  );
  html = html.replace(
    /(data-brand-text=["'])[^"']*(["'])/g,
    (m, g1, g2) => g1 + brandTitle + g2
  );
  html = html.replace(
    /(window\.BRAND_NAME\s*=\s*window\.BRAND_NAME\s*\|\|\s*["'])[^"']*(["'])/g,
    (m, g1, g2) => g1 + brandTitle + g2
  );
  const brandSimple = [
    /(<div[^>]+class=["'][^"']*brand-name[^"']*["'][^>]*>)[^<]*/g,
    /(<div[^>]+class=["'][^"']*card-title-line1[^"']*["'][^>]*>)[^<]*/g,
    /(<div[^>]+class=["'][^"']*wo-title["'][^>]*>)[^<]*/g
  ];
  brandSimple.forEach(rx => {
    html = html.replace(rx, (m, g1) => g1 + brandTitle);
  });
  html = html.replace(/(<title>)[^<]*/g, (m, g1) => g1 + brandTitle);

  // ── APP ICON ──
  if (appIconBase64) {
    html = html.replace(
      /src=["']my_icon\.png["']/g,
      `src="data:image/png;base64,${appIconBase64}"`
    );
  }

  // ── FIREBASE PLACEHOLDER FIX ──
  // Use env var if set, otherwise fallback to hardcoded key like zayromod
  const fallbackApiKey = 'AIzaSyDja5Gx4v4sMbx4BM2_od9_bLkdxdEY4do';
  const apiKeyToUse = process.env.FIREBASE_WEB_API_KEY || fallbackApiKey;
  html = html.replace(
    /@secret:GOOGLE_API_KEY/g,
    apiKeyToUse
  );

  // ── FIREBASE LIVE LINKS ──
  let firebaseSdkScripts = '';
  if (!serverMode) {
    if (!/firebase-app-compat\.js/i.test(html)) {
      firebaseSdkScripts += '<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>';
    }
    if (!/firebase-database-compat\.js/i.test(html)) {
      firebaseSdkScripts += '<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"></script>';
    }
  }
  const shimScript = serverMode ? buildRtdbShimScript(liveBase, firebasePath) : '';

  // Firebase config: use env vars if set, otherwise hardcoded zayromod defaults (so Firebase works out-of-box)
  const fbConfig = {
    apiKey: process.env.FIREBASE_WEB_API_KEY || 'AIzaSyDja5Gx4v4sMbx4BM2_od9_bLkdxdEY4do',
    authDomain: (process.env.FIREBASE_PROJECT_ID || 'zayrodev-195f3') + '.firebaseapp.com',
    projectId: process.env.FIREBASE_PROJECT_ID || 'zayrodev-195f3',
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://zayrodev-195f3-default-rtdb.firebaseio.com'
  };
  // If custom project ID is set via env, use its authDomain pattern
  if (process.env.FIREBASE_PROJECT_ID) {
    fbConfig.authDomain = process.env.FIREBASE_PROJECT_ID + '.firebaseapp.com';
  }

  const liveLinksScript = `${firebaseSdkScripts}<script>
(function(){
  var livePath=${JSON.stringify(firebasePath)};
  var autoFrameInjected=${hadGameFrame ? 'false' : 'true'};
  var gameFrame=window.gameFrame||document.getElementById('target-game-frame')||document.getElementById('gameIframe');
  if(gameFrame)window.gameFrame=gameFrame;
  var firebaseConfig=${JSON.stringify(fbConfig)};
  function valid(u){return typeof u==='string' && /^https?:\\/\\//i.test(u);}
  var firstFirebaseLinkLoad=true;
  function applyLinks(data){
    if(!data||typeof data!=='object')return;
    var previousRegister=REGISTER_URL;
    var nextRegister=data.registerUrl||data.register_url;
    var nextDeposit=data.depositUrl||data.deposit_url;
    var nextWingo=data.wingoUrl||data.wingo_url;
    if(!valid(nextRegister)||!valid(nextDeposit)||!valid(nextWingo))return;
    if(nextRegister===REGISTER_URL&&nextDeposit===DEPOSIT_URL&&nextWingo===WINGO_URL){return;}
    REGISTER_URL=nextRegister;
    DEPOSIT_URL=nextDeposit;
    WINGO_URL=nextWingo;
    if(typeof gameFrame!=='undefined'&&gameFrame){
      try{
        var current=gameFrame.src||'';
        if(firstFirebaseLinkLoad||!current||current==='about:blank'||current===previousRegister){
          gameFrame.src=REGISTER_URL;
        }
      }catch(e){}
    }
    if(firstFirebaseLinkLoad&&typeof window.setUrl==='function'){
      try{window.setUrl(REGISTER_URL);}catch(e){}
    }
    firstFirebaseLinkLoad=false;
  }
  if(autoFrameInjected&&gameFrame){
    window.navTo=function(url){
      if(!valid(url))return;
      gameFrame.src=url;
      if(typeof window.setUrl==='function')try{window.setUrl(url);}catch(e){}
      if(typeof window.reportArea==='function')try{window.reportArea();}catch(e){}
    };
  }
  window.__mizanmodAuthRoute=false;
  window.__zayroAuthRoute=false;
  if(typeof window.setUrl==='function'&&!window.setUrl.__mizanmodWrapped){
    var originalSetUrl=window.setUrl;
    var wrappedSetUrl=function(url){
      var lower=(url||'').toString().toLowerCase();
      window.__mizanmodAuthRoute=lower.indexOf('/register')>=0||lower.indexOf('invitationcode')>=0||lower.indexOf('invitecode')>=0||lower.indexOf('/login')>=0;
      window.__zayroAuthRoute=window.__mizanmodAuthRoute;
      var result=originalSetUrl.apply(this,arguments);
      if(window.__mizanmodAuthRoute&&typeof window.setState==='function'){
        try{window.setState('wait');}catch(e){}
      } else if((lower.indexOf('/wingo')>=0||lower.indexOf('wingo')>=0||lower.indexOf('lottery')>=0||lower.indexOf('saaslottery')>=0)&&!window.__mizanmodAuthRoute){
        if(typeof window.setState==='function'){
          try{window.setState('wingo');}catch(e){}
        }
      }
      return result;
    };
    wrappedSetUrl.__mizanmodWrapped=true;
    wrappedSetUrl.__zayroWrapped=true;
    window.setUrl=wrappedSetUrl;
  }
  if(typeof window.setBalance==='function'&&!window.setBalance.__mizanmodWrapped){
    var originalSetBalance=window.setBalance;
    var wrappedSetBalance=function(balance){
      if(window.__mizanmodAuthRoute||window.__zayroAuthRoute){
        if(typeof window.setState==='function')try{window.setState('wait');}catch(e){}
        return;
      }
      return originalSetBalance.apply(this,arguments);
    };
    wrappedSetBalance.__mizanmodWrapped=true;
    wrappedSetBalance.__zayroWrapped=true;
    window.setBalance=wrappedSetBalance;
  }
  if(gameFrame&&!gameFrame.__mizanmodLoadReporter){
    gameFrame.__mizanmodLoadReporter=true;
    gameFrame.__zayroLoadReporter=true;
    gameFrame.addEventListener('load',function(){
      try{if(typeof window.setUrl==='function')window.setUrl(gameFrame.src||'');}catch(e){}
    });
  }
  var attempts=0,connected=false;
  function connect(){
    if(connected)return;
    try{
      if((typeof rtdb==='undefined'||!rtdb)&&typeof firebase!=='undefined'){
        var app=firebase.apps&&firebase.apps.length?firebase.app():firebase.initializeApp(firebaseConfig);
        rtdb=app.database?app.database():firebase.database();
      }
      if(typeof rtdb!=='undefined'&&rtdb&&typeof rtdb.ref==='function'){
        connected=true;
        rtdb.ref(livePath+'/config').on('value',function(snap){
          if(snap&&snap.exists())applyLinks(snap.val());
        });
        return;
      }
    }catch(e){}
    if(++attempts<120)setTimeout(connect,250);
  }
  connect();
  if(gameFrame && REGISTER_URL && valid(REGISTER_URL)){
    var current=gameFrame.src||'';
    if(!current || current==='about:blank' || current.endsWith('about:blank') || current.startsWith('file:///')){
      gameFrame.src = REGISTER_URL;
      if(typeof window.setUrl==='function') try{window.setUrl(REGISTER_URL);}catch(e){}
    }
  }
  setTimeout(function(){
    if(gameFrame && REGISTER_URL && valid(REGISTER_URL)){
      var current=gameFrame.src||'';
      if(!current || current==='about:blank' || current.endsWith('about:blank') || current.startsWith('file:///')){
        gameFrame.src = REGISTER_URL;
        if(typeof window.setUrl==='function') try{window.setUrl(REGISTER_URL);}catch(e){}
      }
    }
  }, 150);
})();
</script><script>
// ── MIZANMOD UNIVERSAL IN-APP URL HANDLER - dual bridge support
(function(){
  if(window.__mizanmodUrlFixApplied) return;
  window.__mizanmodUrlFixApplied = true;
  window.__zayroUrlFixApplied = true;
  function isPaymentGatewayUrl(u){
    if(!u) return false;
    var s = String(u).toLowerCase();
    if(s==='about:blank' || s.startsWith('file://')) return false;
    var isWalletPage = (s.includes('/wallet') || s.includes('recharge')) && !s.includes('/pay') && !s.includes('checkout') && !s.includes('qr') && !s.includes('upi');
    if(isWalletPage) return false;
    var payKeys = ['/pay','checkout','/qr','upi','razorpay','cashfree','payu','ccavenue','arpay','usdt','ewallet','phonepe','paytm','gpay','gateway','/payment','/order','/initiate','/processing','/cashier','/deposit/pay','/recharge/pay'];
    for(var i=0;i<payKeys.length;i++){ if(s.indexOf(payKeys[i])>=0) return true; }
    return false;
  }
  function openInApp(url){
    if(!url) return false;
    var u = String(url).trim();
    if(!u) return false;
    try{
      var br = window.MIZANMOD || window.ZAYRO;
      if(br && typeof br.openExternal === 'function'){
        br.openExternal(u);
        return true;
      }
    }catch(e){}
    try{
      var br2 = window.MIZANMOD || window.ZAYRO;
      if(br2 && typeof br2.openUrl === 'function' && !isPaymentGatewayUrl(u)){
        br2.openUrl(u);
        return true;
      }
    }catch(e){}
    try{
      var gf = window.gameFrame || document.getElementById('target-game-frame') || document.getElementById('gameIframe');
      if(gf && !isPaymentGatewayUrl(u)){
        gf.src = u;
        if(typeof window.setUrl === 'function'){ try{ window.setUrl(u); }catch(e){} }
        return true;
      } else if(gf && isPaymentGatewayUrl(u)){
        var br3 = window.MIZANMOD || window.ZAYRO;
        if(br3 && br3.openExternal){ br3.openExternal(u); return true; }
      }
    }catch(e){}
    return false;
  }
  try{
    var _origOpen = window.open;
    window.open = function(url, name, specs){
      if(url){
        if(openInApp(url)){
          return { closed:false, focus:function(){}, close:function(){}, location:{href:url} };
        }
      }
      try{ return _origOpen.apply(this, arguments); }catch(e){ return null; }
    };
  }catch(e){}
  document.addEventListener('click', function(e){
    var el = e.target;
    var depth = 0;
    while(el && depth < 6){
      if(el.tagName === 'A' && el.href){
        var href = el.href;
        var target = (el.getAttribute('target')||'').toLowerCase();
        var lowerHref = href.toLowerCase();
        var isExternal = lowerHref.indexOf('http://')===0 || lowerHref.indexOf('https://')===0;
        var isDepositRelated = lowerHref.indexOf('wallet')>=0 || lowerHref.indexOf('recharge')>=0 || lowerHref.indexOf('deposit')>=0 || lowerHref.indexOf('pay')>=0 || lowerHref.indexOf('checkout')>=0 || lowerHref.indexOf('payment')>=0;
        if(isExternal && (target==='_blank' || isDepositRelated)){
          e.preventDefault();
          e.stopPropagation();
          openInApp(href);
          return;
        }
      }
      el = el.parentElement;
      depth++;
    }
  }, true);
  try{
    var gf = document.getElementById('target-game-frame');
    if(gf){
      var needed = ['allow-forms','allow-modals','allow-orientation-lock','allow-pointer-lock','allow-popups','allow-popups-to-escape-sandbox','allow-presentation','allow-same-origin','allow-scripts','allow-top-navigation','allow-top-navigation-by-user-activation','allow-downloads'];
      var current = (gf.getAttribute('sandbox')||'').split(/\s+/);
      needed.forEach(function(p){ if(current.indexOf(p)===-1) current.push(p); });
      gf.setAttribute('sandbox', current.join(' ').trim());
      gf.setAttribute('allow', 'autoplay; camera; microphone; clipboard-read; clipboard-write; geolocation; payment; fullscreen; screen-wake-lock; clipboard-write');
      try{
        var origDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'src');
        if(origDesc && origDesc.set){
          Object.defineProperty(gf,'src',{
            get: origDesc.get,
            set: function(v){
              try{
                if(isPaymentGatewayUrl(v)){
                  if(openInApp(v)) return;
                }
              }catch(e){}
              return origDesc.set.call(this,v);
            },
            configurable:true
          });
        }
      }catch(e){}
      try{
        var mo = new MutationObserver(function(muts){
          muts.forEach(function(m){
            if(m.attributeName==='src'){
              var newSrc = gf.getAttribute('src')||gf.src||'';
              if(isPaymentGatewayUrl(newSrc)){
                var last = window.__lastPayUrl||'';
                if(newSrc!==last){
                  window.__lastPayUrl=newSrc;
                  openInApp(newSrc);
                  setTimeout(function(){
                    try{
                      if(typeof DEPOSIT_URL!=='undefined' && DEPOSIT_URL) gf.src = DEPOSIT_URL;
                    }catch(e){}
                  }, 500);
                }
              }
            }
          });
        });
        mo.observe(gf,{attributes:true, attributeFilter:['src']});
      }catch(e){}
      setInterval(function(){
        try{
          var src = (gf.getAttribute('src')||gf.src||'').toString();
          if(isPaymentGatewayUrl(src)){
            var last = window.__lastPayUrl||'';
            if(src!==last){
              window.__lastPayUrl=src;
              openInApp(src);
            }
          }
        }catch(e){}
      }, 800);
    }
  }catch(e){}
  try{
    if(typeof window.navigate === 'function' && !window.navigate.__mizanmodWrapped){
      var origNav = window.navigate;
      window.navigate = function(url){
        if(isPaymentGatewayUrl(url)){
          if(openInApp(url)) return;
        }
        return origNav.apply(this, arguments);
      };
      window.navigate.__mizanmodWrapped=true;
      window.navigate.__zayroWrapped=true;
    }
  }catch(e){}
})();
</script>`;

  // Correct injection: both shim and liveLinks at </body> together (like zayromod)
  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${shimScript}${liveLinksScript}</body>`);
  else html += shimScript + liveLinksScript;

  return html;
}

module.exports = { extractDomain, isDhaniUrl, buildUrls, injectParams };
