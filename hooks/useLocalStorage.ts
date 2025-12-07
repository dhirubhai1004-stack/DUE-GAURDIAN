
// FIX: Import React to bring the React namespace into scope for types.
import React, { useState, useEffect } from 'react';

function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      const valueToStore = JSON.stringify(storedValue);
      window.localStorage.setItem(key, valueToStore);
    } catch (error: any) {
      // We suppress the alert here. 
      // Rationale: We are syncing to Supabase. If LocalStorage is full, 
      // we don't want to block the user. The app will continue to work in memory
      // and the background sync will save the data to the Cloud Database.
      console.warn("LocalStorage Quota Exceeded. Data will persist in Cloud/Memory only.", error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
