"use client";

import * as React from "react";
import Cropper, { type Area } from "react-easy-crop";
import JSZip from "jszip";
import {
  UploadCloud,
  Crop as CropIcon,
  X,
  Download,
  Trash2,
  ImageOff,
  Loader2,
  ZoomIn,
} from "lucide-react";

import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog2";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { cn, formatBytes } from "@/lib/utils";
import {
  ASPECT_PRESETS,
  type AspectKey,
  type OutputFormat,
  type PixelCrop,
  cropImageToBlob,
  extensionForFormat,
  getCenteredCrop,
  loadImage,
  stripExtension,
} from "@/lib/crop";

interface ImageItem {
  id: string;
  file: File;
  url: string;
  naturalWidth: number;
  naturalHeight: number;
  aspect: AspectKey;
  manualCrop: PixelCrop | null;
  // transient editor state, kept per-image so re-opening resumes where you left off
  editorCrop: { x: number; y: number };
  editorZoom: number;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function ImageCropperApp() {
  const [images, setImages] = React.useState<ImageItem[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [globalAspect, setGlobalAspect] = React.useState<AspectKey>("square");
  const [format, setFormat] = React.useState<OutputFormat>("image/jpeg");
  const [quality, setQuality] = React.useState(0.92);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportProgress, setExportProgress] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Revoke object URLs on unmount to avoid leaking memory.
  React.useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = React.useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) =>
        f.type.startsWith("image/")
      );
      const newItems: ImageItem[] = [];
      for (const file of files) {
        const url = URL.createObjectURL(file);
        try {
          const img = await loadImage(url);
          newItems.push({
            id: makeId(),
            file,
            url,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            aspect: globalAspect,
            manualCrop: null,
            editorCrop: { x: 0, y: 0 },
            editorZoom: 1,
          });
        } catch {
          URL.revokeObjectURL(url);
        }
      }
      setImages((prev) => [...prev, ...newItems]);
    },
    [globalAspect]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((i) => i.id !== id);
    });
  };

  const clearAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
  };

  const applyAspectToAll = (aspect: AspectKey) => {
    setGlobalAspect(aspect);
    setImages((prev) =>
      prev.map((img) => ({ ...img, aspect, manualCrop: null }))
    );
  };

  const editingImage = images.find((i) => i.id === editingId) ?? null;

  const onEditorCropComplete = React.useCallback(
    (id: string, _croppedArea: Area, croppedAreaPixels: Area) => {
      setImages((prev) =>
        prev.map((img) =>
          img.id === id
            ? {
                ...img,
                manualCrop: {
                  x: croppedAreaPixels.x,
                  y: croppedAreaPixels.y,
                  width: croppedAreaPixels.width,
                  height: croppedAreaPixels.height,
                },
              }
            : img
        )
      );
    },
    []
  );

  const resolveCrop = (img: ImageItem): PixelCrop => {
    if (img.manualCrop) return img.manualCrop;
    return getCenteredCrop(
      img.naturalWidth,
      img.naturalHeight,
      ASPECT_PRESETS[img.aspect].value
    );
  };

  const exportOne = async (img: ImageItem) => {
    const crop = resolveCrop(img);
    const blob = await cropImageToBlob(img.url, crop, format, quality);
    const ext = extensionForFormat(format);
    const filename = `${stripExtension(img.file.name)}-cropped.${ext}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportAll = async () => {
    if (images.length === 0) return;
    setIsExporting(true);
    setExportProgress(0);
    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();
      const ext = extensionForFormat(format);

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const crop = resolveCrop(img);
        const blob = await cropImageToBlob(img.url, crop, format, quality);

        let base = `${stripExtension(img.file.name)}-cropped`;
        let name = `${base}.${ext}`;
        let counter = 1;
        while (usedNames.has(name)) {
          name = `${base}-${counter}.${ext}`;
          counter += 1;
        }
        usedNames.add(name);

        zip.file(name, blob);
        setExportProgress(Math.round(((i + 1) / images.length) * 100));
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cropped-images-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex items-center justify-between py-5">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Crop Bench
            </h1>
            <p className="text-sm text-muted-foreground">
              Bulk crop images to any aspect ratio — nothing leaves your
              browser.
            </p>
          </div>
          {images.length > 0 && (
            <Badge variant="outline">
              {images.length} image{images.length === 1 ? "" : "s"} loaded
            </Badge>
          )}
        </div>
      </header>

      <main className="container py-8 space-y-6">
        {/* Global controls */}
        <Card>
          <CardContent className="flex flex-wrap items-end gap-6 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="aspect-select">Aspect ratio (applies to all)</Label>
              <Select
                value={globalAspect}
                onValueChange={(v) => applyAspectToAll(v as AspectKey)}
              >
                <SelectTrigger id="aspect-select" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ASPECT_PRESETS).map(([key, preset]) => (
                    <SelectItem key={key} value={key}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="format-select">Export format</Label>
              <Select
                value={format}
                onValueChange={(v) => setFormat(v as OutputFormat)}
              >
                <SelectTrigger id="format-select" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image/jpeg">JPEG</SelectItem>
                  <SelectItem value="image/png">PNG</SelectItem>
                  <SelectItem value="image/webp">WebP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {format !== "image/png" && (
              <div className="space-y-1.5 w-[180px]">
                <Label>Quality — {Math.round(quality * 100)}%</Label>
                <Slider
                  value={[quality]}
                  min={0.4}
                  max={1}
                  step={0.02}
                  onValueChange={([v]) => setQuality(v)}
                />
              </div>
            )}

            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud />
                Add images
              </Button>
              {images.length > 0 && (
                <>
                  <Button variant="ghost" onClick={clearAll}>
                    <Trash2 />
                    Clear all
                  </Button>
                  <Button onClick={exportAll} disabled={isExporting}>
                    {isExporting ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Exporting {exportProgress}%
                      </>
                    ) : (
                      <>
                        <Download />
                        Export all as .zip
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
          </CardContent>
        </Card>

        {/* Drop zone / grid */}
        {images.length === 0 ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center cursor-pointer transition-colors",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            )}
          >
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                Drag and drop images here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Any number of files. Processed entirely on this device.
              </p>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 rounded-lg p-1 transition-colors",
              isDragging && "bg-primary/5 ring-1 ring-primary/40"
            )}
          >
            {images.map((img) => {
              const crop = resolveCrop(img);
              const cropAspect = crop.width / crop.height;
              return (
                <Card key={img.id} className="overflow-hidden group">
                  <div className="relative aspect-square bg-secondary flex items-center justify-center overflow-hidden">
                    {/* Preview approximates the crop by centering an aspect-cropped view */}
                    <div
                      className="relative w-full h-full overflow-hidden"
                      style={{ aspectRatio: cropAspect }}
                    >
                      <img
                        src={img.url}
                        alt={img.file.name}
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{
                          objectPosition: `${
                            (crop.x + crop.width / 2) / img.naturalWidth * 100
                          }% ${
                            (crop.y + crop.height / 2) / img.naturalHeight * 100
                          }%`,
                        }}
                      />
                    </div>
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Remove ${img.file.name}`}
                    >
                      <X className="h-3.5 w-3.5 text-white" />
                    </button>
                    {img.manualCrop && (
                      <Badge className="absolute bottom-1.5 left-1.5" variant="default">
                        custom crop
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <p className="truncate text-xs font-medium" title={img.file.name}>
                      {img.file.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {img.naturalWidth}×{img.naturalHeight} ·{" "}
                      {formatBytes(img.file.size)}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setEditingId(img.id)}
                      >
                        <CropIcon />
                        Edit crop
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => exportOne(img)}
                      >
                        <Download />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {images.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
            <ImageOff className="h-3.5 w-3.5" />
            No images loaded yet.
          </div>
        )}
      </main>

      {/* Per-image crop editor */}
      <Dialog open={!!editingImage} onOpenChange={(open) => !open && setEditingId(null)}>
        {editingImage && (
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Edit crop — {editingImage.file.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Aspect ratio</Label>
                <Select
                  value={editingImage.aspect}
                  onValueChange={(v) =>
                    setImages((prev) =>
                      prev.map((img) =>
                        img.id === editingImage.id
                          ? { ...img, aspect: v as AspectKey, manualCrop: null }
                          : img
                      )
                    )
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ASPECT_PRESETS).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative h-[420px] w-full rounded-md overflow-hidden bg-secondary crop-stage">
                <Cropper
                  image={editingImage.url}
                  crop={editingImage.editorCrop}
                  zoom={editingImage.editorZoom}
                  aspect={ASPECT_PRESETS[editingImage.aspect].value}
                  onCropChange={(c) =>
                    setImages((prev) =>
                      prev.map((img) =>
                        img.id === editingImage.id
                          ? { ...img, editorCrop: c }
                          : img
                      )
                    )
                  }
                  onZoomChange={(z) =>
                    setImages((prev) =>
                      prev.map((img) =>
                        img.id === editingImage.id
                          ? { ...img, editorZoom: z }
                          : img
                      )
                    )
                  }
                  onCropComplete={(area, areaPixels) =>
                    onEditorCropComplete(editingImage.id, area, areaPixels)
                  }
                />
              </div>

              <div className="flex items-center gap-3">
                <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
                <Slider
                  value={[editingImage.editorZoom]}
                  min={1}
                  max={4}
                  step={0.01}
                  onValueChange={([z]) =>
                    setImages((prev) =>
                      prev.map((img) =>
                        img.id === editingImage.id
                          ? { ...img, editorZoom: z }
                          : img
                      )
                    )
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingId(null)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
