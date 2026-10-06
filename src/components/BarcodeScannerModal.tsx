import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, Zap, ZapOff, ZoomIn, X, Search, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { playScanBeep, triggerHaptic } from '../utils/audio';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  subtitle?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Barcode',
  subtitle = 'Align the barcode inside the target box. Use zoom for small barcodes.',
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraError, setHasCameraError] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [supportsTorch, setSupportsTorch] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [maxZoom, setMaxZoom] = useState<number>(1);
  const [supportsZoom, setSupportsZoom] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const lastScanTimestampRef = useRef<number>(0);
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
    const now = Date.now();
    // Debounce duplicate scans within 1.5 seconds
    if (now - lastScanTimestampRef.current < 1500 && lastScannedCode === decodedText) {
      return;
    }

    lastScanTimestampRef.current = now;
    setLastScannedCode(decodedText);
    playScanBeep();
    triggerHaptic([60, 40]);

    // Give visual confirmation feedback before triggering action
    setTimeout(() => {
      onScan(decodedText.trim());
    }, 250);
  };

  const startCamera = async () => {
    try {
      setHasCameraError(null);
      setIsScanning(true);

      // Clean up previous instance if any
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch {
          // ignore
        }
        html5QrCodeRef.current = null;
      }

      // Small delay to ensure DOM element is ready
      await new Promise((r) => setTimeout(r, 150));

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
        Html5QrcodeSupportedFormats.CODABAR,
      ];

      const html5QrCode = new Html5Qrcode(scannerContainerId, {
        formatsToSupport,
        verbose: false,
      });
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 24,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          // Horizontal barcode aspect ratio: wider than tall to capture 1D barcodes cleanly
          const width = Math.min(viewfinderWidth * 0.88, 380);
          const height = Math.min(viewfinderHeight * 0.45, 180);
          return { width, height };
        },
        aspectRatio: 1.333333,
        disableFlip: false,
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleBarcodeDetected(decodedText);
        },
        () => {
          // Frame parsed without barcode - normal scanning loop
        }
      );

      // Inspect camera track for advanced hardware features (Torch & Zoom)
      try {
        const videoElem = document.querySelector(`#${scannerContainerId} video`) as HTMLVideoElement | null;
        if (videoElem && videoElem.srcObject instanceof MediaStream) {
          const track = videoElem.srcObject.getVideoTracks()[0];
          if (track) {
            videoTrackRef.current = track;
            const capabilities = track.getCapabilities ? (track.getCapabilities() as any) : {};

            if ('torch' in capabilities) {
              setSupportsTorch(true);
            }
            if ('zoom' in capabilities && capabilities.zoom) {
              setSupportsZoom(true);
              setMaxZoom(Math.min(capabilities.zoom.max || 3, 5));
              setZoomLevel(1);
            }
          }
        }
      } catch (capErr) {
        console.log('Capabilities probe note:', capErr);
      }
    } catch (err: any) {
      console.error('Camera start error:', err);
      setIsScanning(false);
      setHasCameraError(
        err?.message || 'Could not access camera. Please allow camera permissions or enter the barcode manually.'
      );
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Camera stop error:', err);
      }
      html5QrCodeRef.current = null;
    }
    videoTrackRef.current = null;
    setIsScanning(false);
    setTorchEnabled(false);
  };

  const toggleTorch = async () => {
    if (!videoTrackRef.current || !supportsTorch) return;
    try {
      const nextState = !torchEnabled;
      await (videoTrackRef.current as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchEnabled(nextState);
    } catch (err) {
      console.warn('Torch toggle error:', err);
    }
  };

  const setZoom = async (newZoom: number) => {
    setZoomLevel(newZoom);
    if (!videoTrackRef.current || !supportsZoom) return;
    try {
      await (videoTrackRef.current as any).applyConstraints({
        advanced: [{ zoom: newZoom }],
      });
    } catch (err) {
      console.warn('Zoom change error:', err);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">{title}</h2>
              <p className="text-xs text-slate-400 line-clamp-1">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close Scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch: Camera vs Manual input */}
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
            Phone Camera
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
            Enter Code Manually
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 flex-1 overflow-y-auto">
          {activeTab === 'camera' ? (
            <div className="space-y-3">
              {/* Camera Viewport container */}
              <div className="relative rounded-xl overflow-hidden bg-black aspect-4/3 sm:aspect-16/10 border border-slate-800 flex items-center justify-center">
                <div id={scannerContainerId} className="w-full h-full object-cover" />

                {/* Overlay Scanning Guide & Laser Line */}
                {isScanning && !hasCameraError && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    {/* Targeting reticle */}
                    <div className="relative w-64 h-32 sm:w-72 sm:h-36 border-2 border-emerald-400/80 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                      {/* Corner marks */}
                      <span className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-3 border-l-3 border-emerald-400 rounded-tl" />
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-3 border-r-3 border-emerald-400 rounded-tr" />
                      <span className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-3 border-l-3 border-emerald-400 rounded-bl" />
                      <span className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-3 border-r-3 border-emerald-400 rounded-br" />

                      {/* Moving laser scan guide */}
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-pulse absolute top-1/2 -translate-y-1/2" />
                    </div>

                    <p className="mt-3 text-[11px] font-medium text-emerald-300/90 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-full border border-emerald-500/20">
                      Tapat ang barcode sa gitna ng kahon
                    </p>
                  </div>
                )}

                {/* Scan success feedback banner */}
                {lastScannedCode && (
                  <div className="absolute bottom-3 left-3 right-3 bg-emerald-500 text-slate-950 px-3 py-2 rounded-lg flex items-center justify-center gap-2 font-semibold text-xs shadow-lg animate-bounce">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Scanned: {lastScannedCode}</span>
                  </div>
                )}

                {/* Camera error state */}
                {hasCameraError && (
                  <div className="p-4 text-center space-y-3 z-10 max-w-sm">
                    <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                    <p className="text-xs text-slate-300 leading-relaxed">{hasCameraError}</p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={startCamera}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
                      </button>
                      <button
                        onClick={() => setActiveTab('manual')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        Type Barcode Instead
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Hardware Controls: Zoom & Torch (Crucial for small barcodes on sachets/candies) */}
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
                      title={`Set camera zoom to ${lvl}x for small barcodes`}
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
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
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
                <span className="font-semibold text-slate-300">Tip para sa maliliit na barcode (sachet / kendi):</span>{' '}
                Pindutin ang <strong className="text-emerald-400">2x</strong> o{' '}
                <strong className="text-emerald-400">3x Zoom</strong> para malinaw at hindi malabo ang focus ng camera
                mula sa 15cm na layo.
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
                  Maaari ring gamitin ang barcode numbers na nakasulat sa ilalim ng stripes ng pakete.
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
