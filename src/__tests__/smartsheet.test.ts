import { SmartsheetAPI } from '@/lib/smartsheet'
import * as smartsheet from 'smartsheet'

// Mock the smartsheet client
jest.mock('smartsheet', () => ({
  createClient: jest.fn(() => ({
    sheets: {
      getSheet: jest.fn(),
      addRows: jest.fn(),
      updateRows: jest.fn(),
      deleteRows: jest.fn(),
      createSheet: jest.fn(),
      copySheet: jest.fn(),
    },
    webhooks: {
      createWebhook: jest.fn(),
      deleteWebhook: jest.fn(),
      listWebhooks: jest.fn(),
    },
  })),
}))

const mockClient = smartsheet.createClient()

describe('SmartsheetAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getSheet', () => {
    it('should get sheet successfully', async () => {
      const mockSheet = { id: 123, name: 'Test Sheet' }
      mockClient.sheets.getSheet.mockResolvedValue(mockSheet)

      const result = await SmartsheetAPI.getSheet(123)

      expect(mockClient.sheets.getSheet).toHaveBeenCalledWith({ id: 123 })
      expect(result).toEqual(mockSheet)
    })

    it('should retry on failure', async () => {
      const error = new Error('API Error')
      mockClient.sheets.getSheet
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ id: 123, name: 'Test Sheet' })

      const result = await SmartsheetAPI.getSheet(123)

      expect(mockClient.sheets.getSheet).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ id: 123, name: 'Test Sheet' })
    })
  })

  describe('addRows', () => {
    it('should add rows successfully', async () => {
      const mockRows = [{ id: 1, cells: [] }]
      const mockResponse = { result: mockRows }
      mockClient.sheets.addRows.mockResolvedValue(mockResponse)

      const rows = [{ cells: [{ columnId: 123, value: 'test' }] }]
      const result = await SmartsheetAPI.addRows(123, rows)

      expect(mockClient.sheets.addRows).toHaveBeenCalledWith({
        sheetId: 123,
        body: rows
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getCellValue', () => {
    it('should extract cell value correctly', () => {
      const mockColumns = [
        { id: 1, title: 'Name' },
        { id: 2, title: 'Status' }
      ]

      const mockRow = {
        cells: [
          { columnId: 1, value: 'Test Project' },
          { columnId: 2, value: 'In Progress' }
        ]
      }

      const nameValue = SmartsheetAPI.getCellValue(mockRow, mockColumns, 'Name')
      const statusValue = SmartsheetAPI.getCellValue(mockRow, mockColumns, 'Status')

      expect(nameValue).toBe('Test Project')
      expect(statusValue).toBe('In Progress')
    })

    it('should return null for non-existent column', () => {
      const mockColumns = [{ id: 1, title: 'Name' }]
      const mockRow = { cells: [{ columnId: 1, value: 'Test' }] }

      const value = SmartsheetAPI.getCellValue(mockRow, mockColumns, 'NonExistent')

      expect(value).toBeNull()
    })
  })

  describe('findColumnByTitle', () => {
    it('should find column by exact title match', () => {
      const columns = [
        { id: 1, title: 'Project Name' },
        { id: 2, title: 'Status' },
        { id: 3, title: 'Priority' }
      ]

      const result = SmartsheetAPI.findColumnByTitle(columns, 'Status')

      expect(result).toEqual({ id: 2, title: 'Status' })
    })

    it('should return undefined for non-existent column', () => {
      const columns = [{ id: 1, title: 'Name' }]

      const result = SmartsheetAPI.findColumnByTitle(columns, 'NonExistent')

      expect(result).toBeUndefined()
    })
  })
})
