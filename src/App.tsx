import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './lib/store';
import Login from './components/Login';
import Signup from './components/Signup';
import Dashboard from './components/Dashboard';
import TimeTracker from './components/TimeTracker';
import Screenshots from './components/Screenshots';
import TeamView from './components/TeamView';
import AdminPanel from './components/AdminPanel';
import Layout from './components/Layout';

function PrivateRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) {
  const user = useStore((state) => state.user);
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        
        <Route path="/" element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="tracker" element={<TimeTracker />} />
          <Route path="screenshots" element={<Screenshots />} />
          
          <Route path="team" element={
            <PrivateRoute requiredRole="manager">
              <TeamView />
            </PrivateRoute>
          } />
          
          <Route path="admin" element={
            <PrivateRoute requiredRole="admin">
              <AdminPanel />
            </PrivateRoute>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
export default App;