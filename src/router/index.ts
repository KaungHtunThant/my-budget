import { createRouter, createWebHistory } from '@ionic/vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useBudgetStore } from '@/stores/budget'

declare module 'vue-router' {
  interface RouteMeta {
    /** Reachable before onboarding is complete. */
    public?: boolean
    /** Where the hardware back button goes from here. Absent on a top-level page. */
    parent?: string
  }
}

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/tabs/home' },
  {
    path: '/onboarding',
    component: () => import('@/views/OnboardingPage/OnboardingPage.vue'),
    meta: { public: true },
  },
  {
    path: '/tabs/',
    component: () => import('@/views/TabsPage/TabsPage.vue'),
    children: [
      { path: '', redirect: '/tabs/home' },
      { path: 'home', component: () => import('@/views/HomePage/HomePage.vue') },
      {
        path: 'transactions',
        component: () => import('@/views/TransactionsPage/TransactionsPage.vue'),
      },
      { path: 'budgets', component: () => import('@/views/BudgetsPage/BudgetsPage.vue') },
      { path: 'goals', component: () => import('@/views/GoalsPage/GoalsPage.vue') },
      { path: 'more', component: () => import('@/views/MorePage/MorePage.vue') },
      // A retired tab URL (or any typo) lands on Home rather than leaving the outlet
      // showing the previous page under a tab that no longer exists.
      { path: ':pathMatch(.*)', redirect: '/tabs/home' },
    ],
  },
  // Child pages name their parent: the page they are listed on, not wherever they were opened
  // from. Tabs and onboarding have none — back on them is "press again to exit".
  {
    path: '/wallets',
    component: () => import('@/views/WalletsPage/WalletsPage.vue'),
    meta: { parent: '/tabs/more' },
  },
  {
    path: '/categories',
    component: () => import('@/views/CategoriesPage/CategoriesPage.vue'),
    meta: { parent: '/tabs/more' },
  },
  {
    path: '/recurring',
    component: () => import('@/views/RecurringPage/RecurringPage.vue'),
    meta: { parent: '/tabs/more' },
  },
  {
    path: '/reports',
    component: () => import('@/views/ReportsPage/ReportsPage.vue'),
    meta: { parent: '/tabs/more' },
  },
  {
    path: '/settings',
    component: () => import('@/views/SettingsPage/SettingsPage.vue'),
    meta: { parent: '/tabs/more' },
  },
  {
    path: '/currencies',
    component: () => import('@/views/CurrenciesPage/CurrenciesPage.vue'),
    meta: { parent: '/settings' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

/**
 * First run sends the user to onboarding, because the base currency has to be chosen
 * before any amount in the app can be rendered meaningfully.
 */
router.beforeEach(async (to) => {
  const store = useBudgetStore()
  await store.init()

  if (!store.settings.onboardingComplete && !to.meta.public) {
    return { path: '/onboarding' }
  }
  if (store.settings.onboardingComplete && to.path === '/onboarding') {
    return { path: '/tabs/home' }
  }
  return true
})

export default router
