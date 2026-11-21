import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, KeyRound, ShieldAlert, UserCheck } from 'lucide-react';
import { useSutra } from '../app/providers';
import { Wordmark } from '../components/brand/Wordmark';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { Input } from '../components/ui/Input';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { ServiceUnavailable } from '../components/ui/ServiceUnavailable';
import { env, type DataMode } from '../config/env';
import { DEMO_DATASET } from '../data/demoData';
import { SutraApiError } from '../services/apiClient';
import { healthService } from '../services/healthService';
import type { Persona } from '../types/api';

const PERSONA_VISIBILITY_NOTES: Record<string, string> = {
  'inst.admin':
    'Full demo corpus (unscoped) — illustrates an institutional administrator reviewing all 10 conversations.',
  'head.mech':
    'Sees conversations where mech.hod@northbridge.edu is sender or recipient under thread-participant policy.',
  'faculty.mech':
    'Sees conversations where mech.faculty@northbridge.edu is sender or recipient.',
  'staff.purchase':
    'Sees procurement conversations involving purchase@northbridge.edu.',
  'student.demo':
    'Sees only conversations involving class.representatives@northbridge.edu (THR-002).',
  sysadmin:
    'Full demo corpus (unscoped) — illustrates a system administrator inspecting ingestion and system health.',
  compliance:
    'Full demo corpus (unscoped) — illustrates a compliance reviewer auditing decisions and sources.',
};

export const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    mode,
    setMode,
    dataSource,
    persona,
    selectPersona,
    liveUser,
    setLiveUser,
    health,
    healthError,
    healthChecking,
    refreshHealth,
    addToast,
  } = useSutra();

  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(
    persona?.persona_id || DEMO_DATASET.personas[0]?.persona_id || '',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<{ message: string; requestId?: string } | null>(null);

  // If already authenticated in live mode, allow quick entry or redirect
  useEffect(() => {
    if (mode === 'live' && liveUser) {
      navigate('/app/overview', { replace: true });
    }
  }, [mode, liveUser, navigate]);

  const showLiveOffline =
    mode === 'live' &&
    healthError !== null &&
    (healthError.code === 'NETWORK_ERROR' ||
      healthError.code === 'TIMEOUT' ||
      healthError.code === 'DEPENDENCY_UNAVAILABLE' ||
      healthError.code === 'UPSTREAM_TIMEOUT');

  const handleModeChange = (next: DataMode) => {
    setLoginError(null);
    setMfaRequired(false);
    setMfaCode('');
    setMode(next);
  };

  const handleEnterDemo = (chosen?: Persona) => {
    const target =
      chosen ||
      DEMO_DATASET.personas.find((p) => p.persona_id === selectedPersonaId) ||
      DEMO_DATASET.personas[0];
    if (!target) return;
    selectPersona(target);
    addToast({
      tone: 'info',
      title: `Demo persona active: ${target.display_name}`,
      message: 'Demo dataset loaded with client-side participant visibility illustration.',
    });
    navigate('/app/overview');
  };

  const handleLiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!email.trim() || !password) {
      setLoginError({ message: 'Enter both your institutional email address and password.' });
      return;
    }
    if (mfaRequired && !mfaCode.trim()) {
      setLoginError({ message: 'Enter the verification code to complete sign-in.' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await healthService.login(dataSource, {
        email: email.trim(),
        password,
        ...(mfaRequired ? { mfa_code: mfaCode.trim() } : {}),
      });
      if (result.status === 'MFA_REQUIRED') {
        setMfaRequired(true);
        setSubmitting(false);
        return;
      }
      if (result.user) {
        setLiveUser(result.user);
      } else {
        const me = await healthService.authMe(dataSource);
        setLiveUser(me);
      }
      navigate('/app/overview');
    } catch (err) {
      if (err instanceof SutraApiError) {
        setLoginError({ message: err.message, requestId: err.requestId });
      } else {
        setLoginError({
          message: err instanceof Error ? err.message : 'Sign-in could not be completed.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2EA] text-[#202B35]">
      <a href="#signin-main" className="skip-link">
        Skip to main content
      </a>

      <header className="border-b border-[#E5E2D9] bg-white">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link to="/" className="rounded-[4px]" aria-label="Return to SUTRA home">
            <Wordmark variant="onLight" showDevanagari size="md" />
          </Link>

          <div className="flex items-center gap-3">
            {env.ALLOW_MODE_SWITCH && (
              <SegmentedControl<DataMode>
                ariaLabel="Data mode"
                size="sm"
                value={mode}
                onChange={handleModeChange}
                options={[
                  { value: 'demo', label: 'Demo dataset' },
                  { value: 'live', label: 'Live backend' },
                ]}
              />
            )}
            <Link
              to="/"
              className="text-[13px] font-medium text-[#102D2A] underline hover:text-[#1B4A45]"
            >
              Back to home
            </Link>
          </div>
        </div>
      </header>

      <main id="signin-main" tabIndex={-1} className="mx-auto max-w-[960px] px-4 py-8 sm:px-6 focus:outline-none">
        <div className="mb-6">
          <h1 className="font-display text-[24px] font-semibold text-[#102D2A]">
            Sign in to SUTRA
          </h1>
          <p className="mt-1 text-[14px] text-[#5A6560]">
            {mode === 'demo'
              ? 'Select a demo persona to explore the synthetic benchmark with pre-authored intelligence annotations.'
              : 'Authenticate with your institutional credentials against the configured SUTRA backend.'}
          </p>
        </div>

        {mode === 'demo' ? (
          <div className="space-y-5">
            <Banner tone="demo" title="Demo persona — visibility illustrated in the browser, not enforced.">
              Selecting a persona below does not perform authentication; it illustrates how thread-participant visibility scopes conversations in the supplied synthetic benchmark.
            </Banner>

            <section
              aria-label="Demo personas"
              className="rounded-[8px] border border-[#E5E2D9] bg-white"
            >
              <div className="border-b border-[#E5E2D9] px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-[15px] font-semibold text-[#102D2A]">
                    Available benchmark personas ({DEMO_DATASET.personas.length})
                  </h2>
                  <p className="text-[12px] text-[#5A6560]">
                    Policy: {DEMO_DATASET.meta.visibility_policy}
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleEnterDemo()}
                  rightIcon={<ArrowRight size={15} aria-hidden="true" />}
                >
                  Enter demo workspace
                </Button>
              </div>

              <div role="radiogroup" aria-label="Choose a demo persona" className="divide-y divide-[#E5E2D9]">
                {DEMO_DATASET.personas.map((p) => {
                  const selected = p.persona_id === selectedPersonaId;
                  const note =
                    PERSONA_VISIBILITY_NOTES[p.persona_id] ||
                    (p.address
                      ? `Sees threads where ${p.address} is sender or recipient.`
                      : 'Sees all threads in the demo benchmark.');
                  return (
                    <label
                      key={p.persona_id}
                      className={`flex cursor-pointer items-start gap-3.5 px-5 py-3.5 transition-colors duration-150 ${
                        selected ? 'bg-[#E8EFEA]' : 'hover:bg-[#F5F2EA]/70'
                      }`}
                    >
                      <input
                        type="radio"
                        name="demo-persona"
                        value={p.persona_id}
                        checked={selected}
                        onChange={() => setSelectedPersonaId(p.persona_id)}
                        className="mt-1 h-4 w-4 accent-[#102D2A]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-[14px] font-semibold text-[#102D2A]">
                            {p.display_name}
                          </span>
                          <span className="rounded-[4px] border border-[#7B8581]/50 bg-white px-2 py-0.5 font-mono text-[11px] font-medium text-[#202B35]">
                            {p.role_code}
                          </span>
                          <span className="font-mono text-[12px] text-[#5A6560]">
                            {p.address ?? 'Full demo corpus (unscoped)'}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] text-[#5A6560]">{note}</p>
                      </div>
                      {selected && (
                        <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#102D2A] px-2 py-0.5 text-[11px] font-medium text-[#F5F2EA]">
                          <Check size={12} aria-hidden="true" />
                          <span>Selected</span>
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E2D9] bg-[#F5F2EA]/50 px-5 py-3.5">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-[#5A6560]">
                  <ShieldAlert size={14} className="text-[#7A5C1E]" aria-hidden="true" />
                  <span>Demo dataset only — not live backend authentication.</span>
                </span>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleEnterDemo()}
                  leftIcon={<UserCheck size={15} aria-hidden="true" />}
                >
                  Enter demo workspace
                </Button>
              </div>
            </section>
          </div>
        ) : showLiveOffline ? (
          <ServiceUnavailable
            baseUrl={env.API_BASE_URL}
            healthStatus={health}
            errorMessage={healthError?.message}
            requestId={healthError?.requestId}
            checking={healthChecking}
            onRetry={() => void refreshHealth()}
            onSwitchToDemo={env.ALLOW_MODE_SWITCH ? () => handleModeChange('demo') : undefined}
          />
        ) : (
          <div className="mx-auto max-w-[460px] rounded-[8px] border border-[#E5E2D9] bg-white p-6">
            <div className="mb-4 flex items-center gap-2 border-b border-[#E5E2D9] pb-3">
              <KeyRound size={17} className="text-[#102D2A]" aria-hidden="true" />
              <h2 className="font-display text-[16px] font-semibold text-[#102D2A]">
                Institutional account sign-in
              </h2>
            </div>

            {loginError && (
              <ErrorState
                title="Sign-in failed"
                message={loginError.message}
                requestId={loginError.requestId}
                className="mb-4"
              />
            )}

            <form onSubmit={handleLiveSubmit} className="space-y-4" noValidate>
              <Input
                label="Institutional email"
                type="email"
                autoComplete="username"
                placeholder="name@institution.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting || mfaRequired}
                required
              />
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting || mfaRequired}
                required
              />

              {mfaRequired && (
                <Input
                  label="Multi-factor verification code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Enter 6-digit code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  disabled={submitting}
                  hint="Your account requires a multi-factor verification step."
                  required
                />
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="font-mono text-[11px] text-[#5A6560] truncate">
                  {env.API_BASE_URL}
                </span>
                <Button type="submit" variant="primary" loading={submitting}>
                  {mfaRequired ? 'Verify & sign in' : 'Sign in'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};

export default SignInPage;
