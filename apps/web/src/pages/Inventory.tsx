import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '@/lib/api';
import {
  PageHeader,
  Card,
  PageLoader,
  ErrorState,
  EmptyState,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Modal,
  Field,
  TextInput,
  TextArea,
  Select,
  Badge,
  GlassButton,
  useToasts,
  ConfirmDialog,
} from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, InventoryItem, InventoryCategory } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

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

// Mirrors the backend/DB enum (Prisma InventoryCategory has no OTHER).
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

function getCategoryBadge(category: InventoryCategory): { color: string; label: string } {
  const badges: Record<InventoryCategory, { color: string; label: string }> = {
    BOOKS: { color: 'blue', label: 'inventory.category.BOOKS' },
    EQUIPMENT: { color: 'purple', label: 'inventory.category.EQUIPMENT' },
    FURNITURE: { color: 'amber', label: 'inventory.category.FURNITURE' },
    SUPPLIES: { color: 'green', label: 'inventory.category.SUPPLIES' },
    ELECTRONICS: { color: 'indigo', label: 'inventory.category.ELECTRONICS' },
    OTHER: { color: 'slate', label: 'inventory.category.OTHER' },
  };
  return badges[category];
}

export function InventoryPage() {
  const { t } = useI18n();
  usePageTitle(t('inventory.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<ItemFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ItemFormState, string>>>({});

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Data fetching
  const items = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => inventoryApi.listItems({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const data = items.data as Paginated<InventoryItem> | undefined;
  const itemList = useMemo(() => data?.items || [], [data]);

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

    if (filterCategory) {
      filtered = filtered.filter((item) => item.category === filterCategory);
    }

    return filtered;
  }, [itemList, searchQuery, filterCategory]);

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
      push({ type: 'success', message: editingId ? t('inventory.updated') : t('inventory.created') });
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      closeModal();
    },
    onError: (error) => {
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
      push({ type: 'success', message: t('inventory.deleted') });
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
    },
    onError: (error) => {
      push({ type: 'error', message: getErrorMessage(error) });
    },
  });

  const handleDelete = useCallback((id: string) => {
    setDeleteTarget(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    removeItem.mutate(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, removeItem]);

  const openModal = useCallback((item?: InventoryItem) => {
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
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleSubmit = useCallback(() => {
    const errors = validateItemForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    saveItem.mutate();
  }, [form, saveItem]);

  if (items.isLoading) {
    return <PageLoader />;
  }

  if (items.isError) {
    return (
      <ErrorState
        message={getErrorMessage(items.error)}
        onRetry={() => items.refetch()}
      />
    );
  }

  return (
    <div className="page-container">
      

      <div className="space-y-4" style={{ position: 'relative', zIndex: 1 }}>
        {toastNode}

      <PageHeader
        title={t('inventory.title')}
        subtitle={t('inventory.pageSubtitle')}
        action={{
          label: t('inventory.addItem'),
          onClick: () => openModal(),
        }}
      />

      <Card>
        <div className="p-4 border-b space-y-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex gap-4">
            <div className="flex-1">
              <TextInput
                placeholder={t('inventory.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="">{t('inventory.allCategories')}</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`inventory.category.${cat}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <EmptyState
            title={searchQuery || filterCategory ? t('inventory.emptySearch') : t('inventory.empty')}
            description={
              searchQuery || filterCategory
                ? t('certificates.emptySearchHint')
                : t('inventory.emptyMessage')
            }
            action={!searchQuery && !filterCategory ? { label: t('inventory.addItem'), onClick: () => openModal() } : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>{t('inventory.col.name')}</TH>
                  <TH>{t('inventory.col.category')}</TH>
                  <TH>{t('inventory.col.quantity')}</TH>
                  <TH>{t('inventory.col.unit')}</TH>
                  <TH>{t('inventory.col.location')}</TH>
                  <TH>{t('inventory.col.supplier')}</TH>
                  <TH>{t('inventory.col.stockStatus')}</TH>
                  <TH>{t('inventory.col.value')}</TH>
                  <TH>{t('common.actions')}</TH>
                </TR>
              </THead>
              <TBody>
                {filteredItems.map((item) => {
                  const categoryBadge = getCategoryBadge(item.category);
                  const isLowStock = item.minStock && item.quantity <= item.minStock;
                  const value = item.quantity * (item.purchasePrice || 0);

                  return (
                    <TR key={item.id}>
                      <TD className="font-medium">{item.name}</TD>
                      <TD>
                        <Badge variant={categoryBadge.color === 'blue' ? 'primary' : categoryBadge.color === 'purple' ? 'primary' : categoryBadge.color === 'amber' ? 'warning' : categoryBadge.color === 'green' ? 'success' : categoryBadge.color === 'indigo' ? 'cyan' : 'muted'}>
                          {t(categoryBadge.label)}
                        </Badge>
                      </TD>
                      <TD className="font-mono">{item.quantity}</TD>
                      <TD>{item.unit}</TD>
                      <TD>{item.location || '—'}</TD>
                      <TD>{item.supplier || '—'}</TD>
                      <TD>
                        <Badge variant={isLowStock ? 'error' : 'success'}>
                          {isLowStock ? t('inventory.lowStock') : t('inventory.inStock')}
                        </Badge>
                      </TD>
                      <TD>{item.purchasePrice ? formatCurrency(value) : '—'}</TD>
                      <TD>
                        <div className="flex gap-2">
                          <GlassButton
                            onClick={() => openModal(item)}
                            variant="ghost"
                            size="sm"
                          >
                            {t('common.edit')}
                          </GlassButton>
                          <GlassButton
                            onClick={() => handleDelete(item.id)}
                            variant="danger"
                            size="sm"
                            disabled={removeItem.isPending && removeItem.variables === item.id}
                          >
                            {t('common.delete')}
                          </GlassButton>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Item Form Modal */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={closeModal}
          title={editingId ? t('inventory.editTitle') : t('inventory.addTitle')}
        >
          <div className="space-y-4">
            <Field label={t('inventory.field.name')} error={formErrors.name ? t(formErrors.name) : undefined}>
              <TextInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('inventory.namePlaceholder')}
              />
            </Field>

            <Field label={t('inventory.field.category')} error={formErrors.category ? t(formErrors.category) : undefined}>
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as InventoryCategory })}
              >
                <option value="">{t('inventory.categoryPlaceholder')}</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`inventory.category.${cat}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t('inventory.field.quantity')} error={formErrors.quantity ? t(formErrors.quantity) : undefined}>
                <TextInput
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="0"
                  min="0"
                />
              </Field>

              <Field label={t('inventory.field.unit')} error={formErrors.unit ? t(formErrors.unit) : undefined}>
                <TextInput
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder={t('inventory.unitPlaceholder')}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t('inventory.field.minStock')} error={formErrors.minStock ? t(formErrors.minStock) : undefined}>
                <TextInput
                  type="number"
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                  placeholder="5"
                  min="0"
                />
              </Field>

              <Field label={t('inventory.field.purchasePrice')} error={formErrors.purchasePrice ? t(formErrors.purchasePrice) : undefined}>
                <TextInput
                  type="number"
                  value={form.purchasePrice}
                  onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </Field>
            </div>

            <Field label={t('inventory.field.location')} error={formErrors.location ? t(formErrors.location) : undefined}>
              <TextInput
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder={t('inventory.locationPlaceholder')}
              />
            </Field>

            <Field label={t('inventory.field.supplier')} error={formErrors.supplier ? t(formErrors.supplier) : undefined}>
              <TextInput
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder={t('inventory.supplierPlaceholder')}
              />
            </Field>

            <Field label={t('inventory.field.description')} error={formErrors.description ? t(formErrors.description) : undefined}>
              <TextArea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('inventory.descriptionPlaceholder')}
                rows={2}
              />
            </Field>

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
        </Modal>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        description={t('inventory.deleteConfirm')}
        loading={removeItem.isPending}
      />
      </div>
    </div>
  );
}
