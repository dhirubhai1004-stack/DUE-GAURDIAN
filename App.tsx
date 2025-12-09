import React, { useState, useEffect, useRef } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { Vehicle, VehicleType, Emi, Document, PREDEFINED_DOC_NAMES, EmiPayment, AlarmLog, MACHINE_TYPES } from './types';
import Dashboard from './components/Dashboard';
import Modal from './components/Modal';
import Reports from './components/Reports';
import { PlusIcon, ArrowLeftIcon, CarIcon, TruckIcon, MachineIcon, BikeIcon, DashboardIcon, VehicleIcon, DownloadIcon, EditIcon, DeleteIcon, CheckCircleIcon, OtherVehicleIcon, PersonalLoanIcon, BusinessLoanIcon, HomeLoanIcon, LogoutIcon, SettingsIcon, EyeIcon, BellIcon } from './components/icons';
import AddToHomeScreenPrompt from './components/AddToHomeScreenPrompt';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// --- DEVELOPER CONFIGURATION ---
// Your Supabase Keys
const SUPABASE_URL = "https://wpvcibnicferikuovnlt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwdmNpYm5pY2ZlcmlrdW92bmx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMDA1NDcsImV4cCI6MjA4MDY3NjU0N30.F6ySW6GoJAUTfG9eQW8xWxNTjfO4m5x1QBs-KA1v3uk";

// --- Supabase Client Init ---
let supabase: SupabaseClient | null = null;

try {
    if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith('http')) {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                storageKey: 'due-guardian-auth',
                storage: window.localStorage,
                detectSessionInUrl: true,
                autoRefreshToken: true,
            }
        });
    }
} catch (e) {
    console.error("Supabase init failed", e);
}

const vehicleTypeIcons: Record<string, React.ReactNode> = {
    [VehicleType.Car]: <CarIcon className="w-8 h-8 text-blue-400" />,
    [VehicleType.Truck]: <TruckIcon className="w-8 h-8 text-orange-400" />,
    [VehicleType.Machine]: <MachineIcon className="w-8 h-8 text-yellow-400" />,
    [VehicleType.Bike]: <BikeIcon className="w-8 h-8 text-green-400" />,
    [VehicleType.PersonalLoan]: <PersonalLoanIcon className="w-8 h-8 text-emerald-400" />,
    [VehicleType.HomeLoan]: <HomeLoanIcon className="w-8 h-8 text-rose-400" />,
    [VehicleType.BusinessLoan]: <BusinessLoanIcon className="w-8 h-8 text-purple-400" />,
    [VehicleType.Overdraft]: <BusinessLoanIcon className="w-8 h-8 text-amber-400" />,
};

// Base64 Audio Data URIs (Short, offline-friendly sounds)
const SOUND_URLS = {
    subtle: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
    attention: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg',
    urgent: 'https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg'
};

const getVehicleIcon = (type: string) => {
    if (MACHINE_TYPES.includes(type as any)) return <MachineIcon className="w-8 h-8 text-yellow-400" />;
    return vehicleTypeIcons[type] || <OtherVehicleIcon className="w-8 h-8 text-gray-400" />;
}

// Timezone-safe formatting (DD/MM/YY)
const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  const [y, m, d] = parts;
  return `${d}/${m}/${y.slice(-2)}`;
};

const getVehicleDisplayName = (vehicle: Vehicle) => {
    const loanTypes = [
        VehicleType.PersonalLoan, 
        VehicleType.HomeLoan, 
        VehicleType.BusinessLoan, 
        VehicleType.Overdraft
    ] as string[];

    if (loanTypes.includes(vehicle.type)) return `${vehicle.make} ${vehicle.model}`;
    if (vehicle.type === VehicleType.Truck) return `${vehicle.make} ${vehicle.model}`;
    
    return `${vehicle.type} - ${vehicle.make} ${vehicle.model}`;
};

// --- Helper: Image Compression ---
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Aggressively resize to max 800px to save LocalStorage space
                // This ensures files are usually < 100KB
                const MAX_DIM = 800; 
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_DIM) {
                        height *= MAX_DIM / width;
                        width = MAX_DIM;
                    }
                } else {
                    if (height > MAX_DIM) {
                        width *= MAX_DIM / height;
                        height = MAX_DIM;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(event.target?.result as string); // Fallback to original if canvas fails
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                // Compress to JPEG at 50% quality for maximum space saving
                const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};


type View = 'dashboard' | 'vehicleList' | 'vehicleDetail' | 'reports';

// Helper components defined outside App to prevent re-renders
const VehicleFormModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    onSave: (vehicle: Omit<Vehicle, 'id' | 'documents' | 'emis' | 'archivedDocuments'>) => void; 
    mode: 'asset' | 'loan';
    initialData?: Vehicle | null;
}> = ({ isOpen, onClose, onSave, mode, initialData }) => {
    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const [regNum, setRegNum] = useState('');
    const [type, setType] = useState<string>(mode === 'asset' ? VehicleType.Car : VehicleType.PersonalLoan);
    const [customType, setCustomType] = useState('');

    const assetTypes = [VehicleType.Car, VehicleType.Bike, VehicleType.Truck, VehicleType.Machine, VehicleType.Other];
    const loanTypes = [VehicleType.PersonalLoan, VehicleType.HomeLoan, VehicleType.BusinessLoan, VehicleType.Overdraft];

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setMake(initialData.make);
                setModel(initialData.model);
                setRegNum(initialData.registrationNumber);
                
                if (MACHINE_TYPES.includes(initialData.type as any)) {
                    setType(initialData.type);
                    setCustomType('');
                } else {
                    const isKnownType = [...assetTypes, ...loanTypes].includes(initialData.type as any);
                    if (isKnownType && initialData.type !== VehicleType.Other) {
                        setType(initialData.type);
                        setCustomType('');
                    } else {
                        setType(VehicleType.Other);
                        setCustomType(initialData.type);
                    }
                }
            } else {
                setMake('');
                setModel('');
                setRegNum('');
                setCustomType('');
                setType(mode === 'asset' ? VehicleType.Car : VehicleType.PersonalLoan);
            }
        }
    }, [isOpen, mode, initialData]);

    const availableTypes = mode === 'asset' ? assetTypes : loanTypes;
    const isLoanMode = mode === 'loan';
    const placeholderMake = isLoanMode ? "Lender / Bank Name (e.g., HDFC)" : "Make (e.g., Honda)";
    const placeholderModel = isLoanMode ? "Loan Purpose / Name (e.g., Home Renovation)" : "Model (e.g., Civic)";
    const placeholderReg = isLoanMode ? "Loan Account Number" : "Registration Number";
    const buttonText = initialData ? "Save Changes" : (isLoanMode ? "Add Loan" : "Add Vehicle/Asset");
    const titleText = initialData 
        ? (isLoanMode ? "Edit Loan Details" : "Edit Asset Details")
        : (isLoanMode ? "Add New Loan" : "Add New Asset");

    const getCategoryFromType = (t: string) => {
        if (MACHINE_TYPES.includes(t as any)) return VehicleType.Machine;
        if (t === VehicleType.Other || ![...assetTypes, ...loanTypes].includes(t as any)) return VehicleType.Other;
        return t;
    };

    const currentCategory = getCategoryFromType(type);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalType = currentCategory === VehicleType.Other ? customType : type;
        if (!make || !model || !regNum || !finalType) return;
        onSave({ make, model, registrationNumber: regNum.toUpperCase(), type: finalType });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={titleText}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
                <select 
                    value={currentCategory} 
                    onChange={e => {
                        const newCategory = e.target.value;
                        if (newCategory === VehicleType.Machine) {
                            setType(MACHINE_TYPES[0]);
                        } else {
                            setType(newCategory);
                        }
                    }} 
                    className="w-full p-2 bg-slate-700 border border-slate-600 rounded mb-4"
                >
                    {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                
                {currentCategory === VehicleType.Machine && (
                    <div className="mb-4 animate-fadeIn">
                        <label className="block text-sm font-medium text-slate-400 mb-1">Machine Type</label>
                        <select 
                            value={type} 
                            onChange={e => setType(e.target.value)} 
                            className="w-full p-2 bg-slate-700 border border-slate-600 rounded"
                        >
                            {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                )}
                
                {currentCategory === VehicleType.Other && (
                     <input type="text" placeholder="Custom Type Name" value={customType} onChange={e => setCustomType(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                )}
                
                <input type="text" placeholder={placeholderMake} value={make} onChange={e => setMake(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                <input type="text" placeholder={placeholderModel} value={model} onChange={e => setModel(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                <input type="text" placeholder={placeholderReg} value={regNum} onChange={e => setRegNum(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 p-2 rounded text-white font-bold mt-4">{buttonText}</button>
            </form>
        </Modal>
    );
};

const DeleteVehicleModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    vehicleName: string;
}> = ({ isOpen, onClose, onConfirm, vehicleName }) => {
    const [reason, setReason] = useState('');

    useEffect(() => { if (isOpen) setReason(''); }, [isOpen]);

    const handleSubmit = () => {
        if (!reason.trim()) return;
        onConfirm(reason);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Delete Item">
            <div className="space-y-4">
                <p className="text-slate-300">Are you sure you want to delete <span className="font-bold text-white">{vehicleName}</span>? This action cannot be undone and will remove all associated documents and EMIs.</p>
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Reason for Deletion</label>
                    <textarea 
                        value={reason} 
                        onChange={e => setReason(e.target.value)} 
                        placeholder="e.g., Sold, Loan Closed, Scrapped"
                        className="w-full p-2 bg-slate-700 border border-slate-600 rounded min-h-[80px]"
                        required
                    />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className="bg-slate-600 hover:bg-slate-700 p-2 px-4 rounded text-white font-bold">Cancel</button>
                    <button onClick={handleSubmit} disabled={!reason.trim()} className="bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed p-2 px-4 rounded text-white font-bold">Delete</button>
                </div>
            </div>
        </Modal>
    );
}

const EmiFormModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    onSubmit: (emi: Omit<Emi, 'id'>, existingId?: string) => void;
    initialData?: Emi | null;
    vehicleType?: string;
}> = ({ isOpen, onClose, onSubmit, initialData, vehicleType }) => {
    const [amount, setAmount] = useState('');
    const [startDate, setStartDate] = useState('');
    const [totalTenure, setTotalTenure] = useState('');
    const [interest, setInterest] = useState('');
    const [provider, setProvider] = useState('');
    const [loanId, setLoanId] = useState('');
    const [bank, setBank] = useState('');
    const [calculatedEndDate, setCalculatedEndDate] = useState<string | null>(null);
    const [paidTillDate, setPaidTillDate] = useState('');
    const [totalCost, setTotalCost] = useState('');
    const [downPayment, setDownPayment] = useState('');
    const [error, setError] = useState<string | null>(null);
    
    const isEditing = !!initialData;
    const isLoan = [VehicleType.PersonalLoan, VehicleType.BusinessLoan, VehicleType.Overdraft, VehicleType.HomeLoan].includes(vehicleType as VehicleType);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setAmount(String(initialData.amount));
                setStartDate(initialData.startDate);
                setTotalTenure(String(initialData.totalTenure));
                setInterest(String(initialData.interestRate || ''));
                setProvider(initialData.loanProvider || '');
                setLoanId(initialData.loanId || '');
                setBank(initialData.emiBank || '');
                setTotalCost(String(initialData.totalVehicleCost || ''));
                setDownPayment(String(initialData.downPayment || ''));
            }
        } else {
            setAmount(''); setStartDate(''); setTotalTenure('');
            setInterest(''); setProvider(''); setLoanId(''); setBank('');
            setCalculatedEndDate(null); setPaidTillDate('');
            setTotalCost(''); setDownPayment('');
            setError(null);
        }
    }, [isOpen, initialData]);

    useEffect(() => {
        if (startDate && totalTenure) {
            const tenureNum = parseInt(totalTenure, 10);
            if (!isNaN(tenureNum) && tenureNum > 0) {
                const start = new Date(startDate);
                // Subtract 1 from tenure because start date is the first month
                const end = new Date(start.getFullYear(), start.getMonth() + tenureNum - 1, start.getDate());
                const endYMD = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
                setCalculatedEndDate(formatDate(endYMD));
            } else {
                setCalculatedEndDate(null);
            }
        } else {
            setCalculatedEndDate(null);
        }
    }, [startDate, totalTenure]);

    const financedAmount = (parseFloat(totalCost) || 0) - (parseFloat(downPayment) || 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        let paidCount = initialData?.paidInstallments || 0;
        const tenureNum = parseInt(totalTenure, 10);

        if (tenureNum <= 0) {
            setError("Tenure must be greater than 0.");
            return;
        }
        
        if (startDate && paidTillDate && tenureNum > 0) {
            if (new Date(paidTillDate) < new Date(startDate)) {
                setError("Paid Till Date cannot be earlier than Start Date.");
                return;
            }

            const start = new Date(startDate);
            const paidTill = new Date(paidTillDate);
            let calculatedCount = 0;
            if (paidTill >= start) {
                for (let i = 0; i < tenureNum; i++) {
                    const dueDate = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
                    if (dueDate <= paidTill) {
                        calculatedCount++;
                    } else {
                        break;
                    }
                }
            }
            paidCount = calculatedCount;
        }

        onSubmit({ 
            amount: parseFloat(amount), 
            startDate: startDate, 
            totalTenure: tenureNum,
            paidInstallments: paidCount,
            principalAmount: financedAmount > 0 ? financedAmount : undefined,
            interestRate: interest ? parseFloat(interest) : undefined,
            loanProvider: provider || undefined,
            loanId: loanId || undefined,
            emiBank: bank || undefined,
            totalVehicleCost: totalCost ? parseFloat(totalCost) : undefined,
            downPayment: downPayment ? parseFloat(downPayment) : undefined,
        }, initialData?.id);
        onClose();
    };

    const totalAmount = (parseFloat(amount) || 0) * (parseInt(totalTenure, 10) || 0);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit EMI Details' : 'Add EMI Details'}>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                {error && <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded text-sm mb-4">{error}</div>}
                <div>
                    <label className="text-sm text-slate-400 mb-1 block">EMI Amount</label>
                    <input type="number" placeholder="Enter EMI Amount" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm text-slate-400 mb-1 block">Start Date (First EMI)</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                    </div>
                    <div>
                        <label className="text-sm text-slate-400 mb-1 block">Tenure (Months)</label>
                        <input type="number" placeholder="e.g. 36" value={totalTenure} onChange={e => setTotalTenure(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                    </div>
                </div>

                {totalAmount > 0 && <div className="p-2 bg-slate-700/50 rounded text-center">
                    <span className="text-sm text-slate-400">Total Repayment: </span>
                    <span className="font-bold text-white">₹{totalAmount.toLocaleString()}</span>
                </div>}

                {calculatedEndDate && (
                    <div className="p-2 bg-slate-700/50 rounded text-center">
                        <span className="text-sm text-slate-400">Calculated Loan End Date: </span>
                        <span className="font-bold text-white">{calculatedEndDate}</span>
                    </div>
                )}
                
                <hr className="border-slate-700" />
                <h3 className="text-center text-slate-400 text-sm font-semibold pt-2">Loan Details</h3>

                <div>
                    <label className="text-sm text-slate-400 mb-1 block">Paid Till Date</label>
                    <p className="text-xs text-slate-500 mb-1">Select the last date you paid an EMI to auto-calculate progress.</p>
                    <input type="date" value={paidTillDate} onChange={e => setPaidTillDate(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" min={startDate} />
                </div>

                <div>
                    <label className="text-sm text-slate-400 mb-1 block">{isLoan ? "Principal Amount" : "Total Asset Cost"}</label>
                    <input type="number" placeholder={isLoan ? "Principal Loan Amount" : "Total Asset Cost"} value={totalCost} onChange={e => setTotalCost(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                </div>
                
                {!isLoan && (
                    <div>
                        <label className="text-sm text-slate-400 mb-1 block">Down Payment</label>
                        <input type="number" placeholder="Down Payment" value={downPayment} onChange={e => setDownPayment(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                    </div>
                )}
                
                {!isLoan && (
                    <div>
                        <label className="text-sm text-slate-400 mb-1 block">Financed Amount (Auto-Calculated)</label>
                        <input 
                            type="text" 
                            readOnly 
                            value={financedAmount > 0 ? `₹${financedAmount.toLocaleString()}` : ''} 
                            className="w-full p-2 bg-slate-700 border border-slate-600 rounded"
                            aria-label="Financed Amount"
                        />
                    </div>
                )}
                
                <div>
                    <label className="text-sm text-slate-400 mb-1 block">Rate of Interest (%)</label>
                    <input type="number" step="0.01" placeholder="Interest Rate" value={interest} onChange={e => setInterest(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                </div>
                
                <div>
                    <label className="text-sm text-slate-400 mb-1 block">Loan Provider</label>
                    <input type="text" placeholder="e.g. HDFC Bank" value={provider} onChange={e => setProvider(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                </div>
                
                <div>
                    <label className="text-sm text-slate-400 mb-1 block">Loan ID / Account No.</label>
                    <input type="text" placeholder="Loan Account Number" value={loanId} onChange={e => setLoanId(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                </div>
                
                <div>
                    <label className="text-sm text-slate-400 mb-1 block">EMI Bank</label>
                    <input type="text" placeholder="Bank for Auto-Debit" value={bank} onChange={e => setBank(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                </div>

                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 p-2 rounded text-white font-bold !mt-6">{isEditing ? 'Save Changes' : 'Add EMI'}</button>
            </form>
        </Modal>
    );
};


const AddDocModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (doc: Omit<Document, 'id'>, idToUpdate?: string) => void;
    initialData?: Document | null;
    activeDocuments: Document[];
    isRenewing?: boolean;
    vehicleType?: string;
}> = ({ isOpen, onClose, onSave, initialData, activeDocuments, isRenewing, vehicleType }) => {
    const isEditing = !!initialData && !isRenewing;
    const [docName, setDocName] = useState<(typeof PREDEFINED_DOC_NAMES)[number]>(PREDEFINED_DOC_NAMES[0]);
    const [customDocName, setCustomDocName] = useState('');
    const [validFrom, setValidFrom] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [fileData, setFileData] = useState<string | undefined>();
    const [fileName, setFileName] = useState<string | undefined>();
    const [docNameError, setDocNameError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const isLoan = [VehicleType.PersonalLoan, VehicleType.BusinessLoan, VehicleType.Overdraft, VehicleType.HomeLoan].includes(vehicleType as VehicleType);

    const availableDocNames = React.useMemo(() => {
        return isLoan 
            ? PREDEFINED_DOC_NAMES.filter(n => ['Loan Agreement', 'KYC Document', 'Tax Invoice', 'Other'].includes(n))
            : PREDEFINED_DOC_NAMES;
    }, [isLoan]);

    const checkExistingDoc = (name: string, editingDocId?: string): boolean => {
        if (!name) {
            setDocNameError(null);
            return true;
        }

        const existingDoc = activeDocuments.find(d => d.name === name);

        // If we are strictly adding a NEW document (not editing, not renewing)
        if (!isEditing && !isRenewing) {
            if (existingDoc) {
                setDocNameError(`"${name}" is already available. Please delete the existing one or renew it.`);
                return false;
            }
        }
        
        // If editing, exclude self
        if (isEditing && existingDoc && existingDoc.id !== editingDocId) {
            setDocNameError(`"${name}" is already available.`);
            return false;
        }

        setDocNameError(null);
        return true;
    };

    const handleDocNameChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newDocName = e.target.value as (typeof PREDEFINED_DOC_NAMES)[number];
        setDocName(newDocName);
        const nameToCheck = newDocName === 'Other' ? customDocName : newDocName;
        checkExistingDoc(nameToCheck, initialData?.id);
    };

    const handleCustomDocNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCustomDocName(e.target.value);
        checkExistingDoc(e.target.value, initialData?.id);
    };

    const resetForm = () => {
        setDocName(availableDocNames[0]);
        setCustomDocName('');
        setValidFrom('');
        setExpiryDate('');
        setFileData(undefined);
        setFileName(undefined);
        setDocNameError(null);
        setError(null);
        setIsProcessing(false);
    };

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                const name = initialData.name;
                if (availableDocNames.includes(name as any)) {
                    setDocName(name as (typeof PREDEFINED_DOC_NAMES)[number]);
                    setCustomDocName('');
                } else if (PREDEFINED_DOC_NAMES.includes(name as any)) {
                    setDocName('Other');
                    setCustomDocName(name);
                } else {
                    setDocName('Other');
                    setCustomDocName(name);
                }
                
                if (isEditing) {
                    setValidFrom(initialData.validFrom);
                    setExpiryDate(initialData.expiryDate);
                    setFileData(initialData.fileData);
                    setFileName(initialData.fileName);
                }
            } else {
                resetForm();
                // Check if the default selection is already present and warn immediately
                const defaultName = availableDocNames[0];
                const existing = activeDocuments.find(d => d.name === defaultName);
                if (existing && !isRenewing) {
                     setDocNameError(`"${defaultName}" is already available. Please delete the existing one or renew it.`);
                }
            }
        } else {
            resetForm();
        }
    }, [isOpen, initialData, isEditing, availableDocNames, activeDocuments, isRenewing]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setIsProcessing(true);
            setFileName(file.name);
            try {
                if (file.type.startsWith('image/')) {
                    const compressedData = await compressImage(file);
                    setFileData(compressedData);
                } else {
                    if (file.size > 2 * 1024 * 1024) {
                        alert("File is too large! Please upload a file smaller than 2MB.");
                        setFileName(undefined);
                        setFileData(undefined);
                    } else {
                        const reader = new FileReader();
                        reader.onload = (e) => setFileData(e.target?.result as string);
                        reader.readAsDataURL(file);
                    }
                }
            } catch (err) {
                console.error("File processing error", err);
                alert("Could not process this file.");
                setFileName(undefined);
                setFileData(undefined);
            } finally {
                setIsProcessing(false);
            }
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const finalDocName = docName === 'Other' ? customDocName : docName;
        if (!finalDocName || !expiryDate || !validFrom) return;

        if (new Date(expiryDate) < new Date(validFrom)) {
            setError("Expiry Date cannot be earlier than Valid From Date.");
            return;
        }

        if (!checkExistingDoc(finalDocName, initialData?.id)) {
            return;
        }

        onSave({ name: finalDocName, validFrom, expiryDate, fileData, fileName }, isEditing ? initialData?.id : undefined);
        onClose();
    };
    
    const title = isEditing ? 'Edit Document' : (isRenewing ? 'Renew Document' : 'Add Document');

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded text-sm mb-4">{error}</div>}
                 <select value={docName} onChange={handleDocNameChange} className="w-full p-2 bg-slate-700 border border-slate-600 rounded">
                    {availableDocNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                {docName === 'Other' && <input type="text" placeholder="Custom Document Name" value={customDocName} onChange={handleCustomDocNameChange} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />}
                {docNameError && <p className="text-sm text-red-400 mt-1 font-semibold">{docNameError}</p>}
                <div>
                    <label className="text-sm text-slate-400">Valid From</label>
                    <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                </div>
                 <div>
                    <label className="text-sm text-slate-400">Valid Till (Expiry Date)</label>
                    <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required min={validFrom} />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Upload Document (Optional)</label>
                    <input type="file" onChange={handleFileChange} accept=".pdf,image/*" className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-500 file:text-white hover:file:bg-indigo-600" />
                    {isProcessing && <p className="text-xs text-yellow-400 mt-1">Processing file...</p>}
                    {!isProcessing && fileName && <p className="text-xs text-green-400 mt-1">File selected: {fileName}</p>}
                    <p className="text-xs text-slate-500 mt-1">Supports Images (JPG, PNG) and PDF. Max 2MB.</p>
                </div>
                <button type="submit" disabled={!!docNameError || isProcessing} className="w-full bg-indigo-600 hover:bg-indigo-700 p-2 rounded text-white font-bold disabled:bg-slate-600 disabled:cursor-not-allowed">
                    {isEditing ? 'Save Changes' : 'Add Document'}
                </button>
            </form>
        </Modal>
    );
};


const VehicleList: React.FC<{ vehicles: Vehicle[], onSelectVehicle: (id: string) => void, onAddAssetClick: () => void, onAddLoanClick: () => void }> = ({ vehicles, onSelectVehicle, onAddAssetClick, onAddLoanClick }) => (
    <div className="p-4 md:p-6">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-indigo-400">My Assets & Loans</h1>
            <div className="flex gap-2">
                <button onClick={onAddAssetClick} className="bg-indigo-600 hover:bg-indigo-700 py-2 px-3 rounded-lg text-white flex items-center gap-2 text-sm font-bold" title="Add Car, Bike, etc.">
                    <PlusIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Asset</span>
                    <CarIcon className="w-4 h-4 sm:hidden" />
                </button>
                <button onClick={onAddLoanClick} className="bg-emerald-600 hover:bg-emerald-700 py-2 px-3 rounded-lg text-white flex items-center gap-2 text-sm font-bold" title="Add Personal Loan, Home Loan, etc.">
                    <PlusIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Loan</span>
                    <PersonalLoanIcon className="w-4 h-4 sm:hidden" />
                </button>
            </div>
        </div>
        {vehicles.length === 0 ? (
             <div className="text-center py-16 bg-slate-800 rounded-lg">
                <p className="text-slate-400">No items found.</p>
                <div className="flex flex-col items-center gap-3 mt-6">
                    <button onClick={onAddAssetClick} className="w-48 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                        <CarIcon className="w-5 h-5" /> Add Asset
                    </button>
                    <button onClick={onAddLoanClick} className="w-48 bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                        <PersonalLoanIcon className="w-5 h-5" /> Add Loan
                    </button>
                </div>
            </div>
        ) : (
            <div className="space-y-4">
            {vehicles.map(v => (
                <div key={v.id} onClick={() => onSelectVehicle(v.id)} className="bg-slate-800 p-4 rounded-lg flex items-center justify-between cursor-pointer hover:bg-slate-700 transition-colors">
                    <div className="flex items-center space-x-4">
                        {getVehicleIcon(v.type)}
                        <div>
                            <p className="font-bold text-lg">{getVehicleDisplayName(v)}</p>
                            <p className="text-sm text-slate-400">{v.registrationNumber}</p>
                        </div>
                    </div>
                    <span className="text-slate-500">{'>'}</span>
                </div>
            ))}
            </div>
        )}
    </div>
);


const VehicleDetail: React.FC<{ 
    vehicle: Vehicle; 
    onBack: () => void;
    onAddDoc: (doc: Omit<Document, 'id'>, replacingDocId?: string) => void;
    onUpdateDoc: (docId: string, docData: Omit<Document, 'id'>) => void;
    onDeleteDoc: (doc: Document) => void;
    onMarkEmiPaid: (emiId: string) => void;
    onOpenSettleModal: (emi: Emi) => void;
    onEditEmiClick: (emi: Emi | null) => void;
    onEditVehicle: () => void;
    onDeleteVehicle: () => void;
}> = ({ vehicle, onBack, onAddDoc, onUpdateDoc, onDeleteDoc, onMarkEmiPaid, onOpenSettleModal, onEditEmiClick, onEditVehicle, onDeleteVehicle }) => {
    const [isDocModalOpen, setDocModalOpen] = useState(false);
    const [docToReplace, setDocToReplace] = useState<Document | null>(null);
    const [docToEdit, setDocToEdit] = useState<Document | null>(null);
    const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

    const activeEmis = vehicle.emis.filter(e => e.paidInstallments < e.totalTenure);
    const completedEmis = vehicle.emis.filter(e => e.paidInstallments >= e.totalTenure);

    const handleRenewClick = (doc: Document) => {
        setDocToReplace(doc);
        setDocModalOpen(true);
    };

    const handleEditClick = (doc: Document) => {
        setDocToEdit(doc);
    };

    const handleAddDocClick = () => {
        setDocModalOpen(true);
    };
    
    const handleDocModalClose = () => {
        setDocModalOpen(false);
        setDocToReplace(null);
        setDocToEdit(null);
    };

    const handleDocSave = (docData: Omit<Document, 'id'>, idToUpdate?: string) => {
        if (idToUpdate) {
            onUpdateDoc(idToUpdate, docData);
        } else {
            onAddDoc(docData, docToReplace?.id);
        }
    };

    return (
        <div className="p-4 md:p-6">
            <button onClick={onBack} className="flex items-center space-x-2 text-indigo-400 mb-4">
                <ArrowLeftIcon className="w-6 h-6" />
                <span>All Items</span>
            </button>
            <div className="bg-slate-800 p-4 rounded-lg flex justify-between items-start mb-6">
                <div className="flex items-center space-x-4">
                    {getVehicleIcon(vehicle.type)}
                    <div>
                        <h1 className="text-2xl font-bold">{getVehicleDisplayName(vehicle)}</h1>
                        <p className="text-slate-400">{vehicle.registrationNumber}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                     <button onClick={onEditVehicle} className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-700/50 hover:bg-slate-700 transition-colors" title="Edit Details">
                        <EditIcon className="w-5 h-5" />
                    </button>
                     <button onClick={onDeleteVehicle} className="p-2 text-slate-400 hover:text-red-400 rounded-full bg-slate-700/50 hover:bg-slate-700 transition-colors" title="Delete Item">
                        <DeleteIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* EMIs Section */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xl font-bold text-cyan-400">Active EMIs</h2>
                    <button onClick={() => onEditEmiClick(null)} className="bg-cyan-600 hover:bg-cyan-700 p-2 rounded-full text-white">
                        <PlusIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="space-y-3">
                    {activeEmis.map(emi => {
                        const remainingAmount = (emi.totalTenure - emi.paidInstallments) * emi.amount;
                        let [sY, sM, sD] = emi.startDate.split('-').map(Number);
                        if (sY < 100) sY += 2000;

                        const nextDueDate = new Date(sY, sM - 1 + emi.paidInstallments, sD);
                        // Tenure end calculation fix applied here for display consistency too
                        const endDate = new Date(sY, sM - 1 + emi.totalTenure - 1, sD);
                        const dueDateStr = `${nextDueDate.getFullYear()}-${String(nextDueDate.getMonth()+1).padStart(2,'0')}-${String(nextDueDate.getDate()).padStart(2,'0')}`;
                        const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth()+1).padStart(2,'0')}-${String(endDate.getDate()).padStart(2,'0')}`;

                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const isBeforeToday = nextDueDate.getTime() < today.getTime();
                        
                        const monthsDiff = (nextDueDate.getFullYear() - today.getFullYear()) * 12 + nextDueDate.getMonth() - today.getMonth();
                        const isPayAllowed = isBeforeToday || monthsDiff <= 1;

                        return (
                        <div key={emi.id} className="bg-slate-800/50 p-4 rounded-lg">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold text-xl text-white">₹ {emi.amount.toLocaleString()}</p>
                                    <p className="text-sm text-slate-300">Next Due: {formatDate(dueDateStr)}</p>
                                    <p className="text-xs text-slate-400">Ends on: {formatDate(endDateStr)}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs bg-cyan-900/50 text-cyan-300 px-2 py-1 rounded-full">{emi.paidInstallments} / {emi.totalTenure} paid</span>
                                    <p className="text-sm font-semibold text-amber-400 mt-1">₹{remainingAmount.toLocaleString()} left</p>
                                </div>
                            </div>
                            
                             <div className="mt-4 pt-3 border-t border-slate-700/50 text-sm text-slate-400 flex flex-col items-start gap-1">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                    {emi.totalVehicleCost && <div><span className="font-semibold">{[VehicleType.PersonalLoan, VehicleType.BusinessLoan, VehicleType.Overdraft, VehicleType.HomeLoan].includes(vehicle.type as VehicleType) ? 'Principal Amount:' : 'Total Amount:'}</span> ₹{emi.totalVehicleCost.toLocaleString()}</div>}
                                    {emi.downPayment && <div><span className="font-semibold">Down Payment:</span> ₹{emi.downPayment.toLocaleString()}</div>}
                                    {emi.interestRate && <div><span className="font-semibold">Interest:</span> {emi.interestRate}%</div>}
                                    {emi.loanProvider && <div><span className="font-semibold">Provider:</span> {emi.loanProvider}</div>}
                                    {emi.emiBank && <div><span className="font-semibold">Bank:</span> {emi.emiBank}</div>}
                                    {emi.loanId && <div><span className="font-semibold">Loan ID:</span> {emi.loanId}</div>}
                                    {emi.extraCharges && <div className="text-red-400"><span className="font-semibold">Bounce Charges:</span> +₹{emi.extraCharges.toLocaleString()}</div>}
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => onMarkEmiPaid(emi.id)} 
                                        className="bg-green-600 hover:bg-green-700 py-2 px-3 rounded text-white font-bold text-sm disabled:bg-slate-600 disabled:cursor-not-allowed"
                                        disabled={!isPayAllowed}
                                    >
                                        Mark as Paid
                                    </button>
                                    <button 
                                        onClick={() => onOpenSettleModal(emi)} 
                                        className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 py-2 px-3 rounded text-white font-bold text-sm"
                                        title="Settle Loan"
                                    >
                                        <CheckCircleIcon className="w-4 h-4"/>
                                        <span>Settle</span>
                                    </button>
                                </div>
                                <button 
                                    onClick={() => onEditEmiClick(emi)}
                                    className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-700/50 hover:bg-slate-700 transition-colors"
                                    title="Edit EMI"
                                >
                                    <EditIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )})}
                    {activeEmis.length === 0 && vehicle.emis.length > 0 && <p className="text-slate-500 text-center py-4">All loans are fully paid.</p>}
                    {vehicle.emis.length === 0 && <p className="text-slate-500 text-center py-4">No EMIs added.</p>}
                </div>
            </div>

            {/* Documents Section */}
            <div className="mb-8">
                 <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xl font-bold text-purple-400">Active Documents</h2>
                    <button onClick={handleAddDocClick} className="bg-purple-600 hover:bg-purple-700 p-2 rounded-full text-white">
                        <PlusIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="space-y-3">
                    {vehicle.documents.map(doc => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const expiry = new Date(doc.expiryDate);
                        const isExpired = expiry.getTime() < today.getTime();
                        const timeDiff = expiry.getTime() - today.getTime();
                        const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
                        const isExpiringSoon = !isExpired && daysUntilExpiry <= 5;

                        let docStatusStyle = '';
                        let docNameStyle = '';
                        if (isExpired) {
                            docStatusStyle = 'border border-red-500/50';
                            docNameStyle = 'text-red-400';
                        } else if (isExpiringSoon) {
                            docStatusStyle = 'border border-amber-500/50';
                            docNameStyle = 'text-amber-400';
                        }
                        
                        return (
                            <div key={doc.id} className={`bg-slate-800/50 p-3 rounded-lg flex justify-between items-center ${docStatusStyle}`}>
                                <div>
                                   <p className={`font-semibold ${docNameStyle}`}>{doc.name}</p>
                                    <p className="text-sm text-slate-300">
                                        Valid: {formatDate(doc.validFrom)} to {formatDate(doc.expiryDate)}
                                    </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {(isExpired || isExpiringSoon) && <button onClick={() => handleRenewClick(doc)} className="text-sm bg-amber-600 hover:bg-amber-700 text-white font-semibold py-1 px-3 rounded-full">Renew</button>}
                                    {doc.fileData && (
                                        <>
                                            <button onClick={() => setPreviewDoc(doc)} className="text-indigo-400 hover:text-indigo-300 p-2" title="Preview">
                                                <EyeIcon className="w-5 h-5" />
                                            </button>
                                            <a href={doc.fileData} download={doc.fileName} className="text-emerald-400 hover:text-emerald-300 p-2" title="Download">
                                                <DownloadIcon className="w-5 h-5" />
                                            </a>
                                        </>
                                    )}
                                     <button onClick={() => handleEditClick(doc)} className="text-slate-400 hover:text-white p-2" title="Edit">
                                        <EditIcon className="w-5 h-5" />
                                    </button>
                                     <button onClick={() => onDeleteDoc(doc)} className="text-slate-400 hover:text-red-400 p-2" title="Delete">
                                        <DeleteIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {vehicle.documents.length === 0 && <p className="text-slate-500 text-center py-4">No documents added.</p>}
                </div>
            </div>
            
             {/* Completed Loans Section */}
             {completedEmis.length > 0 && (
                <div className="mb-8">
                    <details className="bg-slate-800/30 rounded-lg">
                        <summary className="text-lg font-bold text-slate-400 p-4 cursor-pointer">Completed Loans ({completedEmis.length})</summary>
                        <div className="p-4 border-t border-slate-700 space-y-4">
                            {completedEmis.map(emi => (
                                <div key={emi.id} className="bg-slate-800/50 p-4 rounded-lg">
                                    <div className="font-semibold text-green-400 mb-2">
                                        {emi.settlementDetails
                                            ? `Settled for ₹${emi.settlementDetails.amount.toLocaleString()} on ${formatDate(emi.settlementDetails.date)}`
                                            : `Loan of ₹${(emi.amount * emi.totalTenure).toLocaleString()} paid off.`}
                                    </div>
                                    <details>
                                        <summary className="text-sm text-indigo-400 cursor-pointer">View Payment History</summary>
                                        <div className="mt-2 pt-2 border-t border-slate-700/50 text-xs text-slate-400 space-y-1">
                                            {(emi.paymentHistory || []).map((p, index) => (
                                                <div key={index} className="grid grid-cols-3 gap-2">
                                                    <span>Due: {formatDate(p.dueDate)}</span>
                                                    <span>Paid: {formatDate(p.paidDate)}</span>
                                                    <span className={p.status === 'late' ? 'text-red-400' : 'text-green-400'}>
                                                        Status: {p.status} {p.bounceCharges ? `(+₹${p.bounceCharges})` : ''}
                                                    </span>
                                                </div>
                                            ))}
                                            {(!emi.paymentHistory || emi.paymentHistory.length === 0) && <p>No payment history available.</p>}
                                        </div>
                                    </details>
                                </div>
                            ))}
                        </div>
                    </details>
                </div>
            )}
            
            <AddDocModal 
                isOpen={isDocModalOpen || !!docToEdit} 
                onClose={handleDocModalClose} 
                onSave={handleDocSave} 
                initialData={docToEdit ?? docToReplace}
                isRenewing={!!docToReplace && !docToEdit}
                activeDocuments={vehicle.documents}
                vehicleType={vehicle.type}
            />

            {previewDoc && (
                <Modal isOpen={!!previewDoc} onClose={() => setPreviewDoc(null)} title={previewDoc.name}>
                    <div className="flex justify-center bg-slate-900 rounded-lg overflow-hidden relative">
                         {/* Enhanced Preview Logic */}
                        {(previewDoc.fileData?.includes('pdf') || previewDoc.fileName?.toLowerCase().endsWith('.pdf')) ? (
                            <iframe 
                                src={previewDoc.fileData} 
                                className="w-[85vw] h-[75vh] md:w-[600px] md:h-[600px] border-0 bg-white" 
                                title="PDF Preview"
                            ></iframe>
                        ) : (
                            <img 
                                src={previewDoc.fileData} 
                                alt={previewDoc.name} 
                                className="max-w-full max-h-[80vh] object-contain" 
                            />
                        )}
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                         <a href={previewDoc.fileData} download={previewDoc.fileName} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded flex items-center gap-2">
                             <DownloadIcon className="w-4 h-4" /> Download
                         </a>
                        <button onClick={() => setPreviewDoc(null)} className="bg-slate-600 hover:bg-slate-700 px-4 py-2 rounded text-white font-bold">Close</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

const ManualInstallModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="How to Install">
        <div className="space-y-4 text-slate-300">
            <p>To get the best experience, install this app on your device.</p>
            <div className="bg-slate-700 p-4 rounded-lg">
                <h3 className="font-bold text-white mb-2">Android & Desktop Chrome/Edge</h3>
                <ol className="list-decimal list-inside space-y-2">
                    <li>Find the <span className="font-semibold">"Install"</span> icon in the address bar, OR</li>
                    <li>Tap the menu button (<span className="font-mono font-bold text-lg">⋮</span>) and select <span className="font-semibold">"Install app"</span> or <span className="font-semibold">"Add to Home screen"</span>.</li>
                </ol>
            </div>
             <p className="text-sm text-center text-slate-400">For iOS, use the Share button in Safari to "Add to Home Screen".</p>
            <button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-700 p-2 rounded text-white font-bold mt-4">Got It</button>
        </div>
    </Modal>
);

const OverduePaymentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (paidDate: string, bounceCharges: number) => void;
}> = ({ isOpen, onClose, onSubmit }) => {
    const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);
    const [bounceCharges, setBounceCharges] = useState('');

    const handleSubmit = () => {
        if (!paidDate) return;
        onSubmit(paidDate, parseFloat(bounceCharges) || 0);
    };
    
    useEffect(() => {
        if (!isOpen) {
            setPaidDate(new Date().toISOString().split('T')[0]);
            setBounceCharges('');
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Log Overdue Payment">
            <div className="space-y-4">
                <div>
                    <label className="text-sm text-slate-400 mb-1 block">Payment Date</label>
                    <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" max={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                     <label className="text-sm text-slate-400 mb-1 block">Bounce/Late Charges (Optional)</label>
                     <input type="number" placeholder="Enter amount if any" value={bounceCharges} onChange={e => setBounceCharges(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                </div>
                <button onClick={handleSubmit} className="w-full bg-green-600 hover:bg-green-700 p-2 rounded text-white font-bold mt-4">Confirm Payment</button>
            </div>
        </Modal>
    );
};

const AuthScreen: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [otp, setOtp] = useState('');
    const [showForgotPassword, setShowForgotPassword] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supabase) return;
        setLoading(true);
        setMessage(null);

        try {
            if (showForgotPassword) {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.href, // Redirect back to app
                });
                if (error) throw error;
                setMessage({ type: 'success', text: 'Password reset link sent to your email.' });
                setLoading(false);
                return;
            }

            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) {
                    if (error.message.includes("Email not confirmed")) {
                        // Attempt to resend logic or guide user
                        throw new Error("Please verify your email address before logging in.");
                    }
                    throw error;
                }
            } else {
                const { error, data } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                
                // Check if session is already established (Direct Login enabled)
                if (data.session) {
                    // Logged in immediately!
                    setMessage({ type: 'success', text: 'Account created and logged in!' });
                } else if (data.user && data.user.identities && data.user.identities.length === 0) {
                     setMessage({ type: 'error', text: 'This email is already registered. Please log in.' });
                } else {
                    // User created but needs verification.
                    // IMPORTANT: You asked to switch to OTP or disable verification.
                    // If Supabase sends a link by default, we can't force OTP unless configured.
                    // However, we can TRY to show OTP input if you configured SMTP. 
                    // Since we can't know config, we'll assume Direct Login failed and ask for OTP/Link.
                    setMessage({ type: 'success', text: 'Registration successful! If you received a code, enter it below.' });
                    setShowOtpInput(true);
                }
            }
        } catch (error: any) {
            let msg = error.message;
            if (msg.includes("rate limit") || msg.includes("security purposes")) {
                msg = "Please wait a few seconds before trying again.";
            }
            if (msg.includes("User already registered")) {
                msg = "This email is already registered. Please log in.";
            }
            setMessage({ type: 'error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    const handleOtpVerification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supabase) return;
        setLoading(true);
        try {
             const { error } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: 'signup'
            });
            if (error) throw error;
             setMessage({ type: 'success', text: 'Verified successfully!' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
             setLoading(false);
        }
    };

    const toggleMode = () => {
        setIsLogin(!isLogin);
        setMessage(null);
        setShowOtpInput(false);
        setShowForgotPassword(false);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
             <div className="bg-slate-800 p-8 rounded-lg shadow-xl w-full max-w-md border border-slate-700">
                <h1 className="text-3xl font-bold text-center text-indigo-400 mb-2">Due Guardian</h1>
                <p className="text-center text-slate-400 mb-8">{showForgotPassword ? 'Reset Password' : (showOtpInput ? 'Enter Code' : (isLogin ? 'Welcome Back' : 'Create Account'))}</p>
                
                {message && (
                    <div className={`p-3 rounded mb-4 text-sm ${message.type === 'error' ? 'bg-red-900/50 text-red-200 border border-red-500' : 'bg-green-900/50 text-green-200 border border-green-500'}`}>
                        {message.text}
                    </div>
                )}

                {showOtpInput ? (
                    <form onSubmit={handleOtpVerification} className="space-y-4">
                         <input 
                            type="text" 
                            placeholder="Enter 6-digit Code" 
                            value={otp} 
                            onChange={e => setOtp(e.target.value)} 
                            className="w-full p-3 bg-slate-700 border border-slate-600 rounded text-white" 
                            required 
                        />
                         <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 p-3 rounded text-white font-bold transition-colors">
                            {loading ? 'Verifying...' : 'Verify & Login'}
                        </button>
                        <button type="button" onClick={() => setShowOtpInput(false)} className="w-full text-sm text-slate-400 hover:text-white mt-2">Back</button>
                    </form>
                ) : (
                    <form onSubmit={handleAuth} className="space-y-4">
                        <input 
                            type="email" 
                            placeholder="Email Address" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            className="w-full p-3 bg-slate-700 border border-slate-600 rounded text-white" 
                            required 
                        />
                         {!showForgotPassword && (
                             <input 
                                type="password" 
                                placeholder="Password" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                className="w-full p-3 bg-slate-700 border border-slate-600 rounded text-white" 
                                required 
                            />
                         )}
                        
                        <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 p-3 rounded text-white font-bold transition-colors">
                            {loading ? 'Processing...' : (showForgotPassword ? 'Send Reset Link' : (isLogin ? 'Login' : 'Sign Up'))}
                        </button>
                    </form>
                )}

                {!showOtpInput && (
                    <div className="mt-6 text-center text-sm space-y-2">
                        {showForgotPassword ? (
                            <button onClick={() => setShowForgotPassword(false)} className="text-indigo-400 hover:text-indigo-300">Back to Login</button>
                        ) : (
                            <>
                                <p className="text-slate-400">
                                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                                    <button onClick={toggleMode} className="text-indigo-400 hover:text-indigo-300 font-bold">
                                        {isLogin ? 'Sign Up' : 'Login'}
                                    </button>
                                </p>
                                {isLogin && <button onClick={() => setShowForgotPassword(true)} className="text-slate-500 hover:text-slate-300 text-xs">Forgot Password?</button>}
                            </>
                        )}
                    </div>
                )}
             </div>
             
             {!isLogin && !showOtpInput && (
                 <div className="mt-8 text-center max-w-xs text-xs text-slate-500">
                     <p className="font-semibold text-slate-400 mb-1">Developer Note:</p>
                     <p>If "Confirm Email" is enabled in Supabase, you must verify your email before logging in. Disable it in Supabase Auth settings for instant access.</p>
                 </div>
             )}
        </div>
    );
}

const App: React.FC = () => {
  // Use LocalStorage as a fallback or cache, but Supabase is primary
  const [vehicles, setVehicles] = useLocalStorage<Vehicle[]>('vehicles', []);
  const [snoozed, setSnoozed] = useLocalStorage<Record<string, number>>('snoozed', {});
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('dashboard');
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  
  // Modals
  const [isVehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vehicleModalMode, setVehicleModalMode] = useState<'asset' | 'loan'>('asset');
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteVehicleId, setDeleteVehicleId] = useState<string | null>(null);
  const [isInstallModalOpen, setInstallModalOpen] = useState(false);
  const [editingEmi, setEditingEmi] = useState<{emi: Emi | null, vehicleType: string} | null>(null);
  const [isOverdueModalOpen, setOverdueModalOpen] = useState(false);
  const [overdueEmiTarget, setOverdueEmiTarget] = useState<{emiId: string, vehicleId: string} | null>(null);
  const [resetPasswordMode, setResetPasswordMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // --- Auth & Data Sync ---
  useEffect(() => {
    if (!supabase) {
        setLoading(false);
        return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) fetchData(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
          fetchData(session.user.id);
      }
      if (_event === 'PASSWORD_RECOVERY') {
          setResetPasswordMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async (userId: string) => {
      if (!supabase) return;
      // Fetch user data
      const { data, error } = await supabase
        .from('user_data')
        .select('vehicles, snoozed')
        .eq('user_id', userId)
        .single();
    
      if (data) {
          if (data.vehicles) setVehicles(data.vehicles);
          if (data.snoozed) setSnoozed(data.snoozed);
      }
  };

  const saveData = async (newVehicles: Vehicle[], newSnoozed: Record<string, number>) => {
      if (!supabase || !session) return;
      
      // Update local state first for instant UI
      setVehicles(newVehicles);
      setSnoozed(newSnoozed);

      // Background sync
      const { error } = await supabase
        .from('user_data')
        .upsert({ 
            user_id: session.user.id, 
            vehicles: newVehicles, 
            snoozed: newSnoozed,
            updated_at: new Date().toISOString()
        });
      
      if (error) console.error("Sync Error", error);
  };

  // --- Actions ---

  const handleAddVehicle = (data: Omit<Vehicle, 'id' | 'documents' | 'emis' | 'archivedDocuments'>) => {
      const newVehicle: Vehicle = {
          ...data,
          id: crypto.randomUUID(),
          documents: [],
          emis: [],
          archivedDocuments: []
      };
      
      if (editingVehicle) {
          const updated = vehicles.map(v => v.id === editingVehicle.id ? { ...v, ...data } : v);
          saveData(updated, snoozed);
      } else {
          saveData([...vehicles, newVehicle], snoozed);
      }
      setEditingVehicle(null);
  };

  const handleDeleteVehicle = (reason: string) => {
      if (!deleteVehicleId) return;
      const updated = vehicles.filter(v => v.id !== deleteVehicleId);
      // Ideally log the deletion reason somewhere, for now just delete
      saveData(updated, snoozed);
      setDeleteModalOpen(false);
      if (activeVehicleId === deleteVehicleId) {
          setView('vehicleList');
          setActiveVehicleId(null);
      }
  };

  const handleAddEmi = (emiData: Omit<Emi, 'id'>, existingId?: string) => {
      if (!activeVehicleId) return;
      const updatedVehicles = vehicles.map(v => {
          if (v.id !== activeVehicleId) return v;
          let newEmis = [...v.emis];
          if (existingId) {
              newEmis = newEmis.map(e => e.id === existingId ? { ...e, ...emiData } : e);
          } else {
              newEmis.push({ ...emiData, id: crypto.randomUUID(), paidInstallments: emiData.paidInstallments || 0 });
          }
          return { ...v, emis: newEmis };
      });
      saveData(updatedVehicles, snoozed);
  };

  const handleMarkEmiPaid = (emi: Emi, vehicleId: string, category: 'overdue' | 'today') => {
      if (category === 'overdue') {
          // Open modal to capture actual payment date for overdue items
          setOverdueEmiTarget({ emiId: emi.id, vehicleId });
          setOverdueModalOpen(true);
      } else {
          // For Today/Future, assume paid today
          confirmEmiPayment(vehicleId, emi.id, new Date().toISOString().split('T')[0], 0);
      }
  };

  const confirmEmiPayment = (vehicleId: string, emiId: string, paidDate: string, bounceCharges: number) => {
        const updatedVehicles = vehicles.map(v => {
          if (v.id !== vehicleId) return v;
          const newEmis = v.emis.map(e => {
              if (e.id !== emiId) return e;
              
              const history = e.paymentHistory || [];
              
              // Determine due date for this installment
              let [sY, sM, sD] = e.startDate.split('-').map(Number);
              if (sY < 100) sY += 2000;
              const dueDateObj = new Date(sY, sM - 1 + e.paidInstallments, sD);
              const dueDateStr = `${dueDateObj.getFullYear()}-${String(dueDateObj.getMonth()+1).padStart(2,'0')}-${String(dueDateObj.getDate()).padStart(2,'0')}`;
              
              const isLate = new Date(paidDate) > new Date(dueDateStr);
              
              const newPayment: EmiPayment = {
                  dueDate: dueDateStr,
                  paidDate: paidDate,
                  status: isLate ? 'late' : 'on-time',
                  amount: e.amount,
                  bounceCharges: bounceCharges > 0 ? bounceCharges : undefined
              };

              // Clear Alarm config if it was ringing
              const newAlarmConfig = e.alarmConfig ? { ...e.alarmConfig, hasRung: false, isDismissed: false } : undefined;

              return { 
                  ...e, 
                  paidInstallments: e.paidInstallments + 1,
                  extraCharges: (e.extraCharges || 0) + bounceCharges,
                  paymentHistory: [...history, newPayment],
                  alarmConfig: newAlarmConfig
              };
          });
          return { ...v, emis: newEmis };
      });
      saveData(updatedVehicles, snoozed);
      setOverdueModalOpen(false);
      setOverdueEmiTarget(null);
  };

  const handleAddDoc = (docData: Omit<Document, 'id'>, replacingDocId?: string) => {
      if (!activeVehicleId) return;
      const updatedVehicles = vehicles.map(v => {
          if (v.id !== activeVehicleId) return v;
          let newDocs = [...v.documents];
          let archived = [...v.archivedDocuments];

          if (replacingDocId) {
              const oldDoc = newDocs.find(d => d.id === replacingDocId);
              if (oldDoc) {
                  archived.push(oldDoc);
                  newDocs = newDocs.filter(d => d.id !== replacingDocId);
              }
          }
          newDocs.push({ ...docData, id: crypto.randomUUID() });
          return { ...v, documents: newDocs, archivedDocuments: archived };
      });
      saveData(updatedVehicles, snoozed);
  };

  const handleUpdateDoc = (docId: string, docData: Omit<Document, 'id'>) => {
      if (!activeVehicleId) return;
      const updatedVehicles = vehicles.map(v => {
          if (v.id !== activeVehicleId) return v;
          const newDocs = v.documents.map(d => d.id === docId ? { ...d, ...docData } : d);
          return { ...v, documents: newDocs };
      });
      saveData(updatedVehicles, snoozed);
  };

  const handleDeleteDoc = (doc: Document) => {
      if (!activeVehicleId || !window.confirm(`Delete ${doc.name}?`)) return;
      const updatedVehicles = vehicles.map(v => {
          if (v.id !== activeVehicleId) return v;
          return { ...v, documents: v.documents.filter(d => d.id !== doc.id) };
      });
      saveData(updatedVehicles, snoozed);
  };

  const handleSnooze = (itemId: string, minutes: number = 24 * 60) => { // Default 1 day
      const snoozeUntil = Date.now() + minutes * 60 * 1000;
      const newSnoozed = { ...snoozed, [itemId]: snoozeUntil };
      saveData(vehicles, newSnoozed);
  };

  const handleSnoozeAlarm = (emiId: string, vehicleId: string) => {
      const updatedVehicles = vehicles.map(v => {
          if (v.id !== vehicleId) return v;
          return {
              ...v,
              emis: v.emis.map(e => {
                  if (e.id !== emiId) return e;
                  const config = e.alarmConfig || {
                       date: new Date().toISOString().split('T')[0],
                       nextTrigger: new Date().toISOString(),
                       snoozeCount: 0,
                       hasRung: false,
                       isDismissed: false,
                       history: []
                  };
                  // Snooze for 10 minutes
                  const nextTime = new Date();
                  nextTime.setMinutes(nextTime.getMinutes() + 10);
                  
                  return {
                      ...e,
                      alarmConfig: {
                          ...config,
                          nextTrigger: nextTime.toISOString(),
                          snoozeCount: config.snoozeCount + 1,
                          hasRung: false,
                          history: [...config.history, { timestamp: new Date().toISOString(), action: 'snooze' as const }]
                      }
                  };
              })
          };
      });
      saveData(updatedVehicles, snoozed);
  };

  const handleSetManualAlarm = (emiId: string, vehicleId: string, time: string) => {
      const updatedVehicles = vehicles.map(v => {
          if (v.id !== vehicleId) return v;
          return {
              ...v,
              emis: v.emis.map(e => {
                  if (e.id !== emiId) return e;
                   const [hours, minutes] = time.split(':').map(Number);
                   const nextTrigger = new Date();
                   nextTrigger.setHours(hours, minutes, 0, 0);
                   
                   // If time is past, set for tomorrow? No, user usually means today if they set it manually. 
                   // But if it's strictly overdue, maybe. Let's assume today.
                   
                   const config = e.alarmConfig || {
                       date: new Date().toISOString().split('T')[0],
                       nextTrigger: new Date().toISOString(),
                       snoozeCount: 0,
                       hasRung: false,
                       isDismissed: false,
                       history: []
                  };

                  return {
                      ...e,
                      alarmConfig: {
                          ...config,
                          manualTime: time,
                          nextTrigger: nextTrigger.toISOString(),
                          hasRung: false,
                          isDismissed: false,
                          history: [...config.history, { timestamp: new Date().toISOString(), action: 'manual_set' as const, details: time }]
                      }
                  };
              })
          };
      });
      saveData(updatedVehicles, snoozed);
  };

  const handleDismissAlarm = (emiId: string, vehicleId: string) => {
      const updatedVehicles = vehicles.map(v => {
          if (v.id !== vehicleId) return v;
          return {
              ...v,
              emis: v.emis.map(e => {
                  if (e.id !== emiId) return e;
                  if (!e.alarmConfig) return e;
                  return {
                      ...e,
                      alarmConfig: {
                          ...e.alarmConfig,
                          isDismissed: true,
                          hasRung: false,
                          history: [...e.alarmConfig.history, { timestamp: new Date().toISOString(), action: 'dismiss' as const }]
                      }
                  };
              })
          };
      });
      saveData(updatedVehicles, snoozed);
  };
  
  const handleSettleLoan = (emi: Emi) => {
      if (!activeVehicleId || !window.confirm("Are you sure you want to settle this loan? This will mark all remaining EMIs as paid.")) return;
      
      const settleDate = new Date().toISOString().split('T')[0];
      // Amount remaining
      const remaining = (emi.totalTenure - emi.paidInstallments) * emi.amount;
      
      const updatedVehicles = vehicles.map(v => {
          if (v.id !== activeVehicleId) return v;
          return {
              ...v,
              emis: v.emis.map(e => {
                  if (e.id !== emi.id) return e;
                  return {
                      ...e,
                      paidInstallments: e.totalTenure, // Mark full
                      settlementDetails: {
                          amount: remaining,
                          date: settleDate
                      }
                  };
              })
          };
      });
      saveData(updatedVehicles, snoozed);
  };

  const handleUpdatePassword = async () => {
      if (!supabase) return;
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
          alert("Error updating password: " + error.message);
      } else {
          alert("Password updated successfully!");
          setResetPasswordMode(false);
          setNewPassword('');
      }
  };


  const activeVehicle = vehicles.find(v => v.id === activeVehicleId);

  const getUsername = () => {
      if (!session || !session.user || !session.user.email) return 'User';
      return session.user.email.split('@')[0];
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;

  if (!session) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-slate-900 pb-20 md:pb-0">
        <header className="bg-slate-800 p-4 sticky top-0 z-20 border-b border-slate-700 flex justify-between items-center shadow-lg">
            <div className="flex items-center space-x-2" onClick={() => { setView('dashboard'); setActiveVehicleId(null); }}>
                <div className="bg-indigo-600 p-2 rounded-lg">
                    <DashboardIcon className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">Due Guardian</h1>
            </div>
            <div className="flex items-center space-x-3">
                 <button onClick={() => setInstallModalOpen(true)} className="text-slate-400 hover:text-white" title="Install App">
                    <DownloadIcon className="w-5 h-5" />
                </button>
                 <span className="text-xs font-mono text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded hidden sm:inline-block">
                    {getUsername()}
                </span>
                <button 
                    onClick={() => supabase?.auth.signOut()}
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full transition-colors text-slate-300 hover:text-white"
                    title="Sign Out"
                >
                    <LogoutIcon className="w-5 h-5" />
                </button>
            </div>
        </header>

        <main className="max-w-7xl mx-auto">
            {resetPasswordMode && (
                <div className="p-4 m-4 bg-slate-800 border border-indigo-500 rounded-lg">
                    <h3 className="text-lg font-bold text-white mb-2">Set New Password</h3>
                    <div className="flex gap-2">
                        <input 
                            type="password" 
                            placeholder="New Password" 
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="flex-1 p-2 bg-slate-700 rounded text-white"
                        />
                        <button onClick={handleUpdatePassword} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold">Update</button>
                        <button onClick={() => setResetPasswordMode(false)} className="bg-slate-600 text-white px-4 py-2 rounded">Cancel</button>
                    </div>
                </div>
            )}

            {view === 'dashboard' && (
                <Dashboard 
                    vehicles={vehicles} 
                    onViewVehicle={(id) => { setActiveVehicleId(id); setView('vehicleDetail'); }} 
                    snoozed={snoozed}
                    onSnoozeItem={handleSnooze}
                    onMarkEmiPaid={(emi, vid, cat) => handleMarkEmiPaid(emi, vid, cat)}
                    onSnoozeAlarm={handleSnoozeAlarm}
                    onSetManualAlarm={handleSetManualAlarm}
                    onDismissAlarm={handleDismissAlarm}
                />
            )}
            
            {view === 'vehicleList' && (
                <VehicleList 
                    vehicles={vehicles} 
                    onSelectVehicle={(id) => { setActiveVehicleId(id); setView('vehicleDetail'); }} 
                    onAddAssetClick={() => { setVehicleModalMode('asset'); setEditingVehicle(null); setVehicleModalOpen(true); }}
                    onAddLoanClick={() => { setVehicleModalMode('loan'); setEditingVehicle(null); setVehicleModalOpen(true); }}
                />
            )}

            {view === 'vehicleDetail' && activeVehicle && (
                <VehicleDetail 
                    vehicle={activeVehicle} 
                    onBack={() => { setView('vehicleList'); setActiveVehicleId(null); }}
                    onAddDoc={handleAddDoc}
                    onUpdateDoc={handleUpdateDoc}
                    onDeleteDoc={handleDeleteDoc}
                    onMarkEmiPaid={(emiId) => {
                        const emi = activeVehicle.emis.find(e => e.id === emiId);
                        if (emi) handleMarkEmiPaid(emi, activeVehicle.id, 'today');
                    }}
                    onOpenSettleModal={handleSettleLoan}
                    onEditEmiClick={(emi) => {
                        setEditingEmi({ emi, vehicleType: activeVehicle.type });
                    }}
                    onEditVehicle={() => {
                        setEditingVehicle(activeVehicle);
                        setVehicleModalMode([VehicleType.PersonalLoan, VehicleType.BusinessLoan, VehicleType.HomeLoan, VehicleType.Overdraft].includes(activeVehicle.type as any) ? 'loan' : 'asset');
                        setVehicleModalOpen(true);
                    }}
                    onDeleteVehicle={() => {
                        setDeleteVehicleId(activeVehicle.id);
                        setDeleteModalOpen(true);
                    }}
                />
            )}

            {view === 'reports' && <Reports vehicles={vehicles} />}
        </main>
        
        {/* Mobile Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around p-3 pb-safe z-20 shadow-[0_-5px_10px_rgba(0,0,0,0.3)]">
            <button 
                onClick={() => { setView('dashboard'); setActiveVehicleId(null); }} 
                className={`flex flex-col items-center ${view === 'dashboard' ? 'text-indigo-400' : 'text-slate-500'}`}
            >
                <DashboardIcon className="w-6 h-6" />
                <span className="text-[10px] mt-1 font-medium">Dashboard</span>
            </button>
            <button 
                onClick={() => { setView('vehicleList'); setActiveVehicleId(null); }} 
                className={`flex flex-col items-center ${['vehicleList', 'vehicleDetail'].includes(view) ? 'text-indigo-400' : 'text-slate-500'}`}
            >
                <VehicleIcon className="w-6 h-6" />
                <span className="text-[10px] mt-1 font-medium">Items</span>
            </button>
             <button 
                onClick={() => { setView('reports'); setActiveVehicleId(null); }} 
                className={`flex flex-col items-center ${view === 'reports' ? 'text-indigo-400' : 'text-slate-500'}`}
            >
                <SettingsIcon className="w-6 h-6" />
                <span className="text-[10px] mt-1 font-medium">Reports</span>
            </button>
        </nav>

        {/* Modals */}
        <VehicleFormModal 
            isOpen={isVehicleModalOpen} 
            onClose={() => setVehicleModalOpen(false)} 
            onSave={handleAddVehicle} 
            mode={vehicleModalMode}
            initialData={editingVehicle}
        />

        <DeleteVehicleModal
            isOpen={isDeleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            onConfirm={handleDeleteVehicle}
            vehicleName={deleteVehicleId ? vehicles.find(v => v.id === deleteVehicleId)?.make + ' ' + vehicles.find(v => v.id === deleteVehicleId)?.model : 'Item'}
        />

        {editingEmi && (
            <EmiFormModal 
                isOpen={!!editingEmi} 
                onClose={() => setEditingEmi(null)} 
                onSubmit={handleAddEmi}
                initialData={editingEmi.emi}
                vehicleType={editingEmi.vehicleType}
            />
        )}
        
        <OverduePaymentModal 
            isOpen={isOverdueModalOpen}
            onClose={() => setOverdueModalOpen(false)}
            onSubmit={(date, charges) => overdueEmiTarget && confirmEmiPayment(overdueEmiTarget.vehicleId, overdueEmiTarget.emiId, date, charges)}
        />

        <ManualInstallModal isOpen={isInstallModalOpen} onClose={() => setInstallModalOpen(false)} />
        <AddToHomeScreenPrompt />
    </div>
  );
};

export default App;