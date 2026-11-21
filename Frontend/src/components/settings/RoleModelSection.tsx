import React from 'react';
import { Lock } from 'lucide-react';
import { Banner } from '../ui/Banner';
import { Table, type TableColumn } from '../ui/Table';

interface RoleReferenceRow {
  roleCode: string;
  scopeSummary: string;
  ingestionAndReview: string;
}

const DEFAULT_ROLE_MODEL: RoleReferenceRow[] = [
  {
    roleCode: 'INSTITUTION_ADMIN',
    scopeSummary: 'Institution-wide corpus access when provisioned by the backend.',
    ingestionAndReview: 'Inspects summaries and decisions; backend governs ingestion and overrides.',
  },
  {
    roleCode: 'DEPT_HEAD',
    scopeSummary: 'Conversations where department head address is sender or recipient.',
    ingestionAndReview: 'Reviews department decisions and action trackers.',
  },
  {
    roleCode: 'FACULTY',
    scopeSummary: 'Conversations where faculty member address participates.',
    ingestionAndReview: 'Read-only intelligence inspection and Q&A over visible threads.',
  },
  {
    roleCode: 'ADMIN_STAFF',
    scopeSummary: 'Operational and procurement threads involving staff mailbox.',
    ingestionAndReview: 'Inspects procurement records; does not alter email records.',
  },
  {
    roleCode: 'REQUESTER',
    scopeSummary: 'Only threads where the requester address is a participant.',
    ingestionAndReview: 'Restricted participant view; unrelated threads are hidden.',
  },
  {
    roleCode: 'SYSTEM_ADMIN',
    scopeSummary: 'System operations, ingestion diagnostics, and readiness checks.',
    ingestionAndReview: 'Manages CSV dataset ingestion and pipeline monitoring.',
  },
  {
    roleCode: 'COMPLIANCE_ADMIN',
    scopeSummary: 'Audit visibility across decisions, provenance, and evidence citations.',
    ingestionAndReview: 'Audits evidence chains and review states.',
  },
];

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  INSTITUTION_ADMIN:
    'Institutional oversight across conversations and intelligence views as configured by the backend.',
  DEPT_HEAD:
    'Departmental participant access covering conversations addressed to or sent by the department head.',
  FACULTY:
    'Participant-scoped access to research, lab, and academic conversations involving your address.',
  ADMIN_STAFF:
    'Participant-scoped access to procurement and administrative threads.',
  REQUESTER:
    'Limited participant access scoped strictly to conversations involving your address.',
  SYSTEM_ADMIN:
    'Operational oversight of dataset ingestion pipelines, job diagnostics, and service health.',
  COMPLIANCE_ADMIN:
    'Verification and audit access across decisions, provenance markers, and supporting evidence.',
};

const ROLE_COLUMNS: Array<TableColumn<RoleReferenceRow>> = [
  {
    key: 'roleCode',
    header: 'Role code',
    render: (row) => (
      <span className="font-mono text-[12px] font-semibold text-[#102D2A]">{row.roleCode}</span>
    ),
  },
  {
    key: 'scopeSummary',
    header: 'Visibility scope',
    render: (row) => <span className="text-[13px] text-[#202B35]">{row.scopeSummary}</span>,
  },
  {
    key: 'ingestionAndReview',
    header: 'Permitted capabilities',
    render: (row) => <span className="text-[13px] text-[#5A6560]">{row.ingestionAndReview}</span>,
  },
];

export interface RoleModelSectionProps {
  activeRole: string;
}

export const RoleModelSection: React.FC<RoleModelSectionProps> = ({ activeRole }) => {
  const activeDesc =
    ROLE_DESCRIPTIONS[activeRole] ||
    'Role permissions and thread visibility rules are enforced exclusively by the SUTRA backend.';

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-[8px] border border-[#E5E2D9] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E2D9] pb-3">
          <div>
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7A5C1E]">
              Backend-enforced · Read-only
            </p>
            <h2 className="mt-0.5 font-display text-[16px] font-semibold text-[#102D2A]">
              Active role &amp; permissions
            </h2>
          </div>
          <span className="rounded-[4px] border border-[#7B8581]/60 bg-[#F5F2EA] px-2.5 py-1 font-mono text-[12px] font-semibold text-[#102D2A]">
            {activeRole}
          </span>
        </div>

        <p className="text-[14px] leading-[1.55] text-[#202B35]">{activeDesc}</p>

        <div className="space-y-2 pt-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-[14px] font-semibold text-[#102D2A]">
              Default role model (reference documentation)
            </h3>
            <span className="text-[12px] text-[#5A6560]">
              Enforced by the backend; cannot be modified in the browser
            </span>
          </div>
          <Table
            caption="Default SUTRA role model reference documentation"
            columns={ROLE_COLUMNS}
            rows={DEFAULT_ROLE_MODEL}
            rowKey={(row) => row.roleCode}
            selectedKey={activeRole}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-[8px] border border-[#E5E2D9] bg-white p-5">
        <div className="flex items-center gap-2 text-[#102D2A]">
          <Lock size={17} aria-hidden="true" />
          <h2 className="font-display text-[16px] font-semibold">Data access &amp; visibility rules</h2>
        </div>

        <ul className="divide-y divide-[#E5E2D9] border-t border-b border-[#E5E2D9] text-[13.5px]">
          <li className="py-3">
            <span className="font-display font-semibold text-[#102D2A]">Participant-based access: </span>
            <span className="text-[#5A6560]">
              In live mode, access to messages, threads, and attachments is evaluated on the server from your authenticated institutional identity.
            </span>
          </li>
          <li className="py-3">
            <span className="font-display font-semibold text-[#102D2A]">Derived summaries &amp; citations: </span>
            <span className="text-[#5A6560]">
              Synthesised answers and summaries are exposed only when every cited source email is visible to the signed-in role.
            </span>
          </li>
          <li className="py-3">
            <span className="font-display font-semibold text-[#102D2A]">No existence leaks: </span>
            <span className="text-[#5A6560]">
              Restricted or missing resources return neutral “not available” responses without revealing titles, counts, or hints.
            </span>
          </li>
          <li className="py-3">
            <span className="font-display font-semibold text-[#102D2A]">Backend audit trail: </span>
            <span className="text-[#5A6560]">
              Retrieval queries, ingestion actions, and permitted review overrides are audited server-side.
            </span>
          </li>
        </ul>

        <Banner tone="info" title="Browser illustration vs server enforcement">
          In Demo mode, persona filtering illustrates participant visibility in the browser only. Real access enforcement requires Live mode with an authenticated backend session.
        </Banner>
      </section>
    </div>
  );
};
