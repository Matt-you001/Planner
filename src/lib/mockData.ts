import { User } from 'firebase/auth';
import { Task, System, WithId, Goal } from './types';
import { format } from 'date-fns';

export const MOCK_USER = {
  uid: 'mock-user-123',
  email: 'demo@endinmind.app',
  displayName: 'Demo User',
  emailVerified: true,
  isAnonymous: true,
  metadata: {},
  providerData: [],
  refreshToken: '',
  tenantId: null,
  delete: async () => {},
  getIdToken: async () => 'mock-token',
  getIdTokenResult: async () => ({
    token: 'mock-token',
    expirationTime: '0',
    authTime: '0',
    issuedAtTime: '0',
    signInProvider: 'anonymous',
    claims: {},
    p: {} // Adding missing property for User interface compatibility if needed, though strictly it's not in the type definition usually
  }),
  reload: async () => {},
  toJSON: () => ({}),
  phoneNumber: null,
  photoURL: null,
} as unknown as User;

const today = format(new Date(), 'yyyy-MM-dd');

export const MOCK_TASKS: WithId<Task>[] = [];

export const MOCK_SYSTEMS: WithId<System>[] = [];

export const MOCK_GOALS: WithId<Goal>[] = [];
