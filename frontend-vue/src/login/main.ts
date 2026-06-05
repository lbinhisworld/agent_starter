import { createApp } from 'vue';
import { createPinia } from 'pinia';
import LoginPage from './LoginPage.vue';

const app = createApp(LoginPage);
app.use(createPinia());
app.mount('#app');

