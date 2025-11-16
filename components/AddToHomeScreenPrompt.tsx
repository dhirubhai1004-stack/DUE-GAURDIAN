
import React, { useState, useEffect } from 'react';
import { CloseIcon, ShareIcon } from './icons';

const AddToHomeScreenPrompt: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasSeenPrompt = localStorage.getItem('hasSeenInstallPrompt');
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    
    // Check if it's a standalone app already
    const isInStandaloneMode = () =>
      ('standalone' in window.navigator) && ((window.navigator as any).standalone);

    if (isIOS && !hasSeenPrompt && !isInStandaloneMode()) {
      setIsVisible(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('hasSeenInstallPrompt', 'true');
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 p-4 z-50 animate-slide-up">
      <div className="max-w-md mx-auto text-white relative pb-2">
        <button onClick={handleClose} className="absolute -top-2 -right-2 text-slate-400 hover:text-white">
          <CloseIcon className="w-6 h-6" />
        </button>
        <p className="text-lg mb-2 text-center">Install this app on your iPhone:</p>
        <p className="text-center">
          Tap the <ShareIcon className="w-5 h-5 inline-block mx-1" /> icon and then select 'Add to Home Screen'.
        </p>
      </div>
       <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default AddToHomeScreenPrompt;