import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

const storedTheme = localStorage.getItem('pft.theme');
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
  document.documentElement.classList.add('dark');
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
