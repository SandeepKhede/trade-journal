import React, { useEffect, useState } from 'react'
import { Layout, Menu, Badge, Typography, Button, Drawer, Spin } from 'antd'
import {
  DashboardOutlined,
  TableOutlined,
  FileTextOutlined,
  MenuOutlined,
  LogoutOutlined
} from '@ant-design/icons'
import Dashboard from './components/Dashboard'
import TradeTable from './components/TradeTable'
import TradeForm from './components/TradeForm'
import LoginPage from './components/LoginPage'
import AppHeader from './components/AppHeader'
import { initFirebase, subscribeTrades, fetchTrades } from './firebase'
import { subscribeToAuthState, getCurrentUser } from './auth'

const { Header, Sider, Content } = Layout

export default function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [view, setView] = useState('dashboard')
  const [trades, setTrades] = useState([])
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const isMobile = window.innerWidth <= 768

  useEffect(() => {
    // Initialize firebase and setup auth listener
    if (window.__FIREBASE_CONFIG__) {
      initFirebase(window.__FIREBASE_CONFIG__);
      
      const unsubAuth = subscribeToAuthState((user) => {
        setUser(user);
        setLoading(false);
      });

      return () => unsubAuth();
    }
  }, []);

  useEffect(() => {
    // Only subscribe to trades when user is authenticated
    if (user) {
      const unsubTrades = subscribeTrades((next) => setTrades(next));
      return () => unsubTrades && unsubTrades();
    } else {
      setTrades([]); // Clear trades when logged out
    }
  }, [user])

  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: 'Overview' },
    { key: 'trades', icon: <TableOutlined />, label: 'Trades' },
    { key: 'add', icon: <FileTextOutlined />, label: 'Add Trade' },
  ]

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#f0f2f5'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
          <div className="logo" style={{ color: 'white', padding: 16 }}>
            Trading Journal
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[view]}
            onClick={({ key }) => setView(key)}
            items={menuItems}
          />
        </Sider>
      )}

      <Drawer
        placement="left"
        visible={mobileMenuVisible}
        onClose={() => setMobileMenuVisible(false)}
        bodyStyle={{ padding: 0 }}
      >
        <div className="logo" style={{ color: 'black', padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          Trading Journal
        </div>
        <Menu
          mode="inline"
          selectedKeys={[view]}
          onClick={({ key }) => {
            setView(key)
            setMobileMenuVisible(false)
          }}
          items={menuItems}
        />
      </Drawer>
      <Layout>
        <AppHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileMenuVisible(true)}
                style={{ marginRight: 16 }}
              />
            )}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Badge count={trades.length} showZero>
                <span>Total Trades</span>
              </Badge>
              <span style={{ marginLeft: 16 }}>{user.email}</span>
            </div>
          </div>
        </AppHeader>
        <Content style={{ margin: 16 }}>
          {view === 'dashboard' && <Dashboard trades={trades} />}
          {view === 'trades' && <TradeTable trades={trades} />}
          {view === 'add' && <TradeForm />}
        </Content>
      </Layout>
    </Layout>
  )
}
