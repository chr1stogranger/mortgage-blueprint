import React, { useEffect, useRef } from "react";

/**
 * RefiPdfPagesPreview — renders a PDF blob as white "paper" pages on canvas,
 * the way the Ops marketing flyer preview presents its letter: no browser
 * PDF-viewer chrome, no dark backdrop, each page a rounded, shadowed sheet
 * that always fills the panel's width and rescales as the panel resizes.
 *
 * pdfjs is imported lazily so it ships as its own chunk and only loads once
 * the preview panel is actually open. Rendering is debounced because a resize
 * drag fires width changes continuously and a full page raster costs ~100ms.
 */
export default function RefiPdfPagesPreview({ url, width, darkMode }) {
  const boxRef = useRef(null);
  const renderIdRef = useRef(0);
  useEffect(() => {
    if (!url || !width || width < 100) return undefined;
    const myId = ++renderIdRef.current;
    const t = setTimeout(async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
          pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        }
        const doc = await pdfjs.getDocument(url).promise;
        if (myId !== renderIdRef.current) { doc.destroy?.(); return; }
        const box = boxRef.current;
        if (!box) { doc.destroy?.(); return; }
        const frag = document.createDocumentFragment();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (myId !== renderIdRef.current) { doc.destroy?.(); return; }
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (width / base.width) * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(vp.width);
          canvas.height = Math.floor(vp.height);
          canvas.style.width = "100%";
          canvas.style.display = "block";
          // intent "print": pdfjs's display intent paces itself on
          // requestAnimationFrame, which browsers stop delivering to hidden
          // tabs — the render promise then never settles. Print intent runs
          // straight through, and this IS a print preview.
          await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp, intent: "print" }).promise;
          const sheet = document.createElement("div");
          sheet.style.cssText = `background:#fff;border-radius:10px;overflow:hidden;margin:0 0 20px;box-shadow:${
            darkMode ? "0 16px 50px rgba(0,0,0,0.5)" : "0 16px 50px rgba(10,17,32,0.18)"
          };`;
          sheet.appendChild(canvas);
          frag.appendChild(sheet);
        }
        if (myId !== renderIdRef.current) { doc.destroy?.(); return; }
        box.innerHTML = "";
        box.appendChild(frag);
        doc.destroy?.();
      } catch (e) {
        console.warn("[Blueprint] pdf page render failed:", e?.message);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [url, width, darkMode]);
  return <div ref={boxRef} />;
}
