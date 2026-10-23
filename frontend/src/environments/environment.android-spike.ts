export const environment = {
  production: false,
  apiUrl: 'http://10.0.2.2:4000/api/v1',
  // Same Web OAuth client as environment.ts — Android's native Credential Manager sign-in needs
  // this as `webClientId` (the ID-token audience the backend verifies), not a separate Android
  // client ID. The Android OAuth client (package name + SHA-1) is configured in Google Cloud
  // Console only and never referenced in app code.
  googleClientId: '1009572270108-24pbsh6lu9f9b0j80dkt0c28seomlfv1.apps.googleusercontent.com',
};