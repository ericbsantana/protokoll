<script setup lang="ts">
import { computed } from 'vue'
import { getAddress, type ContractKey } from '../lib/deployments'
import Addr from './Addr.vue'

const props = defineProps<{
  version?: string
  contract: ContractKey
}>()

const address = computed(() => getAddress(props.version, props.contract))
</script>

<template>
  <Addr :addr="address" />
</template>
