import React from 'react';
import { Button, Layout, Menu, Space } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { logout } from '../auth';

const { Header } = Layout;

export default function AppHeader() {
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
      <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
        Trading Journal
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