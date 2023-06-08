import { createApp, h } from 'nativescript-vue';

import App from './components/Home.vue';

createApp({ render: () => h('Frame', {}, [h(App)]) })
  .use(() => {
    console.log('test1');
  })
  .start();
