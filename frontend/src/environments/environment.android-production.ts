// Fixed, trusted production API origin for the native Android build only.
// HealthBridge requires an absolute HTTPS URL (the web production build keeps a relative
// '/api/v1' since it is served same-origin). Replace the placeholder below with the real
// deployed backend origin before building a production Android release — do not let this
// resolve to a relative path or an arbitrary/user-suppliable origin.
export const environment = {
  production: true,
  apiUrl: 'https://REPLACE_WITH_PRODUCTION_DOMAIN/api/v1',
  googleClientId: '1009572270108-24pbsh6lu9f9b0j80dkt0c28seomlfv1.apps.googleusercontent.com',
};
