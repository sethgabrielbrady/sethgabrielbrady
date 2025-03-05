import { createRouter, createWebHistory } from 'vue-router';
import KoiPond from '../views/KoiPond.vue';
// import GameBoard from '../views/GameBoard.vue';
import Voxel from '../views/Voxel.vue';


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
  // {
  //   path: '/gameboard',
  //   name: 'GameBoard',
  //   component: GameBoard,
  //   meta: {
  //     requiresAuth: false,
  //   },
  // },
  {
    path: '/voxel',
    name: 'Voxel',
    component: Voxel,
    meta: {
      requiresAuth: false,
    },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
