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
      if (typeof window.applyBrandLogos === 'function') window.applyBrandLogos();
    });
  }
  document.querySelectorAll("[data-theme-toggle]").forEach(bindThemeToggle);

  /* ---------- HAMBURGER / MOBILE NAV ---------- */
  (function() {
    var btn  = document.getElementById("navHamburger");
    var menu = document.getElementById("navActions");
    if (!btn || !menu) return;

    // Inject scrim once
    var scrim = document.createElement("div");
    scrim.className = "nav-scrim";
    document.body.appendChild(scrim);

    function closeMenu() {
      btn.classList.remove("open");
      menu.classList.remove("open");
      scrim.classList.remove("show");
      btn.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    }
    function toggleMenu() {
      var willOpen = !menu.classList.contains("open");
      btn.classList.toggle("open", willOpen);
      menu.classList.toggle("open", willOpen);
      scrim.classList.toggle("show", willOpen);
      btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
      document.body.classList.toggle("nav-open", willOpen);
    }
    btn.addEventListener("click", function(e){ e.stopPropagation(); toggleMenu(); });
    scrim.addEventListener("click", closeMenu);
    // Close when clicking any action inside the menu
    menu.addEventListener("click", function(e) {
      var hit = e.target.closest("a, .nav-pricing-btn, .nav-track-btn, .btn-about");
      if (hit) closeMenu();
    });
    window.addEventListener("resize", function() {
      if (window.innerWidth > 860) closeMenu();
    });
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape") closeMenu();
    });
  })();

  /* ---------- THEME-AWARE LOGO URL ---------- */
  window.getThemeLogoUrl = function () {
    var theme = root.getAttribute("data-theme") || "dark";
    return theme === "light" ? "Logo.png?v=3" : "White%20Logo.png?v=3";
  };

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

  /* ---------- HELP OVERLAY ---------- */
  (function() {
    var help = document.getElementById("helpOverlay");
    var btn  = document.getElementById("helpFloat");
    var closeBtn = document.getElementById("helpClose");
    if (!help) return;
    function open() {
      help.classList.add("show");
      document.body.classList.add("no-scroll");
      help.scrollTop = 0;
      observeReveals(help);
      setTimeout(function() { help.querySelectorAll(".reveal").forEach(function(el){ el.classList.add("in"); }); }, 350);
    }
    function close() {
      help.classList.remove("show");
      document.body.classList.remove("no-scroll");
    }
    if (btn) btn.addEventListener("click", open);
    if (closeBtn) closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && help.classList.contains("show")) close();
    });
  })();

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

  // Normalize Pakistani phone numbers to +92XXXXXXXXXX
  // Accepts: 0312..., 312..., 92312..., +92312..., with spaces/dashes
  function normalizePkPhone(raw) {
    var digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.indexOf("0092") === 0) digits = digits.slice(4);
    else if (digits.indexOf("92") === 0) digits = digits.slice(2);
    else if (digits.charAt(0) === "0") digits = digits.slice(1);
    return "+92" + digits;
  }

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
    allowPromoCode: false,
    offerActive: false,
    offerText: "",
    brandName: "GrowVia",
    brandTagline: "Your Growth. Our Mission.",
    logoImageUrl: "",
    offerStart: "",
    offerEnd: "",
    whatsappNumber: "3143632195",
    heroStats: [
      { number: '12M+',  label: 'Engagements delivered', visible: true },
      { number: '40k+',  label: 'Orders completed',      visible: true },
      { number: '4.9/5', label: 'Average rating',        visible: true }
    ],
    help: { enabled: true },
    chatbot: { enabled: true, welcomeMessage: '', customQA: [] }
  };

  // Render hero stats from config
  function renderHeroStats() {
    var stats = Array.isArray(appConfig.heroStats) ? appConfig.heroStats : [];
    document.querySelectorAll('#heroStats .stat').forEach(function(el, i) {
      var s = stats[i];
      if (!s) { el.style.display = 'none'; return; }
      el.style.display = s.visible ? '' : 'none';
      // Smart split: digits stay big, rest goes in <span>
      var num = String(s.number || '').trim();
      var m = num.match(/^([\d.,]+)(.*)$/);
      var numEl = el.querySelector('[data-stat-num]');
      var labelEl = el.querySelector('[data-stat-label]');
      if (numEl) {
        if (m && m[2]) numEl.innerHTML = m[1] + '<span>' + m[2] + '</span>';
        else numEl.textContent = num;
      }
      if (labelEl) labelEl.textContent = s.label || '';
    });
  }

  // Render help overlay content from config
  function renderHelpContent() {
    var h = appConfig.help || {};
    var btn = document.getElementById('helpFloat');
    if (btn) btn.style.display = (h.enabled === false) ? 'none' : '';

    function set(id, val) { var el = document.getElementById(id); if (el && val !== undefined) el.textContent = val; }
    set('helpTitle',          h.title);
    set('helpIntro',          h.intro);
    set('helpFillTitle',      h.fillTitle);
    set('helpFillBody',       h.fillBody);
    set('helpProblemTitle',   h.problemTitle);
    set('helpProblemBody',    h.problemBody);
    set('helpMarketingTitle', h.marketingTitle);
    set('helpMarketingBody',  h.marketingBody);

    // Wire WhatsApp CTAs in help cards
    var wa = (appConfig.whatsappNumber || '3143632195').replace(/\D/g, '');
    var problemMsg   = encodeURIComponent('Hi! I am facing an issue and need help with my order on ' + (appConfig.brandName || 'GrowVia') + '.');
    var marketingMsg = encodeURIComponent('Hi! I am interested in discussing a proper marketing campaign with ' + (appConfig.brandName || 'GrowVia') + '.');
    var p = document.getElementById('helpProblemWa');
    var m = document.getElementById('helpMarketingWa');
    if (p) p.href = 'https://wa.me/' + wa + '?text=' + problemMsg;
    if (m) m.href = 'https://wa.me/' + wa + '?text=' + marketingMsg;
  }

  // Show promo row only when admin allows AND pricing has been computed
  function updatePromoRowVisibility() {
    var row = document.getElementById('promoRow');
    if (!row) return;
    if (!appConfig.allowPromoCode) {
      row.style.display = 'none';
      return;
    }
    var hasPrice = false;
    if (typeof orderMode !== 'undefined' && orderMode === 'bulk') {
      hasPrice = !!(typeof bulkItems !== 'undefined' && bulkItems && bulkItems.length > 0);
    } else if (typeof computePrice === 'function') {
      var p = computePrice();
      hasPrice = !!(p && p.total > 0);
    }
    row.style.display = hasPrice ? '' : 'none';
  }

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
  var _offerShownThisSession = false;
  var _lastPromoCode = '';

  function refreshOfferPromo(code) {
    var wrap   = document.getElementById('floatingOfferPromo');
    var codeEl = document.getElementById('floatingOfferCodeText');
    var btn    = document.getElementById('floatingOfferCode');
    var meta   = document.getElementById('floatingOfferCodeMeta');
    if (!wrap || !codeEl || !btn || !meta) return;
    code = String(code || '').trim().toUpperCase();
    if (!code) { wrap.style.display = 'none'; _lastPromoCode = ''; return; }
    fetch('/api/promos/validate/' + encodeURIComponent(code), { cache: 'no-store' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(p) {
        if (!p || !p.valid) { wrap.style.display = 'none'; return; }
        wrap.style.display = '';
        codeEl.textContent = p.code;
        btn.classList.remove('copied');

        var rows = [];
        var discount = p.type === 'percent' ? (p.value + '% off') : ('₨' + Number(p.value).toLocaleString() + ' off');
        rows.push(
          '<div class="floating-offer__promo-meta-row discount">' +
            '<span class="floating-offer__promo-meta-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg></span>' +
            '<span><strong>' + discount + '</strong></span>' +
          '</div>'
        );
        if (p.usesLeft !== null && p.usesLeft !== undefined) {
          rows.push(
            '<div class="floating-offer__promo-meta-row uses">' +
              '<span class="floating-offer__promo-meta-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3"/></svg></span>' +
              '<span><strong>' + p.usesLeft + '</strong> uses left</span>' +
            '</div>'
          );
        } else {
          rows.push(
            '<div class="floating-offer__promo-meta-row uses">' +
              '<span class="floating-offer__promo-meta-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="10"/></svg></span>' +
              '<span>Unlimited uses</span>' +
            '</div>'
          );
        }
        if (p.expiry) {
          var exp = new Date(p.expiry);
          if (!isNaN(exp.getTime())) {
            var when = exp.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
            rows.push(
              '<div class="floating-offer__promo-meta-row expiry">' +
                '<span class="floating-offer__promo-meta-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>' +
                '<span>Valid until <strong>' + when + '</strong></span>' +
              '</div>'
            );
          }
        }
        meta.innerHTML = rows.join('');

        if (_lastPromoCode !== p.code) {
          _lastPromoCode = p.code;
          btn.onclick = function() {
            navigator.clipboard.writeText(p.code).then(function() {
              btn.classList.add('copied');
              var prev = codeEl.textContent;
              codeEl.textContent = 'Copied ✓';
              setTimeout(function() {
                codeEl.textContent = prev;
                btn.classList.remove('copied');
              }, 1400);
            }).catch(function(){});
          };
        }
      })
      .catch(function() { wrap.style.display = 'none'; });
  }

  function updateOfferBanner() {
    var timerWrap = document.getElementById("floatingTimerWrap");

    if (offerInterval) clearInterval(offerInterval);

    if (!appConfig.offerActive) {
      if (floatingOffer) floatingOffer.classList.remove('pop-show');
      return;
    }

    var text = appConfig.offerText || 'Special offer is active now!';
    var offerKey = text + '|' + (appConfig.offerEnd || '');
    // Only reset the "closed" flag when the offer content actually changes
    if (offerKey !== _lastOfferKey) {
      try { localStorage.removeItem("growvia-offer-closed"); } catch(e){}
      _lastOfferKey = offerKey;
      _offerShownThisSession = false;
    }

    var userClosed = localStorage.getItem("growvia-offer-closed") === "true";

    // Always refresh banner text in case offer was edited
    if (floatingOfferText) floatingOfferText.textContent = text;

    // Attached promo code (if any)
    refreshOfferPromo(appConfig.offerPromoCode);

    // Pop the banner exactly once per session (or until offer text changes).
    // Once user dismisses, never re-show until the offer itself changes.
    if (floatingOffer && !userClosed && !_offerShownThisSession) {
      _offerShownThisSession = true;
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

    var aboutOverlayLogoText = document.getElementById("aboutOverlayLogoText");
    var aboutOverlayLogoMark = document.getElementById("aboutOverlayLogoMark");
    if (aboutOverlayLogoText) { aboutOverlayLogoText.textContent = bName; }
    if (aboutOverlayLogoMark) { aboutOverlayLogoMark.textContent = bName.charAt(0).toUpperCase(); }

    var activeLogoUrl = appConfig.logoImageUrl || (typeof window.getThemeLogoUrl === 'function' ? window.getThemeLogoUrl() : '');

    function updateLogoElement(linkEl, textEl, markEl, prefixId) {
      if (!linkEl) return;
      var logoImage = document.getElementById(prefixId + 'LogoImage');
      if (activeLogoUrl) {
        if (!logoImage) {
          logoImage = document.createElement('img');
          logoImage.id = prefixId + 'LogoImage';
          logoImage.className = 'logo__image';
          linkEl.insertBefore(logoImage, linkEl.firstChild);
        }
        logoImage.src = activeLogoUrl;
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
      copyEls[0].textContent = '© 2026 ' + bName + '. All Rights Reserved.';
    }
    // Overlay footer copyright
    var overlayCopy = document.querySelectorAll('.about-overlay .footer__bottom span');
    if (overlayCopy && overlayCopy.length > 0) {
      overlayCopy[0].textContent = '© 2026 ' + bName + '. All Rights Reserved. · ' + bTag;
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
      if (activeLogoUrl) {
        var loaderImg = loaderMark.querySelector('img');
        if (!loaderImg) {
          loaderMark.innerHTML = '<img src="' + activeLogoUrl + '" alt="' + bName + '" />';
        } else {
          loaderImg.src = activeLogoUrl;
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

    // Re-evaluate promo row visibility with the latest allowPromoCode flag
    if (typeof updatePromoRowVisibility === 'function') updatePromoRowVisibility();

    // Hero stats + help content (admin-controlled)
    renderHeroStats();
    renderHelpContent();
  }

  // Expose for theme-toggle reactive re-apply
  window.applyBrandLogos = applyConfigState;

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

  /* ── Promo state ── */
  var appliedPromo = null; // { code, type, value }
  function computeDiscount(subtotal) {
    if (!appliedPromo || !subtotal) return 0;
    if (appliedPromo.type === 'percent') return Math.round(subtotal * (Number(appliedPromo.value) || 0) / 100);
    return Math.min(subtotal, Math.round(Number(appliedPromo.value) || 0));
  }

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
      var subtotal = p.total;
      var discount = computeDiscount(subtotal);
      if (discount > 0) {
        totalEl.textContent = fmtPKR(subtotal - discount);
        altEl.textContent = '−' + fmtPKR(discount) + ' off';
        altEl.style.color = '#19b591';
      } else {
        totalEl.textContent = fmtPKR(subtotal);
        altEl.textContent = "";
        altEl.style.color = "";
      }
      priceHint.textContent = p.qty.toLocaleString("en-US") + " × " + val("f_service");
    } else {
      totalEl.textContent = "—";
      altEl.textContent = "";
      altEl.style.color = "";
      priceHint.textContent = "Enter a quantity";
    }
    updatePromoRowVisibility();
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
      // Preserve current bulk selection across rebuilds
      var prevPlatform = bPlatform.value;
      var prevService  = bService ? bService.value : "";
      bPlatform.innerHTML = '<option value="" disabled selected hidden>Platform</option>';
      PLATFORMS.forEach(function (p) {
        var o = document.createElement("option");
        o.value = p.name;
        o.textContent = p.name;
        bPlatform.appendChild(o);
      });
      // Re-apply previous platform if it still exists
      if (prevPlatform && PLATFORMS.some(function(p){ return p.name === prevPlatform; })) {
        bPlatform.value = prevPlatform;
        // Rebuild services for this platform without firing change handler
        var pf = platformByName(prevPlatform);
        if (pf && bService) {
          bService.innerHTML = '<option value="" disabled selected hidden>Service</option>';
          pf.services.forEach(function(s) {
            var o = document.createElement("option");
            o.textContent = s;
            bService.appendChild(o);
          });
          bService.disabled = false;
          if (prevService && pf.services.indexOf(prevService) !== -1) {
            bService.value = prevService;
          }
        }
        setBulkPlatformIcon(prevPlatform);
      }
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

  /* ── Structured bulk items state ── */
  var bulkItems = []; // [{ id, platform, service, qty, link, price }]
  var bulkItemsListEl = document.getElementById("bulkItemsList");
  var bulkEmptyEl     = document.getElementById("bulkEmptyState");

  function recomputeItemPrice(item) {
    var p = computePriceFor(item.platform, item.service, Number(item.qty));
    item.price = p ? Math.round(p.total) : 0;
  }

  function syncBulkTextarea() {
    if (!bList) return;
    var lines = bulkItems.map(function (it) {
      var qtyStr = Number(it.qty || 0).toLocaleString("en-US");
      var priceStr = it.price ? fmtPKR(it.price) : "—";
      return it.platform + " — " + it.service + " — " + qtyStr + " — " + (it.link || "") + " — " + priceStr;
    });
    bList.value = lines.join("\n");
  }

  function renderBulkItems() {
    if (!bulkItemsListEl) return;
    bulkItemsListEl.innerHTML = "";
    bulkItems.forEach(function (it, idx) {
      var card = document.createElement("div");
      card.className = "bulk-item";
      card.dataset.id = it.id;

      var pfObj = platformByName(it.platform);
      var pfIcon = pfObj ? pfObj.icon : "";

      card.innerHTML =
        '<div class="bulk-item__main">' +
          '<div class="bulk-item__head">' +
            '<span class="bulk-item__num">' + (idx + 1) + '</span>' +
            '<span class="bulk-item__platform">' +
              '<span class="bulk-item__platform-icon">' + pfIcon + '</span>' +
              (it.platform || '—') +
            '</span>' +
            '<span class="bulk-item__service">' + (it.service || '—') + '</span>' +
          '</div>' +
          '<div class="bulk-item__row">' +
            '<div class="bulk-item__field">' +
              '<label>Quantity</label>' +
              '<input type="number" min="1" class="js-edit-qty" value="' + (it.qty || '') + '" />' +
            '</div>' +
            '<div class="bulk-item__field">' +
              '<label>Post / Profile Link</label>' +
              '<input type="url" class="js-edit-link" value="' + (it.link || '').replace(/"/g, '&quot;') + '" placeholder="https://…" />' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="bulk-item__side">' +
          '<span class="bulk-item__price">' + (it.price ? fmtPKR(it.price) : '—') + '</span>' +
          '<button type="button" class="bulk-item__remove" title="Remove item" aria-label="Remove item">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>' +
          '</button>' +
        '</div>';

      var qtyInput  = card.querySelector('.js-edit-qty');
      var linkInput = card.querySelector('.js-edit-link');
      var priceEl   = card.querySelector('.bulk-item__price');
      var removeBtn = card.querySelector('.bulk-item__remove');

      qtyInput.addEventListener("input", function () {
        var v = Number(qtyInput.value) || 0;
        it.qty = v > 0 ? v : '';
        qtyInput.classList.toggle("is-invalid", !v);
        recomputeItemPrice(it);
        priceEl.textContent = it.price ? fmtPKR(it.price) : '—';
        syncBulkTextarea();
        countItems();
      });
      linkInput.addEventListener("input", function () {
        it.link = linkInput.value.trim();
        var bad = it.link && !isValidUrl(it.link);
        linkInput.classList.toggle("is-invalid", bad);
        syncBulkTextarea();
      });
      removeBtn.addEventListener("click", function () {
        bulkItems = bulkItems.filter(function (x) { return x.id !== it.id; });
        syncBulkTextarea();
        renderBulkItems();
        countItems();
      });

      bulkItemsListEl.appendChild(card);
    });
    if (bulkEmptyEl) bulkEmptyEl.style.display = bulkItems.length ? "none" : "";
  }

  function computeBulkTotal() {
    return bulkItems.reduce(function (sum, it) { return sum + (Number(it.price) || 0); }, 0);
  }

  function updateBulkSummary() {
    if (!bulkTotalEl) return;
    var total = computeBulkTotal();
    var discount = computeDiscount(total);
    if (total && discount > 0) {
      bulkTotalEl.innerHTML = fmtPKR(total - discount) + ' <span style="color:#19b591;font-size:0.7em;font-weight:600;">(−' + fmtPKR(discount) + ')</span>';
    } else {
      bulkTotalEl.textContent = total ? fmtPKR(total) : "—";
    }
    if (bulkPriceSummary) bulkPriceSummary.classList.toggle("show", total > 0);
    updatePromoRowVisibility();
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
    var n = bulkItems.length;
    bulkCount.textContent = n + (n === 1 ? " item in your order" : " items in your order");
    updateBulkSummary();
    return n;
  }

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

    var item = {
      id: 'b' + Date.now() + Math.round(Math.random() * 1000),
      platform: bPlatform.value,
      service:  bService.value,
      qty:      Number(bQty.value),
      link:     bLink.value.trim(),
      price:    0
    };
    recomputeItemPrice(item);
    bulkItems.push(item);
    syncBulkTextarea();
    renderBulkItems();
    countItems();
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
    // If an applied promo doesn't fit the new mode, drop it
    if (appliedPromo && appliedPromo.appliesTo && appliedPromo.appliesTo !== 'both' && appliedPromo.appliesTo !== mode) {
      appliedPromo = null;
      var pi = document.getElementById('f_promo');
      var fb = document.getElementById('promoFeedback');
      var ab = document.getElementById('applyPromoBtn');
      var cb = document.getElementById('clearPromoBtn');
      if (pi) { pi.value = ''; pi.disabled = false; }
      if (ab) ab.style.display = '';
      if (cb) cb.style.display = 'none';
      if (fb) { fb.textContent = 'Previous promo code was only valid for the other order type.'; fb.className = 'promo-feedback muted'; }
    }
    if (bulk) {
      priceBox.classList.remove("show");
      updateBulkSummary();
    } else {
      if (bulkPriceSummary) bulkPriceSummary.classList.remove("show");
      updatePrice();
    }
    updatePromoRowVisibility();
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

    // Pre-compute subtotal for promo handling
    var preSubtotal = orderMode === "single"
      ? (singlePrice ? Math.round(singlePrice.total) : 0)
      : bulkTotalVal;

    // Build structured order payload
    var orderPayload = {
      id: orderId,
      website: val("f_website"), // honeypot — must be empty
      promoCode: appliedPromo ? appliedPromo.code : "",
      subtotalAmount: preSubtotal,
      name: val("f_name"),
      whatsapp: normalizePkPhone(val("f_whatsapp")),
      mode: orderMode,
      quality: (document.getElementById("f_quality_select") ? document.getElementById("f_quality_select").value : orderQuality) || "organic",
      platform: orderMode === "single" ? val("f_platform") : "",
      service: orderMode === "single" ? val("f_service") : "",
      qty: orderMode === "single" ? val("f_qty") : "",
      link: orderMode === "single" ? val("f_link") : "",
      notes: notes,
      bulkText: orderMode === "bulk" ? bList.value.trim() : "",
      totalPrice: (function(){
        var sub = orderMode === "single" ? (singlePrice ? singlePrice.total : 0) : bulkTotalVal;
        var disc = computeDiscount(sub);
        return sub ? fmtPKR(Math.max(0, sub - disc)) : "—";
      })()
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
      var successTrackBtn = document.getElementById("successTrackBtn");
      if (successTrackBtn) successTrackBtn.href = "/track?id=" + encodeURIComponent(orderId);
      if (successOverlay) successOverlay.classList.add("show");
    })
    .catch(function () {
      label.textContent = old;
      // Fail-safe: if backend fails, just open WhatsApp directly
      window.open(url, "_blank");
    });
  });

  /* ── Promo apply/clear ── */
  (function() {
    var promoInput  = document.getElementById("f_promo");
    var applyBtn    = document.getElementById("applyPromoBtn");
    var clearBtn    = document.getElementById("clearPromoBtn");
    var feedback    = document.getElementById("promoFeedback");
    if (!promoInput || !applyBtn) return;

    function setFeedback(msg, kind) {
      if (!feedback) return;
      feedback.textContent = msg || "";
      feedback.className = "promo-feedback" + (kind ? " " + kind : "");
    }

    function clearPromo() {
      appliedPromo = null;
      promoInput.value = "";
      promoInput.disabled = false;
      clearBtn.style.display = "none";
      applyBtn.style.display = "";
      setFeedback("");
      updatePrice();
      updateBulkSummary();
    }

    applyBtn.addEventListener("click", function() {
      var code = (promoInput.value || "").trim().toUpperCase();
      if (!code) { setFeedback("Please enter a code.", "muted"); return; }
      applyBtn.disabled = true;
      setFeedback("Checking…", "muted");
      var url = "/api/promos/validate/" + encodeURIComponent(code) + "?mode=" + encodeURIComponent(orderMode);
      fetch(url, { cache: "no-store" })
        .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, body: j }; }); })
        .then(function(res) {
          applyBtn.disabled = false;
          if (!res.ok || !res.body.valid) {
            appliedPromo = null;
            setFeedback(res.body.error || "Invalid or expired code.", "bad");
            updatePrice(); updateBulkSummary();
            return;
          }
          appliedPromo = { code: res.body.code, type: res.body.type, value: res.body.value, appliesTo: res.body.appliesTo };
          var label = appliedPromo.type === 'percent' ? appliedPromo.value + '% off' : '₨' + appliedPromo.value.toLocaleString() + ' off';
          setFeedback("✓ " + appliedPromo.code + " applied — " + label, "ok");
          promoInput.value = appliedPromo.code;
          promoInput.disabled = true;
          clearBtn.style.display = "";
          applyBtn.style.display = "none";
          updatePrice(); updateBulkSummary();
        })
        .catch(function() {
          applyBtn.disabled = false;
          setFeedback("Network error. Try again.", "bad");
        });
    });

    clearBtn.addEventListener("click", clearPromo);
    promoInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter") { e.preventDefault(); applyBtn.click(); }
    });
  })();

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

  /* ============================================================
     AI CHATBOT — multilingual, rule-based, fully client-side
     No external API, no server load. Detects English / Urdu /
     Roman Urdu from the user's message and replies in the same.
     ============================================================ */
  (function() {
    var floatBtn = document.getElementById("chatFloat");
    var panel    = document.getElementById("chatPanel");
    var closeBtn = document.getElementById("chatClose");
    var form     = document.getElementById("chatForm");
    var input    = document.getElementById("chatInput");
    var body     = document.getElementById("chatBody");
    var quickRow = document.getElementById("chatQuick");
    var brandEl  = document.getElementById("chatBrandName");
    if (!floatBtn || !panel || !form || !input || !body) return;

    /* ── Language detection ── */
    function detectLang(text) {
      // Real Urdu script (Arabic Unicode block)
      if (/[؀-ۿݐ-ݿ]/.test(text)) return "ur";
      // Roman Urdu markers — common Urdu words written in English letters
      var roman = /\b(kya|kese|kaise|kaisay|kitna|kitne|kitni|kahan|kahaan|kab|kyun|kyo|kyu|kab|hai|hain|ho|ka|ki|ke|ko|me|mein|mujhe|mujh|tum|tumhara|aap|apka|apke|apki|apko|hum|hamara|krna|karna|krna|krte|krty|krrhe|raha|rha|chahiye|chahye|chahta|chahti|order|deta|deti|dena|leta|leti|lena|sakta|sakti|sakte|sakhta|krwana|karwana|hota|hoti|hote|nhi|nahi|bilkul|theek|thik|thk|acha|achha|achi|achi|bohut|bohat|bahut|zaror|zaroor|jaldi|wajah|kuch|kuchh|koi|kisi|wala|wali|kar|kr|haan|han|ji|na|mat|samajh|samjh|samjha|samjhi|samjhe|service|payment|kese|paisay|paise|paisa|rupay|sasta|mahnga|mehnga|garentee|guarantee|wala|kerwana|kerwa|hojai|hogya|hogai|krdo|kardo|krdein|kardein|please|order|whatsapp|wapis|wapas)\b/i;
      if (roman.test(text)) return "roman";
      return "en";
    }

    /* ── Helper ── */
    function any(text, words) {
      var t = text.toLowerCase();
      for (var i = 0; i < words.length; i++) if (t.indexOf(words[i]) !== -1) return true;
      return false;
    }
    function brand() { return appConfig.brandName || "GrowVia"; }
    function tag(text) { return text.replace(/\{brand\}/g, brand()); }

    /* ── Intent definitions — order matters (top = highest priority) ── */
    var INTENTS = [
      {
        id: "greeting",
        match: function(t, lang) {
          if (lang === "ur") return /(سلام|ہیلو|آداب)/.test(t);
          if (lang === "roman") return any(t, ["salam", "assalam", "asalamoalikum", "asalamoalaikum", "asalam", "hi", "hello", "hey", "adaab"]);
          return /^(hi|hello|hey|good\s+(morning|evening|afternoon)|greetings)\b/i.test(t.trim());
        },
        reply: {
          en:    "Hi there! Welcome to {brand}. How can I help you today — pricing, services, delivery, or something else?",
          roman: "Salam! {brand} me khush amdeed. Main aapki kya madad kar sakta hoon — rates, services, delivery ke baray me ya kuch aur?",
          ur:    "السلام علیکم! {brand} میں خوش آمدید۔ میں آپ کی کس طرح مدد کر سکتا ہوں — قیمت، خدمات، یا کچھ اور؟"
        }
      },
      {
        id: "how_to_order",
        match: function(t, lang) {
          if (lang === "roman") return any(t, ["kese order", "kaise order", "order kese", "order kaise", "kese krna", "kese kre", "kaise karna", "order krwana", "order krna", "order krwa", "order place"]);
          if (lang === "ur") return /(آرڈر|کیسے|طریقہ)/.test(t);
          return /\b(how\s+(to|do\s+i)\s+(order|place)|order\s+process|place\s+an?\s+order|where\s+(do\s+i|to)\s+order)\b/i.test(t);
        },
        reply: {
          en:    "Placing an order is simple — just 4 steps:\n1. Pick a platform (Instagram, TikTok, etc.) and the service you need\n2. Enter the exact quantity and your public profile/post link\n3. Add your full name and WhatsApp number\n4. Tap Place Order — our team will confirm on WhatsApp instantly.\n\nNo signup, no wallet, no waiting.",
          roman: "Order karna bohat simple hai — 4 steps:\n1. Platform select karein (Instagram, TikTok, waghaira) aur service chunein\n2. Quantity aur apna public profile/post link daalein\n3. Naam aur WhatsApp number likhein\n4. Place Order dabayein — humari team WhatsApp pe foran confirm karegi.\n\nKoi signup nahi, koi wallet nahi.",
          ur:    "آرڈر دینا بہت آسان ہے — صرف 4 قدم:\n1. پلیٹ فارم اور سروس منتخب کریں\n2. مقدار اور اپنا پبلک لنک درج کریں\n3. نام اور واٹس ایپ نمبر لکھیں\n4. آرڈر کا بٹن دبائیں — ہماری ٹیم فوراً واٹس ایپ پر تصدیق کرے گی۔"
        }
      },
      {
        id: "pricing",
        match: function(t, lang) {
          if (lang === "roman") return any(t, ["price", "rate", "kitna", "kitne", "kitni", "paisay", "paise", "paisa", "rupay", "kharcha", "cost", "kimat", "qeemat"]);
          if (lang === "ur") return /(قیمت|ریٹ|پیسے|روپے)/.test(t);
          return /\b(price|pricing|rate|rates|cost|how\s+much|charges?|fee|fees|expensive|cheap)\b/i.test(t);
        },
        reply: {
          en:    "Live pricing is shown right on the order form — just pick a platform, service, and quantity and the total updates instantly in PKR. We accept JazzCash, EasyPaisa, SadaPay, NayaPay and bank transfer. For a full price list, tap the View Prices button in the navbar.",
          roman: "Rates order form pe live show hote hain — platform, service aur quantity chunein, total foran PKR me update ho jata hai. Hum JazzCash, EasyPaisa, SadaPay, NayaPay aur bank transfer accept karte hain. Pora price list dekhne ke liye navbar me View Prices dabayein.",
          ur:    "تمام قیمتیں آرڈر فارم پر براہ راست نظر آتی ہیں — پلیٹ فارم اور سروس منتخب کرتے ہی ٹوٹل پاکستانی روپیہ میں اپڈیٹ ہو جاتا ہے۔ ہم JazzCash، EasyPaisa، SadaPay، NayaPay اور بینک ٹرانسفر قبول کرتے ہیں۔"
        }
      },
      {
        id: "services_platforms",
        match: function(t, lang) {
          if (lang === "roman") return any(t, ["kon si service", "kon si platform", "kaunsi service", "kaunsa platform", "kya kya", "platforms", "konsi service"]);
          if (lang === "ur") return /(کونسی سروس|پلیٹ فارم|کیا کیا)/.test(t);
          return /\b(what\s+(services|platforms)|which\s+(platforms|services|networks)|do\s+you\s+(support|do|offer)|services\s+(do\s+you|offered)|available\s+(platforms|services))\b/i.test(t);
        },
        reply: {
          en:    "We cover all major platforms: Instagram, Facebook, TikTok, YouTube, X (Twitter), and LinkedIn. Services include followers, likes, views, comments, shares, saves, subscribers and watch hours — quality available as Premium (real, lasting) or Basic (fast, automated).",
          roman: "Hum saari major platforms pe kaam karte hain: Instagram, Facebook, TikTok, YouTube, X (Twitter), aur LinkedIn. Services: followers, likes, views, comments, shares, saves, subscribers, watch hours. Quality 2 options — Premium (real, lasting) ya Basic (fast, automated).",
          ur:    "ہم تمام بڑے پلیٹ فارمز پر کام کرتے ہیں: انسٹاگرام، فیس بک، ٹک ٹاک، یوٹیوب، X (ٹویٹر)، اور لنکڈ ان۔ سروسز: followers، likes، views، comments، shares، subscribers، watch hours۔"
        }
      },
      {
        id: "premium_vs_basic",
        match: function(t, lang) {
          if (lang === "roman") return any(t, ["premium", "basic", "quality", "farq", "difference", "asli", "real", "fake", "nakli"]);
          if (lang === "ur") return /(پریمیم|بیسک|فرق|اصلی|نقلی)/.test(t);
          return /\b(premium|basic|quality\s+(difference|options)|difference\s+between|real\s+(or|vs)\s+(bot|fake)|organic\s+vs)\b/i.test(t);
        },
        reply: {
          en:    "Premium = real, naturally-grown accounts. They look authentic, last long-term, and drop rarely. Slower delivery (24–72 hrs).\nBasic = automated, mixed-quality. Cheaper, very fast delivery (often within hours), but a small percentage may drop over time.\nFor brand profiles or serious creators, Premium is the right choice.",
          roman: "Premium = real, naturally grown accounts. Asli lagti hain, lambay arsay tak rehti hain, drop rarely hoti hain. Delivery thori slow (24–72 ghantay).\nBasic = automated, mixed-quality. Sasta, bohat fast (kuch ghanton me), lekin thora percentage drop ho sakta hai.\nBrand profiles ya serious creators ke liye Premium behtar hai.",
          ur:    "پریمیم = اصلی اکاؤنٹس جو قدرتی لگتے ہیں اور لمبے عرصے تک رہتے ہیں۔ ڈیلیوری 24-72 گھنٹے میں۔\nبیسک = آٹومیٹڈ، تیز ڈیلیوری لیکن کچھ فیصد گر سکتا ہے۔\nبرانڈ کے لیے پریمیم بہتر ہے۔"
        }
      },
      {
        id: "delivery_time",
        match: function(t, lang) {
          if (lang === "roman") return any(t, ["kab milega", "kab milegi", "kitne din", "kitne ghantay", "kitne ghante", "delivery", "time", "kab tak", "kab ayega"]);
          if (lang === "ur") return /(کب|وقت|دن|گھنٹے|ڈیلیوری)/.test(t);
          return /\b(delivery\s+time|how\s+long|when\s+(will|do)\s+i\s+get|how\s+fast|estimated\s+(time|delivery)|when\s+ready)\b/i.test(t);
        },
        reply: {
          en:    "Basic orders typically start within 0–2 hours and complete within a few hours.\nPremium orders start within 0–6 hours and complete gradually over 24–72 hours so growth looks natural.\nLarge bulk orders may take slightly longer. Once you place an order, you can check live status anytime on the Track Order page using your Order ID.",
          roman: "Basic orders 0–2 ghante me start ho ke kuch hi ghanton me complete ho jate hain.\nPremium orders 0–6 ghantay me start hote hain aur 24–72 ghanton me natural taur pe complete hote hain.\nBari bulk orders thori der laga sakti hain. Order place karne ke baad apna Order ID daal ke Track Order page pe live status check kar sakte ho.",
          ur:    "بیسک آرڈرز 0-2 گھنٹے میں شروع اور چند گھنٹوں میں مکمل ہو جاتے ہیں۔\nپریمیم آرڈرز 0-6 گھنٹے میں شروع اور 24-72 گھنٹے میں مکمل ہوتے ہیں۔ آرڈر کے بعد آپ Track Order صفحے پر اپنا اسٹیٹس دیکھ سکتے ہیں۔"
        }
      },
      {
        id: "payment",
        match: function(t, lang) {
          if (lang === "roman") return any(t, ["payment", "pay", "kese pay", "kaise pay", "jazzcash", "easypaisa", "sadapay", "nayapay", "bank"]);
          if (lang === "ur") return /(ادائیگی|پیمنٹ|جاز کیش|ایزی پیسہ|بینک)/.test(t);
          return /\b(payment|pay|how\s+(to|do\s+i)\s+pay|payment\s+method|bank\s+transfer|jazzcash|easypaisa|sadapay|nayapay)\b/i.test(t);
        },
        reply: {
          en:    "We accept JazzCash, EasyPaisa, SadaPay, NayaPay, and bank transfer. After you place the order, our team confirms the order on WhatsApp and shares the payment account details. You only pay once you're satisfied that the order is real and confirmed.",
          roman: "JazzCash, EasyPaisa, SadaPay, NayaPay, aur bank transfer — sab accept hain. Order place karne ke baad humari team WhatsApp pe confirm karti hai aur payment account details share karti hai. Payment tab karte hain jab aap confirm ho jate hain ke order real hai.",
          ur:    "ہم JazzCash، EasyPaisa، SadaPay، NayaPay، اور بینک ٹرانسفر قبول کرتے ہیں۔ آرڈر کے بعد ہماری ٹیم واٹس ایپ پر تصدیق کرتی ہے۔"
        }
      },
      {
        id: "track_order",
        match: function(t, lang) {
          if (lang === "roman") return any(t, ["track", "order status", "order kahan", "order kaha", "status", "kahan hai"]);
          if (lang === "ur") return /(ٹریک|اسٹیٹس|آرڈر کہاں)/.test(t);
          return /\b(track|order\s+status|where\s+is\s+my\s+order|status\s+of\s+(my\s+)?order|is\s+my\s+order)\b/i.test(t);
        },
        reply: {
          en:    "You can track your order anytime — no signup needed. Tap the Track Order button in the top navbar, enter your Order ID (looks like GRV-XXXXXX-XXXX), and you'll see the live status with a 4-step timeline.",
          roman: "Order track karne ke liye signup ki zaroorat nahi. Top navbar me Track Order button dabayein, apna Order ID (jaise GRV-XXXXXX-XXXX) daalein, aur live status 4-step timeline ke saath dikh jayega.",
          ur:    "آرڈر ٹریک کرنا آسان ہے — نیویگیشن میں Track Order کا بٹن دبائیں اور اپنا Order ID درج کریں۔"
        }
      },
      {
        id: "promo",
        match: function(t, lang) {
          if (lang === "roman") return any(t, ["promo", "discount", "code", "coupon", "offer", "discount mil"]);
          if (lang === "ur") return /(پرومو|ڈسکاؤنٹ|آفر|کوڈ)/.test(t);
          return /\b(promo|discount|coupon|code|offer\s+code|any\s+(discount|offer))\b/i.test(t);
        },
        reply: {
          en:    "Yes — if a promo code is active, you'll see it on the floating offer banner. Just copy the code, then apply it on the order form after picking your service and quantity. The discount applies instantly to the total.",
          roman: "Haan — agar koi promo active ho to floating offer banner pe nazar ayega. Code copy karein, phir order form pe service aur quantity select karne ke baad apply karein. Discount foran total me lag jata hai.",
          ur:    "اگر کوئی پرومو کوڈ فعال ہو تو وہ آفر بینر پر دکھایا جائے گا۔ کوڈ کاپی کر کے آرڈر فارم پر لگائیں۔"
        }
      },
      {
        id: "bulk",
        match: function(t, lang) {
          if (lang === "roman") return any(t, ["bulk", "bohut sare", "bohat sare", "multiple", "ek se zyada", "kayi"]);
          if (lang === "ur") return /(بلک|ایک سے زیادہ|کئی)/.test(t);
          return /\b(bulk|multiple\s+orders|many\s+(orders|items)|several|wholesale)\b/i.test(t);
        },
        reply: {
          en:    "Bulk orders are fully supported — switch to Bulk mode on the order form. Add as many items as you need (each with its own platform, service, quantity, and link). You can edit quantities or remove items anytime before submitting. The total is calculated live.",
          roman: "Bulk orders bilkul support karte hain — order form me Bulk mode pe switch karein. Jitne items chahiye add karein (har ek apna platform, service, quantity aur link). Submit karne se pehle quantity edit ya items remove kar sakte ho. Total live calculate hota hai.",
          ur:    "بلک آرڈر مکمل طور پر دستیاب ہیں — فارم پر Bulk موڈ منتخب کریں۔ جتنی چاہیں آئٹمز شامل کر سکتے ہیں اور بھیجنے سے پہلے ترمیم کر سکتے ہیں۔"
        }
      },
      {
        id: "refund",
        match: function(t, lang) {
          if (lang === "roman") return any(t, ["refund", "wapas", "paisay wapas", "wapsi", "cancel"]);
          if (lang === "ur") return /(ریفنڈ|واپس|منسوخ)/.test(t);
          return /\b(refund|money\s+back|cancel|cancellation|chargeback)\b/i.test(t);
        },
        reply: {
          en:    "If a service can't be delivered or is partially delivered, please contact our team on WhatsApp with your Order ID. We resolve every legitimate issue — usually with a refill or a partial refund. Orders that have already been delivered cannot be reversed.",
          roman: "Agar service deliver nahi ho sakti ya kuch hi mile to apna Order ID le ke WhatsApp pe humari team se baat karein. Legitimate issue ka hum hal nikalte hain — refill ya partial refund ke zariye. Already delivered orders reverse nahi ho sakte.",
          ur:    "اگر کوئی سروس مکمل نہ مل سکے تو واٹس ایپ پر اپنا Order ID بھیجیں۔ ہم ہر جائز مسئلہ حل کرتے ہیں۔"
        }
      },
      {
        id: "safety_ethics",
        match: function(t, lang) {
          if (lang === "roman") return any(t, ["safe", "secure", "ban", "account ban", "danger", "risk", "khatra", "ethical"]);
          if (lang === "ur") return /(محفوظ|پابندی|خطرہ)/.test(t);
          return /\b(safe|secure|ban|banned|account\s+(safety|secure|safe)|risk|risky|ethical|illegal)\b/i.test(t);
        },
        reply: {
          en:    "Yes, we never ask for your password and we never post on your behalf. All growth is delivered safely from the outside — no platform terms violated. We follow strict ethical guidelines: no inappropriate content, no fraud, no fake engagement schemes.",
          roman: "Bilkul safe hai — hum password kabhi nahi mangte aur aapke account se post nahi karte. Saari growth bahar se safely deliver hoti hai. Hum strict ethics follow karte hain: no inappropriate content, no fraud.",
          ur:    "بالکل محفوظ ہے — ہم آپ کا پاس ورڈ کبھی نہیں مانگتے اور آپ کے اکاؤنٹ سے کچھ پوسٹ نہیں کرتے۔"
        }
      },
      {
        id: "marketing",
        match: function(t, lang) {
          if (lang === "roman") return any(t, ["marketing", "campaign", "strategy", "long term", "lambay arsay"]);
          if (lang === "ur") return /(مارکیٹنگ|مہم|حکمت عملی)/.test(t);
          return /\b(marketing|campaign|strategy|long[-\s]?term|growth\s+strategy|brand\s+plan)\b/i.test(t);
        },
        reply: {
          en:    "For long-term marketing campaigns, content strategy, or full brand growth plans, please contact us directly on WhatsApp. We'll discuss your goals, audience and budget, then share a custom plan — separate from casual one-off orders.",
          roman: "Long-term marketing campaign, content strategy ya pora brand growth plan ke liye seedha WhatsApp pe rabta karein. Hum aapke goals, audience aur budget par bait karke custom plan share karenge — casual one-off orders se alag.",
          ur:    "طویل مدتی مارکیٹنگ یا برانڈ پلان کے لیے براہ راست واٹس ایپ پر رابطہ کریں۔ ہم آپ کے اہداف اور بجٹ کے مطابق کسٹم پلان دیں گے۔"
        }
      },
      {
        id: "contact",
        match: function(t, lang) {
          if (lang === "roman") return any(t, ["contact", "rabta", "raabta", "baat", "talk", "whatsapp", "phone", "number"]);
          if (lang === "ur") return /(رابطہ|بات|واٹس ایپ|نمبر)/.test(t);
          return /\b(contact|reach\s+(you|out)|talk\s+to\s+(human|agent|someone)|customer\s+(service|support)|phone\s+number|whatsapp)\b/i.test(t);
        },
        reply: {
          en:    "You can reach our team anytime on WhatsApp using the green button at the bottom-right of the page. We typically reply within a few minutes during business hours.",
          roman: "Humari team se WhatsApp pe rabta karein — page ke neeche-right me green button hai. Business hours me chand minute me reply karte hain.",
          ur:    "ہم سے واٹس ایپ پر رابطہ کریں — صفحے کے نیچے دائیں طرف سبز بٹن سے۔"
        }
      },
      {
        id: "thanks",
        match: function(t, lang) {
          if (lang === "roman") return any(t, ["shukriya", "shukria", "thanks", "thank", "thx", "thnx"]);
          if (lang === "ur") return /(شکریہ|مہربانی)/.test(t);
          return /\b(thanks|thank\s+you|ty|thx|thnx|appreciated|cheers)\b/i.test(t);
        },
        reply: {
          en:    "You're welcome! If you need anything else, I'm right here. For human help, WhatsApp our team anytime.",
          roman: "Khush amdeed! Aur kuch chahiye to main yahan hoon. Human team ke liye WhatsApp pe rabta karein.",
          ur:    "خوش آمدید! اگر کچھ اور درکار ہو تو میں یہاں موجود ہوں۔"
        }
      },
      {
        id: "bye",
        match: function(t, lang) {
          if (lang === "roman") return any(t, ["bye", "khuda hafiz", "allah hafiz", "alvida", "goodbye"]);
          if (lang === "ur") return /(الوداع|خدا حافظ|اللہ حافظ)/.test(t);
          return /\b(bye|goodbye|see\s+you|cya|farewell|take\s+care)\b/i.test(t);
        },
        reply: {
          en:    "Take care! Come back anytime — and remember, WhatsApp is always open for real human help.",
          roman: "Allah Hafiz! Jab bhi madad chahiye, hazir hain. WhatsApp pe humari team hamesha available hai.",
          ur:    "اللہ حافظ! جب بھی مدد چاہیے، حاضر ہیں۔"
        }
      }
    ];

    /* ── Fallback for unknown questions ── */
    var FALLBACK = {
      en:    "I am not sure about that one. For anything specific, our team on WhatsApp can answer instantly — just tap the green WhatsApp button at the bottom right.",
      roman: "Iska theek jawab mere paas nahi hai. Specific kisi cheez ke liye humari team WhatsApp pe foran reply karti hai — neechay right me green WhatsApp button dabayein.",
      ur:    "اس کا میرے پاس صحیح جواب نہیں ہے۔ تفصیلی سوال کے لیے براہ راست واٹس ایپ پر رابطہ کریں۔"
    };

    /* ── Custom admin Q&A check ── */
    function matchCustomQA(text) {
      var list = (appConfig.chatbot && appConfig.chatbot.customQA) || [];
      var t = text.toLowerCase();
      for (var i = 0; i < list.length; i++) {
        var kws = String(list[i].keywords || "").toLowerCase().split(",").map(function(s){ return s.trim(); }).filter(Boolean);
        for (var j = 0; j < kws.length; j++) {
          if (t.indexOf(kws[j]) !== -1) return list[i].answer;
        }
      }
      return null;
    }

    /* ── Generate reply ── */
    function generateReply(text) {
      var lang = detectLang(text);
      // Admin-defined custom Q&A wins
      var custom = matchCustomQA(text);
      if (custom) return tag(custom);
      // Built-in intents
      for (var i = 0; i < INTENTS.length; i++) {
        if (INTENTS[i].match(text, lang)) {
          return tag(INTENTS[i].reply[lang] || INTENTS[i].reply.en);
        }
      }
      return FALLBACK[lang] || FALLBACK.en;
    }

    /* ── UI helpers ── */
    function addMessage(text, who) {
      var el = document.createElement("div");
      el.className = "chat-msg " + (who || "bot");
      // Linkify URLs & line breaks
      var safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      safe = safe.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
      safe = safe.replace(/\n/g, "<br>");
      el.innerHTML = safe;
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
    }
    function showTyping() {
      var el = document.createElement("div");
      el.className = "chat-msg bot typing";
      el.id = "chatTyping";
      el.innerHTML = '<span class="chat-typing-dot"></span><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span>';
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
    }
    function hideTyping() {
      var t = document.getElementById("chatTyping");
      if (t) t.remove();
    }
    function setQuickReplies(items) {
      quickRow.innerHTML = "";
      items.forEach(function(label) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "chat-quick-btn";
        b.textContent = label;
        b.addEventListener("click", function() {
          input.value = label;
          form.dispatchEvent(new Event("submit", { cancelable: true }));
        });
        quickRow.appendChild(b);
      });
    }

    var bootstrapped = false;
    function bootstrap() {
      if (bootstrapped) return;
      bootstrapped = true;
      var welcome = (appConfig.chatbot && appConfig.chatbot.welcomeMessage) ||
        "Hi! I am the " + brand() + " assistant. Ask me anything in English, Urdu or Roman Urdu — about pricing, services, delivery, payment, anything.";
      addMessage(tag(welcome), "bot");
      setQuickReplies([
        "How do I order?",
        "Rates kya hain?",
        "Delivery time?",
        "Premium vs Basic?",
        "Payment methods"
      ]);
    }

    /* ── Open / close ── */
    function open() {
      if (!appConfig.chatbot || appConfig.chatbot.enabled === false) return;
      panel.classList.add("open");
      panel.setAttribute("aria-hidden", "false");
      floatBtn.classList.add("open");
      bootstrap();
      setTimeout(function(){ input.focus(); }, 280);
    }
    function close() {
      panel.classList.remove("open");
      panel.setAttribute("aria-hidden", "true");
      floatBtn.classList.remove("open");
    }
    floatBtn.addEventListener("click", function() {
      if (panel.classList.contains("open")) close(); else open();
    });
    if (closeBtn) closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && panel.classList.contains("open")) close();
    });

    /* ── Submit handler ── */
    form.addEventListener("submit", function(e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      addMessage(text, "user");
      input.value = "";
      quickRow.innerHTML = "";
      showTyping();
      setTimeout(function() {
        hideTyping();
        var reply = generateReply(text);
        addMessage(reply, "bot");
      }, 450 + Math.random() * 350);
    });

    /* ── React to config changes (enable/disable / hide button) ── */
    function applyChatbotConfig() {
      var cfg = appConfig.chatbot || {};
      if (cfg.enabled === false) {
        floatBtn.style.display = "none";
        close();
      } else {
        floatBtn.style.display = "";
      }
      if (brandEl) brandEl.textContent = brand() + " Assistant";
    }
    // Poll config on init + every 8s (config polling already happens elsewhere)
    setInterval(applyChatbotConfig, 4000);
    setTimeout(applyChatbotConfig, 300);
  })();
})();
