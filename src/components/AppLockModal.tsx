import React, { useState, useEffect } from 'react';
import { Lock, Delete, ShieldCheck, KeyRound } from 'lucide-react';

interface AppLockModalProps {
  isLocked: boolean;
  storedPin?: string;
  biometricsEnabled?: boolean;
  onUnlock: () => void;
}

export const AppLockModal: React.FC<AppLockModalProps> = ({
  isLocked,
  storedPin,
  biometricsEnabled,
  onUnlock,
}) => {
  const [pinInput, setPinInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isLocked) {
      setPinInput('');
      setErrorMsg('');
      if (biometricsEnabled && window.PublicKeyCredential) {
        // Optional quick biometric prompt
      }
    }
  }, [isLocked, biometricsEnabled]);

  if (!isLocked || !storedPin) return null;

  const handleDigit = (digit: string) => {
    if (pinInput.length < 4) {
      const nextPin = pinInput + digit;
      setPinInput(nextPin);
      setErrorMsg('');

      if (nextPin.length === 4) {
        if (!storedPin || nextPin === storedPin) {
          setTimeout(() => {
            onUnlock();
          }, 150);
        } else {
          setTimeout(() => {
            setErrorMsg('Incorrect PIN. Please try again.');
            setPinInput('');
          }, 250);
        }
      }
    }
  };

  const handleDelete = () => {
    setPinInput(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#121212] px-6 select-none">
      <div className="w-full max-w-xs flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-5 text-blue-400 shadow-lg shadow-blue-500/10">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-bold text-white tracking-wide">MedTrack Locked</h2>
        <p className="text-sm text-zinc-400 mt-1 mb-8">Enter your 4-digit PIN to continue</p>

        {/* PIN Indicators */}
        <div className="flex gap-4 mb-8">
          {[0, 1, 2, 3].map(idx => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border transition-all duration-200 ${
                pinInput.length > idx
                  ? 'bg-blue-500 border-blue-500 scale-110 shadow-sm shadow-blue-500/50'
                  : 'bg-zinc-800/80 border-zinc-700'
              }`}
            />
          ))}
        </div>

        {errorMsg && (
          <p className="text-xs text-rose-400 mb-6 bg-rose-950/40 border border-rose-800/40 px-3 py-1.5 rounded-lg animate-shake">
            {errorMsg}
          </p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-4 w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              onClick={() => handleDigit(num)}
              className="h-16 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 active:bg-blue-600/30 active:scale-95 text-xl font-semibold text-white transition flex items-center justify-center border border-zinc-700/50 shadow-sm"
            >
              {num}
            </button>
          ))}
          <div className="h-16 flex items-center justify-center text-zinc-600">
            <ShieldCheck className="w-6 h-6 text-zinc-600" />
          </div>
          <button
            onClick={() => handleDigit('0')}
            className="h-16 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 active:bg-blue-600/30 active:scale-95 text-xl font-semibold text-white transition flex items-center justify-center border border-zinc-700/50 shadow-sm"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-zinc-800/50 hover:bg-zinc-700/80 active:scale-95 text-zinc-400 hover:text-white transition flex items-center justify-center border border-zinc-800"
            aria-label="Delete"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
