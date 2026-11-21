import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { useSutra } from '../app/providers';
import { RoleModelSection } from '../components/settings/RoleModelSection';
import { Badge } from '../components/ui/Badge';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { DefinitionList } from '../components/ui/DefinitionList';
import { Dialog } from '../components/ui/Dialog';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Switch } from '../components/ui/Switch';
import { Tabs } from '../components/ui/Tabs';
import { env, type DataMode } from '../config/env';
import { DEMO_DATASET } from '../data/demoData';
import { usePrefs, type DensityPref } from '../hooks/usePrefs';
import type { AmountDisplayPref } from '../lib/format';

type SettingsTabId = 'profile' | 'roles' | 'security' | 'preferences' | 'mode';

export const SettingsPage: React.FC = () => {
  const {
    mode,
    setMode,
    persona,
    liveUser,
    health,
    healthError,
    healthChecking,
    refreshHealth,
    addToast,
  } = useSutra();
  const { prefs, updatePref } = usePrefs();
  const [activeTab, setActiveTab] = useState<SettingsTabId>('profile');
  const [confirmMode, setConfirmMode] = useState<DataMode | null>(null);

  const activeName =
    mode === 'demo' ? persona?.display_name || 'Not selected' : liveUser?.display_name || 'Not signed in';
  const activeRole =
    mode === 'demo' ? persona?.role_code || 'Not reported' : liveUser?.role_code || 'Not reported';
  const activeAddress =
    mode === 'demo'
      ? persona?.address ?? 'Full demo corpus (unscoped)'
      : liveUser?.address ?? 'Not reported';
  const workspaceName =
    mode === 'demo'
      ? 'Northbridge — demo workspace'
      : liveUser?.workspace_name || 'Live workspace (name not reported)';

  const handleConfirmSwitch = () => {
    if (!confirmMode) return;
    const next = confirmMode;
    setConfirmMode(null);
    setMode(next);
    addToast({
      tone: 'info',
      title: `Switched to ${next === 'live' ? 'Live backend' : 'Demo dataset'} mode`,
      message:
        next === 'live'
          ? `Connecting to ${env.API_BASE_URL}.`
          : 'Loaded the supplied synthetic benchmark.',
    });
  };

  const tabItems = [
    { id: 'profile', label: 'Profile & Workspace' },
    { id: 'roles', label: 'Roles & Data Access' },
    { id: 'security', label: 'Security' },
    { id: 'preferences', label: 'Browser Preferences' },
    ...(env.ALLOW_MODE_SWITCH ? [{ id: 'mode', label: 'Data Mode & Health' }] : []),
  ];

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E2D9] pb-4">
        <div>
          <h1 className="font-display text-[22px] font-semibold text-[#102D2A]">Settings</h1>
          <p className="mt-1 text-[14px] text-[#5A6560]">
            Backend-enforced identity and access rules are read-only; display preferences below apply strictly to this browser.
          </p>
        </div>
        <Link
          to="/app/evaluation"
          className="inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-[4px] border border-[#7B8581] bg-white px-3 py-1.5 font-display text-[13px] font-semibold text-[#102D2A] hover:bg-[#E8EFEA]"
        >
          <span>Evaluation criteria &amp; runs</span>
          <ExternalLink size={13} aria-hidden="true" />
        </Link>
      </div>

      <Tabs
        ariaLabel="Settings sections"
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as SettingsTabId)}
        items={tabItems}
      />

      {activeTab === 'profile' && (
        <div className="space-y-6">
          <section className="space-y-4 rounded-[8px] border border-[#E5E2D9] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E2D9] pb-3">
              <div>
                <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7A5C1E]">
                  Backend-enforced · Read-only
                </p>
                <h2 className="mt-0.5 font-display text-[16px] font-semibold text-[#102D2A]">
                  Identity profile
                </h2>
              </div>
              <Badge
                label={mode === 'demo' ? 'Demo persona' : 'Authenticated session'}
                tone={mode === 'demo' ? 'warning' : 'info'}
              />
            </div>

            <DefinitionList
              columns={2}
              items={[
                { term: 'Display name', value: activeName },
                { term: 'Role code', value: <span className="font-mono text-[12px]">{activeRole}</span> },
                { term: 'Institutional address', value: <span className="font-mono text-[12px]">{activeAddress}</span> },
                {
                  term: 'Identity source',
                  value: mode === 'demo' ? 'Selected demo persona (local)' : 'GET /auth/me (cookie session)',
                },
              ]}
            />
          </section>

          <section className="space-y-4 rounded-[8px] border border-[#E5E2D9] bg-white p-5">
            <div className="border-b border-[#E5E2D9] pb-3">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7A5C1E]">
                Backend-enforced · Read-only
              </p>
              <h2 className="mt-0.5 font-display text-[16px] font-semibold text-[#102D2A]">
                Workspace configuration
              </h2>
            </div>

            <DefinitionList
              columns={2}
              items={[
                { term: 'Workspace', value: workspaceName },
                { term: 'Organisation timezone', value: `${env.ORG_TIMEZONE} (IST)` },
                {
                  term: 'Visibility policy',
                  value:
                    mode === 'demo'
                      ? `${DEMO_DATASET.meta.visibility_policy} (browser illustration)`
                      : 'Participant-based visibility (enforced by backend)',
                },
                {
                  term: 'Configured API base URL',
                  value: <span className="font-mono text-[12px]">{env.API_BASE_URL}</span>,
                },
              ]}
            />

            <p className="text-[13px] leading-[1.55] text-[#5A6560]">
              Single-workspace deployment: conversations, decisions, and actions are scoped to threads where your institutional address is a sender or recipient unless your backend role grants institutional oversight.
            </p>
          </section>
        </div>
      )}

      {activeTab === 'roles' && <RoleModelSection activeRole={activeRole} />}

      {activeTab === 'security' && (
        <section className="space-y-4 rounded-[8px] border border-[#E5E2D9] bg-white p-5">
          <div className="flex items-center justify-between gap-2 border-b border-[#E5E2D9] pb-3">
            <div className="flex items-center gap-2 text-[#102D2A]">
              <ShieldCheck size={18} aria-hidden="true" />
              <h2 className="font-display text-[16px] font-semibold">Sessions &amp; multi-factor status</h2>
            </div>
            <Badge label="Managed by backend" tone="neutral" />
          </div>

          {mode === 'live' && liveUser ? (
            <DefinitionList
              columns={2}
              items={[
                {
                  term: 'Session authentication',
                  value: 'HTTP-only cookie session active',
                },
                {
                  term: 'Multi-factor authentication (MFA)',
                  value:
                    liveUser.mfa_enabled === true
                      ? 'Enabled on account'
                      : liveUser.mfa_enabled === false
                        ? 'Disabled on account'
                        : 'Not available in this deployment',
                },
              ]}
            />
          ) : (
            <div className="rounded-[6px] border border-[#E5E2D9] bg-[#F5F2EA]/60 p-4 text-[14px] text-[#202B35]">
              <p className="font-display font-semibold text-[#102D2A]">Not available in this deployment</p>
              <p className="mt-1 text-[13px] text-[#5A6560]">
                Session lifetimes, password policies, and multi-factor authentication are managed strictly by the live SUTRA backend and cannot be toggled from the browser.
              </p>
            </div>
          )}
        </section>
      )}

      {activeTab === 'preferences' && (
        <section className="space-y-5 rounded-[8px] border border-[#E5E2D9] bg-white p-5">
          <Banner tone="info" title="Frontend preferences — stored in this browser only">
            Changes below affect only display formatting and motion in this browser. They never alter underlying records, UTC storage, or backend permissions.
          </Banner>

          <div className="divide-y divide-[#E5E2D9]">
            <div className="flex flex-wrap items-center justify-between gap-4 py-3.5">
              <div>
                <p className="font-display text-[14px] font-medium text-[#102D2A]">Table &amp; layout density</p>
                <p className="text-[12px] text-[#5A6560]">Controls vertical spacing inside workspace lists and tables.</p>
              </div>
              <SegmentedControl<DensityPref>
                ariaLabel="Layout density"
                size="sm"
                value={prefs.density}
                onChange={(val) => updatePref('density', val)}
                options={[
                  { value: 'comfortable', label: 'Comfortable' },
                  { value: 'compact', label: 'Compact' },
                ]}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 py-3.5">
              <div>
                <p className="font-display text-[14px] font-medium text-[#102D2A]">Timestamp display</p>
                <p className="text-[12px] text-[#5A6560]">Display organisation local time (IST) or UTC by default.</p>
              </div>
              <SegmentedControl<'ist' | 'utc'>
                ariaLabel="Timestamp display"
                size="sm"
                value={prefs.showUtc ? 'utc' : 'ist'}
                onChange={(val) => updatePref('showUtc', val === 'utc')}
                options={[
                  { value: 'ist', label: 'IST (Org)' },
                  { value: 'utc', label: 'UTC' },
                ]}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 py-3.5">
              <div>
                <p className="font-display text-[14px] font-medium text-[#102D2A]">Amount formatting</p>
                <p className="text-[12px] text-[#5A6560]">Show original email phrasing, normalised INR, or both.</p>
              </div>
              <SegmentedControl<AmountDisplayPref>
                ariaLabel="Amount display"
                size="sm"
                value={prefs.amountDisplay}
                onChange={(val) => updatePref('amountDisplay', val)}
                options={[
                  { value: 'both', label: 'Both' },
                  { value: 'original', label: 'Original' },
                  { value: 'normalised', label: 'Normalised INR' },
                ]}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 py-3.5">
              <div>
                <p className="font-display text-[14px] font-medium text-[#102D2A]">Sidebar default</p>
                <p className="text-[12px] text-[#5A6560]">Choose expanded navigation labels or compact icon rail on desktop.</p>
              </div>
              <SegmentedControl<'expanded' | 'collapsed'>
                ariaLabel="Sidebar default state"
                size="sm"
                value={prefs.sidebarCollapsed ? 'collapsed' : 'expanded'}
                onChange={(val) => updatePref('sidebarCollapsed', val === 'collapsed')}
                options={[
                  { value: 'expanded', label: 'Expanded' },
                  { value: 'collapsed', label: 'Collapsed rail' },
                ]}
              />
            </div>

            <div className="py-3.5">
              <Switch
                label="3D constellation & hero visuals"
                description="Falls back automatically to SVG/CSS on mobile, reduced motion, or low-power devices."
                checked={prefs.enable3D}
                onChange={(checked) => updatePref('enable3D', checked)}
              />
            </div>

            <div className="py-3.5">
              <Switch
                label="Reduced motion override"
                description="Disables smooth transitions and continuous motion regardless of OS setting."
                checked={prefs.reducedMotionOverride}
                onChange={(checked) => updatePref('reducedMotionOverride', checked)}
              />
            </div>
          </div>
        </section>
      )}

      {activeTab === 'mode' && env.ALLOW_MODE_SWITCH && (
        <section className="space-y-5 rounded-[8px] border border-[#E5E2D9] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E2D9] pb-4">
            <div>
              <h2 className="font-display text-[16px] font-semibold text-[#102D2A]">
                Active data source
              </h2>
              <p className="mt-1 text-[13px] text-[#5A6560]">
                Demo and live data never mix. Live mode never falls back to demo annotations automatically.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {mode === 'demo' ? (
                <Button variant="primary" size="sm" onClick={() => setConfirmMode('live')}>
                  Switch to Live mode
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setConfirmMode('demo')}>
                  Switch to Demo dataset
                </Button>
              )}
            </div>
          </div>

          <DefinitionList
            columns={2}
            items={[
              {
                term: 'Current mode',
                value: mode === 'demo' ? 'Demo dataset (synthetic benchmark)' : 'Live backend',
              },
              {
                term: 'Configured API base URL',
                value: <span className="font-mono text-[12px]">{env.API_BASE_URL}</span>,
              },
              {
                term: 'Health check',
                value: health
                  ? `${health.status}${health.version ? ` (${health.version})` : ''}`
                  : healthError
                    ? `Unreachable (${healthError.code})`
                    : 'Not checked',
              },
              { term: 'Organisation timezone', value: env.ORG_TIMEZONE },
            ]}
          />

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              loading={healthChecking}
              onClick={() => void refreshHealth()}
              leftIcon={<RefreshCw size={14} aria-hidden="true" />}
            >
              Re-check health
            </Button>
          </div>
        </section>
      )}

      <Dialog
        open={confirmMode !== null}
        onClose={() => setConfirmMode(null)}
        title={confirmMode === 'live' ? 'Switch to Live backend mode?' : 'Switch to Demo dataset mode?'}
        description="Your current query cache will be cleared and SUTRA will connect strictly to the selected source."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmMode(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmSwitch}>
              Confirm switch
            </Button>
          </>
        }
      >
        {confirmMode === 'live' ? (
          <p className="text-[14px] leading-[1.55]">
            SUTRA will attempt to connect to <span className="font-mono text-[12px]">{env.API_BASE_URL}</span>. If the backend is unreachable, the workspace will display a Service Unavailable screen and will not fall back to demo data.
          </p>
        ) : (
          <p className="text-[14px] leading-[1.55]">
            SUTRA will load the supplied synthetic benchmark ({DEMO_DATASET.meta.counts.emails} emails, {DEMO_DATASET.meta.counts.threads} conversations) with pre-authored annotations.
          </p>
        )}
      </Dialog>
    </div>
  );
};

export default SettingsPage;
