'use client';

import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const base = 'rounded-md px-4 py-2 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
  const variants: Record<string, string> = {
    primary: 'bg-sky-600 text-white hover:bg-sky-700 focus-visible:ring-sky-500',
    secondary: 'bg-slate-200 text-slate-900 hover:bg-slate-300 focus-visible:ring-slate-500',
    ghost: 'bg-transparent text-slate-900 hover:bg-slate-100 focus-visible:ring-slate-500',
  };

  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
