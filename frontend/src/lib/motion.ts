"use client";

// STEP 2 - lightweight motion hooks. All animation honors
// prefers-reduced-motion (useReducedMotion / useCountUp snap to target,
// .reveal CSS is disabled via media query).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export function useInView<T extends Element>(threshold = 0.2): { ref: (node: T | null) => void; inView: boolean } {
  const [inView, setInView] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  const ref = useCallback(
    (node: T | null) => {
      observer.current?.disconnect();
      if (!node) return;
      observer.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.current?.disconnect();
          }
        },
        { threshold },
      );
      observer.current.observe(node);
    },
    [threshold],
  );

  return { ref, inView };
}

export function useCountUp(target: number, run: boolean, durationMs = 900): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);

  useIsoLayoutEffect(() => {
    if (!run || reduced) {
      setValue(target);
      return;
    }
    setValue(0);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, reduced, target, durationMs]);

  return value;
}