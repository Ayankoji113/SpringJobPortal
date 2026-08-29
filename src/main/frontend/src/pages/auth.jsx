import React, { useContext, useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AuthContext } from '../context/auth-context';
import * as authService from '../services/authService';
import { errorMessage } from '../services/api';
import { Button, Input, Select } from '../components/ui';
import { useToast } from '../components/ui/toast-context';
import './auth.css';

const EMAIL = {
  required: 'Email is required',
  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
};

function AuthLayout({ title, intro, children, footer }) {
  return (
    <div className="jp-container jp-page">
      <div className="jp-auth">
        <h1 className="jp-h1">{title}</h1>
        {intro && <p className="jp-sm jp-muted jp-auth__intro">{intro}</p>}
        {children}
        {footer && <p className="jp-sm jp-auth__foot">{footer}</p>}
      </div>
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
      intro="Use the email you registered with."
      footer={<>No account yet? <Link to="/register">Create one</Link></>}
    >
      <form className="jp-auth__form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email', EMAIL)} />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password', { required: 'Password is required' })}
        />
        {failure && <p className="jp-auth__error" role="alert">{failure}</p>}
        <Button type="submit" variant="primary" block size="lg" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
        <p className="jp-sm"><Link to="/forgot-password">Forgot your password?</Link></p>
      </form>
    </AuthLayout>
  );
}

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
      intro="Job seekers apply and save jobs. Employers post them."
      footer={<>Already registered? <Link to="/login">Sign in</Link></>}
    >
      <form className="jp-auth__form" onSubmit={handleSubmit(onSubmit)} noValidate>
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
        <Select label="I am a" error={errors.role?.message} {...register('role', { required: 'Pick one' })}>
          <option value="JOB_SEEKER">Job seeker</option>
          <option value="EMPLOYER">Employer</option>
        </Select>
        {failure && <p className="jp-auth__error" role="alert">{failure}</p>}
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
    <AuthLayout title="Reset your password" intro="We will email you a reset link if the address is registered.">
      {sent ? (
        <p className="jp-auth__notice">
          If that address has an account, a reset link is on its way. The link expires in one hour.
        </p>
      ) : (
        <form className="jp-auth__form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email', EMAIL)} />
          <Button type="submit" variant="primary" block size="lg" disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </Button>
          <p className="jp-sm"><Link to="/login">Back to sign in</Link></p>
        </form>
      )}
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
      <AuthLayout title="Reset your password">
        <p className="jp-auth__notice">
          This link is missing its token. Request a new one from <Link to="/forgot-password">the reset page</Link>.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password">
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
        {failure && <p className="jp-auth__error" role="alert">{failure}</p>}
        <Button type="submit" variant="primary" block size="lg" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Update password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
