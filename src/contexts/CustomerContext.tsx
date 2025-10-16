import { createContext, useContext, useState, ReactNode } from 'react';

interface CustomerData {
  firstName: string;
  lastName: string;
  zipcode: string;
  phone: string;
}

interface CustomerContextType {
  customerData: CustomerData;
  setCustomerData: (data: CustomerData) => void;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export const CustomerProvider = ({ children }: { children: ReactNode }) => {
  const [customerData, setCustomerData] = useState<CustomerData>({
    firstName: '',
    lastName: '',
    zipcode: '',
    phone: '(232) 323-2323',
  });

  return (
    <CustomerContext.Provider value={{ customerData, setCustomerData }}>
      {children}
    </CustomerContext.Provider>
  );
};

export const useCustomer = () => {
  const context = useContext(CustomerContext);
  if (context === undefined) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
};
