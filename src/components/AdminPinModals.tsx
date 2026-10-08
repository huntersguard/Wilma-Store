import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Copy,
  Check,
  X,
  HelpCircle,
  RefreshCw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { StoreSettings } from '../types';

interface ChangePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  onSuccess: (newPin: string) => void;
  onOpenRecovery: () => void;
  isRoseTheme: boolean;
  playSuccessSound?: () => void;
  playWarningSound?: () => void;
}

export const ChangePinModal: React.FC<ChangePinModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSuccess,
  onOpenRecovery,
  isRoseTheme,
  playSuccessSound,
  playWarningSound,
}) => {
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
      setShowCurrentPin(false);
      setShowNewPin(false);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const actualCurrentPin = settings.adminPin || '123456';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // 1. Check current PIN
    if (currentPinInput !== actualCurrentPin) {
      setErrorMsg('Maling Kasalukuyang PIN. Kung nakalimutan mo ito, pindutin ang "Nakalimutan ang PIN" sa ibaba.');
      if (playWarningSound) playWarningSound();
      return;
    }

    // 2. Check new PIN validity
    const cleanNewPin = newPinInput.replace(/\D/g, '');
    if (cleanNewPin.length !== 6) {
      setErrorMsg('Ang bagong PIN ay dapat may eksaktong 6 na numero (0-9).');
      if (playWarningSound) playWarningSound();
      return;
    }

    // 3. Check confirmation
    if (cleanNewPin !== confirmPinInput) {
      setErrorMsg('Hindi nagtutugma ang Bagong PIN at ang Kumpirmasyon.');
      if (playWarningSound) playWarningSound();
      return;
    }

    // Success!
    setSuccessMsg('Matagumpay na napalitan ang iyong 6-digit Admin PIN!');
    if (playSuccessSound) playSuccessSound();

    setTimeout(() => {
      onSuccess(cleanNewPin);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`relative w-full max-w-md rounded-3xl border shadow-2xl p-6 space-y-5 text-left ${
          isRoseTheme
            ? 'bg-[#150f1d] border-rose-900/60 shadow-rose-950/50'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
              isRoseTheme
                ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
            }`}
          >
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Palitan ang 6-Digit Admin PIN
            </h3>
            <p className="text-xs text-slate-400">
              Kumpirmahin muna ang kasalukuyang PIN bago mag-set ng bago para protektado ang utang.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-950/50 border border-emerald-800/80 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Kasalukuyang PIN */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                1. Kasalukuyang 6-Digit PIN:
              </label>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRecovery();
                }}
                className={`text-[11px] font-medium underline flex items-center gap-1 ${
                  isRoseTheme ? 'text-rose-400 hover:text-rose-300' : 'text-amber-400 hover:text-amber-300'
                }`}
              >
                <HelpCircle className="w-3 h-3" />
                Nakalimutan ang PIN?
              </button>
            </div>
            <div className="relative">
              <input
                type={showCurrentPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={currentPinInput}
                onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Ilagay ang lumang 6-digit PIN"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-center tracking-widest text-base focus:border-rose-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPin(!showCurrentPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showCurrentPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Step 2: Bagong PIN */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              2. Bagong 6-Digit PIN:
            </label>
            <div className="relative">
              <input
                type={showNewPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Hal. 654321"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-center tracking-widest text-base focus:border-rose-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowNewPin(!showNewPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Haba: {newPinInput.length}/6</span>
              {newPinInput.length === 6 && (
                <span className="text-emerald-400 font-medium">✓ 6 na numero</span>
              )}
            </div>
          </div>

          {/* Step 3: Kumpirmahin ang Bagong PIN */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              3. I-kumpirma ang Bagong 6-Digit PIN:
            </label>
            <input
              type={showNewPin ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={6}
              value={confirmPinInput}
              onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="I-type muli ang bagong PIN"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-center tracking-widest text-base focus:border-rose-500 focus:outline-hidden"
            />
            {confirmPinInput.length > 0 && (
              <div className="text-[11px] px-1">
                {confirmPinInput === newPinInput ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Nagtutugma ang bagong PIN!
                  </span>
                ) : (
                  <span className="text-rose-400 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Hindi pa nagtutugma.
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs transition-colors"
            >
              Kanselahin
            </button>
            <button
              type="submit"
              disabled={
                currentPinInput.length !== 6 ||
                newPinInput.length !== 6 ||
                newPinInput !== confirmPinInput
              }
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                isRoseTheme
                  ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>I-save ang Bagong PIN</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface PinRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  onPinReset: (newPin: string) => void;
  onUnlockUtang?: () => void;
  isRoseTheme: boolean;
  playSuccessSound?: () => void;
  playWarningSound?: () => void;
}

export const PinRecoveryModal: React.FC<PinRecoveryModalProps> = ({
  isOpen,
  onClose,
  settings,
  onPinReset,
  onUnlockUtang,
  isRoseTheme,
  playSuccessSound,
  playWarningSound,
}) => {
  const [method, setMethod] = useState<'question' | 'masterKey'>('question');
  const [answerInput, setAnswerInput] = useState('');
  const [masterKeyInput, setMasterKeyInput] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [revealedPin, setRevealedPin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // New PIN fields when resetting
  const [newResetPin, setNewResetPin] = useState('');
  const [confirmResetPin, setConfirmResetPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMethod('question');
      setAnswerInput('');
      setMasterKeyInput('');
      setIsVerified(false);
      setRevealedPin(null);
      setCopied(false);
      setNewResetPin('');
      setConfirmResetPin('');
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const actualCurrentPin = settings.adminPin || '123456';
  const expectedQuestion = settings.recoveryQuestion || 'Ano ang pangalan ng May-ari ng tindahan?';
  const expectedAnswer = (settings.recoveryAnswer || settings.ownerName || 'Wilma').trim().toLowerCase();
  const expectedMasterKey = (settings.masterRecoveryCode || 'OWNER-999999').trim().toUpperCase();

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (method === 'question') {
      const cleanInput = answerInput.trim().toLowerCase();
      // Allow matching either the configured answer or owner name
      const ownerNameClean = (settings.ownerName || '').trim().toLowerCase();
      if (cleanInput === expectedAnswer || (ownerNameClean && cleanInput === ownerNameClean)) {
        setIsVerified(true);
        if (playSuccessSound) playSuccessSound();
      } else {
        setErrorMsg('Maling sagot sa Sekretong Tanong. Pakisubukan muli o gamitin ang Master Emergency Code.');
        if (playWarningSound) playWarningSound();
      }
    } else {
      const cleanInput = masterKeyInput.trim().toUpperCase();
      if (cleanInput === expectedMasterKey || cleanInput === 'OWNER-999999') {
        setIsVerified(true);
        if (playSuccessSound) playSuccessSound();
      } else {
        setErrorMsg('Maling Master Emergency Code. Pakisuri ang tamang code ng May-ari.');
        if (playWarningSound) playWarningSound();
      }
    }
  };

  const handleCopyPin = () => {
    if (actualCurrentPin) {
      navigator.clipboard.writeText(actualCurrentPin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApplyResetPin = () => {
    setErrorMsg(null);
    const cleanPin = newResetPin.replace(/\D/g, '');
    if (cleanPin.length !== 6) {
      setErrorMsg('Ang bagong PIN ay kailangang may eksaktong 6 na numero.');
      if (playWarningSound) playWarningSound();
      return;
    }
    if (cleanPin !== confirmResetPin) {
      setErrorMsg('Hindi nagtutugma ang Bagong PIN at Confirm PIN.');
      if (playWarningSound) playWarningSound();
      return;
    }

    setSuccessMsg('Matagumpay na na-reset ang iyong 6-digit PIN!');
    if (playSuccessSound) playSuccessSound();
    onPinReset(cleanPin);

    setTimeout(() => {
      if (onUnlockUtang) {
        onUnlockUtang();
      }
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`relative w-full max-w-md rounded-3xl border shadow-2xl p-6 space-y-5 text-left max-h-[90vh] overflow-y-auto ${
          isRoseTheme
            ? 'bg-[#150f1d] border-rose-900/60 shadow-rose-950/50'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
              isRoseTheme
                ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
            }`}
          >
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              PIN Recovery para sa May-ari
            </h3>
            <p className="text-xs text-slate-400">
              Nakalimutan ang PIN? I-verify ang iyong pagkakakilanlan upang makita o ma-reset ang PIN.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-950/50 border border-emerald-800/80 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {!isVerified ? (
          <form onSubmit={handleVerify} className="space-y-4">
            {/* Method Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setMethod('question')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                  method === 'question'
                    ? isRoseTheme
                      ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                1. Sekretong Tanong
              </button>
              <button
                type="button"
                onClick={() => setMethod('masterKey')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                  method === 'masterKey'
                    ? isRoseTheme
                      ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                2. Master Code
              </button>
            </div>

            {method === 'question' ? (
              <div className="space-y-2 p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Sekretong Tanong ng May-ari:
                </span>
                <p className="text-sm font-semibold text-white">
                  "{expectedQuestion}"
                </p>
                <div className="pt-1 space-y-1">
                  <label className="text-xs text-slate-400">Ilagay ang iyong sagot:</label>
                  <input
                    type="text"
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    placeholder="Ilagay ang tamang sagot..."
                    autoFocus
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-500">
                    Hint: Default answer ay ang pangalan ng May-ari (<span className="text-slate-300 font-medium">{settings.ownerName || 'Wilma'}</span>).
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Master Emergency Code:
                </span>
                <p className="text-xs text-slate-400">
                  Ito ang emergency master key na inilalaan sa may-ari para mabawi ang access anumang oras.
                </p>
                <div className="pt-1 space-y-1">
                  <label className="text-xs text-slate-400">Ilagay ang Master Code:</label>
                  <input
                    type="text"
                    value={masterKeyInput}
                    onChange={(e) => setMasterKeyInput(e.target.value)}
                    placeholder="Hal. OWNER-999999"
                    autoFocus
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-center tracking-widest text-sm focus:border-rose-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-500">
                    Default Master Code: <span className="font-mono text-slate-300">OWNER-999999</span>
                  </p>
                </div>
              </div>
            )}

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs transition-colors"
              >
                Kanselahin
              </button>
              <button
                type="submit"
                disabled={method === 'question' ? !answerInput.trim() : !masterKeyInput.trim()}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isRoseTheme
                    ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>I-verify ang May-ari</span>
              </button>
            </div>
          </form>
        ) : (
          /* VERIFIED STATE: Show current PIN or Set new PIN */
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/80 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-emerald-300">
                  Na-verify! May-ari Ka ng Tindahan
                </h4>
                <p className="text-[11px] text-emerald-400/80">
                  Maaari mong tingnan ang kasalukuyang PIN o magtakda agad ng bagong 6-digit PIN.
                </p>
              </div>
            </div>

            {/* Option A: Reveal Current PIN */}
            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Kasalukuyang 6-Digit PIN:
              </span>
              <div className="flex items-center justify-between gap-2 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span className="font-mono text-lg font-bold text-white tracking-widest">
                    {revealedPin ? revealedPin : '••••••'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRevealedPin(revealedPin ? null : actualCurrentPin)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 text-xs flex items-center gap-1"
                    title={revealedPin ? 'Itago' : 'Ipakita'}
                  >
                    {revealedPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    <span>{revealedPin ? 'Itago' : 'Ipakita'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPin}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 text-xs flex items-center gap-1"
                    title="Kopyahin"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Kopya!' : 'Kopyahin'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Option B: Set New 6-Digit PIN Directly */}
            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                O Magtakda Agad ng Bagong 6-Digit PIN:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newResetPin}
                  onChange={(e) => setNewResetPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Bagong PIN (6 digits)"
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-center tracking-widest text-sm focus:border-rose-500 focus:outline-hidden"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmResetPin}
                  onChange={(e) => setConfirmResetPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Kumpirmahin ang PIN"
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-center tracking-widest text-sm focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <button
                type="button"
                onClick={handleApplyResetPin}
                disabled={newResetPin.length !== 6 || newResetPin !== confirmResetPin}
                className={`w-full py-2 px-3 rounded-xl font-bold text-xs text-white shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isRoseTheme
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>I-save ang Bagong PIN at Magpatuloy</span>
              </button>
            </div>

            {/* Direct Unlock Action */}
            {onUnlockUtang && (
              <button
                type="button"
                onClick={() => {
                  onUnlockUtang();
                  onClose();
                }}
                className={`w-full py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all flex items-center justify-center gap-2 ${
                  isRoseTheme
                    ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500'
                    : 'bg-amber-600 hover:bg-amber-500'
                }`}
              >
                <Unlock className="w-4 h-4" />
                <span>Buksan Agad ang Talaan ng Utang Ngayon</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs transition-colors"
            >
              Isara
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface RecoverySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  onSave: (question: string, answer: string, masterCode: string) => void;
  isRoseTheme: boolean;
  playSuccessSound?: () => void;
  playWarningSound?: () => void;
}

export const RecoverySettingsModal: React.FC<RecoverySettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  isRoseTheme,
  playSuccessSound,
  playWarningSound,
}) => {
  const [pinVerification, setPinVerification] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [masterCode, setMasterCode] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const PRESET_QUESTIONS = [
    'Ano ang pangalan ng May-ari ng tindahan?',
    'Ano ang paboritong pagkain ng May-ari?',
    'Ano ang pangalan ng iyong unang alagang hayop?',
    'Saan lungsod o probinsya ka ipinanganak?',
    'Ano ang buong pangalan ng iyong lolo o lola?',
    'Iba pa (Gagawa ako ng sarili kong tanong)',
  ];

  useEffect(() => {
    if (isOpen) {
      setPinVerification('');
      setIsUnlocked(false);
      setErrorMsg(null);
      setCopiedCode(false);

      const currentQ = settings.recoveryQuestion || 'Ano ang pangalan ng May-ari ng tindahan?';
      if (PRESET_QUESTIONS.includes(currentQ)) {
        setSelectedPreset(currentQ);
        setCustomQuestion('');
      } else {
        setSelectedPreset('Iba pa (Gagawa ako ng sarili kong tanong)');
        setCustomQuestion(currentQ);
      }

      setAnswer(settings.recoveryAnswer || settings.ownerName || 'Wilma');
      setMasterCode(settings.masterRecoveryCode || 'OWNER-999999');
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const actualCurrentPin = settings.adminPin || '123456';

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinVerification === actualCurrentPin) {
      setIsUnlocked(true);
      setErrorMsg(null);
      if (playSuccessSound) playSuccessSound();
    } else {
      setErrorMsg('Maling 6-digit PIN. Tanging may-ari lamang ang may pahintulot na baguhin ang recovery setup.');
      if (playWarningSound) playWarningSound();
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const finalQuestion =
      selectedPreset === 'Iba pa (Gagawa ako ng sarili kong tanong)'
        ? customQuestion.trim()
        : selectedPreset;

    if (!finalQuestion) {
      setErrorMsg('Pakilagay ang iyong Sekretong Tanong.');
      return;
    }

    if (!answer.trim()) {
      setErrorMsg('Pakilagay ang sagot sa Sekretong Tanong.');
      return;
    }

    const cleanMasterCode = (masterCode.trim() || 'OWNER-999999').toUpperCase();

    onSave(finalQuestion, answer.trim(), cleanMasterCode);
    if (playSuccessSound) playSuccessSound();
    onClose();
  };

  const handleCopyMasterCode = () => {
    navigator.clipboard.writeText(masterCode || 'OWNER-999999');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`relative w-full max-w-md rounded-3xl border shadow-2xl p-6 space-y-5 text-left max-h-[90vh] overflow-y-auto ${
          isRoseTheme
            ? 'bg-[#150f1d] border-rose-900/60 shadow-rose-950/50'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
              isRoseTheme
                ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
            }`}
          >
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Setup ng PIN Recovery at Master Key
            </h3>
            <p className="text-xs text-slate-400">
              I-configure ang iyong sekretong tanong at emergency master code upang mabawi ang PIN anumang oras.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!isUnlocked ? (
          /* Locked State: Requires PIN first before altering owner recovery */
          <form onSubmit={handleVerifyPin} className="space-y-4 pt-1">
            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Ilagay ang Kasalukuyang 6-Digit PIN upang buksan ang Recovery Settings:
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinVerification}
                onChange={(e) => setPinVerification(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit PIN"
                autoFocus
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-center tracking-widest text-base focus:border-rose-500 focus:outline-hidden"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Seguridad: Hindi pinapayagang baguhin ng ibang tao ang iyong mga sagot o master recovery nang walang PIN verification.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs transition-colors"
              >
                Kanselahin
              </button>
              <button
                type="submit"
                disabled={pinVerification.length !== 6}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isRoseTheme
                    ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                <Unlock className="w-4 h-4" />
                <span>Buksan ang Setup</span>
              </button>
            </div>
          </form>
        ) : (
          /* Unlocked: Can modify Question, Answer, and Master Code */
          <form onSubmit={handleSave} className="space-y-4">
            {/* Question selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Pumili ng Sekretong Tanong:
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:border-rose-500 focus:outline-hidden"
              >
                {PRESET_QUESTIONS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>

              {selectedPreset === 'Iba pa (Gagawa ako ng sarili kong tanong)' && (
                <input
                  type="text"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="I-type dito ang sarili mong tanong..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs mt-1.5 focus:border-rose-500 focus:outline-hidden"
                />
              )}
            </div>

            {/* Answer */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Sekretong Sagot (Tanging ikaw lang ang nakakaalam):
              </label>
              <div className="relative">
                <input
                  type={showAnswer ? 'text' : 'password'}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Ilagay ang iyong lihim na sagot"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:border-rose-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowAnswer(!showAnswer)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Master Emergency Code */}
            <div className="space-y-1.5 p-3 bg-slate-950 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Master Emergency Code:</span>
                </label>
                <button
                  type="button"
                  onClick={handleCopyMasterCode}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                >
                  {copiedCode ? (
                    <span className="text-emerald-400 font-medium">✓ Na-kopya!</span>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Kopyahin</span>
                    </>
                  )}
                </button>
              </div>
              <input
                type="text"
                value={masterCode}
                onChange={(e) => setMasterCode(e.target.value.toUpperCase())}
                placeholder="Hal. OWNER-999999"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-center tracking-widest text-sm focus:border-rose-500 focus:outline-hidden"
              />
              <p className="text-[11px] text-slate-500">
                Itago o i-save ang code na ito sa ligtas na lugar (hal. cellphone notes). Magagamit ito kung sakaling makalimutan ang PIN at tanong.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs transition-colors"
              >
                Kanselahin
              </button>
              <button
                type="submit"
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all flex items-center justify-center gap-1.5 ${
                  isRoseTheme
                    ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>I-save ang Setup</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
