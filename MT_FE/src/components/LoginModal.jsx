import React, { useState } from 'react';
import { HOST } from '../api'


function LoginModal({ isOpen, onClose }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const url = isLoginMode ? `${HOST}/users/login` : `${HOST}/users/register`; // Adjust URLs as needed
    const method = isLoginMode ? 'POST' : 'POST'; // POST for both login and register

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Success:', data);
        onClose(); 
      } else {
        console.error('Error:', data);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        transition: 'opacity 0.3s',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fafbfc',
          padding: '28px',
          borderRadius: '14px',
          width: '90%',
          maxWidth: '420px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          zIndex: 1001,
          fontFamily: 'Merriweather, serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ borderBottom: '2px solid #6fa599', paddingBottom: '12px', marginBottom: '20px', color: '#3a8a7d', fontFamily: 'Merriweather, serif', fontSize: '22px', fontWeight: 600 }}>
          {isLoginMode ? 'Login' : 'Register'}
        </h3>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: '16px' }}>
            <span style={{ fontWeight: 600, color: '#2d5a55', display: 'block', marginBottom: '6px', fontFamily: 'Merriweather, serif' }}>Email</span>
            <input
              type="text"
              name="email"
              value={credentials.email}
              onChange={handleInputChange}
              required
              style={{
                width: '100%',
                padding: '11px 12px',
                borderRadius: '6px',
                border: '1px solid #d0d4d9',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                fontSize: '14px',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#6fa599'}
              onBlur={(e) => e.target.style.borderColor = '#d0d4d9'}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '16px' }}>
            <span style={{ fontWeight: 600, color: '#2d5a55', display: 'block', marginBottom: '6px', fontFamily: 'Merriweather, serif' }}>Password</span>
            <input
              type="password"
              name="password"
              value={credentials.password}
              onChange={handleInputChange}
              required
              style={{
                width: '100%',
                padding: '11px 12px',
                borderRadius: '6px',
                border: '1px solid #d0d4d9',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                fontSize: '14px',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#6fa599'}
              onBlur={(e) => e.target.style.borderColor = '#d0d4d9'}
            />
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setIsLoginMode(!isLoginMode)}
              style={{
                padding: '10px 14px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#3a8a7d',
                cursor: 'pointer',
                fontWeight: 600,
                fontFamily: 'Merriweather, serif',
                fontSize: '14px',
              }}
            >
              {isLoginMode ? 'New User?' : 'Existing User?'}
            </button>
            <div>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '11px 18px',
                  marginRight: '10px',
                  backgroundColor: '#6fa599',
                  color: '#fff',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.3s',
                  fontWeight: 600,
                  fontFamily: 'Merriweather, serif',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '11px 18px',
                  backgroundColor: '#3a8a7d',
                  color: '#fff',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.3s',
                  fontWeight: 600,
                  fontFamily: 'Merriweather, serif',
                }}
              >
                {isLoginMode ? 'Login' : 'Register'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginModal;
