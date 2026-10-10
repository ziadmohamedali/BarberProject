import { useEffect } from "react";

let activeLocks = 0;
let savedPageState = null;

const captureInlineStyles = (element, properties) => Object.fromEntries(
  properties.map((property) => [property, element.style[property]])
);

const restoreInlineStyles = (element, styles) => {
  Object.entries(styles).forEach(([property, value]) => {
    element.style[property] = value;
  });
};

function acquireScrollLock() {
  if (typeof window === "undefined" || typeof document === "undefined" || !document.body) return () => {};

  if (activeLocks === 0) {
    const body = document.body;
    const root = document.documentElement;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth);
    const bodyStyles = ["position", "top", "left", "width", "overflow", "paddingInlineEnd", "overscrollBehavior"];
    const rootStyles = ["overflow", "overscrollBehavior", "scrollBehavior"];
    const computedPadding = Number.parseFloat(window.getComputedStyle(body).paddingInlineEnd) || 0;

    savedPageState = {
      scrollX,
      scrollY,
      bodyStyles: captureInlineStyles(body, bodyStyles),
      rootStyles: captureInlineStyles(root, rootStyles),
    };

    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = `${-scrollY}px`;
    body.style.left = `${-scrollX}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    if (scrollbarWidth > 0) {
      body.style.paddingInlineEnd = `${computedPadding + scrollbarWidth}px`;
    }
  }

  activeLocks += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    activeLocks = Math.max(0, activeLocks - 1);
    if (activeLocks !== 0 || !savedPageState) return;

    const { scrollX, scrollY, bodyStyles, rootStyles } = savedPageState;
    restoreInlineStyles(document.body, bodyStyles);
    restoreInlineStyles(document.documentElement, rootStyles);
    savedPageState = null;
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(scrollX, scrollY);
    document.documentElement.style.scrollBehavior = rootStyles.scrollBehavior;
  };
}

export default function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    return acquireScrollLock();
  }, [locked]);
}
