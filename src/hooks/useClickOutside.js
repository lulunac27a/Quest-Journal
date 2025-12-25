import { useEffect } from "react";

/**
 * Calls `handler` whenever a pointer event occurs outside of the provided ref(s).
 * Listener is only attached while `enabled` is true to avoid unnecessary globals.
 */
export default function useClickOutside(refs, handler, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof handler !== "function") return;
    const list = Array.isArray(refs) ? refs : [refs];

    function isInside(target) {
      return list.some((ref) => {
        const node = ref && "current" in ref ? ref.current : ref;
        return node && node.contains && node.contains(target);
      });
    }

    function onPointer(event) {
      if (!isInside(event.target)) {
        handler(event);
      }
    }

    document.addEventListener("mousedown", onPointer, true);
    document.addEventListener("touchstart", onPointer, true);
    return () => {
      document.removeEventListener("mousedown", onPointer, true);
      document.removeEventListener("touchstart", onPointer, true);
    };
  }, [refs, handler, enabled]);
}
