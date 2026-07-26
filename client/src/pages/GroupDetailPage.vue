<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { api, type GroupDetail } from "../api/client";

const props = defineProps<{ brandSlug: string; modelSlug: string; groupCode: string }>();
const route = useRoute();
const group = ref<GroupDetail | null>(null);

async function load() {
  group.value = await api.getGroupDetail(props.brandSlug, props.modelSlug, props.groupCode);
}

onMounted(load);
watch(() => [props.brandSlug, props.modelSlug, props.groupCode], load);

function isHighlighted(partId: number) {
  return String(route.query.highlight) === String(partId);
}
</script>

<template>
  <div v-if="group" class="group-detail">
    <div class="illustration-pane">
      <img
        v-if="group.illustrationFile"
        :src="`/images/${modelSlug}/${group.illustrationFile}`"
        :alt="group.name"
      />
    </div>
    <div class="table-pane">
      <h2>{{ group.code }} {{ group.name }}</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Cód. CKD</th>
            <th>Cód. Sobres.</th>
            <th>Designação</th>
            <th>Coef.</th>
            <th>Observações</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="part in group.parts"
            :key="part.id"
            :class="{ highlighted: isHighlighted(part.id) }"
          >
            <td>{{ part.itemNumber }}</td>
            <td>{{ part.codCkd }}</td>
            <td>{{ part.codSobres }}</td>
            <td>{{ part.designacao }}</td>
            <td>{{ part.coef }}</td>
            <td>{{ part.observacoes }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
