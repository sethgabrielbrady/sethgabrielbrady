import { createRouter, createWebHistory } from 'vue-router';
import KoiPond from '../views/KoiPond.vue';
import type { RouteRecordRaw } from 'vue-router';

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
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
