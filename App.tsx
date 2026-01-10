
import React, { useState, useEffect, useRef } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { Vehicle, VehicleType, Emi, Document, PREDEFINED_DOC_NAMES, EmiPayment, AlarmLog, MACHINE_TYPES } from './types';
import Dashboard from './components/Dashboard';
import Modal from './components/Modal';
import Reports from './components/Reports';
import { PlusIcon, ArrowLeftIcon, CarIcon, TruckIcon, MachineIcon, BikeIcon, DashboardIcon, VehicleIcon, DownloadIcon, EditIcon, DeleteIcon, CheckCircleIcon, OtherVehicleIcon, PersonalLoanIcon, BusinessLoanIcon, HomeLoanIcon, LogoutIcon, SettingsIcon, EyeIcon, BellIcon, SearchIcon } from './components/icons';
import AddToHomeScreenPrompt from './components/AddToHomeScreenPrompt';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

const SOUND_URLS = {
    subtle: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
    attention: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg',
    urgent: 'https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg'
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

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_DIM = 800; 
                let width = img.width;
                let height = img.height;
                if (width > height) { if (width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; } } 
                else { if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(event.target?.result as string); return; }
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

type View = 'dashboard' | 'vehicleList' | 'vehicleDetail' | 'reports';

const VehicleFormModal: React.FC<{ 
    isOpen: boolean; onClose: () => void; 
    onSave: (vehicle: Omit<Vehicle, 'id' | 'documents' | 'emis' | 'archivedDocuments'>) => void; 
    mode: 'asset' | 'loan'; initialData?: Vehicle | null;
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
                setMake(initialData.make); setModel(initialData.model); setRegNum(initialData.registrationNumber);
                if (MACHINE_TYPES.includes(initialData.type as any)) { setType(initialData.type); setCustomType(''); } 
                else {
                    const isKnownType = [...assetTypes, ...loanTypes].includes(initialData.type as any);
                    if (isKnownType && initialData.type !== VehicleType.Other) { setType(initialData.type); setCustomType(''); } 
                    else { setType(VehicleType.Other); setCustomType(initialData.type); }
                }
            } else { setMake(''); setModel(''); setRegNum(''); setCustomType(''); setType(mode === 'asset' ? VehicleType.Car : VehicleType.PersonalLoan); }
        }
    }, [isOpen, mode, initialData]);
    const availableTypes = mode === 'asset' ? assetTypes : loanTypes;
    const isLoanMode = mode === 'loan';
    const placeholderMake = isLoanMode ? "Lender / Bank Name" : "Make";
    const placeholderModel = isLoanMode ? "Loan Purpose" : "Model";
    const placeholderReg = isLoanMode ? "Loan Account Number" : "Registration Number";
    const buttonText = initialData ? "Save Changes" : (isLoanMode ? "Add Loan" : "Add Vehicle");
    const titleText = initialData ? "Edit Details" : "Add New";
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalType = (type === VehicleType.Other) ? customType : type;
        if (!make || !model || !regNum || !finalType) return;
        onSave({ make, model, registrationNumber: regNum.toUpperCase(), type: finalType });
        onClose();
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={titleText}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <select value={MACHINE_TYPES.includes(type as any) ? VehicleType.Machine : type} onChange={e => setType(e.target.value === VehicleType.Machine ? MACHINE_TYPES[0] : e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded">
                    {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {type === VehicleType.Machine || MACHINE_TYPES.includes(type as any) && (
                    <select value={type} onChange={e => setType(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded">
                        {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                )}
                {type === VehicleType.Other && <input type="text" placeholder="Custom Type" value={customType} onChange={e => setCustomType(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />}
                <input type="text" placeholder={placeholderMake} value={make} onChange={e => setMake(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                <input type="text" placeholder={placeholderModel} value={model} onChange={e => setModel(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                <input type="text" placeholder={placeholderReg} value={regNum} onChange={e => setRegNum(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 p-2 rounded text-white font-bold">{buttonText}</button>
            </form>
        </Modal>
    );
};

const DeleteVehicleModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: (reason: string) => void; vehicleName: string; }> = ({ isOpen, onClose, onConfirm, vehicleName }) => {
    const [reason, setReason] = useState('');
    useEffect(() => { if (isOpen) setReason(''); }, [isOpen]);
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Delete Item">
            <div className="space-y-4">
                <p className="text-slate-300">Delete <span className="font-bold text-white">{vehicleName}</span>?</p>
                <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (e.g., Sold)" className="w-full p-2 bg-slate-700 border border-slate-600 rounded min-h-[80px]" required />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="bg-slate-600 p-2 px-4 rounded">Cancel</button>
                    <button onClick={() => onConfirm(reason)} disabled={!reason.trim()} className="bg-red-600 p-2 px-4 rounded font-bold">Delete</button>
                </div>
            </div>
        </Modal>
    );
}

const EmiFormModal: React.FC<{ isOpen: boolean; onClose: () => void; onSubmit: (emi: Omit<Emi, 'id'>, existingId?: string) => void; initialData?: Emi | null; vehicleType?: string; }> = ({ isOpen, onClose, onSubmit, initialData, vehicleType }) => {
    const [amount, setAmount] = useState('');
    const [startDate, setStartDate] = useState('');
    const [totalTenure, setTotalTenure] = useState('');
    const [interest, setInterest] = useState('');
    const [provider, setProvider] = useState('');
    const [loanId, setLoanId] = useState('');
    const [bank, setBank] = useState('');
    const [paidTillDate, setPaidTillDate] = useState('');
    const [totalCost, setTotalCost] = useState('');
    const [downPayment, setDownPayment] = useState('');
    const isEditing = !!initialData;
    useEffect(() => {
        if (isOpen && initialData) {
            setAmount(String(initialData.amount)); setStartDate(initialData.startDate); setTotalTenure(String(initialData.totalTenure));
            setInterest(String(initialData.interestRate || '')); setProvider(initialData.loanProvider || ''); setLoanId(initialData.loanId || '');
            setBank(initialData.emiBank || ''); setTotalCost(String(initialData.totalVehicleCost || '')); setDownPayment(String(initialData.downPayment || ''));
        } else if (isOpen) {
            setAmount(''); setStartDate(''); setTotalTenure(''); setInterest(''); setProvider(''); setLoanId(''); setBank(''); setPaidTillDate(''); setTotalCost(''); setDownPayment('');
        }
    }, [isOpen, initialData]);
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let paidCount = initialData?.paidInstallments || 0;
        const tenureNum = parseInt(totalTenure, 10);
        if (startDate && paidTillDate && tenureNum > 0) {
            const start = new Date(startDate); const paidTill = new Date(paidTillDate); let count = 0;
            for (let i = 0; i < tenureNum; i++) {
                const dueDate = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
                if (dueDate <= paidTill) count++; else break;
            }
            paidCount = count;
        }
        onSubmit({ 
            amount: parseFloat(amount), startDate, totalTenure: tenureNum, paidInstallments: paidCount,
            interestRate: interest ? parseFloat(interest) : undefined, loanProvider: provider, loanId, emiBank: bank,
            totalVehicleCost: totalCost ? parseFloat(totalCost) : undefined, downPayment: downPayment ? parseFloat(downPayment) : undefined,
        }, initialData?.id);
        onClose();
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit EMI' : 'Add EMI'}>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                <input type="number" placeholder="EMI Amount" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                <div className="grid grid-cols-2 gap-4">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                    <input type="number" placeholder="Tenure (Months)" value={totalTenure} onChange={e => setTotalTenure(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                </div>
                <input type="date" placeholder="Paid Till Date" value={paidTillDate} onChange={e => setPaidTillDate(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                <input type="number" placeholder="Total Cost" value={totalCost} onChange={e => setTotalCost(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                <input type="number" placeholder="Interest Rate (%)" value={interest} onChange={e => setInterest(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                <input type="text" placeholder="Loan Provider" value={provider} onChange={e => setProvider(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                <input type="text" placeholder="EMI Bank" value={bank} onChange={e => setBank(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                <button type="submit" className="w-full bg-indigo-600 p-2 rounded text-white font-bold">{isEditing ? 'Save' : 'Add'}</button>
            </form>
        </Modal>
    );
};

const AddDocModal: React.FC<{ isOpen: boolean; onClose: () => void; onSave: (doc: Omit<Document, 'id'>, idToUpdate?: string) => void; initialData?: Document | null; activeDocuments: Document[]; isRenewing?: boolean; vehicleType?: string; }> = ({ isOpen, onClose, onSave, initialData, activeDocuments, isRenewing, vehicleType }) => {
    const isEditing = !!initialData && !isRenewing;
    const [docName, setDocName] = useState<string>(PREDEFINED_DOC_NAMES[0]);
    const [customName, setCustomName] = useState('');
    const [validFrom, setValidFrom] = useState('');
    const [expiry, setExpiry] = useState('');
    const [fileData, setFileData] = useState<string | undefined>();
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setDocName(PREDEFINED_DOC_NAMES.includes(initialData.name as any) ? initialData.name : 'Other');
                setCustomName(PREDEFINED_DOC_NAMES.includes(initialData.name as any) ? '' : initialData.name);
                if (isEditing) { setValidFrom(initialData.validFrom); setExpiry(initialData.expiryDate); setFileData(initialData.fileData); }
            } else { setDocName(PREDEFINED_DOC_NAMES[0]); setCustomName(''); setValidFrom(''); setExpiry(''); setFileData(undefined); }
        }
    }, [isOpen, initialData, isEditing]);
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type.startsWith('image/')) { setFileData(await compressImage(file)); } 
            else { const r = new FileReader(); r.onload = (ev) => setFileData(ev.target?.result as string); r.readAsDataURL(file); }
        }
    };
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const name = docName === 'Other' ? customName : docName;
        onSave({ name, validFrom, expiryDate: expiry, fileData }, isEditing ? initialData?.id : undefined);
        onClose();
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Doc' : 'Add Doc'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <select value={docName} onChange={e => setDocName(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded">
                    {PREDEFINED_DOC_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                {docName === 'Other' && <input type="text" placeholder="Custom Name" value={customName} onChange={e => setCustomName(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />}
                <div className="grid grid-cols-2 gap-4">
                    <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                    <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                </div>
                <input type="file" onChange={handleFile} accept="image/*,.pdf" className="w-full text-xs" />
                <button type="submit" className="w-full bg-indigo-600 p-2 rounded text-white font-bold">Save</button>
            </form>
        </Modal>
    );
};

const VehicleList: React.FC<{ vehicles: Vehicle[], onSelectVehicle: (id: string) => void, onAddAssetClick: () => void, onAddLoanClick: () => void }> = ({ vehicles, onSelectVehicle, onAddAssetClick, onAddLoanClick }) => {
    const [search, setSearch] = useState('');
    const filtered = vehicles.filter(v => v.make.toLowerCase().includes(search.toLowerCase()) || v.model.toLowerCase().includes(search.toLowerCase()) || v.registrationNumber.toLowerCase().includes(search.toLowerCase()));
    return (
        <div className="p-4 md:p-6 pt-0">
            <div className="sticky top-[56px] z-10 bg-slate-900 pt-6 pb-4 border-b border-slate-800">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-indigo-400">My Items</h1>
                    <div className="flex gap-2">
                        <button onClick={onAddAssetClick} className="bg-indigo-600 p-2 px-3 rounded flex items-center gap-2 text-sm"><PlusIcon className="w-4 h-4"/> Asset</button>
                        <button onClick={onAddLoanClick} className="bg-emerald-600 p-2 px-3 rounded flex items-center gap-2 text-sm"><PlusIcon className="w-4 h-4"/> Loan</button>
                    </div>
                </div>
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                    <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 p-2 bg-slate-800 border border-slate-700 rounded-lg outline-none" />
                </div>
            </div>
            <div className="space-y-3 mt-4">
                {filtered.map(v => (
                    <div key={v.id} onClick={() => onSelectVehicle(v.id)} className="bg-slate-800 p-4 rounded-lg flex items-center justify-between cursor-pointer hover:bg-slate-700 transition-colors">
                        <div className="flex items-center space-x-4">
                            {getVehicleIcon(v.type)}
                            <div>
                                <p className="font-bold">{getVehicleDisplayName(v)}</p>
                                <p className="text-xs text-slate-400">{v.registrationNumber}</p>
                            </div>
                        </div>
                        <span className="text-slate-500">→</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const VehicleDetail: React.FC<{ vehicle: Vehicle; onBack: () => void; onAddDoc: (d: any, id?: string) => void; onUpdateDoc: (id: string, d: any) => void; onDeleteDoc: (d: any) => void; onMarkEmiPaid: (id: string) => void; onOpenSettleModal: (e: any) => void; onEditEmiClick: (e: any) => void; onEditVehicle: () => void; onDeleteVehicle: () => void; }> = ({ vehicle, onBack, onAddDoc, onUpdateDoc, onDeleteDoc, onMarkEmiPaid, onOpenSettleModal, onEditEmiClick, onEditVehicle, onDeleteVehicle }) => {
    const [isDocOpen, setDocOpen] = useState(false);
    const [docEdit, setDocEdit] = useState<any>(null);
    const [preview, setPreview] = useState<any>(null);
    return (
        <div className="p-4 md:p-6">
            <button onClick={onBack} className="flex items-center gap-2 text-indigo-400 mb-4"><ArrowLeftIcon className="w-5 h-5" /> Back</button>
            <div className="bg-slate-800 p-4 rounded-lg flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    {getVehicleIcon(vehicle.type)}
                    <div>
                        <h1 className="text-xl font-bold">{getVehicleDisplayName(vehicle)}</h1>
                        <p className="text-xs text-slate-400">{vehicle.registrationNumber}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={onEditVehicle} className="p-2 bg-slate-700 rounded-full"><EditIcon className="w-4 h-4"/></button>
                    <button onClick={onDeleteVehicle} className="p-2 bg-slate-700 rounded-full text-red-400"><DeleteIcon className="w-4 h-4"/></button>
                </div>
            </div>
            <div className="mb-8">
                <div className="flex justify-between items-center mb-3"><h2 className="font-bold text-cyan-400">EMIs</h2><button onClick={() => onEditEmiClick(null)} className="p-1 bg-cyan-600 rounded-full"><PlusIcon className="w-5 h-5"/></button></div>
                {vehicle.emis.map(e => e.paidInstallments < e.totalTenure && (
                    <div key={e.id} className="bg-slate-800/50 p-4 rounded-lg mb-3">
                        <div className="flex justify-between">
                            <div><p className="font-bold text-lg">₹{e.amount.toLocaleString()}</p><p className="text-xs text-slate-400">Paid: {e.paidInstallments}/{e.totalTenure}</p></div>
                            <div className="flex gap-2">
                                <button onClick={() => onMarkEmiPaid(e.id)} className="bg-green-600 px-3 py-1 rounded text-xs font-bold">Pay</button>
                                <button onClick={() => onOpenSettleModal(e)} className="bg-blue-600 px-3 py-1 rounded text-xs font-bold">Settle</button>
                                <button onClick={() => onEditEmiClick(e)} className="text-slate-400"><EditIcon className="w-4 h-4"/></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div>
                <div className="flex justify-between items-center mb-3"><h2 className="font-bold text-purple-400">Documents</h2><button onClick={() => setDocOpen(true)} className="p-1 bg-purple-600 rounded-full"><PlusIcon className="w-5 h-5"/></button></div>
                {vehicle.documents.map(d => (
                    <div key={d.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center mb-2">
                        <div><p className="font-semibold text-sm">{d.name}</p><p className="text-xs text-slate-400">Expiry: {formatDate(d.expiryDate)}</p></div>
                        <div className="flex gap-2">
                            {d.fileData && <button onClick={() => setPreview(d)} className="text-indigo-400"><EyeIcon className="w-5 h-5"/></button>}
                            <button onClick={() => { setDocEdit(d); setDocOpen(true); }} className="text-slate-400"><EditIcon className="w-4 h-4"/></button>
                            <button onClick={() => onDeleteDoc(d)} className="text-red-400"><DeleteIcon className="w-4 h-4"/></button>
                        </div>
                    </div>
                ))}
            </div>
            <AddDocModal isOpen={isDocOpen} onClose={() => { setDocOpen(false); setDocEdit(null); }} onSave={(data, id) => id ? onUpdateDoc(id, data) : onAddDoc(data)} initialData={docEdit} activeDocuments={vehicle.documents} />
            {preview && <Modal isOpen={!!preview} onClose={() => setPreview(null)} title={preview.name}><div className="flex justify-center"><img src={preview.fileData} className="max-w-full rounded"/></div></Modal>}
        </div>
    );
};

const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void; reminderTime: string; soundPreference: string; onTimeChange: (t: string) => void; onSoundChange: (s: string) => void; onLogout: () => void; onExport: () => void; onImport: (f: File) => void; syncStatus: string; onForceSync: () => void; }> = ({ isOpen, onClose, reminderTime, soundPreference, onTimeChange, onSoundChange, onLogout, onExport, onImport, syncStatus, onForceSync }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Settings">
            <div className="space-y-6">
                <div>
                    <h3 className="font-bold mb-2">Cloud Sync</h3>
                    <div className="flex justify-between items-center bg-slate-700/50 p-3 rounded">
                        <div><p className="text-xs text-slate-400">Status</p><p className={`text-sm font-bold ${syncStatus.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>{syncStatus}</p></div>
                        <button onClick={onForceSync} className="text-xs bg-indigo-600 px-3 py-1 rounded font-bold">Sync Now</button>
                    </div>
                </div>
                <div><h3 className="font-bold mb-2">Notifications</h3><input type="time" value={reminderTime} onChange={e => onTimeChange(e.target.value)} className="w-full p-2 bg-slate-700 rounded mb-2"/><select value={soundPreference} onChange={e => onSoundChange(e.target.value)} className="w-full p-2 bg-slate-700 rounded"><option value="subtle">Subtle</option><option value="attention">Attention</option><option value="urgent">Urgent</option></select></div>
                <div className="flex gap-2"><button onClick={onExport} className="flex-1 bg-sky-600 p-2 rounded text-sm font-bold">Backup</button><button onClick={() => document.getElementById('import-file')?.click()} className="flex-1 bg-purple-600 p-2 rounded text-sm font-bold">Restore</button><input id="import-file" type="file" onChange={e => e.target.files?.[0] && onImport(e.target.files[0])} className="hidden"/></div>
                <button onClick={onLogout} className="w-full bg-red-600 p-2 rounded font-bold">Logout</button>
            </div>
        </Modal>
    );
}

const AuthScreen: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setError('');
        try {
            if (mode === 'signup') { const { error } = await supabase!.auth.signUp({ email, password }); if (error) throw error; alert("Account created! You can login now."); setMode('login'); } 
            else { const { error } = await supabase!.auth.signInWithPassword({ email, password }); if (error) throw error; }
        } catch (err: any) { setError(err.message); }
    };
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md">
                <h1 className="text-3xl font-bold text-center mb-8">Due Guardian</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 bg-slate-700 rounded outline-none" required />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 bg-slate-700 rounded outline-none" required minLength={6} />
                    <button type="submit" className="w-full bg-indigo-600 p-3 rounded font-bold text-lg">{mode === 'login' ? 'Login' : 'Sign Up'}</button>
                </form>
                <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="w-full mt-4 text-sm text-slate-400">{mode === 'login' ? 'Need an account? Sign Up' : 'Have an account? Login'}</button>
            </div>
        </div>
    );
}

const AuthenticatedApp: React.FC<{ currentUser: string; userId: string; onLogout: () => void; }> = ({ currentUser, userId, onLogout }) => {
    const [vehicles, setVehicles] = useLocalStorage<Vehicle[]>(`${currentUser}_vehicles`, []);
    const [snoozed, setSnoozed] = useLocalStorage<Record<string, number>>(`${currentUser}_snoozed`, {});
    const [settings, setSettings] = useLocalStorage<any>(`${currentUser}_settings`, { reminderTime: '11:00', soundPreference: 'subtle' });
    const [localUpdatedAt, setLocalUpdatedAt] = useLocalStorage<number>(`${currentUser}_updated_at`, Date.now());

    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState('Idle');
    const [initialLoadDone, setInitialLoadDone] = useState(false);
    const syncRef = useRef<any>(null);

    // Sync Helper: Update timestamp on local changes
    const markLocalUpdate = () => {
        const now = Date.now();
        setLocalUpdatedAt(now);
    };

    // Robust Fetch with Merge Logic
    const fetchAndMerge = async () => {
        if (!supabase) return;
        setIsSyncing(true);
        setSyncStatus('Checking Cloud...');
        try {
            const { data, error } = await supabase.from('user_data').select('*').eq('user_id', userId).single();
            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                const remoteUpdated = data.updated_at ? new Date(data.updated_at).getTime() : 0;
                
                // Newest Wins Conflict Resolution
                if (remoteUpdated > localUpdatedAt) {
                    setSyncStatus('Cloud is Newer. Syncing...');
                    if (data.vehicles) setVehicles(data.vehicles);
                    if (data.snoozed) setSnoozed(data.snoozed);
                    if (data.settings) setSettings(data.settings);
                    setLocalUpdatedAt(remoteUpdated);
                } else if (remoteUpdated < localUpdatedAt && localUpdatedAt > 0) {
                    setSyncStatus('Local is Newer. Backing up...');
                    await pushToCloud();
                } else {
                    setSyncStatus('Synced');
                }
            } else {
                // No cloud data yet, push local if it exists
                if (vehicles.length > 0) {
                    setSyncStatus('First Sync...');
                    await pushToCloud();
                } else {
                    setSyncStatus('No Cloud Data');
                }
            }
        } catch (err) { setSyncStatus('Sync Error'); } finally { setIsSyncing(false); setInitialLoadDone(true); }
    };

    const pushToCloud = async () => {
        if (!supabase) return;
        setIsSyncing(true);
        try {
            const now = new Date().toISOString();
            const { error } = await supabase.from('user_data').upsert({
                user_id: userId, vehicles, snoozed, settings, updated_at: now
            });
            if (error) throw error;
            setSyncStatus('Saved to Cloud');
        } catch (err) { setSyncStatus('Save Error'); } finally { setIsSyncing(false); }
    };

    // Initial load
    useEffect(() => { fetchAndMerge(); }, [userId]);

    // Auto-save debounced
    useEffect(() => {
        if (!initialLoadDone) return;
        if (syncRef.current) clearTimeout(syncRef.current);
        syncRef.current = setTimeout(pushToCloud, 3000);
        return () => clearTimeout(syncRef.current);
    }, [vehicles, snoozed, settings]);

    // FIX: Implement missing handleSnoozeItem function for Dashboard interactions.
    const handleSnoozeItem = (itemId: string, minutes: number = 1440) => {
        const until = Date.now() + (minutes * 60 * 1000);
        setSnoozed(prev => ({ ...prev, [itemId]: until }));
        markLocalUpdate();
    };

    // UI state
    const [view, setView] = useLocalStorage<View>(`${currentUser}_view`, 'dashboard');
    const [selId, setSelId] = useLocalStorage<string | null>(`${currentUser}_selId`, null);
    const [isVModal, setVModal] = useState(false);
    const [vMode, setVMode] = useState<'asset' | 'loan'>('asset');
    const [isEModal, setEModal] = useState(false);
    const [eEdit, setEEdit] = useState<any>(null);
    const [isSettings, setSettingsOpen] = useState(false);
    const [isDelV, setDelV] = useState(false);
    const [vToDel, setVToDel] = useState<any>(null);
    const [payData, setPayData] = useState<any>(null);
    const [settleData, setSettleData] = useState<any>(null);
    const [docToDel, setDocToDel] = useState<any>(null);

    const vehiclesFiltered = vehicles.filter(v => v.id !== 'deleted');

    const handleSaveV = (data: any) => {
        if (vToDel) { // reusing logic for editing
            setVehicles(prev => prev.map(v => v.id === selId ? { ...v, ...data } : v));
        } else {
            setVehicles(prev => [...prev, { ...data, id: crypto.randomUUID(), documents: [], emis: [], archivedDocuments: [] }]);
        }
        markLocalUpdate(); setVModal(false);
    };

    const handleSaveE = (data: any, id?: string) => {
        if (!selId) return;
        setVehicles(prev => prev.map(v => v.id === selId ? { ...v, emis: id ? v.emis.map(e => e.id === id ? { ...e, ...data } : e) : [...v.emis, { ...data, id: crypto.randomUUID(), paymentHistory: [] }] } : v));
        markLocalUpdate();
    };

    // FIX: Update handleMarkPaid to optionally accept a vehicle ID, supporting Dashboard calls.
    const handleMarkPaid = (eId: string, vId?: string) => {
        const targetVId = vId || selId;
        if (!targetVId) return;
        setVehicles(prev => prev.map(v => v.id === targetVId ? { ...v, emis: v.emis.map(e => e.id === eId ? { ...e, paidInstallments: e.paidInstallments + 1 } : e) } : v));
        markLocalUpdate();
    };

    const handleAddDoc = (data: any) => {
        if (!selId) return;
        setVehicles(prev => prev.map(v => v.id === selId ? { ...v, documents: [...v.documents, { ...data, id: crypto.randomUUID() }] } : v));
        markLocalUpdate();
    };

    const handleUpdateDoc = (dId: string, data: any) => {
        if (!selId) return;
        setVehicles(prev => prev.map(v => v.id === selId ? { ...v, documents: v.documents.map(d => d.id === dId ? { ...d, ...data } : d) } : v));
        markLocalUpdate();
    };

    const handleDelDoc = (d: any) => {
        setVehicles(prev => prev.map(v => v.id === selId ? { ...v, documents: v.documents.filter(doc => doc.id !== d.id) } : v));
        markLocalUpdate();
    };

    const handleDelV = (reason: string) => {
        setVehicles(prev => prev.filter(v => v.id !== selId));
        markLocalUpdate(); setDelV(false); setSelId(null); setView('vehicleList');
    };

    const selected = vehicles.find(v => v.id === selId);

    const missingDocsCount = vehicles.reduce((acc, v) => {
        const types = v.documents.map(d => d.name);
        let missing = 0;
        if (!types.includes('Registration Certificate (RC)')) missing++;
        if (!types.includes('Insurance')) missing++;
        if (!types.includes('Pollution Under Control (PUC)')) missing++;
        return acc + missing;
    }, 0);

    return (
        <div className="min-h-screen flex flex-col pb-16 bg-slate-900">
            <header className="bg-slate-800 shadow-md sticky top-0 z-20">
                <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-2"><VehicleIcon className="w-8 h-8 text-indigo-400"/><h1 className="text-xl font-bold">Due Guardian</h1></div>
                    <div className="flex items-center gap-3">
                        {missingDocsCount > 0 && <div className="relative"><BellIcon className="w-6 h-6 text-amber-400"/><span className="absolute -top-1 -right-1 bg-red-600 text-[10px] px-1 rounded-full">{missingDocsCount}</span></div>}
                        <button onClick={() => setSettingsOpen(true)} className="p-2 text-slate-400 hover:text-white"><SettingsIcon className="w-6 h-6"/></button>
                    </div>
                </div>
            </header>
            <main className="flex-grow max-w-4xl mx-auto w-full">
                {view === 'dashboard' && <Dashboard vehicles={vehicles} onViewVehicle={id => { setSelId(id); setView('vehicleDetail'); }} snoozed={snoozed} onSnoozeItem={(id, m) => handleSnoozeItem(id, m)} onMarkEmiPaid={(e, v) => handleMarkPaid(e.id, v)} onSnoozeAlarm={() => {}} onSetManualAlarm={() => {}} onDismissAlarm={() => {}} />}
                {view === 'vehicleList' && <VehicleList vehicles={vehicles} onSelectVehicle={id => { setSelId(id); setView('vehicleDetail'); }} onAddAssetClick={() => { setVMode('asset'); setVModal(true); }} onAddLoanClick={() => { setVMode('loan'); setVModal(true); }} />}
                {view === 'vehicleDetail' && selected && <VehicleDetail vehicle={selected} onBack={() => setView('vehicleList')} onAddDoc={handleAddDoc} onUpdateDoc={handleUpdateDoc} onDeleteDoc={handleDelDoc} onMarkEmiPaid={handleMarkPaid} onOpenSettleModal={s => setSettleData(s)} onEditEmiClick={e => { setEEdit(e); setEModal(true); }} onEditVehicle={() => { setVToDel(selected); setVModal(true); }} onDeleteVehicle={() => setDelV(true)} />}
                {view === 'reports' && <Reports vehicles={vehicles} />}
            </main>
            <nav className="bg-slate-800 fixed bottom-0 z-10 border-t border-slate-700 w-full h-16 flex justify-around items-center">
                <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'text-indigo-400' : 'text-slate-400'}><DashboardIcon className="w-6 h-6"/><span className="block text-[10px]">Home</span></button>
                <button onClick={() => setView('reports')} className={view === 'reports' ? 'text-indigo-400' : 'text-slate-400'}><EyeIcon className="w-6 h-6"/><span className="block text-[10px]">Reports</span></button>
                <button onClick={() => setView('vehicleList')} className={view === 'vehicleList' || view === 'vehicleDetail' ? 'text-indigo-400' : 'text-slate-400'}><VehicleIcon className="w-6 h-6"/><span className="block text-[10px]">Items</span></button>
            </nav>
            <VehicleFormModal isOpen={isVModal} onClose={() => { setVModal(false); setVToDel(null); }} onSave={handleSaveV} mode={vMode} initialData={vToDel} />
            <EmiFormModal isOpen={isEModal} onClose={() => { setEModal(false); setEEdit(null); }} onSubmit={handleSaveE} initialData={eEdit} />
            <SettingsModal isOpen={isSettings} onClose={() => setSettingsOpen(false)} reminderTime={settings.reminderTime} soundPreference={settings.soundPreference} onTimeChange={t => setSettings({...settings, reminderTime: t})} onSoundChange={s => setSettings({...settings, soundPreference: s})} onLogout={onLogout} onExport={() => {}} onImport={() => {}} syncStatus={syncStatus} onForceSync={fetchAndMerge} />
            {/* FIX: Replaced missing ConfirmationModal with the existing DeleteVehicleModal component. */}
            <DeleteVehicleModal isOpen={isDelV} onClose={() => setDelV(false)} onConfirm={handleDelV} vehicleName={selected ? getVehicleDisplayName(selected) : 'Item'} />
        </div>
    );
};

const App: React.FC = () => {
    const [session, setSession] = useState<any>(null);
    useEffect(() => {
        if (!supabase) return;
        supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
        return () => subscription.unsubscribe();
    }, []);
    if (!session) return <AuthScreen onLogin={() => {}} />;
    return <AuthenticatedApp currentUser={session.user.email!} userId={session.user.id} onLogout={() => supabase!.auth.signOut()} />;
};

export default App;
