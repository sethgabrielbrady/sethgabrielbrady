import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import KoiPond from '../views/KoiPond.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'KoiPond',
    component: KoiPond,
    meta: {
      requiresAuth: false,
    },
  },
  // Add more routes here
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;