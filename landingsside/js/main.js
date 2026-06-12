/* Akse landingsside — scroll-avsløring.
   Vanlig script (ikke modul) slik at siden fungerer rett fra fil (file://). */
(function () {
  "use strict";

  // Marker at JS kjører — først da skjuler CSS-en .reveal-elementene.
  document.documentElement.classList.add("har-js");

  var elementer = document.querySelectorAll(".reveal");

  var reduserBevegelse =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduserBevegelse || !("IntersectionObserver" in window)) {
    elementer.forEach(function (el) { el.classList.add("er-synlig"); });
    return;
  }

  var observer = new IntersectionObserver(
    function (oppfoeringer) {
      oppfoeringer.forEach(function (oppfoering) {
        if (oppfoering.isIntersecting) {
          oppfoering.target.classList.add("er-synlig");
          observer.unobserve(oppfoering.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  elementer.forEach(function (el, indeks) {
    // Litt forskjøvet inntreden for naboelementer i samme rad.
    el.style.transitionDelay = (indeks % 4) * 60 + "ms";
    observer.observe(el);
  });
})();
