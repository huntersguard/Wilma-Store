import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone, QrCode, Copy, Check, Share2, Download, ExternalLink, X } from 'lucide-react';

interface InstallPhoneModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallPhoneModal: React.FC<InstallPhoneModalProps> = ({ isOpen, onClose }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // App URL: Use current URL or shared app URL
  const appUrl =
    typeof window !== 'undefined'
      ? window.location.href.replace('ais-dev-', 'ais-pre-') // prefer shared preview URL
      : 'https://ais-pre-dk2wdhcieznoab7pnehlaf-553175971465.us-east1.run.app';

  useEffect(() => {
    // Generate QR code for phone scanning
    QRCode.toDataURL(appUrl, {
      width: 260,
      margin: 1.5,
      color: {
        dark: '#020617',
        light: '#ffffff',
      },
    })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error('Error generating QR code:', err));

    // Listen for PWA beforeinstallprompt on supported browsers
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [appUrl]);

  const copyUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Gamitin sa Iyong Telepono (Mobile App)
              </h2>
              <p className="text-xs text-slate-400">I-scan ang QR code o buksan ang link sa cellphone</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* QR Code Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col items-center text-center space-y-3">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              1-Scan Phone Setup
            </span>
            <p className="text-xs text-slate-300 max-w-xs">
              Buksan ang Camera sa iyong cellphone at itutok sa QR code na ito para mabuksan agad ang app:
            </p>

            <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-700">
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="QR Code for Tindahan POS Mobile App"
                  className="w-48 h-48 object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs font-mono">
                  Bumubuo ng QR...
                </div>
              )}
            </div>

            {/* Direct App Link */}
            <div className="w-full pt-2">
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5 pl-3">
                <input
                  type="text"
                  readOnly
                  value={appUrl}
                  className="bg-transparent text-[11px] font-mono text-slate-300 w-full focus:outline-none truncate"
                />
                <button
                  type="button"
                  onClick={copyUrl}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Kopya!' : 'Kopyahin'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Native Install Button if browser supports beforeinstallprompt */}
          {deferredPrompt && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Download className="w-4 h-4" />
              <span>I-install bilang App sa Telepono (1-Tap Install)</span>
            </button>
          )}

          {/* Step by step mobile guide */}
          <div className="space-y-3 bg-slate-950/50 border border-slate-800 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Paano Idagdag sa Home Screen (Maging parang App sa Play Store/App Store):
            </h4>

            {/* Android Guide */}
            <div className="text-xs space-y-1">
              <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <span>🤖 Para sa Android (Google Chrome):</span>
              </div>
              <ol className="list-decimal list-inside text-slate-300 space-y-1 pl-1 text-[11px] leading-relaxed">
                <li>Buksan ang link sa <strong>Google Chrome</strong> sa iyong cellphone.</li>
                <li>Pindutin ang tatlong tuldok (<strong className="text-white">⋮</strong>) sa kanang-itaas ng Chrome.</li>
                <li>Piliin ang <strong className="text-emerald-400">"Add to Home screen"</strong> o <strong className="text-emerald-400">"Install app"</strong>.</li>
                <li>Lalabas ang Tindahan POS icon sa iyong phone screen na parang totoong app!</li>
              </ol>
            </div>

            {/* iPhone Guide */}
            <div className="text-xs space-y-1 pt-2 border-t border-slate-800">
              <div className="font-semibold text-sky-400 flex items-center gap-1.5">
                <span>🍏 Para sa iPhone / iPad (Safari):</span>
              </div>
              <ol className="list-decimal list-inside text-slate-300 space-y-1 pl-1 text-[11px] leading-relaxed">
                <li>Buksan ang link sa <strong>Safari</strong> browser.</li>
                <li>Pindutin ang <strong>Share button</strong> (ang icon na may kahon at pataas na arrow <Share2 className="w-3 h-3 inline text-sky-400" />).</li>
                <li>Mag-scroll pababa at pindutin ang <strong className="text-sky-400">"Add to Home Screen" (+)</strong>.</li>
                <li>Pindutin ang <strong>Add</strong> sa kanang-itaas.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Naiintindihan Ko
          </button>
        </div>
      </div>
    </div>
  );
};
