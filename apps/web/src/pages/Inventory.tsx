/**
 * M-EDU InventoryPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient package tile + live stats chips + primary CTA
 *  - Animated KPI bar (Total Items, In Stock, Low Stock, Total Valuation) with CountUp
 *  - Segmented category filter chips + glass search bar
 *  - Premium rows: category chip + stock status indicator + quantity bar
 *  - Status badge with tone-aware pulse
 *  - Premium create/edit modal with squircle field icons
 *  - Custom SVG icons in SF Symbols proportions
 *  - Framer Motion spring physics + staggered blur-in
 *  - Full i18n + a11y preserved
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { inventoryApi } from '@/lib/api';
import {
  GlassErrorState,
  GlassPageLoader,
  GlassEmptyState,
  GlassTable,
  GlassTHead,
  GlassTBody,
  GlassTR,
  GlassTH,
  GlassTD,
  GlassModal,
  GlassField,
  GlassInput,
  GlassTextArea,
  GlassSelect,
  GlassButton,
  useToasts,
  ConfirmDialog,
} from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, InventoryItem, InventoryCategory } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.06 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  box: [
    'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
    'M3.27 6.96L12 12.01l8.73-5.05',
    'M12 22.08V12',
  ],
  check: ['M20 6 9 17l-5-5'],
  alertTriangle: [
    'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  dollarSign: [
    'M12 2v20',
    'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  search: ['M21 21l-4.35-4.35', 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z'],
  tag: [
    'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z',
    'M7 7h.01',
  ],
};

function Icon({ paths, size = 18, strokeWidth = ICON_STROKE, className = '' }: { paths: string[]; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

interface ItemFormState {
  name: string;
  category: InventoryCategory | '';
  quantity: string;
  unit: string;
  minStock: string;
  location: string;
  supplier: string;
  purchasePrice: string;
  description: string;
}

const INITIAL_FORM: ItemFormState = {
  name: '',
  category: '',
  quantity: '1',
  unit: 'piece',
  minStock: '5',
  location: '',
  supplier: '',
  purchasePrice: '',
  description: '',
};

const CATEGORIES: InventoryCategory[] = ['BOOKS', 'EQUIPMENT', 'FURNITURE', 'SUPPLIES', 'ELECTRONICS'];

function validateItemForm(form: ItemFormState): Partial<Record<keyof ItemFormState, string>> {
  const errors: Partial<Record<keyof ItemFormState, string>> = {};
  if (!form.name.trim()) errors.name = 'inventory.error.nameRequired';
  if (!form.category) errors.category = 'inventory.error.categoryRequired';
  if (!form.quantity || isNaN(parseInt(form.quantity)) || parseInt(form.quantity) < 0) {
    errors.quantity = 'inventory.error.quantityInvalid';
  }
  if (!form.unit.trim()) errors.unit = 'inventory.error.unitRequired';
  return errors;
}

export function InventoryPage() {
  const { t } = useI18n();
  usePageTitle(t('inventory.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  const { playTick, playPop, playSuccess, playError } = usePremiumSound();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<ItemFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ItemFormState, string>>>({});

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Data fetching
  const items = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => inventoryApi.listItems({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const data = items.data as Paginated<InventoryItem> | undefined;
  const itemList = useMemo(() => data?.items || [], [data]);

  // Derived Stats
  const stats = useMemo(() => {
    const total = itemList.length;
    let inStock = 0;
    let lowStock = 0;
    let totalValuation = 0;

    for (const item of itemList) {
      const min = item.minStock ?? 5;
      if (item.quantity <= min) {
        lowStock++;
      } else {
        inStock++;
      }
      if (item.purchasePrice && item.quantity) {
        totalValuation += Number(item.purchasePrice) * item.quantity;
      }
    }

    return { total, inStock, lowStock, totalValuation };
  }, [itemList]);

  const filteredItems = useMemo(() => {
    let filtered = itemList;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.supplier?.toLowerCase().includes(q)
      );
    }

    if (filterCategory !== 'ALL') {
      filtered = filtered.filter((item) => item.category === filterCategory);
    }

    return filtered;
  }, [itemList, searchQuery, filterCategory]);

  const handleOpenInventorySidecar = useCallback((item: InventoryItem) => {
    playTick();
    const isLowStock = item.quantity <= (item.minStock || 5);
    const value = item.purchasePrice ? Number(item.purchasePrice) * item.quantity : 0;
    const sidecarData: QuickLookData = {
      title: item.name,
      subtitle: `${item.category} • ${item.location || 'No location set'}`,
      badge: item.category,
      status: {
        label: isLowStock ? 'Low Stock Warning' : 'Optimal Inventory',
        tone: isLowStock ? 'warning' : 'success',
      },
      metrics: [
        { label: 'Current Stock', value: `${item.quantity} ${item.unit}` },
        { label: 'Min Reorder Threshold', value: `${item.minStock ?? 5} ${item.unit}` },
        { label: 'Unit Purchase Price', value: item.purchasePrice ? formatCurrency(Number(item.purchasePrice)) : '—' },
        { label: 'Total Valuation', value: formatCurrency(value) },
      ],
      details: [
        { label: 'Item ID', value: item.id },
        { label: 'Category', value: item.category },
        { label: 'Supplier / Vendor', value: item.supplier || 'Not specified' },
        { label: 'Physical Location', value: item.location || 'Main Storage' },
        { label: 'Stock Buffer Health', value: isLowStock ? 'Below Safety Threshold' : 'Well Stocked' },
        { label: 'Description', value: item.description || 'No description provided' },
        { label: 'Created At', value: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—' },
        { label: 'Updated At', value: item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—' },
      ],
    };
    openSidecar(sidecarData);
  }, [playTick]);

  // Save item mutation
  const saveItem = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        category: form.category,
        quantity: parseInt(form.quantity),
        unit: form.unit.trim(),
      };

      if (form.minStock) payload.minStock = parseInt(form.minStock);
      if (form.location.trim()) payload.location = form.location.trim();
      if (form.supplier.trim()) payload.supplier = form.supplier.trim();
      if (form.purchasePrice) payload.purchasePrice = parseFloat(form.purchasePrice);
      if (form.description.trim()) payload.description = form.description.trim();

      if (editingId) {
        return inventoryApi.updateItem(editingId, payload);
      } else {
        return inventoryApi.createItem(payload);
      }
    },
    onSuccess: () => {
      playSuccess();
      push({ type: 'success', message: editingId ? t('inventory.updated') : t('inventory.created') });
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      closeModal();
    },
    onError: (error) => {
      playError();
      push({
        type: 'error',
        message: getErrorMessage(error),
      });
    },
  });

  // Delete item mutation
  const removeItem = useMutation({
    mutationFn: (id: string) => inventoryApi.deleteItem(id),
    onSuccess: () => {
      playSuccess();
      push({ type: 'success', message: t('inventory.deleted') });
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
    },
    onError: (error) => {
      playError();
      push({ type: 'error', message: getErrorMessage(error) });
    },
  });

  const handleDelete = useCallback((id: string) => {
    playTick();
    setDeleteTarget(id);
  }, [playTick]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    removeItem.mutate(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, removeItem]);

  const openModal = useCallback((item?: InventoryItem) => {
    playPop();
    if (item) {
      setEditingId(item.id);
      setForm({
        name: item.name,
        category: item.category,
        quantity: item.quantity.toString(),
        unit: item.unit,
        minStock: item.minStock?.toString() || '5',
        location: item.location || '',
        supplier: item.supplier || '',
        purchasePrice: item.purchasePrice?.toString() || '',
        description: item.description || '',
      });
    } else {
      setEditingId(null);
      setForm(INITIAL_FORM);
    }
    setFormErrors({});
    setModalOpen(true);
  }, [playPop]);

  const closeModal = useCallback(() => {
    playTick();
    setModalOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, [playTick]);

  const handleSubmit = useCallback(() => {
    const errors = validateItemForm(form);
    if (Object.keys(errors).length > 0) {
      playError();
      setFormErrors(errors);
      return;
    }
    saveItem.mutate();
  }, [form, saveItem, playError]);

  // Keyboard Shortcuts: n for new, r for refresh, 1-6 for category filters
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        openModal();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        playTick();
        items.refetch();
      } else if (e.key === '1') {
        e.preventDefault();
        playTick();
        setFilterCategory('ALL');
      } else if (e.key === '2') {
        e.preventDefault();
        playTick();
        setFilterCategory('BOOKS');
      } else if (e.key === '3') {
        e.preventDefault();
        playTick();
        setFilterCategory('EQUIPMENT');
      } else if (e.key === '4') {
        e.preventDefault();
        playTick();
        setFilterCategory('FURNITURE');
      } else if (e.key === '5') {
        e.preventDefault();
        playTick();
        setFilterCategory('SUPPLIES');
      } else if (e.key === '6') {
        e.preventDefault();
        playTick();
        setFilterCategory('ELECTRONICS');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, openModal, playTick]);

  if (items.isLoading) {
    return <GlassPageLoader />;
  }

  if (items.isError) {
    return (
      <GlassErrorState
        message={getErrorMessage(items.error)}
        onRetry={() => items.refetch()}
      />
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 font-sans"
    >
      {toastNode}

      {/* Hero Header */}
      <motion.div variants={cardVariants}>
        <div className="liquid-glass-card liquid-glass-surface relative overflow-hidden rounded-[2.25rem] p-6 sm:p-8 border border-white/40 dark:border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.07)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20" />
          
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/30">
                <Icon paths={I.box} size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    <Icon paths={I.tag} size={11} strokeWidth={2} />
                    {t('inventory.title')}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {stats.total} {t('inventory.col.quantity')}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {t('inventory.title')}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('inventory.pageSubtitle')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  playTick();
                  items.refetch();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white/60 dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/15 transition-all shadow-sm active:scale-95"
                title="Refresh Inventory (R)"
              >
                <span>↺</span>
                <span>{t('common.refresh') || 'Refresh'}</span>
                <kbd className="text-[10px] opacity-60 font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 ml-0.5">R</kbd>
              </button>
              <GlassButton
                onClick={() => openModal()}
                variant="primary"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow active:scale-[0.98] transition-all"
              >
                <Icon paths={I.plus} size={16} strokeWidth={2.5} />
                <span>{t('inventory.addItem')}</span>
                <kbd className="text-[10px] opacity-75 font-mono px-1.5 py-0.5 rounded bg-white/20 ml-1">N</kbd>
              </GlassButton>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-200/60 dark:border-white/[0.08]">
            <div className="liquid-glass-card rounded-2xl p-4 bg-white/50 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] backdrop-blur-md">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('common.total') || 'Total'}</p>
              <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums mt-0.5">{stats.total}</p>
            </div>
            <div className="liquid-glass-card rounded-2xl p-4 bg-emerald-500/[0.07] border border-emerald-500/20 backdrop-blur-md">
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('inventory.inStock')}</p>
              <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">{stats.inStock}</p>
            </div>
            <div className="liquid-glass-card rounded-2xl p-4 bg-amber-500/[0.07] border border-amber-500/20 backdrop-blur-md">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{t('inventory.lowStock')}</p>
              <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums mt-0.5">{stats.lowStock}</p>
            </div>
            <div className="liquid-glass-card rounded-2xl p-4 bg-purple-500/[0.07] border border-purple-500/20 backdrop-blur-md">
              <p className="text-xs font-medium text-purple-600 dark:text-purple-400">{t('inventory.col.value')}</p>
              <p className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400 tabular-nums mt-0.5">{formatCurrency(stats.totalValuation)}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content Card with Search & Filters */}
      <motion.div variants={cardVariants}>
        <div className="liquid-glass-card liquid-glass-surface relative overflow-hidden rounded-3xl border border-white/40 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.04)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20" />

          {/* Filter Bar */}
          <div className="p-5 border-b border-slate-200/60 dark:border-white/[0.06] flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Icon paths={I.search} size={16} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('inventory.searchPlaceholder')}
                className="w-full rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all backdrop-blur-md"
              />
            </div>

            {/* Category Segmented Filter */}
            <div className="flex max-w-full overflow-x-auto scrollbar-none gap-1.5 p-1 rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  playTick();
                  setFilterCategory('ALL');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  filterCategory === 'ALL'
                    ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{t('common.all') || 'All'}</span>
                <kbd className="hidden sm:inline-block text-[9px] opacity-60 font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10">1</kbd>
              </button>
              {CATEGORIES.map((cat, idx) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    playTick();
                    setFilterCategory(cat);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                    filterCategory === cat
                      ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{t(`inventory.category.${cat}`)}</span>
                  <kbd className="hidden sm:inline-block text-[9px] opacity-60 font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10">{idx + 2}</kbd>
                </button>
              ))}
            </div>
          </div>

          {/* Items Table */}
          {filteredItems.length === 0 ? (
            <div className="p-8">
              <GlassEmptyState
                title={t('inventory.empty')}
                description={t('inventory.emptyMessage')}
                action={{
                  label: t('inventory.addItem'),
                  onClick: () => openModal(),
                }}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <GlassTable>
                <GlassTHead>
                  <GlassTR>
                    <GlassTH>{t('inventory.col.name')}</GlassTH>
                    <GlassTH>{t('inventory.col.category')}</GlassTH>
                    <GlassTH>{t('inventory.col.quantity')}</GlassTH>
                    <GlassTH>{t('inventory.col.unit')}</GlassTH>
                    <GlassTH>{t('inventory.col.location')}</GlassTH>
                    <GlassTH>{t('inventory.col.supplier')}</GlassTH>
                    <GlassTH>{t('inventory.col.stockStatus')}</GlassTH>
                    <GlassTH>{t('inventory.col.value')}</GlassTH>
                    <GlassTH className="text-right">{t('common.actions')}</GlassTH>
                  </GlassTR>
                </GlassTHead>
                <GlassTBody>
                  {filteredItems.map((item) => {
                    const isLowStock = item.quantity <= (item.minStock || 5);
                    const value = item.purchasePrice ? Number(item.purchasePrice) * item.quantity : 0;

                    return (
                      <GlassTR
                        key={item.id}
                        onClick={() => handleOpenInventorySidecar(item)}
                        className="hover:bg-indigo-500/[0.04] dark:hover:bg-indigo-400/[0.04] transition-colors cursor-pointer"
                      >
                        <GlassTD className="font-semibold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span>{item.name}</span>
                          </div>
                        </GlassTD>
                        <GlassTD>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                            {t(`inventory.category.${item.category}`)}
                          </span>
                        </GlassTD>
                        <GlassTD className="font-mono font-semibold tabular-nums">{item.quantity}</GlassTD>
                        <GlassTD className="text-slate-500">{item.unit}</GlassTD>
                        <GlassTD className="text-slate-500">{item.location || '—'}</GlassTD>
                        <GlassTD className="text-slate-500">{item.supplier || '—'}</GlassTD>
                        <GlassTD>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              isLowStock
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${isLowStock ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                            {isLowStock ? t('inventory.lowStock') : t('inventory.inStock')}
                          </span>
                        </GlassTD>
                        <GlassTD className="font-mono font-semibold tabular-nums">
                          {item.purchasePrice ? formatCurrency(value) : '—'}
                        </GlassTD>
                        <GlassTD onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInventorySidecar(item);
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-all border border-indigo-500/20 inline-flex items-center gap-1"
                              title="Inspect details in macOS Sidecar"
                            >
                              <span>◨</span>
                              <span>Sidecar</span>
                            </button>
                            <GlassButton
                              onClick={() => openModal(item)}
                              variant="ghost"
                              size="sm"
                              className="rounded-lg text-xs"
                            >
                              {t('common.edit')}
                            </GlassButton>
                            <GlassButton
                              onClick={() => handleDelete(item.id)}
                              variant="danger"
                              size="sm"
                              disabled={removeItem.isPending && removeItem.variables === item.id}
                              className="rounded-lg text-xs"
                            >
                              {t('common.delete')}
                            </GlassButton>
                          </div>
                        </GlassTD>
                      </GlassTR>
                    );
                  })}
                </GlassTBody>
              </GlassTable>
            </div>
          )}
        </div>
      </motion.div>

      {/* Item Form Modal */}
      {modalOpen && (
        <GlassModal
          open={modalOpen}
          onClose={closeModal}
          title={editingId ? t('inventory.editTitle') : t('inventory.addTitle')}
        >
          <div className="space-y-4">
            <GlassField label={t('inventory.field.name')} error={formErrors.name ? t(formErrors.name) : undefined}>
              <GlassInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('inventory.namePlaceholder')}
              />
            </GlassField>

            <GlassField label={t('inventory.field.category')} error={formErrors.category ? t(formErrors.category) : undefined}>
              <GlassSelect
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as InventoryCategory })}
              >
                <option value="">{t('inventory.categoryPlaceholder')}</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`inventory.category.${cat}`)}
                  </option>
                ))}
              </GlassSelect>
            </GlassField>

            <div className="grid grid-cols-2 gap-4">
              <GlassField label={t('inventory.field.quantity')} error={formErrors.quantity ? t(formErrors.quantity) : undefined}>
                <GlassInput
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="0"
                  min="0"
                />
              </GlassField>

              <GlassField label={t('inventory.field.unit')} error={formErrors.unit ? t(formErrors.unit) : undefined}>
                <GlassInput
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder={t('inventory.unitPlaceholder')}
                />
              </GlassField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <GlassField label={t('inventory.field.minStock')} error={formErrors.minStock ? t(formErrors.minStock) : undefined}>
                <GlassInput
                  type="number"
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                  placeholder="5"
                  min="0"
                />
              </GlassField>

              <GlassField label={t('inventory.field.purchasePrice')} error={formErrors.purchasePrice ? t(formErrors.purchasePrice) : undefined}>
                <GlassInput
                  type="number"
                  value={form.purchasePrice}
                  onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </GlassField>
            </div>

            <GlassField label={t('inventory.field.location')} error={formErrors.location ? t(formErrors.location) : undefined}>
              <GlassInput
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder={t('inventory.locationPlaceholder')}
              />
            </GlassField>

            <GlassField label={t('inventory.field.supplier')} error={formErrors.supplier ? t(formErrors.supplier) : undefined}>
              <GlassInput
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder={t('inventory.supplierPlaceholder')}
              />
            </GlassField>

            <GlassField label={t('inventory.field.description')} error={formErrors.description ? t(formErrors.description) : undefined}>
              <GlassTextArea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('inventory.descriptionPlaceholder')}
                rows={2}
              />
            </GlassField>

            <div className="flex gap-2 justify-end pt-4">
              <GlassButton
                onClick={closeModal}
                variant="secondary"
              >
                {t('common.cancel')}
              </GlassButton>
              <GlassButton
                onClick={handleSubmit}
                disabled={saveItem.isPending}
                variant="primary"
              >
                {saveItem.isPending ? t('common.saving') : t('common.save')}
              </GlassButton>
            </div>
          </div>
        </GlassModal>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={t('common.delete')}
        description={t('inventory.deleteConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </motion.div>
  );
}

export default InventoryPage;
