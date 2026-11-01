import { useState, useCallback, useEffect } from 'react';

export type Operator = '+' | '-' | '×' | '÷' | null;

export interface HistoryItem {
  id: string;
  expression: string;
  result: string;
}

export function useCalculator() {
  const [currentValue, setCurrentValue] = useState('0');
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [operator, setOperator] = useState<Operator>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const formatNumber = (num: number) => {
    if (Number.isNaN(num) || !Number.isFinite(num)) return 'Error';
    return String(Math.round(num * 100000000) / 100000000);
  };

  const calculate = (a: string, b: string, op: Operator): string => {
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (isNaN(numA) || isNaN(numB)) return b;

    let res = 0;
    switch (op) {
      case '+': res = numA + numB; break;
      case '-': res = numA - numB; break;
      case '×': res = numA * numB; break;
      case '÷': res = numA / numB; break;
      default: return b;
    }
    return formatNumber(res);
  };

  const inputDigit = useCallback((digit: string) => {
    if (waitingForNewValue) {
      setCurrentValue(digit);
      setWaitingForNewValue(false);
    } else {
      setCurrentValue(currentValue === '0' && digit !== '.' ? digit : currentValue + digit);
    }
  }, [currentValue, waitingForNewValue]);

  const inputDot = useCallback(() => {
    if (waitingForNewValue) {
      setCurrentValue('0.');
      setWaitingForNewValue(false);
    } else if (currentValue.indexOf('.') === -1) {
      setCurrentValue(currentValue + '.');
    }
  }, [currentValue, waitingForNewValue]);

  const performOperation = useCallback((nextOperator: Operator) => {
    const inputValue = currentValue;

    if (previousValue == null) {
      setPreviousValue(inputValue);
    } else if (operator) {
      const result = calculate(previousValue, inputValue, operator);
      setCurrentValue(String(result));
      setPreviousValue(String(result));
      if (inputValue !== 'Error' && previousValue !== 'Error') {
        setHistory(prev => [{
          id: Date.now().toString(),
          expression: `${previousValue} ${operator} ${inputValue}`,
          result: String(result)
        }, ...prev]);
      }
    }

    setWaitingForNewValue(true);
    setOperator(nextOperator);
  }, [currentValue, previousValue, operator]);

  const calculateEquals = useCallback(() => {
    if (!operator || previousValue == null) return;
    const inputValue = currentValue;
    const result = calculate(previousValue, inputValue, operator);
    
    setCurrentValue(String(result));
    if (inputValue !== 'Error' && previousValue !== 'Error') {
      setHistory(prev => [{
        id: Date.now().toString(),
        expression: `${previousValue} ${operator} ${inputValue}`,
        result: String(result)
      }, ...prev]);
    }
    
    setPreviousValue(null);
    setOperator(null);
    setWaitingForNewValue(true);
  }, [currentValue, previousValue, operator]);

  const toggleSign = useCallback(() => {
    if (currentValue === 'Error') return;
    setCurrentValue(String(parseFloat(currentValue) * -1));
  }, [currentValue]);

  const inputPercent = useCallback(() => {
    if (currentValue === 'Error') return;
    const val = parseFloat(currentValue);
    setCurrentValue(String(val / 100));
  }, [currentValue]);

  const backspace = useCallback(() => {
    if (waitingForNewValue || currentValue === 'Error') return;
    setCurrentValue(currentValue.length > 1 ? currentValue.slice(0, -1) : '0');
  }, [currentValue, waitingForNewValue]);

  const clear = useCallback(() => {
    setCurrentValue('0');
    setPreviousValue(null);
    setOperator(null);
    setWaitingForNewValue(false);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  // Advanced functions
  const calculateDiscount = useCallback((percentage: number) => {
    const val = parseFloat(currentValue);
    if (isNaN(val)) return;
    const result = formatNumber(val - (val * (percentage / 100)));
    
    setHistory(prev => [{
      id: Date.now().toString(),
      expression: `${val} - ${percentage}%`,
      result
    }, ...prev]);
    
    setCurrentValue(result);
    setWaitingForNewValue(true);
  }, [currentValue]);
  
  const calculateMarkup = useCallback((percentage: number) => {
    const val = parseFloat(currentValue);
    if (isNaN(val)) return;
    const result = formatNumber(val + (val * (percentage / 100)));
    
    setHistory(prev => [{
      id: Date.now().toString(),
      expression: `${val} + ${percentage}%`,
      result
    }, ...prev]);
    
    setCurrentValue(result);
    setWaitingForNewValue(true);
  }, [currentValue]);

  const calculateInstallment = useCallback((months: number) => {
    const val = parseFloat(currentValue);
    if (isNaN(val) || months <= 0) return;
    const result = formatNumber(val / months);
    
    setHistory(prev => [{
      id: Date.now().toString(),
      expression: `${val} ÷ ${months} months`,
      result
    }, ...prev]);
    
    setCurrentValue(result);
    setWaitingForNewValue(true);
  }, [currentValue]);

  const calculateSplit = useCallback((people: number) => {
    const val = parseFloat(currentValue);
    if (isNaN(val) || people <= 0) return;
    const result = formatNumber(val / people);
    
    setHistory(prev => [{
      id: Date.now().toString(),
      expression: `${val} split by ${people}`,
      result
    }, ...prev]);
    
    setCurrentValue(result);
    setWaitingForNewValue(true);
  }, [currentValue]);

  const calculateSquare = useCallback(() => {
    const val = parseFloat(currentValue);
    if (isNaN(val)) return;
    const result = formatNumber(val * val);
    setHistory(prev => [{
      id: Date.now().toString(),
      expression: `sqr(${val})`,
      result
    }, ...prev]);
    setCurrentValue(result);
    setWaitingForNewValue(true);
  }, [currentValue]);

  const calculateSquareRoot = useCallback(() => {
    const val = parseFloat(currentValue);
    if (isNaN(val) || val < 0) {
      setCurrentValue('Error');
      return;
    }
    const result = formatNumber(Math.sqrt(val));
    setHistory(prev => [{
      id: Date.now().toString(),
      expression: `√(${val})`,
      result
    }, ...prev]);
    setCurrentValue(result);
    setWaitingForNewValue(true);
  }, [currentValue]);

  const calculateReciprocal = useCallback(() => {
    const val = parseFloat(currentValue);
    if (isNaN(val) || val === 0) {
      setCurrentValue('Error');
      return;
    }
    const result = formatNumber(1 / val);
    setHistory(prev => [{
      id: Date.now().toString(),
      expression: `1/(${val})`,
      result
    }, ...prev]);
    setCurrentValue(result);
    setWaitingForNewValue(true);
  }, [currentValue]);

  const convertCurrency = useCallback((toUsd: boolean, rate = 12850) => {
    const val = parseFloat(currentValue);
    if (isNaN(val) || val < 0) return;
    const result = toUsd
      ? formatNumber(Math.round((val / rate) * 100) / 100)
      : formatNumber(Math.round(val * rate));
    setHistory(prev => [{
      id: Date.now().toString(),
      expression: toUsd ? `${val} UZS ➔ USD` : `${val} USD ➔ UZS`,
      result
    }, ...prev]);
    setCurrentValue(result);
    setWaitingForNewValue(true);
  }, [currentValue]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input field somewhere else
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      const key = e.key;
      if (/[0-9]/.test(key)) {
        e.preventDefault();
        inputDigit(key);
      } else if (key === '.') {
        e.preventDefault();
        inputDot();
      } else if (key === '+' || key === '-') {
        e.preventDefault();
        performOperation(key as Operator);
      } else if (key === '*' || key === 'x') {
        e.preventDefault();
        performOperation('×');
      } else if (key === '/') {
        e.preventDefault();
        performOperation('÷');
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        calculateEquals();
      } else if (key === 'Backspace') {
        e.preventDefault();
        backspace();
      } else if (key === 'Escape') {
        e.preventDefault();
        clear();
      } else if (key === '%') {
        e.preventDefault();
        inputPercent();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputDigit, inputDot, performOperation, calculateEquals, backspace, clear, inputPercent]);

  return {
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
    calculateSplit,
    calculateSquare,
    calculateSquareRoot,
    calculateReciprocal,
    convertCurrency,
  };
}
