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
  useToasts,
} from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, InventoryItem, InventoryCategory } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

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

  if (!form.name.trim()) errors.name = 'Name is required';
  if (!form.category) errors.category = 'Category is required';
  if (!form.quantity || isNaN(parseInt(form.quantity)) || parseInt(form.quantity) < 0) {
    errors.quantity = 'Valid quantity is required';
  }
  if (!form.unit.trim()) errors.unit = 'Unit is required';

  return errors;
}

function getCategoryBadge(category: InventoryCategory): { color: string; label: string } {
  const badges: Record<InventoryCategory, { color: string; label: string }> = {
    BOOKS: { color: 'blue', label: 'Books' },
    EQUIPMENT: { color: 'purple', label: 'Equipment' },
    FURNITURE: { color: 'amber', label: 'Furniture' },
    SUPPLIES: { color: 'green', label: 'Supplies' },
    ELECTRONICS: { color: 'indigo', label: 'Electronics' },
    OTHER: { color: 'slate', label: 'Other' },
  };
  return badges[category];
}

export function InventoryPage() {
  usePageTitle('Inventory');
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
      push({ type: 'success', message: editingId ? 'Item updated' : 'Item created' });
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
      <div className="orb-container" aria-hidden="true">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
      </div>

      <div className="space-y-4" style={{ position: 'relative', zIndex: 1 }}>
        {toastNode}

      <PageHeader
        title="Inventory"
        subtitle="Manage inventory items and transactions"
        action={{
          label: 'Add Item',
          onClick: () => openModal(),
        }}
      />

      <Card>
        <div className="p-4 border-b space-y-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex gap-4">
            <div className="flex-1">
              <TextInput
                placeholder="Search items by name, category, or supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <EmptyState
            title={searchQuery || filterCategory ? 'No items found' : 'No inventory yet'}
            description={
              searchQuery || filterCategory
                ? 'Try adjusting your search criteria'
                : 'Add your first inventory item to get started'
            }
            action={!searchQuery && !filterCategory ? { label: 'Add Item', onClick: () => openModal() } : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Item Name</TH>
                  <TH>Category</TH>
                  <TH>Quantity</TH>
                  <TH>Unit</TH>
                  <TH>Location</TH>
                  <TH>Supplier</TH>
                  <TH>Stock Status</TH>
                  <TH>Value</TH>
                  <TH>Actions</TH>
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
                          {categoryBadge.label}
                        </Badge>
                      </TD>
                      <TD className="font-mono">{item.quantity}</TD>
                      <TD>{item.unit}</TD>
                      <TD>{item.location || '—'}</TD>
                      <TD>{item.supplier || '—'}</TD>
                      <TD>
                        <Badge variant={isLowStock ? 'error' : 'success'}>
                          {isLowStock ? 'Low Stock' : 'In Stock'}
                        </Badge>
                      </TD>
                      <TD>{item.purchasePrice ? formatCurrency(value) : '—'}</TD>
                      <TD>
                        <button
                          onClick={() => openModal(item)}
                          className="glass-btn glass-btn-ghost glass-btn-sm"
                        >
                          Edit
                        </button>
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
          title={editingId ? 'Edit Inventory Item' : 'Add Inventory Item'}
        >
          <div className="space-y-4">
            <Field label="Item Name *" error={formErrors.name}>
              <TextInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter item name"
              />
            </Field>

            <Field label="Category *" error={formErrors.category}>
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as InventoryCategory })}
              >
                <option value="">Select category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Quantity *" error={formErrors.quantity}>
                <TextInput
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="0"
                  min="0"
                />
              </Field>

              <Field label="Unit *" error={formErrors.unit}>
                <TextInput
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="e.g., piece, box, kg"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Minimum Stock" error={formErrors.minStock}>
                <TextInput
                  type="number"
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                  placeholder="5"
                  min="0"
                />
              </Field>

              <Field label="Purchase Price" error={formErrors.purchasePrice}>
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

            <Field label="Location" error={formErrors.location}>
              <TextInput
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Storage location"
              />
            </Field>

            <Field label="Supplier" error={formErrors.supplier}>
              <TextInput
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder="Supplier name"
              />
            </Field>

            <Field label="Description" error={formErrors.description}>
              <TextArea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Item description"
                rows={2}
              />
            </Field>

            <div className="flex gap-2 justify-end pt-4">
              <button
                onClick={closeModal}
                className="glass-btn glass-btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saveItem.isPending}
                className="glass-btn glass-btn-primary"
              >
                {saveItem.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      </div>
    </div>
  );
}
