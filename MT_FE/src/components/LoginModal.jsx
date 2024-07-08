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
      }}
    >
      <div
        style={{
          backgroundColor: '#f7f8fa',
          padding: '20px',
          borderRadius: '12px',
          width: '80%',
          maxWidth: '400px',
          boxShadow: '0px 4px 15px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h3 style={{ borderBottom: '1px solid #e1e4e8', paddingBottom: '10px' }}>
          {isLoginMode ? 'Login' : 'Register'}
        </h3>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: '15px' }}>
            Email:
            <input
              type="text"
              name="email"
              value={credentials.email}
              onChange={handleInputChange}
              required
              style={{
                width: '95%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #e1e4e8',
                marginTop: '5px',
              }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '15px' }}>
            Password:
            <input
              type="password"
              name="password"
              value={credentials.password}
              onChange={handleInputChange}
              required
              style={{
                width: '95%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #e1e4e8',
                marginTop: '5px',
              }}
            />
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setIsLoginMode(!isLoginMode)}
              style={{
                padding: '10px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#0366d6',
                cursor: 'pointer',
              }}
            >
              {isLoginMode ? 'New User?' : 'Existing User?'}
            </button>
            <div>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 15px',
                  marginRight: '10px',
                  backgroundColor: '#d73a49',
                  color: '#fff',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.3s',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '10px 15px',
                  backgroundColor: '#0366d6',
                  color: '#fff',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.3s',
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
