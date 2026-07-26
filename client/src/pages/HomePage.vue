<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api, type Brand } from "../api/client";

const brands = ref<Brand[]>([]);

onMounted(async () => {
  brands.value = await api.getBrands();
});
</script>

<template>
  <div class="section">
    <p class="label">Selecione a marca</p>
    <div class="card-grid">
      <router-link
        v-for="brand in brands"
        :key="brand.id"
        :to="`/${brand.slug}`"
        class="card"
      >
        <div class="card-title">{{ brand.name.toUpperCase() }}</div>
      </router-link>
    </div>
  </div>
</template>
