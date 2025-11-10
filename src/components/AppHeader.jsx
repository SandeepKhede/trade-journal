import React, { useState, useEffect } from 'react';
import { Button, Layout, Menu, Space } from 'antd';
import { LogoutOutlined, MenuOutlined } from '@ant-design/icons';
import { logout } from '../auth';

const { Header } = Layout;

export default function AppHeader({ onToggleMobileMenu }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Remove event listener on cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    const { error } = await logout();
    if (error) {
      // Handle error if needed
      console.error(error);
    }
  };

  return (
    <Header style={{ 
      display: 'flex', 
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 24px',
      backgroundColor: '#fff',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {isMobile && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={onToggleMobileMenu}
          />
        )}
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
          Trading Journal
        </div>
      </div>
      
      <Space>
        <Button 
          onClick={handleLogout}
          icon={<LogoutOutlined />}
          type="link"
        >
          Logout
        </Button>
      </Space>
    </Header>
  );
}