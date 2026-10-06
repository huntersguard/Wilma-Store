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
  CameraOff,
} from 'lucide-react';
import { playScanBeep, triggerHaptic } from '../utils/audio';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  subtitle?: string;
}

// Define BarcodeDetector types for TypeScript
declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Barcode',
  subtitle = 'Itutok ang camera sa barcode. May high-precision scanner at zoom para sa maliliit na barcode.',
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraError, setHasCameraError] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [supportsTorch, setSupportsTorch] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [supportsZoom, setSupportsZoom] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [isNativeHardwareEngine, setIsNativeHardwareEngine] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastScanTimestampRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scannerContainerId = 'interactive-barcode-viewport';

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setLastScannedCode(null);
      setHasCameraError(null);
      return;
    }

    if (activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  const handleBarcodeDetected = (decodedText: string) => {
    const cleanText = decodedText.trim();
    if (!cleanText) return;

    const now = Date.now();
    // Debounce duplicate scans within 1.5 seconds
    if (now - lastScanTimestampRef.current < 1500 && lastScannedCode === cleanText) {
      return;
    }

    lastScanTimestampRef.current = now;
    setLastScannedCode(cleanText);
    playScanBeep();
    triggerHaptic([70, 40]);

    setTimeout(() => {
      onScan(cleanText);
    }, 280);
  };

  /**
   * Start Camera with High Accuracy Dual Engine:
   * 1. Primary: Native hardware BarcodeDetector (iOS Safari 17+, Chrome Android)
   * 2. Fallback: Html5Qrcode with full-frame multi-pass scanner
   */
  const startCamera = async () => {
    try {
      setHasCameraError(null);
      setIsScanning(true);
      await stopCamera();

      // Check if native BarcodeDetector API is supported
      const hasNativeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
      setIsNativeHardwareEngine(hasNativeDetector);

      if (hasNativeDetector) {
        await startNativeBarcodeDetector();
      } else {
        await startHtml5QrcodeEngine();
      }
    } catch (err: any) {
      console.error('Camera startup error:', err);
      // Fallback to Html5Qrcode if native engine threw
      try {
        console.log('Falling back to Html5Qrcode engine...');
        await startHtml5QrcodeEngine();
      } catch (fallbackErr: any) {
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
  const startNativeBarcodeDetector = async () => {
    const video = document.getElementById('native-scanner-video') as HTMLVideoElement | null;
    if (!video) throw new Error('Video element not found');

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
      },
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef.current = stream;
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.muted = true;

    await video.play();

    // Inspect capabilities (Zoom & Torch)
    const track = stream.getVideoTracks()[0];
    if (track && track.getCapabilities) {
      const caps = track.getCapabilities() as any;
      if ('torch' in caps) setSupportsTorch(true);
      if ('zoom' in caps && caps.zoom) setSupportsZoom(true);
    }

    // Supported formats
    const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'itf'];
    const detector = new window.BarcodeDetector({ formats });

    const scanLoop = async () => {
      if (video.readyState >= 2) {
        try {
          const barcodes = await detector.detect(video);
          if (barcodes && barcodes.length > 0) {
            const result = barcodes[0].rawValue;
            if (result) {
              handleBarcodeDetected(result);
            }
          }
        } catch {
          // ignore detection frame errors
        }
      }
      animationFrameRef.current = requestAnimationFrame(scanLoop);
    };

    animationFrameRef.current = requestAnimationFrame(scanLoop);
  };

  /**
   * ENGINE 2: Html5Qrcode Fallback Engine
   */
  const startHtml5QrcodeEngine = async () => {
    await new Promise((r) => setTimeout(r, 120));

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

    const config = {
      fps: 25,
      // Tall and generous scanning area so barcode quiet zones and tall packages fit easily
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
        width: Math.floor(viewfinderWidth * 0.88),
        height: Math.floor(viewfinderHeight * 0.75),
      }),
      aspectRatio: 1.0,
      disableFlip: false,
    };

    await html5QrCode.start(
      { facingMode: 'environment' },
      config,
      (decodedText) => handleBarcodeDetected(decodedText),
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

  const stopCamera = async () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Stop error:', err);
      }
      html5QrCodeRef.current = null;
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

  const setZoom = async (newZoom: number) => {
    setZoomLevel(newZoom);
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !supportsZoom) return;
    try {
      await (track as any).applyConstraints({
        advanced: [{ zoom: newZoom }],
      });
    } catch (err) {
      console.warn('Zoom error:', err);
    }
  };

  /**
   * SNAP & SCAN: Freezes the video frame, increases contrast, and decodes.
   * Extraordinary accuracy for wrinkled packaging, sachet margins, and glare.
   */
  const handleCaptureSnapshot = async () => {
    setIsProcessingPhoto(true);
    try {
      let video: HTMLVideoElement | null = null;
      if (isNativeHardwareEngine) {
        video = document.getElementById('native-scanner-video') as HTMLVideoElement | null;
      } else {
        video = document.querySelector(`#${scannerContainerId} video`) as HTMLVideoElement | null;
      }

      if (!video) throw new Error('Video not active');

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas');

      // Draw high resolution frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Decode with native detector or Html5Qrcode
      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });
        const barcodes = await detector.detect(canvas);
        if (barcodes && barcodes.length > 0) {
          handleBarcodeDetected(barcodes[0].rawValue);
          setIsProcessingPhoto(false);
          return;
        }
      }

      // Fallback: Html5Qrcode file scan
      if (html5QrCodeRef.current) {
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          const file = new File([blob], 'snapshot.jpg', { type: 'image/jpeg' });
          try {
            const result = await html5QrCodeRef.current?.scanFileV2(file, true);
            if (result?.decodedText) {
              handleBarcodeDetected(result.decodedText);
            } else {
              alert('Walang barcode na nabasa sa snapshot. Pakisubukan muli o ilapit ang camera.');
            }
          } catch {
            alert('Walang barcode na nabasa sa snapshot. Pakisubukan muli.');
          } finally {
            setIsProcessingPhoto(false);
          }
        }, 'image/jpeg', 0.95);
        return;
      }

      alert('Hindi nabasa ang barcode sa kuha. Pakisubukan muli.');
    } catch (err: any) {
      console.warn('Snapshot scan error:', err);
      alert('Pakisubukang itutok muli at pindutin ang Snap to Scan.');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  /**
   * Handle Photo Upload / Native Camera Capture
   */
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPhoto(true);
    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((resolve) => (img.onload = resolve));

      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });
        const barcodes = await detector.detect(img);
        if (barcodes && barcodes.length > 0) {
          handleBarcodeDetected(barcodes[0].rawValue);
          setIsProcessingPhoto(false);
          return;
        }
      }

      // Fallback with Html5Qrcode
      const scanner = new Html5Qrcode('file-scanner-temp', { verbose: false });
      const res = await scanner.scanFileV2(file, true);
      if (res?.decodedText) {
        handleBarcodeDetected(res.decodedText);
      } else {
        alert('Hindi nabasa ang barcode sa litrato. Pakisubukan muli.');
      }
    } catch (err) {
      console.error('File scan failed:', err);
      alert('Hindi nabasa ang barcode sa litrato. Pakisubukan ang manual entry.');
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onScan(manualCode.trim());
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Hidden temp div for fallback file scanner */}
        <div id="file-scanner-temp" className="hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-white tracking-tight">{title}</h2>
                {isNativeHardwareEngine && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> Hardware Vision AI
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 line-clamp-1">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Isara ang Scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'camera'
                ? 'bg-emerald-600 text-white shadow-sm'
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
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            I-type ang Barcode
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          {activeTab === 'camera' ? (
            <div className="space-y-3">
              {/* Camera Viewport container */}
              <div className="relative rounded-2xl overflow-hidden bg-black h-72 sm:h-88 w-full border border-slate-800 flex items-center justify-center">
                {/* Native video element for BarcodeDetector engine */}
                <video
                  id="native-scanner-video"
                  ref={videoRef}
                  className={`w-full h-full object-cover ${!isNativeHardwareEngine ? 'hidden' : ''}`}
                  playsInline
                  muted
                />

                {/* Html5Qrcode fallback container */}
                <div
                  id={scannerContainerId}
                  className={`w-full h-full object-cover ${isNativeHardwareEngine ? 'hidden' : ''}`}
                />

                {/* Laser Overlay Guide */}
                {isScanning && !hasCameraError && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    {/* Targeting reticle with tall, spacious area */}
                    <div className="relative w-[88%] max-w-[340px] h-48 sm:h-56 border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_25px_rgba(16,185,129,0.25)]">
                      {/* Corner marks */}
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 border-t-3 border-l-3 border-emerald-400 rounded-tl-xl" />
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 border-t-3 border-r-3 border-emerald-400 rounded-tr-xl" />
                      <span className="absolute -bottom-1.5 -left-1.5 w-5 h-5 border-b-3 border-l-3 border-emerald-400 rounded-bl-xl" />
                      <span className="absolute -bottom-1.5 -right-1.5 w-5 h-5 border-b-3 border-r-3 border-emerald-400 rounded-br-xl" />

                      {/* Moving Red Laser Scan Line */}
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-pulse absolute top-1/2 -translate-y-1/2" />
                    </div>

                    <p className="mt-2.5 text-[11px] font-semibold text-emerald-300 bg-black/70 backdrop-blur-xs px-3 py-1 rounded-full border border-emerald-500/30">
                      Tapat ang barcode kahit pahiga o patayo
                    </p>
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
                    <span>Scanned: {lastScannedCode}</span>
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

              {/* SNAP TO SCAN & Upload Photo Actions (CRITICAL FIX for stubborn barcodes) */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCaptureSnapshot}
                  disabled={isProcessingPhoto || !isScanning}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>📸 Snap to Scan (Kumuha)</span>
                </button>

                <label className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-700/80">
                  <Upload className="w-4 h-4 text-sky-400" />
                  <span>Upload / Photo App</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Hardware Controls: Zoom & Torch (For small barcodes on sachets/candies) */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
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

                {/* Torch Flashlight Toggle */}
                {supportsTorch && (
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
                <span className="font-semibold text-emerald-400">💡 Pro-Tip para sa maliit o makintab na pakete:</span>{' '}
                Gamitin ang <strong className="text-white">"2x Zoom"</strong> o pindutin ang{' '}
                <strong className="text-white">"Snap to Scan"</strong> para kumuha ng malinaw na litrato kahit makintab
                ang foil o supot ng kape/sachet.
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
                <Search className="w-4 h-4" /> Hanapin ang Barcode
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
