import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpLeft, Clock, ExternalLink, Paperclip } from 'lucide-react';
import { useSutra } from '../../app/providers';
import { usePrefs } from '../../hooks/usePrefs';
import { formatDateTime, formatUtcTooltip } from '../../lib/format';
import { emailService } from '../../services/emailService';
import { threadService } from '../../services/threadService';
import type { Citation } from '../../types/api';
import { Badge } from '../ui/Badge';
import { CodeQuote } from '../ui/CodeQuote';
import { Drawer } from '../ui/Drawer';
import { ErrorState } from '../ui/ErrorState';
import { RolePill } from '../ui/RolePill';
import { Skeleton } from '../ui/Skeleton';
import { Tabs } from '../ui/Tabs';
import { Timeline } from '../ui/Timeline';
import { EvidenceAttachmentTab } from './EvidenceAttachmentTab';

export interface EvidenceDrawerProps {
  open: boolean;
  onClose: () => void;
  emailId: string | null;
  quote?: string | null;
  attachmentId?: string | null;
  initialTab?: 'email' | 'attachment' | 'thread';
  verification?: Citation['verification'];
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  open,
  onClose,
  emailId,
  quote = null,
  attachmentId = null,
  initialTab = 'email',
  verification,
}) => {
  const { mode, dataSource, persona } = useSutra();
  const { prefs } = usePrefs();
  const [activeEmailId, setActiveEmailId] = useState<string | null>(emailId);
  const [activeTab, setActiveTab] = useState<'email' | 'attachment' | 'thread'>(initialTab);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string | null>(attachmentId);
  const [localUtc, setLocalUtc] = useState<boolean>(prefs.showUtc);

  useEffect(() => {
    if (open) {
      setActiveEmailId(emailId);
      setSelectedAttachmentId(attachmentId);
      setActiveTab(attachmentId ? 'attachment' : initialTab);
      setLocalUtc(prefs.showUtc);
    }
  }, [open, emailId, attachmentId, initialTab, prefs.showUtc]);

  const emailQuery = useQuery({
    queryKey: emailService.keys.detail(mode, persona?.persona_id ?? null, activeEmailId || ''),
    queryFn: () => emailService.get(dataSource, activeEmailId!),
    enabled: open && Boolean(activeEmailId),
  });

  const email = emailQuery.data;

  const threadQuery = useQuery({
    queryKey: threadService.keys.detail(
      mode,
      persona?.persona_id ?? null,
      email?.thread_key || '',
    ),
    queryFn: () => threadService.get(dataSource, email!.thread_key),
    enabled: open && Boolean(email?.thread_key) && activeTab === 'thread',
  });

  const threadEmailsQuery = useQuery({
    queryKey: emailService.keys.list(mode, persona?.persona_id ?? null, {
      thread_key: email?.thread_key,
      limit: 100,
    }),
    queryFn: () =>
      emailService.list(dataSource, { thread_key: email!.thread_key, limit: 100 }),
    enabled: open && Boolean(email?.thread_key) && activeTab === 'thread',
  });

  const drawerTitle = email
    ? `${email.email_id} · ${email.subject || 'Untitled message'}`
    : activeEmailId
      ? `Evidence · ${activeEmailId}`
      : 'Evidence';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={drawerTitle}
      subtitle={email ? `Thread ${email.thread_key}` : undefined}
      widthClass="max-w-[640px]"
      footer={
        email ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <Link
              to={`/app/emails?email=${encodeURIComponent(email.email_id)}`}
              onClick={onClose}
              className="text-[12.5px] font-medium text-[#102D2A] hover:underline"
            >
              Open in Email Explorer
            </Link>
            <Link
              to={`/app/threads/${encodeURIComponent(email.thread_key)}?email=${encodeURIComponent(email.email_id)}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 font-display text-[13px] font-semibold text-[#102D2A] hover:underline"
            >
              <span>Open complete conversation</span>
              <ExternalLink size={13} aria-hidden="true" />
            </Link>
          </div>
        ) : undefined
      }
    >
      {emailQuery.isLoading ? (
        <div className="space-y-3 py-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : emailQuery.error ? (
        <ErrorState
          title="Unable to inspect source"
          message={
            emailQuery.error instanceof Error
              ? emailQuery.error.message
              : 'The requested item is not available.'
          }
          onRetry={() => void emailQuery.refetch()}
        />
      ) : email ? (
        <div className="space-y-4">
          <Tabs
            ariaLabel="Evidence views"
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as 'email' | 'attachment' | 'thread')}
            items={[
              { id: 'email', label: 'Email' },
              {
                id: 'attachment',
                label: 'Attachment',
                count: email.attachments.length,
              },
              { id: 'thread', label: 'Thread' },
            ]}
          />

          {activeTab === 'email' && (
            <div className="space-y-4">
              {verification && (
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    label={verification.email_exists ? 'Email exists' : 'Email unverified'}
                    tone={verification.email_exists ? 'success' : 'error'}
                    icon={verification.email_exists ? 'CheckCircle2' : 'XCircle'}
                  />
                  <Badge
                    label={verification.access_ok ? 'Access permitted' : 'Access restricted'}
                    tone={verification.access_ok ? 'success' : 'error'}
                    icon={verification.access_ok ? 'CheckCircle2' : 'Ban'}
                  />
                  <Badge
                    label={verification.quote_found ? 'Quote matched' : 'Quote unverified'}
                    tone={verification.quote_found ? 'success' : 'warning'}
                    icon={verification.quote_found ? 'CheckCircle2' : 'AlertTriangle'}
                  />
                  {verification.values_match !== undefined && (
                    <Badge
                      label={verification.values_match ? 'Values match' : 'Value mismatch'}
                      tone={verification.values_match ? 'success' : 'warning'}
                      icon={verification.values_match ? 'CheckCircle2' : 'AlertTriangle'}
                    />
                  )}
                </div>
              )}

              <dl className="grid gap-2 rounded-[6px] border border-[#E5E2D9] bg-[#F5F2EA]/50 p-3.5 text-[13px]">
                <div className="grid grid-cols-[90px_1fr] gap-2">
                  <dt className="font-display font-semibold text-[#5A6560]">From</dt>
                  <dd>
                    <RolePill person={email.sender} showAddressInline />
                  </dd>
                </div>
                <div className="grid grid-cols-[90px_1fr] gap-2">
                  <dt className="font-display font-semibold text-[#5A6560]">To</dt>
                  <dd className="flex flex-wrap gap-x-3 gap-y-1">
                    {email.recipients.map((r, idx) => (
                      <RolePill key={`${r.address}-${idx}`} person={r} />
                    ))}
                  </dd>
                </div>
                <div className="grid grid-cols-[90px_1fr] gap-2 items-center">
                  <dt className="font-display font-semibold text-[#5A6560]">Sent</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    <span
                      title={formatUtcTooltip(email.timestamp)}
                      className="font-medium text-[#202B35] tabular-nums"
                    >
                      {formatDateTime(email.timestamp, { showUtc: localUtc })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLocalUtc((prev) => !prev)}
                      className="inline-flex items-center gap-1 rounded-[4px] border border-[#7B8581] bg-white px-2 py-0.5 text-[11px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
                    >
                      <Clock size={11} aria-hidden="true" />
                      <span>{localUtc ? 'Show IST' : 'Show UTC'}</span>
                    </button>
                  </dd>
                </div>
                {email.in_reply_to && (
                  <div className="grid grid-cols-[90px_1fr] gap-2 items-center">
                    <dt className="font-display font-semibold text-[#5A6560]">Reply to</dt>
                    <dd>
                      <button
                        type="button"
                        onClick={() => setActiveEmailId(email.in_reply_to)}
                        className="inline-flex items-center gap-1 rounded-[4px] border border-[#7B8581] bg-white px-2 py-0.5 font-mono text-[12px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
                      >
                        <ArrowUpLeft size={12} aria-hidden="true" />
                        <span>{email.in_reply_to}</span>
                      </button>
                    </dd>
                  </div>
                )}
              </dl>

              <div>
                <p className="mb-1.5 font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
                  Original message body
                </p>
                <CodeQuote body={email.body_raw} quote={quote} />
              </div>

              {email.attachments.length > 0 && (
                <div>
                  <p className="mb-1.5 font-display text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5A6560]">
                    Attachments ({email.attachments.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {email.attachments.map((att) => (
                      <button
                        key={att.attachment_id}
                        type="button"
                        onClick={() => {
                          setSelectedAttachmentId(att.attachment_id);
                          setActiveTab('attachment');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#7B8581] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#102D2A] hover:bg-[#E8EFEA] cursor-pointer"
                      >
                        <Paperclip size={13} aria-hidden="true" />
                        <span>{att.filename}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'attachment' && (
            <EvidenceAttachmentTab
              attachments={email.attachments}
              selectedAttachmentId={selectedAttachmentId}
              onSelectAttachment={setSelectedAttachmentId}
              quote={quote}
            />
          )}

          {activeTab === 'thread' && (
            <div className="space-y-4">
              {threadQuery.isLoading || threadEmailsQuery.isLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : (
                <>
                  {threadQuery.data && (
                    <div className="rounded-[6px] border border-[#E5E2D9] bg-[#F5F2EA]/60 p-3 text-[13px]">
                      <p className="font-display font-semibold text-[#102D2A]">
                        {threadQuery.data.title || threadQuery.data.thread_key}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[#5A6560] tabular-nums">
                        {threadQuery.data.message_count} messages in thread
                      </p>
                    </div>
                  )}

                  <Timeline
                    entries={(threadEmailsQuery.data?.items || [])
                      .slice()
                      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
                      .map((msg) => ({
                        id: msg.email_id,
                        title: `${msg.email_id} · ${msg.sender.role || msg.sender.address}`,
                        timestampLabel: formatDateTime(msg.timestamp, { showUtc: localUtc }),
                        highlighted: msg.email_id === email.email_id,
                        description: (
                          <div className="space-y-1">
                            <p className="line-clamp-2 text-[12.5px] text-[#5A6560]">
                              {msg.body_preview || msg.body_raw}
                            </p>
                            {msg.email_id !== email.email_id && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveEmailId(msg.email_id);
                                  setActiveTab('email');
                                }}
                                className="text-[12px] font-semibold text-[#102D2A] hover:underline cursor-pointer"
                              >
                                Inspect message
                              </button>
                            )}
                          </div>
                        ),
                      }))}
                  />
                </>
              )}
            </div>
          )}
        </div>
      ) : null}
    </Drawer>
  );
};
