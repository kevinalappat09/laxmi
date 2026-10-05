import { useEffect, useMemo, useState } from 'react'
import type { Category } from '../../../../src/types/category'
import { buildCategoryPathMap } from '../../../../src/utils/categoryPaths'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

export function CategorySettings() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newParentId, setNewParentId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [editName, setEditName] = useState('')
  const [editParentId, setEditParentId] = useState('')

  const loadCategories = async () => {
    setLoading(true)
    try {
      setCategories(await window.financeAPI.listActiveCategories())
      setError(null)
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCategories()
  }, [])

  const categoryPathMap = useMemo(() => buildCategoryPathMap(categories), [categories])
  const categoryOptions = useMemo(
    () => [...categories].sort((a, b) => {
      const aPath = a.category_id === undefined
        ? a.category_name
        : categoryPathMap.get(a.category_id) ?? a.category_name
      const bPath = b.category_id === undefined
        ? b.category_name
        : categoryPathMap.get(b.category_id) ?? b.category_name
      return aPath.localeCompare(bPath)
    }),
    [categories, categoryPathMap]
  )

  const unavailableParentIds = useMemo(() => {
    if (!selectedId) return new Set<number>()

    const selectedCategoryId = Number(selectedId)
    const unavailable = new Set<number>([selectedCategoryId])
    let foundChild = true
    while (foundChild) {
      foundChild = false
      for (const category of categories) {
        if (
          category.category_id !== undefined
          && category.parent_category_id !== undefined
          && unavailable.has(category.parent_category_id)
          && !unavailable.has(category.category_id)
        ) {
          unavailable.add(category.category_id)
          foundChild = true
        }
      }
    }
    return unavailable
  }, [categories, selectedId])

  const handleSelectedCategoryChange = (categoryId: string) => {
    setSelectedId(categoryId)
    setMessage(null)
    setError(null)

    const category = categories.find((item) => String(item.category_id) === categoryId)
    setEditName(category?.category_name ?? '')
    setEditParentId(category?.parent_category_id ? String(category.parent_category_id) : '')
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    const categoryName = newName.trim()
    if (!categoryName) {
      setError('Category name is required.')
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await window.financeAPI.createCategory({
        category_name: categoryName,
        parent_category_id: newParentId ? Number(newParentId) : undefined,
      })
      setNewName('')
      setNewParentId('')
      setMessage(`Added “${categoryName}”.`)
      await loadCategories()
    } catch (createError) {
      setError(getErrorMessage(createError))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault()
    const categoryName = editName.trim()
    if (!selectedId || !categoryName) {
      setError('Select a category and enter a name.')
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await window.financeAPI.updateCategory(Number(selectedId), {
        category_name: categoryName,
        parent_category_id: editParentId ? Number(editParentId) : null,
      })
      setMessage(`Updated “${categoryName}”.`)
      await loadCategories()
    } catch (updateError) {
      setError(getErrorMessage(updateError))
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    if (!selectedId) return

    const category = categories.find((item) => String(item.category_id) === selectedId)
    if (!category) return

    const confirmed = window.confirm(
      `Deactivate “${categoryPathMap.get(Number(selectedId)) ?? category.category_name}”? Any child categories will also be deactivated.`
    )
    if (!confirmed) return

    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await window.financeAPI.deactivateCategory(Number(selectedId))
      setSelectedId('')
      setEditName('')
      setEditParentId('')
      setMessage(`Deactivated “${category.category_name}”.`)
      await loadCategories()
    } catch (deactivateError) {
      setError(getErrorMessage(deactivateError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form className="settings-page__category-form" onSubmit={handleCreate}>
        <Input
          id="new-category-name"
          label="New category name"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="e.g. Pet care"
          maxLength={80}
          disabled={saving}
        />
        <Select
          id="new-category-parent"
          label="Parent category (optional)"
          value={newParentId}
          onChange={(event) => setNewParentId(event.target.value)}
          disabled={saving || loading}
        >
          <option value="">No parent</option>
          {categoryOptions.map((category) => (
            <option key={category.category_id} value={category.category_id}>
              {category.category_id === undefined
                ? category.category_name
                : categoryPathMap.get(category.category_id) ?? category.category_name}
            </option>
          ))}
        </Select>
        <div className="settings-page__category-actions">
          <Button type="submit" variant="primary" disabled={saving || loading}>
            {saving ? 'Saving…' : 'Add category'}
          </Button>
        </div>
      </form>

      <div className="settings-page__category-divider" />

      <form className="settings-page__category-form" onSubmit={handleUpdate}>
        <Select
          id="manage-category"
          label="Manage an existing category"
          value={selectedId}
          onChange={(event) => handleSelectedCategoryChange(event.target.value)}
          disabled={saving || loading}
        >
          <option value="">Select a category</option>
          {categoryOptions.map((category) => (
            <option key={category.category_id} value={category.category_id}>
              {category.category_id === undefined
                ? category.category_name
                : categoryPathMap.get(category.category_id) ?? category.category_name}
            </option>
          ))}
        </Select>

        {selectedId && (
          <>
            <Input
              id="edit-category-name"
              label="Category name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              maxLength={80}
              disabled={saving}
            />
            <Select
              id="edit-category-parent"
              label="Parent category (optional)"
              value={editParentId}
              onChange={(event) => setEditParentId(event.target.value)}
              disabled={saving}
            >
              <option value="">No parent</option>
              {categoryOptions
                .filter((category) => (
                  category.category_id !== undefined
                  && !unavailableParentIds.has(category.category_id)
                ))
                .map((category) => (
                  <option key={category.category_id} value={category.category_id}>
                    {categoryPathMap.get(category.category_id!) ?? category.category_name}
                  </option>
                ))}
            </Select>
            <div className="settings-page__category-actions">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              <Button type="button" variant="danger" disabled={saving} onClick={handleDeactivate}>
                Deactivate
              </Button>
            </div>
          </>
        )}
      </form>

      <div className="settings-page__category-feedback" aria-live="polite">
        {loading && <span>Loading categories…</span>}
        {!loading && error && <span className="settings-page__error">{error}</span>}
        {!loading && !error && message && <span className="settings-page__success">{message}</span>}
        {!loading && !error && !message && <span>{categories.length} active categories</span>}
      </div>
    </>
  )
}
