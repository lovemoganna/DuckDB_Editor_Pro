import React, { useEffect, useState } from 'react';
import { aiThrottler } from '../services/aiService';

export const AICooldownBanner: React.FC = () => {
    const [remaining, setRemaining] = useState(0);

    useEffect(() => {
        // Poll every 1s to update the remaining time
        const interval = setInterval(() => {
            const rem = aiThrottler.getRemainingTime();
            setRemaining(rem);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    if (remaining <= 0) return null;

    const seconds = Math.ceil(remaining / 1000);

    return (
        <div className="fixed bottom-6 right-6 z-[9999] animate-[slideUp_0.3s_ease-out]">
            <div className="bg-white/90 backdrop-blur shadow-xl border border-amber-200 rounded-full py-2 px-4 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin"></div>
                <span className="text-amber-700 font-mono font-bold text-sm tracking-widest">{seconds}s</span>
            </div>
        </div>
    );
};
