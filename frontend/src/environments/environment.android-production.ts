// Fixed, trusted production API origin for the native Android build only.
// HealthBridge requires an absolute HTTPS URL (the web production build keeps a relative
// '/api/v1' since it is served same-origin). Do not resolve this to a relative path or an
// arbitrary/user-suppliable origin.
export const environment = {
  production: true,
  apiUrl: 'https://finance-tracker-etxo.onrender.com/api/v1',
  googleClientId: '1009572270108-24pbsh6lu9f9b0j80dkt0c28seomlfv1.apps.googleusercontent.com',
};
