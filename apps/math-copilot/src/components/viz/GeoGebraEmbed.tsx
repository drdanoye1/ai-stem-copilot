"use client";
import { useEffect, useRef } from "react";
import type { VizHint } from "@/lib/api";

declare global {
  interface Window {
    GGBApplet?: new (params: Record<string, unknown>, id: string) => { inject: (id: string) => void };
  }
}

interface Props {
  hint: VizHint;
}

let _ggbLoaded = false;
let _ggbCallbacks: (() => void)[] = [];

function loadGGBScript(cb: () => void) {
  if (_ggbLoaded) { cb(); return; }
  _ggbCallbacks.push(cb);
  if (_ggbCallbacks.length > 1) return; // already loading
  const s = document.createElement("script");
  s.src = "https://www.geogebra.org/apps/deployggb.js";
  s.async = true;
  s.onload = () => {
    _ggbLoaded = true;
    _ggbCallbacks.forEach(fn => fn());
    _ggbCallbacks = [];
  };
  document.head.appendChild(s);
}

export function GeoGebraEmbed({ hint }: Props) {
  const containerId = useRef(`ggb-${Math.random().toString(36).slice(2)}`);
  const injected = useRef(false);

  useEffect(() => {
    if (injected.current) return;
    loadGGBScript(() => {
      if (!window.GGBApplet) return;
      injected.current = true;
      const params: Record<string, unknown> = {
        appName: hint.geogebra_applet ?? "geometry",
        width: "100%",
        height: 380,
        showToolBar: false,
        showAlgebraInput: false,
        showMenuBar: false,
        enableRightClick: false,
        enableShiftDragZoom: true,
        showResetIcon: true,
        language: "en",
        scaleContainerClass: containerId.current,
        preventFocus: true,
      };

      if (hint.geogebra_commands) {
        params["ggbBase64"] = undefined; // let commands run via api
      }

      const applet = new window.GGBApplet!(params, containerId.current);
      applet.inject(containerId.current);

      if (hint.geogebra_commands) {
        // Run commands after applet is ready
        const checkReady = () => {
          const el = document.getElementById(containerId.current);
          if (!el) return;
          const iframe = el.querySelector("iframe") as HTMLIFrameElement | null;
          if (!iframe?.contentWindow) {
            setTimeout(checkReady, 200);
            return;
          }
          const api = (iframe.contentWindow as any).ggbApplet;
          if (!api?.evalCommand) { setTimeout(checkReady, 200); return; }
          hint.geogebra_commands!.split("\n").filter(Boolean).forEach(cmd => {
            api.evalCommand(cmd.trim());
          });
        };
        setTimeout(checkReady, 800);
      }
    });
  }, [hint.geogebra_applet, hint.geogebra_commands]);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {hint.title && (
        <div className="px-4 py-2 text-sm font-medium text-slate-300 border-b border-white/[0.06]">
          {hint.title}
        </div>
      )}
      <div id={containerId.current} className="w-full" style={{ minHeight: 380 }} />
    </div>
  );
}
