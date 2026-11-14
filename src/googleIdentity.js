let loading;

export function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => window.google?.accounts?.oauth2 ? resolve() : reject(new Error('Google sign-in did not initialize.'));
    script.onerror = () => { script.remove(); reject(new Error('Could not load Google sign-in. Check your connection and try again.')); };
    document.head.appendChild(script);
  }).catch((error) => { loading = null; throw error; });
  return loading;
}
