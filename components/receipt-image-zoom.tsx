"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function ReceiptImageZoom({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("center");

  function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!zoomed) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setOrigin(`${x}% ${y}%`);
    }
    setZoomed((z) => !z);
  }

  return (
    <>
      <div className="relative inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-96 rounded-md border border-border" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Zoom image"
          className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-md bg-foreground/85 text-background transition-colors hover:bg-foreground"
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} className="h-3.5 w-3.5" />
        </button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setZoomed(false);
        }}
      >
        <DialogContent className="flex max-h-[92vh] w-full max-w-4xl items-center justify-center overflow-hidden p-2">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <div className="max-h-[85vh] w-full overflow-auto rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              onClick={handleImageClick}
              className="w-full select-none transition-transform duration-200"
              style={{
                transform: zoomed ? "scale(2)" : "scale(1)",
                transformOrigin: origin,
                cursor: zoomed ? "zoom-out" : "zoom-in",
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
