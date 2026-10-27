import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const resources = {
  en: { translation: require('./en.json') },
  am: { translation: require('./am.json') },
  or: { translation: require('./or.json') }
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

// Restore saved language
AsyncStorage.getItem('ludoline_lang').then((lang) => {
  if (lang) i18n.changeLanguage(lang);
});

export default i18n;
