import React, { useState } from 'react';
import { FiUser, FiShield, FiLock, FiMail, FiArrowLeft, FiLogIn, FiAlertTriangle } from 'react-icons/fi';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

function Login({ onLoginSuccess }) {
  const [step, setStep] = useState('role'); // 'role', 'code', 'credentials'
  const [role, setRole] = useState(null); // 'civilian', 'bmc_official'
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSelectRole = (selectedRole) => {
    setRole(selectedRole);
    setError('');
    if (selectedRole === 'bmc_official') {
      setStep('code');
    } else {
      setStep('credentials');
    }
  };

  const handleVerifyCode = (e) => {
    e.preventDefault();
    if (['deformation', 'crack'].includes(code.trim().toLowerCase())) {
      setError('');
      setStep('credentials');
    } else {
      setError('Invalid officer access code. Please try again.');
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Invalid credentials.');
      onLoginSuccess({ email: result.data.email, role: result.data.role });
    } catch (err) {
      console.error('Login error', err);
      setError(err.message || 'Unable to connect to the backend server.');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and Password are required.');
      return;
    }
    
    const assignedRole = ['deformation', 'crack'].includes(code.trim().toLowerCase()) ? 'BMC Official' : 'Civilian';
    
    try {
      const response = await fetch('/api/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: assignedRole }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create account.');
      onLoginSuccess({ email: result.data.email, role: result.data.role });
    } catch (err) {
      console.error('Registration error', err);
      setError(err.message || 'Unable to connect to the backend server.');
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const userInfoRes = await fetch(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
        );
        const userInfo = await userInfoRes.json();
        
        onLoginSuccess({
          email: userInfo.email,
          role: role === 'bmc_official' ? 'BMC Official' : 'Civilian',
        });
      } catch (err) {
        console.error('Failed to fetch user info', err);
        setError('Failed to fetch user info from Google.');
      }
    },
    onError: () => setError('Google Sign-In failed.'),
  });

  const handleGoBack = () => {
    setError('');
    if (step === 'credentials' && role === 'bmc_official') {
      setStep('code');
    } else {
      setStep('role');
      setRole(null);
      setCode('');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">R</div>
          <h2>ROAD INSPECTOR</h2>
          <p>Real-Time Infrastructure Monitoring</p>
        </div>

        {error && (
          <div className="login-error" style={{ marginBottom: '20px' }}>
            <FiAlertTriangle style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {step === 'role' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px', fontSize: '14px', color: 'var(--text)' }}>
              Select your role to get started
            </div>
            <div className="role-grid">
              <div className="role-card" onClick={() => handleSelectRole('civilian')}>
                <FiUser className="role-icon" />
                <span className="role-title">Civilian</span>
                <span className="role-desc">Report road deformations in your neighborhood</span>
              </div>
              <div className="role-card" onClick={() => handleSelectRole('bmc_official')}>
                <FiShield className="role-icon" />
                <span className="role-title">BMC Official</span>
                <span className="role-desc">Access official monitoring systems</span>
              </div>
            </div>
            
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => { setStep('register'); setError(''); setCode(''); setEmail(''); setPassword(''); }}
              >
                Create Account
              </button>
            </div>
          </div>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerifyCode} className="login-form">
            <div className="input-group">
              <label>BMC Officer Access Code</label>
              <div className="input-wrapper">
                <FiLock style={{ position: 'absolute', left: '14px', color: 'var(--muted)' }} />
                <input
                  type="password"
                  placeholder="Enter secret code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  autoFocus
                />
              </div>
            </div>
            <button type="submit" className="btn-primary">
              Verify Code
            </button>
            <button type="button" className="btn-secondary" onClick={handleGoBack}>
              <FiArrowLeft style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Back
            </button>
          </form>
        )}

        {step === 'credentials' && (
          <form onSubmit={handleLoginSubmit} className="login-form">
            <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
              Signing in as <strong style={{ color: 'var(--blue)' }}>{role === 'bmc_official' ? 'BMC Official' : 'Civilian'}</strong>
            </div>

            <div className="input-group">
              <label>Email Address</label>
              <div className="input-wrapper">
                <FiMail style={{ position: 'absolute', left: '14px', color: 'var(--muted)' }} />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label>Password</label>
              <div className="input-wrapper">
                <FiLock style={{ position: 'absolute', left: '14px', color: 'var(--muted)' }} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary">
              <FiLogIn /> Sign In
            </button>

            <div className="login-divider">or</div>

            <button type="button" className="btn-google" onClick={handleGoogleLogin}>
              <svg className="google-icon" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Sign in with Google
            </button>

            <button type="button" className="btn-secondary" onClick={handleGoBack}>
              <FiArrowLeft style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Change Role
            </button>
          </form>
        )}

        {step === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="login-form">
            <div style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>
              Create New Account
            </div>

            <div className="input-group">
              <label>Email Address</label>
              <div className="input-wrapper">
                <FiMail style={{ position: 'absolute', left: '14px', color: 'var(--muted)' }} />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label>Password</label>
              <div className="input-wrapper">
                <FiLock style={{ position: 'absolute', left: '14px', color: 'var(--muted)' }} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label>Special Code (Optional)</label>
              <div className="input-wrapper">
                <FiShield style={{ position: 'absolute', left: '14px', color: 'var(--muted)' }} />
                <input
                  type="password"
                  placeholder="Enter secret code if applicable"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                />
              </div>
              <small style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                If you have a BMC Officer code, enter it above to gain official access. Otherwise, leave blank for a Civilian account.
              </small>
            </div>

            <button type="submit" className="btn-primary">
              <FiUser style={{ marginRight: '6px' }} /> Create Account
            </button>

            <button type="button" className="btn-secondary" onClick={handleGoBack}>
              <FiArrowLeft style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const LoginWithGoogle = (props) => (
  <GoogleOAuthProvider clientId="690090122752-6gcpa1r0mr5lhltl3dj1nliu9r6bc8lj.apps.googleusercontent.com">
    <Login {...props} />
  </GoogleOAuthProvider>
);

export default LoginWithGoogle;
