import React from 'react';
import { Vehicle, ReminderItem, ReminderCategory, Emi, Document as DocType, VehicleType } from '../types';
import { CarIcon, TruckIcon, BikeIcon, MachineIcon, DocumentIcon, EmiIcon, SnoozeIcon, OtherVehicleIcon, CheckCircleIcon, PersonalLoanIcon, BusinessLoanIcon, HomeLoanIcon } from './icons';

interface DashboardProps {
  vehicles: Vehicle[];
  onViewVehicle: (vehicleId: string) => void;
  snoozed: Record<string, number>;
  onSnoozeItem: (itemId: string, minutes?: number) => void;
  onMarkEmiPaid: (emi: Emi, vehicleId: string, category: 'overdue' | 'today') => void;
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

const toYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getVehicleIcon = (type: string) => {
    switch (type) {
        case 'Car': return <CarIcon className="w-5 h-5 mr-2" />;
        case 'Truck': return <TruckIcon className="w-5 h-5 mr-2" />;
        case 'Bike': return <BikeIcon className="w-5 h-5 mr-2" />;
        case 'Machine': return <MachineIcon className="w-5 h-5 mr-2" />;
        case 'Personal Loan': return <PersonalLoanIcon className="w-5 h-5 mr-2" />;
        case 'Business Loan': return <BusinessLoanIcon className="w-5 h-5 mr-2" />;
        case 'Home Loan': return <HomeLoanIcon className="w-5 h-5 mr-2" />;
        case 'Overdraft / CC': return <BusinessLoanIcon className="w-5 h-5 mr-2 text-amber-400" />;
        default: return <OtherVehicleIcon className="w-5 h-5 mr-2" />;
    }
};

const getCategoryStyle = (category: ReminderCategory) => {
    switch (category) {
        case 'overdue': return { bg: 'bg-red-900/50', border: 'border-red-500', text: 'text-red-400' };
        case 'dueTomorrowEmis':
        case 'today': return { bg: 'bg-amber-900/50', border: 'border-amber-500', text: 'text-amber-400' };
        case 'tomorrow': return { bg: 'bg-sky-900/50', border: 'border-sky-500', text: 'text-sky-400' };
        case 'upcoming': return { bg: 'bg-green-900/50', border: 'border-green-500', text: 'text-green-400' };
    }
};


const ReminderCard: React.FC<{ 
    item: ReminderItem, 
    category: ReminderCategory, 
    onViewVehicle: (vehicleId: string) => void, 
    onSnoozeItem: (itemId: string, minutes?: number) => void,
    onMarkEmiPaid: (emi: Emi, vehicleId: string, category: 'overdue' | 'today') => void
}> = ({ item, category, onViewVehicle, onSnoozeItem, onMarkEmiPaid }) => {
    const { bg, border } = getCategoryStyle(category);
    const itemTypeIcon = item.type === 'EMI' 
        ? <EmiIcon className="w-5 h-5 text-cyan-400" /> 
        : <DocumentIcon className="w-5 h-5 text-purple-400" />;

    return (
        <div className={`p-4 rounded-lg border ${border} ${bg} flex flex-col space-y-3`}>
            <div onClick={() => onViewVehicle(item.vehicle.id)} className="cursor-pointer">
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
                            title="Remind later"
                        >
                            <SnoozeIcon className="w-5 h-5" />
                        </button>
                        {itemTypeIcon}
                    </div>
                </div>
                <div>
                    <p className="font-medium text-white">{item.type === 'EMI' ? `EMI Due - ₹${(item.item as Emi).amount.toLocaleString()}` : `Expires: ${(item.item as DocType).name}`}</p>
                    <p className="text-sm text-slate-300">Date: {formatDate(item.date)}</p>
                    {item.endDate && <p className="text-xs text-slate-400">Loan Ends: {formatDate(item.endDate)}</p>}
                </div>
            </div>
             {item.type === 'EMI' && category === 'overdue' && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                    <button
                        onClick={(e) => { e.stopPropagation(); onMarkEmiPaid(item.item as Emi, item.vehicle.id, 'overdue'); }}
                        className="w-full bg-green-600 hover:bg-green-700 p-2 rounded text-white font-bold text-sm flex items-center justify-center gap-2"
                    >
                        <CheckCircleIcon className="w-5 h-5"/>
                        <span>Mark as Paid</span>
                    </button>
                </div>
            )}
            {category === 'dueTomorrowEmis' && (
                 <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-wrap justify-between items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onMarkEmiPaid(item.item as Emi, item.vehicle.id, 'today'); }}
                        className="flex-grow bg-green-600 hover:bg-green-700 p-2 rounded text-white font-bold text-sm flex items-center justify-center gap-2"
                    >
                        <CheckCircleIcon className="w-5 h-5"/>
                        <span>Mark as Paid</span>
                    </button>
                    <div className="flex gap-2 flex-grow sm:flex-grow-0 justify-end">
                         <button title="Remind me in 30 minutes" onClick={(e) => { e.stopPropagation(); onSnoozeItem(item.item.id, 30); }} className="p-2 px-3 text-xs bg-slate-600 hover:bg-slate-700 rounded">30m</button>
                         <button title="Remind me in 2 hours" onClick={(e) => { e.stopPropagation(); onSnoozeItem(item.item.id, 120); }} className="p-2 px-3 text-xs bg-slate-600 hover:bg-slate-700 rounded">2h</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ vehicles, onViewVehicle, snoozed, onSnoozeItem, onMarkEmiPaid }) => {
    const reminders = React.useMemo(() => {
        const now = new Date();
        const todayStr = toYMD(now);
        
        const tomorrow = new Date(now); 
        tomorrow.setDate(now.getDate() + 1);
        const tomorrowStr = toYMD(tomorrow);
        
        const dayAfter = new Date(now); 
        dayAfter.setDate(now.getDate() + 2);
        const dayAfterStr = toYMD(dayAfter);
        
        const nowTimestamp = Date.now();

        const categorized: Record<ReminderCategory, ReminderItem[]> = {
            overdue: [],
            today: [],
            tomorrow: [],
            upcoming: [],
            dueTomorrowEmis: [],
        };

        vehicles.forEach(vehicle => {
            // EMIs Logic
            vehicle.emis.forEach(emi => {
                if (emi.paidInstallments >= emi.totalTenure) return; // Skip fully paid
                
                const snoozedUntil = snoozed[emi.id];
                if (snoozedUntil && nowTimestamp < snoozedUntil) return;

                // Calculate next due date safely using YYYY-MM-DD components
                const [sY, sM, sD] = emi.startDate.split('-').map(Number);
                // Month in Date constructor is 0-indexed
                const nextDueDateObj = new Date(sY, sM - 1 + emi.paidInstallments, sD);
                const nextDueStr = toYMD(nextDueDateObj);
                
                const endDateObj = new Date(sY, sM - 1 + emi.totalTenure, sD);
                
                const reminderItem: ReminderItem = { 
                    vehicle, 
                    item: emi, 
                    type: 'EMI', 
                    date: nextDueStr,
                    endDate: toYMD(endDateObj)
                };

                if (nextDueStr < todayStr) {
                    categorized.overdue.push(reminderItem);
                } else if (nextDueStr === todayStr || nextDueStr === tomorrowStr) {
                    // Group EMIs due Today and Tomorrow together
                    categorized.dueTomorrowEmis.push(reminderItem);
                }
            });

            // Documents Logic
            vehicle.documents.forEach(doc => {
                const snoozedUntil = snoozed[doc.id];
                if (snoozedUntil && nowTimestamp < snoozedUntil) return;

                const reminderItem: ReminderItem = { vehicle, item: doc, type: 'Document', date: doc.expiryDate };
                const expiryStr = doc.expiryDate; // Assuming YYYY-MM-DD format
                
                if (expiryStr < todayStr) {
                    categorized.overdue.push(reminderItem);
                } else if (expiryStr === todayStr || expiryStr === tomorrowStr) {
                    // "Tomorrow expiring should in Today"
                    categorized.today.push(reminderItem);
                } else if (expiryStr === dayAfterStr) {
                    // "Day after tomorrow should be in Tomorrow"
                    categorized.tomorrow.push(reminderItem);
                } else if (expiryStr > dayAfterStr) {
                    // "All expiring in next 5 days from day after tomorrow should be in Upcoming"
                    categorized.upcoming.push(reminderItem);
                }
            });
        });
        
        Object.values(categorized).forEach(arr => arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));

        return categorized;
    }, [vehicles, snoozed]);
    
    const ReminderSection: React.FC<{ title: string; items: ReminderItem[]; category: ReminderCategory; }> = ({ title, items, category }) => {
        const { text } = getCategoryStyle(category);
        if (items.length === 0) return null;

        return (
            <div className="mb-8">
                <h2 className={`text-2xl font-bold mb-4 ${text}`}>{title} ({items.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map(item => <ReminderCard key={`${item.vehicle.id}-${item.item.id}`} item={item} category={category} onViewVehicle={onViewVehicle} onSnoozeItem={onSnoozeItem} onMarkEmiPaid={onMarkEmiPaid} />)}
                </div>
            </div>
        );
    };
    
    const hasAnyReminders = Object.values(reminders).some(arr => Array.isArray(arr) && arr.length > 0);

  return (
    <div className="p-4 md:p-6">
        <h1 className="text-3xl font-bold text-indigo-400 mb-6">Dashboard</h1>
        {vehicles.length === 0 ? (
            <div className="text-center py-16 bg-slate-800 rounded-lg">
                <p className="text-slate-400">No items added yet.</p>
                <p className="text-slate-500">Add a vehicle or loan to see your reminders here.</p>
            </div>
        ) : (
            <>
                <ReminderSection title="Overdue" items={reminders.overdue} category="overdue" />
                <ReminderSection title="EMIs Due Soon" items={reminders.dueTomorrowEmis} category="dueTomorrowEmis" />
                <ReminderSection title="Documents Due Today & Tomorrow" items={reminders.today} category="today" />
                
                {!reminders.overdue.length && !reminders.dueTomorrowEmis.length && !reminders.today.length && (
                     <div className="text-center py-10 my-6 bg-slate-800 rounded-lg border border-slate-700">
                        <p className="text-slate-300 text-lg">All clear for the next 48 hours! 😊</p>
                    </div>
                )}
                
                <ReminderSection title="Documents Due Day After Tomorrow" items={reminders.tomorrow} category="tomorrow" />
                <ReminderSection title="Upcoming Documents" items={reminders.upcoming} category="upcoming" />
                
                 {!hasAnyReminders && (
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