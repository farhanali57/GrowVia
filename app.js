/* ============================================================
   GrowVia — interactions
   ============================================================ */
(function () {
  "use strict";

  /* ---------- THEME ---------- */
  var root = document.documentElement;
  var saved = localStorage.getItem("growvia-theme");
  if (saved) root.setAttribute("data-theme", saved);
  else root.setAttribute("data-theme", "dark");

  function bindThemeToggle(btn) {
    btn.addEventListener("click", function () {
      var cur = root.getAttribute("data-theme");
      var next = cur === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("growvia-theme", next);
    });
  }
  document.querySelectorAll("[data-theme-toggle]").forEach(bindThemeToggle);

  /* ---------- DISCLAIMER (marquee) close ---------- */
  (function () {
    var mClose = document.getElementById("marqueeClose");
    if (!mClose) return;
    if (localStorage.getItem("growvia-notice") === "closed") {
      document.body.classList.add("marquee-closed");
    }
    mClose.addEventListener("click", function () {
      document.body.classList.add("marquee-closed");
      try { localStorage.setItem("growvia-notice", "closed"); } catch (e) {}
    });
  })();

  /* ---------- LOADER ---------- */
  var loader = document.getElementById("loader");
  var line = document.querySelector(".loader-line");
  var pct = document.querySelector(".loader-pct");
  var curtain = document.querySelector(".curtain");
  document.body.classList.add("is-loading");

  var DURATION = 2100;       // total loader time (ms)
  var loaderStart = null;
  var revealed = false;
  var rafId = null;

  function easeOut(t) { return 1 - Math.pow(1 - t, 2.4); }

  function frame(now) {
    if (loaderStart === null) loaderStart = now;
    var t = Math.min(1, (now - loaderStart) / DURATION);
    var p = Math.round(easeOut(t) * 100);
    if (line) line.style.width = p + "%";
    if (pct) pct.textContent = String(p).padStart(3, "0");
    if (t < 1) {
      rafId = requestAnimationFrame(frame);
    } else {
      setTimeout(reveal, 220);
    }
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (line) line.style.width = "100%";
    if (pct) pct.textContent = "100";
    // animate curtain panels open, then fade loader
    if (curtain) {
      var panels = curtain.querySelectorAll("span");
      panels.forEach(function (p, i) {
        p.style.transition = "transform 0.7s cubic-bezier(0.85,0,0.15,1)";
        p.style.transitionDelay = i * 0.05 + "s";
        p.style.transform = "scaleY(0)";
      });
    }
    if (loader) { loader.style.opacity = "0"; loader.style.transitionDelay = "0.2s"; }
    setTimeout(function () {
      if (loader) loader.style.display = "none";
      if (curtain) curtain.style.display = "none";
      document.body.classList.remove("is-loading");
      observeReveals(document);
    }, 950);
  }

  rafId = requestAnimationFrame(frame);
  // Hard caps so the loader can NEVER hang and hide content:
  setTimeout(reveal, DURATION + 1400);                       // wall-clock cap
  window.addEventListener("load", function () { setTimeout(reveal, 400); });

  /* ---------- NAV scrolled state ---------- */
  var nav = document.querySelector(".nav");
  function onScroll() {
    if (window.scrollY > 14) nav.classList.add("scrolled");
    else nav.classList.remove("scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- SCROLL REVEAL ---------- */
  var io;
  function showAll() {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
  }
  function observeReveals(scope) {
    if (!io) return;
    (scope || document).querySelectorAll(".reveal:not(.in)").forEach(function (el) { io.observe(el); });
  }
  function startReveals() {
    if (!("IntersectionObserver" in window)) { showAll(); return; }
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });
    observeReveals(document);
  }
  // Build the observer immediately so content is never gated behind the loader.
  startReveals();
  // Failsafe: no matter what happens with the loader/observer, reveal everything.
  setTimeout(showAll, 4200);
  window.addEventListener("load", function () { setTimeout(showAll, 1500); });

  /* ---------- ABOUT OVERLAY ---------- */
  var overlay = document.getElementById("aboutOverlay");
  function openAbout() {
    overlay.classList.add("open");
    document.body.classList.add("no-scroll");
    overlay.scrollTop = 0;
    // trigger reveals inside overlay
    observeReveals(overlay);
    setTimeout(function () { overlay.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); }); }, 700);
  }
  function closeAbout() {
    overlay.classList.remove("open");
    document.body.classList.remove("no-scroll");
  }
  document.querySelectorAll("[data-open-about]").forEach(function (b) { b.addEventListener("click", openAbout); });
  document.querySelectorAll("[data-close-about]").forEach(function (b) { b.addEventListener("click", closeAbout); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("open")) closeAbout();
  });

  /* ---------- FAQ ACCORDION ---------- */
  var faqList = document.getElementById("faqList");
  if (faqList) {
    faqList.addEventListener("click", function (e) {
      var q = e.target.closest(".faq-q");
      if (!q) return;
      var item = q.closest(".faq-item");
      if (!item) return;
      var a = item.querySelector(".faq-a");
      var isOpen = item.classList.contains("active");
      
      // Close all other items in this list
      faqList.querySelectorAll(".faq-item").forEach(function (sib) {
        sib.classList.remove("active");
        var sibA = sib.querySelector(".faq-a");
        if (sibA) sibA.style.maxHeight = null;
      });
      
      if (!isOpen) {
        item.classList.add("active");
        if (a) a.style.maxHeight = a.scrollHeight + "px";
      }
    });
  }

  /* ---------- ORDER FORM -> WHATSAPP ---------- */
  var form = document.getElementById("orderForm");
  var PHONE = "3143632195"; // default; overridden by config

  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }

  function flagError(el, bad) {
    if (bad) el.classList.add("field-error"); else el.classList.remove("field-error");
  }

  /* ---------- LIVE PRICING (PKR only) ---------- */
  // Rates are USD per 1,000 units (base) × platform multiplier.
  var USD_TO_PKR = 280;
  var ccy = "PKR";
  var BASE_RATE = {
    "Followers": 4.00,
    "Connections": 5.00,
    "Subscribers": 6.00,
    "Likes": 1.50,
    "Views": 0.80,
    "Comments": 8.00,
    "Shares": 3.00,
    "Reposts": 3.00,
    "Saves": 2.00,
    "Watch Hours": 12.00,
    "Reach": 1.00,
    "Other": 3.00
  };
  var PLATFORM_MULT = {
    "Instagram": 1.0, "Facebook": 1.1, "TikTok": 0.9, "YouTube": 1.6,
    "X (Twitter)": 1.2, "LinkedIn": 1.8, "Other": 1.2
  };

  var priceBox = document.getElementById("priceBox");
  var rateEl = document.getElementById("priceRate");
  var totalEl = document.getElementById("priceTotal");
  var altEl = document.getElementById("priceAlt");
  var priceHint = document.getElementById("priceHint");
  var navCcy = document.getElementById("navCcy");
  var priceCcyLabel = document.getElementById("priceCcyLabel");
  var orderCardOffer = document.getElementById("orderCardOffer");
  var testiTrack = document.getElementById("testiTrack");
  var faqList = document.getElementById("faqList");
  var siteLogoLink = document.getElementById("siteLogoLink");
  var siteLogoText = document.getElementById("logoText");
  var siteLogoMark = document.getElementById("logoMark");
  var siteTagline = document.getElementById("siteTagline");
  var overlayLogoText = document.getElementById("overlayLogoText");
  var overlayLogoMark = document.getElementById("overlayLogoMark");
  var appPricing = null;
  var customLogos = {};
  var appConfig = {
    allowSingleOrder: true,
    allowBulkOrder: true,
    offerActive: false,
    offerText: "",
    brandName: "GrowVia",
    brandTagline: "Your Growth. Our Mission.",
    logoImageUrl: "",
    offerStart: "",
    offerEnd: "",
    whatsappNumber: "3143632195"
  };

  function formatOfferDate(value) {
    var date = value ? new Date(value) : null;
    if (!date || isNaN(date.getTime())) return null;
    return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  var floatingOffer = document.getElementById("floatingOffer");
  var floatingOfferText = document.getElementById("floatingOfferText");
  var floatingOfferTimer = document.getElementById("floatingOfferTimer");
  var floatingOfferClose = document.getElementById("floatingOfferClose");
  var heroOfferCountdown = document.getElementById("heroOfferCountdown");
  var offerInterval = null;

  var _lastOfferKey = '';

  function updateOfferBanner() {
    var timerWrap = document.getElementById("floatingTimerWrap");

    if (offerInterval) clearInterval(offerInterval);

    if (!appConfig.offerActive) {
      if (floatingOffer) floatingOffer.classList.remove('pop-show');
      return;
    }

    var text = appConfig.offerText || 'Special offer is active now!';
    var offerKey = text + '|' + (appConfig.offerEnd || '');
    if (offerKey !== _lastOfferKey) {
      try { localStorage.removeItem("growvia-offer-closed"); } catch(e){}
      _lastOfferKey = offerKey;
    }

    var hideFloating = localStorage.getItem("growvia-offer-closed") === "true";

    if (floatingOffer && !hideFloating) {
      if (floatingOfferText) floatingOfferText.textContent = text;
      floatingOffer.classList.remove('pop-show');
      void floatingOffer.offsetWidth;
      setTimeout(function () { floatingOffer.classList.add('pop-show'); }, 800);
    }

    function tick() {
      if (!appConfig.offerEnd) {
        if (timerWrap) timerWrap.style.display = 'none';
        return;
      }
      var end  = new Date(appConfig.offerEnd).getTime();
      var dist = end - Date.now();
      if (dist < 0) {
        clearInterval(offerInterval);
        if (timerWrap) timerWrap.style.display = 'none';
        if (floatingOfferTimer) floatingOfferTimer.textContent = 'Ended';
        return;
      }
      if (timerWrap) timerWrap.style.display = 'flex';
      var d = Math.floor(dist / 86400000);
      var h = Math.floor((dist % 86400000) / 3600000);
      var m = Math.floor((dist % 3600000) / 60000);
      var s = Math.floor((dist % 60000) / 1000);
      var str = (d > 0 ? d + "d " : "") +
        String(h).padStart(2,'0') + ":" +
        String(m).padStart(2,'0') + ":" +
        String(s).padStart(2,'0');
      if (floatingOfferTimer)  floatingOfferTimer.textContent  = str;
      if (heroOfferCountdown)  heroOfferCountdown.textContent  = str;
    }
    tick();
    offerInterval = setInterval(tick, 1000);
  }

  if (floatingOfferClose) {
    floatingOfferClose.addEventListener('click', function() {
      if (floatingOffer) floatingOffer.classList.remove('pop-show');
      try { localStorage.setItem("growvia-offer-closed", "true"); } catch(e){}
    });
  }

  var floatingOfferCta = document.getElementById("floatingOfferCta");
  if (floatingOfferCta) {
    floatingOfferCta.addEventListener('click', function () {
      if (floatingOffer) floatingOffer.classList.remove('pop-show');
      try { localStorage.setItem("growvia-offer-closed", "true"); } catch(e){}
    });
  }

  function createTestimonialCard(item, hidden) {
    var card = document.createElement("div");
    card.className = "testi-card";
    if (hidden) card.setAttribute("aria-hidden", "true");

    var stars = document.createElement("div");
    stars.className = "testi-stars";
    stars.textContent = "★★★★★";

    var copy = document.createElement("p");
    copy.textContent = item.text || "";

    var who = document.createElement("div");
    who.className = "testi-who";
    var avatar = document.createElement("div");
    avatar.className = "testi-av";
    var img = document.createElement("img");
    img.src = item.image || "https://i.pravatar.cc/120?img=10";
    img.alt = item.name || "Testimonial";
    avatar.appendChild(img);
    var info = document.createElement("div");
    var name = document.createElement("b");
    name.textContent = item.name || "Anonymous";
    var role = document.createElement("span");
    role.textContent = item.role || "Customer";
    info.appendChild(name);
    info.appendChild(role);
    who.appendChild(avatar);
    who.appendChild(info);

    card.appendChild(stars);
    card.appendChild(copy);
    card.appendChild(who);
    return card;
  }

  function renderTestimonials(list) {
    if (!testiTrack) return;
    testiTrack.innerHTML = "";
    var visibleList = (list || []).filter(function(i) { return !i.hidden; });
    if (!visibleList.length) {
      testiTrack.appendChild(createTestimonialCard({ name: "No testimonials yet", role: "", text: "Testimonials will appear here once they are added from the admin panel.", image: "https://i.pravatar.cc/120?img=11" }, false));
      return;
    }
    visibleList.forEach(function (item) { testiTrack.appendChild(createTestimonialCard(item, false)); });
  }

  function renderFaqs(list) {
    if (!faqList) return;
    faqList.innerHTML = "";
    var visibleList = (list || []).filter(function(i) { return !i.hidden; });
    if (!visibleList.length) {
      faqList.innerHTML = '<div class="faq-item reveal in"><button class="faq-q">No FAQs available<span class="faq-icon"></span></button><div class="faq-a"><div class="faq-a__inner">Frequently asked questions will appear here once they are added in the admin panel.</div></div></div>';
      return;
    }
    visibleList.forEach(function (item) {
      var card = document.createElement("div");
      card.className = "faq-item reveal in";
      
      var btn = document.createElement("button");
      btn.className = "faq-q";
      btn.innerHTML = (item.question || "") + '<span class="faq-icon"></span>';
      
      var ansWrap = document.createElement("div");
      ansWrap.className = "faq-a";
      var ansInner = document.createElement("div");
      ansInner.className = "faq-a__inner";
      ansInner.textContent = item.answer || "";
      
      ansWrap.appendChild(ansInner);
      card.appendChild(btn);
      card.appendChild(ansWrap);
      faqList.appendChild(card);
    });
  }

  function applyConfigState() {
    updateOfferBanner();

    // ── Order mode toggle (only if form exists on this page) ──
    var modeToggle = document.getElementById("orderMode");
    if (modeToggle) {
      var singleBtn = modeToggle.querySelector('.seg-opt[data-mode="single"]');
      var bulkBtn   = modeToggle.querySelector('.seg-opt[data-mode="bulk"]');
      if (singleBtn) { singleBtn.style.display = appConfig.allowSingleOrder ? "inline-flex" : "none"; singleBtn.disabled = !appConfig.allowSingleOrder; }
      if (bulkBtn)   { bulkBtn.style.display   = appConfig.allowBulkOrder   ? "inline-flex" : "none"; bulkBtn.disabled   = !appConfig.allowBulkOrder;   }
      if (appConfig.allowSingleOrder && !appConfig.allowBulkOrder) setMode("single");
      if (!appConfig.allowSingleOrder && appConfig.allowBulkOrder) setMode("bulk");
      if (!appConfig.allowSingleOrder && !appConfig.allowBulkOrder) {
        modeToggle.style.display = "none";
        if (form && !form.querySelector('.order-paused-note')) {
          var notice = document.createElement('div');
          notice.className = 'form-note order-paused-note';
          notice.textContent = 'Ordering is temporarily paused. Please contact us on WhatsApp to place a request.';
          form.insertBefore(notice, form.firstChild);
        }
      }
    }

    var bName = appConfig.brandName || 'GrowVia';
    var bTag  = appConfig.brandTagline || 'Your Growth. Our Mission.';

    if (siteLogoText) { siteLogoText.textContent = bName; }
    if (siteLogoMark) { siteLogoMark.textContent = bName.charAt(0).toUpperCase(); }
    if (overlayLogoText) { overlayLogoText.textContent = bName; }
    if (overlayLogoMark) { overlayLogoMark.textContent = bName.charAt(0).toUpperCase(); }
    
    var favLink = document.getElementById('favicon');
    if (favLink && appConfig.logoImageUrl) {
      favLink.href = appConfig.logoImageUrl;
    }
    
    var aboutOverlayLogoText = document.getElementById("aboutOverlayLogoText");
    var aboutOverlayLogoMark = document.getElementById("aboutOverlayLogoMark");
    if (aboutOverlayLogoText) { aboutOverlayLogoText.textContent = bName; }
    if (aboutOverlayLogoMark) { aboutOverlayLogoMark.textContent = bName.charAt(0).toUpperCase(); }

    function updateLogoElement(linkEl, textEl, markEl, prefixId) {
      if (!linkEl) return;
      var logoImage = document.getElementById(prefixId + 'LogoImage');
      if (appConfig.logoImageUrl) {
        if (!logoImage) {
          logoImage = document.createElement('img');
          logoImage.id = prefixId + 'LogoImage';
          logoImage.className = 'logo__image';
          linkEl.insertBefore(logoImage, linkEl.firstChild);
        }
        logoImage.src = appConfig.logoImageUrl;
        logoImage.alt = bName;
        textEl && (textEl.style.display = 'none');
        markEl && (markEl.style.display = 'none');
        logoImage.style.display = 'inline-block';
      } else {
        if (logoImage) logoImage.style.display = 'none';
        textEl && (textEl.style.display = 'inline');
        markEl && (markEl.style.display = 'inline');
      }
    }

    updateLogoElement(siteLogoLink, siteLogoText, siteLogoMark, 'site');
    updateLogoElement(document.getElementById('overlayLogoLink'), overlayLogoText, overlayLogoMark, 'footer');
    updateLogoElement(document.getElementById('aboutOverlayLogoLink'), aboutOverlayLogoText, aboutOverlayLogoMark, 'aboutOverlay');

    if (siteLogoLink) siteLogoLink.setAttribute('aria-label', bName + ' home');
    var aboutOverlay = document.getElementById('aboutOverlay');
    if (aboutOverlay) aboutOverlay.setAttribute('aria-label', 'About ' + bName);
    
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', bName + ' — ethical, safe and professional social media growth services.');

    if (siteTagline) { siteTagline.textContent = bTag; }

    // ── Page <title>
    document.title = bName + ' — ' + bTag;

    // ── Footer big watermark
    var footerBig = document.getElementById('footerBrand');
    if (footerBig) footerBig.textContent = bName;

    // ── Footer copyright
    var copyEls = document.querySelectorAll('.footer__bottom span');
    if (copyEls && copyEls.length > 0) {
      copyEls[0].textContent = '© 2025 ' + bName + '. All Rights Reserved.';
    }
    // Overlay footer copyright
    var overlayCopy = document.querySelectorAll('.about-overlay .footer__bottom span');
    if (overlayCopy && overlayCopy.length > 0) {
      overlayCopy[0].textContent = '© 2025 ' + bName + '. All Rights Reserved. · ' + bTag;
    }

    // ── Footer tagline
    var footerTagLine = document.querySelector('.footer__tag');
    if (footerTagLine) {
      var parts = bTag.split('.');
      if (parts.length > 1) {
        footerTagLine.innerHTML = parts[0].trim() + '. <span>' + parts.slice(1).join('.').trim().replace(/^\./, '') + '</span>';
      } else {
        footerTagLine.textContent = bTag;
      }
    }

    // ── Loader mark (if still visible)
    var loaderMark = document.querySelector('.loader-mark');
    if (loaderMark) {
      if (appConfig.logoImageUrl) {
        var loaderImg = loaderMark.querySelector('img');
        if (!loaderImg) {
          loaderMark.innerHTML = '<img src="' + appConfig.logoImageUrl + '" alt="' + bName + '" />';
        } else {
          loaderImg.src = appConfig.logoImageUrl;
        }
      } else {
        var letters = bName.split('');
        var half = Math.ceil(letters.length / 2);
        loaderMark.innerHTML = letters.map(function(ch, i) {
          var delay = (0.05 + i * 0.06).toFixed(2);
          var cls = i >= half ? ' class="accent"' : '';
          return '<span' + cls + ' style="animation-delay:' + delay + 's">' + ch + '</span>';
        }).join('');
      }
    }

    // ── Generic data-brand-name placeholders
    document.querySelectorAll('[data-brand-name]').forEach(function(el) { el.textContent = bName; });

    // ── Theme colors
    document.documentElement.setAttribute('data-color', appConfig.themeColor || 'blue');

    // ── WhatsApp number — update all links dynamically
    if (appConfig.whatsappNumber) {
      PHONE = appConfig.whatsappNumber.replace(/\D/g, '');
      var waHref = 'https://wa.me/' + PHONE;
      ['waFloat', 'footerWaLink'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.href = waHref;
      });
    }

    // ── Store for WhatsApp message footer
    window._growviaBrandName    = bName;
    window._growviaBrandTagline = bTag;
  }

  var _fetchOpts = { cache: 'no-store' };

  function fetchBackendState() {
    if (!window.location.protocol.startsWith('http')) return;
    // Fetch config first — apply immediately, don't wait for others
    fetch('/api/config', _fetchOpts)
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(cfg) {
        if (cfg) { appConfig = Object.assign(appConfig, cfg); applyConfigState(); }
      })
      .catch(function(){});

    // Fetch optional data separately so config failure doesn't block them
    fetch('/api/testimonials', _fetchOpts).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){ if (d) renderTestimonials(d); }).catch(function(){});

    fetch('/api/faqs', _fetchOpts).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){ if (d) renderFaqs(d); }).catch(function(){});

    fetch('/api/platform-logos', _fetchOpts)
      .then(function(r){ return r.ok ? r.json() : {}; })
      .then(function(logos){
        customLogos = logos || {};
        return fetch('/api/pricing', _fetchOpts);
      })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){ if (d) { appPricing = d; syncPlatformsFromPricing(d); } }).catch(function(){});

    fetch('/api/payment-methods', _fetchOpts).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(methods){
        var bar  = document.getElementById('paymentMethodsBar');
        var list = document.getElementById('paymentMethodsList');
        if (!bar || !list || !methods || !methods.length) { if(bar) bar.style.display='none'; return; }
        list.innerHTML = methods.map(function(m){
          return '<span class="pay-method-chip">' + m.icon + ' ' + m.label + '</span>';
        }).join('');
        bar.style.display = 'flex';
      }).catch(function(){});
  }

  function fmtUSD(n) {
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtPKR(n) {
    return "₨" + Math.round(n).toLocaleString("en-US");
  }
  function fmt(n) { return fmtPKR(n); }
  function fmtAlt(n) { return fmtUSD(n); }

  var orderQuality = ""; // set when user selects from dropdown

  function computePriceFor(platform, service, qty, quality) {
    qty = Number(qty) || 0;
    if (!platform || !service || qty <= 0) return null;
    quality = quality || orderQuality || "organic";
    var pkrRate = 0;
    if (appPricing && appPricing[platform] && appPricing[platform][service] != null) {
      var svc = appPricing[platform][service];
      if (svc && typeof svc === 'object') {
        if (svc.organic !== undefined || svc.bot !== undefined) {
          pkrRate = quality === "bot" ? (svc.bot || 0) : (svc.organic || 0);
        } else {
          pkrRate = svc.pkr || Math.round((svc.usd || 0) * USD_TO_PKR);
        }
      } else {
        pkrRate = Math.round((Number(svc) || 0) * USD_TO_PKR);
      }
    } else {
      var base = BASE_RATE[service] != null ? BASE_RATE[service] : BASE_RATE["Other"];
      var mult = PLATFORM_MULT[platform] != null ? PLATFORM_MULT[platform] : PLATFORM_MULT["Other"];
      pkrRate = Math.round(base * mult * USD_TO_PKR);
      if (quality === "bot") pkrRate = Math.round(pkrRate * 0.5);
    }
    return { rate: pkrRate, total: (qty / 1000) * pkrRate, qty: qty };
  }

  function computePrice() {
    return computePriceFor(val("f_platform"), val("f_service"), parseFloat(val("f_qty")) || 0, orderQuality);
  }

  function updatePrice() {
    var p = computePrice();
    if (!p) { priceBox.classList.remove("show"); return; }
    priceBox.classList.add("show");
    rateEl.textContent = fmtPKR(p.rate) + " / 1,000";
    if (p.qty > 0) {
      totalEl.textContent = fmtPKR(p.total);
      altEl.textContent = "";
      priceHint.textContent = p.qty.toLocaleString("en-US") + " × " + val("f_service");
    } else {
      totalEl.textContent = "—";
      altEl.textContent = "";
      priceHint.textContent = "Enter a quantity";
    }
  }

  ["f_platform", "f_service", "f_qty"].forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener("input", updatePrice);
    el.addEventListener("change", updatePrice);
  });

  /* ---------- PLATFORM DROPDOWN (brand icons) + platform-aware services ---------- */
  /* ---------- DYNAMIC PLATFORM DROPDOWNS & BRAND ICONS ---------- */
  var PLATFORM_ICONS = {
    "instagram": '<svg viewBox="0 0 24 24"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="#E1306C" stroke-width="2"/><circle cx="12" cy="12" r="4.3" fill="none" stroke="#E1306C" stroke-width="2"/><circle cx="17.4" cy="6.6" r="1.3" fill="#E1306C"/></svg>',
    "facebook": '<svg viewBox="0 0 24 24"><path fill="#1877F2" d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.8 3.7-3.8 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.5V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/></svg>',
    "tiktok": '<svg viewBox="0 0 24 24"><path fill="#FE2C55" d="M16.6 3c.3 2 1.4 3.4 3.4 3.6v2.6c-1.1 0-2.3-.4-3.4-1v6.5c0 3.3-2.4 5.7-5.5 5.7A5.3 5.3 0 0 1 5.7 15c0-3.1 2.7-5.4 5.9-4.9v2.8c-.4-.1-.8-.2-1.2-.2-1.3 0-2.3 1-2.3 2.3 0 1.4 1 2.4 2.4 2.4 1.4 0 2.5-1.1 2.5-2.7V3h3.6z"/></svg>',
    "youtube": '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="4.5" fill="#FF0000"/><path d="M10 8.6l6 3.4-6 3.4z" fill="#fff"/></svg>',
    "x": '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17.5 3h3l-6.6 7.6L21.7 21h-6l-4.7-6-5.4 6h-3l7-8-7.3-10h6.1l4.2 5.6L17.5 3zm-1 16h1.7L7.6 4.9H5.8L16.5 19z"/></svg>',
    "twitter": '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17.5 3h3l-6.6 7.6L21.7 21h-6l-4.7-6-5.4 6h-3l7-8-7.3-10h6.1l4.2 5.6L17.5 3zm-1 16h1.7L7.6 4.9H5.8L16.5 19z"/></svg>',
    "x (twitter)": '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17.5 3h3l-6.6 7.6L21.7 21h-6l-4.7-6-5.4 6h-3l7-8-7.3-10h6.1l4.2 5.6L17.5 3zm-1 16h1.7L7.6 4.9H5.8L16.5 19z"/></svg>',
    "linkedin": '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="4.5" fill="#0A66C2"/><path fill="#fff" d="M7 9.4h2.3V18H7zM8.1 6.1A1.35 1.35 0 1 0 8.1 8.8 1.35 1.35 0 0 0 8.1 6.1zM11 9.4h2.2v1.2c.3-.6 1.1-1.3 2.4-1.3 2.1 0 2.6 1.3 2.6 3.2V18h-2.3v-3.9c0-1-.3-1.6-1.1-1.6-.9 0-1.4.6-1.4 1.6V18H11z"/></svg>',
    "snapchat": '<svg viewBox="0 0 24 24" fill="#FFFC00" style="filter:drop-shadow(0px 1px 1px rgba(0,0,0,0.35))"><path fill="#000" d="M12 2.75c-3.5 0-5.75 2.13-5.75 5.5 0 .28.08.76.13 1.04.05.28-.2.53-.4.33-.4-.4-1.15-.55-1.58-.15-.34.33-.28 1.05-.08 1.5.21.46.56.76.99.7.25-.03.35.25.17.43-.6.6-1.4.74-1.78 1.3-.28.43.08.97.58.82.4-.12.87-.28 1.22-.05.22.15.1.55-.1.74-.95.89-2.07 1.83-1.37 3.32.32.69 1.25.9 1.95.5.3-.17.47.1.33.39-.4 1 .1 1.7 1.2 1.5.42-.08.73-.24 1.07.08.35.34.05.9-.35 1.2-.67.5-.54 1.36.19 1.48.97.16 2.07-.35 3.03-.35s2.06.51 3.03.35c.73-.12.86-.98.19-1.48-.4-.3-.7-.86-.35-1.2.34-.32.65-.16 1.07-.08 1.1.2 1.6-.5 1.2-1.5-.14-.29.03-.56.33-.39.7.4 1.63.19 1.95-.5.7-1.49-.42-2.43-1.37-3.32-.2-.19-.32-.59-.1-.74.35-.23.82-.07 1.22.05.5.15.86-.39.58-.82-.38-.56-1.18-.7-1.78-1.3-.18-.18-.08-.46.17-.43.43.06.78-.24.99-.7.2-.45.26-1.17-.08-1.5-.43-.4-1.18-.25-1.58.15-.2.2-.45-.05-.4-.33.05-.28.13-.76.13-1.04 0-3.37-2.25-5.5-5.75-5.5z"/></svg>',
    "telegram": '<svg viewBox="0 0 24 24"><path fill="#229ED9" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.24-5.54 3.65-.52.36-1 .53-1.42.52-.47-.01-1.37-.27-2.03-.49-.82-.27-1.47-.41-1.42-.87.03-.24.36-.49.99-.74 3.89-1.69 6.48-2.8 7.78-3.32 3.71-1.5 4.48-1.76 4.98-1.77.11 0 .36.03.52.16.13.1.17.24.18.34z"/></svg>',
    "pinterest": '<svg viewBox="0 0 24 24"><path fill="#BD081C" d="M12 2a10 10 0 0 0-3.5 19.4c-.1-.9-.1-2.1.2-3l1.8-7.7s-.4-.9-.4-2.2c0-2 .9-3.5 2.4-3.5 1.1 0 1.7.9 1.7 1.9 0 1.2-.7 2.9-1.1 4.5-.3 1.3.6 2.4 2 2.4 2.4 0 4-3.1 4-6.8 0-2.8-1.9-4.9-5.3-4.9-3.9 0-6.4 2.9-6.4 6.2 0 1.1.3 2 1 2.8.1.1.1.2 0 .4l-.3 1.2c-.1.2-.2.2-.4.1-1.6-.7-2.3-2.7-2.3-4.9 0-4 3.4-8.8 10-8.8 5.3 0 9 3.8 9 8.2 0 5.4-3 9.4-7.4 9.4-1.5 0-2.8-.8-3.3-1.8l-.9 3.5c-.3 1.2-1 2.4-1.6 3.3a10 10 0 1 0 10.3-10.3z"/></svg>',
    "spotify": '<svg viewBox="0 0 24 24"><path fill="#1DB954" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.438-5.305-1.764-8.788-.97-.336.075-.668-.135-.744-.47-.077-.337.135-.668.47-.743 3.81-.87 7.077-.495 9.71 1.12.296.18.387.563.208.857zm1.225-2.72c-.226.367-.707.487-1.074.26-2.69-1.654-6.79-2.134-9.97-1.17-.413.125-.845-.107-.97-.52-.125-.413.107-.847.52-.972 3.637-1.104 8.16-.572 11.233 1.317.368.227.487.708.26 1.075zm.105-2.833C14.7 8.8 9.3 8.6 6.16 9.55c-.48.145-.98-.13-.125-.61c-.145-.48.13-.98.61-.125 3.62-1.1 9.56-.88 13.25 1.31c.43.256.57.81.31 1.24-.25.44-.81.58-1.24.32z"/></svg>',
    "twitch": '<svg viewBox="0 0 24 24"><path fill="#9146FF" d="M11.571 4.714h1.715v5.143H11.57zm3.858 0h1.714v5.143h-1.714zM4.714 2L2 4.714v14.572h5.143V22l2.714-2.714h3.857L22 11.571V2h-17.286zm15.572 8.714L16.57 14.286h-4.286l-2.714 2.714V14.286H5.571V3.714h14.715v7z"/></svg>',
    "discord": '<svg viewBox="0 0 24 24"><path fill="#5865F2" d="M19.27 4.73a16.14 16.14 0 0 0-4.07-1.25 12.24 12.24 0 0 0-.58 1.18 14.88 14.88 0 0 0-5.24 0 11.24 11.24 0 0 0-.59-1.18 16.17 16.17 0 0 0-4.07 1.25 16.27 16.27 0 0 0-2.6 12.33A16.19 16.19 0 0 0 6.94 21a11.94 11.94 0 0 0 1.13-1.84 10.42 10.42 0 0 1-1.79-.86c.15-.11.3-.22.44-.34a11.57 11.57 0 0 0 10.56 0c.14.12.29.23.44.34a10.23 10.23 0 0 1-1.79.86A13 13 0 0 0 17.06 19.16 11.94 11.94 0 0 0 18.19 21a16.19 16.19 0 0 0 4.88-2.68 16.27 16.27 0 0 0-2.6-12.33zM9.54 14.93c-.95 0-1.74-.87-1.74-1.94s.76-1.94 1.74-1.94c.99 0 1.76.87 1.74 1.94.02 1.07-.76 1.94-1.74 1.94zm6.05 0c-.95 0-1.74-.87-1.74-1.94s.76-1.94 1.74-1.94c.99 0 1.76.87 1.74 1.94.02 1.07-.75 1.94-1.74 1.94z"/></svg>',
    "reddit": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#FF4500"/><path fill="#fff" d="M16.67 11.47a1.68 1.68 0 0 0-2.68-1.28 9.3 9.3 0 0 0-3.69-.74l.79-2.52 2.18.47a1.09 1.09 0 1 0 .21-.43l-2.3-.49a.44.44 0 0 0-.5.33l-.86 2.7a9.14 9.14 0 0 0-3.67.75 1.68 1.68 0 0 0-1.75 2.7.46.46 0 0 0 .07.25 4.8 4.8 0 0 0 0 2.25.46.46 0 0 0-.07-.25 1.68 1.68 0 0 0 2.73 1.28c1 .88 2.45 1.41 4.09 1.41s3.09-.53 4.09-1.41a1.68 1.68 0 0 0 1.75-1.28.46.46 0 0 0-.07-.25 4.8 4.8 0 0 0 0-2.25.46.46 0 0 0 .07-.25zm-6.2 1.66a.82.82 0 1 1-.82-.82.82.82 0 0 1 .82.82zm4.7 0a.82.82 0 1 1-.82-.82.82.82 0 0 1 .82.82zm-3.17 2.65a2.22 2.22 0 0 1-1.57-.64.22.22 0 0 1 0-.3.22.22 0 0 1 .3 0 1.79 1.79 0 0 0 2.54 0 .22.22 0 0 1 .3 0 .22.22 0 0 1 0 .3 2.22 2.22 0 0 1-1.57.64z"/></svg>',
    "threads": '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12.8 2.5C7 2.5 3 6.3 3 12.1S7.4 21 12.4 21c2.4 0 4.6-.7 6-2l-1.3-1.5c-1.1 1-2.7 1.6-4.7 1.6-3.8 0-7.2-2.7-7.2-7.1 0-4.6 3.1-7.7 7.6-7.7 4.2 0 6.6 2.3 6.6 5.8 0 2.4-1.2 4.1-3 4.1-1 0-1.7-.6-1.7-1.8V9.1h-1.8v.5C12 8.3 10.7 7.7 9.4 7.7c-2.3 0-4.2 2-4.2 4.6 0 2.5 1.8 4.4 4.1 4.4 1.4 0 2.6-.7 3.3-2 1 .8 2.1 1.2 3.5 1.2 2.8 0 4.8-2.4 4.8-6.1 0-4.7-3.4-7.8-8.3-7.8zm-3.4 9.8c-1.3 0-2.4-1.1-2.4-2.7s1.1-2.7 2.4-2.7c1.3 0 2.3 1.1 2.3 2.7s-1 2.7-2.3 2.7z"/></svg>',
    "whatsapp": '<svg viewBox="0 0 24 24"><path fill="#25D366" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm4.52 14.03c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13s-.64.81-.78.97c-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31s-.86.85-.86 2.07c0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18z"/></svg>'
  };

  var DEFAULT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/></svg>';

  var PLATFORMS = [
    { name: "Instagram",
      icon: PLATFORM_ICONS["instagram"],
      services: ["Followers", "Likes", "Views", "Comments", "Shares", "Saves", "Reach"] },
    { name: "Facebook",
      icon: PLATFORM_ICONS["facebook"],
      services: ["Followers", "Likes", "Views", "Comments", "Shares", "Reach"] },
    { name: "TikTok",
      icon: PLATFORM_ICONS["tiktok"],
      services: ["Followers", "Likes", "Views", "Comments", "Shares", "Saves"] },
    { name: "YouTube",
      icon: PLATFORM_ICONS["youtube"],
      services: ["Subscribers", "Views", "Likes", "Comments", "Watch Hours", "Shares"] },
    { name: "X (Twitter)",
      icon: PLATFORM_ICONS["x (twitter)"],
      services: ["Followers", "Likes", "Views", "Reposts", "Comments"] },
    { name: "LinkedIn",
      icon: PLATFORM_ICONS["linkedin"],
      services: ["Followers", "Connections", "Likes", "Comments", "Shares"] }
  ];

  var pfSelect = document.getElementById("platformSelect");
  var pfBtn = document.getElementById("platformBtn");
  var pfPanel = document.getElementById("platformPanel");
  var pfInput = document.getElementById("f_platform");
  var pfCurrent = pfBtn.querySelector(".cselect__current");
  var serviceSel = document.getElementById("f_service");

  function initPlatformDropdowns() {
    if (pfPanel) {
      pfPanel.innerHTML = "";
      PLATFORMS.forEach(function (p) {
        var opt = document.createElement("button");
        opt.type = "button";
        opt.className = "cselect__opt";
        opt.setAttribute("role", "option");
        opt.dataset.name = p.name;
        opt.innerHTML = '<span class="pf-ico">' + p.icon + '</span><span>' + p.name + '</span>';
        opt.addEventListener("click", function () { selectPlatform(p.name); closePf(); });
        pfPanel.appendChild(opt);
      });
    }

    if (bPlatform) {
      bPlatform.innerHTML = '<option value="" disabled selected hidden>Platform</option>';
      PLATFORMS.forEach(function (p) {
        var o = document.createElement("option");
        o.value = p.name;
        o.textContent = p.name;
        bPlatform.appendChild(o);
      });
    }
  }

  function syncPlatformsFromPricing(pricingData) {
    if (!pricingData) return;
    var keys = Object.keys(pricingData);
    if (!keys.length) return;

    PLATFORMS = keys.map(function(key) {
      var lower = key.toLowerCase();
      var standardName = key;
      
      if (lower === 'x' || lower === 'twitter' || lower === 'x (twitter)') {
        standardName = 'X (Twitter)';
      } else if (lower === 'instagram') {
        standardName = 'Instagram';
      } else if (lower === 'facebook') {
        standardName = 'Facebook';
      } else if (lower === 'tiktok') {
        standardName = 'TikTok';
      } else if (lower === 'youtube') {
        standardName = 'YouTube';
      } else if (lower === 'linkedin') {
        standardName = 'LinkedIn';
      } else if (lower === 'snapchat') {
        standardName = 'Snapchat';
      } else if (lower === 'telegram') {
        standardName = 'Telegram';
      } else if (lower === 'pinterest') {
        standardName = 'Pinterest';
      } else if (lower === 'spotify') {
        standardName = 'Spotify';
      } else if (lower === 'twitch') {
        standardName = 'Twitch';
      } else if (lower === 'discord') {
        standardName = 'Discord';
      } else if (lower === 'reddit') {
        standardName = 'Reddit';
      } else if (lower === 'threads') {
        standardName = 'Threads';
      } else if (lower === 'whatsapp') {
        standardName = 'WhatsApp';
      }

      var iconSvg = '';
      if (customLogos && customLogos[lower]) {
        iconSvg = '<img src="' + customLogos[lower] + '" style="width:20px;height:20px;object-fit:contain;border-radius:4px;vertical-align:middle;" />';
      } else {
        iconSvg = PLATFORM_ICONS[lower] || PLATFORM_ICONS[standardName.toLowerCase()] || DEFAULT_ICON;
      }
      var services = Object.keys(pricingData[key]);

      return {
        name: standardName,
        icon: iconSvg,
        services: services
      };
    });

    initPlatformDropdowns();

    // Verify if currently selected platform still exists
    var currentPf = pfInput.value;
    if (currentPf) {
      var found = PLATFORMS.some(function(p) { return p.name === currentPf; });
      if (!found) {
        pfInput.value = "";
        pfCurrent.innerHTML = '<span class="cselect__ph">Select platform</span>';
        serviceSel.innerHTML = '<option value="" disabled selected hidden>Select platform first</option>';
        serviceSel.disabled = true;
        updatePrice();
      }
    }
  }

  // Initial call to build dropdowns
  initPlatformDropdowns();

  function platformByName(n) {
    for (var i = 0; i < PLATFORMS.length; i++) if (PLATFORMS[i].name === n) return PLATFORMS[i];
    return null;
  }

  /* ---------- HIDDEN LOGIN TRIGGER ---------- */
  (function(){
    var SECRET = 'gvia';
    var buf = '';
    function resetBuf() { buf = ''; }
    window.addEventListener('keydown', function(e){
      try {
        var k = e.key || '';
        if (k.length === 1) {
          buf += k.toLowerCase();
          if (buf.length > SECRET.length) buf = buf.slice(-SECRET.length);
          if (buf === SECRET) {
            // Redirect to login page when secret typed anywhere
            window.location.href = (window.location.origin ? '' : '') + 'login.html';
            resetBuf();
          }
        } else if (k === 'Escape') {
          resetBuf();
        }
      } catch (err) { /* ignore */ }
    }, false);
  })();

  function selectPlatform(name) {
    var p = platformByName(name);
    if (!p) return;
    pfInput.value = name;
    pfCurrent.innerHTML = '<span class="pf-ico">' + p.icon + '</span><span class="cselect__name">' + name + '</span>';
    pfBtn.classList.remove("field-error");
    // mark active option
    pfPanel.querySelectorAll(".cselect__opt").forEach(function (o) {
      o.classList.toggle("active", o.dataset.name === name);
    });
    // repopulate services for this platform
    serviceSel.innerHTML = '<option value="" disabled selected hidden>Select service</option>';
    p.services.forEach(function (s) {
      var o = document.createElement("option");
      o.textContent = s;
      serviceSel.appendChild(o);
    });
    serviceSel.disabled = false;
    serviceSel.value = "";
    serviceSel.classList.remove("field-error");
    updatePrice();
  }

  function openPf() { pfSelect.classList.add("open"); pfBtn.setAttribute("aria-expanded", "true"); }
  function closePf() { pfSelect.classList.remove("open"); pfBtn.setAttribute("aria-expanded", "false"); }
  pfBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (pfSelect.classList.contains("open")) closePf(); else openPf();
  });
  document.addEventListener("click", function (e) {
    if (!pfSelect.contains(e.target)) closePf();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closePf();
  });

  /* ---------- ORDER MODE (single / bulk) ---------- */
  var orderMode = "single";
  var modeToggle = document.getElementById("orderMode");
  var singleFields = document.getElementById("singleFields");
  var bulkFields = document.getElementById("bulkFields");
  var bPlatform = document.getElementById("b_platform");
  var bService = document.getElementById("b_service");
  var bQty = document.getElementById("b_qty");
  var bLink = document.getElementById("b_link");
  var bList = document.getElementById("b_list");
  var bulkAdd = document.getElementById("bulkAdd");
  var bulkCount = document.getElementById("bulkCount");
  var bPfIcon = document.getElementById("bPfIcon");
  var bulkPriceSummary = document.getElementById("bulkPriceSummary");
  var bulkTotalEl = document.getElementById("bulkTotal");
  var orderIdInput = document.getElementById("f_order_id");

  function setBulkPlatformIcon(name) {
    var p = platformByName(name);
    if (!bPfIcon) return;
    bPfIcon.innerHTML = p ? p.icon : "";
  }

  function parsePkrValue(text) {
    var m = text.match(/₨\s*([\d,]+)/);
    return m ? parseInt(m[1].replace(/,/g, ""), 10) : 0;
  }

  function computeBulkTotal() {
    return bList.value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean)
      .reduce(function (sum, line) { return sum + parsePkrValue(line); }, 0);
  }

  function updateBulkSummary() {
    if (!bulkTotalEl) return;
    var total = computeBulkTotal();
    bulkTotalEl.textContent = total ? fmtPKR(total) : "—";
    if (bulkPriceSummary) bulkPriceSummary.classList.toggle("show", total > 0);
  }

  function generateOrderId() {
    var now = new Date();
    var dd = String(now.getDate()).padStart(2, "0");
    var mm = String(now.getMonth() + 1).padStart(2, "0");
    var yy = String(now.getFullYear()).slice(-2);
    var suffix = String(Math.floor(Math.random() * 9000) + 1000);
    return "GRV-" + dd + mm + yy + "-" + suffix;
  }

  // Bulk platform dropdown is populated by initPlatformDropdowns() — no need to repeat here
  bPlatform.addEventListener("change", function () {
    var p = platformByName(bPlatform.value);
    bService.innerHTML = '<option value="" disabled selected hidden>Service</option>';
    if (p) {
      p.services.forEach(function (s) {
        var o = document.createElement("option");
        o.textContent = s;
        bService.appendChild(o);
      });
      bService.disabled = false;
    } else {
      bService.disabled = true;
    }
    bService.value = "";
    setBulkPlatformIcon(bPlatform.value);
  });

  function countItems() {
    var n = bList.value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean).length;
    bulkCount.textContent = n + (n === 1 ? " item in your order" : " items in your order");
    updateBulkSummary();
    return n;
  }
  bList.addEventListener("input", countItems);

  bulkAdd.addEventListener("click", function () {
    var miss = false;
    [bPlatform, bService, bQty, bLink].forEach(function (el) {
      var bad = !el.value.trim();
      el.classList.toggle("field-error", bad);
      if (bad) miss = true;
    });
    if (bLink.value.trim() && !isValidUrl(bLink.value)) {
      showLinkError(bLink, true);
      miss = true;
    }
    if (miss) return;

    var itemPrice = computePriceFor(bPlatform.value, bService.value, Number(bQty.value));
    var qty = Number(bQty.value).toLocaleString("en-US");
    var priceText = itemPrice ? fmtPKR(itemPrice.total) : "—";
    var line = bPlatform.value + " — " + bService.value + " — " + qty + " — " + bLink.value.trim() + " — " + priceText;
    bList.value += (bList.value.trim() ? "\n" : "") + line;
    countItems();
    updateBulkSummary();
    // keep platform/service for convenience, clear qty + link
    bQty.value = ""; bLink.value = "";
    bQty.focus();
  });

  function setMode(mode) {
    orderMode = mode;
    var bulk = mode === "bulk";
    modeToggle.classList.toggle("bulk", bulk);
    modeToggle.querySelectorAll(".seg-opt").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-mode") === mode);
    });
    singleFields.style.display = bulk ? "none" : "contents";
    bulkFields.style.display = bulk ? "flex" : "none";
    if (bulk) {
      priceBox.classList.remove("show");
      updateBulkSummary();
    } else {
      if (bulkPriceSummary) bulkPriceSummary.classList.remove("show");
      updatePrice();
    }
  }
  modeToggle.addEventListener("click", function (e) {
    var opt = e.target.closest(".seg-opt");
    if (opt) setMode(opt.getAttribute("data-mode"));
  });

  /* ── Quality dropdown (unselected by default) ── */
  var qualitySelect = document.getElementById("f_quality_select");
  var qualityInput  = document.getElementById("f_quality");
  var qualityNote   = document.getElementById("qualityNote");
  var QUALITY_NOTES = {
    organic: "⭐ <strong>Premium</strong> — Real, natural growth. Higher retention, slower delivery.",
    bot:     "🚀 <strong>Basic</strong> — Automated, fast delivery. Lower cost."
  };
  function setQuality(q) {
    orderQuality = q || "";
    if (qualityInput) qualityInput.value = orderQuality;
    if (qualityNote) {
      qualityNote.classList.toggle("show", !!q);
      qualityNote.innerHTML = q ? (QUALITY_NOTES[q] || "") : "";
    }
    updatePrice();
  }
  if (qualitySelect) {
    qualitySelect.addEventListener("change", function() { setQuality(qualitySelect.value); });
  }
  // start unselected
  orderQuality = "";

  function setCcy(c) {
    ccy = "PKR";
    document.querySelectorAll(".ccy-toggle .ccy-opt").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-ccy") === ccy);
    });
    if (priceCcyLabel) priceCcyLabel.textContent = ccy;
    try { localStorage.setItem("growvia-ccy", ccy); } catch (e) {}
    updatePrice();
  }

  // restore saved currency, then sync UI
  try { var savedCcy = localStorage.getItem("growvia-ccy"); if (savedCcy === "PKR") ccy = savedCcy; } catch (e) {}
  setCcy(ccy);
  fetchBackendState();

  // Re-apply config whenever user switches back to this tab
  document.addEventListener("visibilitychange", function() {
    if (document.visibilityState === "visible") fetchBackendState();
  });
  // Poll every 8 seconds for near real-time brand/theme/WA updates
  setInterval(function() {
    if (document.visibilityState === "visible") fetchBackendState();
  }, 8000);

  if (navCcy) {
    navCcy.addEventListener("click", function (e) {
      var opt = e.target.closest(".ccy-opt");
      if (!opt) return;
      setCcy(opt.getAttribute("data-ccy"));
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var ok = true;
    // shared required fields
    ["f_name", "f_whatsapp"].forEach(function (id) {
      var el = document.getElementById(id);
      var bad = !el.value.trim();
      flagError(el, bad);
      if (bad) ok = false;
    });
    // quality must be selected
    var qSel = document.getElementById("f_quality_select");
    if (qSel && !qSel.value) {
      flagError(qSel, true);
      ok = false;
    }

    if (orderMode === "single") {
      ["f_platform", "f_service", "f_qty", "f_link"].forEach(function (id) {
        var el = document.getElementById(id);
        var bad = !el.value.trim();
        var target = (id === "f_platform") ? document.getElementById("platformBtn") : el;
        flagError(target, bad);
        if (bad) ok = false;
      });
      // Extra: validate URL format
      var linkEl = document.getElementById("f_link");
      if (linkEl && linkEl.value.trim() && !isValidUrl(linkEl.value)) {
        showLinkError(linkEl, true);
        ok = false;
      }
    } else {
      var bad = countItems() < 1;
      bList.classList.toggle("field-error", bad);
      if (bad) ok = false;
    }

    if (!ok) {
      var first = form.querySelector(".field-error");
      if (first && first.focus) first.focus();
      return;
    }

    var orderId = generateOrderId();
    if (orderIdInput) orderIdInput.value = orderId;

    var notes = val("f_notes");
    var _bn = window._growviaBrandName || 'GrowVia';

    var singlePrice = null;
    var bulkTotalVal = 0;
    if (orderMode === "single") {
      singlePrice = computePrice();
    } else {
      var items = bList.value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
      bulkTotalVal = items.reduce(function (sum, it) { return sum + parsePkrValue(it); }, 0);
    }

    var waLines = [
      "Hi! I have placed an order on " + _bn + ".",
      "",
      "🔖 *Order ID:* " + orderId,
      "",
      "Please process my order. Thank you! 🙏"
    ];
    var msg = encodeURIComponent(waLines.join("\n"));
    var url = "https://wa.me/" + PHONE + "?text=" + msg;

    // brief success state on the button
    var btn = form.querySelector(".submit-btn");
    var label = btn.querySelector(".submit-label");
    var old = label.textContent;
    label.textContent = "Submitting Order…";

    // Build structured order payload
    var orderPayload = {
      id: orderId,
      name: val("f_name"),
      whatsapp: val("f_whatsapp"),
      mode: orderMode,
      quality: (document.getElementById("f_quality_select") ? document.getElementById("f_quality_select").value : orderQuality) || "organic",
      platform: orderMode === "single" ? val("f_platform") : "",
      service: orderMode === "single" ? val("f_service") : "",
      qty: orderMode === "single" ? val("f_qty") : "",
      link: orderMode === "single" ? val("f_link") : "",
      notes: notes,
      bulkText: orderMode === "bulk" ? bList.value.trim() : "",
      totalPrice: orderMode === "single" ? (singlePrice ? fmtPKR(singlePrice.total) : "—") : fmtPKR(bulkTotalVal)
    };

    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    })
    .then(function (res) { return res.ok ? res.json() : Promise.reject(); })
    .then(function () {
      label.textContent = old;
      
      // Clear form
      form.reset();
      setQuality("");
      if (orderMode === "bulk") {
        bList.value = "";
        countItems();
      }
      
      // Open Success Overlay and configure WhatsApp link
      var successOverlay = document.getElementById("orderSuccessOverlay");
      var successOrderId = document.getElementById("successOrderId");
      var successWaBtn = successOverlay ? successOverlay.querySelector(".success-wa-btn") : null;
      
      if (successOrderId) successOrderId.textContent = "Order ID: " + orderId;
      if (successWaBtn) successWaBtn.href = url;
      if (successOverlay) successOverlay.classList.add("show");
    })
    .catch(function () {
      label.textContent = old;
      // Fail-safe: if backend fails, just open WhatsApp directly
      window.open(url, "_blank");
    });
  });

  // Bind close action for Success Overlay
  var successNewOrderBtn = document.getElementById("successNewOrderBtn");
  var orderSuccessOverlay = document.getElementById("orderSuccessOverlay");
  if (successNewOrderBtn && orderSuccessOverlay) {
    successNewOrderBtn.addEventListener("click", function () {
      orderSuccessOverlay.classList.remove("show");
    });
  }

  // clear error styling on input
  form.querySelectorAll(".control").forEach(function (el) {
    el.addEventListener("input", function () { el.classList.remove("field-error"); });
    el.addEventListener("change", function () { el.classList.remove("field-error"); });
  });

  /* ---------- LINK VALIDATION ---------- */
  function isValidUrl(str) {
    if (!str || !str.trim()) return false;
    try {
      var u = new URL(str.trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) { return false; }
  }

  function showLinkError(inputEl, show) {
    inputEl.classList.toggle("field-error", show);
    var errEl = inputEl.parentElement.querySelector(".link-error-msg");
    if (!errEl) {
      errEl = document.createElement("span");
      errEl.className = "link-error-msg";
      errEl.textContent = "Please enter a valid link (must start with https:// or http://)";
      inputEl.parentElement.appendChild(errEl);
    }
    errEl.classList.toggle("show", show);
  }

  var fLink = document.getElementById("f_link");
  var bLink = document.getElementById("b_link");
  if (fLink) {
    fLink.addEventListener("blur", function () {
      if (fLink.value.trim()) showLinkError(fLink, !isValidUrl(fLink.value));
    });
    fLink.addEventListener("input", function () {
      if (fLink.classList.contains("field-error")) showLinkError(fLink, !isValidUrl(fLink.value));
    });
  }
  if (bLink) {
    bLink.addEventListener("blur", function () {
      if (bLink.value.trim()) showLinkError(bLink, !isValidUrl(bLink.value));
    });
    bLink.addEventListener("input", function () {
      if (bLink.classList.contains("field-error")) showLinkError(bLink, !isValidUrl(bLink.value));
    });
  }

  /* ---------- PRICING LIST MODAL ---------- */
  var pricingModal     = document.getElementById("pricingModal");
  var pricingListBtn   = document.getElementById("pricingListBtn");
  var pricingModalClose = document.getElementById("pricingModalClose");
  var pricingModalBody = document.getElementById("pricingModalBody");

  // PM_ICONS is now dynamically resolved via PLATFORM_ICONS dictionary
  function getPmIcon(platformName) {
    var lower = (platformName || '').toLowerCase();
    if (customLogos && customLogos[lower]) {
      return '<img src="' + customLogos[lower] + '" style="width:18px;height:18px;object-fit:contain;border-radius:4px;vertical-align:middle;margin-right:8px;" />';
    }
    var svg = PLATFORM_ICONS[lower] || DEFAULT_ICON;
    // Ensure it renders at 18x18 in the pricing modal header
    return svg.replace('<svg ', '<svg width="18" height="18" ');
  }

  function openPricingModal() {
    if (!pricingModal) return;
    pricingModal.classList.add('open');
    pricingModal.scrollTop = 0;
    document.body.classList.add('no-scroll');
    if (!appPricing) {
      pricingModalBody.innerHTML = '<div class="pricing-modal__loading">No pricing data available yet.</div>';
      return;
    }
    pricingModalBody.innerHTML = '';
    Object.keys(appPricing).forEach(function (platform) {
      var services = appPricing[platform] || {};
      if (!Object.keys(services).length) return;
      var section = document.createElement('div');
      section.className = 'pm-platform';
      // Platform header row
      var hdr = document.createElement('div');
      hdr.className = 'pm-platform__name';
      hdr.innerHTML = getPmIcon(platform) + '<span>' + platform + '</span>';
      section.appendChild(hdr);
      // Column headers
      var colHdr = document.createElement('div');
      colHdr.style.cssText = 'display:grid;grid-template-columns:1fr 120px 120px 60px;gap:6px;padding:4px 14px;margin-bottom:2px;';
      colHdr.innerHTML = '<span style="font-size:10px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:0.06em;">Service</span>' +
        '<span style="font-size:10px;font-weight:800;color:#ffd066;text-align:right;">⭐ Premium</span>' +
        '<span style="font-size:10px;font-weight:800;color:#9aa6ff;text-align:right;">🚀 Basic</span>' +
        '<span style="font-size:10px;font-weight:700;color:var(--text-3);text-align:right;">per</span>';
      section.appendChild(colHdr);
      // Service rows
      var list = document.createElement('div');
      list.style.cssText = 'display:flex;flex-direction:column;gap:1px;border:1px solid var(--border);border-radius:12px;overflow:hidden;';
      Object.keys(services).forEach(function (service, idx) {
        var svc = services[service];
        var organicVal = 0, botVal = 0;
        if (svc && typeof svc === 'object') {
          organicVal = svc.organic !== undefined ? svc.organic : (svc.pkr || 0);
          botVal     = svc.bot     !== undefined ? svc.bot     : Math.round((svc.pkr||0)*0.5);
        } else { organicVal = Math.round((Number(svc)||0)*USD_TO_PKR); botVal = Math.round(organicVal*0.5); }
        var row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:1fr 120px 120px 60px;gap:6px;align-items:center;padding:11px 14px;cursor:pointer;transition:background 0.15s;background:var(--surface);';
        row.innerHTML =
          '<span style="font-size:14px;font-weight:600;color:var(--text);">' + service + '</span>' +
          '<span style="font-size:15px;font-weight:800;color:#ffd066;text-align:right;">₨' + Math.round(organicVal).toLocaleString('en-US') + '</span>' +
          '<span style="font-size:15px;font-weight:800;color:#9aa6ff;text-align:right;">₨' + Math.round(botVal).toLocaleString('en-US') + '</span>' +
          '<span style="font-size:11px;color:var(--text-3);text-align:right;">1,000</span>';
        row.addEventListener('mouseenter', function(){ row.style.background='var(--surface-2)'; });
        row.addEventListener('mouseleave', function(){ row.style.background='var(--surface)'; });
        row.addEventListener('click', function() {
          closePricingOverlay();
          var sec = document.getElementById('order');
          if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(function() {
            selectPlatform(platform);
            var svcSel = document.getElementById('f_service');
            if (svcSel) { svcSel.value = service; svcSel.dispatchEvent(new Event('change')); }
            var qtyEl = document.getElementById('f_qty');
            if (qtyEl) { qtyEl.focus(); qtyEl.select(); }
            updatePrice();
          }, 400);
        });
        list.appendChild(row);
      });
      section.appendChild(list);
      pricingModalBody.appendChild(section);
    });
  }
  function closePricingOverlay() {
    if (pricingModal) pricingModal.classList.remove("open");
    document.body.classList.remove("no-scroll");
  }

  if (pricingListBtn) pricingListBtn.addEventListener("click", openPricingModal);
  if (pricingModalClose) pricingModalClose.addEventListener("click", closePricingOverlay);
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && pricingModal && pricingModal.classList.contains("open")) closePricingOverlay();
  });

  /* ---------- hero background video (streams from CDN, CORS-gated for clean console) ---------- */
  (function () {
    var vwrap = document.getElementById("heroVideoWrap");
    var v = document.getElementById("heroVideo");
    if (!vwrap || !v) return;
    var list = (vwrap.getAttribute("data-video-srcs") || "").split("|").filter(Boolean);
    if (!list.length) return;

    function attach(url) {
      v.src = url;
      v.load();
      v.addEventListener("loadeddata", function () { vwrap.classList.add("is-ready"); });
      v.addEventListener("canplay", function () { vwrap.classList.add("is-ready"); });
      var p = v.play && v.play();
      if (p && p.catch) p.catch(function () {});
    }

    // Probe each source first so a blocked/missing file never throws a media error.
    // A reachable source returns ok (200/206); we attach the first that does.
    (function probe(i) {
      if (i >= list.length) return; // none reachable — gradient ambiance stays
      fetch(list[i], { method: "GET", mode: "cors", headers: { Range: "bytes=0-1" } })
        .then(function (res) {
          if (res.ok) attach(list[i]);
          else probe(i + 1);
        })
        .catch(function () { probe(i + 1); });
    })(0);
  })();

  /* ---------- subtle parallax on hero glow ---------- */
  var glow = document.querySelector(".hero__glow");
  if (glow && window.matchMedia("(min-width: 760px)").matches) {
    window.addEventListener("scroll", function () {
      var y = window.scrollY;
      if (y < 900) glow.style.transform = "translateX(-50%) translateY(" + y * 0.18 + "px)";
    }, { passive: true });
  }
})();
