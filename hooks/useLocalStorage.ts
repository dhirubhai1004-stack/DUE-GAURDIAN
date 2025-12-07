
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
      console.error("LocalStorage Save Error:", error);
      // Check for storage quota exceeded errors
      if (error && (
          error.name === 'QuotaExceededError' || 
          error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          (error.message && error.message.includes('quota'))
      )) {
          alert("⚠️ Storage Full! \n\nThe item you just added could not be saved because your local storage is full. \n\nPlease try:\n1. Deleting old documents or unused vehicles.\n2. Re-uploading smaller/compressed images.\n3. Using 'Backup' in Settings to save your data externally.");
      }
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
