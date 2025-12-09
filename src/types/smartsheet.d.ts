declare module 'smartsheet' {
  export interface Client {
    sheets: {
      getSheet: (options: { id: number }) => Promise<any>
      addRows: (options: { sheetId: number; body: any[] }) => Promise<any>
      updateRows: (options: { sheetId: number; body: any[] }) => Promise<any>
      deleteRows: (options: { sheetId: number; ids: number[] }) => Promise<any>
      createSheet: (options: any) => Promise<any>
      copySheet: (options: any) => Promise<any>
    }
    webhooks: {
      createWebhook: (options: any) => Promise<any>
      deleteWebhook: (options: { id: number }) => Promise<any>
      listWebhooks: () => Promise<any>
    }
  }

  export function createClient(options: { accessToken: string; logLevel?: string }): Client
}
