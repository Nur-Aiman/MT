// LoginModal.js
import React, { useState } from 'react';

function LoginModal({ isOpen, onClose }) {
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Submitting login', credentials);
    // Here you would usually send the credentials to the server for verification
    // For now, we'll just close the modal
    onClose();
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
          maxWidth: '400px', // Ensure the modal isn't too wide on larger screens
          boxShadow: '0px 4px 15px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h3 style={{ borderBottom: '1px solid #e1e4e8', paddingBottom: '10px' }}>Login</h3>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: '15px' }}>
            Username/Email:
            <input
              type="text"
              name="username"
              value={credentials.username}
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
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginModal;
