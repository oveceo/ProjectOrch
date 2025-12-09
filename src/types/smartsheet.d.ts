declare module 'smartsheet' {
  export interface SmartsheetCell {
    columnId: number
    value?: any
    displayValue?: string
  }

  export interface SmartsheetRow {
    id: number
    parentId?: number
    cells: SmartsheetCell[]
    expanded?: boolean
    createdAt?: string
    modifiedAt?: string
  }

  export interface SmartsheetColumn {
    id: number
    title: string
    type: string
    primary?: boolean
  }

  export interface SmartsheetSheet {
    id: number
    name: string
    columns: SmartsheetColumn[]
    rows: SmartsheetRow[]
  }

  export interface Client {
    sheets: {
      getSheet: (options: { id: number }) => Promise<SmartsheetSheet>
      addRows: (options: { sheetId: number; body: any[] }) => Promise<any>
      updateRows: (options: { sheetId: number; body: any[] }) => Promise<any>
      deleteRows: (options: { sheetId: number; ids: number[] }) => Promise<any>
      createSheet: (options: any) => Promise<any>
      copySheet: (options: any) => Promise<any>
    }
    folders: {
      getFolder: (options: { id: number; include?: string }) => Promise<any>
      createFolder: (options: { body: any; folderId?: number; workspaceId?: number }) => Promise<any>
      listFolders?: (options: any) => Promise<any>
    }
    webhooks: {
      createWebhook: (options: any) => Promise<any>
      deleteWebhook: (options: { id: number }) => Promise<any>
      listWebhooks: () => Promise<any>
    }
  }

  export function createClient(options: { accessToken: string; logLevel?: string }): Client
}
