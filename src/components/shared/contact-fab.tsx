
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, X, Mail, MessageCircle } from 'lucide-react';
import { Link } from "@tanstack/react-router";
import { cn } from '@/lib/utils';
import { WHATSAPP_NUMBER } from '@/lib/contact';

export function ContactFab() {
    const [isOpen, setIsOpen] = useState(false);

    const emailAddress = "setmystay02@gmail.com";
    const whatsappNumber = WHATSAPP_NUMBER;
    const whatsappMessage = "Hello, I have a question about SetMyStay.";

    return (
        <div className="fixed bottom-20 left-4 md:bottom-6 md:left-6 z-50">
            <div className="relative flex flex-col items-center gap-2">
                 <a
                    href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                        "transition-all duration-300 ease-in-out",
                        isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
                    )}
                >
                    <Button
                        size="icon"
                        className="rounded-full bg-[#25D366] hover:bg-[#1ebe5a] text-white w-11 h-11 shadow-md flex items-center justify-center"
                        aria-label="WhatsApp"
                    >
                        <MessageCircle className="w-6 h-6" />
                    </Button>
                </a>
                 <a
                    href={`mailto:${emailAddress}`}
                    className={cn(
                        "transition-all duration-300 ease-in-out",
                        isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
                    )}
                >
                    <Button
                        size="icon"
                        className="rounded-full bg-ink hover:bg-ink/90 text-white w-11 h-11 shadow-md flex items-center justify-center"
                        aria-label="Email Us"
                    >
                        <Mail className="w-6 h-6" />
                    </Button>
                </a>
                
                <Button
                    onClick={() => setIsOpen(!isOpen)}
                    size="icon"
                    className="rounded-full bg-ink hover:bg-ink/90 text-white w-11 h-11 sm:w-12 sm:h-12 shadow-md flex items-center justify-center transition-transform duration-300"
                    style={{ transform: isOpen ? 'rotate(45deg)' : 'none' }}
                >
                    <Plus className="w-5 h-5" />
                    <span className="sr-only">Contact Us</span>
                </Button>
            </div>
        </div>
    );
}
