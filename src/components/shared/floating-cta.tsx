
'use client';

import { Button } from '@/components/ui/button';
import { Gift } from 'lucide-react';

interface FloatingCtaProps {
    onGameClick: () => void;
}

export function FloatingCta({ onGameClick }: FloatingCtaProps) {
    return (
        <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50">
            <Button 
                onClick={onGameClick} 
                size="icon" 
                className="rounded-full bg-tolet hover:bg-tolet/90 text-ink border-2 border-ink w-11 h-11 sm:w-12 sm:h-12 shadow-md flex items-center justify-center"
            >
                <Gift className="w-5 h-5" />
                <span className="sr-only">Play to Win</span>
            </Button>
        </div>
    );
}
