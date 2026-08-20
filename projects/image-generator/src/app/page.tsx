"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  IMAGE_COUNTS,
  IMAGE_QUALITIES,
  IMAGE_SIZES,
  IMAGE_STYLES,
  type ImageCount,
  type ImageQuality,
  type ImageSize,
  type ImageStyle,
} from "@/lib/image-options";
import {
  clampCropRect,
  createAspectCrop,
  createCenteredCrop,
  exportImageDataUrl,
  resizeCropRect,
  type CropRect,
  type CropResizeHandle,
  type ExportFit,
  type ExportFormat,
} from "@/lib/image-export";
import {
  clearHistoryRecords,
  deleteHistoryRecord,
  listHistoryRecords,
  requestPersistentStorage,
  saveHistoryRecord,
  type HistoryRecord,
} from "@/lib/history-store";
import { imageCountLabel, optionLabel, previewReadyStatus, UI_COPY } from "@/lib/ui-copy";

type GeneratedImage = {
  dataUrl: string;
};

type StartJobResponse = {
  jobId?: string;
  status?: "running";
  error?: string;
};

type ImageJobResponse = {
  id: string;
  status: "running" | "succeeded" | "failed";
  images?: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type PendingHistoryMetadata = Pick<
  HistoryRecord,
  "prompt" | "mode" | "size" | "count" | "quality" | "style"
>;

type ImageDimensions = {
  width: number;
  height: number;
};

type EditorState = {
  imageIndex: number;
  sourceDataUrl: string;
  sourceDimensions: ImageDimensions;
  crop: CropRect;
  format: ExportFormat;
  quality: "low" | "medium" | "high";
  outputMode: "crop" | "reference" | "custom";
  customWidth: number;
  customHeight: number;
  fit: ExportFit;
} | null;

const PROMPT_MIN_LENGTH = 3;
const LAST_JOB_ID_STORAGE_KEY = "image-generator:last-job-id";
const JOB_POLL_INTERVAL_MS = 1500;
const MAX_REFERENCE_IMAGE_SIZE = 50 * 1024 * 1024;
const ALLOWED_REFERENCE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const EXPORT_QUALITY_VALUES = {
  low: 0.65,
  medium: 0.82,
  high: 0.95,
} as const;
const CROP_RESIZE_HANDLES: CropResizeHandle[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

function findFirstImageFile(files: FileList | File[]) {
  return Array.from(files).find((file) => file.type.startsWith("image/")) ?? null;
}

function loadImageDimensions(source: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
    image.onerror = () => reject(new Error("Unable to load image dimensions."));
    image.src = source;
  });
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<ImageSize>(IMAGE_SIZES[0]);
  const [count, setCount] = useState<ImageCount>(IMAGE_COUNTS[0]);
  const [quality, setQuality] = useState<ImageQuality>(IMAGE_QUALITIES[0]);
  const [style, setStyle] = useState<ImageStyle>(IMAGE_STYLES[0]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImagePreviewUrl, setReferenceImagePreviewUrl] = useState("");
  const [isDraggingReferenceImage, setIsDraggingReferenceImage] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [referenceImageDimensions, setReferenceImageDimensions] = useState<ImageDimensions | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorImageRef = useRef<HTMLImageElement | null>(null);
  const activePointerDragCleanupRef = useRef<(() => void) | null>(null);
  const isShiftPressedRef = useRef(false);
  const referenceImagePreviewUrlRef = useRef("");
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const pendingHistoryMetadataRef = useRef<PendingHistoryMetadata | null>(null);

  const refreshHistoryRecords = useCallback(async () => {
    try {
      setHistoryRecords(await listHistoryRecords());
    } catch {
      setNotice(UI_COPY.historyLoadFailed);
    }
  }, []);

  const replaceReferenceImagePreviewUrl = useCallback((url: string) => {
    if (referenceImagePreviewUrlRef.current) {
      URL.revokeObjectURL(referenceImagePreviewUrlRef.current);
    }

    referenceImagePreviewUrlRef.current = url;
    setReferenceImagePreviewUrl(url);
  }, []);

  const setValidatedReferenceImage = useCallback((file: File | null) => {
    if (!file) {
      return;
    }

    if (!ALLOWED_REFERENCE_IMAGE_TYPES.has(file.type)) {
      setError(UI_COPY.referenceImageInvalidType);
      return;
    }

    if (file.size > MAX_REFERENCE_IMAGE_SIZE) {
      setError(UI_COPY.referenceImageInvalidSize);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setReferenceImage(file);
    replaceReferenceImagePreviewUrl(objectUrl);
    void loadImageDimensions(objectUrl)
      .then(setReferenceImageDimensions)
      .catch(() => setReferenceImageDimensions(null));
    setError("");
  }, [replaceReferenceImagePreviewUrl]);

  const clearReferenceImage = useCallback(() => {
    setReferenceImage(null);
    setReferenceImageDimensions(null);
    replaceReferenceImagePreviewUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [replaceReferenceImagePreviewUrl]);

  const clearStoredJobId = useCallback(() => {
    localStorage.removeItem(LAST_JOB_ID_STORAGE_KEY);
  }, []);

  const clearPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const finishJob = useCallback(() => {
    clearPolling();
    activeJobIdRef.current = null;
    clearStoredJobId();
    setIsLoading(false);
    setNotice("");
  }, [clearPolling, clearStoredJobId]);

  const saveSucceededJobToHistory = useCallback(
    async (dataUrls: string[]) => {
      const metadata = pendingHistoryMetadataRef.current;
      pendingHistoryMetadataRef.current = null;

      if (!metadata || dataUrls.length === 0) {
        return;
      }

      try {
        await saveHistoryRecord({
          id: crypto.randomUUID(),
          ...metadata,
          createdAt: new Date().toISOString(),
          images: dataUrls,
        });
        await refreshHistoryRecords();
      } catch {
        setNotice(UI_COPY.historySaveFailed);
      }
    },
    [refreshHistoryRecords],
  );

  const pollJob = useCallback(
    async (jobId: string) => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        const data: Partial<ImageJobResponse> = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(UI_COPY.jobPollingFailed);
        }

        if (activeJobIdRef.current !== jobId) {
          return;
        }

        if (data.status === "succeeded") {
          const dataUrls = data.images || [];
          setImages(dataUrls.map((dataUrl) => ({ dataUrl })));
          setError("");
          finishJob();
          void saveSucceededJobToHistory(dataUrls);
          return;
        }

        if (data.status === "failed") {
          setError(data.error || UI_COPY.generationFailed);
          finishJob();
          return;
        }

        setNotice(UI_COPY.jobPollingNotice);
      } catch {
        if (activeJobIdRef.current !== jobId) {
          return;
        }

        setError(UI_COPY.jobPollingFailed);
        finishJob();
      }
    },
    [finishJob, saveSucceededJobToHistory],
  );

  const startPolling = useCallback(
    (jobId: string, initialNotice: string = UI_COPY.jobPollingNotice) => {
      clearPolling();
      activeJobIdRef.current = jobId;
      setIsLoading(true);
      setNotice(initialNotice);

      void pollJob(jobId);
      pollIntervalRef.current = setInterval(() => {
        void pollJob(jobId);
      }, JOB_POLL_INTERVAL_MS);
    },
    [clearPolling, pollJob],
  );

  useEffect(() => {
    listHistoryRecords()
      .then((records) => {
        setHistoryRecords(records);
      })
      .catch(() => {
        setNotice(UI_COPY.historyLoadFailed);
      });
    void requestPersistentStorage();

    const storedJobId = localStorage.getItem(LAST_JOB_ID_STORAGE_KEY);
    let isActive = true;

    if (storedJobId) {
      queueMicrotask(() => {
        if (!isActive) {
          return;
        }

        setError("");
        startPolling(storedJobId, UI_COPY.jobResumeNotice);
      });
    }

    return () => {
      isActive = false;
      clearPolling();
      activeJobIdRef.current = null;
    };
  }, [clearPolling, refreshHistoryRecords, startPolling]);

  useEffect(() => () => {
    if (referenceImagePreviewUrlRef.current) {
      URL.revokeObjectURL(referenceImagePreviewUrlRef.current);
      referenceImagePreviewUrlRef.current = "";
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Shift") {
        isShiftPressedRef.current = true;
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Shift") {
        isShiftPressedRef.current = false;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      isShiftPressedRef.current = false;
    };
  }, []);

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const imageFile = Array.from(event.clipboardData?.files ?? []).find((file) =>
        file.type.startsWith("image/"),
      );

      if (imageFile) {
        setValidatedReferenceImage(imageFile);
      }
    }

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [setValidatedReferenceImage]);

  const trimmedPrompt = prompt.trim();
  const promptError = useMemo(() => {
    if (!prompt.length) {
      return "";
    }

    if (trimmedPrompt.length < PROMPT_MIN_LENGTH) {
      return UI_COPY.promptTooShort;
    }

    return "";
  }, [prompt.length, trimmedPrompt.length]);

  const previewTitle = isLoading
    ? UI_COPY.previewTitleLoading
    : images.length
      ? UI_COPY.previewTitleReady
      : UI_COPY.previewTitleIdle;
  const previewStatus = isLoading
    ? UI_COPY.jobRunningStatus
    : images.length
      ? previewReadyStatus(images.length)
      : UI_COPY.previewStatusEmpty;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (trimmedPrompt.length < PROMPT_MIN_LENGTH) {
      setError(UI_COPY.promptRequired);
      return;
    }

    setIsLoading(true);
    setError("");
    setNotice(UI_COPY.jobPollingNotice);
    setImages([]);
    clearPolling();
    pendingHistoryMetadataRef.current = {
      prompt: trimmedPrompt,
      mode: referenceImage ? "edit" : "generate",
      size,
      count,
      quality,
      style,
    };

    try {
      const body = referenceImage
        ? (() => {
            const formData = new FormData();
            formData.append("image", referenceImage);
            formData.append("prompt", trimmedPrompt);
            formData.append("size", size);
            formData.append("count", String(count));
            formData.append("quality", quality);
            formData.append("style", style);

            return formData;
          })()
        : JSON.stringify({
            prompt: trimmedPrompt,
            size,
            count,
            quality,
            style,
          });

      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: referenceImage ? undefined : { "Content-Type": "application/json" },
        body,
      });

      const data: StartJobResponse = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || UI_COPY.jobStartFailed);
      }

      if (!data.jobId || data.status !== "running") {
        throw new Error(UI_COPY.jobStartFailed);
      }

      localStorage.setItem(LAST_JOB_ID_STORAGE_KEY, data.jobId);
      startPolling(data.jobId);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : UI_COPY.jobStartFailed,
      );
      clearStoredJobId();
      setIsLoading(false);
      pendingHistoryMetadataRef.current = null;
    }
  }

  function handleViewHistoryRecord(record: HistoryRecord) {
    clearPolling();
    activeJobIdRef.current = null;
    pendingHistoryMetadataRef.current = null;
    clearStoredJobId();
    setImages(record.images.map((dataUrl) => ({ dataUrl })));
    setError("");
    setNotice("");
    setIsLoading(false);
  }

  async function handleDeleteHistoryRecord(id: string) {
    try {
      await deleteHistoryRecord(id);
      await refreshHistoryRecords();
    } catch {
      setNotice(UI_COPY.historyDeleteFailed);
    }
  }

  async function handleClearHistoryRecords() {
    try {
      await clearHistoryRecords();
      await refreshHistoryRecords();
    } catch {
      setNotice(UI_COPY.historyClearFailed);
    }
  }

  function formatHistoryTime(createdAt: string) {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(createdAt));
  }

  async function openImageEditor(imageIndex: number, sourceDataUrl: string) {
    try {
      const sourceDimensions = await loadImageDimensions(sourceDataUrl);
      const crop = createCenteredCrop(sourceDimensions.width, sourceDimensions.height);

      setEditor({
        imageIndex,
        sourceDataUrl,
        sourceDimensions,
        crop,
        format: "image/png",
        quality: "medium",
        outputMode: "crop",
        customWidth: Math.round(crop.width),
        customHeight: Math.round(crop.height),
        fit: "contain",
      });
      setError("");
      setNotice("");
    } catch {
      setError(UI_COPY.editorExportFailed);
    }
  }

  function updateEditor(updater: (current: NonNullable<EditorState>) => NonNullable<EditorState>) {
    setEditor((current) => (current ? updater(current) : current));
  }

  function clearActivePointerDrag() {
    activePointerDragCleanupRef.current?.();
    activePointerDragCleanupRef.current = null;
  }

  function closeEditor() {
    clearActivePointerDrag();
    setEditor(null);
  }

  function updateEditorCrop(patch: Partial<CropRect>) {
    updateEditor((current) => ({
      ...current,
      crop: clampCropRect(
        {
          ...current.crop,
          ...patch,
        },
        current.sourceDimensions.width,
        current.sourceDimensions.height,
      ),
    }));
  }

  function resetEditorCrop() {
    updateEditor((current) => {
      const crop = createCenteredCrop(current.sourceDimensions.width, current.sourceDimensions.height);

      return {
        ...current,
        crop,
        customWidth: Math.round(crop.width),
        customHeight: Math.round(crop.height),
      };
    });
  }

  function matchReferenceRatio() {
    if (!referenceImageDimensions) {
      return;
    }

    updateEditor((current) => ({
      ...current,
      crop: createAspectCrop(
        current.sourceDimensions.width,
        current.sourceDimensions.height,
        referenceImageDimensions.width / referenceImageDimensions.height,
      ),
      outputMode: "reference",
    }));
  }

  function getEditorScale(current: NonNullable<EditorState>) {
    const rect = editorImageRef.current?.getBoundingClientRect();

    return {
      x: rect ? rect.width / current.sourceDimensions.width : 1,
      y: rect ? rect.height / current.sourceDimensions.height : 1,
    };
  }

  function moveEditorCrop(deltaX: number, deltaY: number, initialCrop?: CropRect) {
    updateEditor((current) => {
      const scale = getEditorScale(current);
      const crop = initialCrop ?? current.crop;

      return {
        ...current,
        crop: clampCropRect(
          {
            ...crop,
            x: crop.x + deltaX / scale.x,
            y: crop.y + deltaY / scale.y,
          },
          current.sourceDimensions.width,
          current.sourceDimensions.height,
        ),
      };
    });
  }

  function resizeEditorCrop(
    deltaX: number,
    deltaY: number,
    handle: CropResizeHandle,
    preserveAspect: boolean,
    initialCrop?: CropRect,
  ) {
    updateEditor((current) => {
      const scale = getEditorScale(current);
      const crop = initialCrop ?? current.crop;

      return {
        ...current,
        crop: resizeCropRect({
          crop,
          handle,
          deltaX: deltaX / scale.x,
          deltaY: deltaY / scale.y,
          imageWidth: current.sourceDimensions.width,
          imageHeight: current.sourceDimensions.height,
          minSize: 20,
          preserveAspect,
        }),
      };
    });
  }

  function startCropPointerDrag(
    event: ReactPointerEvent<HTMLDivElement | HTMLSpanElement>,
    mode: "move" | "resize",
    handle: CropResizeHandle = "se",
  ) {
    if (!editor) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    isShiftPressedRef.current = event.shiftKey;
    const startX = event.clientX;
    const startY = event.clientY;
    const initialCrop = editor.crop;
    clearActivePointerDrag();

    function handlePointerMove(moveEvent: PointerEvent) {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (mode === "move") {
        moveEditorCrop(deltaX, deltaY, initialCrop);
      } else {
        resizeEditorCrop(deltaX, deltaY, handle, moveEvent.shiftKey || isShiftPressedRef.current, initialCrop);
      }
    }

    function handlePointerUp(upEvent: PointerEvent) {
      const deltaX = upEvent.clientX - startX;
      const deltaY = upEvent.clientY - startY;
      clearActivePointerDrag();

      if (mode === "move") {
        moveEditorCrop(deltaX, deltaY, initialCrop);
      } else {
        resizeEditorCrop(deltaX, deltaY, handle, upEvent.shiftKey || isShiftPressedRef.current, initialCrop);
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    activePointerDragCleanupRef.current = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }

  async function applyEditorExport() {
    if (!editor) {
      return;
    }

    const outputWidth = editor.outputMode === "reference" && referenceImageDimensions
      ? referenceImageDimensions.width
      : editor.outputMode === "custom"
        ? editor.customWidth
        : Math.round(editor.crop.width);
    const outputHeight = editor.outputMode === "reference" && referenceImageDimensions
      ? referenceImageDimensions.height
      : editor.outputMode === "custom"
        ? editor.customHeight
        : Math.round(editor.crop.height);

    try {
      const exportedDataUrl = await exportImageDataUrl({
        sourceDataUrl: editor.sourceDataUrl,
        crop: editor.crop,
        outputWidth,
        outputHeight,
        format: editor.format,
        quality: editor.format === "image/png" ? undefined : EXPORT_QUALITY_VALUES[editor.quality],
        fit: editor.fit,
      });

      setImages((current) =>
        current.map((image, index) =>
          index === editor.imageIndex ? { dataUrl: exportedDataUrl } : image,
        ),
      );
      closeEditor();
      setError("");
    } catch {
      setError(UI_COPY.editorExportFailed);
    }
  }

  function handleReferenceImageInput(event: ChangeEvent<HTMLInputElement>) {
    setValidatedReferenceImage(findFirstImageFile(event.target.files ?? []));
  }

  function handleReferenceImageDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDraggingReferenceImage(false);
    setValidatedReferenceImage(findFirstImageFile(event.dataTransfer.files ?? []));
  }

  useEffect(() => () => {
    clearActivePointerDrag();
  }, []);

  return (
    <main className="studio-shell">
      <section className="control-panel" aria-label={UI_COPY.controlsAriaLabel}>
        <div className="brand-mark">{UI_COPY.brand}</div>
        <div className="intro-copy">
          <p className="eyebrow">{UI_COPY.eyebrow}</p>
          <h1>{UI_COPY.heroTitle}</h1>
          <p>{UI_COPY.heroDescription}</p>
        </div>

        <form className="generator-form" onSubmit={handleSubmit}>
          <div className="reference-field">
            <div className="reference-label-row">
              <span>{UI_COPY.referenceImageLabel}</span>
              {referenceImage ? (
                <button className="clear-reference-button" type="button" onClick={clearReferenceImage}>
                  {UI_COPY.referenceImageClear}
                </button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              className="reference-input"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              aria-hidden="true"
              onChange={handleReferenceImageInput}
              tabIndex={-1}
            />
            <button
              className={isDraggingReferenceImage ? "reference-dropzone is-dragging" : "reference-dropzone"}
              type="button"
              aria-describedby="reference-image-help"
              aria-label={referenceImage ? UI_COPY.referenceImageChangeAriaLabel : UI_COPY.referenceImageHint}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDraggingReferenceImage(true);
              }}
              onDragLeave={() => setIsDraggingReferenceImage(false)}
              onDrop={handleReferenceImageDrop}
            >
              {referenceImagePreviewUrl ? (
                <img src={referenceImagePreviewUrl} alt={UI_COPY.referenceImageAlt} />
              ) : (
                <span className="reference-placeholder">{UI_COPY.referenceImageHint}</span>
              )}
            </button>
            <p className="field-hint" id="reference-image-help">
              {referenceImage ? UI_COPY.referenceImageSelectedHint : UI_COPY.referenceImageHint}
            </p>
          </div>

          <label className="field prompt-field" htmlFor="prompt">
            <span>{UI_COPY.promptLabel}</span>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={UI_COPY.promptPlaceholder}
              rows={8}
              aria-describedby="prompt-help"
            />
          </label>
          <p id="prompt-help" className={promptError ? "field-hint error-text" : "field-hint"}>
            {promptError || UI_COPY.promptHint}
          </p>

          <fieldset className="option-group">
            <legend>{UI_COPY.outputGroup}</legend>
            <label className="field" htmlFor="size">
              <span>{UI_COPY.sizeLabel}</span>
              <select
                id="size"
                value={size}
                onChange={(event) => setSize(event.target.value as ImageSize)}
              >
                {IMAGE_SIZES.map((option) => (
                  <option key={option} value={option}>
                    {optionLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="count">
              <span>{UI_COPY.countLabel}</span>
              <select
                id="count"
                value={count}
                onChange={(event) => setCount(Number(event.target.value) as ImageCount)}
              >
                {IMAGE_COUNTS.map((option) => (
                  <option key={option} value={option}>
                    {imageCountLabel(option)}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset className="option-group">
            <legend>{UI_COPY.renderingGroup}</legend>
            <label className="field" htmlFor="quality">
              <span>{UI_COPY.qualityLabel}</span>
              <select
                id="quality"
                value={quality}
                onChange={(event) => setQuality(event.target.value as ImageQuality)}
              >
                {IMAGE_QUALITIES.map((option) => (
                  <option key={option} value={option}>
                    {optionLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="style">
              <span>{UI_COPY.styleLabel}</span>
              <select
                id="style"
                value={style}
                onChange={(event) => setStyle(event.target.value as ImageStyle)}
              >
                {IMAGE_STYLES.map((option) => (
                  <option key={option} value={option}>
                    {optionLabel(option)}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          {error ? <div className="error-banner" role="alert">{error}</div> : null}
          {notice && !error ? <p className="field-hint">{notice}</p> : null}

          <button className="generate-button" type="submit" disabled={isLoading}>
            {isLoading ? UI_COPY.generateLoading : UI_COPY.generateIdle}
          </button>
        </form>
      </section>

      <section className="preview-panel" aria-label={UI_COPY.previewAriaLabel}>
        <div className="preview-header">
          <div>
            <p className="eyebrow">{isLoading ? UI_COPY.previewEyebrowLoading : UI_COPY.previewEyebrowIdle}</p>
            <h2>{previewTitle}</h2>
          </div>
          <span className="status-pill">{previewStatus}</span>
        </div>

        <div className={isLoading || images.length ? "preview-grid" : "preview-empty"}>
          {isLoading ? (
            Array.from({ length: count }).map((_, index) => (
              <div className="image-card skeleton" key={index}>
                <span />
              </div>
            ))
          ) : images.length ? (
            images.map((image, index) => (
              <article className="image-card" key={image.dataUrl.slice(0, 48) + index}>
                <img
                  src={image.dataUrl}
                  alt={UI_COPY.generatedImageAlt.replace("{index}", String(index + 1))}
                />
                <a href={image.dataUrl} download={`generated-image-${index + 1}.png`}>
                  {UI_COPY.downloadPng}
                </a>
                <button className="image-edit-button" type="button" onClick={() => void openImageEditor(index, image.dataUrl)}>
                  {UI_COPY.editImage}
                </button>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <div className="orb" />
              <p>{UI_COPY.emptyState}</p>
            </div>
          )}
        </div>

        <section className="history-panel" aria-labelledby="history-heading">
          <div className="history-header">
            <div>
              <h2 id="history-heading">{UI_COPY.historyHeading}</h2>
              <p>{UI_COPY.historySavedCount.replace("{count}", String(historyRecords.length))}</p>
            </div>
            {historyRecords.length ? (
              <button className="history-clear-button" type="button" onClick={handleClearHistoryRecords}>
                {UI_COPY.historyClearAll}
              </button>
            ) : null}
          </div>
          <p className="history-notice">{UI_COPY.historyLocalNotice}</p>
          {historyRecords.length ? (
            <div className="history-list">
              {historyRecords.map((record) => (
                <article className="history-item" key={record.id}>
                  <img src={record.images[0]} alt={UI_COPY.historyImageAlt} />
                  <div className="history-item-body">
                    <p className="history-prompt">{record.prompt}</p>
                    <div className="history-meta">
                      <span>{formatHistoryTime(record.createdAt)}</span>
                      <span>{record.mode === "edit" ? UI_COPY.historyModeEdit : UI_COPY.historyModeGenerate}</span>
                    </div>
                  </div>
                  <div className="history-actions">
                    <button type="button" onClick={() => handleViewHistoryRecord(record)}>
                      {UI_COPY.historyView}
                    </button>
                    <button type="button" onClick={() => void handleDeleteHistoryRecord(record.id)}>
                      {UI_COPY.historyDelete}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="history-empty">{UI_COPY.historyEmpty}</p>
          )}
        </section>
      </section>
      {editor ? (
        <div className="editor-backdrop" role="dialog" aria-modal="true" aria-labelledby="image-editor-heading">
          <section className="editor-panel">
            <div className="editor-header">
              <h2 id="image-editor-heading">{UI_COPY.editorHeading}</h2>
              <button type="button" onClick={closeEditor}>{UI_COPY.editorClose}</button>
            </div>
            <div className="editor-layout">
              <div className="editor-canvas">
                <div className="editor-image-frame">
                  <img ref={editorImageRef} src={editor.sourceDataUrl} alt={UI_COPY.editorSourceAlt} />
                  <div
                    className="crop-rect"
                    style={{
                      left: `${(editor.crop.x / editor.sourceDimensions.width) * 100}%`,
                      top: `${(editor.crop.y / editor.sourceDimensions.height) * 100}%`,
                      width: `${(editor.crop.width / editor.sourceDimensions.width) * 100}%`,
                      height: `${(editor.crop.height / editor.sourceDimensions.height) * 100}%`,
                    }}
                    onPointerDown={(event) => startCropPointerDrag(event, "move")}
                  >
                    {CROP_RESIZE_HANDLES.map((handle) => (
                      <span
                        aria-hidden="true"
                        className={`crop-handle crop-handle-${handle}`}
                        key={handle}
                        title={`${UI_COPY.editorResizeHandleLabel} ${handle}`}
                        onPointerDown={(event) => startCropPointerDrag(event, "resize", handle)}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="editor-controls">
                <button type="button" onClick={resetEditorCrop}>{UI_COPY.editorResetCrop}</button>
                {referenceImageDimensions ? (
                  <button type="button" onClick={matchReferenceRatio}>{UI_COPY.editorMatchReferenceRatio}</button>
                ) : null}
                <label className="field">
                  <span>{UI_COPY.editorFormat}</span>
                  <select
                    value={editor.format}
                    onChange={(event) => updateEditor((current) => ({ ...current, format: event.target.value as ExportFormat }))}
                  >
                    <option value="image/png">PNG</option>
                    <option value="image/jpeg">JPEG</option>
                    <option value="image/webp">WebP</option>
                  </select>
                </label>
                <label className="field">
                  <span>{UI_COPY.editorQuality}</span>
                  <select
                    value={editor.quality}
                    onChange={(event) => updateEditor((current) => ({ ...current, quality: event.target.value as "low" | "medium" | "high" }))}
                  >
                    <option value="low">{optionLabel("low")}</option>
                    <option value="medium">{optionLabel("medium")}</option>
                    <option value="high">{optionLabel("high")}</option>
                  </select>
                </label>
                <label className="field">
                  <span>{UI_COPY.editorOutputSize}</span>
                  <select
                    value={editor.outputMode}
                    onChange={(event) => updateEditor((current) => ({ ...current, outputMode: event.target.value as "crop" | "reference" | "custom" }))}
                  >
                    <option value="crop">{UI_COPY.editorOutputCrop}</option>
                    {referenceImageDimensions ? <option value="reference">{UI_COPY.editorOutputReference}</option> : null}
                    <option value="custom">{UI_COPY.editorOutputCustom}</option>
                  </select>
                </label>
                {editor.outputMode === "custom" ? (
                  <div className="custom-size-grid">
                    <label className="field">
                      <span>{UI_COPY.editorWidth}</span>
                      <input
                        type="number"
                        min="1"
                        value={editor.customWidth}
                        onChange={(event) => updateEditor((current) => ({ ...current, customWidth: Number(event.target.value) || 1 }))}
                      />
                    </label>
                    <label className="field">
                      <span>{UI_COPY.editorHeight}</span>
                      <input
                        type="number"
                        min="1"
                        value={editor.customHeight}
                        onChange={(event) => updateEditor((current) => ({ ...current, customHeight: Number(event.target.value) || 1 }))}
                      />
                    </label>
                  </div>
                ) : null}
                <div className="crop-input-grid">
                  <label className="field">
                    <span>{UI_COPY.editorCropX}</span>
                    <input
                      type="number"
                      min="0"
                      value={Math.round(editor.crop.x)}
                      onChange={(event) => updateEditorCrop({ x: Number(event.target.value) || 0 })}
                    />
                  </label>
                  <label className="field">
                    <span>{UI_COPY.editorCropY}</span>
                    <input
                      type="number"
                      min="0"
                      value={Math.round(editor.crop.y)}
                      onChange={(event) => updateEditorCrop({ y: Number(event.target.value) || 0 })}
                    />
                  </label>
                  <label className="field">
                    <span>{UI_COPY.editorCropWidth}</span>
                    <input
                      type="number"
                      min="1"
                      value={Math.round(editor.crop.width)}
                      onChange={(event) => updateEditorCrop({ width: Number(event.target.value) || 1 })}
                    />
                  </label>
                  <label className="field">
                    <span>{UI_COPY.editorCropHeight}</span>
                    <input
                      type="number"
                      min="1"
                      value={Math.round(editor.crop.height)}
                      onChange={(event) => updateEditorCrop({ height: Number(event.target.value) || 1 })}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>{UI_COPY.editorFit}</span>
                  <select
                    value={editor.fit}
                    onChange={(event) => updateEditor((current) => ({ ...current, fit: event.target.value as ExportFit }))}
                  >
                    <option value="contain">{UI_COPY.editorFitContain}</option>
                    <option value="cover">{UI_COPY.editorFitCover}</option>
                  </select>
                </label>
                <button className="generate-button" type="button" onClick={() => void applyEditorExport()}>
                  {UI_COPY.editorApply}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
