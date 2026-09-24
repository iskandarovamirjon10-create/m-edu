import { useId} from'react';
import AsyncSelect from'react-select/async';
import type { GroupBase, StylesConfig} from'react-select';
import { useSafeI18n } from '@/i18n/I18nProvider';

interface OptionType {
 label: string;
 value: string;
}

export interface GlassAsyncSelectProps {
 id?: string;
 label?: string;
 error?: string;
 hint?: string;
 placeholder?: string;
 loadOptions: (inputValue: string) => Promise<OptionType[]>;
 value?: OptionType | null;
 onChange?: (val: OptionType | null) => void;
 defaultOptions?: OptionType[] | boolean;
 className?: string;
}

const customStyles: StylesConfig<OptionType, false, GroupBase<OptionType>> = {
 control: (base, state) => ({
 ...base,
 backgroundColor:'var(--bg-glass)',
 backdropFilter:'blur(24px)',
 border: state.isFocused 
 ?'1px solid var(--brand-700)' 
 :'1px solid var(--border-medium)',
 borderRadius:'0.75rem',
 boxShadow: state.isFocused ?'0 0 0 3px rgba(84,115,252,0.18)' :'none',
 padding:'0.125rem 0.25rem',
 fontSize:'0.9375rem',
 color:'var(--text-primary)',
 transition:'border-color 0.2s, box-shadow 0.2s',
'&:hover': {
 borderColor: state.isFocused ?'var(--brand-700)' :'var(--border-strong)',
},
}),
 menu: (base) => ({
 ...base,
 backgroundColor:'var(--bg-glass)',
 backdropFilter:'blur(24px)',
 borderRadius:'0.75rem',
 border:'1px solid var(--border-medium)',
 boxShadow:'0 10px 15px -3px rgba(0, 0, 0, 0.1)',
 zIndex: 50,
}),
 option: (base, state) => ({
 ...base,
 backgroundColor: state.isSelected
 ?'var(--brand-600)'
 : state.isFocused
 ?'var(--brand-50)'
 :'transparent',
 color: state.isSelected 
 ?'#fff' 
 :'var(--text-primary)',
 cursor:'pointer',
 padding:'0.5rem 1rem',
'&:active': {
 backgroundColor:'var(--brand-100)',
},
}),
 input: (base) => ({
 ...base,
 color:'var(--text-primary)',
}),
 singleValue: (base) => ({
 ...base,
 color:'var(--text-primary)',
}),
 placeholder: (base) => ({
 ...base,
 color:'var(--text-muted, #9ca3af)',
}),
 indicatorSeparator: () => ({
 display:'none',
}),
 dropdownIndicator: (base) => ({
 ...base,
 color:'var(--text-secondary, #6b7280)',
'&:hover': {
 color:'var(--text-primary)',
},
}),
};

export function GlassAsyncSelect({
  id,
  label,
  error,
  hint,
  placeholder,
  loadOptions,
  value,
  onChange,
  defaultOptions = true,
  className ='',
}: GlassAsyncSelectProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const { t} = useSafeI18n();
  const resolvedPlaceholder = placeholder ?? t('a11y.select');

 return (
 <div className={`flex flex-col gap-1.5 ${className}`}>
 {label && (
 <label htmlFor={inputId} className="text-sm font-medium text-[var(--text-secondary)]">
 {label}
 </label>
 )}
 <div className="relative">
 <AsyncSelect<OptionType, false, GroupBase<OptionType>>
 inputId={inputId}
 loadOptions={loadOptions}
 value={value}
 onChange={onChange}
 defaultOptions={defaultOptions}
 placeholder={resolvedPlaceholder}
 styles={customStyles}
 classNamePrefix="glass-select"
 />
 </div>
 {error && <p className="text-xs text-[var(--state-error)]">{error}</p>}
 {!error && hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
 </div>
 );
}
