import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import RiverEditor from '../src/pages/RiverEditor';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import * as firestore from 'firebase/firestore';

// Mock quill completely to avoid DOM issues
jest.mock('react-quill', () => () => <div data-testid="quill-mock"></div>);

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: '123' }, isAdmin: false })
}));

jest.mock('firebase/firestore', () => {
   const original = jest.requireActual('firebase/firestore');
   return {
     ...original,
     getDoc: jest.fn(() => Promise.resolve({
       exists: () => true,
       data: () => ({
          id: '123', name: 'Test River', gauges: [], accessPoints: []
       })
     }))
   };
});

test('renders suggest river editor without crashing', async () => {
   try {
     render(
       <MemoryRouter initialEntries={['/suggest/123']}>
         <Routes>
           <Route path="/suggest/:riverId" element={<RiverEditor />} />
         </Routes>
       </MemoryRouter>
     );
     await waitFor(() => screen.getByTestId('quill-mock'), {timeout: 2000});
     console.log('RENDER SUCCESS');
   } catch(e) {
     console.error('TEST CAUGHT CRASH:', e);
   }
});
