import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/design';

export interface GlassFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** @deprecated no-op */ disableRefraction?: boolean;
  /** @deprecated no-op */ decorative?: boolean;
  /** @deprecated no-op */ noReflection?: boolean;
  /** @deprecated no-op */ enableNoise?: boolean;
  /** @deprecated no-op */ glassDepth?: number;
  /** @deprecated no-op */ variant?: any;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  id?: string;
}

export function GlassField({label,hint,error,required,children,className='',htmlFor,id}: GlassFieldProps) {
  const child = isValidElement(children) ? (children as ReactElement<any>) : null;
  const childId = child?.props?.id || id || undefined;
  const describedBy: string[] = [];
  if(error) describedBy.push(childId?childId+'-err':(id||'f')+'-err');
  if(hint && !error) describedBy.push(childId?childId+'-hint':(id||'f')+'-hint');
  const childProps: any = {};
  if(childId) childProps.id = childId;
  if(error) childProps['aria-invalid'] = true;
  if(required) childProps['aria-required'] = true;
  if(describedBy.length) childProps['aria-describedby'] = describedBy.join(' ');
  const cloned = child ? cloneElement(child, childProps) : children;
  return (<div className={cn('w-full', className)}>{label && <label htmlFor={childId||htmlFor} className='mb-1.5 block text-xs font-medium text-[var(--text-secondary)]'>{label}{required&&<span className='text-apple-red ml-1' aria-hidden>＊</span>}</label>}{cloned}{error && <p id={(childId||id||'f')+'-err'} role='alert' className='mt-1 text-xs text-apple-red'>{error}</p>}{hint && !error && <p id={(childId||id||'f')+'-hint'} className='mt-1 text-xs text-[var(--text-tertiary)]'>{hint}</p>}</div>);
}

export default GlassField;
