import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const ShutdownModal = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const hasShownModal = sessionStorage.getItem('shutdownModalShown');
    
    if (!hasShownModal) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      sessionStorage.setItem('shutdownModalShown', 'true');
    }, 200);
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 ${
      isClosing ? 'animate-modal-fade-out' : 'animate-modal-fade-in'
    }`}>
      <div className={`bg-zinc-900 border border-white/20 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto ${
        isClosing ? 'animate-modal-scale-out' : 'animate-modal-scale-in'
      }`}>
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">
            QuickWatch is shutting down in {Math.max(0, Math.ceil((new Date('2025-08-20').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} days
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-gray-300 leading-relaxed">
            <p>
              Due to personal reasons, I am shutting down QuickWatch. <b>The site will go offline on August 20th</b>. 
              However, since this project is open source, feel free to go to{' '}
              <a 
                href="https://github.com/varunaditya-plus/QuickWatch" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline transition-colors"
              >
                https://github.com/varunaditya-plus/QuickWatch
              </a>{' '}
              and host it on your own computer, or on somewhere like Render/Vercel/GCP/AWS. 
              If you don't have any coding knowledge, ChatGPT can help you do it.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-white mb-3">Forks of QuickWatch:</h3>
            <p className="text-gray-300 mb-4">
              Some people have actually forked QuickWatch and added to the website. 
              Here are some sites you can use if you like QuickWatch (they're basically the same):
            </p>
            <div className="space-y-2">
              <a 
                href="https://nepoflix.micorp.pro/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-blue-400 hover:text-blue-300 underline transition-colors"
              >
                https://nepoflix.micorp.pro/
              </a>
              <a 
                href="https://nepoflix.vercel.app/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-blue-400 hover:text-blue-300 underline transition-colors"
              >
                https://nepoflix.vercel.app/
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-white mb-3">Other streaming sites</h3>
            <p className="text-gray-300 mb-4">
              Here are some other reliable movie/tv streaming sites to take notice of:
            </p>
            <div className="space-y-2">
              <a 
                href="https://veloratv.ru/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-blue-400 hover:text-blue-300 underline transition-colors"
              >
                https://veloratv.ru/
              </a>
              <a 
                href="https://rivestream.org/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-blue-400 hover:text-blue-300 underline transition-colors"
              >
                https://rivestream.org/
              </a>
              <a 
                href="https://www.cineby.app/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-blue-400 hover:text-blue-300 underline transition-colors"
              >
                https://www.cineby.app/
              </a>
              <a 
                href="https://xprime.tv/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-blue-400 hover:text-blue-300 underline transition-colors"
              >
                https://xprime.tv/
              </a>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShutdownModal;