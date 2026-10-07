import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share2, Smartphone, CheckCircle2, ChevronRight, X } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'pill' | 'card' | 'inline';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'pill' }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running as an installed PWA on Android/iOS, show badge if card/inline or hide if pill
  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-emerald-400">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-300">Installed on Device</p>
              <p className="text-[11px] text-zinc-400">Running as a standalone Android app</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/40">
            Active
          </span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (!outcome) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  if (variant === 'card') {
    return (
      <>
        <div className="p-4 bg-gradient-to-r from-blue-900/40 via-zinc-900 to-zinc-900 border border-blue-500/30 rounded-3xl shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white leading-tight">Install Android App</h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Full screen, offline alarms &amp; instant launch from home screen
                </p>
              </div>
            </div>
            <button
              onClick={handleInstallClick}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition flex items-center gap-1.5 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
          </div>
        </div>

        {/* INSTALLATION GUIDE DIALOG */}
        {showGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-left">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-blue-400" />
                  Install MedTrack
                </h3>
                <button
                  onClick={() => setShowGuide(false)}
                  className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isIOS ? (
                <div className="mt-4 space-y-3 text-xs text-zinc-300">
                  <p className="leading-relaxed">
                    To install on your iPhone or iPad:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-zinc-400 bg-zinc-800/60 p-3 rounded-2xl">
                    <li>Tap the <strong>Share</strong> button in Safari toolbar.</li>
                    <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                    <li>Tap <strong>Add</strong> in the top right corner.</li>
                  </ol>
                </div>
              ) : (
                <div className="mt-4 space-y-3 text-xs text-zinc-300">
                  <p className="leading-relaxed">
                    To install directly on Android / Chrome:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-zinc-400 bg-zinc-800/60 p-3 rounded-2xl">
                    <li>Tap Chrome's <strong>three dots menu (⋮)</strong> at top right.</li>
                    <li>Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                    <li>Confirm installation to create the home screen APK icon.</li>
                  </ol>
                </div>
              )}

              <button
                onClick={() => setShowGuide(false)}
                className="mt-5 w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-bold text-white transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Pill variant
  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 rounded-full bg-blue-600/90 hover:bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition active:scale-95"
        title="Install Android App"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>

      {/* Guide Dialog */}
      {showGuide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-left">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-400" />
                Install on Android
              </h3>
              <button
                onClick={() => setShowGuide(false)}
                className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-zinc-300">
              <p className="leading-relaxed">
                Add MedTrack to your home screen as a standalone Android app:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-zinc-400 bg-zinc-800/60 p-3 rounded-2xl">
                <li>Tap Chrome's <strong>three dots (⋮)</strong> menu.</li>
                <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                <li>Tap <strong>Install</strong> to add MedTrack to your device.</li>
              </ol>
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-bold text-white transition"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </>
  );
};
