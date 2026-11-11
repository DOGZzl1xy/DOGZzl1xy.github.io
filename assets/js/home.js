/* Home page effects: first-visit opening, SVG line-drawing entrances (desk and
   research icons, each when it scrolls into view), laptop typewriter, projects
   popup, and a hand-drawn burst on click.
   Everything is skipped when the visitor prefers reduced motion. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canObserve = "IntersectionObserver" in window;

  /* run `play` once, the first time `el` is at least `ratio` visible */
  var whenVisible = function (el, ratio, play) {
    if (!canObserve) { play(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        io.disconnect();
        play();
      }
    }, { threshold: ratio });
    io.observe(el);
  };

  /* ---- SVG line-drawing entrance ------------------------------------
     prepareInk() hides the strokes straight away (body.ink-ready), so nothing
     is seen drawn before its animation; startInk() then waits for the desk /
     each research icon to scroll into view before drawing it. */
  var scene = document.querySelector(".desk-scene");
  var iconItems = document.querySelectorAll(".focus-list li");

  var prepareInk = function () {
    if (reduceMotion) return;
    if (scene) {
      var groups = scene.querySelectorAll(".scene-link, .scene-desk, .scene-deco");
      groups.forEach(function (group, i) {
        group.style.setProperty("--i", i);
        group.querySelectorAll("[pathLength]").forEach(function (el, j) {
          el.classList.add("ink-line");
          el.style.setProperty("--j", j);
        });
      });
      var sparkle = scene.querySelector(".scene-sparkle");
      if (sparkle) sparkle.style.setProperty("--i", groups.length);
    }
    iconItems.forEach(function (item) {
      item.querySelectorAll(".focus-list__icon [pathLength]").forEach(function (el, j) {
        el.classList.add("ink-line");
        el.style.setProperty("--j", j);
      });
      item.querySelectorAll(".focus-list__icon [stroke-dasharray]").forEach(function (el) {
        el.classList.add("ink-dash");
      });
    });
    document.body.classList.add("ink-ready");
  };

  var startInk = function () {
    if (reduceMotion) return;
    if (scene) {
      whenVisible(scene, 0.35, function () {
        document.body.classList.add("ink-anim");
      });
    }
    // icons that come into view together (one desktop row) draw left to right:
    // one observer reports them in document order, --i staggers the batch
    var inkIcon = function (item, i) {
      item.style.setProperty("--i", i);
      item.classList.add("is-inked");
    };
    if (!canObserve) {
      iconItems.forEach(inkIcon);
    } else if (iconItems.length) {
      var iconObserver = new IntersectionObserver(function (entries) {
        entries.filter(function (entry) { return entry.isIntersecting; })
          .forEach(function (entry, i) {
            iconObserver.unobserve(entry.target);
            inkIcon(entry.target, i);
          });
      }, { threshold: 0.5 });
      iconItems.forEach(function (item) { iconObserver.observe(item); });
    }
  };

  prepareInk();

  /* ---- first-visit opening: bird walks a pencil line ----------------
     The inline script in head.html decides whether it plays (html.intro-on)
     and the timeline itself is CSS; here: remember it, allow click-to-skip,
     and remove the overlay afterwards. */
  var overlay = document.getElementById("intro-overlay");

  if (overlay && root.classList.contains("intro-on")) {
    try { localStorage.setItem("xz-intro-played", "1"); } catch (e) { /* private mode etc. */ }

    var introDone = false;
    var endIntro = function (skipped) {
      if (introDone) return;
      introDone = true;
      if (skipped) overlay.classList.add("is-done");
      startInk();
      window.setTimeout(function () {
        overlay.remove();
        root.classList.remove("intro-on");
      }, skipped ? 300 : 400);
    };

    overlay.addEventListener("click", function () { endIntro(true); });
    window.setTimeout(function () { endIntro(false); }, 1250); // = intro-out delay in main.css
  } else {
    if (overlay) overlay.remove();
    startInk();
  }

  /* ---- typewriter on the laptop screen ------------------------------
     Only ticks while the screen is on show: not below the fold, not in a
     background tab, and not on phones, where the desk is hidden. */
  var screenEl = document.querySelector(".laptop-screen");
  var screenText = document.querySelector(".laptop-screen__text");
  if (screenEl && screenText) {
    var phrases = document.documentElement.lang === "zh-CN" ? [
      "绘制城市",
      "空中交通仿真",
      "绿地公平",
      "行人尺度 svf",
      "大模型 x 规划"
    ] : [
      "mapping cities",
      "uam simulation",
      "green space equity",
      "pedestrian svf",
      "llms x planning"
    ];

    if (reduceMotion || !canObserve) {
      screenText.textContent = phrases[0];
    } else {
      var phraseIndex = 0;
      var charIndex = 0;
      var deleting = false;
      var onScreen = false;
      var timer = null;

      var tick = function () {
        timer = null;
        if (!onScreen || document.hidden) return; // resumed by the observers below

        var phrase = phrases[phraseIndex];
        var delay;

        if (!deleting) {
          charIndex += 1;
          delay = 70;
          if (charIndex === phrase.length) {
            deleting = true;
            delay = 1700;
          }
        } else {
          charIndex -= 1;
          delay = 30;
          if (charIndex === 0) {
            deleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            delay = 380;
          }
        }

        screenText.textContent = phrase.slice(0, charIndex);
        timer = window.setTimeout(tick, delay);
      };

      var resume = function (delay) {
        if (timer === null && onScreen && !document.hidden) {
          timer = window.setTimeout(tick, delay);
        }
      };

      new IntersectionObserver(function (entries) {
        onScreen = entries[entries.length - 1].isIntersecting;
        resume(1100); // first run: let the laptop finish drawing
      }).observe(screenEl);
      document.addEventListener("visibilitychange", function () { resume(300); });
    }
  }

  /* ---- selected-work popup next to the laptop ----------------------- */
  var wrap = document.querySelector(".desk-scene-wrap");
  var projectsLink = document.querySelector(".scene-link--projects");
  var popup = document.querySelector(".desk-popup");
  if (wrap && projectsLink && popup) {
    var hideTimer = null;
    var show = function () {
      window.clearTimeout(hideTimer);
      wrap.classList.add("show-popup");
    };
    var hide = function () {
      hideTimer = window.setTimeout(function () {
        wrap.classList.remove("show-popup");
      }, 180);
    };
    [projectsLink, popup].forEach(function (el) {
      el.addEventListener("mouseenter", show);
      el.addEventListener("mouseleave", hide);
      el.addEventListener("focusin", show);
      el.addEventListener("focusout", hide);
    });

    // The popup sits outside the SVG in the DOM, so route Tab through it by
    // hand: laptop -> popup links -> the next object on the desk (and back).
    var popupLinks = popup.querySelectorAll("a");
    var sceneLinks = Array.prototype.slice.call(document.querySelectorAll(".scene-link"));
    var afterProjects = sceneLinks[sceneLinks.indexOf(projectsLink) + 1];
    var first = popupLinks[0];
    var last = popupLinks[popupLinks.length - 1];

    projectsLink.addEventListener("keydown", function (event) {
      if (event.key === "Tab" && !event.shiftKey && first) {
        event.preventDefault();
        show();
        first.focus();
      }
    });
    popup.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        projectsLink.focus();
        wrap.classList.remove("show-popup");
      } else if (event.key === "Tab" && event.shiftKey && event.target === first) {
        event.preventDefault();
        projectsLink.focus();
      } else if (event.key === "Tab" && !event.shiftKey && event.target === last && afterProjects) {
        event.preventDefault();
        afterProjects.focus();
      }
    });
  }

  /* ---- hand-drawn burst on click ------------------------------------ */
  var BURST_SVG =
    '<svg viewBox="0 0 70 70" aria-hidden="true">' +
    '<path d="M35 4 L35 16 M57 13 L49 22 M66 35 L54 35 M57 57 L49 48 M35 66 L35 54 M13 57 L21 48 M4 35 L16 35 M13 13 L21 22"/>' +
    "</svg>";

  if (!reduceMotion && wrap) {
    document.querySelectorAll(".scene-link").forEach(function (link) {
      link.addEventListener("click", function (event) {
        var rect = wrap.getBoundingClientRect();
        var burst = document.createElement("span");
        burst.className = "click-burst";
        burst.style.left = event.clientX - rect.left + "px";
        burst.style.top = event.clientY - rect.top + "px";
        burst.innerHTML = BURST_SVG;
        wrap.appendChild(burst);
        window.setTimeout(function () { burst.remove(); }, 320);

        // Plain same-tab clicks wait a beat so the burst is visible. Ctrl/Cmd/
        // Shift/Alt-clicks (new tab, new window, download) are left to the browser.
        var href = link.getAttribute("href") || "";
        var modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
        var sameTab = link.getAttribute("target") !== "_blank" && href.indexOf("mailto:") !== 0;
        if (sameTab && href && !modified && !event.defaultPrevented) {
          event.preventDefault();
          window.setTimeout(function () { window.location = href; }, 210);
        }
      });
    });
  }
})();
