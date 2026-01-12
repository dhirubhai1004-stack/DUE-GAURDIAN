
import React, { useState, useMemo } from 'react';
import { Vehicle, VehicleType, PREDEFINED_DOC_NAMES } from '../types';
import { DownloadIcon, EmiIcon, DocumentIcon, ArrowLeftIcon } from './icons';

interface ReportsProps {
  vehicles: Vehicle[];
  userKey: string;
}

type ReportType = 'upcoming' | 'paid'; 
type ReportCategory = 'emi' | 'doc' | null;
type Duration = 7 | 15 | 30 | 60 | 90 | 180 | 365;

const durations: Duration[] = [7, 15, 30, 60, 90, 180, 365];

const formatDate = (date: Date): string => {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

const getVehicleDisplayName = (vehicle: Vehicle) => {
    const loanTypes = [
        VehicleType.PersonalLoan, 
        VehicleType.HomeLoan, 
        VehicleType.BusinessLoan, 
        VehicleType.Overdraft
    ] as string[];

    if (loanTypes.includes(vehicle.type)) {
        return `${vehicle.make} ${vehicle.model}`;
    }
    if (vehicle.type === VehicleType.Truck) {
        return `${vehicle.make} ${vehicle.model}`;
    }
    return `${vehicle.type} - ${vehicle.make} ${vehicle.model}`;
};

const Reports: React.FC<ReportsProps> = ({ vehicles }) => {
    const [category, setCategory] = useState<ReportCategory>(null);
    const [reportType, setReportType] = useState<ReportType>('upcoming');
    const [duration, setDuration] = useState<Duration>(30);
    const [selectedBank, setSelectedBank] = useState<string>('All');
    const [selectedDocType, setSelectedDocType] = useState<string>('All');

    const availableBanks = useMemo(() => {
        const banks = new Set<string>();
        vehicles.forEach(v => {
            v.emis.forEach(e => {
                if (e.emiBank && e.emiBank.trim() !== '') {
                    banks.add(e.emiBank.trim());
                }
            });
        });
        return Array.from(banks).sort();
    }, [vehicles]);

    const availableDocTypes = useMemo(() => {
        const types = new Set<string>(PREDEFINED_DOC_NAMES);
        vehicles.forEach(v => {
            v.documents.forEach(d => types.add(d.name));
        });
        if (types.has('Other')) types.delete('Other');
        return Array.from(types).sort();
    }, [vehicles]);

    const emiData = useMemo(() => {
        if (category !== 'emi') return [];
        const rows: { date: string; dateObj: Date; amount: number; vehicleName: string; regNumber: string; bank: string; total?: number; }[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(today);
        
        if (reportType === 'upcoming') {
            targetDate.setDate(today.getDate() + duration);
        } else {
            targetDate.setDate(today.getDate() - duration);
        }

        vehicles.forEach(vehicle => {
            vehicle.emis.forEach(emi => {
                const bankName = emi.emiBank ? emi.emiBank.trim() : '-';
                if (selectedBank !== 'All' && bankName !== selectedBank) return;

                if (reportType === 'upcoming') {
                    if (emi.paidInstallments < emi.totalTenure) {
                        let [sY, sM, sD] = emi.startDate.split('-').map(Number);
                        if (sY < 100) sY += 2000;
                        for (let i = emi.paidInstallments; i < emi.totalTenure; i++) {
                            const dueDate = new Date(sY, sM - 1 + i, sD);
                            const dueDateMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                            if (dueDateMidnight >= today && dueDateMidnight <= targetDate) {
                                rows.push({ date: formatDate(dueDateMidnight), dateObj: dueDateMidnight, amount: emi.amount, vehicleName: getVehicleDisplayName(vehicle), regNumber: vehicle.registrationNumber, bank: bankName });
                            }
                        }
                    }
                } else {
                    if (emi.paymentHistory) {
                        emi.paymentHistory.forEach(payment => {
                            const paidDate = new Date(payment.paidDate);
                            paidDate.setHours(0,0,0,0);
                            if (paidDate >= targetDate && paidDate <= today) {
                                rows.push({ date: formatDate(paidDate), dateObj: paidDate, amount: payment.amount, vehicleName: getVehicleDisplayName(vehicle), regNumber: vehicle.registrationNumber, bank: bankName });
                            }
                        });
                    }
                }
            });
        });
        rows.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
        let runningTotal = 0;
        return rows.map(row => {
            runningTotal += row.amount;
            return { ...row, total: runningTotal };
        });
    }, [vehicles, reportType, duration, selectedBank, category]);

    const docData = useMemo(() => {
        if (category !== 'doc') return [];
        const rows: { date: string; dateObj: Date; docName: string; vehicleName: string; regNumber: string; }[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(today);

        if (reportType === 'upcoming') {
            targetDate.setDate(today.getDate() + duration);
        } else {
            targetDate.setDate(today.getDate() - duration);
        }

        vehicles.forEach(vehicle => {
            vehicle.documents.forEach(doc => {
                if (selectedDocType !== 'All' && doc.name !== selectedDocType) return;
                const expiryDate = new Date(doc.expiryDate);
                const expiryDateMidnight = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
                if (reportType === 'upcoming') {
                    if (expiryDateMidnight >= today && expiryDateMidnight <= targetDate) {
                        rows.push({ date: formatDate(expiryDateMidnight), dateObj: expiryDateMidnight, docName: doc.name, vehicleName: getVehicleDisplayName(vehicle), regNumber: vehicle.registrationNumber });
                    }
                } else {
                    if (expiryDateMidnight >= targetDate && expiryDateMidnight < today) {
                         rows.push({ date: formatDate(expiryDateMidnight), dateObj: expiryDateMidnight, docName: doc.name, vehicleName: getVehicleDisplayName(vehicle), regNumber: vehicle.registrationNumber });
                    }
                }
            });
        });
        rows.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
        return rows;
    }, [vehicles, reportType, duration, selectedDocType, category]);

    if (!category) {
        return (
            <div className="p-4 md:p-6 pb-24 flex flex-col items-center justify-center min-h-[60vh]">
                 <h1 className="text-3xl font-bold text-indigo-400 mb-8">Generate Report</h1>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                     <button onClick={() => setCategory('emi')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500 rounded-xl p-8 flex flex-col items-center text-center transition-all group">
                        <div className="bg-indigo-900/50 p-4 rounded-full mb-4 group-hover:bg-indigo-600 transition-colors"><EmiIcon className="w-12 h-12 text-indigo-400 group-hover:text-white" /></div>
                        <h2 className="text-xl font-bold text-white mb-2">EMI Report</h2>
                        <p className="text-slate-400 text-sm">Reports for installments and payment history.</p>
                     </button>
                     <button onClick={() => setCategory('doc')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-purple-500 rounded-xl p-8 flex flex-col items-center text-center transition-all group">
                        <div className="bg-purple-900/50 p-4 rounded-full mb-4 group-hover:bg-purple-600 transition-colors"><DocumentIcon className="w-12 h-12 text-purple-400 group-hover:text-white" /></div>
                        <h2 className="text-xl font-bold text-white mb-2">Document Report</h2>
                        <p className="text-slate-400 text-sm">RC, Insurance, PUC and other certificate expiries.</p>
                     </button>
                 </div>
            </div>
        );
    }

    const durationLabel = reportType === 'upcoming' ? 'Next' : 'Last';

    return (
        <div className="p-4 md:p-6 pb-24">
            <div className="flex items-center gap-2 mb-6">
                <button onClick={() => setCategory(null)} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-700">
                    <ArrowLeftIcon className="w-6 h-6" />
                </button>
                <h1 className="text-3xl font-bold text-indigo-400">{category === 'emi' ? 'EMI Reports' : 'Document Reports'}</h1>
            </div>
            
            <div className="bg-slate-800 p-4 rounded-lg mb-6 shadow-lg border border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Report Type</label>
                        <div className="flex bg-slate-700 rounded-lg p-1">
                            <button 
                                onClick={() => setReportType('upcoming')}
                                className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all ${reportType === 'upcoming' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            >
                                {category === 'emi' ? 'Upcoming' : 'Expiring Soon'}
                            </button>
                            <button 
                                onClick={() => setReportType('paid')}
                                className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all ${reportType === 'paid' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            >
                                {category === 'emi' ? 'Paid History' : 'Expired History'}
                            </button>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Duration</label>
                        <select 
                            value={duration} 
                            onChange={(e) => setDuration(Number(e.target.value) as Duration)}
                            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg p-2.5 outline-none focus:border-indigo-500"
                        >
                            <option value={7}>{durationLabel} 7 Days</option>
                            <option value={15}>{durationLabel} 15 Days</option>
                            <option value={30}>{durationLabel} 1 Month</option>
                            <option value={60}>{durationLabel} 2 Months</option>
                            <option value={90}>{durationLabel} 3 Months</option>
                            <option value={180}>{durationLabel} 6 Months</option>
                            <option value={365}>{durationLabel} 1 Year</option>
                        </select>
                    </div>

                    {category === 'emi' ? (
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Bank</label>
                            <select 
                                value={selectedBank} 
                                onChange={(e) => setSelectedBank(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg p-2.5 outline-none focus:border-indigo-500"
                            >
                                <option value="All">All Banks</option>
                                {availableBanks.map(bank => (
                                    <option key={bank} value={bank}>{bank}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                         <div>
                            <label className="block text-sm text-slate-400 mb-2">Document</label>
                            <select 
                                value={selectedDocType} 
                                onChange={(e) => setSelectedDocType(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg p-2.5 outline-none focus:border-indigo-500"
                            >
                                <option value="All">All Documents</option>
                                {availableDocTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">
                        <span className="text-indigo-400 mr-2">{durationLabel} {duration} Days:</span>
                        {category === 'emi' 
                            ? (reportType === 'upcoming' ? 'Upcoming Payments' : 'Paid History')
                            : (reportType === 'upcoming' ? 'Expiring Soon' : 'Expired History')
                        }
                    </h2>
                    <span className="bg-slate-700 text-xs px-2 py-1 rounded text-slate-300">
                        {category === 'emi' ? emiData.length : docData.length} Records
                    </span>
                </div>
                
                <div className="overflow-x-auto">
                    {category === 'emi' ? (
                         <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-700/50 text-xs uppercase text-slate-400 font-bold">
                                <tr>
                                    <th className="px-4 py-3 whitespace-nowrap">Date</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Amount</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Vehicle / Loan</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Reg / ID</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Bank</th>
                                    <th className="px-4 py-3 whitespace-nowrap text-right text-indigo-300">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {emiData.length === 0 ? (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No records found.</td></tr>
                                ) : (
                                    emiData.map((row, index) => (
                                        <tr key={index} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="px-4 py-3 font-medium whitespace-nowrap text-white">{row.date}</td>
                                            <td className="px-4 py-3 font-medium text-emerald-400 whitespace-nowrap">₹{row.amount.toLocaleString()}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{row.vehicleName}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">{row.regNumber}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{row.bank}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-indigo-300">₹{row.total?.toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    ) : (
                         <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-700/50 text-xs uppercase text-slate-400 font-bold">
                                <tr>
                                    <th className="px-4 py-3 whitespace-nowrap">Document Name</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Vehicle / Asset</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Reg Number</th>
                                    <th className="px-4 py-3 whitespace-nowrap">{reportType === 'upcoming' ? 'Expiry Date' : 'Expired Date'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {docData.length === 0 ? (
                                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No documents found.</td></tr>
                                ) : (
                                    docData.map((row, index) => (
                                        <tr key={index} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="px-4 py-3 font-medium text-purple-400 whitespace-nowrap">{row.docName}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{row.vehicleName}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">{row.regNumber}</td>
                                            <td className="px-4 py-3 font-medium whitespace-nowrap text-white">{row.date}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Reports;
