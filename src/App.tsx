/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  Check, 
  X, 
  Wallet, 
  Settings, 
  Repeat, 
  Bitcoin, 
  Coins, 
  CircleDollarSign, 
  Upload, 
  Camera, 
  ShieldCheck, 
  Info,
  ChevronDown,
  Lock,
  ExternalLink,
  FileDown,
  Loader2,
  Plus,
  MessageCircle,
  Calendar,
  Download
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- Types ---

type Step = 'registration' | 'purchase' | 'declarations' | 'upload' | 'success';

interface FormData {
  fullName: string;
  phone: string;
  email: string;
  marketingConsent: boolean | null;
  purchaseType: 'one-time' | 'recurring';
  recurringDay: number | null;
  purchaseStep: 'path' | 'date' | 'currency' | 'amount';
  currencies: string[];
  distribution: Record<string, number>;
  distributionMode: 'percentage' | 'amount';
  amount: string;
  paymentCurrency: 'ILS' | 'USD';
  kyc: {
    criminalRecord: boolean | null;
    refusedService: boolean | null;
    pep: boolean | null;
    darkWeb: boolean | null;
    thirdParty: boolean | null;
    volume: string;
    purpose: string;
    purposeOther: string;
    sourceOfFunds: string[];
    sourceOfFundsOther: string;
  };
  idNumber: string;
  declaration: boolean;
  documents: { type: 'id' | 'passport' | 'license' | null; front: string | null; back: string | null }[];
}

// --- Components ---

const Logo = ({ className = "h-8" }: { className?: string }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <div className="w-9 h-9 bg-black rounded flex items-center justify-center">
      <Wallet className="text-white w-5 h-5" />
    </div>
    <div className="flex flex-col leading-none">
      <span className="font-extrabold text-2xl tracking-tighter uppercase text-black">Tectona</span>
      <span className="text-[10px] font-black tracking-[0.3em] uppercase -mt-1 text-black opacity-80">קריפטו</span>
    </div>
  </div>
);

const CameraCapture = ({ onCapture, onClose }: { onCapture: (data: string) => void, onClose: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError('לא ניתן לגשת למצלמה. אנא וודא שנתת הרשאות.');
      }
    }
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const data = canvasRef.current.toDataURL('image/jpeg');
        onCapture(data);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6">
      <div className="relative w-full max-w-lg aspect-[3/4] bg-zinc-900 rounded-[40px] overflow-hidden border-4 border-white/10">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-10 space-y-4">
            <X className="w-12 h-12 text-red-500" />
            <p className="text-white font-bold">{error}</p>
            <button onClick={onClose} className="px-6 py-3 bg-white text-black rounded-xl font-bold">סגור</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
              <div className="w-full h-full border-2 border-white/20 rounded-2xl" />
            </div>
          </>
        )}
      </div>
      
      {!error && (
        <div className="mt-10 flex items-center gap-8">
          <button onClick={onClose} className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all">
            <X className="w-8 h-8" />
          </button>
          <button onClick={capture} className="w-24 h-24 rounded-full bg-white p-2 shadow-2xl shadow-white/20 active:scale-90 transition-all">
            <div className="w-full h-full rounded-full border-4 border-black" />
          </button>
          <div className="w-16" /> {/* Spacer */}
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

const StepIndicator = ({ current, total, label }: { current: number, total: number, label: string }) => {
  const progress = (current / total) * 100;
  return (
    <div className="mb-10">
      <div className="flex justify-between items-end mb-3">
        <span className="text-sm font-bold text-black">{label}</span>
        <span className="text-xs font-black uppercase tracking-widest text-black/40">שלב {current} / {total}</span>
      </div>
      <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden flex flex-row-reverse">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-brand-primary rounded-full"
        />
      </div>
    </div>
  );
};

export default function App() {
  const [step, setStep] = useState<Step>('registration');
  const mainRef = useRef<HTMLElement>(null);
  const [showFees, setShowFees] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCamera, setActiveCamera] = useState<{ index: number, side: 'front' | 'back' } | null>(null);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    phone: '',
    email: '',
    marketingConsent: null,
    purchaseType: 'one-time',
    recurringDay: null,
    purchaseStep: 'path',
    currencies: ['BTC'],
    distribution: { 'BTC': 100 },
    distributionMode: 'percentage',
    amount: '',
    paymentCurrency: 'ILS',
    kyc: {
      criminalRecord: null,
      refusedService: null,
      pep: null,
      darkWeb: null,
      thirdParty: null,
      volume: '',
      purpose: '',
      purposeOther: '',
      sourceOfFunds: [],
      sourceOfFundsOther: '',
    },
    idNumber: '',
    declaration: false,
    documents: [
      { type: null, front: null, back: null },
      { type: null, front: null, back: null }
    ],
  });

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [step]);

  const getMinAmount = () => {
    if (formData.purchaseType === 'one-time') return formData.paymentCurrency === 'ILS' ? 5000 : 1350;
    return formData.paymentCurrency === 'ILS' ? 150 : 40;
  };

  const getMaxCurrencies = () => {
    return 9;
  };

  const isAmountValid = () => {
    if (!formData.amount) return false;
    const val = parseFloat(formData.amount);
    return val >= getMinAmount();
  };

  const toggleCurrency = (id: any) => {
    const max = getMaxCurrencies();
    if (formData.currencies.includes(id)) {
      if (formData.currencies.length > 1) {
        const newCurrencies = formData.currencies.filter(c => c !== id);
        const newDistribution = { ...formData.distribution };
        delete newDistribution[id];
        
        // Redistribute equally as a starting point
        const equalShare = Math.floor(100 / newCurrencies.length);
        newCurrencies.forEach((c, i) => {
          newDistribution[c] = i === 0 ? 100 - (equalShare * (newCurrencies.length - 1)) : equalShare;
        });

        setFormData({ ...formData, currencies: newCurrencies, distribution: newDistribution });
      }
    } else {
      if (formData.currencies.length < max) {
        const newCurrencies = [...formData.currencies, id];
        const newDistribution = { ...formData.distribution };
        
        // Redistribute equally
        const equalShare = Math.floor(100 / newCurrencies.length);
        newCurrencies.forEach((c, i) => {
          newDistribution[c] = i === 0 ? 100 - (equalShare * (newCurrencies.length - 1)) : equalShare;
        });

        setFormData({ ...formData, currencies: newCurrencies, distribution: newDistribution });
      }
    }
  };

  const updateDistribution = (id: string, value: number) => {
    setFormData({
      ...formData,
      distribution: { ...formData.distribution, [id]: value }
    });
  };

  const isDistributionValid = () => {
    if (formData.currencies.length <= 1) return true;
    const values = Object.values(formData.distribution) as number[];
    const total = values.reduce((a, b) => a + b, 0);
    
    if (formData.distributionMode === 'percentage') {
      return Math.abs(total - 100) < 0.01;
    } else {
      const targetAmount = parseFloat(formData.amount) || 0;
      return Math.abs(total - targetAmount) < 0.01;
    }
  };

  const handleModeChange = (mode: 'percentage' | 'amount') => {
    if (mode === formData.distributionMode) return;
    
    const totalAmount = parseFloat(formData.amount) || 0;
    const newDistribution: Record<string, number> = {};
    
    if (mode === 'amount') {
      // Convert percentages to amounts
      formData.currencies.forEach(c => {
        newDistribution[c] = (totalAmount * (formData.distribution[c] || 0)) / 100;
      });
    } else {
      // Convert amounts to percentages
      formData.currencies.forEach(c => {
        newDistribution[c] = totalAmount > 0 ? ((formData.distribution[c] || 0) / totalAmount) * 100 : (100 / formData.currencies.length);
      });
    }
    
    setFormData({ ...formData, distributionMode: mode, distribution: newDistribution });
  };

  const isRegistrationValid = () => {
    const nameParts = formData.fullName.trim().split(/\s+/);
    return nameParts.length >= 2 && 
           formData.phone.trim().length >= 9 && 
           formData.email.trim().includes('@');
  };

  const isDeclarationsValid = () => {
    const { kyc } = formData;
    const allQuestionsAnswered = 
      kyc.criminalRecord !== null && 
      kyc.refusedService !== null && 
      kyc.pep !== null && 
      kyc.darkWeb !== null && 
      kyc.thirdParty !== null;
    
    const volumeSelected = kyc.volume !== '';
    const purposeSelected = kyc.purpose !== '';
    const purposeOtherFilled = kyc.purpose !== 'oth' || kyc.purposeOther.trim() !== '';
    const sourceOfFundsSelected = kyc.sourceOfFunds.length > 0;
    const sourceOfFundsOtherFilled = !kyc.sourceOfFunds.includes('אחר') || kyc.sourceOfFundsOther.trim() !== '';

    return allQuestionsAnswered && volumeSelected && purposeSelected && purposeOtherFilled && sourceOfFundsSelected && sourceOfFundsOtherFilled;
  };

  const isUploadValid = () => {
    const filledDocs = formData.documents.filter(d => {
      if (!d.type) return false;
      if (d.type === 'passport') return !!d.front;
      return !!d.front && !!d.back;
    });

    if (filledDocs.length === 0) return false;
    if (!formData.declaration) return false;
    if (!formData.idNumber) return false;

    if (filledDocs.length === 1) {
      return filledDocs[0].type === 'id' || filledDocs[0].type === 'passport';
    }

    if (filledDocs.length === 2) {
      // At least one must be ID or Passport
      return filledDocs.some(d => d.type === 'id' || d.type === 'passport');
    }

    return false;
  };

  const nextStep = async () => {
    if (step === 'registration' && !isRegistrationValid()) return;
    if (step === 'purchase' && (
      (formData.purchaseStep === 'currency' && formData.currencies.length === 0) ||
      (formData.purchaseStep === 'amount' && (!isAmountValid() || !isDistributionValid()))
    )) return;
    if (step === 'declarations' && !isDeclarationsValid()) return;
    if (step === 'upload' && !isUploadValid()) return;
    
    if (step === 'registration') setStep('purchase');
    else if (step === 'purchase') {
      if (formData.purchaseStep === 'path') {
        if (formData.purchaseType === 'recurring') setFormData({ ...formData, purchaseStep: 'date' });
        else setFormData({ ...formData, purchaseStep: 'currency' });
      } else if (formData.purchaseStep === 'date') {
        setFormData({ ...formData, purchaseStep: 'currency' });
      } else if (formData.purchaseStep === 'currency') {
        setFormData({ ...formData, purchaseStep: 'amount' });
      } else {
        setStep('declarations');
      }
    }
    else if (step === 'declarations') setStep('upload');
    else if (step === 'upload') {
      setIsSubmitting(true);
      try {
        // Generate PDF base64
        const element = document.getElementById('pdf-content');
        if (element) {
          element.style.display = 'block';
          const canvas = await html2canvas(element, { scale: 1.5, useCORS: true, windowWidth: 800 });
          element.style.display = 'none';
          
          const pdf = new jsPDF('p', 'mm', 'a4');
          const imgData = canvas.toDataURL('image/jpeg', 0.8);
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const imgWidth = canvas.width;
          const imgHeight = canvas.height;
          const ratio = pdfWidth / imgWidth;
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight * ratio);
          const pdfBase64 = pdf.output('datauristring');

          // Send to server
          const response = await fetch('/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: formData.fullName,
              email: formData.email,
              pdfBase64
            })
          });

          if (!response.ok) throw new Error('Submission failed');
        }
        setStep('success');
      } catch (error) {
        console.error('Submission error:', error);
        alert('חלה שגיאה בשליחת הנתונים. אנא נסה שוב.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const prevStep = () => {
    if (step === 'purchase') {
      if (formData.purchaseStep === 'amount') setFormData({ ...formData, purchaseStep: 'currency' });
      else if (formData.purchaseStep === 'currency') {
        if (formData.purchaseType === 'recurring') setFormData({ ...formData, purchaseStep: 'date' });
        else setFormData({ ...formData, purchaseStep: 'path' });
      } else if (formData.purchaseStep === 'date') setFormData({ ...formData, purchaseStep: 'path' });
      else setStep('registration');
    }
    else if (step === 'declarations') setStep('purchase');
    else if (step === 'upload') setStep('declarations');
  };

  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const element = document.getElementById('pdf-content');
      if (!element) return;

      // Temporary show the hidden content for capture
      element.style.display = 'block';
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 800
      });
      
      element.style.display = 'none';

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;

      pdf.addImage(imgData, 'JPEG', (pdfWidth - finalWidth) / 2, 0, finalWidth, finalHeight);
      pdf.save(`Tectona_KYC_${formData.fullName.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[#F9F9F9] text-brand-black font-sans selection:bg-brand-primary selection:text-white" dir="rtl">
      <main ref={mainRef} className="w-full max-w-[1024px] mx-auto min-h-screen bg-white md:shadow-[0_0_80px_rgba(0,0,0,0.03)] flex flex-col relative overflow-hidden md:my-8 md:rounded-[32px] flex-1 px-6 py-8 pb-12 overflow-y-auto scroll-smooth overscroll-contain">
        {/* Top Navigation for Back Button */}
        <div className="flex justify-start mb-4">
          {(step === 'purchase' || step === 'upload' || step === 'declarations') && (
            <button 
              onClick={prevStep}
              className="w-12 h-12 rounded-full border-none bg-white shadow-[var(--shadow-standard)] flex items-center justify-center hover:bg-black/5 transition-all active:scale-90"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
            {step === 'registration' && (
              <motion.div
                key="registration"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-12 max-w-2xl mx-auto w-full py-10"
              >
                <div className="space-y-4 text-center">
                  <h1 className="text-5xl font-bold tracking-tight leading-tight text-brand-primary">טקטונה קריפטו</h1>
                  <p className="text-brand-black/60 text-lg font-normal">הדרך הקלה והבטוחה לקנות קריפטו. בואו נכיר.</p>
                </div>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-black/40 mr-1">שם מלא</label>
                    <div className="relative group">
                      <input 
                        type="text" 
                        placeholder="ישראל ישראלי"
                        className={`w-full h-16 pr-14 input-field font-bold ${
                          formData.fullName && formData.fullName.trim().split(/\s+/).length < 2
                            ? 'border-red-500/50 focus:ring-red-500/5 focus:border-red-500'
                            : ''
                        }`}
                        value={formData.fullName}
                        onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                      />
                      <User className={`absolute right-5 top-1/2 -translate-y-1/2 transition-colors w-6 h-6 ${
                        formData.fullName && formData.fullName.trim().split(/\s+/).length < 2
                          ? 'text-red-500'
                          : 'text-black/20 group-focus-within:text-brand-accent'
                      }`} />
                    </div>
                    {formData.fullName && formData.fullName.trim().split(/\s+/).length < 2 && (
                      <p className="text-[10px] font-bold text-red-500 mr-1">יש להזין שם מלא (לפחות 2 מילים)</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-black/40 mr-1">מספר טלפון</label>
                    <div className="relative group">
                      <input 
                        type="tel" 
                        placeholder="050-0000000"
                        maxLength={10}
                        className="w-full h-16 pr-14 input-field font-normal"
                        value={formData.phone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setFormData({...formData, phone: val});
                        }}
                      />
                      <Phone className="absolute right-5 top-1/2 -translate-y-1/2 text-black/20 group-focus-within:text-brand-accent transition-colors w-6 h-6" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-black/40 mr-1">אימייל</label>
                    <div className="relative group">
                      <input 
                        type="email" 
                        placeholder="your@email.com"
                        className="w-full h-16 pr-14 input-field font-normal"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                      <Mail className="absolute right-5 top-1/2 -translate-y-1/2 text-black/20 group-focus-within:text-brand-accent transition-colors w-6 h-6" />
                    </div>
                  </div>

                  <div className="pt-6 space-y-4">
                    <label className="flex items-center gap-4 p-6 rounded-[12px] bg-white shadow-[var(--shadow-standard)] cursor-pointer group hover:bg-black/[0.01] transition-all">
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          className="peer h-6 w-6 rounded border-black/10 text-brand-accent focus:ring-brand-accent transition-all cursor-pointer appearance-none border-2 checked:bg-brand-accent checked:border-brand-accent"
                          checked={formData.marketingConsent === true}
                          onChange={(e) => setFormData({...formData, marketingConsent: e.target.checked})}
                        />
                        <Check className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                      </div>
                      <span className="text-xs font-bold text-brand-black/60">אני מאשר קבלת דיוור שיווקי ועדכונים מטקטונה</span>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 'purchase' && (
              <motion.div
                key="purchase"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-12 max-w-2xl mx-auto w-full py-10"
              >
                <StepIndicator current={2} total={4} label="בחירת מסלול וסכום" />

                {formData.purchaseStep === 'path' && (
                  <section className="space-y-8">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-brand-black/40 flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        בחירת מסלול
                      </h2>
                      <button 
                        onClick={() => setShowFees(true)}
                        className="text-[10px] font-bold uppercase tracking-widest text-brand-primary bg-brand-primary/5 px-4 py-2 rounded-full hover:bg-brand-primary hover:text-white transition-all flex items-center gap-1.5"
                      >
                        <Info className="w-3 h-3" />
                        עמלות
                      </button>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      {[
                        { id: 'one-time', title: 'קנייה חד פעמית', desc: 'קנייה פשוטה בעמלות אטרקטיביות', icon: Wallet },
                        { id: 'recurring', title: 'הוראת קבע', desc: 'החל מ-150 ש״ח לחודש', icon: Repeat },
                      ].map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setFormData({ ...formData, purchaseType: type.id as any })}
                          className={`p-8 rounded-[12px] text-right transition-all flex flex-col gap-4 group shadow-[var(--shadow-standard)] ${
                            formData.purchaseType === type.id
                              ? 'ring-2 ring-brand-accent bg-brand-accent/5'
                              : 'bg-white hover:bg-black/[0.01]'
                          }`}
                        >
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                            formData.purchaseType === type.id ? 'bg-brand-accent text-white' : 'bg-black/5 text-black/40 group-hover:bg-black/10'
                          }`}>
                            <type.icon className="w-7 h-7" />
                          </div>
                          <div>
                            <h3 className="font-bold text-xl text-brand-black">{type.title}</h3>
                            <p className="text-xs text-brand-black/40 font-normal">{type.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {formData.purchaseStep === 'date' && (
                  <section className="space-y-8">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-brand-black/40 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        יום החיוב בחודש
                      </h2>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      {[1, 10, 15, 20].map((day) => (
                        <button
                          key={day}
                          onClick={() => setFormData({ ...formData, recurringDay: day })}
                          className={`h-20 rounded-[12px] flex flex-col items-center justify-center gap-1 transition-all shadow-[var(--shadow-standard)] ${
                            formData.recurringDay === day
                              ? 'ring-2 ring-brand-accent bg-brand-accent/5'
                              : 'bg-white hover:bg-black/[0.01]'
                          }`}
                        >
                          <span className="text-2xl font-bold text-brand-black">{day}</span>
                          <span className="text-[10px] font-bold text-brand-black/40 uppercase">לחודש</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {formData.purchaseStep === 'currency' && (
                  <section className="space-y-8">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-brand-black/40 flex items-center gap-2">
                        <Coins className="w-4 h-4" />
                        בחירת מטבעות
                      </h2>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-black/20">
                        {formData.currencies.length} / {formData.purchaseType === 'recurring' ? 9 : getMaxCurrencies()} נבחרו
                      </span>
                    </div>
                    
                    <div className="relative">
                      <div className="flex overflow-x-auto pb-8 gap-4 no-scrollbar -mx-6 px-6">
                        {[
                          { id: 'BTC', name: 'Bitcoin', color: '#F7931A' },
                          { id: 'ETH', name: 'Ethereum', color: '#627EEA' },
                          { id: 'XRP', name: 'XRP', color: '#23292F' },
                          { id: 'SOL', name: 'Solana', color: '#14F195' },
                          { id: 'LTC', name: 'Litecoin', color: '#345D9D' },
                          { id: 'USDC', name: 'USDC', color: '#2775CA' },
                          { id: 'MATIC', name: 'Polygon', color: '#8247E5' },
                          { id: 'AVAX', name: 'Avalanche', color: '#E84142' },
                          { id: 'ADA', name: 'Cardano', color: '#0033AD' },
                        ].map((coin) => (
                          <button
                            key={coin.id}
                            onClick={() => toggleCurrency(coin.id)}
                            className={`flex-shrink-0 w-28 h-36 rounded-[12px] flex flex-col items-center justify-center gap-4 transition-all shadow-[var(--shadow-standard)] ${
                              formData.currencies.includes(coin.id)
                                ? 'ring-2 ring-brand-accent bg-brand-accent/5'
                                : 'bg-white hover:bg-black/[0.01]'
                            }`}
                          >
                            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow-sm">
                              <img 
                                src={`https://cryptoicons.org/api/icon/${coin.id.toLowerCase()}/200`} 
                                alt={coin.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${coin.id}&background=${coin.color.replace('#', '')}&color=fff`;
                                }}
                              />
                            </div>
                            <span className="text-sm font-bold text-brand-black">{coin.id}</span>
                            {formData.currencies.includes(coin.id) && (
                              <div className="w-6 h-6 rounded-full bg-brand-accent flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      {/* Pagination Dots */}
                      <div className="flex justify-center gap-2 mt-2">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-brand-accent' : 'bg-black/10'}`} />
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {formData.purchaseStep === 'amount' && (
                  <div className="space-y-12">
                    {formData.currencies.length > 1 && (
                      <section className="space-y-8">
                        <div className="flex items-center justify-between">
                          <h2 className="text-sm font-bold uppercase tracking-widest text-brand-black/40 flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            חלוקת תיק השקעות
                          </h2>
                          <div className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                            isDistributionValid() ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                          }`}>
                            סה"כ: {Object.values(formData.distribution).reduce((a: number, b: number) => a + b, 0)}%
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          {formData.currencies.map(c => (
                            <div key={c} className="bg-white p-6 rounded-[12px] shadow-[var(--shadow-standard)] flex items-center gap-6">
                              <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center font-bold text-sm text-brand-black">
                                {c}
                              </div>
                              <div className="flex-1 flex items-center gap-6">
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  step="5"
                                  value={formData.distribution[c] || 0}
                                  onChange={(e) => updateDistribution(c, parseInt(e.target.value))}
                                  className="flex-1 h-2 bg-black/5 rounded-full appearance-none cursor-pointer accent-brand-accent"
                                />
                                <div className="flex items-center gap-1 min-w-[70px] justify-end">
                                  <input 
                                    type="number"
                                    value={formData.distribution[c] || 0}
                                    onChange={(e) => updateDistribution(c, parseInt(e.target.value) || 0)}
                                    className="w-12 text-right text-base font-bold border-none p-0 focus:ring-0 bg-transparent text-brand-black"
                                  />
                                  <span className="text-sm font-bold text-brand-black/20">%</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {!isDistributionValid() && (
                          <p className="text-[10px] font-bold text-red-500 text-center">
                            הסכום הכולל חייב להיות בדיוק 100%
                          </p>
                        )}
                      </section>
                    )}

                    <section className="space-y-8">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-brand-black/40 flex items-center gap-2">
                          <CircleDollarSign className="w-4 h-4" />
                          סכום לרכישה
                        </h2>
                        <div className="flex bg-black/5 p-1 rounded-full">
                          {['ILS', 'USD'].map((curr) => (
                            <button 
                              key={curr}
                              onClick={() => setFormData({...formData, paymentCurrency: curr as any})}
                              className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${
                                formData.paymentCurrency === curr 
                                  ? 'bg-white shadow-sm text-brand-black' 
                                  : 'text-brand-black/30 hover:text-brand-black/50'
                              }`}
                            >
                              {curr} {curr === 'ILS' ? '₪' : '$'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="relative group">
                        <div className="absolute left-8 top-1/2 -translate-y-1/2 text-brand-black/20 font-bold text-4xl group-focus-within:text-brand-primary transition-colors">
                          {formData.paymentCurrency === 'ILS' ? '₪' : '$'}
                        </div>
                        <input 
                          type="text" 
                          placeholder="150"
                          className={`w-full bg-white rounded-[12px] text-6xl font-bold py-10 pl-10 pr-24 text-left dir-ltr transition-all outline-none placeholder-brand-black/10 shadow-[var(--shadow-standard)] ${
                            formData.amount && !isAmountValid() 
                              ? 'ring-2 ring-red-500' 
                              : 'focus:ring-2 focus:ring-brand-primary'
                          }`}
                          value={formData.amount ? Number(formData.amount.replace(/,/g, '')).toLocaleString() : ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/,/g, '');
                            if (/^\d*\.?\d*$/.test(val)) {
                              setFormData({...formData, amount: val});
                            }
                          }}
                        />
                      </div>
                      {formData.amount && !isAmountValid() && (
                        <p className="text-xs font-bold text-red-500 text-center bg-red-50 py-4 rounded-[12px]">
                          מינימום רכישה: {getMinAmount().toLocaleString()} {formData.paymentCurrency === 'ILS' ? '₪' : '$'}
                        </p>
                      )}
                    </section>
                  </div>
                )}
              </motion.div>
            )}

            {step === 'declarations' && (
              <motion.div
                key="declarations"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-12 max-w-2xl mx-auto w-full py-10"
              >
                <StepIndicator current={3} total={4} label="שאלון קצרצר" />

                <div className="space-y-4 text-center">
                  <h1 className="text-4xl font-bold tracking-tight leading-tight text-brand-primary">שאלון קצרצר</h1>
                  <p className="text-brand-black/50 text-lg font-normal">הצהרות ופרטים נוספים, אנחנו מחויבים להכיר את הלקוחות שלנו</p>
                </div>

                <div className="space-y-10">
                  {/* Activity Scope */}
                  <div className="space-y-4">
                    <label className="text-sm font-bold uppercase tracking-widest text-brand-black/40 mr-1">היקף פעילות מתוכנן (שנתי)</label>
                    <div className="relative group">
                      <select 
                        className="appearance-none w-full h-16 bg-white rounded-[12px] shadow-[var(--shadow-standard)] px-6 font-normal text-brand-black outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                        value={formData.kyc.volume}
                        onChange={(e) => setFormData({...formData, kyc: {...formData.kyc, volume: e.target.value}})}
                      >
                        <option value="" disabled>בחר היקף פעילות</option>
                        <option value="1">עד 300,000 ₪</option>
                        <option value="2">300,000 ₪ - 1,500,000 ₪</option>
                        <option value="3">1,500,000 ₪ - 2,000,000 ₪</option>
                        <option value="4">מעל 2,000,000 ₪</option>
                      </select>
                      <ChevronDown className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-black/20 group-focus-within:text-brand-accent transition-colors w-6 h-6 pointer-events-none" />
                    </div>
                  </div>

                  {/* Purpose */}
                  <div className="space-y-4">
                    <label className="text-sm font-bold uppercase tracking-widest text-brand-black/40 mr-1">מהי המטרה והשימושים המתוכננים?</label>
                    <div className="relative group">
                      <select 
                        className="appearance-none w-full h-16 bg-white rounded-[12px] shadow-[var(--shadow-standard)] px-6 font-normal text-brand-black outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                        value={formData.kyc.purpose}
                        onChange={(e) => setFormData({...formData, kyc: {...formData.kyc, purpose: e.target.value}})}
                      >
                        <option value="" disabled>בחר מטרה עיקרית</option>
                        <option value="inv">השקעה (Investment)</option>
                        <option value="trd">מסחר (Trading)</option>
                        <option value="pay">תשלומים (Payment)</option>
                        <option value="oth">אחר</option>
                      </select>
                      <ChevronDown className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-black/20 group-focus-within:text-brand-accent transition-colors w-6 h-6 pointer-events-none" />
                    </div>
                    <AnimatePresence>
                      {formData.kyc.purpose === 'oth' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="pt-2 overflow-hidden"
                        >
                          <textarea 
                            className="w-full bg-white rounded-[12px] shadow-[var(--shadow-standard)] p-6 min-h-[120px] resize-none font-normal text-brand-black outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                            placeholder="פרט את המטרה והשימושים..."
                            value={formData.kyc.purposeOther}
                            onChange={(e) => setFormData({...formData, kyc: {...formData.kyc, purposeOther: e.target.value}})}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Source of Funds */}
                  <div className="space-y-4">
                    <label className="text-sm font-bold uppercase tracking-widest text-brand-black/40 mr-1">מה מקור הכספים? (ניתן לבחור מספר אפשרויות)</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {['עסקי', 'חסכונות', 'משכורת', 'השקעות', 'הלוואה', 'אחר'].map((source) => (
                        <label 
                          key={source}
                          className={`flex items-center gap-3 p-4 rounded-[12px] cursor-pointer transition-all shadow-[var(--shadow-standard)] ${
                            formData.kyc.sourceOfFunds.includes(source)
                              ? 'ring-2 ring-brand-accent bg-brand-accent/5'
                              : 'bg-white hover:bg-black/[0.01]'
                          }`}
                        >
                          <div className="relative flex items-center justify-center">
                            <input 
                              type="checkbox" 
                              className="peer h-5 w-5 rounded border-black/10 text-brand-accent focus:ring-brand-accent transition-all cursor-pointer appearance-none border-2 checked:bg-brand-accent checked:border-brand-accent"
                              checked={formData.kyc.sourceOfFunds.includes(source)}
                              onChange={(e) => {
                                const newSources = e.target.checked 
                                  ? [...formData.kyc.sourceOfFunds, source]
                                  : formData.kyc.sourceOfFunds.filter(s => s !== source);
                                setFormData({...formData, kyc: {...formData.kyc, sourceOfFunds: newSources}});
                              }}
                            />
                            <Check className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                          </div>
                          <span className="text-sm font-bold text-brand-black">{source}</span>
                        </label>
                      ))}
                    </div>
                    <AnimatePresence>
                      {formData.kyc.sourceOfFunds.includes('אחר') && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="pt-2 overflow-hidden"
                        >
                          <input 
                            type="text"
                            className="w-full h-16 bg-white rounded-[12px] shadow-[var(--shadow-standard)] px-6 font-normal text-brand-black outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                            placeholder="פרט מקור כספים אחר..."
                            value={formData.kyc.sourceOfFundsOther}
                            onChange={(e) => setFormData({...formData, kyc: {...formData.kyc, sourceOfFundsOther: e.target.value}})}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Yes/No Questions */}
                  <div className="space-y-8 pt-8 border-t border-black/5">
                    {[
                      { key: 'criminalRecord', label: 'האם התנהלו או מתנהלים נגדך תהליכים פליליים?', desc: 'עבירות כלכליות, הלבנת הון או מימון טרור' },
                      { key: 'refusedService', label: 'האם סורבת בעבר על ידי גוף פיננסי?', desc: 'בשל סיבות הקשורות להלבנת הון' },
                      { key: 'pep', label: 'האם אתה איש ציבור (PEP)?', desc: 'או בן משפחה של איש ציבור' },
                      { key: 'darkWeb', label: 'האם בכוונתך להעביר כספים לדארק-נט?', desc: 'או לאתרים שאינם חוקיים' },
                      { key: 'thirdParty', label: 'האם קיים צד ג\' שעבורו מבוצעת הפעילות?', desc: 'במידה ואתה פועל בשם מישהו אחר' },
                    ].map((q) => (
                      <div key={q.key} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-base font-bold text-brand-black">{q.label}</label>
                          <p className="text-xs text-brand-black/40 font-normal">{q.desc || ''}</p>
                        </div>
                        <div className="flex gap-3">
                          {[
                            { label: 'כן', val: true },
                            { label: 'לא', val: false }
                          ].map((opt) => (
                            <button
                              key={opt.label}
                              onClick={() => setFormData({
                                ...formData, 
                                kyc: { ...formData.kyc, [q.key]: opt.val }
                              })}
                              className={`flex-1 py-4 rounded-[12px] font-bold text-sm tracking-widest uppercase transition-all shadow-[var(--shadow-standard)] ${
                                (formData.kyc as any)[q.key] === opt.val
                                  ? 'ring-2 ring-brand-accent bg-brand-accent/5 text-brand-primary'
                                  : 'bg-white hover:bg-black/[0.01] text-brand-black/40'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legal Disclaimer */}
                <div className="pt-10 border-t border-black/5 text-center">
                  <p className="text-[10px] text-black/30 font-medium leading-relaxed max-w-lg mx-auto">
                    טקטונה קריפטו פועלת בהתאם להוראות הדין והרגולציה בישראל. המידע הנאסף בשאלון זה נועד למילוי חובותינו על פי חוק איסור הלבנת הון וצווי איסור הלבנת הון החלים עלינו. המידע יישמר בסודיות וישמש למטרות אלו בלבד.
                  </p>
                </div>
              </motion.div>
            )}

            {step === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-12 max-w-2xl mx-auto w-full py-10"
              >
                <StepIndicator current={4} total={4} label="מזהים אותך" />

                <div className="space-y-4 text-center">
                  <h1 className="text-4xl font-bold tracking-tight leading-tight text-brand-primary">מזהים אותך</h1>
                  <p className="text-brand-black/50 text-lg font-normal">מצלמים את התעודה משני הצדדים, כדי שנוכל לאמת את פרטיך ולהגן על חשבון המטבעות שלך</p>
                </div>

                <div className="space-y-10">
                  <div className="space-y-4">
                    <label className="text-sm font-bold uppercase tracking-widest text-brand-black/40 mr-1">מספר תעודת זהות</label>
                    <div className="relative group">
                      <input 
                        type="text" 
                        placeholder="000000000"
                        className="w-full h-16 bg-white rounded-[12px] shadow-[var(--shadow-standard)] px-14 font-normal text-brand-black outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                        value={formData.idNumber}
                        onChange={(e) => setFormData({...formData, idNumber: e.target.value})}
                      />
                      <ShieldCheck className="absolute right-5 top-1/2 -translate-y-1/2 text-brand-black/20 group-focus-within:text-brand-accent transition-colors w-6 h-6" />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <label className="text-sm font-bold uppercase tracking-widest text-brand-black/40 mr-1">צילום תעודות (1 או 2)</label>
                    <div className="space-y-6">
                      {formData.documents.map((doc, idx) => (
                        <div key={idx} className="p-8 rounded-[12px] bg-white shadow-[var(--shadow-standard)] space-y-6">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-widest text-brand-black/30">תעודה {idx + 1}</span>
                            {(doc.front || doc.back) && (
                              <button 
                                onClick={() => {
                                  const newDocs = [...formData.documents];
                                  newDocs[idx] = { type: null, front: null, back: null };
                                  setFormData({...formData, documents: newDocs});
                                }}
                                className="text-[10px] font-bold uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors"
                              >
                                הסר מסמך
                              </button>
                            )}
                          </div>
                          
                          {!doc.type ? (
                            <div className="grid grid-cols-3 gap-3">
                              {[
                                { id: 'id', label: 'ת.ז' },
                                { id: 'passport', label: 'דרכון' },
                                { id: 'license', label: 'רישיון' }
                              ].map((type) => (
                                <button
                                  key={type.id}
                                  onClick={() => {
                                    const newDocs = [...formData.documents];
                                    newDocs[idx].type = type.id as any;
                                    setFormData({...formData, documents: newDocs});
                                  }}
                                  className="py-4 rounded-[12px] text-xs font-bold bg-white text-brand-black/40 hover:ring-2 hover:ring-brand-accent hover:text-brand-primary transition-all shadow-[var(--shadow-standard)]"
                                >
                                  {type.label}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-black/40">סוג:</span>
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">
                                    {doc.type === 'id' ? 'תעודת זהות' : doc.type === 'passport' ? 'דרכון' : 'רישיון נהיגה'}
                                  </span>
                                </div>
                                {!doc.front && !doc.back && (
                                  <button 
                                    onClick={() => {
                                      const newDocs = [...formData.documents];
                                      newDocs[idx].type = null;
                                      setFormData({...formData, documents: newDocs});
                                    }}
                                    className="text-[10px] font-bold uppercase tracking-widest text-brand-black/40 hover:text-brand-primary underline underline-offset-4"
                                  >
                                    שינוי סוג
                                  </button>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-black/30 block text-center">צד קדמי</span>
                                  {!doc.front ? (
                                    <button 
                                      onClick={() => setActiveCamera({ index: idx, side: 'front' })}
                                      className="w-full aspect-video rounded-[12px] bg-black/[0.02] hover:bg-white hover:ring-2 hover:ring-brand-accent transition-all flex flex-col items-center justify-center gap-3 group shadow-inner"
                                    >
                                      <Camera className="w-6 h-6 text-brand-black/20 group-hover:text-brand-accent transition-colors" />
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-black/30 group-hover:text-brand-primary transition-colors">צילום</span>
                                    </button>
                                  ) : (
                                    <div className="relative aspect-video rounded-[12px] overflow-hidden shadow-[var(--shadow-standard)] group">
                                      <img src={doc.front} className="w-full h-full object-cover" alt="Front" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button 
                                          onClick={() => {
                                            const newDocs = [...formData.documents];
                                            newDocs[idx].front = null;
                                            setFormData({...formData, documents: newDocs});
                                          }}
                                          className="bg-white text-brand-black p-2 rounded-full shadow-lg hover:scale-110 transition-transform"
                                        >
                                          <Camera className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-3">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-black/30 block text-center">צד אחורי</span>
                                  {!doc.back ? (
                                    <button 
                                      onClick={() => setActiveCamera({ index: idx, side: 'back' })}
                                      className="w-full aspect-video rounded-[12px] bg-black/[0.02] hover:bg-white hover:ring-2 hover:ring-brand-accent transition-all flex flex-col items-center justify-center gap-3 group shadow-inner"
                                    >
                                      <Camera className="w-6 h-6 text-brand-black/20 group-hover:text-brand-accent transition-colors" />
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-black/30 group-hover:text-brand-primary transition-colors">צילום</span>
                                    </button>
                                  ) : (
                                    <div className="relative aspect-video rounded-[12px] overflow-hidden shadow-[var(--shadow-standard)] group">
                                      <img src={doc.back} className="w-full h-full object-cover" alt="Back" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button 
                                          onClick={() => {
                                            const newDocs = [...formData.documents];
                                            newDocs[idx].back = null;
                                            setFormData({...formData, documents: newDocs});
                                          }}
                                          className="bg-white text-brand-black p-2 rounded-full shadow-lg hover:scale-110 transition-transform"
                                        >
                                          <Camera className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {formData.documents.length < 2 && (
                        <button 
                          onClick={() => setFormData({...formData, documents: [...formData.documents, { type: null, front: null, back: null }]})}
                          className="w-full py-6 rounded-[12px] border-2 border-dashed border-black/10 text-black/30 font-black uppercase tracking-widest text-[10px] hover:border-brand-accent hover:text-brand-primary hover:bg-brand-accent/5 transition-all flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          הוסף תעודה נוספת
                        </button>
                      )}
                    </div>
                  </div>

                  <label className="flex items-start gap-4 p-6 rounded-[12px] bg-brand-primary/5 border-2 border-brand-primary/10 cursor-pointer group hover:bg-brand-primary/10 transition-all">
                    <div className="relative flex items-center justify-center mt-1">
                      <input 
                        type="checkbox" 
                        className="peer h-6 w-6 rounded border-black/10 text-brand-accent focus:ring-brand-accent transition-all cursor-pointer appearance-none border-2 checked:bg-brand-accent checked:border-brand-accent"
                        checked={formData.declaration}
                        onChange={(e) => setFormData({...formData, declaration: e.target.checked})}
                      />
                      <Check className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                    <p className="text-xs leading-relaxed text-brand-primary font-bold">
                      ידוע לי כי מסירת מידע כוזב, לרבות הצהרה כוזבת על פי חוק איסור הלבנת הון, התש"ס-2000, מהווה עבירה פלילית שדינה מאסר. אני מצהיר כי כל המידע שמסרתי לעיל הוא נכון ומדויק.
                    </p>
                  </label>
                </div>

                {activeCamera !== null && (
                  <CameraCapture 
                    onCapture={(data) => {
                      const newDocs = [...formData.documents];
                      newDocs[activeCamera.index][activeCamera.side] = data;
                      setFormData({...formData, documents: newDocs});
                      setActiveCamera(null);
                    }}
                    onClose={() => setActiveCamera(null)}
                  />
                )}
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-xl mx-auto w-full py-16 text-center space-y-12"
              >
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-brand-accent/20 blur-3xl rounded-full" />
                  <div className="relative w-32 h-32 bg-brand-accent rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-brand-accent/40">
                    <Check className="w-16 h-16 text-white" strokeWidth={3} />
                  </div>
                </div>

                <div className="space-y-6">
                  <h1 className="text-5xl font-bold tracking-tight text-brand-primary">איזה כיף, סיימנו!</h1>
                  <p className="text-brand-black/50 text-xl font-normal leading-relaxed">
                    הפרטים שלך התקבלו בהצלחה. כעת נותר רק לתאם שיחת וידאו קצרה לאימות סופי, ואפשר לצאת לדרך.
                  </p>
                </div>
                
                <div className="space-y-4 pt-8">
                  <button 
                    onClick={() => window.open('https://calendly.com/d/cw5d-j46-yy2/kyc', '_blank')}
                    className="w-full h-16 bg-brand-primary text-white rounded-full font-bold text-xl shadow-xl hover:bg-brand-primary/90 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    <Calendar className="w-6 h-6" />
                    תיאום שיחת וידאו
                  </button>
                  
                  <button 
                    onClick={() => window.open('https://wa.me/972500000000', '_blank')}
                    className="w-full h-16 bg-white text-brand-primary rounded-full font-bold text-xl shadow-[var(--shadow-standard)] hover:bg-black/[0.01] transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    <MessageCircle className="w-6 h-6" />
                    דברו איתנו ב-WhatsApp
                  </button>

                  <button 
                    onClick={generatePDF}
                    disabled={isGeneratingPDF}
                    className="w-full h-16 bg-transparent text-brand-black/40 rounded-full font-bold text-lg hover:text-brand-black transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isGeneratingPDF ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    <span>הורדת פרטי ההצטרפות</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Hidden PDF Content - Forced standard colors to avoid oklab errors */}
        <div id="pdf-content" className="hidden fixed left-[-9999px] top-0 w-[800px] bg-white p-12 text-black" dir="rtl" style={{ color: '#000000', backgroundColor: '#ffffff' }}>
          <div className="flex justify-between items-center border-b-4 border-black pb-8 mb-10" style={{ borderColor: '#000000' }}>
            <div className="flex flex-col">
              <h1 className="text-4xl font-black uppercase tracking-tighter" style={{ color: '#000000' }}>Tectona Crypto</h1>
              <p className="text-sm font-bold opacity-50 uppercase tracking-widest" style={{ color: '#000000' }}>KYC Verification Summary</p>
            </div>
            <div className="text-left">
              <p className="text-xs font-black opacity-30 uppercase tracking-widest" style={{ color: '#000000' }}>Date</p>
              <p className="text-lg font-bold" style={{ color: '#000000' }}>{new Date().toLocaleDateString('he-IL')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-12">
            <div className="space-y-6">
              <h2 className="text-xs font-black uppercase tracking-widest text-black/30 border-b border-black/10 pb-2" style={{ color: '#999999', borderColor: '#eeeeee' }}>פרטים אישיים</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/30" style={{ color: '#999999' }}>שם מלא</p>
                  <p className="text-xl font-bold" style={{ color: '#000000' }}>{formData.fullName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/30" style={{ color: '#999999' }}>טלפון</p>
                  <p className="text-xl font-bold" dir="ltr" style={{ color: '#000000' }}>{formData.phone}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/30" style={{ color: '#999999' }}>אימייל</p>
                  <p className="text-xl font-bold" dir="ltr" style={{ color: '#000000' }}>{formData.email}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/30" style={{ color: '#999999' }}>מספר תעודת זהות</p>
                  <p className="text-xl font-bold" style={{ color: '#000000' }}>{formData.idNumber}</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-xs font-black uppercase tracking-widest text-black/30 border-b border-black/10 pb-2" style={{ color: '#999999', borderColor: '#eeeeee' }}>פרטי רכישה</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/30" style={{ color: '#999999' }}>סוג רכישה</p>
                  <p className="text-xl font-bold" style={{ color: '#000000' }}>{formData.purchaseType === 'one-time' ? 'חד פעמית' : 'הוראת קבע'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/30" style={{ color: '#999999' }}>סכום</p>
                  <p className="text-xl font-bold" style={{ color: '#000000' }}>{formData.amount} {formData.paymentCurrency}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/30" style={{ color: '#999999' }}>מטבעות</p>
                  <p className="text-xl font-bold" style={{ color: '#000000' }}>{formData.currencies.join(', ')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8 mb-12">
            <h2 className="text-xs font-black uppercase tracking-widest text-black/30 border-b border-black/10 pb-2" style={{ color: '#999999', borderColor: '#eeeeee' }}>הצהרות KYC</h2>
            <div className="grid grid-cols-2 gap-6">
              {[
                { q: 'עבר פלילי', a: formData.kyc.criminalRecord ? 'כן' : 'לא' },
                { q: 'סירוב שירות בעבר', a: formData.kyc.refusedService ? 'כן' : 'לא' },
                { q: 'איש ציבור (PEP)', a: formData.kyc.pep ? 'כן' : 'לא' },
                { q: 'פעילות בדארק-ווב', a: formData.kyc.darkWeb ? 'כן' : 'לא' },
                { q: 'פעילות עבור צד ג\'', a: formData.kyc.thirdParty ? 'כן' : 'לא' }
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl" style={{ backgroundColor: '#f9f9f9' }}>
                  <span className="text-sm font-bold" style={{ color: '#000000' }}>{item.q}</span>
                  <span className="text-sm font-black" style={{ color: '#000000' }}>{item.a}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <h2 className="text-xs font-black uppercase tracking-widest text-black/30 border-b border-black/10 pb-2" style={{ color: '#999999', borderColor: '#eeeeee' }}>מסמכים מצורפים</h2>
            <div className="grid grid-cols-2 gap-6">
              {formData.documents.map((doc, i) => (
                doc.type && (
                  <div key={i} className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/30" style={{ color: '#999999' }}>
                      {doc.type === 'id' ? 'תעודת זהות' : doc.type === 'passport' ? 'דרכון' : 'רישיון נהיגה'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {doc.front && <img src={doc.front} className="w-full aspect-video object-cover rounded-lg border border-gray-200" style={{ borderColor: '#eeeeee' }} />}
                      {doc.back && <img src={doc.back} className="w-full aspect-video object-cover rounded-lg border border-gray-200" style={{ borderColor: '#eeeeee' }} />}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
          
          <div className="mt-20 pt-10 border-t-2 border-gray-100 text-center" style={{ borderColor: '#f3f4f6' }}>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-20" style={{ color: '#000000' }}>Generated by Tectona Crypto Onboarding System</p>
          </div>
        </div>

        {step !== 'success' && (
          <footer className="mt-auto p-8 border-t border-black/5">
            <div className="max-w-2xl mx-auto w-full flex flex-col gap-6">
              <div className="flex gap-4">
                {step !== 'registration' && step !== 'purchase' && step !== 'upload' && (
                  <button 
                    onClick={prevStep}
                    className="w-20 h-20 rounded-full border-2 border-black/5 flex items-center justify-center hover:bg-black/5 transition-all active:scale-90"
                  >
                    <ArrowRight className="w-8 h-8" />
                  </button>
                )}
                <button 
                  onClick={nextStep}
                  disabled={
                    isSubmitting ||
                    (step === 'registration' && !isRegistrationValid()) ||
                    (step === 'purchase' && (
                      (formData.purchaseStep === 'currency' && formData.currencies.length === 0) ||
                      (formData.purchaseStep === 'amount' && (!isAmountValid() || !isDistributionValid()))
                    )) ||
                    (step === 'declarations' && !isDeclarationsValid()) ||
                    (step === 'upload' && !isUploadValid())
                  }
                  className="flex-1 bg-brand-primary hover:bg-brand-primary/90 text-white font-black py-6 pill-button transition-all shadow-2xl shadow-brand-primary/20 active:scale-[0.98] flex items-center justify-center gap-4 group disabled:opacity-20 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <span className="text-lg uppercase tracking-widest">{step === 'upload' ? 'סיום והגשה' : 'המשך'}</span>
                      <ArrowLeft className="w-6 h-6 group-hover:-translate-x-2 transition-transform" />
                    </>
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] text-black/30 font-black uppercase tracking-[0.2em]">
                  <Lock className="w-3.5 h-3.5" />
                  המידע שלך מוצפן ומאובטח
                </div>
                <button 
                  onClick={() => setShowAdmin(true)}
                  className="text-[10px] font-black uppercase tracking-widest text-black/20 hover:text-black transition-colors"
                >
                  ניהול
                </button>
              </div>
            </div>
          </footer>
        )}
      </div>

      {/* Admin Modal */}
      <AdminPanel isOpen={showAdmin} onClose={() => setShowAdmin(false)} />

      {/* Background Decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none opacity-40 will-change-transform">
        <div className="absolute -top-[10%] -right-[10%] w-[600px] h-[600px] rounded-full bg-slate-200 blur-[80px]" />
        <div className="absolute -bottom-[10%] -left-[10%] w-[600px] h-[600px] rounded-full bg-slate-100 blur-[80px]" />
      </div>

      {/* Fees Modal */}
      <AnimatePresence>
        {showFees && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFees(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[40px] shadow-2xl overflow-hidden border border-black/5"
            >
              <div className="p-8 border-b border-black/5 flex items-center justify-between flex-row-reverse">
                <h3 className="text-2xl font-bold tracking-tight text-brand-black">טבלת עמלות</h3>
                <button 
                  onClick={() => setShowFees(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 transition-all active:scale-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 space-y-8 overflow-y-auto max-h-[60vh]">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-[0.1em] text-brand-primary flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    קנייה חד פעמית
                  </h4>
                  <div className="bg-brand-primary/5 rounded-2xl overflow-hidden border border-brand-primary/10">
                    <table className="w-full text-right text-sm">
                      <thead>
                        <tr className="bg-brand-primary/10">
                          <th className="px-4 py-3 font-bold text-[10px] text-brand-primary">סכום ש״ח</th>
                          <th className="px-4 py-3 font-bold text-[10px] text-brand-primary text-left">% עמלה</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-primary/10">
                        <tr>
                          <td className="px-4 py-3 font-medium text-brand-black">5,000-30,000 ש״ח</td>
                          <td className="px-4 py-3 font-bold text-brand-primary text-left">2.5%</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-brand-black">30,001-100,000 ש״ח</td>
                          <td className="px-4 py-3 font-bold text-brand-primary text-left">2.3%</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-brand-black">100,001 ש״ח ומעלה</td>
                          <td className="px-4 py-3 font-bold text-brand-primary text-left">2.1%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-[0.1em] text-brand-primary flex items-center gap-2">
                    <Repeat className="w-4 h-4" />
                    הוראת קבע חודשית
                  </h4>
                  <div className="bg-brand-primary/5 rounded-2xl overflow-hidden border border-brand-primary/10">
                    <table className="w-full text-right text-sm">
                      <thead>
                        <tr className="bg-brand-primary/10">
                          <th className="px-4 py-3 font-bold text-[10px] text-brand-primary">סכום ש״ח</th>
                          <th className="px-4 py-3 font-bold text-[10px] text-brand-primary text-left">% עמלה</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-primary/10">
                        <tr>
                          <td className="px-4 py-3 font-medium text-brand-black">150-1,000 ש״ח</td>
                          <td className="px-4 py-3 font-bold text-brand-primary text-left">2.5%</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-brand-black">1,001-5,500 ש״ח</td>
                          <td className="px-4 py-3 font-bold text-brand-primary text-left">2.3%</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-brand-black">5,501 ש״ח ומעלה</td>
                          <td className="px-4 py-3 font-bold text-brand-primary text-left">2.1%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <button 
                  onClick={() => setShowFees(false)}
                  className="w-full h-14 bg-brand-primary text-white rounded-full font-bold text-lg shadow-lg hover:bg-brand-primary/90 transition-all active:scale-[0.98]"
                >
                  הבנתי, תודה
                </button>
              </div>
              <div className="p-10 bg-black/[0.02] border-t border-black/5">
                <button 
                  onClick={() => setShowFees(false)}
                  className="w-full py-6 bg-black text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-black/20 active:scale-[0.98] transition-all"
                >
                  הבנתי, תודה
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

const AdminPanel = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSubmissions();
    }
  }, [isOpen]);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/submissions');
      const data = await response.json();
      setSubmissions(data);
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden border border-black/5 flex flex-col max-h-[80vh]"
          >
            <div className="p-10 border-b border-black/5 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="space-y-1">
                <h3 className="text-2xl font-bold tracking-tight text-brand-primary">ניהול פניות (KYC)</h3>
                <p className="text-xs text-brand-black/40 font-bold uppercase tracking-widest">Submissions Dashboard</p>
              </div>
              <button 
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-black/5 transition-all active:scale-90"
              >
                <X className="w-6 h-6 text-brand-black" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <Loader2 className="w-10 h-10 animate-spin text-brand-black/20" />
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-black/30">טוען נתונים...</p>
                </div>
              ) : submissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
                  <div className="w-20 h-20 bg-black/[0.02] rounded-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-brand-black/10" />
                  </div>
                  <p className="text-sm font-bold text-brand-black/40">אין פניות חדשות במערכת</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((sub, i) => (
                    <div key={i} className="group p-6 rounded-3xl bg-white shadow-[var(--shadow-standard)] hover:ring-2 hover:ring-brand-accent transition-all flex items-center justify-between">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center shadow-lg shadow-brand-primary/10">
                          <FileDown className="w-6 h-6 text-white" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-sm truncate max-w-[200px] text-brand-black">{sub.filename}</p>
                          <div className="flex items-center gap-3 text-[10px] font-bold text-brand-black/30 uppercase tracking-widest">
                            <span>{new Date(sub.createdAt).toLocaleDateString('he-IL')}</span>
                            <span className="w-1 h-1 bg-brand-black/10 rounded-full" />
                            <span>{formatSize(sub.size)}</span>
                          </div>
                        </div>
                      </div>
                      <a 
                        href={`/api/admin/download/${sub.filename}`}
                        download
                        className="px-6 py-3 bg-brand-primary text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand-primary/10"
                      >
                        הורדה
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-10 bg-black/[0.02] border-t border-black/5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-black/30">
                  סה"כ פניות: {submissions.length}
                </p>
                <button 
                  onClick={fetchSubmissions}
                  className="text-[10px] font-bold uppercase tracking-widest text-brand-black hover:underline"
                >
                  רענן רשימה
                </button>
              </div>
              <button 
                onClick={async () => {
                  const btn = document.activeElement as HTMLButtonElement;
                  const originalText = btn.innerText;
                  btn.innerText = "שולח...";
                  try {
                    const res = await fetch('/api/admin/test-email', { method: 'POST' });
                    const data = await res.json();
                    if (data.success) alert("מייל בדיקה נשלח בהצלחה ל-Support@tectona.io");
                    else alert("שגיאה: " + data.error);
                  } catch (e) {
                    alert("חלה שגיאה בתקשורת עם השרת");
                  } finally {
                    btn.innerText = originalText;
                  }
                }}
                className="w-full py-3 bg-brand-accent text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-brand-accent/90 transition-all shadow-lg shadow-brand-accent/20"
              >
                שלח מייל בדיקה לתמיכה
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
