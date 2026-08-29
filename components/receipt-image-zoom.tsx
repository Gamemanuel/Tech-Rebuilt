"use client";

import { useRef, useState } from "react";

const LENS_SIZE = 256; // px, the square lens that follows the cursor
const EXTRA_ZOOM = 1.6; // additional magnification beyond native resolution

export function ReceiptImageZoom({ src, alt }: { src: string; alt: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [natural, setNatural] = useState({ width: 0, height: 0 });
    const [displayed, setDisplayed] = useState({ width: 0, height: 0 });
    const [lensPos, setLensPos] = useState({ x: 0, y: 0 });
    const [showLens, setShowLens] = useState(false);

    function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
        const rect = containerRef.current!.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        // Keep the lens fully within the image bounds
        x = Math.max(0, Math.min(x, rect.width));
        y = Math.max(0, Math.min(y, rect.height));

        setLensPos({ x, y });
    }

    const scaleX = displayed.width ? natural.width / displayed.width : 1;
    const scaleY = displayed.height ? natural.height / displayed.height : 1;
    const zoomedWidth = natural.width * EXTRA_ZOOM;
    const zoomedHeight = natural.height * EXTRA_ZOOM;

    // Position within the zoomed background that should sit under the cursor
    const bgX = lensPos.x * scaleX * EXTRA_ZOOM;
    const bgY = lensPos.y * scaleY * EXTRA_ZOOM;

    return (
        <div
            ref={containerRef}
            className="relative inline-block select-none"
            onMouseEnter={() => setShowLens(true)}
            onMouseLeave={() => setShowLens(false)}
            onMouseMove={handleMouseMove}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={alt}
                draggable={false}
                onLoad={(e) => {
                    const img = e.currentTarget;
                    setNatural({ width: img.naturalWidth, height: img.naturalHeight });
                    setDisplayed({ width: img.width, height: img.height });
                }}
                className="max-h-96 rounded-md border border-border"
            />

            {showLens && natural.width > 0 && (
                <div
                    className="pointer-events-none absolute overflow-hidden rounded-md border-2 border-primary shadow-lg"
                    style={{
                        width: LENS_SIZE,
                        height: LENS_SIZE,
                        left: lensPos.x - LENS_SIZE / 2,
                        top: lensPos.y - LENS_SIZE / 2,
                        backgroundImage: `url(${src})`,
                        backgroundRepeat: "no-repeat",
                        backgroundSize: `${zoomedWidth}px ${zoomedHeight}px`,
                        backgroundPosition: `-${bgX - LENS_SIZE / 2}px -${bgY - LENS_SIZE / 2}px`,
                    }}
                />
            )}
        </div>
    );
}