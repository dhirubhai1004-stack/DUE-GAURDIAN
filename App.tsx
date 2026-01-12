
import React, { useState, useEffect, useRef } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { Vehicle, VehicleType, Emi, Document, PREDEFINED_DOC_NAMES, MACHINE_TYPES } from './types';
import Dashboard from './components/Dashboard';
import Modal from './components/Modal';
import Reports from './components/Reports';
import { PlusIcon, ArrowLeftIcon, CarIcon, TruckIcon, MachineIcon, BikeIcon, DashboardIcon, VehicleIcon, EditIcon, DeleteIcon, CheckCircleIcon, OtherVehicleIcon, PersonalLoanIcon, BusinessLoanIcon, HomeLoanIcon, LogoutIcon, SettingsIcon, EyeIcon, BellIcon, SearchIcon, DocumentIcon, EmiIcon } from './components/icons';
import AddToHomeScreenPrompt from './components/AddToHomeScreenPrompt';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// --- DEVELOPER CONFIGURATION ---
const SUPABASE_URL = "https://wpvcibnicferikuovnlt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwdmNpYm5pY2ZlcmlrdW92bmx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMDA1NDcsImV4cCI6MjA4MDY3NjU0N30.F6ySW6GoJAUTfG9eQW8xWxNTjfO4m5x1QBs-KA1v3uk";

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

const getVehicleIcon = (type: string) => {
    if (MACHINE_TYPES.includes(type as any)) return <MachineIcon className="w-8 h-8 text-yellow-400" />;
    return vehicleTypeIcons[type] || <OtherVehicleIcon className="w-8 h-8 text-gray-400" />;
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  const [y, m, d] = parts;
  return `${d}/${m}/${y.slice(-2)}`;
};

const getVehicleDisplayName = (vehicle: Vehicle) => {
    const loanTypes = [VehicleType.PersonalLoan, VehicleType.HomeLoan, VehicleType.BusinessLoan, VehicleType.Overdraft] as string[];
    if (loanTypes.includes(vehicle.type)) return `${vehicle.make} ${vehicle.model}`;
    if (vehicle.type === VehicleType.Truck) return `${vehicle.make} ${vehicle.model}`;
    return `${vehicle.type} - ${vehicle.make} ${vehicle.model}`;
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
        };
        reader.onerror = error => reject(error);
    });
};

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_DIM = 1200; 
                let width = img.width;
                let height = img.height;
                if (width > height) { if (width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; } } else { if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve((event.target?.result as string).split(',')[1]); return; }
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                resolve(dataUrl.split(',')[1]);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

type View = 'dashboard' | 'vehicleList' | 'vehicleDetail' | 'reports';

// --- Components ---

const ReviewScanModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    data: any;
    onConfirm: (finalData: any) => void;
}> = ({ isOpen, onClose, data, onConfirm }) => {
    const [edited, setEdited] = useState(data);
    useEffect(() => { if (isOpen) setEdited(data); }, [isOpen, data]);
    if (!data) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Review Scanned Details">
            <div className="space-y-4">
                <p className="text-sm text-slate-400">AI has detected these details. Please verify before adding:</p>
                <div>
                    <label className="text-xs text-indigo-400 mb-1 block">Category</label>
                    <select value={edited.category} onChange={e => setEdited({...edited, category: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white">
                        <option value="Car">Car</option><option value="Bike">Bike</option><option value="Truck">Truck</option><option value="Machine">Machine</option>
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-indigo-400 mb-1 block">Make (Company)</label>
                        <input type="text" value={edited.make} onChange={e => setEdited({...edited, make: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white" />
                    </div>
                    <div>
                        <label className="text-xs text-indigo-400 mb-1 block">Model</label>
                        <input type="text" value={edited.model} onChange={e => setEdited({...edited, model: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white" />
                    </div>
                </div>
                <div>
                    <label className="text-xs text-indigo-400 mb-1 block">Registration Number</label>
                    <input type="text" value={edited.registrationNumber} onChange={e => setEdited({...edited, registrationNumber: e.target.value.toUpperCase()})} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white font-mono" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-indigo-400 mb-1 block">Doc Type</label>
                        <select value={edited.docName} onChange={e => setEdited({...edited, docName: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white">
                            {PREDEFINED_DOC_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-indigo-400 mb-1 block">Expiry Date</label>
                        <input type="date" value={edited.expiryDate} onChange={e => setEdited({...edited, expiryDate: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white" />
                    </div>
                </div>
                <button onClick={() => onConfirm(edited)} className="w-full bg-indigo-600 hover:bg-indigo-700 p-3 rounded-lg text-white font-bold mt-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">Add Asset & Document</button>
            </div>
        </Modal>
    );
};

const VehicleFormModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    onSave: (vehicle: Omit<Vehicle, 'id' | 'documents' | 'emis' | 'archivedDocuments'>) => void; 
    mode: 'asset' | 'loan';
    initialData?: Vehicle | null;
    onScanRequest?: () => void;
}> = ({ isOpen, onClose, onSave, mode, initialData, onScanRequest }) => {
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
                setMake(initialData.make); setModel(initialData.model); setRegNum(initialData.registrationNumber);
                if (MACHINE_TYPES.includes(initialData.type as any)) { setType(initialData.type); setCustomType(''); } 
                else {
                    const isKnownType = [...assetTypes, ...loanTypes].includes(initialData.type as any);
                    if (isKnownType && initialData.type !== VehicleType.Other) { setType(initialData.type); setCustomType(''); } 
                    else { setType(VehicleType.Other); setCustomType(initialData.type); }
                }
            } else {
                setMake(''); setModel(''); setRegNum(''); setCustomType('');
                setType(mode === 'asset' ? VehicleType.Car : VehicleType.PersonalLoan);
            }
        }
    }, [isOpen, mode, initialData]);

    const availableTypes = mode === 'asset' ? assetTypes : loanTypes;
    const isLoanMode = mode === 'loan';
    const placeholderMake = isLoanMode ? "Lender / Bank Name" : "Make / Company";
    const placeholderModel = isLoanMode ? "Purpose" : "Model Name";
    const placeholderReg = isLoanMode ? "Account Number" : "Registration Number";

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
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Details" : "Add New Item"}>
            <div className="space-y-4">
                {!initialData && mode === 'asset' && (
                    <button 
                        onClick={onScanRequest}
                        className="w-full bg-indigo-600/10 border border-indigo-500/30 p-4 rounded-xl text-indigo-400 font-bold flex flex-col items-center justify-center gap-2 mb-2 hover:bg-indigo-600/20 transition-all"
                    >
                        <SearchIcon className="w-8 h-8" />
                        <div className="text-center">
                            <p className="text-sm">Scan Document (AI Auto-Add)</p>
                            <p className="text-[10px] opacity-60">Upload Insurance, RC or PUC</p>
                        </div>
                    </button>
                )}

                <div className="flex items-center gap-4 py-2">
                    <div className="h-px bg-slate-700 flex-grow"></div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Or Manual Entry</span>
                    <div className="h-px bg-slate-700 flex-grow"></div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 mb-1 block">Category</label>
                        <select value={currentCategory} onChange={e => setType(e.target.value === VehicleType.Machine ? MACHINE_TYPES[0] : e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white">
                            {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    {currentCategory === VehicleType.Machine && (
                        <select value={type} onChange={e => setType(e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white">
                            {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    )}
                    {currentCategory === VehicleType.Other && <input type="text" placeholder="Enter Custom Category" value={customType} onChange={e => setCustomType(e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white" required />}
                    <input type="text" placeholder={placeholderMake} value={make} onChange={e => setMake(e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white" required />
                    <input type="text" placeholder={placeholderModel} value={model} onChange={e => setModel(e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white" required />
                    <input type="text" placeholder={placeholderReg} value={regNum} onChange={e => setRegNum(e.target.value)} className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono" required />
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 p-3 rounded-xl text-white font-bold mt-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98]">{initialData ? "Update Details" : "Add Manually"}</button>
                </form>
            </div>
        </Modal>
    );
};

interface AuthenticatedAppProps {
    currentUser: string;
    userId: string;
    onLogout: () => void;
}

const VehicleList: React.FC<{
    vehicles: Vehicle[];
    onSelectVehicle: (id: string) => void;
    onAddAssetClick: () => void;
    onAddLoanClick: () => void;
}> = ({ vehicles, onSelectVehicle, onAddAssetClick, onAddLoanClick }) => {
    return (
        <div className="p-4 md:p-6 pb-24">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-indigo-400">My Items</h1>
                <div className="flex gap-2">
                    <button onClick={onAddAssetClick} className="bg-indigo-600 hover:bg-indigo-700 p-2.5 px-4 rounded-xl text-white flex items-center gap-2 text-xs font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"><PlusIcon className="w-4 h-4" /> Asset</button>
                    <button onClick={onAddLoanClick} className="bg-slate-700 hover:bg-slate-600 p-2.5 px-4 rounded-xl text-white flex items-center gap-2 text-xs font-bold active:scale-95 transition-all"><PlusIcon className="w-4 h-4" /> Loan</button>
                </div>
            </div>
            {vehicles.length === 0 ? (
                <div className="text-center py-20 bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-700">
                    <p className="text-slate-400">Your items list is empty.</p>
                    <button onClick={onAddAssetClick} className="text-indigo-400 font-bold mt-2 hover:underline">Add your first asset now</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {vehicles.map(v => (
                        <div key={v.id} onClick={() => onSelectVehicle(v.id)} className="bg-slate-800 p-5 rounded-2xl border border-slate-700 cursor-pointer hover:border-indigo-500 hover:bg-slate-800 transition-all flex items-center gap-5 group shadow-lg">
                            <div className="bg-slate-900 p-4 rounded-xl group-hover:bg-indigo-900/30 transition-colors shadow-inner">
                                {getVehicleIcon(v.type)}
                            </div>
                            <div className="flex-grow">
                                <h3 className="font-bold text-white text-lg leading-tight">{getVehicleDisplayName(v)}</h3>
                                <p className="text-xs text-slate-400 font-mono mt-1 tracking-wider uppercase">{v.registrationNumber}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const VehicleDetail: React.FC<{
    vehicle: Vehicle;
    onBack: () => void;
    onEditVehicle: () => void;
    onDeleteVehicle: () => void;
    onMarkEmiPaid: (id: string) => void;
}> = ({ vehicle, onBack, onEditVehicle, onDeleteVehicle, onMarkEmiPaid }) => {
    return (
        <div className="p-4 md:p-6 pb-24">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="text-slate-400 hover:text-white p-2.5 rounded-xl bg-slate-800 border border-slate-700 transition-colors active:scale-95"><ArrowLeftIcon className="w-6 h-6" /></button>
                <div className="flex-grow">
                    <h1 className="text-2xl font-black text-white">{getVehicleDisplayName(vehicle)}</h1>
                    <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">{vehicle.registrationNumber}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={onEditVehicle} className="text-slate-400 hover:text-white p-2.5 bg-slate-800 border border-slate-700 rounded-xl transition-colors active:scale-95"><EditIcon className="w-5 h-5" /></button>
                    <button onClick={() => { if(window.confirm('Confirm deletion?')) onDeleteVehicle(); }} className="text-rose-400 hover:text-rose-300 p-2.5 bg-rose-900/10 border border-rose-900/20 rounded-xl transition-colors active:scale-95"><DeleteIcon className="w-5 h-5" /></button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
                    <h2 className="text-lg font-black text-cyan-400 mb-6 flex items-center gap-2 pb-4 border-b border-slate-700/50 uppercase tracking-tighter"><EmiIcon className="w-6 h-6" /> EMIs & Payments</h2>
                    {vehicle.emis.length === 0 ? <p className="text-slate-500 text-sm py-4 italic">No EMI tracking configured.</p> : (
                        <div className="space-y-4">
                            {vehicle.emis.map(emi => (
                                <div key={emi.id} className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700/50 flex flex-col gap-4 shadow-inner">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-black text-white text-2xl">₹{emi.amount.toLocaleString()}</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Monthly Installment</p>
                                        </div>
                                        <button 
                                            onClick={() => onMarkEmiPaid(emi.id)} 
                                            disabled={emi.paidInstallments >= emi.totalTenure}
                                            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-indigo-600/20 active:scale-95 transition-all uppercase tracking-tight"
                                        >
                                            {emi.paidInstallments >= emi.totalTenure ? 'Settled' : 'Pay Next'}
                                        </button>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                                            <span>Progress</span>
                                            <span>{Math.round((emi.paidInstallments / emi.totalTenure) * 100)}%</span>
                                        </div>
                                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                            <div className="bg-indigo-500 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${(emi.paidInstallments / emi.totalTenure) * 100}%` }}></div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold tracking-tight">{emi.paidInstallments} of {emi.totalTenure} paid</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
                    <h2 className="text-lg font-black text-purple-400 mb-6 flex items-center gap-2 pb-4 border-b border-slate-700/50 uppercase tracking-tighter"><DocumentIcon className="w-6 h-6" /> Digital Documents</h2>
                    {vehicle.documents.length === 0 ? <p className="text-slate-500 text-sm py-4 italic">No documents uploaded.</p> : (
                        <div className="space-y-3">
                            {vehicle.documents.map(doc => (
                                <div key={doc.id} className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 flex justify-between items-center group shadow-inner">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-900/20 rounded-lg text-purple-400"><DocumentIcon className="w-5 h-5" /></div>
                                        <div>
                                            <p className="font-bold text-white text-sm">{doc.name}</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Exp: {formatDate(doc.expiryDate)}</p>
                                        </div>
                                    </div>
                                    <button className="p-2.5 text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-xl transition-colors active:scale-95">
                                        <EyeIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

const SettingsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onLogout: () => void;
}> = ({ isOpen, onClose, onLogout }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="App Settings">
        <div className="space-y-6 pt-2">
            <button onClick={onLogout} className="w-full bg-rose-600/10 text-rose-500 hover:bg-rose-600 hover:text-white border border-rose-500/20 p-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-rose-900/10 flex items-center justify-center gap-3">
                <LogoutIcon className="w-5 h-5" /> Logout Session
            </button>
            <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">Version 2.4.0 (Cloud Sync Active)</p>
        </div>
    </Modal>
);

const AuthScreen: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const handleLogin = async (e: React.FormEvent) => {
        setLoading(true);
        e.preventDefault();
        const email = (e.target as any).email.value;
        const password = (e.target as any).password.value;
        if (!supabase) { alert("Database error."); setLoading(false); return; }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            if (error.message.includes("Invalid login credentials")) {
                const { error: signUpError } = await supabase.auth.signUp({ email, password });
                if (signUpError) alert(signUpError.message);
                else alert("Account created and logged in!");
            } else alert(error.message);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/10 via-slate-900 to-slate-900">
            <div className="w-full max-w-md space-y-10">
                <div className="text-center">
                    <div className="bg-indigo-600 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-600/30 transform -rotate-12 border-4 border-slate-900">
                        <VehicleIcon className="w-14 h-14 text-white" />
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter mb-2 uppercase italic">DUE Guardian</h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Smart Vehicle & Loan Manager</p>
                </div>
                
                <form onSubmit={handleLogin} className="bg-slate-800/50 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-slate-700/50 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Access Email</label>
                        <input name="email" type="email" placeholder="email@example.com" required className="w-full bg-slate-900/50 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Security Pin</label>
                        <input name="password" type="password" placeholder="••••••••" required className="w-full bg-slate-900/50 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold" />
                    </div>
                    
                    <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black p-5 rounded-2xl shadow-xl shadow-indigo-600/30 transform active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-tighter text-lg italic">
                        {loading ? <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div> : "Enter Dashboard"}
                    </button>
                </form>
            </div>
        </div>
    );
};

const AuthenticatedApp: React.FC<AuthenticatedAppProps> = ({ currentUser, userId, onLogout }) => {
    const [vehicles, setVehicles] = useLocalStorage<Vehicle[]>(`${currentUser}_vehicles`, []);
    const [snoozed, setSnoozed] = useLocalStorage<Record<string, number>>(`${currentUser}_snoozedReminders`, {});
    const [view, setView] = useLocalStorage<View>(`${currentUser}_lastView`, 'dashboard');
    const [selectedVehicleId, setSelectedVehicleId] = useLocalStorage<string | null>(`${currentUser}_lastSelectedVehicle`, null);
    const [isInitialLoadCompleted, setIsInitialLoadCompleted] = useState(false);
    const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isScanning, setIsScanning] = useState(false);
    const [scannedData, setScannedData] = useState<any>(null);
    const [isVehicleFormModalOpen, setVehicleFormModalOpen] = useState(false);
    const [addModalMode, setAddModalMode] = useState<'asset' | 'loan'>('asset');
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [isSettingsOpen, setSettingsOpen] = useState(false);
    const scanInputRef = useRef<HTMLInputElement>(null);

    // Sync Logic
    useEffect(() => {
        const fetchRemoteData = async () => {
            if (!supabase) { setIsInitialLoadCompleted(true); return; }
            try {
                const { data } = await supabase.from('user_data').select('*').eq('user_id', userId).single();
                if (data && data.vehicles) setVehicles(data.vehicles);
            } catch (err) { console.error(err); } finally { setIsInitialLoadCompleted(true); }
        };
        fetchRemoteData();
    }, [userId]);

    useEffect(() => {
        if (!supabase || !isInitialLoadCompleted) return;
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(async () => {
            try { await supabase.from('user_data').upsert({ user_id: userId, vehicles, snoozed, updated_at: new Date().toISOString() }); } 
            catch (err) { console.error(err); }
        }, 3000);
        return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
    }, [vehicles, snoozed, userId, isInitialLoadCompleted]);

    const handleSmartScan = async (file: File) => {
        setIsScanning(true);
        try {
            const isPdf = file.type === 'application/pdf';
            const base64Data = isPdf ? await fileToBase64(file) : await compressImage(file);
            const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: [
                    { parts: [
                        { text: 'Analyze this Indian vehicle document (Insurance, PUC, or RC). Extract details into JSON: registrationNumber (uppercase, no spaces), make (company like Honda, Tata), model, category (one of: Car, Bike, Truck, Machine), docName (one of: Insurance, Pollution Under Control (PUC), Registration Certificate (RC)), and expiryDate (YYYY-MM-DD). If its a heavy machine like JCB, use "Machine".' },
                        { inlineData: { data: base64Data, mimeType: mimeType } }
                    ]}
                ],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            registrationNumber: { type: Type.STRING },
                            make: { type: Type.STRING },
                            model: { type: Type.STRING },
                            category: { type: Type.STRING },
                            docName: { type: Type.STRING },
                            expiryDate: { type: Type.STRING }
                        },
                        required: ["registrationNumber", "make", "category", "docName", "expiryDate"]
                    }
                }
            });

            const result = JSON.parse(response.text || '{}');
            setScannedData({ ...result, fileData: `data:${mimeType};base64,${base64Data}`, fileName: file.name });
            setVehicleFormModalOpen(false);
        } catch (err) {
            console.error(err);
            alert("AI Document Recognition failed. Please upload a clearer image.");
        } finally {
            setIsScanning(false);
        }
    };

    const confirmScannedData = (final: any) => {
        let vehicle = vehicles.find(v => v.registrationNumber === final.registrationNumber);
        if (!vehicle) {
            vehicle = {
                id: crypto.randomUUID(), type: final.category, make: final.make, model: final.model || 'Unknown', registrationNumber: final.registrationNumber, documents: [], archivedDocuments: [], emis: []
            };
            setVehicles(prev => [...prev, vehicle!]);
        }
        
        const newDoc: Document = {
            id: crypto.randomUUID(), name: final.docName, validFrom: new Date().toISOString().split('T')[0], expiryDate: final.expiryDate, fileData: scannedData.fileData, fileName: scannedData.fileName
        };

        setVehicles(prev => prev.map(v => v.id === vehicle!.id ? { ...v, documents: [...v.documents, newDoc] } : v));
        setScannedData(null);
        setSelectedVehicleId(vehicle.id);
        setView('vehicleDetail');
    };

    const handleSaveVehicle = (data: any) => {
        if (editingVehicle) setVehicles(prev => prev.map(v => v.id === editingVehicle.id ? { ...v, ...data } : v));
        else setVehicles(prev => [...prev, { ...data, id: crypto.randomUUID(), documents: [], emis: [], archivedDocuments: [] }]);
    };

    const renderContent = () => {
        if (isScanning) return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-6">
                <div className="w-20 h-20 border-8 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <div className="text-center animate-pulse">
                    <h2 className="text-2xl font-black text-indigo-400 uppercase italic tracking-tighter">AI Scanning Active</h2>
                    <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2">Extracting details from your document...</p>
                </div>
            </div>
        );

        switch (view) {
            case 'vehicleList': return <VehicleList vehicles={vehicles} onSelectVehicle={id => { setSelectedVehicleId(id); setView('vehicleDetail'); }} onAddAssetClick={() => { setAddModalMode('asset'); setVehicleFormModalOpen(true); }} onAddLoanClick={() => { setAddModalMode('loan'); setVehicleFormModalOpen(true); }} />;
            case 'vehicleDetail': {
                const v = vehicles.find(veh => veh.id === selectedVehicleId);
                return v ? <VehicleDetail vehicle={v} onBack={() => setView('vehicleList')} onEditVehicle={() => { setEditingVehicle(v); setVehicleFormModalOpen(true); }} onDeleteVehicle={() => { setVehicles(prev => prev.filter(veh => veh.id !== selectedVehicleId)); setView('vehicleList'); }} onMarkEmiPaid={id => setVehicles(prev => prev.map(veh => veh.id === selectedVehicleId ? {...veh, emis: veh.emis.map(e => e.id === id ? {...e, paidInstallments: e.paidInstallments + 1} : e)} : veh))} /> : null;
            }
            case 'reports': return <Reports vehicles={vehicles} userKey={currentUser} />;
            default: return <Dashboard vehicles={vehicles} onViewVehicle={id => { setSelectedVehicleId(id); setView('vehicleDetail'); }} snoozed={snoozed} onSnoozeItem={(id, min) => setSnoozed(prev => ({ ...prev, [id]: Date.now() + (min || 1440) * 60000 }))} onMarkEmiPaid={(emi, vid) => setVehicles(prev => prev.map(v => v.id === vid ? {...v, emis: v.emis.map(e => e.id === emi.id ? {...e, paidInstallments: e.paidInstallments + 1} : e)} : v))} onSnoozeAlarm={() => {}} onSetManualAlarm={() => {}} onDismissAlarm={() => {}} />;
        }
    };

    return (
        <div className="min-h-screen flex flex-col pb-16 bg-slate-900">
            <header className="bg-slate-800/80 backdrop-blur-md p-4 sticky top-0 z-10 flex justify-between items-center border-b border-slate-700/50 shadow-2xl">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-1.5 rounded-lg shadow-lg shadow-indigo-600/30"><VehicleIcon className="w-6 h-6 text-white" /></div>
                    <h1 className="text-xl font-black italic tracking-tighter uppercase">DUE Guardian</h1>
                </div>
                <button onClick={() => setSettingsOpen(true)} className="p-2 text-slate-400 hover:text-white transition-colors"><SettingsIcon className="w-6 h-6" /></button>
            </header>
            <main className="flex-grow max-w-4xl mx-auto w-full">{renderContent()}</main>
            <nav className="bg-slate-800/95 backdrop-blur-md fixed bottom-0 z-10 w-full h-16 border-t border-slate-700/50 flex justify-around items-center shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
                <button onClick={() => setView('dashboard')} className={`flex flex-col items-center transition-all ${view === 'dashboard' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}><DashboardIcon className="w-6 h-6" /><span className="text-[10px] font-black uppercase mt-0.5 tracking-tighter">Home</span></button>
                <button onClick={() => setView('reports')} className={`flex flex-col items-center transition-all ${view === 'reports' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}><EyeIcon className="w-6 h-6" /><span className="text-[10px] font-black uppercase mt-0.5 tracking-tighter">Reports</span></button>
                <button onClick={() => setView('vehicleList')} className={`flex flex-col items-center transition-all ${view === 'vehicleList' || view === 'vehicleDetail' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}><VehicleIcon className="w-6 h-6" /><span className="text-[10px] font-black uppercase mt-0.5 tracking-tighter">Items</span></button>
            </nav>
            <VehicleFormModal isOpen={isVehicleFormModalOpen} onClose={() => setVehicleFormModalOpen(false)} onSave={handleSaveVehicle} mode={addModalMode} initialData={editingVehicle} onScanRequest={() => scanInputRef.current?.click()} />
            <input type="file" ref={scanInputRef} className="hidden" accept="image/*,.pdf" onChange={e => e.target.files?.[0] && handleSmartScan(e.target.files[0])} />
            <ReviewScanModal isOpen={!!scannedData} onClose={() => setScannedData(null)} data={scannedData} onConfirm={confirmScannedData} />
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} onLogout={onLogout} />
            <AddToHomeScreenPrompt />
        </div>
    );
};

const App: React.FC = () => {
    const [session, setSession] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        if (supabase) {
            supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setIsLoading(false); });
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); setIsLoading(false); });
            return () => subscription.unsubscribe();
        } else setIsLoading(false);
    }, []);
    if (isLoading) return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-indigo-400 font-black italic tracking-widest text-xs uppercase animate-pulse">Initializing Vault...</p>
    </div>;
    return session ? <AuthenticatedApp currentUser={session.user.email!} userId={session.user.id} onLogout={() => supabase?.auth.signOut()} /> : <AuthScreen />;
};

export default App;
