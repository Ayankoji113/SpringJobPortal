import React, { useContext, useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AlertCircle, BadgeCheck, Banknote, Building2, Clock, MailCheck, Search } from 'lucide-react';
import { AuthContext } from '../context/auth-context';
import * as authService from '../services/authService';
import { errorMessage } from '../services/api';
import { Button, Input } from '../components/ui';
import { ResponseClock } from '../components/ui/kit';
import { useToast } from '../components/ui/toast-context';
import './auth.css';

const DAY = 86400000;

const EMAIL = {
  required: 'Email is required',
  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
};

const PROMISES = [
  [BadgeCheck, 'Every listing is real', 'A person checks each posting before it goes live.'],
  [Banknote, 'The pay is shown', 'Every posting carries its salary range, so you know before you apply.'],
  [Clock, 'You get an answer', 'Employers have 14 days to reply, and their on-time record is public.'],
];

/** The dark half: the three promises, and the clock that keeps the third one. */
function PromiseBand() {
  // Sample dates, read once per mount so render stays pure.
  const [sample] = useState(() => {
    const now = Date.now();
    return { appliedAt: new Date(now - 5 * DAY).toISOString(), respondBy: new Date(now + 9 * DAY).toISOString() };
  });

  return (
    <aside className="jp-auth__band jp-on-band" aria-label="What JobPortal promises">
      <div className="jp-auth__band-inner">
        <p className="jp-auth__claim">
          Every employer here has <span className="jp-auth__time">14 days</span> to answer you.
        </p>
        <figure className="jp-auth__clock">
          <ResponseClock size="lg" appliedAt={sample.appliedAt} respondBy={sample.respondBy} status="PENDING" />
          <figcaption className="jp-sm jp-muted">
            Five days after you apply, this is what you see. One tick per day, and the employer’s record
            shows whether they answer in time.
          </figcaption>
        </figure>
        <ul className="jp-auth__promises">
          {PROMISES.map(([icon, title, body]) => (
            <li key={title}>
              {React.createElement(icon, { size: 18, 'aria-hidden': true })}
              <div>
                <p className="jp-auth__promise-title">{title}</p>
                <p className="jp-sm jp-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function AuthLayout({ title, intro, children, footer }) {
  return (
    <div className="jp-auth">
      <section className="jp-auth__panel">
        <div className="jp-auth__inner">
          <h1 className="jp-display">{title}</h1>
          {intro && <p className="jp-auth__intro">{intro}</p>}
          {children}
          {footer && <p className="jp-sm jp-auth__foot">{footer}</p>}
        </div>
      </section>
      <PromiseBand />
    </div>
  );
}

/** Always mounted, so a failure that appears inside it is announced. */
function Failure({ message }) {
  return (
    <div aria-live="assertive" className="jp-auth__live">
      {message && (
        <p className="jp-auth__error"><AlertCircle size={15} aria-hidden="true" />{message}</p>
      )}
    </div>
  );
}

export function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [failure, setFailure] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ mode: 'onBlur' });

  const onSubmit = async (values) => {
    setFailure(null);
    try {
      const user = await login(values.email, values.password);
      toast(`Signed in as ${user.fullName}`, 'success');
      navigate(location.state?.from || (user.role === 'EMPLOYER' ? '/employer-dashboard' : '/jobs'), { replace: true });
    } catch (err) {
      setFailure(errorMessage(err, 'Those details did not match an account.'));
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      intro="Pick up where you left off: your applications, their clocks, and the jobs you saved."
      footer={<>No account yet? <Link to="/register">Create one</Link></>}
    >
      <form className="jp-auth__form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email', EMAIL)} />
        <div className="jp-auth__pw">
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password', { required: 'Password is required' })}
          />
          <Link className="jp-sm jp-auth__forgot" to="/forgot-password">Forgot your password?</Link>
        </div>
        <Failure message={failure} />
        <Button type="submit" variant="primary" block size="lg" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}

const ROLES = [
  ['JOB_SEEKER', Search, 'Job seeker', 'Apply to roles with the pay shown and follow each employer’s 14-day clock.'],
  ['EMPLOYER', Building2, 'Employer', 'Post roles with a pay range and answer every applicant within 14 days.'],
];

export function Register() {
  const { register: signUp } = useContext(AuthContext);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [failure, setFailure] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    mode: 'onBlur',
    defaultValues: { role: 'JOB_SEEKER' },
  });

  const onSubmit = async (values) => {
    setFailure(null);
    try {
      const user = await signUp(values);
      toast('Account created', 'success');
      navigate(user.role === 'EMPLOYER' ? '/employer-dashboard' : '/jobs', { replace: true });
    } catch (err) {
      setFailure(errorMessage(err, 'Could not create the account.'));
    }
  };

  return (
    <AuthLayout
      title="Create an account"
      intro="Free for job seekers and for employers. It takes under a minute."
      footer={<>Already registered? <Link to="/login">Sign in</Link></>}
    >
      <form className="jp-auth__form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset className="jp-roles" aria-describedby={errors.role ? 'role-error' : undefined}>
          <legend className="jp-field__label">I am joining as</legend>
          <div className="jp-roles__options">
            {ROLES.map(([value, icon, title, body]) => (
              <label key={value} className="jp-role">
                <input type="radio" value={value} {...register('role', { required: 'Pick one' })} />
                <span className="jp-role__text">
                  <span className="jp-role__title">
                    {React.createElement(icon, { size: 16, 'aria-hidden': true })}{title}
                  </span>
                  <span className="jp-role__body">{body}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.role && (
            <span id="role-error" className="jp-field__error" role="alert">
              <AlertCircle size={13} aria-hidden="true" /> {errors.role.message}
            </span>
          )}
        </fieldset>
        <Input
          label="Full name"
          autoComplete="name"
          error={errors.fullName?.message}
          {...register('fullName', {
            required: 'Full name is required',
            minLength: { value: 2, message: 'Use at least 2 characters' },
          })}
        />
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email', EMAIL)} />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          error={errors.password?.message}
          {...register('password', {
            required: 'Password is required',
            minLength: { value: 8, message: 'Use at least 8 characters' },
          })}
        />
        <Failure message={failure} />
        <Button type="submit" variant="primary" block size="lg" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ mode: 'onBlur' });

  const onSubmit = async (values) => {
    try {
      await authService.forgotPassword(values.email);
      setSent(true);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      intro="Enter the email you registered with. If it has an account, we send a link to choose a new password."
      footer={<>Remembered it? <Link to="/login">Back to sign in</Link></>}
    >
      <div aria-live="polite">
        {sent ? (
          <div className="jp-auth__notice">
            <MailCheck size={18} aria-hidden="true" />
            <p>If that address has an account, a reset link is on its way. The link expires in one hour.</p>
          </div>
        ) : (
          <form className="jp-auth__form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email', EMAIL)} />
            <Button type="submit" variant="primary" block size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [failure, setFailure] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ mode: 'onBlur' });
  const token = params.get('token') || '';

  const onSubmit = async (values) => {
    setFailure(null);
    try {
      await authService.resetPassword(token, values.newPassword);
      toast('Password updated. Sign in with the new one.', 'success');
      navigate('/login', { replace: true });
    } catch (err) {
      setFailure(errorMessage(err, 'That reset link is invalid or has expired.'));
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Reset your password" footer={<>Remembered it? <Link to="/login">Back to sign in</Link></>}>
        <div className="jp-auth__notice jp-auth__notice--warn" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <p>
            This link is missing its token. Request a new one from <Link to="/forgot-password">the reset page</Link>.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      intro="Your old password stops working as soon as you save this one. You sign in with the new one next."
      footer={<>Link expired? <Link to="/forgot-password">Request a new one</Link></>}
    >
      <form className="jp-auth__form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          error={errors.newPassword?.message}
          {...register('newPassword', {
            required: 'A new password is required',
            minLength: { value: 8, message: 'Use at least 8 characters' },
          })}
        />
        <Failure message={failure} />
        <Button type="submit" variant="primary" block size="lg" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Update password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
