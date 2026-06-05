import { createApp } from 'vue';
import { createPinia } from 'pinia';
import AdminPage from './AdminPage.vue';

const app = createApp(AdminPage);
app.use(createPinia());
app.mount('#app');

