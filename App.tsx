
import React, { useState, useEffect } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { Vehicle, VehicleType, Emi, Document, PREDEFINED_DOC_NAMES, EmiPayment } from './types';
import Dashboard from './components/Dashboard';
import Modal from './components/Modal';
import { PlusIcon, ArrowLeftIcon, CarIcon, TruckIcon, MachineIcon, BikeIcon, DashboardIcon, VehicleIcon, DownloadIcon, EditIcon, DeleteIcon, CheckCircleIcon, OtherVehicleIcon } from './components/icons';
import AddToHomeScreenPrompt from './components/AddToHomeScreenPrompt';

const vehicleTypeIcons: Record<string, React.ReactNode> = {
    [VehicleType.Car]: <CarIcon className="w-8 h-8 text-blue-400" />,
    [VehicleType.Truck]: <TruckIcon className="w-8 h-8 text-orange-400" />,
    [VehicleType.Machine]: <MachineIcon className="w-8 h-8 text-yellow-400" />,
    [VehicleType.Bike]: <BikeIcon className="w-8 h-8 text-green-400" />,
};

const getVehicleIcon = (type: string) => {
    return vehicleTypeIcons[type] || <OtherVehicleIcon className="w-8 h-8 text-gray-400" />;
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};


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
    const [interest, setInterest] = useState('');
    const [provider, setProvider] = useState('');
    const [loanId, setLoanId] = useState('');
    const [bank, setBank] = useState('');
    const [calculatedEndDate, setCalculatedEndDate] = useState<string | null>(null);
    const [paidTillDate, setPaidTillDate] = useState('');
    const [totalCost, setTotalCost] = useState('');
    const [downPayment, setDownPayment] = useState('');
    
    const isEditing = !!initialData;

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
                // Note: We don't pre-fill paidTillDate as it's a one-time calculation tool
            }
        } else {
            // Reset form when modal closes
            setAmount(''); setStartDate(''); setTotalTenure('');
            setInterest(''); setProvider(''); setLoanId(''); setBank('');
            setCalculatedEndDate(null); setPaidTillDate('');
            setTotalCost(''); setDownPayment('');
        }
    }, [isOpen, initialData]);

    useEffect(() => {
        if (startDate && totalTenure) {
            const tenureNum = parseInt(totalTenure, 10);
            if (!isNaN(tenureNum) && tenureNum > 0) {
                const start = new Date(startDate);
                const end = new Date(start.getFullYear(), start.getMonth() + tenureNum, start.getDate());
                setCalculatedEndDate(formatDate(end.toISOString()));
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

                <input type="number" placeholder="Total Vehicle Cost" value={totalCost} onChange={e => setTotalCost(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                <input type="number" placeholder="Down Payment" value={downPayment} onChange={e => setDownPayment(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                
                <div>
                    <label className="text-sm text-slate-400">Financed Amount (Auto-Calculated)</label>
                     <input 
                        type="text" 
                        readOnly 
                        value={financedAmount > 0 ? `₹${financedAmount.toLocaleString()}` : ''} 
                        className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-slate-300 cursor-not-allowed"
                        aria-label="Financed Amount"
                    />
                </div>
                
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
    onSave: (doc: Omit<Document, 'id'>, idToUpdate?: string) => void;
    initialData?: Document | null;
    activeDocuments: Document[];
    isRenewing?: boolean;
}> = ({ isOpen, onClose, onSave, initialData, activeDocuments, isRenewing }) => {
    const isEditing = !!initialData && !isRenewing;
    const [docName, setDocName] = useState<(typeof PREDEFINED_DOC_NAMES)[number]>(PREDEFINED_DOC_NAMES[0]);
    const [customDocName, setCustomDocName] = useState('');
    const [validFrom, setValidFrom] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [fileData, setFileData] = useState<string | undefined>();
    const [fileName, setFileName] = useState<string | undefined>();
    const [docNameError, setDocNameError] = useState<string | null>(null);

    const checkExistingDoc = (name: string, editingDocId?: string): boolean => {
        if (!name) {
            setDocNameError(null);
            return true;
        }

        const existingDoc = activeDocuments.find(d => d.name === name && d.id !== editingDocId);

        if (existingDoc) {
            const fiveDaysInMillis = 5 * 24 * 60 * 60 * 1000;
            const expiryTime = new Date(existingDoc.expiryDate).getTime();
            const timeUntilExpiry = expiryTime - Date.now();

            if (timeUntilExpiry > fiveDaysInMillis) {
                setDocNameError(`A valid document named "${name}" already exists. You can renew it when it's closer to expiry.`);
                return false;
            }
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
        setDocName(PREDEFINED_DOC_NAMES[0]);
        setCustomDocName('');
        setValidFrom('');
        setExpiryDate('');
        setFileData(undefined);
        setFileName(undefined);
        setDocNameError(null);
    };

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                const name = initialData.name;
                if (PREDEFINED_DOC_NAMES.includes(name as any)) {
                    setDocName(name as (typeof PREDEFINED_DOC_NAMES)[number]);
                    setCustomDocName('');
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
            }
        } else {
            resetForm();
        }
    }, [isOpen, initialData, isEditing]);

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
                 <select value={docName} onChange={handleDocNameChange} className="w-full p-2 bg-slate-700 border border-slate-600 rounded">
                    {PREDEFINED_DOC_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                {docName === 'Other' && <input type="text" placeholder="Custom Document Name" value={customDocName} onChange={handleCustomDocNameChange} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />}
                {docNameError && <p className="text-sm text-red-400 mt-1">{docNameError}</p>}
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
                <button type="submit" disabled={!!docNameError} className="w-full bg-indigo-600 hover:bg-indigo-700 p-2 rounded text-white font-bold disabled:bg-slate-600 disabled:cursor-not-allowed">
                    {isEditing ? 'Save Changes' : 'Add Document'}
                </button>
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
                        {getVehicleIcon(v.type)}
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
    onAddDoc: (doc: Omit<Document, 'id'>, replacingDocId?: string) => void;
    onUpdateDoc: (docId: string, docData: Omit<Document, 'id'>) => void;
    onDeleteDoc: (doc: Document) => void;
    onMarkEmiPaid: (emiId: string) => void;
    onOpenSettleModal: (emi: Emi) => void;
    onEditEmiClick: (emi: Emi | null) => void;
}> = ({ vehicle, onBack, onAddDoc, onUpdateDoc, onDeleteDoc, onMarkEmiPaid, onOpenSettleModal, onEditEmiClick }) => {
    const [isDocModalOpen, setDocModalOpen] = useState(false);
    const [docToReplace, setDocToReplace] = useState<Document | null>(null);
    const [docToEdit, setDocToEdit] = useState<Document | null>(null);

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
                {getVehicleIcon(vehicle.type)}
                <div>
                    <h1 className="text-2xl font-bold">{vehicle.make} {vehicle.model}</h1>
                    <p className="text-slate-400">{vehicle.registrationNumber}</p>
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
                        
                        const startDate = new Date(emi.startDate);
                        const nextDueDate = new Date(startDate.getFullYear(), startDate.getMonth() + emi.paidInstallments, startDate.getDate());
                        const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + emi.totalTenure, startDate.getDate());

                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const isBeforeToday = nextDueDate < today;
                        const monthsDiff = (nextDueDate.getFullYear() - today.getFullYear()) * 12 + nextDueDate.getMonth() - today.getMonth();
                        const isPayAllowed = isBeforeToday || monthsDiff <= 1;

                        return (
                        <div key={emi.id} className="bg-slate-800/50 p-4 rounded-lg">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold text-xl text-white">₹ {emi.amount.toLocaleString()}</p>
                                    <p className="text-sm text-slate-300">Next Due: {formatDate(nextDueDate.toISOString())}</p>
                                    <p className="text-xs text-slate-400">Ends on: {formatDate(endDate.toISOString())}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs bg-cyan-900/50 text-cyan-300 px-2 py-1 rounded-full">{emi.paidInstallments} / {emi.totalTenure} paid</span>
                                    <p className="text-sm font-semibold text-amber-400 mt-1">₹{remainingAmount.toLocaleString()} left</p>
                                </div>
                            </div>
                            
                             <div className="mt-4 pt-3 border-t border-slate-700/50 text-sm text-slate-400 flex flex-col items-start gap-1">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                    {emi.totalVehicleCost && <div><span className="font-semibold">Total Cost:</span> ₹{emi.totalVehicleCost.toLocaleString()}</div>}
                                    {emi.downPayment && <div><span className="font-semibold">Down Payment:</span> ₹{emi.downPayment.toLocaleString()}</div>}
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
                        const isExpired = expiry < today;
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
                                        <a href={doc.fileData} download={doc.fileName} className="text-indigo-400 hover:text-indigo-300 p-2" title="Download">
                                            <DownloadIcon className="w-5 h-5" />
                                        </a>
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
                                                <p className="text-sm text-slate-500">
                                                    Valid: {formatDate(doc.validFrom)} to {formatDate(doc.expiryDate)}
                                                </p>
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
            
            <AddDocModal 
                isOpen={isDocModalOpen || !!docToEdit} 
                onClose={handleDocModalClose} 
                onSave={handleDocSave} 
                initialData={docToEdit ?? docToReplace}
                isRenewing={!!docToReplace && !docToEdit}
                activeDocuments={vehicle.documents}
            />
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
                    <label className="text-sm text-slate-400">Paid Date</label>
                    <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                </div>
                <div>
                    <label className="text-sm text-slate-400">Bounce Charges (if any)</label>
                    <input type="number" placeholder="Enter amount" value={bounceCharges} onChange={e => setBounceCharges(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className="bg-slate-600 hover:bg-slate-700 p-2 px-4 rounded text-white font-bold">Cancel</button>
                    <button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700 p-2 px-4 rounded text-white font-bold">Confirm</button>
                </div>
            </div>
        </Modal>
    );
};

const TodayPaymentConfirmationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}> = ({ isOpen, onClose, onConfirm }) => (
     <Modal isOpen={isOpen} onClose={onClose} title="Confirm Payment">
        <div className="space-y-4">
            <p className="text-slate-300">Are you sure you want to mark this EMI as paid?</p>
            <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="bg-slate-600 hover:bg-slate-700 p-2 px-4 rounded text-white font-bold">Cancel</button>
                <button onClick={onConfirm} className="bg-green-600 hover:bg-green-700 p-2 px-4 rounded text-white font-bold">Confirm</button>
            </div>
        </div>
    </Modal>
);

const SettleLoanModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (settleAmount: number, settleDate: string) => void;
}> = ({ isOpen, onClose, onSubmit }) => {
    const [settleAmount, setSettleAmount] = useState('');
    const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);

    const handleSubmit = () => {
        if (!settleAmount || !settleDate) return;
        onSubmit(parseFloat(settleAmount), settleDate);
    };

    useEffect(() => {
        if (!isOpen) {
            setSettleAmount('');
            setSettleDate(new Date().toISOString().split('T')[0]);
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Settle Loan">
             <div className="space-y-4">
                <div>
                    <label className="text-sm text-slate-400">Settlement Amount</label>
                    <input type="number" placeholder="Enter final amount" value={settleAmount} onChange={e => setSettleAmount(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                </div>
                <div>
                    <label className="text-sm text-slate-400">Settlement Date</label>
                    <input type="date" value={settleDate} onChange={e => setSettleDate(e.target.value)} className="w-full p-2 bg-slate-700 border border-slate-600 rounded" required />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className="bg-slate-600 hover:bg-slate-700 p-2 px-4 rounded text-white font-bold">Cancel</button>
                    <button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 p-2 px-4 rounded text-white font-bold">Confirm Settlement</button>
                </div>
            </div>
        </Modal>
    )
};

const ConfirmationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    children: React.ReactNode;
}> = ({ isOpen, onClose, onConfirm, title, children }) => {
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="space-y-4">
                <div className="text-slate-300">{children}</div>
                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className="bg-slate-600 hover:bg-slate-700 p-2 px-4 rounded text-white font-bold">Cancel</button>
                    <button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 p-2 px-4 rounded text-white font-bold">Confirm</button>
                </div>
            </div>
        </Modal>
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
    const [isManualInstallModalOpen, setManualInstallModalOpen] = useState(false);
    const [isRunningStandalone, setIsRunningStandalone] = useState(false);
    const [paymentModalData, setPaymentModalData] = useState<{emi: Emi, vehicleId: string, type: 'overdue' | 'today'} | null>(null);
    const [settleModalData, setSettleModalData] = useState<{emi: Emi, vehicleId: string} | null>(null);
    const [docToDelete, setDocToDelete] = useState<{ vehicleId: string; doc: Document } | null>(null);


    useEffect(() => {
        // Check if running as a PWA
        setIsRunningStandalone(window.matchMedia('(display-mode: standalone)').matches);
        
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
                    
                    const dateString = dayBeforeDueDate.toISOString().split('T')[0];

                    if (isSameDay(now, dayBeforeDueDate)) {
                        const vehicleName = `${vehicle.make} ${vehicle.model}`;
                        // 10:15 AM "Sweet Alarm"
                        if (hours === 10 && minutes === 15) {
                            const key = `notif_sent_1015_${emi.id}_${dateString}`;
                            if (!sessionStorage.getItem(key)) {
                                const message = `Your EMI of ₹${emi.amount.toLocaleString()} for ${vehicleName} is due tomorrow.`;
                                new Notification('EMI Reminder', { body: message, tag: emi.id });
                                sessionStorage.setItem(key, 'true');
                            }
                        }

                        // 9:30 PM "Important Alarm"
                        if (hours === 21 && minutes === 30) {
                             const key = `notif_sent_2130_${emi.id}_${dateString}`;
                             if (!sessionStorage.getItem(key)) {
                                const message = `URGENT: Your EMI for ${vehicleName} is due tomorrow. Please ensure funds are available.`;
                                new Notification('Final EMI Reminder', { body: message, tag: emi.id });
                                sessionStorage.setItem(key, 'true');
                            }
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

                    const dateString = now.toISOString().split('T')[0];

                    if (isSameDay(now, threeDaysBefore) && hours === 9 && minutes === 0) {
                        const key = `notif_doc_3d_${doc.id}_${dateString}`;
                         if (!sessionStorage.getItem(key)) {
                            const message = `${vehicle.make} ${vehicle.model}'s ${doc.name} will expire in 3 days.`;
                            new Notification('Document Expiry Reminder', { body: message, tag: doc.id });
                            sessionStorage.setItem(key, 'true');
                        }
                    }

                    if (isSameDay(now, oneDayBefore) && hours === 9 && minutes === 0) {
                        const key = `notif_doc_1d_${doc.id}_${dateString}`;
                         if (!sessionStorage.getItem(key)) {
                            const message = `URGENT: Your ${doc.name} for ${vehicle.make} expires tomorrow!`;
                             new Notification('Document Expiry URGENT', { body: message, tag: doc.id });
                             sessionStorage.setItem(key, 'true');
                        }
                    }
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
            updateVehicle(selectedVehicleId, v => ({
                ...v,
                emis: v.emis.map(e => e.id === existingId ? { ...e, ...emiData } : e)
            }));
        } else { // Add new EMI
            const newEmi: Emi = { 
                ...emiData, 
                id: crypto.randomUUID(),
                paymentHistory: [],
            };
            updateVehicle(selectedVehicleId, v => ({...v, emis: [...v.emis, newEmi]}));
        }
    };
    
    const handleMarkEmiPaid = (emiId: string) => {
        if (!selectedVehicleId) return;
        updateVehicle(selectedVehicleId, v => {
            const updatedEmis = v.emis.map(emi => {
                if (emi.id === emiId && emi.paidInstallments < emi.totalTenure) {
                    const startDate = new Date(emi.startDate);
                    const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + emi.paidInstallments, startDate.getDate());
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    
                    const dueDateNoTime = new Date(dueDate);
                    dueDateNoTime.setHours(0,0,0,0);
                    
                    const status = today > dueDateNoTime ? 'late' : 'on-time';

                    const newPayment: EmiPayment = {
                        dueDate: dueDate.toISOString().split('T')[0],
                        paidDate: today.toISOString().split('T')[0],
                        status: status,
                        amount: emi.amount,
                    };
                    return { 
                        ...emi, 
                        paidInstallments: emi.paidInstallments + 1,
                        lastPaymentDate: today.toISOString().split('T')[0],
                        paymentHistory: [...(emi.paymentHistory || []), newPayment],
                    };
                }
                return emi;
            });
            return { ...v, emis: updatedEmis };
        });
    };

    const handleOpenEmiPaidModal = (emi: Emi, vehicleId: string, type: 'overdue' | 'today') => {
        setSelectedVehicleId(vehicleId); // Ensure correct vehicle is selected for updates
        setPaymentModalData({ emi, vehicleId, type });
    };

    const handleConfirmOverduePayment = (paidDate: string, bounceCharges: number) => {
        if (!paymentModalData) return;
        const { emi, vehicleId } = paymentModalData;
        updateVehicle(vehicleId, v => {
            const updatedEmis = v.emis.map(e => {
                if (e.id === emi.id) {
                    const startDate = new Date(e.startDate);
                    const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + e.paidInstallments, startDate.getDate());
                    const newPayment: EmiPayment = {
                        dueDate: dueDate.toISOString().split('T')[0],
                        paidDate: paidDate,
                        status: 'late',
                        amount: e.amount,
                        bounceCharges: bounceCharges > 0 ? bounceCharges : undefined,
                    };

                    return {
                        ...e,
                        paidInstallments: e.paidInstallments + 1,
                        lastPaymentDate: paidDate,
                        extraCharges: (e.extraCharges || 0) + bounceCharges,
                        paymentHistory: [...(e.paymentHistory || []), newPayment],
                    };
                }
                return e;
            });
            return { ...v, emis: updatedEmis };
        });
        setPaymentModalData(null);
    };
    
    const handleConfirmTodayPayment = () => {
        if (!paymentModalData) return;
        const { emi, vehicleId } = paymentModalData;
        updateVehicle(vehicleId, v => {
            const updatedEmis = v.emis.map(e => {
                if (e.id === emi.id) {
                    const today = new Date().toISOString().split('T')[0];
                    const startDate = new Date(e.startDate);
                    const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + e.paidInstallments, startDate.getDate());
                    const newPayment: EmiPayment = {
                        dueDate: dueDate.toISOString().split('T')[0],
                        paidDate: today,
                        status: 'on-time',
                        amount: e.amount,
                    };

                    return { 
                        ...e, 
                        paidInstallments: e.paidInstallments + 1, 
                        lastPaymentDate: today,
                        paymentHistory: [...(e.paymentHistory || []), newPayment],
                    };
                }
                return e;
            });
            return { ...v, emis: updatedEmis };
        });
        setPaymentModalData(null);
    };

    const handleOpenSettleModal = (emi: Emi) => {
        if (!selectedVehicleId) return;
        setSettleModalData({ emi, vehicleId: selectedVehicleId });
    };

    const handleConfirmSettleLoan = (settleAmount: number, settleDate: string) => {
        if (!settleModalData) return;
        const { emi, vehicleId } = settleModalData;
        updateVehicle(vehicleId, v => {
            const updatedEmis = v.emis.map(e => {
                if (e.id === emi.id) {
                    return {
                        ...e,
                        paidInstallments: e.totalTenure,
                        settlementDetails: { amount: settleAmount, date: settleDate }
                    };
                }
                return e;
            });
            return { ...v, emis: updatedEmis };
        });
        setSettleModalData(null);
    };

    const handleAddDoc = (docData: Omit<Document, 'id'>, replacingDocId?: string) => {
        if (!selectedVehicleId) return;

        updateVehicle(selectedVehicleId, v => {
            const newDoc = { ...docData, id: crypto.randomUUID() };
            let updatedDocs = [...v.documents];
            let updatedArchivedDocs = [...(v.archivedDocuments || [])];
            
            // Find a doc to replace either by the explicit ID (from 'Renew' button)
            // or by finding an existing doc with the same name.
            const docToArchive = updatedDocs.find(d => d.id === replacingDocId || d.name === newDoc.name);
            
            if (docToArchive) {
                updatedArchivedDocs.push(docToArchive);
                updatedDocs = updatedDocs.filter(d => d.id !== docToArchive.id);
            }
            
            updatedDocs.push(newDoc);
            
            // Sort documents by expiry date
            updatedDocs.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

            return { ...v, documents: updatedDocs, archivedDocuments: updatedArchivedDocs };
        });
    };

    const handleUpdateDoc = (docId: string, docData: Omit<Document, 'id'>) => {
        if (!selectedVehicleId) return;
        updateVehicle(selectedVehicleId, v => {
            const updatedDocs = v.documents.map(d => d.id === docId ? { ...d, ...docData } : d);
            updatedDocs.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
            return { ...v, documents: updatedDocs };
        });
    };

    const handleDeleteDoc = (vehicleId: string, docId: string) => {
        updateVehicle(vehicleId, v => ({
            ...v,
            documents: v.documents.filter(d => d.id !== docId)
        }));
    };
    
    const handleSnoozeItem = (itemId: string, minutes?: number) => {
        const now = new Date();
        let snoozeUntil;

        if (minutes) {
             snoozeUntil = new Date(now.getTime() + minutes * 60 * 1000);
        } else {
            snoozeUntil = new Date();
            snoozeUntil.setDate(snoozeUntil.getDate() + 1);
            snoozeUntil.setHours(8, 0, 0, 0); // Snooze until 8 AM tomorrow by default
        }

        setSnoozed(prev => ({
            ...prev,
            [itemId]: snoozeUntil.getTime()
        }));
    };
    
    const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

    const renderContent = () => {
        switch (view) {
            case 'vehicleList':
                return <VehicleList vehicles={vehicles} onSelectVehicle={handleSelectVehicle} onAddVehicleClick={() => setAddVehicleModalOpen(true)} />;
            case 'vehicleDetail':
                if (selectedVehicle) {
                    return <VehicleDetail 
                                vehicle={selectedVehicle} 
                                onBack={() => setView('vehicleList')}
                                onAddDoc={handleAddDoc}
                                onUpdateDoc={handleUpdateDoc}
                                onDeleteDoc={(doc) => setDocToDelete({ vehicleId: selectedVehicle.id, doc })}
                                onMarkEmiPaid={handleMarkEmiPaid}
                                onOpenSettleModal={handleOpenSettleModal}
                                onEditEmiClick={(emi) => {
                                    setEditingEmi(emi);
                                    setEmiModalOpen(true);
                                }}
                            />;
                }
                setView('vehicleList'); // Fallback if vehicle not found
                return null;
            case 'dashboard':
            default:
                return <Dashboard 
                            vehicles={vehicles} 
                            onViewVehicle={handleViewVehicleFromDashboard}
                            snoozed={snoozed}
                            onSnoozeItem={handleSnoozeItem}
                            onMarkEmiPaid={handleOpenEmiPaidModal}
                        />;
        }
    };
    
    return (
        <div className="min-h-screen flex flex-col pb-16">
            <header className="bg-slate-800 shadow-md sticky top-0 z-10">
                 <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <svg className="w-8 h-8 text-indigo-400" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="512" height="512" rx="96" fill="#1E293B" fillOpacity="0"/>
                            <path d="M256 74.6667L96 154.667V256C96 364.533 165.76 430.4 256 448C346.24 430.4 416 364.533 416 256V154.667L256 74.6667Z" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
                            <rect x="181" y="200" width="150" height="120" rx="10" stroke="white" strokeWidth="16"/>
                            <path d="M181 240H331" stroke="white" strokeWidth="16" strokeLinecap="round"/>
                            <path d="M221 180V220" stroke="white" strokeWidth="16" strokeLinecap="round"/>
                            <path d="M291 180V220" stroke="white" strokeWidth="16" strokeLinecap="round"/>
                        </svg>
                        <h1 className="text-xl font-bold text-white">Due Guardian</h1>
                    </div>
                 </div>
            </header>

            <main className="flex-grow max-w-4xl mx-auto w-full">
                {renderContent()}
            </main>

            <nav className="bg-slate-800 shadow-t-md fixed bottom-0 z-10 border-t border-slate-700 w-full">
                <div className="max-w-4xl mx-auto px-4 h-16 flex justify-around items-center">
                    <button onClick={() => setView('dashboard')} className={`flex flex-col items-center space-y-1 ${view === 'dashboard' ? 'text-indigo-400' : 'text-slate-400 hover:text-white'}`}>
                        <DashboardIcon className="w-6 h-6" />
                        <span className="text-xs font-medium">Dashboard</span>
                    </button>
                    <button onClick={() => setView('vehicleList')} className={`flex flex-col items-center space-y-1 ${view === 'vehicleList' || view === 'vehicleDetail' ? 'text-indigo-400' : 'text-slate-400 hover:text-white'}`}>
                        <VehicleIcon className="w-6 h-6" />
                        <span className="text-xs font-medium">Vehicles</span>
                    </button>
                </div>
            </nav>

            <AddVehicleModal isOpen={isAddVehicleModalOpen} onClose={() => setAddVehicleModalOpen(false)} onAddVehicle={handleAddVehicle} />
            
            {selectedVehicleId && (
                <EmiFormModal 
                    isOpen={isEmiModalOpen} 
                    onClose={() => { setEmiModalOpen(false); setEditingEmi(null); }} 
                    onSubmit={handleSaveEmi}
                    initialData={editingEmi}
                />
            )}
            
            {!isRunningStandalone && installPrompt && (
                <div className="fixed bottom-20 right-4 z-50">
                    <button onClick={() => installPrompt.prompt()} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-full shadow-lg flex items-center space-x-2 animate-pulse">
                        <DownloadIcon className="w-5 h-5" />
                        <span>Install App</span>
                    </button>
                </div>
            )}
            
            <AddToHomeScreenPrompt />

            <ManualInstallModal isOpen={isManualInstallModalOpen} onClose={() => setManualInstallModalOpen(false)} />

            <OverduePaymentModal 
                isOpen={paymentModalData?.type === 'overdue'}
                onClose={() => setPaymentModalData(null)}
                onSubmit={handleConfirmOverduePayment}
            />

            <TodayPaymentConfirmationModal 
                isOpen={paymentModalData?.type === 'today'}
                onClose={() => setPaymentModalData(null)}
                onConfirm={handleConfirmTodayPayment}
            />

            {settleModalData && <SettleLoanModal 
                isOpen={!!settleModalData}
                onClose={() => setSettleModalData(null)}
                onSubmit={handleConfirmSettleLoan}
            />}

            <ConfirmationModal
                isOpen={!!docToDelete}
                onClose={() => setDocToDelete(null)}
                onConfirm={() => {
                    if (docToDelete) {
                        handleDeleteDoc(docToDelete.vehicleId, docToDelete.doc.id);
                        setDocToDelete(null);
                    }
                }}
                title="Delete Document"
            >
                Are you sure you want to permanently delete "{docToDelete?.doc.name}"? This action cannot be undone.
            </ConfirmationModal>
        </div>
    );
};

export default App;