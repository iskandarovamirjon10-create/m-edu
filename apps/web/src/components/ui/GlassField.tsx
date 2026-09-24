import { cloneElement, isValidElement, type ReactElement, type ReactNode, useId} from'react';

interface GlassFieldProps {
 label: string;
 error?: string;
 required?: boolean;
 /** Primary control; extra nodes (e.g. inline error text) are also allowed. */
 children: ReactNode;
 hint?: string;
 id?: string;
}

export function GlassField({ label, error, required, children, hint, id}: GlassFieldProps) {
 const generatedId = useId();
 const fieldId = id || generatedId;
 const childrenArray = Array.isArray(children) ? children : [children];
 const controlNode = childrenArray.find(
 (c): c is ReactElement => isValidElement(c),
 );
 const restNodes = childrenArray.filter((c) => !isValidElement(c));

 const control = controlNode
 ? cloneElement(controlNode as React.ReactElement<{
 id?: string;
'aria-invalid'?: boolean;
'aria-describedby'?: string;
}>, {
 id: fieldId,
 ...(error ? {'aria-invalid': true,'aria-describedby': `${fieldId}-error`} : {}),
})
 : null;

 return (
 <div>
 <label
 htmlFor={fieldId}
 className="mb-1.5 block text-sm font-medium"
 style={{ color:'var(--text-secondary)'}}
 >
 {label}{required && <span style={{ color:'var(--state-error)'}}> *</span>}
 </label>
 {control}
 {restNodes}
 {hint && !error && (
 <p className="mt-1 text-xs"style={{ color:'var(--text-muted)'}}>{hint}</p>
 )}
 {error && (
 <p
 id={`${fieldId}-error`}
 className="mt-1 text-xs"
 style={{ color:'var(--state-error)'}}
 >
 {error}
 </p>
 )}
 </div>
 );
}
