import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/home.vue')
    },
    {
      path: '/question/:id',
      name: 'question',
      component: () => import('@/pages/question-detail.vue'),
      props: true
    }
  ]
})

export default router
