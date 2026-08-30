import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { TravelDashboard } from './components';
import { useDeployedBoardContext } from './hooks';

const App: React.FC = () => {
  const boardApiProvider = useDeployedBoardContext();
  const [boardDeployments, setBoardDeployments] = useState<any[]>([]);

  useEffect(() => {
    // Only track real deployments
    const subscription = boardApiProvider.boardDeployments$.subscribe({
      next: (deployments) => {
        setBoardDeployments(deployments || []);
      },
      error: () => {
        setBoardDeployments([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [boardApiProvider]);

  // If there are multiple deployments we show them all, plus one new one.
  // In the real app, we usually just have the uninitialized one to start.
  return (
    <Box sx={{ background: '#f9fafb', minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100%' }}>
      {boardDeployments.map((boardDeployment, idx) => (
        <div data-testid={`board-${idx}`} key={`board-${idx}`}>
          <TravelDashboard boardDeployment$={boardDeployment} />
        </div>
      ))}
      {boardDeployments.length === 0 && (
        <div data-testid="board-start">
          <TravelDashboard />
        </div>
      )}
    </Box>
  );
};

export default App;
