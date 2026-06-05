import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ModelConfigPage from './ModelConfigPage.vue';

const app = createApp(ModelConfigPage);
app.use(createPinia());
app.mount('#app');
