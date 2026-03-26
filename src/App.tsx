/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CRM from './pages/CRM';
import Kanban from './pages/Kanban';
import Financial from './pages/Financial';
import Notifications from './pages/Notifications';
import AI from './pages/AI';

export default function App() {
  const [currentPath, setCurrentPath] = useState('/');

  const renderPage = () => {
    switch (currentPath) {
      case '/':
        return <Dashboard />;
      case '/crm':
        return <CRM />;
      case '/kanban':
        return <Kanban />;
      case '/financial':
        return <Financial />;
      case '/notifications':
        return <Notifications />;
      case '/ai':
        return <AI />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentPath={currentPath} onNavigate={setCurrentPath}>
      {renderPage()}
    </Layout>
  );
}
