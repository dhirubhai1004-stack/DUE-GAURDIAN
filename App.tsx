
import React, { useState, useEffect } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { Vehicle, VehicleType, Emi, Document, PREDEFINED_DOC_NAMES } from './types';
import Dashboard from './components/Dashboard';
import Modal from './components/Modal';
import { PlusIcon, ArrowLeftIcon, CarIcon, TruckIcon, MachineIcon, BikeIcon, DashboardIcon, VehicleIcon, DownloadIcon, EditIcon, CheckCircleIcon, OtherVehicleIcon } from './components/icons';
import AddToHomeScreenPrompt from './components/AddToHomeScreenPrompt';

const vehicleTypeIcons: Record<string, React.ReactNode> = {
    [VehicleType.Car]: <CarIcon className="w-8 h-8 text-blue-400" />,
    [VehicleType.Truck]: <TruckIcon className="w-8 h-8 text-orange-400" />,
    [VehicleType.Machine]: <MachineIcon className="w-8 h-8 text-yellow-400" />,
    [VehicleType.Bike]: <BikeIcon className="w-8 h-8 text-green-400" />,
};
const defaultVehicleIcon = <OtherVehicleIcon className="w-8 h-8 text-gray-400" />;


type View = 'dashboard' | 'vehicleList' | 'vehicleDetail';

// Helper components defined outside App to prevent re-renders
const AddVehicleModal: React.FC<{ isOpen: boolean; onClose: () => void; onAddVehicle: (vehicle: Omit<Vehicle, 'id' | 'documents' | 'emis' | 'archivedDocuments'>) => void; }> = ({ isOpen, onClose, onAddVehicle }) => {
    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const [regNum, setRegNum] = useState('');
    const [type, setType] = useState<string>(VehicleType.Car);
    const [customType, setCustomType] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalType = type === VehicleType.Other ? customType : type;
        if (!make || !model || !regNum || !finalType) return;
        onAddVehicle({ make, model, registrationNumber: regNum.toUpperCase(), type: finalType });
        setMake(''); setModel(''); setRegNum(''); setType(VehicleType.Car); setCustomType('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Vehicle">
            <form onSubmit={handleSubmit} className="space-y-4">
                <select value={type} onChange={e => setType(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded">
                    {Object.values(VehicleType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {type === VehicleType.Other && (
                     <input type="text" placeholder="Custom Vehicle Type" value={customType} onChange={e => setCustomType(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                )}
                <input type="text" placeholder="Make (e.g., Honda)" value={make} onChange={e => setMake(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                <input type="text" placeholder="Model (e.g., Civic)" value={model} onChange={e => setModel(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                <input type="text" placeholder="Registration Number" value={regNum} onChange={e => setRegNum(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 p-2 rounded text-white font-bold">Add Vehicle</button>
            </form>
        </Modal>
    );
};

const EmiFormModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    onSubmit: (emi: Omit<Emi, 'id'>, existingId?: string) => void;
    initialData?: Emi | null;
}> = ({ isOpen, onClose, onSubmit, initialData }) => {
    const [amount, setAmount] = useState('');
    const [startDate, setStartDate] = useState('');
    const [totalTenure, setTotalTenure] = useState('');
    const [principal, setPrincipal] = useState('');
    const [interest, setInterest] = useState('');
    const [provider, setProvider] = useState('');
    const [loanId, setLoanId] = useState('');
    const [bank, setBank] = useState('');
    const [calculatedEndDate, setCalculatedEndDate] = useState<string | null>(null);
    const [paidTillDate, setPaidTillDate] = useState('');
    
    const isEditing = !!initialData;

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setAmount(String(initialData.amount));
                setStartDate(initialData.startDate);
                setTotalTenure(String(initialData.totalTenure));
                setPrincipal(String(initialData.principalAmount || ''));
                setInterest(String(initialData.interestRate || ''));
                setProvider(initialData.loanProvider || '');
                setLoanId(initialData.loanId || '');
                setBank(initialData.emiBank || '');
                // Note: We don't pre-fill paidTillDate as it's a one-time calculation tool
            }
        } else {
            // Reset form when modal closes
            setAmount(''); setStartDate(''); setTotalTenure(''); setPrincipal('');
            setInterest(''); setProvider(''); setLoanId(''); setBank('');
            setCalculatedEndDate(null); setPaidTillDate('');
        }
    }, [isOpen, initialData]);

    useEffect(() => {
        if (startDate && totalTenure) {
            const tenureNum = parseInt(totalTenure, 10);
            if (!isNaN(tenureNum) && tenureNum > 0) {
                const start = new Date(startDate);
                const end = new Date(start.getFullYear(), start.getMonth() + tenureNum, start.getDate());
                setCalculatedEndDate(end.toLocaleDateString());
            } else {
                setCalculatedEndDate(null);
            }
        } else {
            setCalculatedEndDate(null);
        }
    }, [startDate, totalTenure]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        let paidCount = initialData?.paidInstallments || 0;
        const tenureNum = parseInt(totalTenure, 10);
        
        // Recalculate paid installments only if paidTillDate is provided by the user
        if (startDate && paidTillDate && tenureNum > 0) {
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
            principalAmount: principal ? parseFloat(principal) : undefined,
            interestRate: interest ? parseFloat(interest) : undefined,
            loanProvider: provider || undefined,
            loanId: loanId || undefined,
            emiBank: bank || undefined,
        }, initialData?.id);
        onClose();
    };

    const totalAmount = (parseFloat(amount) || 0) * (parseInt(totalTenure, 10) || 0);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit EMI Details' : 'Add EMI Details'}>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                <input type="number" placeholder="EMI Amount" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                <input type="number" placeholder="Total Tenure (months)" value={totalTenure} onChange={e => setTotalTenure(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                
                {totalAmount > 0 && <div className="p-2 bg-slate-700/50 rounded text-center">
                    <span className="text-sm text-slate-400">Total Repayment: </span>
                    <span className="font-bold text-white">₹{totalAmount.toLocaleString()}</span>
                </div>}
                
                <div>
                    <label className="text-sm text-slate-400">EMI Start Date</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                </div>

                {calculatedEndDate && (
                    <div className="p-2 bg-slate-700/50 rounded text-center">
                        <span className="text-sm text-slate-400">Calculated Loan End Date: </span>
                        <span className="font-bold text-white">{calculatedEndDate}</span>
                    </div>
                )}
                
                <hr className="border-slate-700" />
                <h3 className="text-center text-slate-400 text-sm font-semibold pt-2">Optional Details</h3>

                <div>
                    <label className="text-sm text-slate-400">Paid Till Date</label>
                    <p className="text-xs text-slate-500 mb-1">Select the last paid date to calculate paid installments. Use this if you're adding an old loan or need to correct the paid count.</p>
                    <input type="date" value={paidTillDate} onChange={e => setPaidTillDate(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                </div>

                <input type="number" placeholder="Principal Amount" value={principal} onChange={e => setPrincipal(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                <input type="number" step="0.01" placeholder="Interest Rate (%)" value={interest} onChange={e => setInterest(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                <input type="text" placeholder="Loan Provider" value={provider} onChange={e => setProvider(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                <input type="text" placeholder="Loan ID" value={loanId} onChange={e => setLoanId(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                <input type="text" placeholder="EMI Bank" value={bank} onChange={e => setBank(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 p-2 rounded text-white font-bold !mt-6">{isEditing ? 'Save Changes' : 'Add EMI'}</button>
            </form>
        </Modal>
    );
};


const AddDocModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    onAddDoc: (doc: Omit<Document, 'id'>) => void;
    initialDocName?: string;
}> = ({ isOpen, onClose, onAddDoc, initialDocName }) => {
    // FIX: The `docName` state was incorrectly inferred as a single string literal.
    // By providing a generic type, we allow it to be any of the predefined document names, fixing multiple type errors.
    const [docName, setDocName] = useState<(typeof PREDEFINED_DOC_NAMES)[number]>(PREDEFINED_DOC_NAMES[0]);
    const [customDocName, setCustomDocName] = useState('');
    const [validFrom, setValidFrom] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [fileData, setFileData] = useState<string | undefined>();
    const [fileName, setFileName] = useState<string | undefined>();

    const resetForm = () => {
        setDocName(PREDEFINED_DOC_NAMES[0]);
        setCustomDocName('');
        setValidFrom('');
        setExpiryDate('');
        setFileData(undefined);
        setFileName(undefined);
    };

    useEffect(() => {
        if (isOpen) {
            if (initialDocName) {
                 if (PREDEFINED_DOC_NAMES.includes(initialDocName as any)) {
                    // FIX: Cast the incoming string to the correct union type for the state setter.
                    setDocName(initialDocName as (typeof PREDEFINED_DOC_NAMES)[number]);
                } else {
                    setDocName('Other');
                    setCustomDocName(initialDocName);
                }
            }
        } else {
            resetForm();
        }
    }, [isOpen, initialDocName]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                setFileData(loadEvent.target?.result as string);
                setFileName(file.name);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalDocName = docName === 'Other' ? customDocName : docName;
        if (!finalDocName || !expiryDate || !validFrom) return;
        onAddDoc({ name: finalDocName, validFrom, expiryDate, fileData, fileName });
        onClose();
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Document">
            <form onSubmit={handleSubmit} className="space-y-4">
                 {/* FIX: Cast the select's string value to the correct union type on change. */}
                 <select value={docName} onChange={e => setDocName(e.target.value as (typeof PREDEFINED_DOC_NAMES)[number])} className="w-full p-2 bg-slate-700 border border-slate-600 rounded">
                    {PREDEFINED_DOC_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                {docName === 'Other' && <input type="text" placeholder="Custom Document Name" value={customDocName} onChange={e => setCustomDocName(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />}
                <div>
                    <label className="text-sm text-slate-400">Valid From</label>
                    <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                </div>
                 <div>
                    <label className="text-sm text-slate-400">Valid Till (Expiry Date)</label>
                    <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Upload Document (Optional)</label>
                    <input type="file" onChange={handleFileChange} className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-500 file:text-white hover:file:bg-indigo-600" />
                    {fileName && <p className="text-xs text-green-400 mt-1">File selected: {fileName}</p>}
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 p-2 rounded text-white font-bold">Add Document</button>
            </form>
        </Modal>
    );
};

const VehicleList: React.FC<{ vehicles: Vehicle[], onSelectVehicle: (id: string) => void, onAddVehicleClick: () => void }> = ({ vehicles, onSelectVehicle, onAddVehicleClick }) => (
    <div className="p-4 md:p-6">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-indigo-400">My Vehicles</h1>
            <button onClick={onAddVehicleClick} className="bg-indigo-600 hover:bg-indigo-700 p-2 rounded-full text-white">
                <PlusIcon className="w-6 h-6" />
            </button>
        </div>
        {vehicles.length === 0 ? (
             <div className="text-center py-16 bg-slate-800 rounded-lg">
                <p className="text-slate-400">No vehicles found.</p>
                <button onClick={onAddVehicleClick} className="mt-4 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors">Add your first vehicle</button>
            </div>
        ) : (
            <div className="space-y-4">
            {vehicles.map(v => (
                <div key={v.id} onClick={() => onSelectVehicle(v.id)} className="bg-slate-800 p-4 rounded-lg flex items-center justify-between cursor-pointer hover:bg-slate-700 transition-colors">
                    <div className="flex items-center space-x-4">
                        {vehicleTypeIcons[v.type] || defaultVehicleIcon}
                        <div>
                            <p className="font-bold text-lg">{v.make} {v.model}</p>
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
    onSaveEmi: (emi: Omit<Emi, 'id'>, existingId?: string) => void;
    onAddDoc: (doc: Omit<Document, 'id'>, replacingDocId?: string) => void;
    onMarkEmiPaid: (emiId: string) => void;
    onSettleEmi: (emiId: string) => void;
    onEditEmiClick: (emi: Emi) => void;
}> = ({ vehicle, onBack, onSaveEmi, onAddDoc, onMarkEmiPaid, onSettleEmi, onEditEmiClick }) => {
    const [isDocModalOpen, setDocModalOpen] = useState(false);
    const [docToReplace, setDocToReplace] = useState<Document | null>(null);

    const handleRenewClick = (doc: Document) => {
        setDocToReplace(doc);
        setDocModalOpen(true);
    };

    const handleAddDocClick = () => {
        setDocToReplace(null);
        setDocModalOpen(true);
    };
    
    const handleDocModalClose = () => {
        setDocModalOpen(false);
        setDocToReplace(null);
    };

    const handleDocSubmit = (docData: Omit<Document, 'id'>) => {
        onAddDoc(docData, docToReplace?.id);
    };

    const groupDocsByYear = (docs: Document[]) => {
        return docs.reduce((acc, doc) => {
            const year = new Date(doc.expiryDate).getFullYear();
            if (!acc[year]) {
                acc[year] = [];
            }
            acc[year].push(doc);
            return acc;
        }, {} as Record<string, Document[]>);
    };
    const archivedDocsByYear = groupDocsByYear(vehicle.archivedDocuments || []);

    return (
        <div className="p-4 md:p-6">
            <button onClick={onBack} className="flex items-center space-x-2 text-indigo-400 mb-4">
                <ArrowLeftIcon className="w-6 h-6" />
                <span>All Vehicles</span>
            </button>
            <div className="bg-slate-800 p-4 rounded-lg flex items-center space-x-4 mb-6">
                {vehicleTypeIcons[vehicle.type] || defaultVehicleIcon}
                <div>
                    <h1 className="text-2xl font-bold">{vehicle.make} {vehicle.model}</h1>
                    <p className="text-slate-400">{vehicle.registrationNumber}</p>
                </div>
            </div>

            {/* EMIs Section */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xl font-bold text-cyan-400">EMIs</h2>
                    <button onClick={() => onEditEmiClick(null!)} className="bg-cyan-600 hover:bg-cyan-700 p-2 rounded-full text-white">
                        <PlusIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="space-y-3">
                    {vehicle.emis.map(emi => {
                        const isFullyPaid = emi.paidInstallments >= emi.totalTenure;
                        const remainingAmount = (emi.totalTenure - emi.paidInstallments) * emi.amount;
                        
                        const startDate = new Date(emi.startDate);
                        const nextDueDate = new Date(startDate.getFullYear(), startDate.getMonth() + emi.paidInstallments, startDate.getDate());
                        const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + emi.totalTenure, startDate.getDate());

                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const isBeforeToday = nextDueDate < today;
                        const monthsDiff = (nextDueDate.getFullYear() - today.getFullYear()) * 12 + nextDueDate.getMonth() - today.getMonth();
                        const isPayAllowed = isBeforeToday || monthsDiff <= 1;

                        return (
                        <div key={emi.id} className={`bg-slate-800/50 p-4 rounded-lg relative ${isFullyPaid ? 'opacity-60' : ''}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold text-xl text-white">₹ {emi.amount.toLocaleString()}</p>
                                    <p className={`text-sm ${isFullyPaid ? 'text-green-400' : 'text-slate-300'}`}>
                                        {isFullyPaid ? 'Fully Paid' : `Next Due: ${nextDueDate.toLocaleDateString()}`}
                                    </p>
                                    <p className="text-xs text-slate-400">Ends on: {endDate.toLocaleDateString()}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs bg-cyan-900/50 text-cyan-300 px-2 py-1 rounded-full">{emi.paidInstallments} / {emi.totalTenure} paid</span>
                                    {!isFullyPaid && <p className="text-sm font-semibold text-amber-400 mt-1">₹{remainingAmount.toLocaleString()} left</p>}
                                </div>
                            </div>
                            
                             {(emi.loanProvider || emi.emiBank || emi.loanId) && (
                                <div className="mt-4 pt-3 border-t border-slate-700/50 text-sm text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                                    {emi.loanProvider && <div><span className="font-semibold">Provider:</span> {emi.loanProvider}</div>}
                                    {emi.emiBank && <div><span className="font-semibold">Bank:</span> {emi.emiBank}</div>}
                                    {emi.loanId && <div><span className="font-semibold">Loan ID:</span> {emi.loanId}</div>}
                                </div>
                            )}
                            {!isFullyPaid && (
                                <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center gap-2">
                                    <button 
                                        onClick={() => onMarkEmiPaid(emi.id)} 
                                        className="flex-grow bg-green-600 hover:bg-green-700 p-2 rounded text-white font-bold text-sm disabled:bg-slate-600 disabled:cursor-not-allowed"
                                        disabled={!isPayAllowed}
                                    >
                                        Mark as Paid
                                    </button>
                                     <button 
                                        onClick={() => onSettleEmi(emi.id)} 
                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 p-2 rounded text-white font-bold text-sm"
                                        title="Settle Loan"
                                    >
                                        <CheckCircleIcon className="w-5 h-5"/>
                                        <span>Settle</span>
                                    </button>
                                </div>
                            )}
                             {!isFullyPaid && (
                                <button 
                                    onClick={() => onEditEmiClick(emi)}
                                    className="absolute bottom-1 right-1 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-700 transition-colors"
                                    aria-label="Edit EMI"
                                >
                                    <EditIcon className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    )})}
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
                        const today = new Date(); today.setHours(0,0,0,0);
                        const isExpired = new Date(doc.expiryDate) < today;
                        return (
                            <div key={doc.id} className={`bg-slate-800/50 p-3 rounded-lg flex justify-between items-center ${isExpired ? 'border border-red-500/50' : ''}`}>
                                <div>
                                   <p className={`font-semibold ${isExpired ? 'text-red-400' : ''}`}>{doc.name}</p>
                                    <p className="text-sm text-slate-300">
                                        Valid: {new Date(doc.validFrom).toLocaleDateString()} to {new Date(doc.expiryDate).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {isExpired && <button onClick={() => handleRenewClick(doc)} className="text-sm bg-amber-600 hover:bg-amber-700 text-white font-semibold py-1 px-3 rounded-full">Renew</button>}
                                    {doc.fileData && (
                                        <a href={doc.fileData} download={doc.fileName} className="text-indigo-400 hover:text-indigo-300 p-2 rounded-full">
                                            <DownloadIcon className="w-5 h-5" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {vehicle.documents.length === 0 && <p className="text-slate-500 text-center py-4">No documents added.</p>}
                </div>
            </div>
            
             {/* Archived Documents Section */}
            {(vehicle.archivedDocuments && vehicle.archivedDocuments.length > 0) && (
                <div>
                    <details className="bg-slate-800/30 rounded-lg">
                        <summary className="text-lg font-bold text-slate-400 p-4 cursor-pointer">Archived Documents ({vehicle.archivedDocuments.length})</summary>
                        <div className="p-4 border-t border-slate-700 space-y-4">
                        {Object.keys(archivedDocsByYear).sort((a,b) => parseInt(b) - parseInt(a)).map(year => (
                            <div key={year}>
                                <h4 className="font-bold text-indigo-400 mb-2">{year} Archives</h4>
                                <div className="space-y-2">
                                    {archivedDocsByYear[year].map(doc => (
                                         <div key={doc.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                                            <div>
                                               <p className="font-semibold text-slate-400">{doc.name}</p>
                                                <p className="text-sm text-slate-500">Expired: {new Date(doc.expiryDate).toLocaleDateString()}</p>
                                            </div>
                                            {doc.fileData && (
                                                <a href={doc.fileData} download={doc.fileName} className="text-indigo-500 hover:text-indigo-400 p-2 rounded-full">
                                                    <DownloadIcon className="w-5 h-5" />
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        </div>
                    </details>
                </div>
            )}
            
            <AddDocModal isOpen={isDocModalOpen} onClose={handleDocModalClose} onAddDoc={handleDocSubmit} initialDocName={docToReplace?.name} />
        </div>
    );
};

const App: React.FC = () => {
    const [vehicles, setVehicles] = useLocalStorage<Vehicle[]>('vehicles', []);
    const [snoozed, setSnoozed] = useLocalStorage<Record<string, number>>('snoozedReminders', {});
    const [view, setView] = useState<View>('dashboard');
    const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
    const [isAddVehicleModalOpen, setAddVehicleModalOpen] = useState(false);
    const [isEmiModalOpen, setEmiModalOpen] = useState(false);
    const [editingEmi, setEditingEmi] = useState<Emi | null>(null);
    const [installPrompt, setInstallPrompt] = useState<any>(null);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js')
                    .then(registration => {
                        console.log('Service Worker registered with scope:', registration.scope);
                    })
                    .catch(error => {
                        console.error('Service Worker registration failed:', error);
                    });
            });
        }
    }, []);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    useEffect(() => {
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        const alarmInterval = setInterval(() => {
             if (Notification.permission !== 'granted') return;

            const now = new Date();
            const nowTimestamp = now.getTime();
            const hours = now.getHours();
            const minutes = now.getMinutes();

            const isSameDay = (d1: Date, d2: Date) => 
                d1.getFullYear() === d2.getFullYear() && 
                d1.getMonth() === d2.getMonth() && 
                d1.getDate() === d2.getDate();

            const checkAndSendNotification = (item: Emi | Document, vehicle: Vehicle, date: Date, time: [number, number], message: string, tag: string) => {
                if (isSameDay(now, date) && hours === time[0] && minutes === time[1]) {
                    const key = `notif_${tag}_${date.toISOString().split('T')[0]}_${time[0]}-${time[1]}`;
                    if (!sessionStorage.getItem(key)) {
                        new Notification('Vehicle Reminder', { body: message, tag: tag });
                        sessionStorage.setItem(key, 'true');
                    }
                }
            };
            
            vehicles.forEach(vehicle => {
                // EMI Notifications
                vehicle.emis.forEach(emi => {
                    const snoozedUntil = snoozed[emi.id];
                    if (snoozedUntil && nowTimestamp < snoozedUntil) return;
                    if (emi.paidInstallments >= emi.totalTenure) return;

                    const startDate = new Date(emi.startDate);
                    const nextDueDate = new Date(startDate.getFullYear(), startDate.getMonth() + emi.paidInstallments, startDate.getDate());
                    
                    const dayBeforeDueDate = new Date(nextDueDate);
                    dayBeforeDueDate.setDate(nextDueDate.getDate() - 1);
                    
                    const dayBeforeMsg = `${vehicle.make} ${vehicle.model} EMI of ₹${emi.amount.toLocaleString()} is due tomorrow.`;
                    checkAndSendNotification(emi, vehicle, dayBeforeDueDate, [11, 15], dayBeforeMsg, emi.id);
                    checkAndSendNotification(emi, vehicle, dayBeforeDueDate, [16, 15], dayBeforeMsg, emi.id);
                    checkAndSendNotification(emi, vehicle, dayBeforeDueDate, [21, 30], dayBeforeMsg, emi.id);

                    const dueDateMsg = `Reminder: ${vehicle.make} ${vehicle.model} EMI of ₹${emi.amount.toLocaleString()} is due TODAY!`;
                    checkAndSendNotification(emi, vehicle, nextDueDate, [11, 15], dueDateMsg, emi.id);
                    checkAndSendNotification(emi, vehicle, nextDueDate, [21, 30], dueDateMsg, emi.id);
                    
                    if (isSameDay(now, nextDueDate) && hours >= 16 && hours < 22 && minutes === 15) {
                        const snoozeKey = `notif_snooze_${emi.id}_${nextDueDate.toISOString().split('T')[0]}_${hours}-${minutes}`;
                         if (!sessionStorage.getItem(snoozeKey)) {
                            const message = `URGENT: Your EMI of ₹${emi.amount.toLocaleString()} for ${vehicle.make} is due today. Please pay now.`;
                            new Notification('EMI Payment Due', { body: message, tag: emi.id });
                            sessionStorage.setItem(snoozeKey, 'true');
                         }
                    }
                });

                // Document Notifications
                vehicle.documents.forEach(doc => {
                    const snoozedUntil = snoozed[doc.id];
                    if (snoozedUntil && nowTimestamp < snoozedUntil) return;

                    const expiryDate = new Date(doc.expiryDate);
                    const threeDaysBefore = new Date(expiryDate);
                    threeDaysBefore.setDate(expiryDate.getDate() - 3);
                    const oneDayBefore = new Date(expiryDate);
                    oneDayBefore.setDate(expiryDate.getDate() - 1);

                    const threeDayMsg = `${vehicle.make} ${vehicle.model}'s ${doc.name} will expire in 3 days on ${expiryDate.toLocaleDateString()}.`;
                    checkAndSendNotification(doc, vehicle, threeDaysBefore, [9, 0], threeDayMsg, doc.id);

                    const oneDayMsg = `URGENT: Your ${doc.name} for ${vehicle.make} expires tomorrow! Please renew it today.`;
                    checkAndSendNotification(doc, vehicle, oneDayBefore, [9, 0], oneDayMsg, doc.id);
                });
            });

        }, 60000); // Check every minute

        return () => clearInterval(alarmInterval);
    }, [vehicles, snoozed]);


    const handleAddVehicle = (vehicleData: Omit<Vehicle, 'id' | 'documents' | 'emis' | 'archivedDocuments'>) => {
        const newVehicle: Vehicle = {
            ...vehicleData,
            id: crypto.randomUUID(),
            documents: [],
            emis: [],
            archivedDocuments: []
        };
        setVehicles(prev => [...prev, newVehicle]);
    };

    const handleSelectVehicle = (id: string) => {
        setSelectedVehicleId(id);
        setView('vehicleDetail');
    };
    
    const handleViewVehicleFromDashboard = (id: string) => {
        setSelectedVehicleId(id);
        setView('vehicleDetail');
    }

    const updateVehicle = (id: string, updateFn: (vehicle: Vehicle) => Vehicle) => {
        setVehicles(prev => prev.map(v => v.id === id ? updateFn(v) : v));
    }

    const handleSaveEmi = (emiData: Omit<Emi, 'id'>, existingId?: string) => {
        if (!selectedVehicleId) return;

        if (existingId) { // Update existing EMI
            const updatedEmi = { ...emiData, id: existingId };
            updateVehicle(selectedVehicleId, v => ({
                ...v,
                emis: v.emis.map(e => e.id === existingId ? updatedEmi : e)
            }));
        } else { // Add new EMI
            const newEmi: Emi = { 
                ...emiData, 
                id: crypto.randomUUID(), 
            };
            updateVehicle(selectedVehicleId, v => ({...v, emis: [...v.emis, newEmi]}));
        }
    };
    
    const handleMarkEmiPaid = (emiId: string) => {
        if (!selectedVehicleId) return;
        updateVehicle(selectedVehicleId, v => {
            const updatedEmis = v.emis.map(emi => {
                if (emi.id === emiId && emi.paidInstallments < emi.totalTenure) {
                    return { ...emi, paidInstallments: emi.paidInstallments + 1 };
                }
                return emi;
            });
            return { ...v, emis: updatedEmis };
        });
    };

    const handleSettleEmi = (emiId: string) => {
        if (!selectedVehicleId) return;
        updateVehicle(selectedVehicleId, v => {
            const updatedEmis = v.emis.map(emi => {
                if (emi.id === emiId) {
                    return { ...emi, paidInstallments: emi.totalTenure };
                }
                return emi;
            });
            return { ...v, emis: updatedEmis };
        });
    };

    const handleAddDoc = (docData: Omit<Document, 'id'>, replacingDocId?: string) => {
        if (!selectedVehicleId) return;
        const newDoc: Document = { ...docData, id: crypto.randomUUID() };
        
        updateVehicle(selectedVehicleId, v => {
            let newDocuments = [...v.documents];
            let newArchivedDocuments = [...(v.archivedDocuments || [])];

            if (replacingDocId) {
                const docToArchive = newDocuments.find(d => d.id === replacingDocId);
                if (docToArchive) {
                    newArchivedDocuments.push(docToArchive);
                    newDocuments = newDocuments.filter(d => d.id !== replacingDocId);
                }
            }
            
            newDocuments.push(newDoc);

            return { ...v, documents: newDocuments, archivedDocuments: newArchivedDocuments };
        });
    };
    
    const handleOpenEmiModal = (emi: Emi | null) => {
        setEditingEmi(emi);
        setEmiModalOpen(true);
    };

    const handleSnoozeItem = (itemId: string) => {
        // Snooze for 1 day
        const snoozedUntil = Date.now() + 24 * 60 * 60 * 1000;
        setSnoozed(prev => ({ ...prev, [itemId]: snoozedUntil }));
    };

    const handleInstallClick = async () => {
        if (!installPrompt) {
            return;
        }
        await installPrompt.prompt();
        setInstallPrompt(null);
    };

    const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
    
    const renderContent = () => {
        switch (view) {
            case 'dashboard':
                return <Dashboard vehicles={vehicles} onViewVehicle={handleViewVehicleFromDashboard} snoozed={snoozed} onSnoozeItem={handleSnoozeItem} />;
            case 'vehicleList':
                return <VehicleList vehicles={vehicles} onSelectVehicle={handleSelectVehicle} onAddVehicleClick={() => setAddVehicleModalOpen(true)} />;
            case 'vehicleDetail':
                return selectedVehicle ? <VehicleDetail vehicle={selectedVehicle} onBack={() => setView('vehicleList')} onSaveEmi={handleSaveEmi} onAddDoc={handleAddDoc} onMarkEmiPaid={handleMarkEmiPaid} onSettleEmi={handleSettleEmi} onEditEmiClick={handleOpenEmiModal} /> : <VehicleList vehicles={vehicles} onSelectVehicle={handleSelectVehicle} onAddVehicleClick={() => setAddVehicleModalOpen(true)} />;
            default:
                return <Dashboard vehicles={vehicles} onViewVehicle={handleViewVehicleFromDashboard} snoozed={snoozed} onSnoozeItem={handleSnoozeItem} />;
        }
    }
    
    const NavButton: React.FC<{ activeView: View, targetView: View, setView: (v: View) => void, icon: React.ReactNode, label: string }> = ({ activeView, targetView, setView, icon, label }) => (
        <button onClick={() => setView(targetView)} className={`flex flex-col items-center justify-center space-y-1 w-full p-2 rounded-md ${activeView === targetView ? 'text-indigo-400' : 'text-slate-400 hover:text-indigo-300'}`}>
            {icon}
            <span className="text-xs">{label}</span>
        </button>
    );

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col">
            <header className="relative bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10 p-4 border-b border-slate-700 text-center">
                <h1 className="text-2xl font-bold text-indigo-400">Due Guardian</h1>
                <p className="text-sm text-slate-400">Your guardian for every due date.</p>
                {installPrompt && (
                    <button
                        onClick={handleInstallClick}
                        className="absolute top-1/2 right-4 transform -translate-y-1/2 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors text-sm"
                        title="Install App"
                    >
                        <DownloadIcon className="w-5 h-5" />
                        <span>Install</span>
                    </button>
                )}
            </header>
            
            <main className="flex-grow pb-20">
                {renderContent()}
            </main>

            <AddVehicleModal isOpen={isAddVehicleModalOpen} onClose={() => setAddVehicleModalOpen(false)} onAddVehicle={handleAddVehicle} />
            <EmiFormModal 
                isOpen={isEmiModalOpen}
                onClose={() => setEmiModalOpen(false)}
                onSubmit={handleSaveEmi}
                initialData={editingEmi}
            />

            <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around p-2 z-10">
                <NavButton activeView={view} targetView="dashboard" setView={setView} icon={<DashboardIcon className="w-6 h-6" />} label="Dashboard" />
                <NavButton activeView={view} targetView="vehicleList" setView={setView} icon={<VehicleIcon className="w-6 h-6" />} label="Vehicles" />
            </nav>
            <AddToHomeScreenPrompt />
        </div>
    );
};

export default App;
