export enum VehicleType {
  Car = 'Car',
  Truck = 'Truck',
  Machine = 'Machine',
  Bike = 'Bike',
  Other = 'Other',
}

export const PREDEFINED_DOC_NAMES = ['Registration Certificate (RC)', 'Insurance', 'Pollution Under Control (PUC)', 'Permit', 'Fitness Certificate', 'Other'] as const;

export interface Document {
  id: string;
  name: string; // From dropdown or custom input if 'Other'
  validFrom: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  fileData?: string; // base64 data URL
  fileName?: string;
}

export interface Emi {
  id: string;
  startDate: string; // YYYY-MM-DD of the first EMI
  amount: number;
  totalTenure: number; // in months
  paidInstallments: number; // number of EMIs paid
  loanProvider?: string;
  loanId?: string;
  emiBank?: string;
  principalAmount?: number;
  interestRate?: number;
}

export interface Vehicle {
  id:string;
  type: string; // Changed to string for flexibility with "Other"
  make: string;
  model: string;
  registrationNumber: string;
  documents: Document[];
  archivedDocuments: Document[];
  emis: Emi[];
}

export type ReminderItem = {
  vehicle: Vehicle;
  item: Emi | Document;
  type: 'EMI' | 'Document';
  date: string; // Due date for EMI, Expiry for Doc
  endDate?: string; // Only for EMIs
};

export type ReminderCategory = 'overdue' | 'today' | 'upcoming';