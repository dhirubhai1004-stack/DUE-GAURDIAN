
import React from 'react';
import { Vehicle, ReminderItem, ReminderCategory, Emi, Document as DocType } from '../types';
import { CarIcon, TruckIcon, BikeIcon, MachineIcon, DocumentIcon, EmiIcon, SnoozeIcon } from './icons';

interface DashboardProps {
  vehicles: Vehicle[];
  onViewVehicle: (vehicleId: string) => void;
  snoozed: Record<string, number>;
  onSnoozeItem: (itemId: string) => void;
}

const getVehicleIcon = (type: string) => {
    switch (type) {
        case 'Car': return <CarIcon className="w-5 h-5 mr-2" />;
        case 'Truck': return <TruckIcon className="w-5 h-5 mr-2" />;
        case 'Bike': return <BikeIcon className="w-5 h-5 mr-2" />;
        case 'Machine': return <MachineIcon className="w-5 h-5 mr-2" />;
        default: return null;
    }
};

const getCategoryStyle = (category: ReminderCategory) => {
    switch (category) {
        case 'overdue': return { bg: 'bg-red-900/50', border: 'border-red-500', text: 'text-red-400' };
        case 'today': return { bg: 'bg-amber-900/50', border: 'border-amber-500', text: 'text-amber-400' };
        case 'upcoming': return { bg: 'bg-green-900/50', border: 'border-green-500', text: 'text-green-400' };
    }
};


const ReminderCard: React.FC<{ item: ReminderItem, category: ReminderCategory, onViewVehicle: (vehicleId: string) => void, onSnoozeItem: (itemId: string) => void }> = ({ item, category, onViewVehicle, onSnoozeItem }) => {
    const { bg, border } = getCategoryStyle(category);
    const itemTypeIcon = item.type === 'EMI' 
        ? <EmiIcon className="w-5 h-5 text-cyan-400" /> 
        : <DocumentIcon className="w-5 h-5 text-purple-400" />;

    return (
        <div className={`p-4 rounded-lg border ${border} ${bg} flex flex-col space-y-3 cursor-pointer hover:bg-slate-700 transition-colors`} onClick={() => onViewVehicle(item.vehicle.id)}>
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center text-slate-300">
                        {getVehicleIcon(item.vehicle.type)}
                        <span className="font-semibold">{item.vehicle.make} {item.vehicle.model}</span>
                    </div>
                    <p className="text-sm text-slate-400">{item.vehicle.registrationNumber}</p>
                </div>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onSnoozeItem(item.item.id); }} 
                        className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-700/50 transition-colors"
                        title="Remind tomorrow"
                    >
                        <SnoozeIcon className="w-5 h-5" />
                    </button>
                    {itemTypeIcon}
                </div>
            </div>
            <div>
                 <p className="font-medium text-white">{item.type === 'EMI' ? `Next EMI Due - ₹${(item.item as Emi).amount.toLocaleString()}` : `Expires: ${(item.item as DocType).name}`}</p>
                <p className="text-sm text-slate-300">Date: {new Date(item.date).toLocaleDateString()}</p>
                {item.endDate && <p className="text-xs text-slate-400">Loan Ends: {new Date(item.endDate).toLocaleDateString()}</p>}
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ vehicles, onViewVehicle, snoozed, onSnoozeItem }) => {
    const reminders = React.useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const now = Date.now();

        const categorized: Record<ReminderCategory, ReminderItem[]> = {
            overdue: [],
            today: [],
            upcoming: [],
        };

        vehicles.forEach(vehicle => {
            vehicle.emis.forEach(emi => {
                if (emi.paidInstallments >= emi.totalTenure) return; // Skip fully paid EMIs
                
                const snoozedUntil = snoozed[emi.id];
                if (snoozedUntil && now < snoozedUntil) return;

                const startDate = new Date(emi.startDate);
                const nextDueDate = new Date(startDate.getFullYear(), startDate.getMonth() + emi.paidInstallments, startDate.getDate());
                
                const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + emi.totalTenure, startDate.getDate());
                
                const reminderItem: ReminderItem = { 
                    vehicle, 
                    item: emi, 
                    type: 'EMI', 
                    date: nextDueDate.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0]
                };

                if (nextDueDate < today) categorized.overdue.push(reminderItem);
                else if (nextDueDate.getTime() === today.getTime()) categorized.today.push(reminderItem);
                else categorized.upcoming.push(reminderItem);
            });
            vehicle.documents.forEach(doc => {
                const snoozedUntil = snoozed[doc.id];
                if (snoozedUntil && now < snoozedUntil) return;

                const expiryDate = new Date(doc.expiryDate);
                const reminderItem: ReminderItem = { vehicle, item: doc, type: 'Document', date: doc.expiryDate };
                
                if (expiryDate < today) categorized.overdue.push(reminderItem);
                else if (expiryDate.getTime() === today.getTime()) categorized.today.push(reminderItem);
                else categorized.upcoming.push(reminderItem);
            });
        });
        
        categorized.upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return categorized;
    }, [vehicles, snoozed]);
    
    const ReminderSection: React.FC<{ title: string; items: ReminderItem[]; category: ReminderCategory; }> = ({ title, items, category }) => {
        const { text } = getCategoryStyle(category);
        if (items.length === 0) return null;

        return (
            <div className="mb-8">
                <h2 className={`text-2xl font-bold mb-4 ${text}`}>{title} ({items.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map(item => <ReminderCard key={`${item.vehicle.id}-${item.item.id}`} item={item} category={category} onViewVehicle={onViewVehicle} onSnoozeItem={onSnoozeItem} />)}
                </div>
            </div>
        );
    };

  return (
    <div className="p-4 md:p-6">
        <h1 className="text-3xl font-bold text-indigo-400 mb-6">Dashboard</h1>
        {vehicles.length === 0 ? (
            <div className="text-center py-16 bg-slate-800 rounded-lg">
                <p className="text-slate-400">No vehicles added yet.</p>
                <p className="text-slate-500">Add a vehicle to see your reminders here.</p>
            </div>
        ) : (
            <>
                <ReminderSection title="Overdue" items={reminders.overdue} category="overdue" />
                <ReminderSection title="Today" items={reminders.today} category="today" />
                <ReminderSection title="Upcoming" items={reminders.upcoming} category="upcoming" />
                 {reminders.overdue.length === 0 && reminders.today.length === 0 && reminders.upcoming.length === 0 && (
                    <div className="text-center py-16 bg-slate-800 rounded-lg">
                        <p className="text-slate-400">All caught up!</p>
                        <p className="text-slate-500">No reminders are due. Snoozed items will reappear later.</p>
                    </div>
                )}
            </>
        )}
    </div>
  );
};

export default Dashboard;