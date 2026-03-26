import React, { createContext, useContext } from 'react';

interface NavigationValue {
  currentPath: string;
  navigate: (path: string) => void;
}

const NavigationContext = createContext<NavigationValue | null>(null);

interface ProviderProps {
  currentPath: string;
  navigate: (path: string) => void;
  children: React.ReactNode;
}

export function NavigationProvider({ currentPath, navigate, children }: ProviderProps) {
  return (
    <NavigationContext.Provider value={{ currentPath, navigate }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigation deve ser usado dentro de NavigationProvider');
  }
  return ctx;
}

