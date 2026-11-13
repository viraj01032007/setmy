'use client';

import React, { useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from "@tanstack/react-router";
import { RazorpayScript } from "@/components/razorpay-script";
import { startCheckout } from "@/lib/razorpay";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId?: string;
  amount?: number;
  userEmail?: string;
  userName?: string;
  pricing?: any;
  onProceedToPayment?: (plan?: any) => Promise<void> | void;
}

export function ListPropertyPaymentModal({ 
  isOpen, 
  onClose, 
  propertyId = '', 
  amount = 499,
  userEmail = "owner@setmystay.com",
  userName = "Property Owner",
  onProceedToPayment,
}: PaymentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handlePayment = async () => {
    setIsProcessing(true);
    onClose();

    toast({
      title: "Connecting to payment gateway...",
      description: "Please wait a moment.",
    });

    setTimeout(async () => {
      try {
        await startCheckout({
          amount,
          planName: 'Property Listing Fee',
          propertyId: propertyId || null,
          prefill: {
            name: (typeof window !== 'undefined' && localStorage.getItem('user_name')) || userName,
            email: userEmail,
          },
          onSuccess: async (response) => {
            toast({ title: "Payment Successful!", description: "Submitting your listing for approval..." });

            // 1. Create the listing now that payment went through
            if (onProceedToPayment) {
              try {
                await onProceedToPayment({ title: 'Property Listing Fee', price: amount });
              } catch (err) {
                console.error("Error in onProceedToPayment:", err);
              }
            }

            // 2. Server verifies the Razorpay signature and records the purchase
            try {
              await api.post('/payments/verify-local/', {
                property_id: propertyId || null,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                plan_name: 'Property Listing Fee',
              });
            } catch (e) {
              console.warn("Verification warning:", e);
            }

            // 3. Local history so the History modal shows it immediately
            try {
              const existing = JSON.parse(localStorage.getItem('setmystay_purchase_history') || '[]');
              const now = new Date().toISOString();
              localStorage.setItem('setmystay_purchase_history', JSON.stringify([
                { id: response.razorpay_payment_id, plan: 'Property Listing Fee', plan_name: 'Property Listing Fee', date: now, created_at: now, amount },
                ...existing,
              ]));
            } catch (e) {
              console.error(e);
            }

            toast({ title: "Listing Submitted!", description: "Our team will review it shortly — you'll see it live once approved." });
            setIsProcessing(false);
            navigate({ to: "/" });
          },
          onFailure: (message) => {
            toast({ title: "Payment Failed", description: message, variant: "destructive" });
            setIsProcessing(false);
          },
          onDismiss: () => setIsProcessing(false),
        });
      } catch (error: any) {
        toast({ title: "Payment Gateway Error", description: error?.message || "Could not start the payment.", variant: "destructive" });
        setIsProcessing(false);
      }
    }, 400);
  };

  return (
    <>
      <RazorpayScript />
      
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Your Listing</DialogTitle>
            <DialogDescription>
              Pay the listing fee of ₹{amount} to publish your property on SetMyStay.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 py-4">
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg">
              <span className="font-medium text-slate-700">Total Amount</span>
              <span className="font-bold text-lg">₹{amount}</span>
            </div>
            
            <Button 
              onClick={handlePayment} 
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? "Processing..." : `Pay ₹${amount} Now`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}