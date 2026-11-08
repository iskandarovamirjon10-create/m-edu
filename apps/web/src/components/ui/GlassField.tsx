import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/design';

export interface GlassFieldProps {
  label?: ReactNode;
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

function injectFieldId(
  element: ReactNode,
  id: string,
  error?: string,
  required?: boolean,
  describedBy?: string,
): { node: ReactNode; matched: boolean } {
  if (!isValidElement(element)) return { node: element, matched: false };

  const isFormTag = typeof element.type === 'string' && ['input', 'select', 'textarea', 'button'].includes(element.type);
  const isFormControl = isFormTag || Boolean(element.props && ('value' in element.props || 'onChange' in element.props || 'name' in element.props || 'placeholder' in element.props));

  // If it's a direct input or interactive form control
  if (isFormControl && element.type !== 'div') {
    const p: any = {};
    if (!element.props.id) p.id = id;
    if (!element.props.name) p.name = id;
    if (error && element.props['aria-invalid'] === undefined) p['aria-invalid'] = true;
    if (required && element.props['aria-required'] === undefined) p['aria-required'] = true;
    if (describedBy && !element.props['aria-describedby']) p['aria-describedby'] = describedBy;
    return { node: cloneElement(element, p), matched: true };
  }

  // If it's a wrapper (like <div className="relative">), dive into its children to find the form control
  if (element.props && element.props.children) {
    let matchedChild = false;
    const newChildren = Children.map(element.props.children, (child) => {
      if (!matchedChild && isValidElement(child)) {
        const res = injectFieldId(child, id, error, required, describedBy);
        if (res.matched) {
          matchedChild = true;
          return res.node;
        }
      }
      return child;
    });
    return { node: cloneElement(element, {}, newChildren), matched: matchedChild };
  }

  return { node: element, matched: false };
}

export function GlassField({
  label,
  hint,
  error,
  required,
  children,
  className = '',
  htmlFor,
  id: idProp,
}: GlassFieldProps) {
  const generatedId = useId();
  const childId = idProp || htmlFor || `gf-${generatedId.replace(/:/g, '')}`;

  const describedBy: string[] = [];
  if (error) describedBy.push(`${childId}-err`);
  if (hint && !error) describedBy.push(`${childId}-hint`);
  const describedByStr = describedBy.length ? describedBy.join(' ') : undefined;

  let assigned = false;
  const renderedChildren = Children.map(children, (child) => {
    if (!assigned && isValidElement(child)) {
      const res = injectFieldId(child, childId, error, required, describedByStr);
      if (res.matched) {
        assigned = true;
        return res.node;
      }
    }
    return child;
  });

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label htmlFor={childId} className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
          {label}
          {required && (
            <span className="text-apple-red ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {renderedChildren}
      {error && (
        <p id={`${childId}-err`} role="alert" className="mt-1 text-xs text-apple-red">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${childId}-hint`} className="mt-1 text-xs text-[var(--text-tertiary)]">
          {hint}
        </p>
      )}
    </div>
  );
}

export default GlassField;
