'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type ThemeType = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeType>('light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div
        style={{
          minHeight: '100vh',
          background: theme === 'dark' 
            ? '#262626' 
            : 'linear-gradient(to bottom right, rgb(254 242 242), rgb(252 231 243))',
          transition: 'background 0.3s ease',
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
