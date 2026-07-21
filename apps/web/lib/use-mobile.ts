"use client";

import { useEffect, useState } from "react";

/**
 * True below the `md` breakpoint (768px). Defaults to false on the server so
 * desktop markup is what search engines and first paint see; flips on mount.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}
