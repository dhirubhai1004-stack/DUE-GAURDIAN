
import React, { useState, useMemo } from 'react';
import { Vehicle, VehicleType } from '../types';
import { DownloadIcon } from './icons';

interface ReportsProps {
  vehicles: Vehicle[];
}

type ReportType = 'upcoming' | 'paid';
type Duration = 7 | 15 | 30 | 60 | 90 | 180 | 365;

const durations: Duration[] = [7, 15, 30, 60, 90, 180, 365];

const formatDate = (date: Date): string => {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

// Helper to get display name (copied from App.tsx/Dashboard.tsx logic)
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
    const [reportType, setReportType] = useState<ReportType>('upcoming');
    const [duration, setDuration] = useState<Duration>(30);

    const reportData = useMemo(() => {
        const rows: {
            date: string;
            dateObj: Date;
            amount: number;
            vehicleName: string;
            regNumber: string;
            bank: string;
        }[] = [];

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
                if (reportType === 'upcoming') {
                    // Calculate Upcoming Dates
                    if (emi.paidInstallments < emi.totalTenure) {
                        let [sY, sM, sD] = emi.startDate.split('-').map(Number);
                        if (sY < 100) sY += 2000;
                        
                        // We iterate from current paid installment index up to total tenure
                        for (let i = emi.paidInstallments; i < emi.totalTenure; i++) {
                            const dueDate = new Date(sY, sM - 1 + i, sD);
                            const dueDateMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                            
                            // Check if date is within range [Today, TargetDate]
                            if (dueDateMidnight >= today && dueDateMidnight <= targetDate) {
                                rows.push({
                                    date: formatDate(dueDateMidnight),
                                    dateObj: dueDateMidnight,
                                    amount: emi.amount,
                                    vehicleName: getVehicleDisplayName(vehicle),
                                    regNumber: vehicle.registrationNumber,
                                    bank: emi.emiBank || '-'
                                });
                            }
                        }
                    }
                } else {
                    // Paid History
                    if (emi.paymentHistory) {
                        emi.paymentHistory.forEach(payment => {
                            const paidDate = new Date(payment.paidDate);
                            paidDate.setHours(0,0,0,0);
                            
                            // Check if date is within range [TargetDate, Today]
                            if (paidDate >= targetDate && paidDate <= today) {
                                rows.push({
                                    date: formatDate(paidDate),
                                    dateObj: paidDate,
                                    amount: payment.amount,
                                    vehicleName: getVehicleDisplayName(vehicle),
                                    regNumber: vehicle.registrationNumber,
                                    bank: emi.emiBank || '-'
                                });
                            }
                        });
                    }
                }
            });
        });

        // Sort by Date
        rows.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

        // Calculate Cumulative Total
        let runningTotal = 0;
        return rows.map(row => {
            runningTotal += row.amount;
            return { ...row, total: runningTotal };
        });

    }, [vehicles, reportType, duration]);

    return (
        <div className="p-4 md:p-6 pb-24">
            <h1 className="text-3xl font-bold text-indigo-400 mb-6">EMI Reports</h1>
            
            <div className="bg-slate-800 p-4 rounded-lg mb-6 shadow-lg border border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Report Type</label>
                        <div className="flex bg-slate-700 rounded-lg p-1">
                            <button 
                                onClick={() => setReportType('upcoming')}
                                className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all ${reportType === 'upcoming' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            >
                                Upcoming EMIs
                            </button>
                            <button 
                                onClick={() => setReportType('paid')}
                                className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all ${reportType === 'paid' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            >
                                Paid History
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
                            <option value={7}>Next 7 Days</option>
                            <option value={15}>Next 15 Days</option>
                            <option value={30}>Next 1 Month</option>
                            <option value={60}>Next 2 Months</option>
                            <option value={90}>Next 3 Months</option>
                            <option value={180}>Next 6 Months</option>
                            <option value={365}>Next 1 Year</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">
                        {reportType === 'upcoming' ? `Upcoming Payments (${duration} Days)` : `Payments History (${duration} Days)`}
                    </h2>
                    <span className="bg-slate-700 text-xs px-2 py-1 rounded text-slate-300">
                        {reportData.length} Records
                    </span>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-700/50 text-xs uppercase text-slate-400 font-bold">
                            <tr>
                                <th className="px-4 py-3 whitespace-nowrap">Date</th>
                                <th className="px-4 py-3 whitespace-nowrap">Amount</th>
                                <th className="px-4 py-3 whitespace-nowrap">Vehicle / Loan</th>
                                <th className="px-4 py-3 whitespace-nowrap">Reg / ID</th>
                                <th className="px-4 py-3 whitespace-nowrap">Bank</th>
                                <th className="px-4 py-3 whitespace-nowrap text-right text-indigo-300">Cumulative Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {reportData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                        No records found for this period.
                                    </td>
                                </tr>
                            ) : (
                                reportData.map((row, index) => (
                                    <tr key={index} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-4 py-3 font-medium whitespace-nowrap text-white">{row.date}</td>
                                        <td className="px-4 py-3 font-medium text-emerald-400 whitespace-nowrap">₹{row.amount.toLocaleString()}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{row.vehicleName}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">{row.regNumber}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{row.bank}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-indigo-300">₹{row.total.toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {reportData.length > 0 && (
                            <tfoot className="bg-slate-700/80 font-bold text-white">
                                <tr>
                                    <td colSpan={5} className="px-4 py-3 text-right">Grand Total:</td>
                                    <td className="px-4 py-3 text-right text-indigo-300">₹{reportData[reportData.length - 1].total.toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Reports;
