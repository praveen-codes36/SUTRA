import type { DataSource, EmailListParams } from '../adapters/dataSource';

export const emailService = {
  keys: {
    all: ['emails'] as const,
    list: (mode: string, personaId: string | null, params?: EmailListParams) =>
      ['emails', 'list', mode, personaId ?? 'anon', params ?? {}] as const,
    detail: (mode: string, personaId: string | null, emailId: string) =>
      ['emails', 'detail', mode, personaId ?? 'anon', emailId] as const,
    attachment: (mode: string, personaId: string | null, attachmentId: string) =>
      ['attachments', 'detail', mode, personaId ?? 'anon', attachmentId] as const,
  },
  list: (ds: DataSource, params?: EmailListParams) => ds.listEmails(params),
  get: (ds: DataSource, emailId: string) => ds.getEmail(emailId),
  getAttachment: (ds: DataSource, attachmentId: string) => ds.getAttachment(attachmentId),
  getAttachmentDownloadUrl: (ds: DataSource, attachmentId: string) =>
    ds.getAttachmentDownloadUrl(attachmentId),
};
