import { createApp } from 'vue';
import VoterSupportApp from './VoterSupportApp.vue';

const rootEl = document.getElementById('voter-support-app');
if (rootEl) {
  const app = createApp(VoterSupportApp);
  app.mount(rootEl);
}
