/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Bozze from './pages/Bozze';
import Categorizzazione from './pages/Categorizzazione';
import Chat from './pages/Chat';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import Impostazioni from './pages/Impostazioni';
import LandingPage from './pages/LandingPage';
import Notetaker from './pages/Notetaker';
import OAuthCallback from './pages/OAuthCallback';
import Onboarding from './pages/Onboarding';
import OnboardingPage from './pages/OnboardingPage';
import Pianificazione from './pages/Pianificazione';
import Fatturazione from './pages/Fatturazione';
import Integrazioni from './pages/Integrazioni';
import Organizzazione from './pages/Organizzazione';
import Persone from './pages/Persone';


export const PAGES = {
    "Bozze": Bozze,
    "Categorizzazione": Categorizzazione,
    "Chat": Chat,
    "Dashboard": Dashboard,
    "Home": Home,
    "Impostazioni": Impostazioni,
    "LandingPage": LandingPage,
    "Notetaker": Notetaker,
    "OAuthCallback": OAuthCallback,
    "Onboarding": Onboarding,
    "OnboardingPage": OnboardingPage,
    "Pianificazione": Pianificazione,
    "Fatturazione": Fatturazione,
    "Integrazioni": Integrazioni,
    "Organizzazione": Organizzazione,
    "Persone": Persone,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};