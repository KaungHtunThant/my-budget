<script setup lang="ts">
import {
  IonIcon,
  IonLabel,
  IonPage,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/vue'
import {
  ellipsisHorizontalOutline,
  homeOutline,
  pieChartOutline,
  swapVerticalOutline,
  walletOutline,
} from 'ionicons/icons'
</script>

<template>
  <IonPage>
    <IonTabs>
      <IonRouterOutlet />
      <IonTabBar slot="bottom">
        <IonTabButton tab="home" href="/tabs/home">
          <IonIcon :icon="homeOutline" />
          <IonLabel>Home</IonLabel>
        </IonTabButton>
        <IonTabButton tab="transactions" href="/tabs/transactions">
          <IonIcon :icon="swapVerticalOutline" />
          <IonLabel>Activity</IonLabel>
        </IonTabButton>
        <IonTabButton tab="budgets" href="/tabs/budgets">
          <IonIcon :icon="pieChartOutline" />
          <IonLabel>Budgets</IonLabel>
        </IonTabButton>
        <IonTabButton tab="salary" href="/tabs/salary">
          <IonIcon :icon="walletOutline" />
          <IonLabel>Salary</IonLabel>
        </IonTabButton>
        <IonTabButton tab="more" href="/tabs/more">
          <IonIcon :icon="ellipsisHorizontalOutline" />
          <IonLabel>More</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  </IonPage>
</template>
