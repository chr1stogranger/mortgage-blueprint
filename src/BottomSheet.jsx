import React, { useState, useRef, useEffect } from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

export default function BottomSheet({ isOpen, onClose, title, T, children, height = "85vh" }) {
  const [isClosing, setIsClosing] = useState(false);
  const sheetRef = useRef(null);
  const dragStartY = useRef(null);

  // Close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => { setIsClosing(false); onClose(); }, 250);
  };

  // Backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  // Drag to dismiss
  const handleDragStart = (e) => {
    dragStartY.current = e.touches ? e.touches[0].clientY : e.clientY;
  };
  const handleDragEnd = (e) => {
    if (dragStartY.current === null) return;
    const endY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    if (endY - dragStartY.current > 100) handleClose();
    dragStartY.current = null;
  };

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen]);

  if (!isOpen && !isClosing) return null;

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        animation: isClosing ? "sheetFadeOut 0.25s ease forwards" : "sheetFadeIn 0.25s ease",
      }}
    >
      <div
        ref={sheetRef}
        style={{
          width: "100%", maxWidth: 500, maxHeight: height,
          background: T.elevated || "#0A0A0A",
          borderRadius: "20px 20px 0 0",
          display: "flex", flexDirection: "column",
          animation: isClosing ? "sheetSlideDown 0.25s ease forwards" : "sheetSlideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Drag handle */}
        <div
          onTouchStart={handleDragStart}
          onTouchEnd={handleDragEnd}
          style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px", cursor: "grab" }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.textTertiary || "#666" }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "4px 20px 16px",
          borderBottom: `1px solid ${T.separator || "rgba(255,255,255,0.06)"}`,
        }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: FONT, color: T.text, letterSpacing: "-0.02em" }}>{title}</h2>
          <button
            onClick={handleClose}
            style={{
              background: T.pillBg || "rgba(255,255,255,0.08)", border: "none",
              borderRadius: 9999, width: 32, height: 32,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: T.textSecondary,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "16px 20px", WebkitOverflowScrolling: "touch" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
