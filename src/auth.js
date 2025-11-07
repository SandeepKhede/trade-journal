import { initFirebase } from './firebase';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';

// Initialize Firebase
initFirebase();
const auth = getAuth();

export function subscribeToAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function loginWithEmail(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (error) {
    console.error('Login error:', error);
    return { 
      user: null, 
      error: error.code === 'auth/invalid-credential' 
        ? 'Invalid username or password'
        : 'Failed to login. Please try again.' 
    };
  }
}

export async function logout() {
  try {
    await signOut(auth);
    return { error: null };
  } catch (error) {
    console.error('Logout error:', error);
    return { error: 'Failed to logout. Please try again.' };
  }
}

export function getCurrentUser() {
  return auth.currentUser;
}