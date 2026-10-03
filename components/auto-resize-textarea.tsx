"use client";

import { useImperativeHandle, useLayoutEffect, useRef, type Ref, type TextareaHTMLAttributes } from "react";

type AutoResizeTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: Ref<HTMLTextAreaElement>;
};

function resizeTextarea(element: HTMLTextAreaElement) {
  if (!element.getClientRects().length) return;
  const styles = window.getComputedStyle(element);
  const padding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
  const border = parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
  const adjustment = styles.boxSizing === "border-box" ? border : -padding;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight + adjustment}px`;
  // Growing can introduce a scrollbar on the surrounding panel and narrow the
  // input. Measure again so the newly wrapped lines remain fully visible.
  if (element.scrollHeight > element.clientHeight) {
    element.style.height = `${element.scrollHeight + adjustment}px`;
  }
}

export function AutoResizeTextarea({ ref, value, style, onInput, ...props }: AutoResizeTextareaProps) {
  const elementRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => elementRef.current!, []);

  useLayoutEffect(() => {
    if (elementRef.current) resizeTextarea(elementRef.current);
  }, [value]);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    let previousWidth = -1;
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      // Height changes are our own writes; only remeasure when wrapping changes.
      if (entry.contentRect.width === previousWidth) return;
      previousWidth = entry.contentRect.width;
      // Write after observer delivery to avoid a resize notification loop.
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => resizeTextarea(element));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return <textarea {...props} ref={elementRef} value={value}
    style={{ ...style, resize: "none", overflow: "hidden" }}
    onInput={event => { resizeTextarea(event.currentTarget); onInput?.(event); }} />;
}
