import { useState, useEffect } from 'react';
import { Calculator as CalculatorIcon, X, Copy, Check, Sparkles, Clock, Percent, Users, Info, Plus, Minus, Divide, X as MultiplyIcon } from 'lucide-react';
import { useUiStore } from '@/stores/ui.store';
import { useCalculator, type HistoryItem } from './useCalculator';
import { useSafeI18n } from '@/i18n/I18nProvider';

export function GlobalCalculator() {
  const { isCalculatorOpen, setCalculatorOpen } = useUiStore();
  const { t } = useSafeI18n();
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'finance'>('basic');
  const [financeInput, setFinanceInput] = useState('');

  const {
    currentValue,
    previousValue,
    operator,
    history,
    inputDigit,
    inputDot,
    performOperation,
    calculateEquals,
    toggleSign,
    inputPercent,
    backspace,
    clear,
    clearHistory,
    calculateDiscount,
    calculateMarkup,
    calculateInstallment,
    calculateSplit
  } = useCalculator();

  useEffect(() => {
    if (!isCalculatorOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.activeElement?.tagName !== 'INPUT') {
        setCalculatorOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isCalculatorOpen, setCalculatorOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAskAi = (item: HistoryItem) => {
    // Open AI Copilot and set prompt
    window.dispatchEvent(new CustomEvent('ask-ai', { detail: `Please explain this calculation: ${item.expression} = ${item.result}` }));
    setCalculatorOpen(false);
  };

  const handleFinanceAction = (action: 'discount' | 'markup' | 'installment' | 'split') => {
    const val = parseFloat(financeInput);
    if (isNaN(val)) return;
    switch(action) {
      case 'discount': calculateDiscount(val); break;
      case 'markup': calculateMarkup(val); break;
      case 'installment': calculateInstallment(val); break;
      case 'split': calculateSplit(val); break;
    }
    setFinanceInput('');
    setActiveTab('basic');
  };

  if (!isCalculatorOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-[140] bg-slate-950/40 backdrop-blur-sm transition-opacity lg:hidden" 
        onClick={() => setCalculatorOpen(false)}
        aria-hidden="true"
      />
      <div 
        className="fixed inset-y-2 lg:inset-y-auto lg:top-[74px] right-2 z-[150] flex w-[380px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-card)] shadow-[var(--shadow-xl)] lg:bottom-4"
        style={{
          backdropFilter: 'blur(40px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
          animation: 'glass-dropdown-in 0.3s cubic-bezier(.25,.46,.45,.94) forwards',
          transformOrigin: 'top right',
        }}
        role="dialog"
        aria-label={t('calculator.title') || 'Calculator'}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, transparent 40%, rgba(148,234,239,0.02) 100%)' }} />
        
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
                <CalculatorIcon size={16} />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Premium Calculator</h3>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setShowHistory(!showHistory)} className={`rounded-lg p-1.5 transition-colors hover:bg-[var(--bg-hover)] ${showHistory ? 'bg-[var(--bg-active)] text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`} aria-label="History">
                <Clock size={16} />
              </button>
              <button type="button" onClick={() => setCalculatorOpen(false)} className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]" aria-label="Close">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-glass)] relative">
            
            {showHistory ? (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 premium-scrollbar">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Calculation History</h4>
                  {history.length > 0 && (
                    <button onClick={clearHistory} className="text-xs text-[var(--m-danger)] hover:underline">Clear</button>
                  )}
                </div>
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-[var(--text-muted)]">
                    <Clock size={24} className="mb-2 opacity-50" />
                    <p className="text-sm">No history yet</p>
                  </div>
                ) : (
                  history.map(item => (
                    <div key={item.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 shadow-sm flex flex-col gap-1">
                      <div className="text-xs text-[var(--text-muted)] text-right">{item.expression} =</div>
                      <div className="text-lg font-semibold text-[var(--text-primary)] text-right">{item.result}</div>
                      <div className="mt-2 flex gap-2 justify-end border-t border-[var(--border-subtle)] pt-2">
                        <button onClick={() => handleAskAi(item)} className="flex items-center gap-1 text-[11px] font-medium text-[var(--m-cyan)] hover:text-[var(--m-cyan-hover)] transition-colors">
                          <Sparkles size={12} /> Ask AI
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="flex flex-col flex-1">
                {/* Display */}
                <div className="px-5 py-6 flex flex-col items-end gap-1 bg-gradient-to-b from-transparent to-[var(--bg-base)]">
                  <div className="text-sm text-[var(--text-muted)] h-5 flex items-center gap-2">
                    {previousValue != null ? `${previousValue} ${operator}` : ''}
                  </div>
                  <div className="flex w-full items-center justify-between">
                    <button onClick={handleCopy} className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors p-1" title="Copy result">
                      {copied ? <Check size={16} className="text-[var(--m-success)]" /> : <Copy size={16} />}
                    </button>
                    <div className={`text-4xl font-light tracking-tight truncate max-w-[280px] ${currentValue === 'Error' ? 'text-[var(--m-danger)]' : 'text-[var(--text-primary)]'}`}>
                      {currentValue}
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex px-4 border-b border-[var(--border-subtle)]">
                  <button onClick={() => setActiveTab('basic')} className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'basic' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>Basic</button>
                  <button onClick={() => setActiveTab('finance')} className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'finance' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>Finance & Split</button>
                </div>

                {/* Keypad */}
                {activeTab === 'basic' ? (
                  <div className="grid grid-cols-4 gap-2 p-4 flex-1">
                    <CalcBtn onClick={clear} variant="danger">C</CalcBtn>
                    <CalcBtn onClick={backspace} variant="secondary">⌫</CalcBtn>
                    <CalcBtn onClick={inputPercent} variant="secondary">%</CalcBtn>
                    <CalcBtn onClick={() => performOperation('÷')} variant="primary" active={operator === '÷'}><Divide size={18} /></CalcBtn>

                    <CalcBtn onClick={() => inputDigit('7')}>7</CalcBtn>
                    <CalcBtn onClick={() => inputDigit('8')}>8</CalcBtn>
                    <CalcBtn onClick={() => inputDigit('9')}>9</CalcBtn>
                    <CalcBtn onClick={() => performOperation('×')} variant="primary" active={operator === '×'}><MultiplyIcon size={18} /></CalcBtn>

                    <CalcBtn onClick={() => inputDigit('4')}>4</CalcBtn>
                    <CalcBtn onClick={() => inputDigit('5')}>5</CalcBtn>
                    <CalcBtn onClick={() => inputDigit('6')}>6</CalcBtn>
                    <CalcBtn onClick={() => performOperation('-')} variant="primary" active={operator === '-'}><Minus size={18} /></CalcBtn>

                    <CalcBtn onClick={() => inputDigit('1')}>1</CalcBtn>
                    <CalcBtn onClick={() => inputDigit('2')}>2</CalcBtn>
                    <CalcBtn onClick={() => inputDigit('3')}>3</CalcBtn>
                    <CalcBtn onClick={() => performOperation('+')} variant="primary" active={operator === '+'}><Plus size={18} /></CalcBtn>

                    <CalcBtn onClick={toggleSign}>±</CalcBtn>
                    <CalcBtn onClick={() => inputDigit('0')}>0</CalcBtn>
                    <CalcBtn onClick={inputDot}>.</CalcBtn>
                    <CalcBtn onClick={calculateEquals} variant="accent">=</CalcBtn>
                  </div>
                ) : (
                  <div className="p-4 flex flex-col gap-4 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Value (%, months, people)</label>
                        <input 
                          type="number" 
                          value={financeInput}
                          onChange={(e) => setFinanceInput(e.target.value)}
                          placeholder="Enter a number..."
                          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--primary)]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <FinanceBtn icon={<Percent size={14} />} label="Discount" onClick={() => handleFinanceAction('discount')} disabled={!financeInput} />
                      <FinanceBtn icon={<Percent size={14} />} label="Markup" onClick={() => handleFinanceAction('markup')} disabled={!financeInput} />
                      <FinanceBtn icon={<Clock size={14} />} label="Installment" onClick={() => handleFinanceAction('installment')} disabled={!financeInput} />
                      <FinanceBtn icon={<Users size={14} />} label="Split Bill" onClick={() => handleFinanceAction('split')} disabled={!financeInput} />
                    </div>
                    <div className="mt-auto rounded-xl bg-indigo-500/10 p-3 flex gap-2 text-indigo-600 dark:text-indigo-400">
                      <Info size={16} className="shrink-0 mt-0.5" />
                      <p className="text-xs">Enter a value above and select an action to apply it to the current calculator amount ({currentValue}).</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function CalcBtn({ children, onClick, variant = 'default', active = false }: { children: React.ReactNode, onClick: () => void, variant?: 'default'|'primary'|'secondary'|'danger'|'accent', active?: boolean }) {
  const base = "flex h-12 items-center justify-center rounded-xl text-lg font-medium transition-all active:scale-95";
  const variants = {
    default: "bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] shadow-sm",
    primary: active ? "bg-[var(--primary)] text-white shadow-md shadow-brand-500/20" : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20",
    secondary: "bg-slate-500/10 text-slate-600 dark:text-slate-300 hover:bg-slate-500/20",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20",
    accent: "bg-gradient-to-br from-[var(--m-cyan)] to-[var(--m-vivid)] text-white shadow-md hover:brightness-110",
  };
  return (
    <button type="button" onClick={onClick} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  );
}

function FinanceBtn({ icon, label, onClick, disabled }: { icon: React.ReactNode, label: string, onClick: () => void, disabled: boolean }) {
  return (
    <button 
      type="button" 
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 text-sm font-medium text-[var(--text-primary)] transition-all hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:hover:bg-[var(--bg-card)] active:scale-95"
    >
      {icon} {label}
    </button>
  );
}
