
import React, { useState } from 'react';
import { Vehicle, ReminderItem, ReminderCategory, Emi, Document as DocType, MACHINE_TYPES } from '../types';
import { CarIcon, TruckIcon, BikeIcon, MachineIcon, DocumentIcon, EmiIcon, SnoozeIcon, OtherVehicleIcon, CheckCircleIcon, PersonalLoanIcon, BusinessLoanIcon, HomeLoanIcon, ClockIcon, BellIcon, BellSlashIcon } from './icons';

interface DashboardProps {
  vehicles: Vehicle[];
  onViewVehicle: (vehicleId: string) => void;
  snoozed: Record<string, number>;
  onSnoozeItem: (itemId: string, minutes?: number) => void;
  onMarkEmiPaid: (emi: Emi, vehicleId: string, category: 'overdue' | 'today') => void;
  onSnoozeAlarm: (emiId: string, vehicleId: string) => void;
  onSetManualAlarm: (emiId: string, vehicleId: string, time: string) => void;
  onDismissAlarm: (emiId: string, vehicleId: string) => void;
}

// Timezone-safe date formatting (Input YYYY-MM-DD -> Output DD/MM/YY)
const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  const [y, m, d] = parts;
  return `${d}/${m}/${y.slice(-2)}`;
};

const getVehicleIcon = (type: string) => {
    // Check if it's one of the specific machine types
    if (MACHINE_TYPES.includes(type as any)) return <MachineIcon className="w-5 h-5 mr-2 text-yellow-400" />;

    switch (type) {
        case 'Car': return <CarIcon className="w-5 h-5 mr-2 text-blue-400" />;
        case 'Truck': return <TruckIcon className="w-5 h-5 mr-2 text-orange-400" />;
        case 'Bike': return <BikeIcon className="w-5 h-5 mr-2 text-green-400" />;
        case 'Machine': return <MachineIcon className="w-5 h-5 mr-2 text-yellow-400" />;
        case 'Personal Loan': return <PersonalLoanIcon className="w-5 h-5 mr-2 text-emerald-400" />;
        case 'Business Loan': return <BusinessLoanIcon className="w-5 h-5 mr-2 text-purple-400" />;
        case 'Home Loan': return <HomeLoanIcon className="w-5 h-5 mr-2 text-rose-400" />;
        case 'Overdraft / CC': return <BusinessLoanIcon className="w-5 h-5 mr-2 text-amber-400" />;
        default: return <OtherVehicleIcon className="w-5 h-5 mr-2 text-slate-400" />;
    }
};

const getCategoryStyle = (category: ReminderCategory) => {
    switch (category) {
        case 'overdue': return { bg: 'bg-red-900/50', border: 'border-red-500', text: 'text-red-400' };
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
    onMarkEmiPaid: (emi: Emi, vehicleId: string, category: 'overdue' | 'today') => void,
    onSnoozeAlarm: (emiId: string, vehicleId: string) => void,
    onSetManualAlarm: (emiId: string, vehicleId: string, time: string) => void,
    onDismissAlarm: (emiId: string, vehicleId: string) => void,
}> = ({ item, category, onViewVehicle, onSnoozeItem, onMarkEmiPaid, onSnoozeAlarm, onSetManualAlarm, onDismissAlarm }) => {
    const { bg, border } = getCategoryStyle(category);
    const [isEditingTime, setIsEditingTime] = useState(false);

    const itemTypeIcon = item.type === 'EMI' 
        ? <EmiIcon className="w-5 h-5 text-cyan-400" /> 
        : <DocumentIcon className="w-5 h-5 text-purple-400" />;
    
    const isTodayEmi = item.type === 'EMI' && category === 'today';
    
    let alarmTimeDisplay = '';
    let alarmStatus = '';
    
    if (isTodayEmi) {
        const emi = item.item as Emi;
        if (emi.alarmConfig?.isDismissed) {
             alarmStatus = 'Alarm Dismissed';
        } else if (emi.alarmConfig?.nextTrigger) {
            const date = new Date(emi.alarmConfig.nextTrigger);
            alarmTimeDisplay = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            if (emi.alarmConfig.snoozeCount > 0) {
                alarmStatus = `Snoozed (${emi.alarmConfig.snoozeCount})`;
            }
        }
    }

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
                        {/* Only allow snoozing/hiding if it's not in the main actionable "Today" list, unless user wants to hide it */}
                        {category !== 'overdue' && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onSnoozeItem(item.item.id); }} 
                                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-700/50 transition-colors"
                                title="Remind later (Hide)"
                            >
                                <SnoozeIcon className="w-5 h-5" />
                            </button>
                        )}
                        {itemTypeIcon}
                    </div>
                </div>
                <div>
                    <p className="font-medium text-white">{item.type === 'EMI' ? `EMI Due - ₹${(item.item as Emi).amount.toLocaleString()}` : `Expires: ${(item.item as DocType).name}`}</p>
                    <p className="text-sm text-slate-300">Date: {formatDate(item.date)}</p>
                    {item.endDate && <p className="text-xs text-slate-400">Loan Ends: {formatDate(item.endDate)}</p>}
                </div>
            </div>
            
            {/* Alarm UI for Today's EMIs */}
            {isTodayEmi && (
                <div className="mt-2 pt-2 border-t border-slate-700/50 bg-slate-800/40 p-2 rounded">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm">
                            {alarmStatus === 'Alarm Dismissed' ? <BellSlashIcon className="w-4 h-4 text-slate-500"/> : <BellIcon className="w-4 h-4 text-amber-400"/>}
                            <span className="text-slate-300">
                                {alarmStatus === 'Alarm Dismissed' 
                                    ? 'Alarm Off' 
                                    : (alarmTimeDisplay ? `Alarm: ${alarmTimeDisplay}` : 'Alarm Not Set')}
                                {alarmStatus && alarmStatus !== 'Alarm Dismissed' && <span className="text-xs text-amber-400 ml-1">({alarmStatus})</span>}
                            </span>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsEditingTime(!isEditingTime); }}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700"
                            title="Edit Alarm Time"
                        >
                            <ClockIcon className="w-4 h-4" />
                        </button>
                    </div>
                    
                    {isEditingTime && (
                         <div className="flex items-center gap-2 mb-2">
                            <input 
                                type="time" 
                                className="bg-slate-700 text-white text-sm rounded p-1 border border-slate-600 outline-none"
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                    onSetManualAlarm((item.item as Emi).id, item.vehicle.id, e.target.value);
                                    setIsEditingTime(false);
                                }}
                            />
                            <span className="text-xs text-slate-400">Set new time</span>
                        </div>
                    )}

                    {!(item.item as Emi).alarmConfig?.isDismissed && (
                        <div className="flex gap-2">
                            <button 
                                onClick={(e) => { e.stopPropagation(); onSnoozeAlarm((item.item as Emi).id, item.vehicle.id); }}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold py-1.5 px-2 rounded flex items-center justify-center gap-1 transition-colors"
                            >
                                <SnoozeIcon className="w-3 h-3" /> Snooze
                            </button>
                             <button 
                                onClick={(e) => { e.stopPropagation(); onDismissAlarm((item.item as Emi).id, item.vehicle.id); }}
                                className="bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs font-semibold py-1.5 px-2 rounded flex items-center justify-center gap-1 transition-colors"
                                title="Stop alarm for today"
                            >
                                <BellSlashIcon className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>
            )}

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
            {item.type === 'EMI' && (category === 'today' || category === 'tomorrow') && (
                 <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-wrap justify-between items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onMarkEmiPaid(item.item as Emi, item.vehicle.id, 'today'); }}
                        className="flex-grow bg-green-600 hover:bg-green-700 p-2 rounded text-white font-bold text-sm flex items-center justify-center gap-2"
                    >
                        <CheckCircleIcon className="w-5 h-5"/>
                        <span>Mark as Paid</span>
                    </button>
                    {!isTodayEmi && (
                        <div className="flex gap-2 flex-grow sm:flex-grow-0 justify-end">
                             <button title="Remind me in 30 minutes" onClick={(e) => { e.stopPropagation(); onSnoozeItem(item.item.id, 30); }} className="p-2 px-3 text-xs bg-slate-600 hover:bg-slate-700 rounded">30m</button>
                             <button title="Remind me in 2 hours" onClick={(e) => { e.stopPropagation(); onSnoozeItem(item.item.id, 120); }} className="p-2 px-3 text-xs bg-slate-600 hover:bg-slate-700 rounded">2h</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ vehicles, onViewVehicle, snoozed, onSnoozeItem, onMarkEmiPaid, onSnoozeAlarm, onSetManualAlarm, onDismissAlarm }) => {
    const reminders = React.useMemo(() => {
        const now = new Date();
        // Normalize to local midnight to ensure we compare calendar days accurately
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const nowTimestamp = Date.now();

        const categorized: Record<ReminderCategory, ReminderItem[]> = {
            overdue: [],
            today: [],
            tomorrow: [],
            upcoming: [],
        };

        vehicles.forEach(vehicle => {
            // EMIs Logic
            vehicle.emis.forEach(emi => {
                if (emi.paidInstallments >= emi.totalTenure) return; // Skip fully paid
                
                // Parse Start Date safely from YYYY-MM-DD string
                const [sYStr, sMStr, sDStr] = emi.startDate.split('-');
                let sY = parseInt(sYStr);
                if (sY < 100) sY += 2000;
                
                // Calculate Next Due Date Object (Local Time)
                const nextDueDate = new Date(sY, parseInt(sMStr) - 1 + emi.paidInstallments, parseInt(sDStr));
                // Normalize Next Due Date to Midnight for accurate day difference
                const nextDueDateMidnight = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth(), nextDueDate.getDate());
                
                // Calculate formatted string for display/key
                const nextDueStr = `${nextDueDateMidnight.getFullYear()}-${String(nextDueDateMidnight.getMonth()+1).padStart(2,'0')}-${String(nextDueDateMidnight.getDate()).padStart(2,'0')}`;

                // Calculate End Date
                const endDateObj = new Date(sY, parseInt(sMStr) - 1 + emi.totalTenure, parseInt(sDStr));
                const endDateStr = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth()+1).padStart(2,'0')}-${String(endDateObj.getDate()).padStart(2,'0')}`;
                
                const reminderItem: ReminderItem = { 
                    vehicle, 
                    item: emi, 
                    type: 'EMI', 
                    date: nextDueStr,
                    endDate: endDateStr
                };

                // Calculate difference in days strictly based on calendar dates
                const diffTime = nextDueDateMidnight.getTime() - todayMidnight.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                // Application Rules (Modified per user request):
                // 1. Overdue: Strictly Past (Diff < 0)
                // 2. Today: Today (0) AND Tomorrow (1) -> "Kal ki emi aaj due me dikhao"
                // 3. Tomorrow: Day After Tomorrow (2) -> "Parso ki Tomorrow me"
                // 4. Upcoming: Next 5 days after that (3 to 7) -> "Uske baad 5 din upcoming me"

                if (diffDays < 0) {
                    if (snoozed[emi.id] && nowTimestamp < snoozed[emi.id]) return;
                    categorized.overdue.push(reminderItem);
                } else if (diffDays === 0 || diffDays === 1) {
                    categorized.today.push(reminderItem);
                } else if (diffDays === 2) {
                     if (snoozed[emi.id] && nowTimestamp < snoozed[emi.id]) return;
                    categorized.tomorrow.push(reminderItem);
                } else if (diffDays >= 3 && diffDays <= 7) {
                    if (snoozed[emi.id] && nowTimestamp < snoozed[emi.id]) return;
                    categorized.upcoming.push(reminderItem);
                }
            });

            // Documents Logic
            vehicle.documents.forEach(doc => {
                const snoozedUntil = snoozed[doc.id];
                if (snoozedUntil && nowTimestamp < snoozedUntil) return;

                // Parse Expiry Date
                const [eY, eM, eD] = doc.expiryDate.split('-').map(Number);
                const expiryDateMidnight = new Date(eY, eM - 1, eD);
                // Normalize to midnight logic already implicit with (y, m, d) constructor, but good to match flow
                expiryDateMidnight.setHours(0, 0, 0, 0);

                const diffTime = expiryDateMidnight.getTime() - todayMidnight.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                const reminderItem: ReminderItem = { vehicle, item: doc, type: 'Document', date: doc.expiryDate };
                
                if (diffDays < 0) {
                    categorized.overdue.push(reminderItem);
                } else if (diffDays === 0 || diffDays === 1) {
                    categorized.today.push(reminderItem);
                } else if (diffDays === 2) {
                    categorized.tomorrow.push(reminderItem);
                } else if (diffDays >= 3 && diffDays <= 7) {
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
                    {items.map(item => <ReminderCard key={`${item.vehicle.id}-${item.item.id}`} item={item} category={category} onViewVehicle={onViewVehicle} onSnoozeItem={onSnoozeItem} onMarkEmiPaid={onMarkEmiPaid} onSnoozeAlarm={onSnoozeAlarm} onSetManualAlarm={onSetManualAlarm} onDismissAlarm={onDismissAlarm} />)}
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
                <ReminderSection title="Due Today (Action Now)" items={reminders.today} category="today" />
                <ReminderSection title="Due Tomorrow" items={reminders.tomorrow} category="tomorrow" />
                
                {!reminders.overdue.length && !reminders.today.length && !reminders.tomorrow.length && (
                     <div className="text-center py-10 my-6 bg-slate-800 rounded-lg border border-slate-700">
                        <p className="text-slate-300 text-lg">All clear for the next few days! 😊</p>
                    </div>
                )}
                
                <ReminderSection title="Upcoming (Next 5 Days)" items={reminders.upcoming} category="upcoming" />
                
                 {!hasAnyReminders && (
                    <div className="text-center py-16 bg-slate-800 rounded-lg">
                        <p className="text-slate-400">All caught up!</p>
                        <p className="text-slate-500">No reminders are due soon. Check the Items list for full details.</p>
                    </div>
                )}
            </>
        )}
    </div>
  );
};

export default Dashboard;
