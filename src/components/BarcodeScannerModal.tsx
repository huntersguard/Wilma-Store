import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  Zap,
  ZapOff,
  ZoomIn,
  X,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Upload,
  Sparkles,
  Target,
  Crosshair,
  Smartphone,
  ShoppingCart,
  Check,
  Shield,
  Plus,
  SwitchCamera,
  FlipHorizontal,
} from 'lucide-react';
import { playScanBeep } from '../utils/audio';

export interface BarcodeScanFeedback {
  productName: string;
  price: number;
  barcode: string;
  success: boolean;
  timestamp: number;
}

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  subtitle?: string;
  continuous?: boolean;
  scanFeedback?: BarcodeScanFeedback | null;
  onAddUnfoundBarcode?: (barcode: string) => void;
  cartSummary?: {
    totalItems: number;
    totalAmount: number;
  };
}

// Define BarcodeDetector types for TypeScript
declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

// Module-level anti-burst cooldown: minimum 2.5 seconds between any barcode scans
let globalLastScannedTimestamp = 0;

/**
 * Forcefully stop and release all video stream tracks across the browser DOM
 */
export function killAllVideoTracks() {
  try {
    if (typeof document !== 'undefined') {
      document.querySelectorAll('video').forEach((v) => {
        try {
          v.pause();
          const st = v.srcObject as MediaStream | null;
          if (st && typeof st.getTracks === 'function') {
            st.getTracks().forEach((track) => {
              track.enabled = false;
              track.stop();
            });
          }
          v.srcObject = null;
        } catch {}
      });
    }
  } catch {}
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Barcode',
  subtitle = 'Itutok ang camera sa barcode. May high-precision scanner at zoom para sa maliliit na barcode.',
  continuous = false,
  scanFeedback = null,
  onAddUnfoundBarcode,
  cartSummary,
}) => {
  const isIOSDevice = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraError, setHasCameraError] = useState<string | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [supportsTorch, setSupportsTorch] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [supportsZoom, setSupportsZoom] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [isNativeHardwareEngine, setIsNativeHardwareEngine] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [snapshotFeedback, setSnapshotFeedback] = useState<string | null>(null);
  const [antiShakeMode, setAntiShakeMode] = useState<boolean>(() => isIOSDevice);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scannerContainerId = 'interactive-barcode-viewport';
  const lastBgDejitterTimeRef = useRef<number>(0);

  // Strict Lifecycle & Anti-Loop Refs
  const isScannerActiveRef = useRef<boolean>(false);
  const hasEmittedScanRef = useRef<boolean>(false);
  const scanSessionIdRef = useRef<number>(0);
  const continuousCooldownRef = useRef<number>(0);
  const continuousLastCodeRef = useRef<string>('');

  useEffect(() => {
    if (!isOpen) {
      hasEmittedScanRef.current = true;
      isScannerActiveRef.current = false;
      scanSessionIdRef.current = 0;
      continuousCooldownRef.current = 0;
      continuousLastCodeRef.current = '';
      stopCamera();
      setLastScannedCode(null);
      setHasCameraError(null);
      return;
    }

    // Reset scanner state on open
    hasEmittedScanRef.current = false;
    isScannerActiveRef.current = true;
    scanSessionIdRef.current = Date.now();
    continuousCooldownRef.current = 0;
    continuousLastCodeRef.current = '';

    if (activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      hasEmittedScanRef.current = true;
      isScannerActiveRef.current = false;
      scanSessionIdRef.current = 0;
      stopCamera();
    };
  }, [isOpen, activeTab]);

  /**
   * Barcode Handler:
   * - In Continuous Mode: Emits onScan, beeps, sets feedback, but keeps the camera & modal running!
   * - In Single-Fire Mode: Cancels loops, stops camera, triggers beep, and closes modal.
   */
  const handleBarcodeDetected = (decodedText: string) => {
    const cleanText = decodedText.trim();
    if (!cleanText) return;

    const now = Date.now();

    if (continuous) {
      // In continuous mode:
      // Prevent duplicate burst of SAME code within 1600ms, and ANY scan within 850ms
      if (
        now - continuousCooldownRef.current < 850 ||
        (continuousLastCodeRef.current === cleanText && now - continuousCooldownRef.current < 1600)
      ) {
        return;
      }

      if (!isScannerActiveRef.current) return;

      continuousCooldownRef.current = now;
      continuousLastCodeRef.current = cleanText;

      setLastScannedCode(cleanText);
      playScanBeep();
      onScan(cleanText);
      // Stay open and keep camera active for next scan!
      return;
    }

    // Single-fire mode:
    if (now - globalLastScannedTimestamp < 2000) {
      return;
    }

    if (hasEmittedScanRef.current || !isScannerActiveRef.current) {
      return;
    }

    globalLastScannedTimestamp = now;
    hasEmittedScanRef.current = true;
    isScannerActiveRef.current = false;
    scanSessionIdRef.current = 0;

    // Immediately stop camera and kill all loops & hardware tracks
    killAllVideoTracks();
    stopCamera();

    setLastScannedCode(cleanText);
    playScanBeep();

    // Call onScan and close scanner modal immediately
    onScan(cleanText);
    onClose();
  };

  /**
   * Start Camera with High Accuracy Dual Engine:
   * 1. Primary: Native hardware BarcodeDetector (iOS Safari 17+, Chrome Android)
   * 2. Fallback: Html5Qrcode with full-frame multi-pass scanner
   */
  const startCamera = async (targetFacingMode?: 'environment' | 'user') => {
    try {
      setHasCameraError(null);
      await stopCamera();

      // Reset activity refs for new start
      hasEmittedScanRef.current = false;
      isScannerActiveRef.current = true;
      const currentSessionId = Date.now();
      scanSessionIdRef.current = currentSessionId;

      const activeFacing = targetFacingMode || cameraFacingMode;

      // Check if native BarcodeDetector API is supported
      const hasNativeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
      setIsNativeHardwareEngine(hasNativeDetector);

      if (hasNativeDetector) {
        await startNativeBarcodeDetector(currentSessionId, activeFacing);
      } else {
        await startHtml5QrcodeEngine(currentSessionId, activeFacing);
      }
      setIsScanning(true);
    } catch (err: any) {
      console.error('Camera startup error:', err);
      // Fallback to Html5Qrcode if native engine threw
      try {
        console.log('Falling back to Html5Qrcode engine...');
        const currentSessionId = Date.now();
        scanSessionIdRef.current = currentSessionId;
        const activeFacing = targetFacingMode || cameraFacingMode;
        await startHtml5QrcodeEngine(currentSessionId, activeFacing);
        setIsScanning(true);
      } catch (fallbackErr: any) {
        isScannerActiveRef.current = false;
        setIsScanning(false);
        setHasCameraError(
          fallbackErr?.message ||
            err?.message ||
            'Hindi mabuksan ang camera. Pakitingnan ang pahintulot sa browser o i-type ang barcode.'
        );
      }
    }
  };

  /**
   * ENGINE 1: Native Hardware BarcodeDetector
   * Uses Apple Vision / Google MLKit hardware acceleration at 60 FPS
   */
  const startNativeBarcodeDetector = async (sessionId: number, facing: 'environment' | 'user') => {
    const video = document.getElementById('native-scanner-video') as HTMLVideoElement | null;
    if (!video) throw new Error('Video element not found');

    const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: facing === 'user' ? 'user' : { ideal: 'environment' },
        width: isIOS ? { ideal: 1280, max: 1280 } : { ideal: 1920, min: 1280 },
        height: isIOS ? { ideal: 720, max: 720 } : { ideal: 1080, min: 720 },
        frameRate: isIOS ? { ideal: 24, max: 30 } : { ideal: 30, max: 30 },
      },
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    // If modal was closed or session cancelled during getUserMedia, abort immediately!
    if (!isScannerActiveRef.current || hasEmittedScanRef.current || scanSessionIdRef.current !== sessionId) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    streamRef.current = stream;
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.muted = true;

    await video.play();

    // Inspect capabilities (Zoom & Torch & Continuous Autofocus)
    const track = stream.getVideoTracks()[0];
    if (track && track.getCapabilities) {
      const caps = track.getCapabilities() as any;
      if ('torch' in caps) setSupportsTorch(true);
      if ('zoom' in caps && caps.zoom) setSupportsZoom(true);

      // Lock autofocus if supported to prevent jitter hunting
      try {
        if (typeof (track as any).applyConstraints === 'function') {
          await (track as any).applyConstraints({
            advanced: [{ focusMode: 'continuous' }],
          });
        }
      } catch {}
    }

    // Supported formats
    const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'itf'];
    const detector = new window.BarcodeDetector({ formats });

    const scanLoop = async () => {
      // 1. Strict guard: If session expired, stopped, or scan was already emitted, KILL loop immediately!
      if (
        scanSessionIdRef.current !== sessionId ||
        !isScannerActiveRef.current ||
        hasEmittedScanRef.current
      ) {
        return;
      }

      if (video && video.readyState >= 2) {
        try {
          // Pass A: Direct raw video detection
          const barcodes = await detector.detect(video);

          // 2. Strict guard after async detect: verify still active
          if (
            scanSessionIdRef.current !== sessionId ||
            !isScannerActiveRef.current ||
            hasEmittedScanRef.current
          ) {
            return;
          }

          if (barcodes && barcodes.length > 0) {
            const result = barcodes[0].rawValue;
            if (result && result.trim()) {
              handleBarcodeDetected(result.trim());
              if (!continuous) {
                return; // Do NOT schedule next frame if single-fire!
              }
            }
          }

          // Pass B: Anti-Shake Background De-Jitter Pass for vibrating / jittery iPhone camera
          const now = Date.now();
          if (antiShakeMode && now - lastBgDejitterTimeRef.current > 320) {
            lastBgDejitterTimeRef.current = now;
            try {
              const vw = video.videoWidth || 1280;
              const vh = video.videoHeight || 720;
              const cropW = Math.max(120, Math.floor(vw * 0.75));
              const cropH = Math.max(80, Math.floor(vh * 0.55));
              const startX = Math.max(0, Math.floor((vw - cropW) / 2));
              const startY = Math.max(0, Math.floor((vh - cropH) / 2));

              const stillCanvas = document.createElement('canvas');
              stillCanvas.width = cropW;
              stillCanvas.height = cropH;
              const sCtx = stillCanvas.getContext('2d');
              if (sCtx) {
                sCtx.drawImage(video, startX, startY, cropW, cropH, 0, 0, cropW, cropH);
                const sharpCanvas = applySharpeningFilter(stillCanvas);
                const sharpBarcodes = await detector.detect(sharpCanvas);
                if (sharpBarcodes && sharpBarcodes.length > 0 && sharpBarcodes[0].rawValue) {
                  const code = sharpBarcodes[0].rawValue.trim();
                  if (code) {
                    handleBarcodeDetected(code);
                    if (!continuous) return;
                  }
                }
              }
            } catch {
              // ignore de-jitter frame errors
            }
          }
        } catch {
          // ignore detection frame errors
        }
      }

      // 3. Reschedule next frame ONLY if scanner is still active and valid
      if (
        scanSessionIdRef.current === sessionId &&
        isScannerActiveRef.current &&
        (continuous || !hasEmittedScanRef.current)
      ) {
        animationFrameRef.current = requestAnimationFrame(scanLoop);
      }
    };

    animationFrameRef.current = requestAnimationFrame(scanLoop);
  };

  /**
   * ENGINE 2: Html5Qrcode Fallback Engine
   */
  const startHtml5QrcodeEngine = async (sessionId: number, facing: 'environment' | 'user') => {
    await new Promise((r) => setTimeout(r, 120));

    if (scanSessionIdRef.current !== sessionId || !isScannerActiveRef.current || (!continuous && hasEmittedScanRef.current)) {
      return;
    }

    const element = document.getElementById(scannerContainerId);
    if (!element) return;

    const formatsToSupport = [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.ITF,
    ];

    const html5QrCode = new Html5Qrcode(scannerContainerId, {
      formatsToSupport,
      verbose: false,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true,
      },
    });
    html5QrCodeRef.current = html5QrCode;

    const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const config = {
      fps: isIOS ? 15 : 20,
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
        width: Math.floor(viewfinderWidth * 0.88),
        height: Math.floor(viewfinderHeight * 0.75),
      }),
      aspectRatio: 1.0,
      disableFlip: false,
    };

    await html5QrCode.start(
      { facingMode: facing === 'user' ? 'user' : 'environment' },
      config,
      (decodedText) => {
        // Strict guard against multiple triggers in single-fire mode
        if (
          scanSessionIdRef.current !== sessionId ||
          !isScannerActiveRef.current ||
          (!continuous && hasEmittedScanRef.current)
        ) {
          return;
        }
        handleBarcodeDetected(decodedText);
      },
      () => {}
    );

    // Set iOS playsinline
    const videoElem = document.querySelector(`#${scannerContainerId} video`) as HTMLVideoElement | null;
    if (videoElem) {
      videoElem.setAttribute('playsinline', 'true');
      videoElem.setAttribute('webkit-playsinline', 'true');
      videoElem.muted = true;
    }
  };

  /**
   * Stop Camera and completely clean up all streams, loops, and video elements
   */
  const stopCamera = async () => {
    isScannerActiveRef.current = false;
    scanSessionIdRef.current = 0;

    // Immediately stop and disable all video tracks across the document
    killAllVideoTracks();

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.enabled = false;
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }

    const nativeVideo =
      videoRef.current || (document.getElementById('native-scanner-video') as HTMLVideoElement | null);
    if (nativeVideo) {
      try {
        nativeVideo.pause();
        nativeVideo.srcObject = null;
      } catch {}
    }

    if (html5QrCodeRef.current) {
      const qrInstance = html5QrCodeRef.current;
      html5QrCodeRef.current = null;
      try {
        if (qrInstance.isScanning) {
          await qrInstance.stop();
        }
        await qrInstance.clear();
      } catch (err) {
        // Ignored safe cleanup error if container was already unmounted
      }
    }

    setIsScanning(false);
    setTorchEnabled(false);
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !supportsTorch) return;
    try {
      const nextState = !torchEnabled;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchEnabled(nextState);
    } catch (err) {
      console.warn('Torch error:', err);
    }
  };

  const toggleFacingMode = async () => {
    const nextMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextMode);
    await startCamera(nextMode);
  };

  const setZoom = async (newZoom: number) => {
    setZoomLevel(newZoom);

    // 1. Digital Viewport Zoom: Instant GPU-accelerated magnification across ALL devices & iPhones
    const nativeVideo = document.getElementById('native-scanner-video') as HTMLVideoElement | null;
    const html5Video = document.querySelector(`#${scannerContainerId} video`) as HTMLVideoElement | null;
    [nativeVideo, html5Video].forEach((v) => {
      if (v) {
        v.style.transform = `scale(${newZoom})`;
        v.style.transformOrigin = 'center center';
        v.style.transition = 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)';
      }
    });

    // 2. Hardware camera zoom if supported by device
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (track && typeof (track as any).applyConstraints === 'function') {
        await (track as any).applyConstraints({
          advanced: [{ zoom: newZoom }],
        });
      }
    } catch {}
  };

  /**
   * Helper: Crop source canvas to the exact center Crosshair Reticle (Region of Interest)
   * Adjusted proportionally by current zoom level so zoomed barcodes remain razor-sharp
   */
  const cropCanvasToCrosshair = (
    sourceCanvas: HTMLCanvasElement,
    roiWidthRatio = 0.85,
    roiHeightRatio = 0.65,
    currentZoom = 1
  ): HTMLCanvasElement => {
    const cropCanvas = document.createElement('canvas');
    const scale = Math.max(1, currentZoom);

    // Crop the center region visible inside the reticle
    const cropW = Math.max(80, Math.floor((sourceCanvas.width * roiWidthRatio) / scale));
    const cropH = Math.max(80, Math.floor((sourceCanvas.height * roiHeightRatio) / scale));
    const startX = Math.max(0, Math.floor((sourceCanvas.width - cropW) / 2));
    const startY = Math.max(0, Math.floor((sourceCanvas.height - cropH) / 2));

    cropCanvas.width = Math.min(1280, Math.floor(cropW * scale));
    cropCanvas.height = Math.min(1280, Math.floor(cropH * scale));
    const ctx = cropCanvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceCanvas, startX, startY, cropW, cropH, 0, 0, cropCanvas.width, cropCanvas.height);
    }
    return cropCanvas;
  };

  /**
   * Helper: 3x3 Laplacian Unsharp-Mask Sharpening Filter
   * Reverses micro-motion blur and edge-jitter from trembling iPhone XR camera
   */
  const applySharpeningFilter = (sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    const sharpCanvas = document.createElement('canvas');
    sharpCanvas.width = sourceCanvas.width;
    sharpCanvas.height = sourceCanvas.height;
    const ctx = sharpCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return sourceCanvas;
    ctx.drawImage(sourceCanvas, 0, 0);

    try {
      const imgData = ctx.getImageData(0, 0, sharpCanvas.width, sharpCanvas.height);
      const src = imgData.data;
      const output = ctx.createImageData(sharpCanvas.width, sharpCanvas.height);
      const dst = output.data;
      const w = sharpCanvas.width;
      const h = sharpCanvas.height;

      // 3x3 sharpening kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0]
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          const top = ((y - 1) * w + x) * 4;
          const btm = ((y + 1) * w + x) * 4;
          const lft = (y * w + (x - 1)) * 4;
          const rgt = (y * w + (x + 1)) * 4;

          for (let c = 0; c < 3; c++) {
            const val = 5 * src[idx + c] - (src[top + c] + src[btm + c] + src[lft + c] + src[rgt + c]);
            dst[idx + c] = val < 0 ? 0 : val > 255 ? 255 : val;
          }
          dst[idx + 3] = 255;
        }
      }
      ctx.putImageData(output, 0, 0);
      return sharpCanvas;
    } catch {
      return sourceCanvas;
    }
  };

  /**
   * Helper: Rotate canvas 90 degrees in case barcode is tilted or orientation is vertical
   */
  const rotateCanvas90 = (sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    const rotCanvas = document.createElement('canvas');
    rotCanvas.width = sourceCanvas.height;
    rotCanvas.height = sourceCanvas.width;
    const ctx = rotCanvas.getContext('2d');
    if (!ctx) return sourceCanvas;
    ctx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
    return rotCanvas;
  };

  /**
   * Helper: Boost contrast and convert to grayscale to sharpen blurry / shaking barcodes
   */
  const enhanceBarcodeContrast = (sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    const enhancedCanvas = document.createElement('canvas');
    enhancedCanvas.width = sourceCanvas.width;
    enhancedCanvas.height = sourceCanvas.height;
    const ctx = enhancedCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return sourceCanvas;

    ctx.drawImage(sourceCanvas, 0, 0);
    try {
      const imgData = ctx.getImageData(0, 0, enhancedCanvas.width, enhancedCanvas.height);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        // Luminance formula
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // High contrast stretching
        const contrast = (gray - 128) * 1.85 + 128;
        const finalVal = contrast < 0 ? 0 : contrast > 255 ? 255 : contrast;
        data[i] = finalVal;
        data[i + 1] = finalVal;
        data[i + 2] = finalVal;
      }
      ctx.putImageData(imgData, 0, 0);
      return enhancedCanvas;
    } catch {
      return sourceCanvas;
    }
  };

  /**
   * Helper: Multi-engine decoder on a single canvas candidate with multi-pass filters
   */
  const decodeFromCanvasCandidate = async (candidateCanvas: HTMLCanvasElement): Promise<string | null> => {
    // 1. Try Native BarcodeDetector (hardware accelerated)
    if ('BarcodeDetector' in window) {
      try {
        const detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'itf'],
        });
        const barcodes = await detector.detect(candidateCanvas);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          return barcodes[0].rawValue.trim();
        }
      } catch {}
    }

    // 2. Try Html5Qrcode ZXing engine
    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        candidateCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
      });
      if (blob) {
        const file = new File([blob], 'snapshot.jpg', { type: 'image/jpeg' });
        const scanner = html5QrCodeRef.current || new Html5Qrcode('file-scanner-temp', { verbose: false });
        const res = await scanner.scanFileV2(file, true);
        if (res?.decodedText) {
          return res.decodedText.trim();
        }
      }
    } catch {}

    return null;
  };

  /**
   * 🎯 3-SHOT ANTI-SHAKE BURST SCAN (Special iPhone XR Stabilization):
   * Captures 3 fast micro-frames spaced 60ms apart to catch the still apex
   * of the mechanical OIS camera oscillation, applies sharpening filters, and decodes.
   */
  const handleBurstAntiShakeScan = async () => {
    if (hasEmittedScanRef.current) return;
    setIsProcessingPhoto(true);
    setSnapshotFeedback('Kumukuha ng 3 anti-shake frames at inaalis ang motion blur...');

    try {
      let video: HTMLVideoElement | null = null;
      if (isNativeHardwareEngine) {
        video = document.getElementById('native-scanner-video') as HTMLVideoElement | null;
      } else {
        video = document.querySelector(`#${scannerContainerId} video`) as HTMLVideoElement | null;
      }

      if (!video) throw new Error('Video not active');

      // 3 Burst attempts across time to catch zero-velocity pause in camera vibration
      for (let burstIdx = 0; burstIdx < 3; burstIdx++) {
        if (burstIdx > 0) {
          await new Promise((r) => setTimeout(r, 65));
        }

        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = video.videoWidth || 1280;
        fullCanvas.height = video.videoHeight || 720;
        const ctx = fullCanvas.getContext('2d');
        if (!ctx) continue;
        ctx.drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height);

        // Candidate 1: Center Crosshair Crop
        const crosshairCanvas = cropCanvasToCrosshair(fullCanvas, 0.85, 0.65, zoomLevel);
        let decoded = await decodeFromCanvasCandidate(crosshairCanvas);
        if (decoded) {
          handleBarcodeDetected(decoded);
          return;
        }

        // Candidate 2: Sharpened Crosshair with Laplacian unsharp-mask filter (reverses shake blur)
        const sharpCrosshair = applySharpeningFilter(crosshairCanvas);
        decoded = await decodeFromCanvasCandidate(sharpCrosshair);
        if (decoded) {
          handleBarcodeDetected(decoded);
          return;
        }

        // Candidate 3: High-contrast binarized Crosshair
        const contrastCrosshair = enhanceBarcodeContrast(crosshairCanvas);
        decoded = await decodeFromCanvasCandidate(contrastCrosshair);
        if (decoded) {
          handleBarcodeDetected(decoded);
          return;
        }

        // Candidate 4: Rotated 90 degrees
        const rotCrosshair = rotateCanvas90(sharpCrosshair);
        decoded = await decodeFromCanvasCandidate(rotCrosshair);
        if (decoded) {
          handleBarcodeDetected(decoded);
          return;
        }

        // Candidate 5: Sharpened Full-frame
        const sharpFull = applySharpeningFilter(fullCanvas);
        decoded = await decodeFromCanvasCandidate(sharpFull);
        if (decoded) {
          handleBarcodeDetected(decoded);
          return;
        }
      }

      // If not recognized after 3 bursts
      setSnapshotFeedback('Hindi pa nabasa. Ipuwesto ang barcode mga 4-5 pulgada o gamitin ang "📷 Phone Camera App" sa ibaba.');
      setTimeout(() => setSnapshotFeedback(null), 4000);
    } catch (err: any) {
      console.warn('Burst scan error:', err);
      setSnapshotFeedback('Hindi nabasa ang barcode sa litrato. Maaari mong gamitin ang "📷 Phone Camera App".');
      setTimeout(() => setSnapshotFeedback(null), 3500);
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  /**
   * Handle Photo Upload / Native Camera Capture (Uses iOS Hardware OIS, Flash & Deep Fusion)
   */
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPhoto(true);
    setSnapshotFeedback('Binabasa ang barcode mula sa Camera ng iPhone...');
    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error('Image failed to load'));
      });

      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;

      // Create high-res canvas (capped to 1920 to keep performance optimal)
      const scale = Math.min(1, 1920 / Math.max(origW, origH));
      const targetW = Math.round(origW * scale);
      const targetH = Math.round(origH * scale);

      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = targetW;
      fullCanvas.height = targetH;
      const ctx = fullCanvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(img, 0, 0, targetW, targetH);

        // Candidate 1: Full Image as captured by iPhone camera
        let decoded = await decodeFromCanvasCandidate(fullCanvas);
        if (decoded) {
          handleBarcodeDetected(decoded);
          return;
        }

        // Candidate 2: High-contrast binarized full image
        const contrastFull = enhanceBarcodeContrast(fullCanvas);
        decoded = await decodeFromCanvasCandidate(contrastFull);
        if (decoded) {
          handleBarcodeDetected(decoded);
          return;
        }

        // Candidate 3: Center 75% crop (where user naturally points the camera)
        const centerCrop = cropCanvasToCrosshair(fullCanvas, 0.75, 0.55);
        decoded = await decodeFromCanvasCandidate(centerCrop);
        if (decoded) {
          handleBarcodeDetected(decoded);
          return;
        }

        // Candidate 4: Enhanced Sharpened Center Crop
        const sharpCenter = applySharpeningFilter(centerCrop);
        decoded = await decodeFromCanvasCandidate(sharpCenter);
        if (decoded) {
          handleBarcodeDetected(decoded);
          return;
        }

        // Candidate 5: High-contrast Center Crop
        const contrastCenter = enhanceBarcodeContrast(centerCrop);
        decoded = await decodeFromCanvasCandidate(contrastCenter);
        if (decoded) {
          handleBarcodeDetected(decoded);
          return;
        }

        // Candidate 6: Rotated 90 degrees in case phone was held horizontally/vertically
        const rotCanvas = rotateCanvas90(centerCrop);
        decoded = await decodeFromCanvasCandidate(rotCanvas);
        if (decoded) {
          handleBarcodeDetected(decoded);
          return;
        }
      }

      // Fallback direct scan via Html5Qrcode scanFileV2
      try {
        const scanner = new Html5Qrcode('file-scanner-temp', { verbose: false });
        const res = await scanner.scanFileV2(file, true);
        if (res?.decodedText) {
          handleBarcodeDetected(res.decodedText);
          return;
        }
      } catch {}

      setSnapshotFeedback('Hindi nabasa ang barcode. Tiyaking maliwanag at nakatutok sa guhit ng barcode bago kumuha ng litrato.');
      setTimeout(() => setSnapshotFeedback(null), 4000);
    } catch (err) {
      console.error('File scan failed:', err);
      setSnapshotFeedback('Hindi nabasa ang litrato. Maaari mong gamitin ang "I-type ang Barcode".');
      setTimeout(() => setSnapshotFeedback(null), 3500);
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const code = manualCode.trim();
    setManualCode('');
    handleBarcodeDetected(code);
  };

  // Anti-shake capture snapshot handler for iPhone XR & mobile cameras
  const handleCaptureSnapshot = handleBurstAntiShakeScan;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Hidden temp div for fallback file scanner */}
        <div id="file-scanner-temp" className="hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-1.5">
                <h2 className="text-sm font-semibold text-white tracking-tight truncate">{title}</h2>
                {continuous && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-sm">
                    ⚡ Tuluy-tuloy na Scan
                  </span>
                )}
                {isNativeHardwareEngine && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hidden sm:flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> Hardware Vision AI
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 line-clamp-1">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {continuous && cartSummary && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-500/30 rounded-lg text-xs font-mono">
                <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 font-bold">{cartSummary.totalItems}</span>
                <span className="text-slate-500">|</span>
                <span className="text-white font-bold">₱{cartSummary.totalAmount.toFixed(2)}</span>
              </div>
            )}
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Isara ang Scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'camera'
                ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Live Camera Scan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'manual'
                ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            I-type ang Barcode
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          {/* Live Scan Notification Banner for Continuous Mode */}
          {scanFeedback && (
            scanFeedback.success ? (
              <div className="p-3 bg-emerald-950/90 border-2 border-emerald-500/80 rounded-xl flex items-center justify-between gap-3 shadow-lg shadow-emerald-950/50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 font-extrabold text-sm">
                    ✓
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      Naidagdag sa Bayarin: {scanFeedback.productName}
                    </div>
                    <div className="text-[11px] text-emerald-400 font-mono font-semibold flex items-center gap-1.5">
                      <span>₱{scanFeedback.price.toFixed(2)}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-300 font-sans">{scanFeedback.barcode}</span>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-wide font-extrabold px-2 py-1 rounded bg-emerald-500 text-slate-950 shrink-0 shadow-sm">
                  +1 Naidagdag
                </span>
              </div>
            ) : (
              <div className="p-3.5 bg-rose-950/95 border-2 border-rose-500/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl shadow-rose-950/60 animate-in fade-in slide-in-from-top-2 text-rose-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
                  <div className="text-xs min-w-0">
                    <div className="font-bold text-white text-xs sm:text-sm">
                      Hindi Nahanap sa Imbentaryo
                    </div>
                    <div className="text-[11px] text-rose-300">
                      Barcode: <span className="font-mono font-bold text-rose-100 bg-rose-900/60 px-1.5 py-0.5 rounded">{scanFeedback.barcode}</span>
                    </div>
                  </div>
                </div>

                {/* 1-Tap Option to Add to Inventory directly */}
                {onAddUnfoundBarcode && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddUnfoundBarcode(scanFeedback.barcode);
                    }}
                    className="self-stretch sm:self-auto px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/50 transition-all border border-emerald-400/30 cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Idagdag sa Imbentaryo</span>
                  </button>
                )}
              </div>
            )
          )}

          {activeTab === 'camera' ? (
            <div className="space-y-3">
              {/* Camera Viewport container */}
              <div className="relative rounded-2xl overflow-hidden bg-black h-64 sm:h-80 w-full border border-slate-800 flex items-center justify-center">
                {/* Native video element for BarcodeDetector engine */}
                <video
                  id="native-scanner-video"
                  ref={videoRef}
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.2s ease-out',
                  }}
                  className={`w-full h-full object-cover ${!isNativeHardwareEngine ? 'hidden' : ''}`}
                  playsInline
                  muted
                />

                {/* Html5Qrcode fallback container */}
                <div
                  id={scannerContainerId}
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.2s ease-out',
                  }}
                  className={`w-full h-full object-cover ${isNativeHardwareEngine ? 'hidden' : ''}`}
                />

                {/* Laser Overlay Guide with Clean Unobstructed Crosshair Box */}
                {!hasCameraError && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {/* Clean crosshair reticle without any buttons, text, or obstructing elements */}
                    <div
                      className="relative w-[86%] max-w-[320px] h-38 sm:h-48 border-2 border-emerald-400 rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.35)] flex items-center justify-center pointer-events-none"
                    >
                      {/* Corner marks */}
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 border-t-3 border-l-3 border-emerald-400 rounded-tl-xl" />
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 border-t-3 border-r-3 border-emerald-400 rounded-tr-xl" />
                      <span className="absolute -bottom-1.5 -left-1.5 w-5 h-5 border-b-3 border-l-3 border-emerald-400 rounded-bl-xl" />
                      <span className="absolute -bottom-1.5 -right-1.5 w-5 h-5 border-b-3 border-r-3 border-emerald-400 rounded-br-xl" />

                      {/* Moving Red Laser Scan Line */}
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-pulse absolute top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Processing overlay */}
                {isProcessingPhoto && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2 z-20">
                    <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin" />
                    <span className="text-xs font-semibold">Binabasa ang barcode sa litrato...</span>
                  </div>
                )}

                {/* Scan success feedback banner */}
                {lastScannedCode && (
                  <div className="absolute bottom-3 left-3 right-3 bg-emerald-500 text-slate-950 px-3 py-2 rounded-xl flex items-center justify-center gap-2 font-bold text-xs shadow-lg animate-bounce z-20">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Na-scan: {lastScannedCode}</span>
                  </div>
                )}

                {/* Camera error state */}
                {hasCameraError && (
                  <div className="p-4 text-center space-y-3 z-10 max-w-sm bg-slate-900/95 rounded-xl border border-slate-700 m-2">
                    <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-white">Kailangan ng Pahintulot sa Camera</h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{hasCameraError}</p>
                    </div>
                    <div className="text-left bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
                      <span className="font-semibold text-sky-400 block">📱 Paano paganahin sa iPhone (Safari):</span>
                      <p>1. Pindutin ang icon na <strong className="text-white">"aA"</strong> sa Safari address bar.</p>
                      <p>2. Pindutin ang <strong className="text-white">"Website Settings"</strong>.</p>
                      <p>3. Sa <strong className="text-white">"Camera"</strong>, piliin ang <strong className="text-emerald-400">"Allow"</strong>.</p>
                      <p>4. Pindutin ang <strong>Subukan Ulit</strong> sa ibaba.</p>
                    </div>
                    <div className="flex gap-2 justify-center pt-1">
                      <button
                        onClick={startCamera}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Subukan Ulit (Retry)
                      </button>
                      <button
                        onClick={() => setActiveTab('manual')}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                      >
                        I-type ang Barcode
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Snapshot Feedback banner */}
              {snapshotFeedback && (
                <div className="p-2.5 bg-amber-950/80 border border-amber-800/80 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-200 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{snapshotFeedback}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSnapshotFeedback(null)}
                    className="text-amber-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* CAMERA CONTROLS: FRONT / BACK CAMERA SWITCHER & ANTI-SHAKE */}
              <div className="space-y-2.5">
                {/* 1-Tap Switch Camera: Front Camera vs Back Camera */}
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-between gap-3 shadow-lg shadow-emerald-950/50 transition-all border border-emerald-400/40 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                      <SwitchCamera className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="font-extrabold flex items-center gap-2 text-white text-xs sm:text-sm">
                        <span>I-lipat sa {cameraFacingMode === 'environment' ? 'Harap (Front Selfie Camera)' : 'Likod (Back Camera)'}</span>
                        <span className="text-[10px] bg-emerald-950 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-400/40 font-semibold">
                          {cameraFacingMode === 'environment' ? 'Back Gamit' : 'Front Gamit (Walang OIS Shake!)'}
                        </span>
                      </div>
                      <div className="text-[10.5px] text-emerald-100/90 font-normal">
                        {cameraFacingMode === 'environment'
                          ? 'Pindutin para gamitin ang Front Camera — walang mechanical actuator vibration kaya mas matatag'
                          : 'Kasalukuyang ginagamit ang Front Camera para sa matatag na pagbasa ng barcode'}
                      </div>
                    </div>
                  </div>
                  <FlipHorizontal className="w-4 h-4 text-emerald-200 shrink-0" />
                </button>

                {/* Secondary Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCaptureSnapshot}
                    disabled={isProcessingPhoto}
                    className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 active:scale-98 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all border border-slate-800"
                  >
                    <Target className="w-4 h-4 text-emerald-400" />
                    <span>🎯 Anti-Shake Snap</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('manual')}
                    className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 active:scale-98 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all border border-slate-800"
                  >
                    <Search className="w-4 h-4 text-amber-400" />
                    <span>I-type ang Barcode</span>
                  </button>
                </div>
              </div>

              {/* iPhone Anti-Shake Guidance Card */}
              <div className="text-[11px] text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-sky-300">
                  <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                  <span>💡 Paalala sa Pag-scan gamit ang Front Camera:</span>
                </div>
                <p className="text-slate-400 text-[10.5px]">
                  Ang <strong className="text-white">Front Camera</strong> ng iPhone ay walang motorized optical stabilizer kaya hindi ito nanginginig o nagva-vibrate tulad ng sirang back camera. Itapat lang ang barcode sa screen mga <strong className="text-emerald-300">3 hanggang 5 inches</strong> ang layo!
                </p>
              </div>

              {/* Hardware Controls: Zoom & Torch */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                {/* Switch Camera quick button */}
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition-all"
                  title="Lumipat sa Front / Back Camera"
                >
                  <SwitchCamera className="w-3.5 h-3.5" />
                  <span>{cameraFacingMode === 'environment' ? 'Harap (Front)' : 'Likod (Back)'}</span>
                </button>

                {/* Zoom buttons */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
                    <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
                    Zoom:
                  </span>
                  {[1, 1.5, 2, 2.5, 3].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setZoom(lvl)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                        zoomLevel === lvl
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                      title={`Zoom ${lvl}x para sa maliliit na barcode`}
                    >
                      {lvl}x
                    </button>
                  ))}
                </div>

                {/* Torch Flashlight Toggle (Only available on back camera) */}
                {supportsTorch && cameraFacingMode === 'environment' && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`px-3 py-1 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                      torchEnabled
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {torchEnabled ? <Zap className="w-3.5 h-3.5 fill-current" /> : <ZapOff className="w-3.5 h-3.5" />}
                    {torchEnabled ? 'Flash ON' : 'Flash OFF'}
                  </button>
                )}
              </div>

              <div className="text-[11px] text-slate-400 leading-normal bg-slate-800/30 p-2.5 rounded-lg border border-slate-800/60">
                <span className="font-semibold text-emerald-400">💡 Mabilisang Scan:</span>{' '}
                Isang tapat lang sa barcode, awtomatiko itong magbi-beep at idaragdag sa kaha nang walang paulit-ulit na pag-scan.
              </div>
            </div>
          ) : (
            /* Manual Barcode Input Mode */
            <form onSubmit={handleManualSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Barcode / SKU Number</label>
                <div className="relative">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Hal. 4800016644203"
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  {manualCode && (
                    <button
                      type="button"
                      onClick={() => setManualCode('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Maaari ring gamitin ang mga numerong nakatatak sa ilalim ng barcode stripes ng produkto.
                </p>
              </div>

              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Search className="w-4 h-4" /> {continuous ? 'Idagdag ang Barcode sa Bayarin' : 'Hanapin ang Barcode'}
              </button>
            </form>
          )}
        </div>

        {/* Continuous Scanning Mode Bottom Bar */}
        {continuous && (
          <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/95 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            {cartSummary && (
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                <span className="text-xs text-slate-400">Kasalukuyang Bayarin:</span>
                <span className="text-xs font-extrabold text-emerald-400 font-mono bg-emerald-950/70 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                  {cartSummary.totalItems} paninda · ₱{cartSummary.totalAmount.toFixed(2)}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="w-full sm:w-auto flex-1 max-w-md py-3 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white font-extrabold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all border border-emerald-400/40 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Tapos na Mag-scan — Bumalik sa Kaha ({cartSummary?.totalItems || 0} paninda)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
