'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useParams, useRouter } from 'next/navigation'
import { Navigation } from '@/components/Navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  Layers
} from 'lucide-react'
import Link from 'next/link'

// WBS Item type
interface WbsItem {
  id: string
  tempId?: string
  projectId: string
  smartsheetRowId?: string | null
  parentRowId?: string | null
  parentId?: string | null
  name: string
  description?: string | null
  ownerLastName?: string | null
  approverLastName?: string | null
  status: string
  startDate?: string | null
  endDate?: string | null
  atRisk: boolean
  budget?: string | null
  actual?: string | null
  variance?: string | null
  notes?: string | null
  skipWbs: boolean
  orderIndex: number
  children: WbsItem[]
  isExpanded: boolean
  depth: number
  wbsNumber: string
}

interface ProjectInfo {
  id: string
  projectCode: string
  title: string
  status: string
  category?: string | null
  wbsSheetId?: string | null
  wbsSheetUrl?: string | null
}

// Status options - matches Smartsheet dropdown exactly
const STATUS_OPTIONS = [
  { value: 'Not_Started', label: 'Not Started', color: 'bg-gray-100 text-gray-800' },
  { value: 'In_Progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  { value: 'Blocked', label: 'Blocked', color: 'bg-red-100 text-red-800' },
  { value: 'Complete', label: 'Complete', color: 'bg-green-100 text-green-800' },
]

// Team members list - Transmission team (matches login users)
const TEAM_MEMBERS = [
  'Adams', 'Allen', 'Barringer', 'Campbell', 'Clark', 'Donahue', 'Egbert',
  'Elswick', 'Fields', 'Forster', 'Galloway', 'Green', 'Hicks', 'Holskey',
  'Huff', 'McCord', 'Merritt', 'Privette', 'Roberts', 'Southall', 'Thomas',
  'Thompson', 'Waugh', 'Woodworth'
]

function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Format currency value for display
function formatCurrency(value: string | null | undefined): string {
  if (!value) return ''
  const num = parseFloat(String(value).replace(/[^0-9.-]+/g, ''))
  if (isNaN(num)) return value
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num)
}

// Parse currency string back to number for saving
function parseCurrencyValue(value: string): string | null {
  if (!value) return null
  const cleaned = value.replace(/[^0-9.-]+/g, '')
  if (!cleaned || cleaned === '') return null
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : String(num)
}

// Build hierarchical tree from flat data using parentRowId (Smartsheet) or parentId (local)
function buildHierarchy(flatItems: any[]): WbsItem[] {
  const itemMap = new Map<string, WbsItem>()
  const rootItems: WbsItem[] = []

  // First pass: create all items with initial properties
  flatItems.forEach((item) => {
    const wbsItem: WbsItem = {
      id: item.id,
      tempId: item.tempId,
      projectId: item.projectId,
      smartsheetRowId: item.smartsheetRowId,
      parentRowId: item.parentRowId,
      parentId: item.parentId,
      name: item.name || 'Unnamed',
      description: item.description,
      ownerLastName: item.ownerLastName,
      approverLastName: item.approverLastName,
      status: item.status || 'Not_Started',
      startDate: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : null,
      endDate: item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : null,
      atRisk: item.atRisk || false,
      budget: item.budget,
      actual: item.actual,
      variance: item.variance,
      notes: item.notes,
      skipWbs: item.skipWbs || false,
      orderIndex: item.orderIndex ?? 0,
      children: [],
      isExpanded: true,
      depth: 0,
      wbsNumber: ''
    }
    
    // Map by both id AND smartsheetRowId for linking
    itemMap.set(item.id, wbsItem)
    if (item.smartsheetRowId) {
      itemMap.set(item.smartsheetRowId, wbsItem)
    }
  })

  // Second pass: build hierarchy using parentRowId (from Smartsheet) or parentId (local)
  flatItems.forEach((item) => {
    const wbsItem = itemMap.get(item.id)!
    const parentKey = item.parentRowId || item.parentId
    
    if (parentKey && itemMap.has(parentKey)) {
      const parent = itemMap.get(parentKey)!
      parent.children.push(wbsItem)
    } else {
      rootItems.push(wbsItem)
    }
  })

  // Sort children by orderIndex at each level
  const sortChildren = (items: WbsItem[]) => {
    items.sort((a, b) => a.orderIndex - b.orderIndex)
    items.forEach(item => sortChildren(item.children))
  }
  sortChildren(rootItems)

  // Assign WBS numbers and depths - handle skipWbs items specially
  // Items with skipWbs don't get WBS numbers
  // Children of skipWbs items start fresh numbering (they're treated as "virtual roots")
  const assignWbsNumbers = (items: WbsItem[], prefix: string = '', depth: number = 0, virtualDepth: number = 0) => {
    let wbsCounter = 0
    items.forEach((item) => {
      item.depth = depth
      
      if (item.skipWbs) {
        // Item skips WBS - no number, but depth still increases visually
        item.wbsNumber = ''
        // Children of skipWbs items start fresh numbering at same virtual depth
        assignWbsNumbers(item.children, '', depth + 1, 0)
      } else {
        wbsCounter++
        item.wbsNumber = prefix ? `${prefix}.${wbsCounter}` : String(wbsCounter)
        // Children continue the hierarchy
        assignWbsNumbers(item.children, item.wbsNumber, depth + 1, virtualDepth + 1)
      }
    })
  }
  assignWbsNumbers(rootItems)

  return rootItems
}

// Flatten tree for saving to database - uses global counter for proper ordering
function flattenTree(items: WbsItem[], parentId: string | null = null, parentSmartsheetRowId: string | null = null, counter: { value: number } = { value: 0 }): any[] {
  const result: any[] = []
  items.forEach((item) => {
    // For new items (with tempId), send the tempId so API can map parent references
    const isNewItem = !!item.tempId && !item.id?.startsWith('c') // cuid starts with 'c'
    
    // Use global counter for orderIndex to maintain proper order across all levels
    const orderIndex = counter.value++
    
    result.push({
      id: isNewItem ? undefined : item.id,
      tempId: item.tempId, // Always send tempId for parent mapping
      smartsheetRowId: item.smartsheetRowId,
      parentId: parentId,
      // Include parent's Smartsheet row ID for proper hierarchy sync
      parentRowId: parentSmartsheetRowId,
      name: item.name,
      description: item.description,
      ownerLastName: item.ownerLastName,
      approverLastName: item.approverLastName,
      status: item.status,
      startDate: item.startDate,
      endDate: item.endDate,
      atRisk: item.atRisk,
      budget: item.budget,
      actual: item.actual,
      variance: item.variance,
      notes: item.notes,
      skipWbs: item.skipWbs,
      orderIndex: orderIndex
    })
    if (item.children.length > 0) {
      // Pass both the local ID and Smartsheet row ID for the parent, and the counter
      result.push(...flattenTree(
        item.children, 
        item.tempId || item.id,
        item.smartsheetRowId || null,
        counter
      ))
    }
  })
  return result
}

// Flatten tree for display (with depth info preserved)
function flattenForDisplay(items: WbsItem[]): WbsItem[] {
  const result: WbsItem[] = []
  const traverse = (items: WbsItem[], parentType: string = '') => {
    let subtaskCounter = 0
    items.forEach(item => {
      // Track subtask index for coloring
      const wbs = item.wbsNumber || ''
      const dotCount = (wbs.match(/\./g) || []).length
      const itemType = item.skipWbs ? 'Header' : 
                      dotCount === 0 ? 'Phase' : 
                      dotCount === 1 ? 'Task' : 'Subtask'
      
      // Store subtask index on the item for rendering
      if (itemType === 'Subtask') {
        (item as any).subtaskIndex = subtaskCounter
        subtaskCounter++
      }
      
      result.push(item)
      if (item.isExpanded && item.children.length > 0) {
        traverse(item.children, itemType)
      }
    })
  }
  traverse(items)
  return result
}

function WbsEditorContent() {
  const { user, isLoading: authLoading } = useAuth()
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [wbsTree, setWbsTree] = useState<WbsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Flattened items for display
  const displayItems = useMemo(() => flattenForDisplay(wbsTree), [wbsTree])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/simple')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && projectId) {
      fetchProjectData()
    }
  }, [user, projectId])

  const fetchProjectData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch project info
      const projectRes = await fetch(`/api/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${user?.lastName}` }
      })
      
      if (!projectRes.ok) throw new Error('Failed to fetch project')
      const projectData = await projectRes.json()
      setProject(projectData)

      // Fetch WBS items
      const wbsRes = await fetch(`/api/projects/${projectId}/wbs`, {
        headers: { 'Authorization': `Bearer ${user?.lastName}` }
      })

      if (wbsRes.ok) {
        const wbsData = await wbsRes.json()
        if (wbsData.success && wbsData.data) {
          const tree = buildHierarchy(wbsData.data)
          setWbsTree(tree)
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load project data')
    } finally {
      setLoading(false)
    }
  }

  // Import fresh from Smartsheet
  const importFromSmartsheet = async () => {
    try {
      setSyncing(true)
      setError(null)

      const response = await fetch(`/api/projects/${projectId}/wbs/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user?.lastName}` }
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to import from Smartsheet')
      }

      setSuccessMessage(`✅ Imported ${data.data?.length || 0} items from Smartsheet!`)
      
      // Rebuild tree from synced data
      if (data.data) {
        const tree = buildHierarchy(data.data)
        setWbsTree(tree)
      }
      
      setHasChanges(false)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      console.error('Import error:', err)
      setError(err.message || 'Failed to import from Smartsheet')
    } finally {
      setSyncing(false)
    }
  }

  // Update item in tree
  const updateItem = useCallback((itemId: string, field: string, value: any) => {
    const updateInTree = (items: WbsItem[]): WbsItem[] => {
      return items.map(item => {
        if (item.id === itemId || item.tempId === itemId) {
          return { ...item, [field]: value }
        }
        if (item.children.length > 0) {
          return { ...item, children: updateInTree(item.children) }
        }
        return item
      })
    }
    setWbsTree(prev => updateInTree(prev))
    setHasChanges(true)
  }, [])

  // Toggle expand/collapse
  const toggleExpand = useCallback((itemId: string) => {
    const toggleInTree = (items: WbsItem[]): WbsItem[] => {
      return items.map(item => {
        if (item.id === itemId || item.tempId === itemId) {
          return { ...item, isExpanded: !item.isExpanded }
        }
        if (item.children.length > 0) {
          return { ...item, children: toggleInTree(item.children) }
        }
        return item
      })
    }
    setWbsTree(prev => toggleInTree(prev))
  }, [])

  // Find the project name row (skipWbs item that's not just a project code)
  const findProjectNameRow = useCallback((items: WbsItem[]): WbsItem | null => {
    for (const item of items) {
      // Look for skipWbs item with a meaningful name (not P-XXXX pattern)
      if (item.skipWbs && item.name && !item.name.match(/^P-\d+$/)) {
        return item
      }
      // Also check children (project name might be child of project code row)
      if (item.children.length > 0) {
        const found = findProjectNameRow(item.children)
        if (found) return found
      }
    }
    return null
  }, [])

  // Add new item
  const addItem = useCallback((parentId: string | null, type: 'phase' | 'task' | 'subtask') => {
    setWbsTree(prev => {
      // If adding a phase with no parent, find the project name row and use it as parent
      let actualParentId = parentId
      if (!parentId && type === 'phase') {
        const projectNameRow = findProjectNameRow(prev)
        if (projectNameRow) {
          actualParentId = projectNameRow.id || projectNameRow.tempId || null
        }
      }

      // Count existing siblings to auto-number the new item
      const countSiblings = (items: WbsItem[], parentId: string | null): number => {
        if (!parentId) {
          // Count root-level non-skipWbs items
          return items.filter(i => !i.skipWbs).length
        }
        // Find parent and count its children
        for (const item of items) {
          if (item.id === parentId || item.tempId === parentId) {
            return item.children.filter(c => !c.skipWbs).length
          }
          if (item.children.length > 0) {
            const count = countSiblings(item.children, parentId)
            if (count >= 0) return count
          }
        }
        return 0
      }
      
      const siblingCount = countSiblings(prev, actualParentId)
      const nextNumber = siblingCount + 1
      
      // Generate appropriate name based on type
      let itemName: string
      if (type === 'phase') {
        itemName = `Phase ${nextNumber}`
      } else if (type === 'task') {
        itemName = `Task`
      } else {
        itemName = `Subtask`
      }

      const tempId = generateTempId()
      const newItem: WbsItem = {
        id: tempId,
        tempId: tempId,
        projectId,
        smartsheetRowId: null,
        parentRowId: null,
        parentId: actualParentId,
        name: itemName,
        description: '',
        ownerLastName: null,
        approverLastName: null,
        status: 'Not_Started',
        startDate: null,
        endDate: null,
        atRisk: false,
        budget: null,
        actual: null,
        variance: null,
        notes: null,
        skipWbs: false,
        orderIndex: 999,
        children: [],
        isExpanded: true,
        depth: 0,
        wbsNumber: ''
      }

      if (actualParentId) {
        const addToParent = (items: WbsItem[]): WbsItem[] => {
          return items.map(item => {
            if (item.id === actualParentId || item.tempId === actualParentId) {
              return { 
                ...item, 
                children: [...item.children, newItem],
                isExpanded: true
              }
            }
            if (item.children.length > 0) {
              return { ...item, children: addToParent(item.children) }
            }
            return item
          })
        }
        return recalculateWbsNumbers(addToParent(prev))
      } else {
        // Fallback: add to root (shouldn't happen normally)
        return recalculateWbsNumbers([...prev, newItem])
      }
    })
    setHasChanges(true)
  }, [projectId, findProjectNameRow])

  // Delete item
  const deleteItem = useCallback((itemId: string) => {
    const removeFromTree = (items: WbsItem[]): WbsItem[] => {
      return items
        .filter(item => item.id !== itemId && item.tempId !== itemId)
        .map(item => ({
          ...item,
          children: removeFromTree(item.children)
        }))
    }
    setWbsTree(prev => recalculateWbsNumbers(removeFromTree(prev)))
    setHasChanges(true)
  }, [])

  // Recalculate WBS numbers - handle skipWbs items specially
  const recalculateWbsNumbers = (items: WbsItem[]): WbsItem[] => {
    const assignNumbers = (items: WbsItem[], prefix: string = '', depth: number = 0): WbsItem[] => {
      let wbsCounter = 0
      return items.map((item) => {
        if (item.skipWbs) {
          // Item skips WBS - no number
          return {
            ...item,
            depth,
            wbsNumber: '',
            children: assignNumbers(item.children, '', depth + 1)
          }
        } else {
          wbsCounter++
          const newWbs = prefix ? `${prefix}.${wbsCounter}` : String(wbsCounter)
          return {
            ...item,
            depth,
            wbsNumber: newWbs,
            children: assignNumbers(item.children, newWbs, depth + 1)
          }
        }
      })
    }
    return assignNumbers(items)
  }

  // Save changes
  const saveChanges = async () => {
    try {
      setSaving(true)
      setError(null)

      const flatData = flattenTree(wbsTree)

      const response = await fetch(`/api/projects/${projectId}/wbs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.lastName}`
        },
        body: JSON.stringify({ items: flatData })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to save')
      }

      // Show success with Smartsheet sync info
      let msg = `✅ Saved ${result.data?.length || 0} items`
      if (result.smartsheetSync?.updated > 0) {
        msg += ` • Synced ${result.smartsheetSync.updated} to Smartsheet`
      } else if (result.smartsheetSync?.errors?.length > 0) {
        msg += ` • ⚠️ Smartsheet sync had errors`
      }
      setSuccessMessage(msg)
      setHasChanges(false)
      
      // Refresh data to get proper IDs
      await fetchProjectData()
      
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err: any) {
      console.error('Save error:', err)
      setError(err.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  // Get item type label based on depth and skipWbs
  const getItemTypeLabel = (item: WbsItem): string => {
    // If skipWbs, return special label
    if (item.skipWbs) return 'Header'
    
    // Use depth to determine type (more reliable than WBS number)
    // depth 0 under a skipWbs parent = Phase
    // depth 1 = Task  
    // depth 2+ = Subtask
    // But we need to account for skipWbs parents not counting toward depth
    
    // Alternative: use WBS number if available
    const wbs = item.wbsNumber || ''
    if (wbs) {
      const dotCount = (wbs.match(/\./g) || []).length
      if (dotCount === 0) return 'Phase'
      if (dotCount === 1) return 'Task'
      return 'Subtask'
    }
    
    // Fallback to depth-based determination
    // Note: depth includes skipWbs items, so we estimate based on visual depth
    if (item.depth <= 2) return 'Phase'  // Under header rows
    if (item.depth === 3) return 'Task'
    return 'Subtask'
  }

  // Render row
  const renderRow = (item: WbsItem) => {
    const indent = item.depth * 24
    const hasChildren = item.children.length > 0
    const statusConfig = STATUS_OPTIONS.find(s => s.value === item.status) || STATUS_OPTIONS[0]
    const itemType = getItemTypeLabel(item)
    
    // Determine row background color
    let rowBgClass = ''
    if (item.skipWbs) {
      rowBgClass = 'bg-purple-50/50 font-semibold'
    } else if (itemType === 'Phase') {
      rowBgClass = 'bg-blue-50/30 font-semibold'
    } else if (itemType === 'Task') {
      rowBgClass = 'bg-gray-50/50'
    } else if (itemType === 'Subtask') {
      // Alternate opacity for consecutive subtasks
      const subtaskIndex = (item as any).subtaskIndex || 0
      const opacities = ['bg-slate-50/30', 'bg-slate-50/50', 'bg-slate-50/70', 'bg-slate-50/90']
      rowBgClass = opacities[subtaskIndex % opacities.length]
    }

    return (
      <tr 
        key={item.id || item.tempId}
        className={`border-b border-gray-200 hover:bg-blue-50/50 ${rowBgClass}`}
      >
        {/* Skip WBS */}
        <td className="w-12 px-2 py-2 text-center">
          <input
            type="checkbox"
            checked={item.skipWbs}
            onChange={(e) => updateItem(item.id || item.tempId!, 'skipWbs', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
        </td>

        {/* WBS Number */}
        <td className="w-20 px-2 py-2 text-center font-mono text-sm text-blue-700 font-bold">
          {item.wbsNumber}
        </td>

        {/* Name with indent and expand/collapse */}
        <td className="w-56 px-2 py-2">
          <div className="flex items-center" style={{ paddingLeft: indent }}>
            {/* Expand/collapse toggle */}
            <button
              onClick={() => toggleExpand(item.id || item.tempId!)}
              className="w-6 h-6 flex items-center justify-center mr-1 text-gray-400 hover:text-gray-600"
            >
              {hasChildren ? (
                item.isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
              ) : <span className="w-4" />}
            </button>
            
            {/* Type badge */}
            <span className={`text-xs px-1.5 py-0.5 rounded mr-2 ${
              item.skipWbs ? 'bg-purple-100 text-purple-700' :
              itemType === 'Phase' ? 'bg-blue-100 text-blue-700' :
              itemType === 'Task' ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {itemType}
            </span>

            {/* Name input */}
            <input
              type="text"
              value={item.name}
              onChange={(e) => updateItem(item.id || item.tempId!, 'name', e.target.value)}
              className={`flex-1 px-2 py-1 text-sm border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded ${
                item.depth === 0 ? 'font-bold' : ''
              }`}
            />
          </div>
        </td>

        {/* Description - largest column */}
        <td className="min-w-[300px] px-2 py-2">
          <input
            type="text"
            value={item.description || ''}
            onChange={(e) => updateItem(item.id || item.tempId!, 'description', e.target.value)}
            placeholder="Description..."
            className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded text-gray-600"
          />
        </td>

        {/* Assigned To */}
        <td className="w-28 px-2 py-2">
          <select
            value={item.ownerLastName || ''}
            onChange={(e) => updateItem(item.id || item.tempId!, 'ownerLastName', e.target.value || null)}
            className="w-full px-1 py-1 text-sm border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded"
          >
            <option value="">--</option>
            {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </td>

        {/* Status */}
        <td className="w-28 px-2 py-2">
          <select
            value={item.status}
            onChange={(e) => updateItem(item.id || item.tempId!, 'status', e.target.value)}
            className={`w-full px-1 py-1 text-xs border-0 rounded font-medium ${statusConfig.color}`}
          >
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </td>

        {/* Start Date */}
        <td className="w-28 px-2 py-2">
          <input
            type="date"
            value={item.startDate || ''}
            onChange={(e) => updateItem(item.id || item.tempId!, 'startDate', e.target.value || null)}
            className="w-full px-1 py-1 text-sm border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded"
          />
        </td>

        {/* End Date */}
        <td className="w-28 px-2 py-2">
          <input
            type="date"
            value={item.endDate || ''}
            onChange={(e) => updateItem(item.id || item.tempId!, 'endDate', e.target.value || null)}
            className="w-full px-1 py-1 text-sm border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded"
          />
        </td>

        {/* At Risk */}
        <td className="w-12 px-2 py-2 text-center">
          <input
            type="checkbox"
            checked={item.atRisk}
            onChange={(e) => updateItem(item.id || item.tempId!, 'atRisk', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-red-600"
          />
        </td>

        {/* Budget - Display formatted, store raw */}
        <td className="w-24 px-2 py-2">
          <input
            type="text"
            value={formatCurrency(item.budget)}
            onChange={(e) => updateItem(item.id || item.tempId!, 'budget', parseCurrencyValue(e.target.value))}
            placeholder="$0"
            className="w-full px-1 py-1 text-sm border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded text-right font-medium text-green-700"
          />
        </td>

        {/* Actual - Display formatted, store raw */}
        <td className="w-24 px-2 py-2">
          <input
            type="text"
            value={formatCurrency(item.actual)}
            onChange={(e) => updateItem(item.id || item.tempId!, 'actual', parseCurrencyValue(e.target.value))}
            placeholder="$0"
            className="w-full px-1 py-1 text-sm border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded text-right font-medium text-blue-700"
          />
        </td>

        {/* Actions */}
        <td className="w-20 px-2 py-2">
          <div className="flex items-center justify-center space-x-1">
            {/* Only allow adding children to Phases (can add Tasks) and Tasks (can add Subtasks) */}
            {/* Subtasks (WBS like 1.1.1) cannot have children - limit to 3 levels */}
            {(itemType === 'Phase' || itemType === 'Task' || item.skipWbs) && (
              <button
                onClick={() => addItem(
                  item.id || item.tempId!, 
                  item.skipWbs ? 'phase' : (itemType === 'Phase' ? 'task' : 'subtask')
                )}
                className="p-1 text-green-600 hover:bg-green-100 rounded"
                title={`Add ${item.skipWbs ? 'Phase' : (itemType === 'Phase' ? 'Task' : 'Subtask')}`}
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            {/* Don't allow deleting header rows */}
            {!item.skipWbs && (
              <button
                onClick={() => {
                  if (confirm(`Delete "${item.name}" and all its children?`)) {
                    deleteItem(item.id || item.tempId!)
                  }
                }}
                className="p-1 text-red-600 hover:bg-red-100 rounded"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
        <Navigation />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-lg">Loading WBS Editor...</span>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
      <Navigation />
      
      <div className="max-w-full mx-auto p-4">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/wbs">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Layers className="mr-2 h-6 w-6 text-blue-600" />
                  WBS Editor: {project?.projectCode}
                </h1>
                <p className="text-sm text-gray-600">{project?.title}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {hasChanges && (
                <Badge className="bg-yellow-100 text-yellow-800 mr-2">
                  Unsaved Changes
                </Badge>
              )}
              
              <Button onClick={() => addItem(null, 'phase')} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Phase
              </Button>

              <Button onClick={importFromSmartsheet} disabled={syncing} variant="outline" size="sm">
                {syncing ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                Import from Smartsheet
              </Button>

              <Button onClick={saveChanges} disabled={saving || !hasChanges} className="bg-green-600 hover:bg-green-700" size="sm">
                {saving ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save & Sync
              </Button>
            </div>
          </div>
        </div>

        {/* Messages */}
        {successMessage && (
          <Alert className="border-green-200 bg-green-50 mb-4">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="border-red-200 bg-red-50 mb-4">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {/* WBS Table */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-300">
                <tr className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <th className="w-12 px-2 py-3 text-center">Skip</th>
                  <th className="w-20 px-2 py-3 text-center">WBS</th>
                  <th className="w-56 px-2 py-3 text-left">Name</th>
                  <th className="min-w-[300px] px-2 py-3 text-left">Description</th>
                  <th className="w-28 px-2 py-3 text-left">Assigned To</th>
                  <th className="w-28 px-2 py-3 text-left">Status</th>
                  <th className="w-28 px-2 py-3 text-left">Start Date</th>
                  <th className="w-28 px-2 py-3 text-left">End Date</th>
                  <th className="w-12 px-2 py-3 text-center">At Risk</th>
                  <th className="w-24 px-2 py-3 text-right">Budget</th>
                  <th className="w-24 px-2 py-3 text-right">Actual</th>
                  <th className="w-20 px-2 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.length > 0 ? (
                  displayItems.map(item => renderRow(item))
                ) : (
                  <tr>
                    <td colSpan={12} className="text-center py-16">
                      <Layers className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No WBS Items</h3>
                      <p className="text-gray-500 mb-4">Start building your work breakdown structure</p>
                      <div className="flex items-center justify-center space-x-2">
                        <Button onClick={() => addItem(null, 'phase')}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add First Phase
                        </Button>
                        <Button variant="outline" onClick={importFromSmartsheet}>
                          <Download className="h-4 w-4 mr-1" />
                          Import from Smartsheet
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats Footer */}
        <div className="mt-4 text-sm text-gray-500 text-center">
          {displayItems.length} items • {wbsTree.length} phases • 
          {wbsTree.reduce((acc, p) => acc + p.children.length, 0)} tasks
        </div>
      </div>
    </div>
  )
}

export default function WbsEditorPage() {
  return <WbsEditorContent />
}
